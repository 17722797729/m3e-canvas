import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/* 上传对话框拉进来的是整套编辑器外壳（截图、OSS、登录、市场接口……）。这里只关心它**画出来的清单与
 * 按钮**，所以把要碰浏览器的那几样打桩，其余别名指向真模块。 */
vi.mock("@/lib/tokens", () => import("../lib/tokens"));
vi.mock("@/lib/i18n", () => import("../lib/i18n"));
vi.mock("@/lib/color", () => import("../lib/color"));
vi.mock("@/lib/market", () => import("../lib/market"));
vi.mock("@/lib/screens", () => import("../lib/screens"));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ font: "sans" }), ensureFontLoaded: () => {} }));
vi.mock("@/lib/shapes", () => ({}));
vi.mock("@/lib/session", () => ({ useSession: () => ({ loggedIn: true }) }));
vi.mock("@/lib/syai", () => ({ uploadMarketComponent: vi.fn() }));
vi.mock("@/lib/ossUpload", () => ({ dataUrlBlob: () => ({}), uploadThumbnailToOss: async () => undefined }));
vi.mock("@/lib/marketThumbnail", () => ({
  captureBox: (_node: unknown, w: number, h: number) => ({ w, h }),
  captureOptions: () => ({}),
  iconFontEmbedCss: async () => "",
  iconFontReady: async () => {},
  squareThumbnail: () => null,
  thumbScale: () => 1,
  warmIconFont: () => {},
}));
vi.mock("html-to-image", () => ({ toPng: async () => "data:," }));
vi.mock("motion/react", () => ({ AnimatePresence: "div", motion: { div: "div" }, useReducedMotion: () => false }));
vi.mock("./M3Node", () => ({ Icon: "icon" }));
vi.mock("./LoginDialog", () => ({ LoginDialog: "div" }));
vi.mock("./StaticFrame", () => ({ StaticFrame: "div" }));
vi.mock("./ui", () => ({ inputBox: () => ({}) }));

import { renderToStaticMarkup } from "react-dom/server";
import { LangContext, t, type Lang } from "../lib/i18n";
import { PALETTES, makeItem, type Frame, type Group, type Item, type PlacedItem } from "../lib/tokens";
import { UploadMarketDialog } from "./UploadMarketDialog";

const frameOf = (id: string, patch: Partial<Frame> = {}): Frame => ({ id, name: id, x: 0, y: 0, w: 412, h: 892, ...patch });
const part = (id: string, patch: Partial<Item> = {}): Item => ({ ...makeItem("button"), id, label: id, ...patch }) as Item;

/** 一串屏：A→B→C→…（每屏一个部件，点一下去下一屏），刚好可以拿来试闭包与上限 */
const chain = (n: number) => {
  const frames: Frame[] = [];
  const groups: Group[] = [];
  for (let i = 0; i < n; i++) {
    const id = String.fromCharCode(65 + i);
    const next = String.fromCharCode(66 + i);
    frames.push(frameOf(id));
    groups.push({
      id: `g-${id}`,
      x: 0,
      y: 0,
      axis: "x",
      frameId: id,
      items: [{ ...part(`${id}1`, i < n - 1 ? { action: { to: next, transition: "none" } } : {}), x: 0, y: 0 } as PlacedItem],
    });
  }
  return { frames, groups };
};

const dialog = (source: { frames: Frame[]; groups: Group[] }, lang: Lang = "zh") =>
  renderToStaticMarkup(
    createElement(
      LangContext.Provider,
      { value: lang },
      createElement(UploadMarketDialog as never, {
        p: PALETTES[0],
        open: true,
        onClose: () => {},
        doc: { ...source, widths: {} },
        frame: source.frames[0],
        /* 编辑器总是把它给上（点「查看」把那一屏滚到眼前） */
        onReveal: () => {},
      } as never),
    ) as unknown as ReactNode,
  );

describe("the upload dialog's screens", () => {
  it("says nothing extra when the screen references nothing", () => {
    const out = dialog(chain(1));
    expect(out).not.toContain(t("screensBundled", "zh"));
    expect(out).toContain(t("uploadSubmit", "zh"));
  });

  it("lists what it will bring along, and says what each one is", () => {
    const out = dialog(chain(2));
    expect(out).toContain(t("screensBundled", "zh"));
    expect(out).toContain("2 / 3");
    expect(out).toContain("A");
    expect(out).toContain("B");
    /* 起屏与页面各自的身份，以及"被引用一次" */
    expect(out).toContain(t("screenIsStart", "zh"));
    expect(out).toContain(t("screenIsPage", "zh"));
    expect(out).toContain(t("screenRefCount", "zh").replace("{n}", "1"));
    /* 「查看」给得出来，按钮说的是"带上这 2 个屏幕一起上传"，而且没有被禁用 */
    expect(out).toContain(t("viewScreen", "zh"));
    expect(out).toContain(t("uploadSubmitWithScreens", "zh").replace("{n}", "2"));
    expect(out).not.toContain('disabled=""');
  });

  it("marks an overlay screen as one — it will still pop over the page it lands on", () => {
    const source = chain(2);
    source.frames[1] = frameOf("B", { role: "overlay", level: "modal" });
    expect(dialog(source)).toContain(t("screenIsOverlay", "zh"));
  });

  it("refuses to publish past three screens, and names every screen so the author can trim", () => {
    const out = dialog(chain(4));
    expect(out).toContain(t("screensTooMany", "zh").replace("{n}", "4").replace("{max}", "3"));
    expect(out).toContain("4 / 3");
    /* 四屏一个不少地列出来 —— 作者才知道该去删哪条引用 */
    for (const id of ["A", "B", "C", "D"]) expect(out).toContain(id);
    /* 按钮禁用：画成不可点的那一套 */
    expect(out).toContain('disabled=""');
    expect(out).toContain(`background:${PALETTES[0].surfaceContainerHighest}`);
  });

  it("keeps a dead tap out of the list, and says how many there are", () => {
    const source = chain(1);
    source.groups[0].items.push({ ...part("a2", { action: { to: "gone", transition: "none" } }), x: 60, y: 0 } as PlacedItem);
    const out = dialog(source);
    expect(out).toContain(t("uploadDeadRefs", "zh").replace("{n}", "1"));
    /* 死链不带走任何屏：清单照旧只有起屏那一屏……（只有一屏时整块清单不出现） */
    expect(out).not.toContain(t("screensBundled", "zh"));
  });
});
