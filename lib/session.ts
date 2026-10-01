/**
 * 登录态的 React 出口
 * ---------------------------------------------------------------------------
 * 存储本身在 lib/syai.ts 里，与 looyo / syai_web 共用同一批 localStorage 键。
 * 这里只做两件事：页面加载时把缓存先渲染出来（首屏不闪），再后台校验一次；
 * 以及给 React 一个订阅点，避免每个组件各自去读 localStorage。
 */

import { useSyncExternalStore } from "react";
import {
  ApiError,
  SyaiUser,
  clearSession,
  fetchUser,
  getCachedUser,
  hasSession,
} from "./syai";

export interface SessionState {
  /** null 表示还没校验完，先用缓存渲染 */
  user: SyaiUser | null;
  loggedIn: boolean;
  ready: boolean;
}

let state: SessionState = { user: null, loggedIn: false, ready: false };
const listeners = new Set<() => void>();

function publish(next: Partial<SessionState>): void {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

export const getSession = (): SessionState => state;

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** 当前登录态；组件作者的头像菜单、上传按钮都读它 */
export const useSession = (): SessionState =>
  useSyncExternalStore(subscribe, getSession, () => state);

/** 登录成功后由登录弹窗调用 */
export function setSessionUser(user: SyaiUser | null): void {
  publish({ user, loggedIn: Boolean(user) || hasSession(), ready: true });
}

/** 退出登录 */
export function signOut(): void {
  clearSession();
  publish({ user: null, loggedIn: false, ready: true });
}

let booted = false;

/**
 * 页面加载时调用一次：先用缓存的用户渲染，再后台校验并静默刷新。
 * 弱网时保留缓存登录态，不因为一次请求失败就把人踢下线。
 */
export function bootSession(): void {
  if (booted) return;
  booted = true;

  if (!hasSession()) {
    publish({ user: null, loggedIn: false, ready: true });
    return;
  }

  publish({ user: getCachedUser(), loggedIn: true, ready: false });

  void (async () => {
    try {
      const user = await fetchUser();
      publish({ user, loggedIn: true, ready: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 401) {
        /* 服务端说这份登录态已经无效了：本地也清掉，免得每次进页面都白跑一趟 */
        clearSession();
        publish({ user: null, loggedIn: false, ready: true });
      } else {
        publish({ loggedIn: Boolean(hasSession()), ready: true });
      }
    }
  })();
}

/** 作者的显示名：昵称优先，其次隐去中间四位的手机号 */
export function displayNameOf(user: SyaiUser | null): string {
  if (!user) return "";
  const nickname = (user.nickname || user.userName) as string | undefined;
  if (nickname) return nickname;
  const mobile = String(user.mobile ?? user.phone ?? "");
  if (/^\d{11}$/.test(mobile)) return `${mobile.slice(0, 3)}****${mobile.slice(7)}`;
  return mobile;
}

/** 头像地址，没有就交给调用方画首字母 */
export const avatarOf = (user: SyaiUser | null): string =>
  String(user?.avatar ?? user?.userAvatar ?? "");
