import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUDIT_REJECTED,
  ApiError,
  TOKEN_KEY,
  REFRESH_KEY,
  clearSession,
  fetchUser,
  getAccessToken,
  hasSession,
  marketComponentPage,
  myUploadPage,
  sendSmsCode,
  smsLogin,
  uploadMarketComponent,
} from "./syai";

/* The backend's contract, as looyo and syai_web already rely on it: an envelope of
 * { code, data, msg }, a **bare** token in the Authorization header, and the login state under the
 * same three localStorage keys. m3e-canvas shares that state rather than inventing its own. */

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage;
}

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ code: 0, data }) });
const bad = (code: number, msg: string) => ({ ok: true, status: 200, json: async () => ({ code, data: null, msg }) });

describe("the syai client", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: memoryStorage(), sessionStorage: memoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts with no session and forgets everything on sign-out", async () => {
    expect(hasSession()).toBe(false);
    const fetchMock = vi.fn(async () => ok({ accessToken: "at", refreshToken: "rt" }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      localStorage: (() => {
        const s = memoryStorage();
        s.setItem(REFRESH_KEY, "rt");
        return s;
      })(),
      sessionStorage: memoryStorage(),
    });
    expect(hasSession()).toBe(true);
    clearSession();
    expect(getAccessToken()).toBe("");
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("posts the SMS scene the backend expects", async () => {
    const fetchMock = vi.fn(async () => ok(true));
    vi.stubGlobal("fetch", fetchMock);
    await sendSmsCode("13800138000");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://syai.vxwebgame.com/app-api/syai/users/send-sms-code");
    expect(JSON.parse(String(init.body))).toEqual({ mobile: "13800138000", scene: 31 });
  });

  it("writes the tokens and the user under the shared keys", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).endsWith("sms-login") ? ok({ accessToken: "at", refreshToken: "rt" }) : ok({ nickname: "炽鸦" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = await smsLogin("13800138000", "123456");
    expect(user).toMatchObject({ nickname: "炽鸦" });
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("at");
    expect(window.localStorage.getItem(REFRESH_KEY)).toBe("rt");

    /* the second call carries the bare token — no "Bearer " prefix */
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(String(url).endsWith("/syai/users/get-user")).toBe(true);
    expect((init.headers as Headers).get("Authorization")).toBe("at");
  });

  it("keeps the login state in sessionStorage when the author does not want to be remembered", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).endsWith("sms-login") ? ok({ accessToken: "at", refreshToken: "rt" }) : ok({}),
    );
    vi.stubGlobal("fetch", fetchMock);
    await smsLogin("13800138000", "123456", false);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe("at");
    expect(getAccessToken()).toBe("at");
  });

  it("reports the backend's own message when it refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => bad(10200, "市场组件不存在或已下架。")));
    await expect(fetchUser()).rejects.toThrow("市场组件不存在或已下架。");
    await expect(fetchUser()).rejects.toBeInstanceOf(ApiError);
  });

  it("sends the market list as one POST body with paging and the type filter", async () => {
    const fetchMock = vi.fn(async () => ok({ list: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await marketComponentPage(2, 8, 5, "轮盘");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://syai.vxwebgame.com/app-api/syai/market-component/page");
    expect(JSON.parse(String(init.body))).toEqual({ pageNo: 2, pageSize: 8, type: 5, name: "轮盘", sort: "created" });
    /* the market list is public: no token, and no header when there is none */
    expect(init.headers).toBeInstanceOf(Headers);
  });

  /* 排序交给后端：两者都是降序，前端只把选择传过去 */
  it("passes the chosen sort through, newest first by default", async () => {
    const fetchMock = vi.fn(async () => ok({ list: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await marketComponentPage(1, 8, null, undefined, "downloads");
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({
      sort: "downloads",
    });
    await marketComponentPage(1, 8);
    expect(JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body))).toMatchObject({
      sort: "created",
    });
  });

  it("sends my-upload paging with the audit filter, so a rejected part is findable", async () => {
    const fetchMock = vi.fn(async () => ok({ list: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await myUploadPage(2, 10, null, AUDIT_REJECTED);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://syai.vxwebgame.com/app-api/syai/market-component/my-upload/page");
    expect(JSON.parse(String(init.body))).toEqual({ pageNo: 2, pageSize: 10, auditStatus: AUDIT_REJECTED });
  });

  it("uploads a component with its type, name and the hidden fields the dialog adds", async () => {
    const fetchMock = vi.fn(async () => ok(42));
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem(TOKEN_KEY, "at");
    const id = await uploadMarketComponent({
      name: "抽奖轮盘",
      type: 5,
      data: '{"w":320,"h":200,"items":[]}',
      thumbnail: "data:image/png;base64,AAAA",
      screenName: "首页",
    });
    expect(id).toBe(42);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Headers).get("Authorization")).toBe("at");
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: "抽奖轮盘",
      type: 5,
      screenName: "首页",
      thumbnail: "data:image/png;base64,AAAA",
    });
  });

  it("turns a dead session into a plain error and clears it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => bad(401, "登录已失效")));
    window.localStorage.setItem(TOKEN_KEY, "stale");
    await expect(fetchUser()).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBe("");
  });
});
