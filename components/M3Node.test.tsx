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

import { PALETTES, makeItem } from "../lib/tokens";
import { BadgeContent } from "./M3Node";

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
