/* Where the canvas should look to show a rectangle. The editor's Layers panel, its review
 * report and anything else that means "take me to this" all go through here, so the rule is
 * written down once: pan to the target, keep the zoom, and only pull back when the target
 * could not be shown at all. Nothing here reads the DOM, so it is checked directly. */

export type CanvasView = { x: number; y: number; z: number };
/** the world rectangle to show */
export type ViewBox = { l: number; t: number; r: number; b: number };
/** how much air to leave at each edge of the window: a floating toolbar on a phone takes more
 *  room at the top and bottom than the plain margin does */
export type ViewPadding = { top: number; right: number; bottom: number; left: number };

export type RevealInput = {
  /** the canvas element's size on screen */
  width: number;
  height: number;
  view: CanvasView;
  box: ViewBox;
  pad: ViewPadding;
  minZ: number;
  maxZ: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The view that shows `box`, or null when the canvas should be left exactly as it is. A target
 * already inside the padded window is left alone on purpose: recentring on every click throws
 * the view around while the author works through a list, and a target they can already see does
 * not need moving.
 */
export function revealView({ width, height, view, box, pad, minZ, maxZ }: RevealInput): CanvasView | null {
  const usableW = Math.max(1, width - pad.left - pad.right);
  const usableH = Math.max(1, height - pad.top - pad.bottom);
  const w = Math.max(1, box.r - box.l);
  const h = Math.max(1, box.b - box.t);

  /* where the target's edges fall on screen right now */
  const l = box.l * view.z + view.x;
  const t = box.t * view.z + view.y;
  const r = box.r * view.z + view.x;
  const b = box.b * view.z + view.y;
  if (l >= pad.left && t >= pad.top && r <= width - pad.right && b <= height - pad.bottom) return null;

  /* the zoom is the author's: it only changes when the target does not fit through the window */
  const fits = w * view.z <= usableW && h * view.z <= usableH;
  const z = fits ? view.z : clamp(Math.min(usableW / w, usableH / h), minZ, maxZ);
  return {
    x: (width - w * z) / 2 - box.l * z,
    y: pad.top + (usableH - h * z) / 2 - box.t * z,
    z,
  };
}

/**
 * The view that fills the window with one part, so a container too small to work in can be edited
 * up close. Unlike `revealView`, which keeps the author's zoom and only pulls back when the target
 * could not be shown, this one always settles on the part: as large as it and the window allow,
 * never past the zoom limits. The caller keeps the view it had, to go back to.
 */
export function magnifyView({ width, height, view, box, pad, minZ, maxZ }: RevealInput): CanvasView {
  const usableW = Math.max(1, width - pad.left - pad.right);
  const usableH = Math.max(1, height - pad.top - pad.bottom);
  const w = Math.max(1, box.r - box.l);
  const h = Math.max(1, box.b - box.t);
  const z = clamp(Math.min(usableW / w, usableH / h), minZ, maxZ);
  /* a part wider than the window is centred in it rather than pushed off one edge */
  return {
    x: pad.left + (usableW - w * z) / 2 - box.l * z,
    y: pad.top + (usableH - h * z) / 2 - box.t * z,
    z,
  };
}

/** the padding a phone's floating toolbar and control bar leave: the plain margin on a desktop */
export const revealPadding = (mobile: boolean, margin: number): ViewPadding =>
  mobile ? { top: 96, right: margin, bottom: 96, left: margin } : { top: margin, right: margin, bottom: margin, left: margin };
