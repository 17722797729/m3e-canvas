import type { ReactElement } from "react";
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

import { JOYSTICK_SIZE, KIND_ORDER, KIND_SPEC, PALETTES, VARIANTS, assetPillTextWidth, assetPillWidth, baseRadii, gridCheckZ, layerOf, makeItem, setGlobalShape, sizeOf, uniformRadii, type Item, type Variant } from "../lib/tokens";
import { BadgeContent, GridCellMarks, M3Static } from "./M3Node";

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
