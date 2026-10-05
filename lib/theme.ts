"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, FONTS, FontKey, LANG_FONT, Theme } from "./tokens";
import { themeForSystem } from "./systemTheme";
import type { Lang } from "./i18n";

/** The document theme, read by parts that render differently under it
 *  (emphasized type, motion scheme). Shape goes through the tokens helpers. */
export const ThemeContext = createContext<Theme>(DEFAULT_THEME);
export const useTheme = () => useContext(ThemeContext);

/**
 * 订阅系统的深浅色偏好：先报一次当前值，之后系统一变就再报一次
 *
 * DOM 相关的那一小块单独拆出来，是为了它能被测试（这个仓库的测试环境没有 DOM，
 * 用一个假的 `window.matchMedia` 就能把"现在读一次 + change 时再读"覆盖住）。
 * 返回退订函数。没有 `window` / `matchMedia` 就什么都不做，等于不跟随。
 */
export function subscribeSystemDark(onChange: (dark: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => onChange(mq.matches);
  apply();
  mq.addEventListener("change", apply);
  return () => mq.removeEventListener("change", apply);
}

/**
 * 系统现在是不是深色（`prefers-color-scheme`），跟着系统设置变
 *
 * 首帧一律 `false`，挂载后才读真实值：静态导出的页面是在构建机上预渲染的，
 * 拿不到也不该猜用户的系统设置，否则首帧和 SSR 的 HTML 对不上（水合错位）。
 * 这也和 DEFAULT_THEME.dark = false 是同一件事：系统还不知道之前就画浅色。
 */
export function useSystemDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => subscribeSystemDark(setDark), []);
  return dark;
}

/** 上屏的主题：应用级那份（themeForDoc 的规则）再按深浅色模式定 `dark` */
export function useSystemTheme(theme: Theme): Theme {
  return themeForSystem(theme, useSystemDark());
}

const loaded = new Set<FontKey>();

/** Fetch a Google font the first time it is chosen; the built-in faces need nothing.
 *  `onReady` fires once the face is usable, so measured widths can be refreshed. */
export function ensureFontLoaded(key: FontKey, onReady?: () => void) {
  const f = FONTS.find((x) => x.key === key);
  if (typeof document === "undefined") return;
  const ready = () => document.fonts?.ready.then(() => onReady?.());
  if (!f?.google || loaded.has(key)) {
    ready();
    return;
  }
  loaded.add(key);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
  link.onload = () => {
    /* the stylesheet is in, but the face itself downloads on first use: load it explicitly */
    const face = f.family.split(",")[0].trim().replace(/^'|'$/g, "");
    Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 16px "${face}"`))).then(ready, ready);
  };
  document.head.appendChild(link);
}

const loadedLangs = new Set<Lang>();

/** Fetch the Noto Sans face for a language the first time it is used. */
export function ensureLangFontLoaded(lang: Lang, onReady?: () => void) {
  const f = LANG_FONT[lang];
  if (typeof document === "undefined") return;
  const ready = () => document.fonts?.ready.then(() => onReady?.());
  if (!f || loadedLangs.has(lang)) {
    ready();
    return;
  }
  loadedLangs.add(lang);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
  link.onload = () => {
    const face = f.family.replace(/^'|'$/g, "");
    Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 16px "${face}"`))).then(ready, ready);
  };
  document.head.appendChild(link);
}

