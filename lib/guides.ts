/* Alignment guides: what a part being dragged lines up with, and the lines to draw while it does.
 *
 * Moving something by eye is how a design is made, so the canvas pulls a part into line with the
 * edges and centres of everything else — a neighbour's left edge, the middle of a card, the screen's
 * own margins — and draws a dashed line along the one it took. This module is the arithmetic only:
 * the editor hands it the box being moved and every line the document offers, and gets back the
 * shift to apply and the lines to draw. */

/** a box in canvas coordinates: a part, a container's child, or a screen */
export type AlignRect = { l: number; t: number; r: number; b: number };

/** One line a part can line up with: where it sits, and how far it reaches along the other axis. */
export type AlignLine = { at: number; lo: number; hi: number };

/** The left edge, the middle and the right edge of a box, each reaching the box's full height. */
export const linesX = (r: AlignRect): AlignLine[] => [r.l, (r.l + r.r) / 2, r.r].map((at) => ({ at, lo: r.t, hi: r.b }));

/** The top edge, the middle and the bottom edge, each reaching the box's full width. */
export const linesY = (r: AlignRect): AlignLine[] => [r.t, (r.t + r.b) / 2, r.b].map((at) => ({ at, lo: r.l, hi: r.r }));

/** One line to draw: a vertical one (`axis: "x"`) or a horizontal one, from `from` to `to`. */
export type AlignGuide = { axis: "x" | "y"; at: number; from: number; to: number };

export type AlignResult = {
  /** the shift to take, 0 when nothing lines up */
  dx: number;
  dy: number;
  guides: AlignGuide[];
};

/**
 * The nearest line on each axis, within `tol`. A box lines up by its left edge, its middle or its
 * right edge (and by its top, middle or bottom): whichever pair of a box edge and a line is closest
 * wins, and the guide drawn for it reaches from the moved box to the box that offered the line, so
 * the author can see what it is lining up with.
 */
export function alignTo(moving: AlignRect, lines: { xs: AlignLine[]; ys: AlignLine[] }, tol: number): AlignResult {
  const pick = (axis: "x" | "y") => {
    const offered = axis === "x" ? lines.xs : lines.ys;
    const mine = axis === "x" ? [moving.l, (moving.l + moving.r) / 2, moving.r] : [moving.t, (moving.t + moving.b) / 2, moving.b];
    const lo = axis === "x" ? moving.t : moving.l;
    const hi = axis === "x" ? moving.b : moving.r;
    let best: { at: number; shift: number; from: number; to: number; d: number } | null = null;
    for (const line of offered) {
      for (const m of mine) {
        const d = Math.abs(line.at - m);
        if (d > tol) continue;
        if (best && d >= best.d) continue;
        best = { at: line.at, shift: line.at - m, from: Math.min(line.lo, lo), to: Math.max(line.hi, hi), d };
      }
    }
    return best;
  };
  const bx = pick("x");
  const by = pick("y");
  const guides: AlignGuide[] = [];
  if (bx) guides.push({ axis: "x", at: bx.at, from: bx.from, to: bx.to });
  if (by) guides.push({ axis: "y", at: by.at, from: by.from, to: by.to });
  return { dx: bx?.shift ?? 0, dy: by?.shift ?? 0, guides };
}
