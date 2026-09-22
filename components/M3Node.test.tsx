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

import { PALETTES, gridCheckZ, layerOf, makeItem, type Item } from "../lib/tokens";
import { BadgeContent, GridCellMarks } from "./M3Node";

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
