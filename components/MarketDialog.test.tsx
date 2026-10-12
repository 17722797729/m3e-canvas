import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

/* 详情页的预览拉进来的是整套编辑器外壳（市场接口、登录、真预览……）。这里只关心**交给预览的那份
 * 文档**：整组屏都在里面、从第一屏开始（`screensAsDoc` 本身在 lib/screens.test.ts 里有细账）。 */
vi.mock("@/lib/tokens", () => import("../lib/tokens"));
vi.mock("@/lib/i18n", () => import("../lib/i18n"));
vi.mock("@/lib/color", () => import("../lib/color"));
vi.mock("@/lib/market", () => import("../lib/market"));
vi.mock("@/lib/screens", () => import("../lib/screens"));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ font: "sans" }), ensureFontLoaded: () => {} }));
vi.mock("@/lib/shapes", () => ({}));
vi.mock("@/lib/session", () => ({ useSession: () => ({ loggedIn: true }) }));
vi.mock("@/lib/syai", () => ({ marketComponentDetail: vi.fn(), addToMyComponents: vi.fn() }));
vi.mock("motion/react", () => ({ AnimatePresence: "div", motion: { div: "div" } }));
vi.mock("./M3Node", () => ({ Icon: "icon" }));
vi.mock("./LoginDialog", () => ({ LoginDialog: "div" }));
vi.mock("./UserAvatar", () => ({ UserAvatar: "div" }));
vi.mock("./MarketPreview", () => ({ MarketPreview: "div" }));
/* 预览换成一个把"收到的那份文档"写进标记里的桩：屏的名字、身份与起点都看得见 */
vi.mock("./Preview", () => ({
  Preview: (props: { startId: string; doc: { frames: { id: string; name: string; role?: string }[] } }) =>
    `preview start=${props.startId} frames=${props.doc.frames.map((f) => `${f.id}:${f.name}${f.role === "overlay" ? "(浮层)" : ""}`).join("+")}`,
}));

import { renderToStaticMarkup } from "react-dom/server";
import { LangContext, type Lang } from "../lib/i18n";
import { packData, screenDataOf } from "../lib/market";
import { PALETTES, makeItem, type Frame, type Group, type PlacedItem } from "../lib/tokens";
import { MarketDialog } from "./MarketDialog";

const part = (id: string, patch: Record<string, unknown> = {}): PlacedItem =>
  ({ ...makeItem("button"), id, label: id, x: 0, y: 0, ...patch }) as PlacedItem;

/** 好友列表那种组件：甲上有一颗按钮弹出乙（浮层屏），两屏一起上传 */
function packed(): string {
  const a: Frame = { id: "A", name: "甲", x: 0, y: 0, w: 412, h: 892 };
  const b: Frame = { id: "B", name: "乙", x: 900, y: 0, w: 412, h: 892, role: "overlay", level: "modal" };
  const groups: Group[] = [
    { id: "gA", x: 0, y: 0, axis: "x", frameId: "A", items: [part("a1", { action: { to: "B", transition: "slideUp", dialog: true } })] },
    { id: "gB", x: 0, y: 0, axis: "x", frameId: "B", items: [part("b1")] },
  ];
  const screens = [a, b].map((f) => screenDataOf(f, groups, [a, b], {}));
  const tight = [{ x: 0, y: 0, axis: "x" as const, items: groups[0].items as PlacedItem[] }];
  return packData(tight, { w: 100, h: 44 }, undefined, screens[0], screens);
}

const detail = (lang: Lang = "zh") =>
  renderToStaticMarkup(
    createElement(
      LangContext.Provider,
      { value: lang },
      createElement(MarketDialog as never, {
        p: PALETTES[0],
        component: { id: 7, name: "好友列表", type: 5, data: packed() },
        onClose: () => {},
        allowAdd: true,
      } as never),
    ) as never,
  );

describe("the market detail preview's document", () => {
  it("carries the whole group of screens, not just the one on show", () => {
    /* 从前这里只铺当前那一屏 —— 甲上那颗按钮于是指着一个文档里不存在的 id，点下去什么都不发生 */
    const frames = /frames=([^"]*)/.exec(detail())![1];
    expect(frames.split("+")).toHaveLength(2);
    expect(frames).toContain(":甲");
    /* 浮层屏照旧是浮层：预览里它是弹在甲上面的那一层 */
    expect(frames).toContain(":乙(浮层)");
  });

  it("starts the preview on the first screen, as it always did", () => {
    const out = detail();
    expect(/start=([\w-]+)/.exec(out)![1]).toBe(/frames=([\w-]+):/.exec(out)![1]);
  });
});
