import { describe, expect, it } from "vitest";

import { magnifyView, revealPadding, revealView, type CanvasView, type ViewBox } from "./view";

/* The Layers panel and the review report both mean "take me to this" when a row is clicked, so
 * the rule for moving the canvas is pinned here: pan, keep the zoom, pull back only when the
 * target cannot be shown at all, and never move for something already in sight. */

const view: CanvasView = { x: 0, y: 0, z: 1 };
const box = (l: number, t: number, w: number, h: number): ViewBox => ({ l, t, r: l + w, b: t + h });
const ask = (b: ViewBox, over: Partial<Parameters<typeof revealView>[0]> = {}) =>
  revealView({ width: 1000, height: 700, view, box: b, pad: revealPadding(false, 24), minZ: 0.1, maxZ: 3, ...over });

describe("revealView", () => {
  it("leaves the canvas alone when the target is already in sight", () => {
    expect(ask(box(100, 100, 200, 100))).toBeNull();
  });

  it("moves for a target the window only partly shows", () => {
    /* the right edge falls outside, so it is worth scrolling — this is the whole complaint */
    expect(ask(box(900, 100, 200, 100))).not.toBeNull();
    expect(ask(box(100, 100, 200, 800))).not.toBeNull();
  });

  it("pans a target into the middle and keeps the zoom the author chose", () => {
    const next = ask(box(2000, 40, 200, 100))!;
    expect(next.z).toBe(1);
    /* the target's centre lands on the window's centre */
    expect(2000 * next.z + next.x + 100 * next.z).toBeCloseTo(500);
    expect(40 * next.z + next.y + 50 * next.z).toBeCloseTo(350);
  });

  it("pulls back only for a target that cannot fit, and no further", () => {
    /* a phone page is taller than the window at 100%: it comes back at just the fitting zoom */
    const page = box(0, 0, 390, 844);
    const next = ask(page)!;
    expect(next.z).toBeLessThan(1);
    expect(next.z).toBeCloseTo((700 - 48) / 844, 3);
    /* a target that does fit keeps the zoom, even a tall one seen from far enough out */
    expect(ask(page, { view: { x: 0, y: 0, z: 0.5 } })!.z).toBe(0.5);
  });

  it("clamps the zoom it works out, and never re-clamps the one the author holds", () => {
    /* too big to show even at the floor zoom: the fit is clamped instead of zooming to nonsense */
    expect(ask(box(0, 0, 100_000, 100_000))!.z).toBe(0.1);
    /* this only ever pans, so a zoom the caller already holds is left exactly as it is */
    expect(ask(box(0, 0, 1, 1), { view: { x: 0, y: 0, z: 0.05 } })!.z).toBe(0.05);
  });

  it("centres inside the band a phone's floating controls leave, not the whole element", () => {
    const next = ask(box(2000, 40, 200, 100), { pad: revealPadding(true, 24), width: 420, height: 900 })!;
    /* vertically the target sits in the middle of 96..900-96 */
    expect(40 * next.z + next.y + 50 * next.z).toBeCloseTo(96 + (900 - 192) / 2);
  });

  it("treats a degenerate box as a point instead of dividing by zero", () => {
    expect(ask(box(2000, 40, 0, 0))).not.toBeNull();
  });
});

describe("revealPadding", () => {
  it("leaves the plain margin on a desktop and room for the controls on a phone", () => {
    expect(revealPadding(false, 24)).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
    expect(revealPadding(true, 24)).toEqual({ top: 96, right: 24, bottom: 96, left: 24 });
  });
});

/* "Edit this one up close": the canvas settles on the part and fills the window with it, so a
 * container whose children are too small to aim at can be worked in. */
describe("magnifying a part", () => {
  const ask = (b: ViewBox, over: Partial<{ width: number; height: number; view: CanvasView; pad: { top: number; right: number; bottom: number; left: number }; minZ: number; maxZ: number }> = {}) =>
    magnifyView({
      width: 1000,
      height: 800,
      view: { x: 0, y: 0, z: 1 },
      box: b,
      pad: { top: 48, right: 48, bottom: 48, left: 48 },
      minZ: 0.25,
      maxZ: 3,
      ...over,
    });

  it("fills the window with a part too small to work in", () => {
    const v = ask(box(100, 100, 100, 50));
    /* 904x704 of usable window around a 100x50 part: the zoom is the height that fits, capped */
    expect(v.z).toBe(3);
    /* and it is centred in the usable window */
    const cx = (100 + 50) * v.z + v.x;
    expect(cx).toBeCloseTo(500, 5);
    const cy = (100 + 25) * v.z + v.y;
    expect(cy).toBeCloseTo(48 + 704 / 2, 5);
  });

  it("pulls back for a part bigger than the window, and never past the limits", () => {
    const wide = ask(box(0, 0, 2000, 100));
    expect(wide.z).toBeCloseTo(904 / 2000, 5);
    const tall = ask(box(0, 0, 10, 4000));
    expect(tall.z).toBe(0.25);
  });
});
