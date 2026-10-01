import { describe, expect, it } from "vitest";
import { editorHref } from "./appPath";

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
