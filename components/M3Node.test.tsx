import { createElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

/* M3Node pulls in Motion, the loaders and the palette for the rest of its kinds; the badge's own
 * body needs none of them, so the aliases point at the real modules the way the other component
 * tests do and only the drawing libraries are stubbed. */
vi.mock("@/lib/tokens", () => import("../lib/tokens"));
vi.mock("@/lib/i18n", () => import("../lib/i18n"));
vi.mock("@/lib/color", () => import("../lib/color"));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ font: "sans" }) }));
vi.mock("@/lib/shapes", () => ({}));
vi.mock("motion/react", () => ({ motion: { div: "div", span: "span", button: "button" }, useReducedMotion: () => false }));
vi.mock("./Loading", () => ({ CircularProgress: "circle", LinearProgress: "bar", LoadingIndicator: "spinner" }));

import { renderToStaticMarkup } from "react-dom/server";

import { JOYSTICK_SIZE, KIND_ORDER, KIND_SPEC, PALETTES, TASK_BAR_ICON, TASK_BAR_VALUE, VARIANTS, assetPillTextWidth, assetPillWidth, baseRadii, buttonMetrics, buttonWidth, confirmBoxMetrics, gridCheckZ, layerOf, makeItem, setGlobalShape, sizeOf, taskBarMetrics, uniformRadii, type Item, type Variant } from "../lib/tokens";
import { BadgeContent, GridCellMarks, M3Static, PartPressContext, swallowsInnerTap } from "./M3Node";

/** What a still drawing shows: the same geometry the canvas, an export and a market thumbnail share. */
const draw = (it: Item) => renderToStaticMarkup(M3Static({ item: it, palette: PALETTES[0] }));

type El = ReactElement<Record<string, unknown>>;
const styleOf = (el: El) => el.props.style as Record<string, unknown>;

/* A badge is a pill the author sizes: it has to be drawn as tall as they asked *from the middle
 * out*. Anchored to the top of its box it looked like the badge shrank from the bottom only once
 * the height went below the pill's own. */
describe("a badge's body", () => {
  const badge = (patch: Record<string, unknown> = {}) => BadgeContent({ item: { ...makeItem("badge"), ...patch } as never, p: PALETTES[0] }) as El;

  it("centres the pill in whatever box the author gave it", () => {
    const box = badge({ size: 24, size2: 40 });
    expect(styleOf(box)).toMatchObject({ display: "grid", placeItems: "center", height: "100%" });
    const pill = box.props.children as El;
    /* the pill is the box's height, so shrinking the box shrinks the pill, from the middle out */
    expect(styleOf(pill)).toMatchObject({ height: 40, width: "100%", borderRadius: 20 });
    /* a short badge keeps its number inside itself */
    const short = badge({ size: 12, size2: 12 });
    const shortPill = (short.props.children as El);
    expect(styleOf(shortPill).fontSize).toBe(8);
    expect(styleOf(shortPill).borderRadius).toBe(6);
  });

  it("paints the pill itself", () => {
    const pill = badge().props.children as El;
    expect(styleOf(pill).background).toBe(PALETTES[0].error);
    const own = badge({ color: "primary", strokeWidth: 2 });
    expect(styleOf(own.props.children as El).background).toBe(PALETTES[0].primary);
    expect(styleOf(own.props.children as El).boxShadow).toContain("inset");
  });

  /* 徽标里也可以是图标（任务信息条那枚"锁"就是这么画出来的）：药丸上还是同一支笔，只是里面站的是
     一个 Icon 而不是那行字。图标优先 —— 给了图标就不再画字（见 taskBarButtonBadgeOn）。 */
  it("draws an icon in place of the words when it is handed one", () => {
    const painted = (label: string, icon?: string) =>
      renderToStaticMarkup(BadgeContent({ item: { ...makeItem("badge"), label, size: 20, size2: 20 } as never, p: PALETTES[0], icon }) as never);
    const withIcon = painted("3", "lock");
    /* 圆药丸：宽就是它自己的高，图标按字那条 0.7 的规矩缩（20 × 0.7 = 14） */
    expect(withIcon).toContain("width:100%");
    expect(withIcon).toContain("height:20px;padding:0;border-radius:10px");
    expect(withIcon).toContain("font-size:14px");
    expect(withIcon).toContain('<span class="msr" data-fill="0" style="font-size:14px">lock</span>');
    /* 字让位：不再画那个 3 */
    expect(withIcon).not.toContain(">3<");
    /* 没给图标时一个字都不变 */
    const text = painted("3");
    expect(text).toContain(">3<");
    expect(text).not.toContain("msr");
  });
});

/* A board's checkbox lives over a cell rather than in it, and it belongs to the board: it is drawn
 * above whatever the author dropped into the cell, and only over a cell that holds something —
 * a tick marks an item, so an empty slot has nothing to mark. */
describe("the checkbox over a board's cell", () => {
  const cell = (patch: Partial<Item> = {}) => ({ ...makeItem("box"), id: "c", size: 56, size2: 56, ...patch }) as Item;
  const marks = (grid: Item, it: Item) => GridCellMarks({ grid, cell: it, checked: false, p: PALETTES[0] }) as El;
  const box = (grid: Item, it: Item) => {
    const kids = [marks(grid, it).props.children].flat(2).filter(Boolean) as El[];
    return kids.find((k) => k.props["data-cell-check"] !== undefined);
  };
  const board = (patch: Partial<Item> = {}) => ({ ...makeItem("invGrid"), checkboxes: true, ...patch }) as Item;

  it("is drawn over a cell that holds something", () => {
    const filled = cell({ children: [{ ...makeItem("iconButton"), id: "ib", x: 4, y: 4 } as never] });
    expect(box(board(), filled)).toBeTruthy();
    /* above the cell's own contents: a part dropped into a cell lands one layer above it */
    expect(styleOf(box(board(), filled)!).zIndex).toBe(20);
    expect(styleOf(box(board(), filled)!).zIndex as number).toBeGreaterThan(layerOf(filled) + 1);
  });

  it("is left out of a cell with nothing in it", () => {
    expect(box(board(), cell())).toBeUndefined();
    /* and the whole mark is gone when the author has not turned the boxes on */
    expect(box(board({ checkboxes: undefined }), cell({ children: [{ ...makeItem("iconButton"), id: "ib", x: 4, y: 4 } as never] }))).toBeUndefined();
  });

  it("follows a board the author lifted", () => {
    const lifted = cell({ z: 30, children: [{ ...makeItem("iconButton"), id: "ib", x: 4, y: 4 } as never] });
    expect(gridCheckZ(lifted)).toBeGreaterThan(layerOf(lifted) + 1);
    expect(styleOf(box(board(), lifted)!).zIndex).toBe(gridCheckZ(lifted));
  });
});

/* An item cell is the 背包格子 composite as one part: the picture, the count, the two corner marks and
 * the name under the cell — all of them drawn by the same controls the parts it absorbed use. */
describe("an item cell as drawn", () => {
  const cell = (patch: Partial<Item> = {}) =>
    ({ ...makeItem("itemCell"), label: "树叶", supporting: "23", badge2Text: "普通", badgeText: "新", ...patch }) as Item;

  it("draws the picture, the count, both marks and the name", () => {
    const out = draw(cell());
    expect(out).toContain("eco");
    expect(out).toContain("23");
    expect(out).toContain("普通");
    expect(out).toContain("新");
    expect(out).toContain("树叶");
    /* the cell square sits on the part's own width, sharp by default (the author asked for 0) */
    expect(out).toContain("width:60px;height:60px");
    expect(out).toContain("width:60px;height:60px;border-radius:0");
    /* and the part is the composite's 60×76: the cell plus the name's line */
    expect(out).toContain("width:60px;height:76px");
    /* the marks hug opposite corners of the cell */
    expect(out).toContain("top:2px;left:3px");
    expect(out).toContain("top:2px;right:3px");
    /* the hairline rings the cell itself; the plain box around the whole part draws none */
    expect(out).toContain("box-shadow:inset 0 0 0 1px");
    expect(out).toContain("box-shadow:none");
  });

  it("draws the corner the author set, held to half the square (never the part's height)", () => {
    /* 作者设过的圆角就画在格子上 */
    expect(draw(cell({ radiusTop: 12 }))).toContain("width:60px;height:60px;border-radius:12px");
    /* 60×76 的部件：封顶是正方形的一半 30，不是高度的一半 38 */
    expect(draw(cell({ radiusTop: 99 }))).toContain("width:60px;height:60px;border-radius:30px");
    /* 作者钉了矮格子，正方形小了，封顶跟着小 */
    expect(draw(cell({ radiusTop: 99, size2: 40 }))).toContain("border-radius:12px");
  });

  it("takes the name's line away with the name, rather than leaving a gap", () => {
    const out = draw(cell({ label: "" }));
    expect(out).not.toContain("树叶");
    expect(out).toContain("width:60px;height:60px;display:block");
    /* the whole part is the cell, so nothing is left standing under it */
    expect(out).not.toContain("height:76px");
  });

  it("paints the surface with the fill and the picture with the part colour, and never mixes them up", () => {
    const out = draw(cell({ fill: "#123456", color: "#ABCDEF" }));
    /* the cell's square wears the fill... */
    expect(out).toContain("background:#123456");
    /* ...and the icon wears the part colour, which is the control the inspector names 图标颜色 */
    expect(out).toContain("color:#ABCDEF");
  });

  it("leaves a mark out entirely when it is switched off", () => {
    const off = draw(cell({ badge: false, badge2: false }));
    expect(off).not.toContain("普通");
    expect(off).not.toContain("新");
    expect(off).toContain("树叶");
  });
});

/* 任务信息条是 任务信息条 composite 化成的一个部件：标题、奖励格和「领取」按钮全在一条的属性里，
 * 一个孩子都没有。画它们的还是那些部件自己的那几支笔 —— 格子角上的药丸走 BadgeContent（物品格那
 * 手），按钮走 ButtonContent，盒子里的每个数来自 taskBarMetrics。按钮右上角那枚徽标是这一条自己画在
 * **按钮上层**的另一层（作者：「徽标并不在按钮里面，它是在按钮的上层……可以在按钮的外面的」）。
 * 奖励格的个数、奖励图标和奖励数量都不是属性：画的是那三个固定的常量（两个 / TASK_BAR_ICON /
 * TASK_BAR_VALUE），所以 helper 里存下的 `icon: "eco"` 和 `value: 23` 一个字都不画。 */
describe("a task bar as drawn", () => {
  const bar = (patch: Partial<Item> = {}) =>
    ({
      ...makeItem("taskBar"),
      id: "tb",
      label: "每日登录游戏 (1/1)",
      /* 老文档里可能写着的两个字段：这一条现在都不看了（读回来也会让掉，见 lib/taskBar.test） */
      icon: "eco",
      value: 23,
      label2: "领取",
      badgeText: "新",
      badge2Text: "普通",
      badge2Color: "#7BAE7A",
      buttonBadgeText: "1",
      ...patch,
    }) as Item;
  const outer = (out: string) => out.slice(0, out.indexOf(">"));
  const drawnW = (out: string) => Number(outer(out).match(/width:(\d+)px/)![1]);
  const drawnH = (out: string) => Number(outer(out).match(/height:(\d+)px/)![1]);
  const count = (out: string, needle: RegExp) => out.match(needle)?.length ?? 0;
  /* 徽标那一层的稳定标记（纯新增，不参与样式和行为）：浏览器探针靠它量徽标和按钮各自的矩形 */
  const BADGE = "data-task-badge";

  it("draws one part — title, reward cells and button — with no children at all", () => {
    const out = draw(bar({ size: 388 }));
    /* 一个部件：整张图里只有它自己一个 data-part-id，一个孩子都没有 */
    expect(count(out, /data-part-id=/g)).toBe(1);
    expect(out).toContain('data-part-id="tb"');
    expect(out).toContain("每日登录游戏 (1/1)");
    expect(out).toContain("领取");
    /* 两个奖励格，每格一个奖励图标和一个数量 */
    expect(count(out, /width:56px;height:56px/g)).toBe(2);
    expect(count(out, /class="msr"/g)).toBe(2);
    expect(count(out, />23</g)).toBe(0);
    expect(count(out, new RegExp(`>${TASK_BAR_VALUE}<`, "g"))).toBe(2);
    /* 盒子就是画出来的那个：作者钉的 388 宽，内容算出来的 112 高 */
    expect(drawnW(out)).toBe(388);
    expect(drawnH(out)).toBe(sizeOf(bar({ size: 388 }), {}).h);
    expect(drawnH(out)).toBe(112);
    /* 高是量出来的那几块加起来的：上留白 14 + 标题 22 + 缝 10 + 格子那一行 56 + 下留白 10 */
    expect(out).toContain("padding:14px 13px 10px");
    expect(out).toContain("height:22px;flex:0 0 auto;display:flex;align-items:center;font-size:17px");
    expect(out).toContain("margin-top:10px;height:56px;flex:0 0 auto;display:flex;align-items:center;gap:23px");
    expect(14 + 22 + 10 + 56 + 10).toBe(drawnH(out));
    /* 那条任务信息条一行省略号，不把条撑高 */
    expect(out).toContain("text-overflow:ellipsis");
    /* 两格是横排的：同一行里，中间 23dp */
    expect(out.indexOf(`>${TASK_BAR_VALUE}<`)).toBeLessThan(out.indexOf("领取"));
    /* 给浏览器探针的稳定标记（纯新增，不参与样式和行为）：每个格子、每枚角标、那个按钮和压在它
       上层的那枚徽标各一个 */
    expect(count(out, /data-task-cell=/g)).toBe(2);
    expect(count(out, /data-task-mark="left"/g)).toBe(2);
    expect(count(out, /data-task-mark="right"/g)).toBe(2);
    expect(count(out, /data-task-button=""/g)).toBe(1);
    expect(count(out, /data-task-button-slot=""/g)).toBe(1);
    expect(count(out, new RegExp(`${BADGE}=""`, "g"))).toBe(1);
  });

  it("puts the corner pills on the cells' corners, at the item cell's own size", () => {
    const out = draw(bar({ size: 388 }));
    /* 角标①在格子的左上（作者定的那一对），角标②在右上，两格各一枚 —— 就是物品格 `mark()` 那套
       绝对定位：top 2、left/right 3 */
    expect(count(out, /top:2px;left:3px/g)).toBe(2);
    expect(count(out, /top:2px;right:3px/g)).toBe(2);
    /* 药丸是物品格那一条规矩里的大小：格子 56 的 18% —— 10dp 高，圆角半高，最小宽度也是高 */
    const markH = taskBarMetrics(bar()).markH;
    expect(markH).toBe(10);
    expect(count(out, new RegExp(`min-width:${markH}px;height:${markH}px;padding:0 3px;border-radius:${markH / 2}px`, "g"))).toBe(4);
    /* 角标①是主题自己的角色（error，和物品格那颗"新"点同一个规矩），角标②是作者设的品质绿 */
    expect(out).toContain(`background:${PALETTES[0].error}`);
    expect(out).toContain("background:#7BAE7A");
    /* 两枚角标都在格子里，不在按钮那一格 */
    expect(out.indexOf("top:2px;left:3px")).toBeLessThan(out.indexOf("width:120px;height:40px"));
  });

  it("draws the button with the button kind's own content, and the badge on a layer above its top right", () => {
    const out = draw(bar({ size: 388 }));
    const m = taskBarMetrics(bar());
    /* 按钮就是按钮：120×40 的胶囊（作者新设计里的 120×40），里面是 ButtonContent 那一行 */
    expect(out).toContain("width:120px;height:40px;border-radius:20px");
    expect(out).toContain("overflow:hidden");
    expect(out).toContain("padding-left:19px;padding-right:19px");
    expect(out).toContain(">领取<");
    /* 按钮站在一个槽里：槽比按钮宽出 9dp、高出一截 4dp（taskBarMetrics 的 slot 与 badge），那一截
       就是那枚徽标探出去的地方 —— 作者设计里的 124×48 按钮框正是这么框着 120×40 的按钮的 */
    expect(m.slot.w).toBe(129);
    expect(m.slot.h).toBe(44);
    expect(m.button.w + m.badge.overRight).toBe(m.slot.w);
    expect(m.button.h + m.badge.overTop).toBe(m.slot.h);
    expect(out).toContain(`width:${m.slot.w}px;height:${m.slot.h}px;box-sizing:border-box`);
    const slotAt = out.indexOf("data-task-button-slot");
    const buttonAt = out.indexOf("data-task-button=");
    const badgeAt = out.indexOf(BADGE);
    expect(slotAt).toBeGreaterThan(-1);
    /* 徽标不是按钮的孩子，而是槽里排在按钮**后面**的兄弟：按钮那一格在徽标之前就关掉了（文档顺序
       就是"画在按钮的上层"），于是按钮自己的 overflow: hidden 也裁不到它 */
    expect(buttonAt).toBeGreaterThan(slotAt);
    expect(badgeAt).toBeGreaterThan(buttonAt);
    expect(out.slice(buttonAt, badgeAt)).not.toContain(BADGE);
    /* 按钮那一格在徽标之前就关掉了（`</button>`：它是真按钮，见下面那条用例） */
    expect(out.slice(buttonAt, badgeAt)).toContain("</button>");
    /* 徽标站在槽的右上角（top 0 / right 0）：压在按钮的右上角，并且探出按钮的右边 9dp、上面 4dp */
    expect(out).toContain(`${BADGE}="" style="position:absolute;top:0;right:0;width:20px;height:20px;pointer-events:none"`);
    expect(m.badge.overRight).toBe(9);
    expect(m.badge.overTop).toBe(4);
    /* 那枚药丸有它自己的高（20dp）和由字算出来的宽，字就在里头 */
    expect(out).toContain("width:100%;height:20px;padding:0;border-radius:10px");
    expect(out.slice(badgeAt)).toContain(">1<");
    /* 徽标不是第二个图标：按钮那一块里没有 msr（整张图里的 msr 就是两个格子的那两枚） */
    expect(count(out.slice(out.indexOf("data-task-button=")), /class="msr"/g)).toBe(0);
  });

  it("stands its claim button as a real button, the one thing in the bar that answers a tap", () => {
    const out = draw(bar({ size: 388 }));
    /* 真 `<button type="button">`，不是画成按钮样子的 `<span>`：浏览器因此把点击、焦点、键盘都在这一格
       上交待清楚 —— 融合部件里唯一的点击目标就是它（整条不接这一下，见 Preview 的 PartPressContext） */
    expect(out).toContain('<button type="button" data-task-button=""');
    expect(count(out, /<button type="button"/g)).toBe(1);
    /* 浏览器给按钮的那几样都清掉了：内边距、边框、字体（不清的话标签会换字体）、焦点框、行内盒 */
    const buttonTag = out.slice(out.indexOf("data-task-button="), out.indexOf(">", out.indexOf("data-task-button=")));
    expect(buttonTag).toContain("padding:0;border:none;font:inherit;outline:none;display:block");
    /* 没有人给这一下处理器时（编辑器画布、导出图、市场缩略图）它不带 cursor:pointer，也不带按下
       的 transform —— 画出来就是死的，只有预览里 PartPressContext 出现时那两个处理器才挂上 */
    expect(buttonTag).toContain("cursor:default");
    expect(buttonTag).not.toContain("transform");
    /* 标题和两个奖励格都不是按钮：整条里只有这一处点击目标 */
    expect(count(out, /data-task-cell=/g)).toBe(2);
    expect(out.indexOf("data-task-cell=")).toBeLessThan(out.indexOf("data-task-button="));
  });

  /* 「置灰并停止响应」落在**按钮**上，不是整条（作者：「该组件按钮置灰并响应时，是针对按钮，而不是整个
     组件」）。画灰的是那一槽（按钮 + 它右上角那枚徽标），条本身、标题和两个奖励格一点滤镜都没有 ——
     范围判定在 lib/tokens 的 disablesWholePart，交给 M3Node 的是 PartPressContext 的 `off`。 */
  it("greys the claim button, not the bar, when the state switches it off", () => {
    const drawn = (off: boolean) =>
      renderToStaticMarkup(
        createElement(PartPressContext.Provider, { value: off ? { off: true } : {} }, M3Static({ item: bar({ size: 388 }), palette: PALETTES[0] })),
      );

    const off = drawn(true);
    const slotAt = off.indexOf("data-task-button-slot");
    const buttonAt = off.indexOf("data-task-button=");
    expect(slotAt).toBeGreaterThan(-1);
    expect(buttonAt).toBeGreaterThan(slotAt);
    expect(off).toContain('data-task-button-off=""');
    /* 那一槽灰了：和整块部件被关掉时同一套灰 */
    expect(off.slice(slotAt, buttonAt)).toContain("filter:grayscale(1)");
    expect(off.slice(slotAt, buttonAt)).toContain("opacity:0.55");
    /* 整张图里就这一处滤镜：条自己、标题、两个奖励格都不灰 */
    expect(count(off, /grayscale\(1\)/g)).toBe(1);
    expect(count(off, /opacity:0.55/g)).toBe(1);
    /* 按钮自己也说清了它是不可用的，不再摆出"能点"的样子 */
    expect(off.slice(buttonAt)).toContain('aria-disabled="true"');
    expect(off.slice(buttonAt, off.indexOf(">", buttonAt))).toContain("cursor:default");

    /* 没关的时候一丝灰都没有：同一张图，差的只是那一份 context */
    const on = drawn(false);
    expect(count(on, /grayscale\(1\)/g)).toBe(0);
    expect(on).not.toContain("data-task-button-off");
    expect(on).not.toContain("aria-disabled");
  });

  it("draws the badge's icon in place of its words, the icon winning when both are set", () => {
    const icon = draw(bar({ size: 388, buttonBadgeIcon: "lock" }));
    /* 徽标里画的是那个图标：一枚圆药丸（高 20 就宽 20），里面是锁 */
    expect(icon).toContain(`${BADGE}="" style="position:absolute;top:0;right:0;width:20px;height:20px;pointer-events:none"`);
    expect(icon).toContain('<span class="msr" data-fill="0" style="font-size:14px">lock</span>');
    /* 字让位：那一枚徽标里不再写 3 */
    expect(icon.slice(icon.indexOf(BADGE))).not.toContain(">3<");
    /* 两个都写着时也是图标说了算（见 taskBarButtonBadgeOn） */
    expect(draw(bar({ size: 388, buttonBadgeIcon: "lock", buttonBadgeText: "3" }))).toBe(icon);
    /* 格子还是各自那两枚奖励图标：整张图里 msr 一共三枚（两格 + 徽标里那枚锁） */
    expect(count(icon, /class="msr"/g)).toBe(3);
    /* 盒子一点都不因此变：徽标挂不挂、是字还是图标，都是同一个盒子 */
    expect(sizeOf(bar({ size: 388, buttonBadgeIcon: "lock" }), {})).toEqual({ w: 388, h: 112 });
    /* 清空的图标等于没有图标：还是那两个字（或者什么都没有） */
    expect(draw(bar({ size: 388, buttonBadgeIcon: "" }))).toBe(draw(bar({ size: 388 })));
  });

  it("draws the fixed reward icon in both cells, and neither pill when a mark is switched off", () => {
    /* 奖励格的图标不是这一条的字段：两个格子画的都是那个固定的默认图标，老文档里写下的 `icon`
       （helper 里那个 "eco"）一个字都不画 */
    const out = draw(bar({ size: 388 }));
    expect(count(out, /class="msr"/g)).toBe(2);
    expect(out).toContain(`>${TASK_BAR_ICON}<`);
    expect(out).not.toContain(">eco<");
    /* 老文档里还写着奖励格的个数也一样：画的还是那两个格子，盒子一个数都不变 */
    const legacy = draw(bar({ size: 388, cellCount: 1 } as unknown as Partial<Item>));
    expect(count(legacy, /data-task-cell=/g)).toBe(2);
    expect(count(legacy, /width:56px;height:56px/g)).toBe(2);
    expect(drawnH(legacy)).toBe(112);
    expect(legacy).toBe(out);

    const off = draw(bar({ size: 388, badge: false, badge2: false }));
    expect(off).not.toContain("新");
    expect(off).not.toContain("普通");
    expect(off).not.toContain("top:2px;left:3px");
    expect(off).not.toContain("top:2px;right:3px");
    /* 格子、图标和数量都还在，盒子也没变 */
    expect(count(off, /width:56px;height:56px/g)).toBe(2);
    expect(drawnH(off)).toBe(112);

    /* 按钮上的徽标关掉、或者字清空，画出来的是同一张图：没有字的药丸什么也不说明 */
    expect(draw(bar({ size: 388, buttonBadge: false }))).toBe(draw(bar({ size: 388, buttonBadge: true, buttonBadgeText: "" })));
    expect(draw(bar({ size: 388, buttonBadge: false }))).not.toContain(BADGE);
    /* 徽标那一层不是按钮的孩子：关掉字、又没有图标，那一层整个不画（槽还在，它只是空的） */
    expect(count(draw(bar({ size: 388, buttonBadgeText: "" })), new RegExp(`${BADGE}=""`, "g"))).toBe(0);
    expect(count(draw(bar({ size: 388 })), /data-task-button-slot=""/g)).toBe(1);
  });

  it("takes the title's line away with the title, and keeps its box the same whatever it carries", () => {
    const empty = draw(bar({ size: 388, label: "" }));
    expect(empty).not.toContain("每日登录游戏");
    expect(empty).not.toContain("height:22px");
    expect(drawnH(empty)).toBe(80);
    expect(drawnH(empty)).toBe(sizeOf(bar({ label: "" }), {}).h);
    /* 没有标题就没有缝：格子那一行紧跟着上留白（margin-top 写的是 0，浏览器省掉单位） */
    expect(empty).toContain("margin-top:0;height:56px");
    /* 角标开关、按钮徽标开关、徽标里的图标、老文档里的奖励格个数和奖励图标：盒子都是同一个数
       （画法也是同一条 —— 格子和图标都是常量，那两个老字段一个数都不动） */
    for (const patch of [
      { cellCount: 1 },
      { cellCount: 2 },
      { icon: "eco" },
      { icon: "paid" },
      { cellCount: 1, icon: "eco" },
      { label: "一条特别特别长的任务标题".repeat(8) },
      { badge: false, badge2: false },
      { buttonBadge: false },
      { badgeText: "" },
      { badge2Text: "很长的品质名" },
      { buttonBadgeIcon: "lock" },
      { buttonBadgeIcon: "lock", buttonBadgeText: "很长的字" },
    ] as unknown as Partial<Item>[]) {
      const out = draw(bar({ size: 388, ...patch }));
      expect(drawnW(out), JSON.stringify(patch)).toBe(388);
      expect(drawnH(out), JSON.stringify(patch)).toBe(sizeOf(bar({ size: 388, ...patch }), {}).h);
      expect(drawnH(out), JSON.stringify(patch)).toBe(112);
    }
    /* 一个空的标题是唯一一个让条变矮的东西 —— 那是另一个明确的数（80），不是魔法常量 */
    expect(drawnH(draw(bar({ size: 388 })))).toBe(112);
    expect(sizeOf(bar(), {}).h).toBe(KIND_SPEC.taskBar.h);
  });
});

/* 确认框是作者在「上传屏幕2」里手摆的那一版原稿（docs/reference-prototypes/confirm-box-component.json）
 * 化成的一个部件：标题、正文和两颗普通按钮全在它的属性里，一个孩子都没有。两块看起来像按钮的地方
 * 交给按钮自己的 ButtonContent 画（底、圆角、影子取按钮种类自己的那两样），正文档在框自己里，量它的
 * 是 confirmBoxMetrics —— 包围盒和画法同一个助手，所以"盒子大小"和"画出来的样子"不会各说各话。
 * 整块框不吃点击，只有那两颗按钮吃（见 taps 那一节与 Preview 的 PartPressContext）。 */
describe("a confirm box as drawn", () => {
  const cb = (patch: Partial<Item> = {}) =>
    ({
      ...makeItem("confirmBox"),
      id: "cb",
      label: "温馨提示",
      supporting: "确认当前操作？",
      label2: "确认",
      label3: "取消",
      ...patch,
    }) as Item;
  const outer = (out: string) => out.slice(0, out.indexOf(">"));
  const drawnW = (out: string) => Number(outer(out).match(/width:(\d+)px/)![1]);
  const drawnH = (out: string) => Number(outer(out).match(/height:(\d+)px/)![1]);
  const count = (out: string, needle: RegExp) => out.match(needle)?.length ?? 0;
  /** 一份 PartPressContext：预览里 Tappable 就是照这个形状把两颗按钮的那一下递下来的 */
  const drawn = (value: { press?: () => void; pressSlot?: (slot: string) => (() => void) | undefined; off?: boolean; preview?: boolean }) =>
    renderToStaticMarkup(createElement(PartPressContext.Provider, { value }, M3Static({ item: cb(), palette: PALETTES[0] })));

  it("draws one part — title, body and two buttons — with no children at all", () => {
    const out = draw(cb());
    /* 一个部件：整张图里只有它自己一个 data-part-id，一个孩子都没有 */
    expect(count(out, /data-part-id=/g)).toBe(1);
    expect(out).toContain('data-part-id="cb"');
    expect(out).toContain("温馨提示");
    expect(out).toContain("确认当前操作？");
    /* 作者原稿那个框：320×200，圆的 28 */
    expect(drawnW(out)).toBe(320);
    expect(drawnH(out)).toBe(200);
    expect(drawnH(out)).toBe(sizeOf(cb(), {}).h);
    expect(outer(out)).toContain("border-top-left-radius:28px");
    /* 上留白 14、左右 20、下留白 21 —— confirmBoxMetrics 那几块加起来正好 200 */
    expect(out).toContain("padding:14px 20px 21px");
    /* 标题：20dp、**居中**、一行 24（再长也省略号，不把框撑高） */
    expect(out).toContain("height:24px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;text-align:center;font-size:20px");
    expect(out).toContain("text-overflow:ellipsis");
    /* 正文带：280×72（320 − 2×20），正文 18dp 左对齐，带内左 25、上 10 */
    expect(out).toContain('data-confirm-band=""');
    expect(out).toContain("margin-top:10px;width:280px;height:72px;flex:0 0 auto;box-sizing:border-box;padding-top:10px;padding-left:25px");
    expect(out).toContain("font-size:18px;line-height:26px");
    /* 两颗**真**按钮，不是画成按钮样子的 span：浏览器因此把点击、焦点、键盘都在它们身上交待清楚 */
    expect(count(out, /<button type="button"/g)).toBe(2);
    /* 给浏览器探针的稳定标记（纯新增，不参与样式和行为）：正文带一个、每颗按钮一个 */
    expect(count(out, /data-confirm-band=""/g)).toBe(1);
    expect(count(out, /data-confirm-button=/g)).toBe(2);
  });

  it("stands the two buttons where the author's draft had them: cancel left, confirm right", () => {
    const out = draw(cb());
    /* 左「取消」右「确认」：和编辑器自己那个确认框同一个顺序（ui.tsx 的 ConfirmDialog） */
    const cancelAt = out.indexOf('data-confirm-button="cancel"');
    const mainAt = out.indexOf('data-confirm-button="main"');
    expect(cancelAt).toBeGreaterThan(-1);
    expect(mainAt).toBeGreaterThan(cancelAt);
    /* 两颗的字各画各的（ButtonContent 画的是按钮自己的那一份） */
    expect(out.slice(cancelAt, mainAt)).toContain(">取消<");
    expect(out.slice(mainAt)).toContain(">确认<");
    /* 一颗 104×49 的胶囊，半高的圆角 */
    for (const at of [cancelAt, mainAt]) {
      const tag = out.slice(at, out.indexOf(">", at));
      expect(tag).toContain("width:104px;height:49px;border-radius:24.5px");
      /* 浏览器给按钮的那几样都清掉了（和任务信息条那颗按钮同一个理由） */
      expect(tag).toContain("padding:0;border:none;font:inherit;outline:none;display:block");
    }
    /* 两颗各占一头：左右各留 20dp，中间那道缝 320 − 2×20 − 2×104 = 72 */
    expect(out).toContain("height:49px;flex:0 0 auto;display:flex;align-items:center;justify-content:space-between");
    expect(320 - 2 * 20 - 2 * 104).toBe(72);
    /* 整张图里就这两颗按钮：标题和正文都不是点击目标 */
    expect(count(out, /<button/g)).toBe(2);
  });

  it("draws both buttons dead until someone hands them the tap", () => {
    /* 没有人给处理器时（编辑器画布、导出图、市场缩略图）两颗都不摆出"能点"的样子，也没有按下的
       transform —— 编辑器里按住它们是从按钮上拖走这一块的手势 */
    const out = draw(cb());
    expect(count(out, /cursor:default/g)).toBe(2);
    expect(out).not.toContain("transform:scale");
    expect(out).not.toContain("transition:transform");
    expect(out).not.toContain("aria-disabled");
  });

  it("gives both buttons the same press, whichever of them has a destination", () => {
    /* 预览里（PartPressContext 出现，`preview` 为真）两颗**一模一样**：同样的 pointer、同样的按下
       手感 —— 不看它有没有配去处（作者：「取消和确认是完全一样的普通按钮，跟名称没有关系」）。主按钮
       那一下走 `press`，取消走 `pressSlot("cancel")`。 */
    const preview = drawn({ press: () => {}, pressSlot: () => () => {}, preview: true });
    expect(count(preview, /cursor:pointer/g)).toBe(2);
    expect(count(preview, /transition:transform 120ms/g)).toBe(2);
    /* 只给了主按钮那一下时，取消照旧有它自己那一份手感（它走的是槽位那一份，和主按钮无关） */
    const onlyMain = drawn({ press: () => {}, preview: true });
    expect(count(onlyMain, /cursor:pointer/g)).toBe(2);
  });

  it("greys the two buttons, not the frame, when the state switches them off", () => {
    const off = drawn({ off: true, preview: true });
    /* 两颗各灰一次 —— 框自己、标题和正文带一点都不灰（作者：「是针对按钮，而不是整个组件」） */
    expect(count(off, /grayscale\(1\)/g)).toBe(2);
    expect(count(off, /opacity:0.55/g)).toBe(2);
    expect(count(off, /data-confirm-button-off=""/g)).toBe(2);
    /* 每颗按钮自己也说清了它是不可用的 */
    expect(count(off, /aria-disabled="true"/g)).toBe(2);
    const frame = off.slice(0, off.indexOf('data-confirm-band=""'));
    expect(frame).not.toContain("grayscale(1)");
    expect(frame).not.toContain("opacity:0.55");
    /* 没关的时候一丝灰都没有 */
    const on = drawn({ press: () => {}, preview: true });
    expect(count(on, /grayscale\(1\)/g)).toBe(0);
    expect(on).not.toContain("data-confirm-button-off");
  });

  it("grows the band and the frame with the body's wrapped lines, instead of clipping them", () => {
    /* 29 个全角字折成三行：带从 72 长到 98，框从 200 长到 226（14+24+10+98+10+49+21） */
    const long = draw(cb({ supporting: "确".repeat(29) }));
    expect(drawnH(long)).toBe(226);
    expect(drawnH(long)).toBe(sizeOf(cb({ supporting: "确".repeat(29) }), {}).h);
    expect(long).toContain("height:98px;flex:0 0 auto;box-sizing:border-box;padding-top:10px;padding-left:25px");
    /* 两行以内还是那条 72 的下限：原稿那一档一点没变 */
    expect(drawnH(draw(cb({ supporting: "确".repeat(28) })))).toBe(200);
    /* 空标题、空正文各有自己的数（166 / 118） */
    const noTitle = draw(cb({ label: "" }));
    expect(drawnH(noTitle)).toBe(166);
    expect(noTitle).not.toContain("justify-content:center;text-align:center");
    const noBody = draw(cb({ supporting: "" }));
    expect(drawnH(noBody)).toBe(118);
    expect(noBody).not.toContain("data-confirm-band");
  });

  it("keeps the box's own numbers whatever the buttons say, and honours a pinned height", () => {
    for (const patch of [
      { label2: "" },
      { label3: "" },
      { label2: "确定" },
      { label3: "再想想" },
      { label2: "Confirm and continue", label3: "Cancel everything" },
    ] as unknown as Partial<Item>[]) {
      const out = draw(cb(patch));
      expect(drawnW(out), JSON.stringify(patch)).toBe(320);
      expect(drawnH(out), JSON.stringify(patch)).toBe(200);
    }
    /* 作者钉的高说了算，宽度也是 */
    expect(drawnW(draw(cb({ size: 388 })))).toBe(388);
    expect(drawnH(draw(cb({ size2: 240 })))).toBe(240);
    /* 更宽的框：带跟着宽（388 − 2×20 = 348），盒子的高还是内容算出来的那个 */
    expect(draw(cb({ size: 388 }))).toContain("width:348px;height:72px");
    expect(confirmBoxMetrics(cb()).h).toBe(KIND_SPEC.confirmBox.h);
  });
});

/* An amount on a bar: a mark on the left, and a second one the author may add on the right. */
describe("an asset pill as drawn", () => {
  const pillOf = (patch: Partial<Item> = {}) => ({ ...makeItem("assetPill"), label: "1.6亿", icon: "paid", ...patch }) as Item;

  it("draws the mark on its left, and none on its right until it is asked for", () => {
    const plain = draw(pillOf());
    expect(plain).toContain("paid");
    expect(plain).toContain("1.6亿");
    expect(plain).not.toContain("arrow_forward");
  });

  it("draws both, in order, once the right one is set", () => {
    const both = draw(pillOf({ icon2: "arrow_forward" }));
    expect(both).toContain("paid");
    expect(both).toContain("arrow_forward");
    /* the amount stands between the two marks */
    expect(both.indexOf("paid")).toBeLessThan(both.indexOf("1.6亿"));
    expect(both.indexOf("1.6亿")).toBeLessThan(both.indexOf("arrow_forward"));
  });

  it("lets the browser size it when the width is auto, so a long amount widens the bar", () => {
    const auto = draw(pillOf({ icon2: "arrow_forward" }));
    /* nothing is pinned: the box hugs its own content and carries no width of its own… */
    expect(auto).toContain("display:inline-flex");
    expect(auto.slice(0, auto.indexOf(">"))).not.toContain("width:");
    /* …so the words are never squeezed: no shrink and no ellipsis (those belong to a pinned box) */
    expect(auto).toContain("flex:0 0 auto");
    expect(auto).not.toContain("text-overflow:ellipsis");
    /* the row's numbers come from the one helper, so the element the editor measures and the element
       the canvas draws are the same content: inset 4, gap 6, two 20dp chips at 28 tall */
    expect(auto).toContain("padding:0 4px");
    expect(auto).toContain("gap:6px");
    expect(auto.match(/width:20px;height:20px;flex:0 0 auto/g)?.length).toBe(2);
    /* what the box reports before any measurement is the fallback estimate: 8 + 20 + 6 + 36 + 6 + 20 */
    expect(sizeOf(pillOf({ icon2: "arrow_forward" }), {}).w).toBe(96);
    expect(sizeOf(pillOf(), {}).w).toBe(70);
  });

  it("draws a pinned width, and lets the amount give way inside it", () => {
    const pinned = draw(pillOf({ icon2: "arrow_forward", size: 40 }));
    expect(pinned).toContain("width:40px;height:28px");
    expect(pinned).toContain("display:block");
    /* the rule that belongs to a pinned box: the amount shrinks and clips its own words */
    expect(pinned).toContain("flex:0 1 auto");
    expect(pinned).toContain("min-width:0");
    expect(pinned).toContain("text-overflow:ellipsis");
    expect(sizeOf(pillOf({ icon2: "arrow_forward", size: 40 }), {}).w).toBe(40);
  });

  it("reports the width the browser measured, however long the amount is", () => {
    /* the editor's hidden layer measures this very row and hands the number to sizeOf */
    const long = pillOf({ icon2: "arrow_forward", label: "1,234,567원" });
    const fallback = sizeOf(long, {}).w;
    expect(sizeOf(long, { [long.id]: 200 }).w).toBe(200);
    expect(200).toBeGreaterThan(fallback);
    expect(sizeOf(long, { [long.id]: 143 }).w).toBe(143);
    /* a width the author pinned wins over the measurement */
    const pinned = pillOf({ icon2: "arrow_forward", size: 40 });
    expect(sizeOf(pinned, { [pinned.id]: 200 }).w).toBe(40);
    /* a still frame has no measurement: it draws content-sized and reports the estimate, and the
       longer amount is the wider box */
    const still = draw(long);
    expect(still).toContain("display:inline-flex");
    expect(still).toContain("1,234,567원");
    expect(fallback).toBeGreaterThan(sizeOf(pillOf(), {}).w);
  });

  it("marks every part it draws with its own id for the browser to find", () => {
    const it = pillOf({ icon2: "arrow_forward" });
    expect(draw(it)).toContain(`data-part-id="${it.id}"`);
    /* every kind, through the shared wrapper — and a child of a container carries its own id */
    for (const kind of ["box", "button", "card", "textField", "invGrid"] as const) {
      const child = makeItem(kind);
      expect(draw(child), kind).toContain(`data-part-id="${child.id}"`);
    }
    const parent = makeItem("card");
    const kid = { ...makeItem("button"), id: "kid" };
    expect(renderToStaticMarkup(M3Static({ item: parent, palette: PALETTES[0], overlay: M3Static({ item: kid, palette: PALETTES[0] }) }))).toContain('data-part-id="kid"');
  });

  it("keeps its box and its drawing the same size, whatever it carries", () => {
    /* the recurring defect this guards: a part drawn one size while its box says another */
    const outer = (out: string) => out.slice(0, out.indexOf(">"));
    const drawnW = (out: string) => Number(outer(out).match(/width:(\d+)px/)![1]);
    const drawnH = (out: string) => Number(outer(out).match(/height:(\d+)px/)![1]);
    /* a pinned width is a number on the drawing, and it is the number sizeOf reports */
    for (const item of [pillOf({ icon2: "arrow_forward", size: 40 }), pillOf({ size: 120, size2: 36 })]) {
      const out = draw(item);
      expect(drawnW(out)).toBe(sizeOf(item, {}).w);
      expect(drawnH(out)).toBe(sizeOf(item, {}).h);
    }
    /* an auto one carries no width: the browser sizes it from the row that also gets measured, and the
       number sizeOf reports is that measurement — or the fallback estimate before there is one */
    for (const item of [pillOf({ icon2: "arrow_forward" }), pillOf({ icon: null }), pillOf({ label: "" }), pillOf({ icon2: "arrow_forward", size2: 40 })]) {
      const out = draw(item);
      expect(outer(out)).not.toContain("width:");
      expect(outer(out)).toContain("display:inline-flex");
      expect(drawnH(out)).toBe(sizeOf(item, {}).h);
      expect(sizeOf(item, { [item.id]: 137 }).w).toBe(137);
      expect(sizeOf(item, {}).w).toBe(assetPillWidth(item));
      expect(sizeOf(item, {}).h).toBe(item.size2 ?? 28);
    }
  });

  it("grows the bar when the author widens the spacing", () => {
    const narrow = pillOf({ icon2: "arrow_forward" });
    const wide = pillOf({ icon2: "arrow_forward", markGap: 16 });
    expect(draw(wide)).toContain("gap:16px");
    /* two gaps, so +10dp of spacing is +20dp of bar (in the browser the measured width grows with it,
       because the measured row is this same row) */
    expect(sizeOf(wide, {}).w - sizeOf(narrow, {}).w).toBe(20);
    expect(sizeOf(wide, { [wide.id]: 200 }).w).toBe(200);
    /* nothing is ellipsised while auto: the amount is drawn in full */
    expect(draw(wide)).toContain("1.6亿");
    expect(draw(wide)).not.toContain("text-overflow:ellipsis");
  });

  it("draws the corner it is given, and a plain rectangle when it is given none", () => {
    /* the rounded corner is the part's own box: set, it is the author's number… */
    expect(draw(pillOf({ radiusTop: 4 }))).toContain("border-top-left-radius:4px");
    expect(draw(pillOf({ radiusTop: 8 }))).toContain("border-top-right-radius:8px");
    /* …unset, it is a sharp rectangle… */
    expect(draw(pillOf())).toContain("border-top-left-radius:0;");
    expect(draw(pillOf())).toContain("border-bottom-right-radius:0;");
    /* …and set past half the drawn height it is held there */
    expect(draw(pillOf({ radiusTop: 99 }))).toContain("border-top-left-radius:14px");
    expect(draw(pillOf({ radiusTop: 99, size2: 36 }))).toContain("border-top-left-radius:18px");
  });

  it("lets the amount give way so a pinned width keeps its content inside the box", () => {
    const out = draw(pillOf({ icon2: "arrow_forward", size: 60 }));
    /* both marks keep their round size (the third `flex:0 0 auto` is the part's own wrapper) */
    expect(out.match(/width:20px;height:20px;flex:0 0 auto/g)?.length).toBe(2);
    expect(out).toContain("flex:0 1 auto");
    expect(out).toContain("min-width:0");
  });
});

/* 按钮**不再**有自己的右上角徽标（作者：「组件-按钮中有个右徽标属性，去掉此属性」）：老文档里还写着
 * 的 badge / badgeText 照样画成没有徽标的那张老图（读进来时就让掉了，见 lib/project.ts 的 readItem）。
 * 角上的徽标仍旧是功能按钮、物品格和任务信息条自己的，那几处一个字没动。 */
describe("a button drawn without its own badge", () => {
  const btn = (patch: Partial<Item> = {}) => ({ ...makeItem("button"), id: "btn", label: "OK", icon: "swords", ...patch }) as Item;
  const body = (out: string) => out.slice(out.indexOf(">") + 1);
  const outer = (out: string) => out.slice(0, out.indexOf(">"));
  const drawnH = (out: string) => Number(outer(out).match(/height:(\d+)px/)![1]);

  /* 这一手之前 ButtonContent 画出来的那个按钮（medium、有图标有文字：gap 8、留白 22、字号 16、
     图标 24px、胶囊圆角 28）—— 去掉徽标之后必须逐字节还是它。 */
  const BASELINE =
    '<div data-part-id="btn" style="background:#6750A4;color:#FFFFFF;border:none;height:56px;display:inline-flex;align-items:center;overflow:hidden;position:relative;z-index:10;box-sizing:border-box;box-shadow:none;border-top-left-radius:28px;border-top-right-radius:28px;border-bottom-left-radius:28px;border-bottom-right-radius:28px;flex:0 0 auto;transform-origin:center"><span style="display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;gap:8px;padding-left:22px;padding-right:22px;height:100%;font-size:16px;font-weight:500;letter-spacing:0.1px;white-space:nowrap"><span class="msr" data-fill="1" style="font-size:24px">swords</span><span>OK</span></span></div>';

  it("draws the medium button byte for byte", () => {
    expect(draw(btn())).toBe(BASELINE);
    expect(sizeOf(btn(), {})).toEqual({ w: 128, h: 56 });
  });

  it("ignores a badge an old document still carries", () => {
    /* 开关开着、写着字、开关关了、字被清空 —— 四种都是同一张老图：这一枚徽标已经不存在了 */
    for (const patch of [
      { badge: true, badgeText: "1" },
      { badge: true, badgeText: "New" },
      { badge: false, badgeText: "1" },
      { badge: true, badgeText: "" },
    ] as Partial<Item>[]) {
      expect(draw(btn(patch)), JSON.stringify(patch)).toBe(BASELINE);
      expect(sizeOf(btn(patch), {}), JSON.stringify(patch)).toEqual({ w: 128, h: 56 });
    }
    /* 那一枚角上药丸的每一处痕迹都不在了：锚点、右上角的站位、主题的 error 底 */
    const out = draw(btn({ badge: true, badgeText: "1" }));
    expect(out).not.toContain("position:absolute;inset:0");
    expect(out).not.toContain("place-items:start end");
    expect(out).not.toContain(PALETTES[0].error);
    /* 徽标不是第二个图标：整张图里仍旧只有左图标那一个 msr */
    expect(body(out).match(/class="msr"/g)?.length).toBe(1);
  });

  it("keeps the box and the drawing the same row, at every size", () => {
    for (const item of [
      btn(),
      btn({ size2: 40 }),
      btn({ size2: 112 }),
      btn({ icon: null }),
      btn({ label: "" }),
      btn({ label: "", icon: null }),
      btn({ size: 200 }),
      btn({ badge: true, badgeText: "1" }),
    ] as Item[]) {
      const out = draw(item);
      const at = JSON.stringify(item);
      expect(drawnH(out), at).toBe(sizeOf(item, {}).h);
      expect(body(out), at).not.toContain("text-overflow:ellipsis");
      if (item.size) {
        expect(outer(out), at).toContain(`width:${item.size}px;height:${sizeOf(item, {}).h}px`);
        expect(sizeOf(item, {}).w, at).toBe(item.size);
      } else {
        /* 没钉宽度时外面不写宽度：宽度由浏览器量那一行，量不到时 sizeOf 给 kind 自己的 w */
        expect(outer(out), at).not.toContain("width:");
        expect(sizeOf(item, {}).w, at).toBe(KIND_SPEC.button.w);
        expect(sizeOf(item, { btn: 300 }).w, at).toBe(300);
      }
    }
  });

  it("measures the very row it draws: one helper's numbers in the box and in the markup", () => {
    const it = btn();
    const m = buttonMetrics(it);
    const out = draw(it);
    /* 画出来的那一行，用的就是包围盒量它时用的那几个数（同一份 buttonMetrics）—— 行里只有图标和文字 */
    expect(out).toContain(`gap:${m.gap}px;padding-left:${m.pad}px;padding-right:${m.pad}px`);
    expect(out).toContain(`font-size:${m.font}px`);
    expect(m).toMatchObject({ gap: 8, pad: 22, icon: 24, font: 16, pieces: 2 });
    expect(buttonMetrics(btn({ icon: null }))).toMatchObject({ gap: 0, pad: 26, pieces: 1 });
    expect(buttonMetrics(btn({ label: "" }))).toMatchObject({ gap: 0, pad: 16, pieces: 1 });
    /* 盒子 = kind 自己的那个数（128 × 56），宽度估出来只服务于还没被量到时 */
    expect(sizeOf(it, {})).toEqual({ w: KIND_SPEC.button.w, h: 56 });
    expect(buttonWidth(it)).toBe(m.pad * 2 + m.icon + assetPillTextWidth("OK", m.font) + m.gap);
    expect(buttonWidth(it)).toBe(98);
    expect(buttonWidth(btn({ label: "a very long label indeed" }))).toBeGreaterThan(KIND_SPEC.button.w);
    expect(sizeOf(btn({ label: "a very long label indeed" }), {}).w).toBe(KIND_SPEC.button.w);
  });
});

/* The function button leads its category in the palette. */
describe("the palette order", () => {
  it("puts the function button first in 操作 and leaves the rest of the category alone", () => {
    expect(KIND_ORDER.filter((k) => KIND_SPEC[k].category === "actions")).toEqual([
      "fnButton", "button", "iconButton", "fab", "extendedFab", "splitButton", "chip", "joystick",
    ]);
    /* and no other category was disturbed */
    expect(KIND_ORDER.filter((k) => KIND_SPEC[k].category === "content")).toEqual([
      "itemCell", "assetPill", "text", "image", "camera", "map", "badge", "divider",
    ]);
  });
});

/* The direction wheel kept its plate, its centre and its knob; the four keys are gone. */
describe("the direction wheel as drawn", () => {
  it("has no direction keys left anywhere in the part", () => {
    const out = draw(makeItem("joystick"));
    for (const key of ["keyboard_arrow_up", "keyboard_arrow_right", "keyboard_arrow_down", "keyboard_arrow_left"]) {
      expect(out, key).not.toContain(key);
    }
    /* the plate and its knob are still there, and the pad's own centre mark with them */
    expect(out).toContain("data-joystick-knob");
    expect(out).toContain("border-radius:3px");
  });

  it("draws a true circle whatever the document's shape scale says", () => {
    /* a square-theme document used to draw a squarish pad: the plate is a circle by nature, so its
       corner follows the box it is drawn in and not the document's shape scale */
    const pad = makeItem("joystick");
    expect(baseRadii(pad)).toEqual(uniformRadii(JOYSTICK_SIZE / 2));
    setGlobalShape("square");
    expect(baseRadii(pad)).toEqual(uniformRadii(JOYSTICK_SIZE / 2));
    setGlobalShape("full");
    expect(baseRadii(pad)).toEqual(uniformRadii(JOYSTICK_SIZE / 2));
    setGlobalShape("rounded");
    /* and it stays a circle at any size the author picks: one side, so no box to stretch it into */
    expect(KIND_SPEC.joystick.size2).toBeUndefined();
    const big = { ...pad, size: 180, size2: 200 };
    expect(sizeOf(big, {})).toEqual({ w: 180, h: 180 });
    expect(baseRadii(big)).toEqual(uniformRadii(90));
    expect(draw(big)).toContain("border-top-left-radius:90px");
  });

  it("follows a drag without the author ever setting a number", () => {
    /* At rest there is nothing authored: the part is drawn with its knob in the middle. What the
       visitor drags reaches the drawing as the live value the preview hands the part (the runtime
       overlay), which is why the pad needs no value of its own — the same read, one source. */
    const pad = makeItem("joystick");
    expect(pad.value).toBeUndefined();
    expect(pad.max).toBeUndefined();
    expect(draw(pad)).toContain("left:calc(50% + 0px)");
    const dragged = draw({ ...pad, value: 90 });
    expect(dragged).toContain(`left:calc(50% + ${Math.round(JOYSTICK_SIZE * 0.32)}px)`);
  });

  it("shows no angle, however far the stick is pushed", () => {
    for (const value of [0, 1, 90, 180, 359]) {
      const out = draw({ ...makeItem("joystick"), value });
      expect(out, String(value)).not.toContain("°");
      /* not even as a bare number in a box of its own */
      expect(out, String(value)).not.toContain(`>${value}<`);
    }
  });

  it("draws the round plate its box measures, with the knob hanging on the middle", () => {
    const pad = makeItem("joystick");
    expect(sizeOf(pad, {})).toEqual({ w: JOYSTICK_SIZE, h: JOYSTICK_SIZE });
    const out = draw(pad);
    /* the box is the plate: square, and rounded by half its own side */
    expect(out).toContain(`width:${JOYSTICK_SIZE}px;height:${JOYSTICK_SIZE}px`);
    expect(out).toContain(`border-top-left-radius:${JOYSTICK_SIZE / 2}px`);
    expect(out).toContain(`border-bottom-right-radius:${JOYSTICK_SIZE / 2}px`);
    /* value 0 is dead centre: the knob is offset by nothing and hung back by half its size */
    const knob = JOYSTICK_SIZE * 0.34;
    expect(out).toContain("left:calc(50% + 0px)");
    expect(out).toContain("top:calc(50% + 0px)");
    expect(out).toContain(`width:${Math.round(knob)}px;height:${Math.round(knob)}px;margin-left:-${Math.round(knob / 2)}px`);
    /* the knob still answers the author's number — only the readout is gone */
    const turned = draw({ ...pad, value: 90 });
    expect(turned).toContain(`left:calc(50% + ${Math.round(JOYSTICK_SIZE * 0.32)}px)`);
    expect(turned).not.toContain("°");
    expect(sizeOf({ ...pad, value: 90 }, {})).toEqual({ w: JOYSTICK_SIZE, h: JOYSTICK_SIZE });
  });
});

/* 功能按钮的每一个样式都要真的画出来（见 variantsOf），资产框的两个图标也一样。 */
const LOOKS: Variant[] = VARIANTS.map((v) => v.key);

describe("a function button in every look it offers", () => {
  const fnOf = (variant: Variant) => ({ ...makeItem("fnButton"), variant, label: "イベント", badge: true, badgeText: "3" }) as Item;
  /** the circle: the box the look is painted on, from its own style up to the glyph */
  const circleOf = (out: string) => {
    const i = out.indexOf("display:grid;place-items:center;box-sizing:border-box");
    return out.slice(i, i + 220);
  };

  it("draws a different circle for every variant, not one look with five labels", () => {
    const circles = LOOKS.map((v) => circleOf(draw(fnOf(v))));
    expect(LOOKS).toHaveLength(5);
    expect(new Set(circles).size).toBe(5);
    expect(circleOf(draw(fnOf("filled")))).toContain("background:#6750A4");
    expect(circleOf(draw(fnOf("tonal")))).toContain("background:#E8DEF8");
    expect(circleOf(draw(fnOf("elevated")))).toContain("background:#F7F2FA");
  });

  it("draws 描边 as a real ring on a transparent circle, and 标准 as a plain one", () => {
    const outlined = circleOf(draw(fnOf("outlined")));
    expect(outlined).toContain("background:transparent");
    expect(outlined).toContain("border:1px solid #79747E");
    /* a shadow under a transparent ring reads as a mistake: the flat two go without one */
    expect(outlined).toContain("box-shadow:none");
    const plain = circleOf(draw(fnOf("text")));
    expect(plain).toContain("background:transparent");
    expect(plain).toContain("border:none");
    expect(plain).toContain("box-shadow:none");
    /* while the floating ones keep the shadow the part always had */
    for (const v of ["filled", "tonal", "elevated"] as Variant[]) {
      expect(circleOf(draw(fnOf(v))), v).toContain("box-shadow:0 3px 8px");
    }
    /* only a filled circle draws the solid glyph */
    expect(draw(fnOf("filled"))).toContain('data-fill="1"');
    expect(draw(fnOf("outlined"))).toContain('data-fill="0"');
  });

  it("keeps the badge and the two lines legible in every look", () => {
    for (const v of LOOKS) {
      const out = draw(fnOf(v));
      /* the lines under the circle sit on the page, not on the circle */
      expect(out, v).toContain("color:#1D1B20");
      /* and the badge keeps its own error colours */
      expect(out, v).toContain("background:#B3261E;color:#FFFFFF");
      /* the countdown line is drawn with the same ink as the name */
      const timer = draw({ ...fnOf(v), timer: true } as Item);
      expect(timer, v).toContain("color:#1D1B20");
    }
  });
});

describe("an asset pill's icons in every look it offers", () => {
  const pillOf = (variant: Variant) => ({ ...makeItem("assetPill"), label: "1.6億", variant }) as Item;
  /** the chip: the round mark whole — its size, its corner and the look it wears */
  const chipOf = (out: string) => {
    const i = out.indexOf("width:20px;height:20px");
    return out.slice(i, i + 200);
  };

  it("draws a different chip for every variant", () => {
    const chips = LOOKS.map((v) => chipOf(draw(pillOf(v))));
    expect(new Set(chips).size).toBe(5);
    expect(chipOf(draw(pillOf("filled")))).toContain("background:#6750A4");
    expect(chipOf(draw(pillOf("tonal")))).toContain("background:#E8DEF8");
    expect(chipOf(draw(pillOf("elevated")))).toContain("background:#F7F2FA");
  });

  it("draws 描边 as a ring with no fill, even on a bar that has one of its own", () => {
    const outlined = draw(pillOf("outlined"));
    expect(chipOf(outlined)).toContain("background:transparent");
    expect(chipOf(outlined)).toContain("border:1px solid #79747E");
    /* the bar keeps its own surface, so the ring still reads as a ring */
    expect(outlined).toContain("background:#ECE6F0");
    /* 标准 (文本) is a plain mark: no fill and no ring */
    const plain = chipOf(draw(pillOf("text")));
    expect(plain).toContain("background:transparent");
    expect(plain).toContain("border:none");
    /* only a filled chip draws the solid glyph */
    expect(draw(pillOf("filled"))).toContain('data-fill="1"');
    expect(draw(pillOf("outlined"))).toContain('data-fill="0"');
  });

  it("keeps the chip's geometry whatever it wears, so the box stays the box", () => {
    for (const v of LOOKS) {
      const out = draw(pillOf(v));
      const chip = chipOf(out);
      /* the ring is drawn inside the 20dp chip… */
      expect(chip, v).toContain("width:20px;height:20px");
      expect(chip, v).toContain("box-sizing:border-box");
      /* …so every variant measures the same bar */
      expect(sizeOf(pillOf(v), {}).w, v).toBe(70);
    }
  });
});

/* 作者要求：功能按钮第一行文字可以自定义颜色，第二行（计时）不受影响。 */
describe("a function button's name colour", () => {
  const fnOf = (patch: Partial<Item> = {}) => ({ ...makeItem("fnButton"), label: "イベント", ...patch }) as Item;
  /** the two lines the part draws, in the order it draws them */
  const lines = (out: string) => [...out.matchAll(/place-items:center;font-size:(\d+)px;line-height:1;font-weight:\d+;color:(#[0-9A-F]{6})/g)].map((m) => m[2]);

  it("draws both lines in the colour it always had when nothing is set", () => {
    const drawn = lines(draw(fnOf()));
    expect(drawn).toHaveLength(2);
    expect(drawn[0]).toBe(drawn[1]);
    expect(drawn[0]).toBe("#1D1B20");
  });

  it("draws the name in a role or a colour of the author's own, and leaves the countdown alone", () => {
    const plain = lines(draw(fnOf()));
    const role = lines(draw(fnOf({ textColor: "primary" })));
    const hex = lines(draw(fnOf({ textColor: "#123456" })));
    /* the first line changes… */
    expect(role[0]).not.toBe(plain[0]);
    expect(hex[0]).toBe("#123456");
    expect(hex[0]).not.toBe(role[0]);
    /* …and the countdown is exactly what it was, both times */
    expect(role[1]).toBe(plain[1]);
    expect(hex[1]).toBe(plain[1]);
    expect(hex[1]).toBe("#1D1B20");
  });

  it("keeps the name legible on every variant the part offers", () => {
    for (const v of LOOKS) {
      const linesOf = lines(draw(fnOf({ variant: v })));
      /* the default ink is the page's onSurface on every variant — the circle is not behind the words */
      expect(linesOf[0], v).toBe("#1D1B20");
      expect(linesOf[1], v).toBe("#1D1B20");
      /* and a chosen colour reaches the name whatever the variant is */
      expect(lines(draw(fnOf({ variant: v, textColor: "#123456" })))[0], v).toBe("#123456");
    }
  });
});
