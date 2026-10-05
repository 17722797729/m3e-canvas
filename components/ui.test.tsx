import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

/* ui.tsx pulls in the palette, the icons and Motion for the rest of its controls; the fold button
 * itself needs none of them, so the aliases are pointed at the real modules the way the other
 * component tests do and only the drawing libraries are stubbed. */
vi.mock("@/lib/tokens", () => import("../lib/tokens"));
vi.mock("@/lib/i18n", () => import("../lib/i18n"));
vi.mock("@/lib/color", () => import("../lib/color"));
vi.mock("motion/react", () => ({ AnimatePresence: "presence", motion: { div: "div", button: "button" } }));
vi.mock("./M3Node", () => ({ Icon: "icon" }));

import { renderToStaticMarkup } from "react-dom/server";

import { FOLD_SLOP, FoldButton, TokenChips } from "./ui";
import { FILL_CUSTOM_KINDS, PALETTES } from "../lib/tokens";

/* The fold button sits on top of a navigation part on the canvas. A press on it must not start
 * moving the part — a click on a rail's chevron used to leave the rail being dragged — while a
 * press that travels has to become exactly that drag, or a folded bar (which is nothing but its
 * own button) could not be moved at all. The element is called as a plain function: no DOM, no
 * renderer. */
describe("the fold button of a navigation part", () => {
  const fold = (onFold: () => void, onDrag?: (e: unknown) => void) =>
    (FoldButton({ title: "Fold", at: { right: 0 }, onFold, onDrag }) as ReactElement<Record<string, unknown>>).props as unknown as {
      type: string;
      onPointerDown: (e: unknown) => void;
      onPointerMove: (e: unknown) => void;
      onPointerUp: (e: unknown) => void;
      onPointerCancel: (e: unknown) => void;
    };
  /** the node a pointer event is delivered with: it holds the dataset the button works through */
  const node = () => ({
    dataset: {} as Record<string, string>,
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  });

  it("folds on a press that stays put, and keeps the press away from the part", () => {
    const onFold = vi.fn();
    const props = fold(onFold);
    expect(props.type).toBe("button");
    const el = node();
    const stopPropagation = vi.fn();
    props.onPointerDown({ currentTarget: el, clientX: 100, clientY: 50, pointerId: 1, stopPropagation });
    expect(el.dataset.armed).toBe("100,50");
    /* the part underneath never hears the press, so it cannot start moving */
    expect(stopPropagation).toHaveBeenCalled();
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
    /* a little jitter is still a click */
    props.onPointerMove({ currentTarget: el, clientX: 101, clientY: 51 });
    props.onPointerUp({ currentTarget: el });
    expect(onFold).toHaveBeenCalledTimes(1);
    /* one press, one fold */
    props.onPointerUp({ currentTarget: el });
    expect(onFold).toHaveBeenCalledTimes(1);
  });

  it("hands a press that travels over to the part as a drag, and folds nothing", () => {
    const onFold = vi.fn();
    const onDrag = vi.fn();
    const props = fold(onFold, onDrag);
    const el = node();
    props.onPointerDown({ currentTarget: el, clientX: 100, clientY: 50, pointerId: 7, stopPropagation: vi.fn() });
    props.onPointerMove({ currentTarget: el, clientX: 100 + FOLD_SLOP + 1, clientY: 50, pointerId: 7 });
    expect(onDrag).toHaveBeenCalledTimes(1);
    /* the pointer goes back to the page, so the drag's own listeners carry the gesture on */
    expect(el.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(el.dataset.armed).toBeUndefined();
    /* the drag took the gesture: letting go is not a fold */
    props.onPointerMove({ currentTarget: el, clientX: 140, clientY: 90 });
    props.onPointerUp({ currentTarget: el });
    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(onFold).not.toHaveBeenCalled();
  });

  it("folds nothing when the release does not belong to a press on it", () => {
    const onFold = vi.fn();
    const props = fold(onFold);
    /* a part dragged across the button and let go: no press ever armed this node */
    props.onPointerUp({ currentTarget: node() });
    expect(onFold).not.toHaveBeenCalled();
    /* and a press that is cancelled folds nothing either */
    const el = node();
    props.onPointerDown({ currentTarget: el, clientX: 10, clientY: 10, pointerId: 2, stopPropagation: vi.fn() });
    props.onPointerCancel({ currentTarget: el });
    props.onPointerUp({ currentTarget: el });
    expect(onFold).not.toHaveBeenCalled();
  });
});

/* A fill row is one run of colour chips. The free colour disc belongs at the end of that run — on the
 * same line as the roles — rather than on a block of its own that starts a second line. */
describe("the fill row's free colour disc", () => {
  const row = (custom?: (c: string) => void) =>
    renderToStaticMarkup(<TokenChips value="surfaceContainerLow" onChange={() => {}} p={PALETTES[0]} custom={custom} />);

  it("ends the run of chips when it is offered", () => {
    const out = row(() => {});
    /* one row, and the disc is the last thing inside it: nothing is left to start another line */
    expect(out.startsWith('<div style="display:flex;flex-wrap:wrap;gap:8px">')).toBe(true);
    expect(out.endsWith("</label></div>")).toBe(true);
    expect(out.match(/type="color"/g)?.length).toBe(1);
  });

  it("is not there at all for a row that does not offer it", () => {
    const out = row();
    expect(out).not.toContain('type="color"');
    expect(out).not.toContain("<label");
  });

  it("is offered by the kinds whose surface is the part's whole look", () => {
    expect(FILL_CUSTOM_KINDS).toEqual(["itemCell", "assetPill"]);
  });
});
