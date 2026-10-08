import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/* 部件面板（组件面板）把各分类铺开成一个个 Tile；它拉进来的还是那几样编辑器外壳，所以照别的组件测试
 * 把浏览器那两样（motion / 装载指示器）打桩，其余别名指向真模块。 */
vi.mock("@/lib/tokens", () => import("../lib/tokens"));
vi.mock("@/lib/i18n", () => import("../lib/i18n"));
vi.mock("@/lib/color", () => import("../lib/color"));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ font: "sans" }), ensureFontLoaded: () => {} }));
vi.mock("@/lib/shapes", () => ({}));
vi.mock("@/lib/market", () => import("../lib/market"));
vi.mock("@/lib/paletteSections", () => import("../lib/paletteSections"));
vi.mock("@/lib/syai", () => ({}));
vi.mock("motion/react", () => ({ motion: { div: "div", span: "span", button: "button" }, AnimatePresence: "div", useReducedMotion: () => false }));
vi.mock("./Loading", () => ({ CircularProgress: "circle", LinearProgress: "bar", LoadingIndicator: "spinner" }));

import { renderToStaticMarkup } from "react-dom/server";
import { LangContext, type Lang } from "../lib/i18n";
import { CATEGORY_TEXT } from "../lib/paletteSections";
import { PALETTES } from "../lib/tokens";
import { PartsPalette } from "./PartsPalette";

const noop = () => {};

/** 面板铺开的样子（不搜索：搜索那一路不分节） */
const palette = (lang: Lang) =>
  renderToStaticMarkup(
    createElement(
      LangContext.Provider,
      { value: lang },
      createElement(PartsPalette as never, { palette: PALETTES[0], favorites: [], onToggleFavorite: noop, onPartPointerDown: noop } as never),
    ) as unknown as ReactNode,
  );

/* 作者要的落点：确认框在「组件 → 容器」里，挨着「对话框」（见 KIND_ORDER / docs/reference-prototypes/
   confirm-box.md）。这一节断言的是**画出来的面板**，不只是那份顺序数据。 */
describe("the confirm box in the parts palette", () => {
  it("stands in 容器, right beside the dialog", () => {
    const out = palette("zh");
    const containerAt = out.indexOf(CATEGORY_TEXT.zh.containment);
    const dialogAt = out.indexOf("对话框");
    const confirmAt = out.indexOf("确认框");
    /* 三者都在，而且顺序是 容器 → 对话框 → 确认框（同一节里挨着） */
    expect(containerAt).toBeGreaterThan(-1);
    expect(dialogAt).toBeGreaterThan(containerAt);
    expect(confirmAt).toBeGreaterThan(dialogAt);
    /* 它还在容器的下一节（输入）之前：确认框没有被落到别的分类里去 */
    const inputsAt = out.indexOf(CATEGORY_TEXT.zh.inputs);
    expect(inputsAt).toBeGreaterThan(confirmAt);
    /* 别的分类里没有它 */
    expect(out.slice(inputsAt)).not.toContain("确认框");
  });

  it("keeps the tile's own name in every language", () => {
    for (const [lang, noun] of [["ja", "確認ボックス"], ["en", "Confirm box"], ["zh", "确认框"], ["ko", "확인 상자"]] as const) {
      const out = palette(lang);
      /* 英文面板用的是 KIND_SPEC 的 label，其余语言用 KIND_TEXT 的 noun（见 PartsPalette 的 labelOf） */
      expect(out, lang).toContain(noun);
    }
  });
});
