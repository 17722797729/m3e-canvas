import { afterEach, describe, expect, it, vi } from "vitest";
import { FROM_EDITOR_KEY, editorHref, goToEditor, markFromEditor, takeFromEditor } from "./appPath";

/* 子页（/flow/、/market/）里的「返回编辑器」必须落在编辑器的地址上。
 * 曾经写成 "./"，浏览器把它解析回子页自己，按钮就像坏了一样 —— 这里钉住这一点。 */
describe("the way back to the editor", () => {
  it("gives the site root for a root deployment", () => {
    expect(editorHref("")).toBe("/");
  });

  it("gives the base path root when the app is served under one", () => {
    expect(editorHref("/m3e-canvas")).toBe("/m3e-canvas/");
    expect(editorHref("/a/b")).toBe("/a/b/");
  });

  it("is never the relative form that resolves back to the page it is on", () => {
    const href = editorHref("/m3e-canvas");
    expect(href).not.toBe("./");
    /* 从 /market/ 出发解析，必须是站点根而不是 /market/ 自己 */
    expect(new URL(href, "http://host/m3e-canvas/market/").pathname).toBe("/m3e-canvas/");
    expect(new URL(editorHref(""), "http://host/market/").pathname).toBe("/");
  });
});

/* 子页上的「返回编辑器」：从编辑器来的要退回去，而不是重新加载一次编辑器 */
describe("getting back from a sub-page", () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
    };
  };

  const withSession = <T>(fn: () => T): T => {
    const store = memory();
    const real = globalThis.sessionStorage;
    Object.defineProperty(globalThis, "sessionStorage", { value: store, configurable: true });
    try {
      return fn();
    } finally {
      Object.defineProperty(globalThis, "sessionStorage", { value: real, configurable: true });
    }
  };

  afterEach(() => vi.restoreAllMocks());

  it("remembers the editor and hands the mark over once", () => {
    withSession(() => {
      expect(takeFromEditor()).toBe(false);
      markFromEditor();
      expect(sessionStorage.getItem(FROM_EDITOR_KEY)).toBe("1");
      expect(takeFromEditor()).toBe(true);
      /* 用掉即删：再点一次不该继续后退，把用户带出站点 */
      expect(takeFromEditor()).toBe(false);
    });
  });

  it("goes back in history when the visit started in the editor", () => {
    withSession(() => {
      markFromEditor();
      const back = vi.fn();
      const assign = vi.fn();
      vi.stubGlobal("window", { history: { back }, location: { assign } });
      goToEditor();
      expect(back).toHaveBeenCalledTimes(1);
      expect(assign).not.toHaveBeenCalled();
    });
  });

  it("goes to the editor root when the page was opened directly", () => {
    withSession(() => {
      const back = vi.fn();
      const assign = vi.fn();
      vi.stubGlobal("window", { history: { back }, location: { assign } });
      goToEditor();
      expect(back).not.toHaveBeenCalled();
      expect(assign).toHaveBeenCalledWith("/");
    });
  });
});
