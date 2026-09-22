import { describe, expect, it } from "vitest";

import { alignTo, linesX, linesY, type AlignLine } from "./guides";

/* The guides are the arithmetic behind "it lines up with that": the canvas gathers what the
 * document offers, this decides what the drag takes and which line to draw for it. */

const box = (l: number, t: number, w: number, h: number) => ({ l, t, r: l + w, b: t + h });
const offered = (rects: ReturnType<typeof box>[]) => ({ xs: rects.flatMap(linesX), ys: rects.flatMap(linesY) });
/** the lines a screen offers, margins included, exactly as the editor gathers them */
const screen = (l: number, t: number, w: number, h: number, margin: number) => {
  const r = box(l, t, w, h);
  const xs: AlignLine[] = [l, l + margin, l + w / 2, l + w - margin, l + w].map((at) => ({ at, lo: r.t, hi: r.b }));
  const ys: AlignLine[] = [t, t + margin, t + h / 2, t + h - margin, t + h].map((at) => ({ at, lo: r.l, hi: r.r }));
  return { xs, ys };
};

describe("aligning a dragged part", () => {
  it("takes the nearest edge or centre within reach, and nothing when nothing is close", () => {
    const lines = offered([box(100, 100, 40, 40)]);
    /* the left edges nearly meet: the drag takes the last few pixels */
    expect(alignTo(box(103, 300, 40, 40), lines, 6)).toMatchObject({ dx: -3, dy: 0 });
    /* a right edge can be the one that lines up */
    expect(alignTo(box(117, 300, 40, 40), lines, 6).dx).toBe(3);
    /* far away, the part stays exactly where the pointer put it */
    expect(alignTo(box(200, 300, 40, 40), lines, 6)).toMatchObject({ dx: 0, dy: 0, guides: [] });
  });

  it("lines up on both axes at once, and says how far each line reaches", () => {
    const { dx, dy, guides } = alignTo(box(103, 138, 40, 40), offered([box(100, 100, 40, 40)]), 6);
    expect([dx, dy]).toEqual([-3, 2]);
    expect(guides).toHaveLength(2);
    /* the vertical line reaches from the moved part to the neighbour it lined up with */
    expect(guides.find((g) => g.axis === "x")).toEqual({ axis: "x", at: 100, from: 100, to: 178 });
    expect(guides.find((g) => g.axis === "y")).toEqual({ axis: "y", at: 140, from: 100, to: 143 });
  });

  it("keeps the closest of several candidates on one axis", () => {
    /* two neighbours whose left edges sit either side of the moving part's */
    const lines = offered([box(100, 0, 40, 40), box(106, 200, 40, 40)]);
    expect(alignTo(box(104, 400, 40, 40), lines, 8).dx).toBe(2);
  });

  it("offers the screen's margins and middle like any other line", () => {
    const lines = screen(0, 0, 412, 892, 16);
    /* a part dropped near the left margin is pulled onto it */
    expect(alignTo(box(19, 300, 40, 40), lines, 6).dx).toBe(-3);
    /* and one near the middle of the screen is centred */
    const centred = alignTo(box(180, 300, 40, 40), lines, 6);
    expect(centred.dx).toBe(6);
    expect(centred.guides[0]).toMatchObject({ axis: "x", at: 206, from: 0, to: 892 });
  });

  it("reads a line's reach as the union of the two boxes, so the guide spans both", () => {
    const { guides } = alignTo(box(100, 300, 40, 40), offered([box(100, 100, 40, 40)]), 6);
    expect(guides[0]).toEqual({ axis: "x", at: 100, from: 100, to: 340 });
  });
});
