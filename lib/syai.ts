/**
 * syai 后端客户端
 * ---------------------------------------------------------------------------
 * m3e-canvas 是静态导出（`output: "export"`），没有自己的服务端，
 * 所以这里直接跨域调用 syai 的 app-api —— 与该接口的 CORS 配置一致
 * （allowedOriginPatterns:* 且 allowCredentials:true），无需代理。
 *
 * 约定与 looyo / syai_web 完全对齐：
 *   · 登录态落在 localStorage 的 access_token / refresh_access_token / userInfo，
 *     三个键名与两端一致，因此从官网或 SyoAi 登录后回到这里仍是登录状态；
 *   · Authorization 传**裸 token**，不加 "Bearer " 前缀；
 *   · 响应信封 { code, data, msg }，code === 0 为成功。
 */

const API_BASE: string =
  process.env.NEXT_PUBLIC_SYAI_API_URL || "https://syai.vxwebgame.com/app-api";

export const TOKEN_KEY = "access_token";
export const REFRESH_KEY = "refresh_access_token";
export const USER_KEY = "userInfo";
/** syai 侧短信登录场景值 */
const SCENE_SMS_LOGIN = 31;
/** 发送验证码的冷却秒数 */
export const SMS_COOLDOWN = 60;

interface Envelope<T> {
  code: number;
  data: T;
  msg?: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface SyaiUser {
  id?: number | string;
  nickname?: string;
  mobile?: string;
  phone?: string;
  avatar?: string;
  userName?: string;
  userAvatar?: string;
  [k: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ── 存储 ──────────────────────────────────────────────────────────────── */

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    /* 隐私模式会抛，服务端渲染时 window 也不在 */
    return null;
  }
}

function ss(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getAccessToken(): string {
  return ls()?.getItem(TOKEN_KEY) || ss()?.getItem(TOKEN_KEY) || "";
}

export function getRefreshToken(): string {
  return ls()?.getItem(REFRESH_KEY) || "";
}

export function getCachedUser(): SyaiUser | null {
  const raw = ls()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SyaiUser;
  } catch {
    return null;
  }
}

export const hasSession = () => Boolean(getAccessToken() || getRefreshToken());

export function setTokens(tokens: Partial<Tokens>, remember = true): void {
  const { accessToken, refreshToken } = tokens;
  if (accessToken) {
    ls()?.removeItem(TOKEN_KEY);
    ss()?.removeItem(TOKEN_KEY);
    (remember ? ls() : ss())?.setItem(TOKEN_KEY, accessToken);
  }
  if (refreshToken) ls()?.setItem(REFRESH_KEY, refreshToken);
}

export function setCachedUser(user: SyaiUser): void {
  try {
    ls()?.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* 配额满了也会抛，忽略 */
  }
}

/** 清掉本地登录态；账号菜单、会话失效都走它 */
export function clearSession(): void {
  ls()?.removeItem(TOKEN_KEY);
  ls()?.removeItem(REFRESH_KEY);
  ls()?.removeItem(USER_KEY);
  ss()?.removeItem(TOKEN_KEY);
}

/* ── 请求 ──────────────────────────────────────────────────────────────── */

async function call<T>(
  path: string,
  init: RequestInit & { auth?: boolean; skipRefresh?: boolean } = {},
): Promise<T> {
  const { auth = false, skipRefresh = false, headers, ...rest } = init;

  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (auth) {
    const token = getAccessToken();
    if (token) h.set("Authorization", token); // 裸 token，无 Bearer 前缀
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...rest, headers: h });
  } catch {
    throw new ApiError("网络不可用，请检查网络后重试");
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    /* 非 JSON 响应 */
  }

  const code = body?.code ?? res.status;

  if (code === 401 && auth && !skipRefresh && getRefreshToken()) {
    await refreshAccessToken();
    return call<T>(path, { ...init, skipRefresh: true });
  }

  if (code !== 0) {
    if (code === 401) clearSession();
    throw new ApiError(body?.msg || `请求失败（${res.status}）`, code);
  }

  return body!.data;
}

const post = <T>(path: string, data: unknown, auth = true) =>
  call<T>(path, { method: "POST", body: JSON.stringify(data), auth });

/* ── 登录 ──────────────────────────────────────────────────────────────── */

/** 发送短信验证码 */
export const sendSmsCode = (mobile: string) =>
  call<boolean>("/syai/users/send-sms-code", {
    method: "POST",
    body: JSON.stringify({ mobile, scene: SCENE_SMS_LOGIN }),
  });

/** 短信登录 / 注册（一体）。未注册的手机号会自动创建账号。 */
export async function smsLogin(mobile: string, code: string, remember = true): Promise<SyaiUser> {
  const data = await call<Partial<Tokens>>("/syai/users/sms-login", {
    method: "POST",
    body: JSON.stringify({ mobile, code }),
  });
  if (!data?.accessToken || !data?.refreshToken) throw new ApiError("登录响应缺少 Token，请重试");

  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }, remember);
  try {
    return await fetchUser();
  } catch (err) {
    clearSession(); // 避免半登录状态
    throw err;
  }
}

/** 拉取当前用户，同时刷新本地用户缓存 */
export async function fetchUser(): Promise<SyaiUser> {
  const user = await call<SyaiUser>("/syai/users/get-user", { method: "GET", auth: true });
  setCachedUser(user);
  return user;
}

/* ── Token 刷新（并发去重，避免 401 风暴） ─────────────────────────────── */

let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const rt = getRefreshToken();
  if (!rt) {
    clearSession();
    return Promise.reject(new ApiError("登录已过期，请重新登录", 401));
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(
        `${API_BASE}/syai/users/refresh-token?refreshToken=${encodeURIComponent(rt)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rt),
        },
      );
      const body = (await res.json()) as Envelope<Partial<Tokens>>;
      const payload = body?.data?.accessToken ? body.data : (body as unknown as Tokens);
      if (!payload?.accessToken) throw new ApiError("刷新 Token 失败", body?.code);

      setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken || rt });
      return payload.accessToken;
    } catch (err) {
      clearSession();
      throw err instanceof ApiError ? err : new ApiError("登录已过期，请重新登录", 401);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** 登出：先清本地，再知会服务端（服务端失败不阻塞本地清理） */
export async function logout(): Promise<void> {
  try {
    await call("/member/auth/logout", { method: "POST", auth: true });
  } catch {
    /* 忽略 */
  }
  clearSession();
}

/* ── 市场组件 ──────────────────────────────────────────────────────────── */

/** 组件类型：与后端 MarketComponentTypeEnum、以及本项目的 CATEGORIES 一一对应 */
export type ComponentTypeCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ComponentType {
  code: ComponentTypeCode;
  name: string;
}

/** 审核状态：新上传的组件先落在「待审核」，后台通过后才出现在市场 */
export const AUDIT_WAITING = 0;
export const AUDIT_PASSED = 1;
export const AUDIT_REJECTED = 2;

export interface MarketComponent {
  /** 雪花 id：后端可能下发字符串，前端原样透传 */
  id: number | string;
  name: string;
  type: ComponentTypeCode;
  typeName?: string;
  thumbnail?: string;
  description?: string;
  userId?: number;
  userName?: string;
  userAvatar?: string;
  screenName?: string;
  downloadCount?: number;
  recommend?: boolean;
  status?: number;
  statusName?: string;
  /** 审核状态：0 待审核 1 已通过 2 未通过；只有已通过的才会出现在市场里 */
  auditStatus?: number;
  auditStatusName?: string;
  auditRemark?: string;
  auditTime?: string | number;
  createTime?: string | number;
  /** 组件数据 JSON，只有详情接口会下发 */
  data?: string;
}

export interface MyComponent {
  id: number | string;
  name: string;
  type: ComponentTypeCode;
  typeName?: string;
  thumbnail?: string;
  description?: string;
  sourceId?: number | null;
  sourceUserName?: string;
  data?: string;
}

export interface PageResult<T> {
  list: T[];
  total: number;
}

/** 市场组件分页；name / type 都可选 */
export const marketComponentPage = (pageNo: number, pageSize: number, type?: ComponentTypeCode | null, name?: string) =>
  post<PageResult<MarketComponent>>("/syai/market-component/page", {
    pageNo,
    pageSize,
    type: type ?? undefined,
    name: name?.trim() || undefined,
  }, false);

/** 市场组件详情，带组件数据 */
export const marketComponentDetail = (id: number | string) =>
  post<MarketComponent>("/syai/market-component/get", { id }, false);

/** 组件类型字典 */
export const componentTypes = () => post<ComponentType[]>("/syai/market-component/type-list", {}, false);

/** 上传一个组件到市场 */
export const uploadMarketComponent = (payload: {
  name: string;
  type: ComponentTypeCode;
  data: string;
  thumbnail?: string;
  description?: string;
  screenName?: string;
}) => post<number>("/syai/market-component/upload", payload);

/** 加入我的组件；重复加入同一个只保留一份 */
export const addToMyComponents = (id: number | string, type?: ComponentTypeCode, name?: string) =>
  post<number>("/syai/market-component/add-to-my", { id, type, name });

/** 我的组件全量列表，组件面板按类型分组用 */
export const myComponentList = () => post<MyComponent[]>("/syai/market-component/my-list", {});

/** 我的组件分页 */
export const myComponentPage = (pageNo: number, pageSize: number, type?: ComponentTypeCode | null) =>
  post<PageResult<MyComponent>>("/syai/market-component/my-page", { pageNo, pageSize, type: type ?? undefined });

/** 删除我的组件 */
export const deleteMyComponent = (id: number | string) =>
  post<boolean>("/syai/market-component/my-delete", { id });

/**
 * 我上传的市场组件：待审核、未通过的都在里面，带审核状态、备注与时间。
 * 与「我的组件」（加入组件面板的那一批）不是一回事。
 */
export const myUploadPage = (pageNo: number, pageSize: number, type?: ComponentTypeCode | null, auditStatus?: number | null) =>
  post<PageResult<MarketComponent>>("/syai/market-component/my-upload/page", {
    pageNo,
    pageSize,
    type: type ?? undefined,
    auditStatus: auditStatus ?? undefined,
  });

/** 删除我上传的市场组件 */
export const deleteMyUpload = (id: number | string) =>
  post<boolean>("/syai/market-component/my-upload/delete", { id });
