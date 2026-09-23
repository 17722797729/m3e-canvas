import { afterEach, describe, expect, it } from "vitest";

import { contrastRatio } from "./color";
import { itemNameOf } from "./flow";
import { getLang, KIND_TEXT } from "./i18n";

import { CELL_DEF, CELL_MAX, CELL_MIN, COLS_MAX, ROWS_MAX, cellGap, cellOf, scrollContent, slotGrid, gridCells, cellBox, gridCheckZ, rulePatch, ruleFieldsFor, readoutOf, hasReadout, unitOf, mixText, readText, VALUE_TOKEN, hasValueToken, valueAfter, maxOf, clampMax, MAX_DEF, MAX_MAX, isValueOp, withGridCells, BAR_FOLDED_H, BAR_FOLDED_W, BUTTON_SHAPES, NAV_BAR_H, PHONE_H, PHONE_W, DEFAULT_THEME, H, KIND_SPEC, LAYER_DEFAULT, RAIL_COLLAPSED_W, RAIL_EXPANDED_W, RAIL_HEADER_GAP, RAIL_HEADER_H, isWideRail, navCell, navLabelInk, navRows, railCell, SHAPED, PALETTES, R_FULL, baseRadii, byLayer, carryItemSize, colorOverrideOf, connectSpecOf, connectable, compositeInstance, copySubtree, foldsToPill, childShown, connectedButton, DIALOG_COLOR, childDrawn, badgeSurface, buttonScale, findItemIn, foldMargins, radiiOfRuns, roundByNature, runPartRadii, ROUND_SHAPES, foldPlace, foldShift, layoutOf, NO_FOLD, fitTabPanels, keepPanelSlots, liftAbove, isStateEffect, STATE_EFFECTS, START_LOOK, firstTapStep, firstDueStep, waitLeft, lookItem, lookAt, statesAsFlow, migrateFlows, hasTimedSteps, fillColor, fillInk, TRANSPARENT, cardFillOf, type PartFlow, type PartLook, type PartStep, type MachineAt, NAV_ICON, NAV_INDICATOR, NAV_INDICATOR_R, NAV_LABEL_FONT, selectedAncestor, takesText, panelSlotFor, refillPanels, restorePanel, slotsOf, resizedChildren, needsTabPanels, tabIndexOf, tabPanelId, tabRenamePatch, tabPanelsPatch, tabStyleOf, TAB_PANEL_H, TAB_ROW_H, onToken, pageTintOf, PROGRESS_DEFAULT, progressValue, progressTrack, CONTENT_W, actionPatchFor, scrollOffset, scrollRange, childDragFree, childDragRoom, pruneParts, paletteOf, fitHeight, iconSlotsOf, isCustomColor, itemsOf, layerOf, makeItem, normalizeTheme, paletteForItem, parentOf, railLayoutWidth, railMetrics, resolveStates, runCorners, scaleChildren, scaleR, setGlobalShape, sizeOf, strokeOf, subtreeOf, tappable, isScrollableTabs, tabScrollOffset, removeTabPatch, tabCountPatch, SCROLL_TAB_W, uniformRadii, type CustomPart, type Group, type Item, type Kind, type ItemState, type PlacedItem, type Frame } from "./tokens";

afterEach(() => setGlobalShape("rounded")); // restore the module default

describe("a navigation part's own fold button", () => {
  /* Both kinds are drawn with a fold button out of the box: the bar keeps a strip for it at its
   * trailing edge, and the rail is the expressive one, whose header *is* that button. Only a
   * document written before this existed has none — for a bar that is `undefined`, which is why
   * the flag is a boolean and not a presence check. */
  it("comes with a bar and a rail, unfolded", () => {
    const bar = makeItem("bottomNav");
    expect(bar.barFolded).toBe(false);
    expect(foldsToPill(bar)).toBe(false);
    /* shown or not, the bar itself is the same bar */
    const bare = { ...bar, barFolded: undefined };
    expect(sizeOf(bare, {})).toEqual(sizeOf(bar, {}));
    /* the rail lands as the expressive one: its header carries the button */
    const rail = makeItem("navRail");
    expect(isWideRail(rail)).toBe(true);
    expect(rail.railFolded).toBeUndefined();
    /* and its destinations start under that header */
    expect(railCell(rail, 3, 0).top).toBeGreaterThan(railMetrics(rail).headerTop + RAIL_HEADER_H - 1);
  });

  it("folds a copy of either into its own pill", () => {
    expect(sizeOf({ ...makeItem("bottomNav"), barFolded: true }, {})).toEqual({ w: BAR_FOLDED_W, h: BAR_FOLDED_H });
    expect(sizeOf({ ...makeItem("navRail"), railFolded: true }, {})).toEqual({ w: BAR_FOLDED_W, h: BAR_FOLDED_H });
  });

  it("folds to the corner its button sits in, so the button does not move", () => {
    /* A bar's button is at its trailing end: folded, the pill keeps that end (and its bottom edge,
     * which is where a bar sits on a screen) instead of flying across to the other side. */
    const bar: Group = { id: "g", x: 100, y: 700, axis: "x", items: [{ ...makeItem("bottomNav"), size: 390 }] };
    const open = layoutOf(bar, {})[0];
    const pill = layoutOf({ ...bar, items: [{ ...bar.items[0], barFolded: true }] }, {})[0];
    expect(open).toMatchObject({ x: 100, y: 700, w: 390 });
    expect(pill).toMatchObject({ w: BAR_FOLDED_W, h: BAR_FOLDED_H });
    /* the bar shrinks to the right: its trailing edge stays, and so does the height the button
       spans — the button itself is left exactly where it was */
    expect(pill.x + pill.w).toBe(open.x + open.w);
    expect(pill.y + pill.h / 2).toBe(open.y + open.h / 2);
    /* the same holds for the bar's button inside a container */
    expect(foldPlace({ ...bar.items[0], barFolded: true }, {}).dx).toBe(334);
    expect(foldPlace({ ...bar.items[0], barFolded: false }, {})).toEqual(NO_FOLD);
    /* a rail's button is its header: folded, the header keeps the very place it had */
    const rail: Group = { id: "r", x: 0, y: 0, axis: "x", items: [{ ...makeItem("navRail"), railExpanded: false }] };
    const railOpen = layoutOf(rail, {})[0];
    const railPill = layoutOf({ ...rail, items: [{ ...rail.items[0], railFolded: true }] }, {})[0];
    const headOpen = railMetrics({ ...rail.items[0], railFolded: false });
    const headPill = railMetrics({ ...rail.items[0], railFolded: true });
    expect(railPill.x + headPill.headerLeft).toBe(railOpen.x + headOpen.headerLeft);
    expect(railPill.y + headPill.headerTop).toBe(railOpen.y + headOpen.headerTop);
    /* and the shift is read off the flag, so opening again lands exactly where it was */
    expect(layoutOf({ ...bar, items: [{ ...bar.items[0], barFolded: false }] }, {})[0].x).toBe(open.x);
    expect(foldShift({ ...makeItem("button") }, {})).toEqual(NO_FOLD);
    /* a run lays its parts out itself, so the same place is handed to it as margins */
    expect(foldMargins({ ...bar.items[0], barFolded: true }, {})).toEqual({ marginLeft: open.w - BAR_FOLDED_W, marginTop: (open.h - BAR_FOLDED_H) / 2 });
    expect(foldMargins({ ...bar.items[0], barFolded: false }, {})).toEqual({});
  });
});

describe("navigation rail geometry", () => {
  it("keeps old rails unchanged and creates expressive collapsed rails", () => {
    const fresh = makeItem("navRail");
    expect(fresh.railExpanded).toBe(false);
    expect(sizeOf(fresh, {}).w).toBe(96);
    const legacy = { ...fresh, railExpanded: undefined };
    expect(sizeOf(legacy, {}).w).toBe(80);
    expect(railMetrics(legacy)).toMatchObject({ top: 44, itemHeight: 52, gap: 12 });
  });

  it("shares drawing and hit-area geometry and keeps modal layout collapsed", () => {
    const expanded = { ...makeItem("navRail"), railExpanded: true };
    /* the fold button heads the rail 4dp from its top, and the destinations follow right after it */
    expect(railMetrics(expanded)).toMatchObject({ width: 220, headerLeft: 16, headerTop: 4, inset: 12, top: 4 + RAIL_HEADER_H + RAIL_HEADER_GAP, itemHeight: 56, gap: 0 });
    expect(RAIL_HEADER_GAP).toBeLessThanOrEqual(4);
    expect(railLayoutWidth(expanded)).toBe(220);
    /* folded, the header is the pill's own button, tucked into its corner — and it does not move */
    const folded = { ...expanded, railFolded: true };
    expect(railMetrics(folded)).toMatchObject({ headerLeft: 4, headerTop: 4 });
    expect(railCell({ ...folded, tabs: [{ icon: "", label: "A" }] }, 1, 0).top).toBe(56);
    const modal = { ...expanded, railModal: true };
    expect(sizeOf(modal, {}).w).toBe(220);
    expect(railLayoutWidth(modal)).toBe(96);
    expect(baseRadii(modal)).toEqual({ tl: 16, tr: 16, bl: 16, br: 16 });
    expect(baseRadii({ ...modal, radiusTop: 0 }).tl).toBe(0);
  });

  it("starts a wide rail's next line one rail-width across, in a box wide enough for both", () => {
    const rail = { ...makeItem("navRail"), railExpanded: true, navPerRow: 2, tabs: Array.from({ length: 4 }, (_, i) => ({ icon: "", label: `T${i}` })) };
    const first = railCell(rail, 4, 0);
    const second = railCell(rail, 4, 1);
    const third = railCell(rail, 4, 2);
    /* the second destination sits under the first, the third beside it: columns, not one long list */
    expect(second.left).toBe(first.left);
    expect(second.top).toBeGreaterThan(first.top);
    expect(third.top).toBe(first.top);
    expect(third.left).toBe(first.left + railMetrics(rail).width);
    /* and the rail is as wide as the columns it holds, so the last one fits inside it */
    expect(sizeOf(rail, {}).w).toBe(railMetrics(rail).width * 2);
    expect(third.left + third.width).toBeLessThanOrEqual(sizeOf(rail, {}).w);
  });

  it("packs the 80dp rail's columns into a centred row", () => {
    const rail = { ...makeItem("navRail"), railExpanded: undefined, navPerRow: 2, tabs: Array.from({ length: 4 }, (_, i) => ({ icon: "", label: `T${i}` })) };
    const box = sizeOf(rail, {}).w;
    const first = railCell(rail, 4, 0);
    const third = railCell(rail, 4, 2);
    expect(box).toBe(160);
    /* two columns of 68dp with a 12dp gap, centred in the 160dp box */
    expect(first.left).toBe(6);
    expect(third.left).toBe(first.left + 68 + 12);
    expect(box - (third.left + third.width)).toBe(first.left);
    expect(third.top).toBe(first.top);
  });

  it("fits its destinations into the height the author gave it", () => {
    const rail = (size2: number, count = 5): Item => ({
      ...makeItem("navRail"),
      railExpanded: false,
      size2,
      navPerRow: count,
      tabs: Array.from({ length: count }, (_, i) => ({ icon: "", label: `T${i}` })),
    });
    /* a rail with room to spare keeps M3's own pitch */
    const roomy = railMetrics(rail(PHONE_H));
    expect(roomy.pitch).toBe(roomy.itemHeight + roomy.gap);
    expect(roomy.cellHeight).toBe(roomy.itemHeight);
    /* one too short for its column squeezes the cells, and the last still ends inside the rail */
    const short = rail(220);
    const squeezed = railMetrics(short);
    expect(squeezed.pitch).toBeLessThan(roomy.pitch);
    expect(squeezed.cellHeight).toBeLessThan(roomy.itemHeight);
    const last = railCell(short, 5, 4);
    expect(last.top + last.height).toBeLessThanOrEqual(220);
    /* and the destinations begin right under the header, not far below it */
    expect(railCell(short, 5, 0).top).toBe(squeezed.top);
    expect(squeezed.top).toBeLessThanOrEqual(64);
  });

  it("aligns the menu and destination icon centers in both expressive states", () => {
    const collapsed = railMetrics(makeItem("navRail"));
    expect(collapsed.headerLeft + 24).toBe(collapsed.width / 2);
    const expanded = railMetrics({ ...makeItem("navRail"), railExpanded: true });
    expect(expanded.headerLeft + 24).toBe(expanded.inset + 16 + 12);
  });
});

describe("setGlobalShape / scaleR", () => {
  it("shrinks radii for the square scale and grows them for full", () => {
    setGlobalShape("square");
    expect(scaleR(R_FULL)).toBe(Math.round(R_FULL * 0.35));
    setGlobalShape("full");
    expect(scaleR(R_FULL)).toBe(Math.round(R_FULL * 1.6));
    setGlobalShape("rounded");
    expect(scaleR(R_FULL)).toBe(R_FULL);
  });

  it("flows into a part's default corners", () => {
    setGlobalShape("rounded");
    const rounded = baseRadii(makeItem("button")).tl;
    setGlobalShape("square");
    expect(baseRadii(makeItem("button")).tl).toBeLessThan(rounded);
    setGlobalShape("full");
    expect(baseRadii(makeItem("button")).tl).toBeGreaterThan(rounded);
  });

  it("keeps a radius the author typed in, whatever the scale", () => {
    const card = { ...makeItem("card"), radiusTop: 12 };
    setGlobalShape("full");
    expect(baseRadii(card)).toEqual({ tl: 12, tr: 12, bl: 12, br: 12 });
  });
});

describe("runCorners", () => {
  const outer = 28;
  const inner = 8;

  it("puts the outer corners at the ends of a horizontal run, inner between parts", () => {
    expect(runCorners("x", true, false, outer, inner)).toEqual({ tl: outer, bl: outer, tr: inner, br: inner });
    expect(runCorners("x", false, true, outer, inner)).toEqual({ tl: inner, bl: inner, tr: outer, br: outer });
  });

  it("puts the outer corners at the ends of a vertical run, inner between parts", () => {
    expect(runCorners("y", true, false, outer, inner)).toEqual({ tl: outer, tr: outer, bl: inner, br: inner });
    expect(runCorners("y", false, true, outer, inner)).toEqual({ tl: inner, tr: inner, bl: outer, br: outer });
  });

  it("rounds a lone part all over and a middle part nowhere", () => {
    expect(runCorners("x", true, true, outer, inner)).toEqual({ tl: outer, tr: outer, bl: outer, br: outer });
    expect(runCorners("y", false, false, outer, inner)).toEqual({ tl: inner, tr: inner, bl: inner, br: inner });
  });

  it("keeps the buttons of a connected group flush against each other", () => {
    /* a row of tab buttons reads as one control: no gap anywhere, only the ends rounded off */
    const group = [0, 1, 2].map((i) => connectedButton(i, 3, outer, inner));
    expect(group.map((b) => b.margin)).toEqual([0, -1, -1]);
    expect(group[0].radii).toEqual({ tl: outer, bl: outer, tr: inner, br: inner });
    expect(group[1].radii).toEqual({ tl: inner, bl: inner, tr: inner, br: inner });
    expect(group[2].radii).toEqual({ tl: inner, bl: inner, tr: outer, br: outer });
    /* one button on its own is rounded all over, like any lone part */
    expect(connectedButton(0, 1, outer, inner)).toEqual({ margin: 0, radii: { tl: outer, tr: outer, bl: outer, br: outer } });
  });
});

describe("a navigation's destinations across lines", () => {
  /* A bar wraps onto further lines and a rail onto further columns, and a tap has to land on the
   * destination it looks like it hits: the drawing and the hit areas are both read from navCell and
   * railCell, so a second line is a second line for both. */
  it("gives every destination its own line and place in it", () => {
    expect(navCell(6, 3, 0)).toMatchObject({ perLine: 3, lines: 2, line: 0, at: 0, inLine: 3 });
    expect(navCell(6, 3, 3)).toMatchObject({ perLine: 3, lines: 2, line: 1, at: 0, inLine: 3 });
    expect(navCell(6, 3, 5)).toMatchObject({ line: 1, at: 2 });
    /* a short last line is the only one that does not fill up: the bar packs it to the trailing edge */
    expect(navCell(5, 3, 4)).toMatchObject({ perLine: 3, lines: 2, line: 1, at: 1, inLine: 2 });
    /* more room per line than there are destinations is still one line */
    expect(navCell(3, 9, 2)).toMatchObject({ perLine: 3, lines: 1, line: 0, at: 2, inLine: 3 });
    /* no limit set: every destination shares the one line */
    expect(navCell(4, undefined, 3)).toMatchObject({ perLine: 4, lines: 1, at: 3 });
    expect(navCell(0, 3, 0)).toMatchObject({ lines: 1, line: 0 });
    expect(navRows(5, 3)).toBe(2);
  });
});

describe("the ink a navigation destination's label reads in", () => {
  /* The label sits on the rail's or the bar's own background, not on the indicator pill: the pill's
   * ink belongs to the icon inside it. Reading the label in the pill's ink painted white words on a
   * white rail under a scheme whose pill is dark, which is how this was reported. */
  it("reads on the part's own background, and leaves the pill's ink to the icon", () => {
    expect(navLabelInk(true)).toBe("onSurface");
    expect(navLabelInk(false)).toBe("onSurfaceVariant");
    for (const p of PALETTES) {
      /* a rail and a bar are both painted surfaceContainer (see boxStyle) */
      expect(contrastRatio(p[navLabelInk(true)], p.surfaceContainer)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p[navLabelInk(false)], p.surfaceContainer)).toBeGreaterThanOrEqual(3);
      /* while the icon inside the pill reads on the pill */
      expect(contrastRatio(p.onSecondaryContainer, p.secondaryContainer)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("normalizeTheme", () => {
  it("returns the defaults untouched for undefined or empty input", () => {
    expect(normalizeTheme(undefined)).toEqual(DEFAULT_THEME);
    expect(normalizeTheme({})).toEqual(DEFAULT_THEME);
  });

  it("keeps the valid fields of a partial theme and fills in the rest", () => {
    expect(normalizeTheme({ dark: true, shape: "full" })).toEqual({ ...DEFAULT_THEME, dark: true, shape: "full" });
  });

  it("replaces unknown option values with the default", () => {
    const t = normalizeTheme({ contrast: "blaring" as never, font: "papyrus" as never, shape: "pointy" as never });
    expect(t.contrast).toBe(DEFAULT_THEME.contrast);
    expect(t.font).toBe(DEFAULT_THEME.font);
    expect(t.shape).toBe(DEFAULT_THEME.shape);
  });
});

describe("scrollable tab rows", () => {
  const row = (n: number, selected?: number): Item => ({ ...makeItem("tabs"), tabs: Array.from({ length: n }, (_, i) => ({ label: `T${i + 1}`, icon: "" })), selected });

  it("keeps up to five tabs fixed and lets six or more scroll when they do not fit", () => {
    expect(isScrollableTabs(row(5))).toBe(false);
    expect(isScrollableTabs(row(6))).toBe(true);
    expect(isScrollableTabs({ ...row(6), size: 1280 })).toBe(false);
    expect(isScrollableTabs({ ...makeItem("bottomNav"), tabs: row(6).tabs })).toBe(false);
    expect(tabScrollOffset(row(5, 4), 412)).toBe(0);
    expect(tabScrollOffset(row(0), 412)).toBe(0);
    expect(tabScrollOffset(row(7), 412)).toBe(0);
    expect(tabScrollOffset(row(7, 99), 412)).toBe(7 * SCROLL_TAB_W - 412);
  });

  it("keeps the selection and the per-tab tap targets on their tabs when one is removed", () => {
    const go = (to: string) => ({ to, transition: "slide" as const });
    const it7 = { ...row(7, 3), actions: { "tab:1": go("a"), "tab:3": go("b"), "tab:6": go("c") } };
    expect(removeTabPatch(it7, 1)).toEqual({ tabs: it7.tabs!.filter((_, j) => j !== 1), selected: 2, actions: { "tab:2": go("b"), "tab:5": go("c") } });
    expect(removeTabPatch(it7, 3).selected).toBe(3);
    expect(removeTabPatch(it7, 3).actions).toEqual({ "tab:1": go("a"), "tab:5": go("c") });
    expect(removeTabPatch(row(2, 1), 1).selected).toBe(0);
    expect(removeTabPatch({ ...makeItem("select"), tabs: row(3).tabs, selected: 1 }, 1).selected).toBeUndefined();
    expect(tabCountPatch(it7, 4, [{ label: "x", icon: "" }])).toMatchObject({ selected: 3, actions: { "tab:1": go("a"), "tab:3": go("b") } });
    expect(tabCountPatch(it7, 4, [{ label: "x", icon: "" }]).tabs).toHaveLength(4);
  });

  it("shifts the row only as far as the selected tab needs, never past the end", () => {
    expect(tabScrollOffset(row(7, 0), 412)).toBe(0);
    expect(tabScrollOffset(row(7, 4), 412)).toBe(5.5 * SCROLL_TAB_W - 412);
    expect(tabScrollOffset(row(7, 6), 412)).toBe(7 * SCROLL_TAB_W - 412);
    expect(tabScrollOffset(row(7, 6), 1280)).toBe(0);
  });
});

describe("finding a part by id", () => {
  /* The editor looks a part up in the whole tree — which screen a nested child belongs to, say —
   * so a lookup that only walked the top level of each group would pick the wrong screen. */
  it("reaches a part inside a container or a panel, however deep it sits", () => {
    const deep = { ...makeItem("button"), id: "deep" } as PlacedItem;
    const inner = { ...makeItem("box"), id: "inner", children: [deep] } as PlacedItem;
    const panel = { ...makeItem("box"), id: "panel", children: [inner] } as PlacedItem;
    const row = { ...makeItem("tabs"), id: "row", children: [panel] };
    const top = { ...makeItem("button"), id: "top" };
    expect(findItemIn([top, row], "deep")).toBe(deep);
    expect(findItemIn([top, row], "inner")).toBe(inner);
    expect(findItemIn([top, row], "top")).toBe(top);
    expect(findItemIn([top, row], "missing")).toBeNull();
  });
});

describe("a box", () => {
  /* The box is a container and nothing else: the drag handle it used to draw came with a
   * 状態 toggle, which an author who only wanted a background could switch on by mistake. */
  it("is a plain container with no checked state of its own", () => {
    expect(KIND_SPEC.box.hasChecked).toBeFalsy();
    expect(makeItem("box").checked).toBeUndefined();
    /* a document saved while boxes still carried a handle reads as a plain box */
    const legacy: Item = { ...makeItem("box"), checked: true };
    expect(sizeOf(legacy, {}).h).toBe(KIND_SPEC.box.h);
  });
});

/* a document can carry a part this build has no spec for; geometry falling back to the
 * box keeps the editor drawing instead of failing on the first layout pass */
describe("folding the navigation", () => {
  it("shrinks a folded bar to its own arrow and a collapsed rail to its icons", () => {
    const bar = { ...makeItem("bottomNav"), size: PHONE_W };
    expect(sizeOf(bar, {}).w).toBe(PHONE_W);
    expect(sizeOf(bar, {}).h).toBe(KIND_SPEC.bottomNav.h);
    const folded = { ...bar, barFolded: true };
    expect(sizeOf(folded, {})).toEqual({ w: BAR_FOLDED_W, h: BAR_FOLDED_H });
    /* the author's own height is kept while the bar is open */
    expect(sizeOf({ ...bar, size2: 120 }, {}).h).toBe(120);
    /* a rail's width follows its expansion and whatever width the author set */
    const rail = makeItem("navRail");
    expect(sizeOf({ ...rail, railExpanded: true }, {}).w).toBe(RAIL_EXPANDED_W);
    expect(sizeOf(rail, {}).w).toBe(RAIL_COLLAPSED_W);
    expect(sizeOf({ ...rail, railExpanded: true, size: 140 }, {}).w).toBe(140);
    /* and folded, the rail is the same small pill the navigation bar becomes */
    expect(sizeOf({ ...rail, railFolded: true }, {})).toEqual({ w: BAR_FOLDED_W, h: BAR_FOLDED_H });
  });
});

describe("a button's shape", () => {
  it("is a pill by default, a circle when asked and a small square otherwise", () => {
    const fresh = { ...makeItem("button"), size: 120 };
    expect(baseRadii(fresh)).toEqual(uniformRadii(scaleR(KIND_SPEC.button.radius)));
    expect(baseRadii({ ...fresh, shape: "round" })).toEqual(uniformRadii(H / 2));
    expect(baseRadii({ ...fresh, shape: "square" })).toEqual(uniformRadii(scaleR(8)));
    /* a FAB is round already, and keeps a true circle whatever the shape scale says */
    setGlobalShape("square");
    expect(baseRadii({ ...makeItem("fab"), shape: "round" }).tl).toBe(28);
    setGlobalShape("rounded");
    expect(baseRadii({ ...makeItem("iconButton"), shape: "square" }).tl).toBe(8);
    /* an icon button is a circle whatever the document's shape scale says, the way a round FAB is;
       a square it was asked for is the document's square, so it still follows the shape scale */
    setGlobalShape("square");
    expect(baseRadii({ ...makeItem("iconButton"), shape: "round" }).tl).toBe(24);
    expect(baseRadii({ ...makeItem("iconButton"), shape: undefined }).tl).toBe(24);
    expect(baseRadii({ ...makeItem("iconButton"), shape: "square" }).tl).toBe(scaleR(8));
    setGlobalShape("rounded");
    /* and a round button is a pill at the height its author gave it, not at M3's medium one */
    expect(baseRadii({ ...makeItem("button"), shape: "round", size2: 40 }).tl).toBe(20);
    expect(baseRadii({ ...makeItem("button"), shape: "round", size2: 96 }).tl).toBe(48);
    expect(SHAPED).toEqual(["button", "iconButton", "fab", "extendedFab"]);
  });

  it("is one shape holding one icon, with no words of its own", () => {
    /* an icon button is not a button with words: the inspector offers no label row, and a label a
       document still carries (written when the caption existed) neither draws nor grows the box */
    expect(KIND_SPEC.iconButton.hasLabel).toBe(false);
    expect(makeItem("iconButton").label).toBe("");
    expect(KIND_TEXT[getLang()].iconButton.label).toBeUndefined();
    const plain = makeItem("iconButton");
    expect(sizeOf(plain, {})).toEqual({ w: 48, h: 48 });
    expect(sizeOf({ ...plain, label: "Bag" }, {})).toEqual({ w: 48, h: 48 });
    expect(baseRadii({ ...plain, label: "Bag" })).toEqual(uniformRadii(24));
    expect(baseRadii({ ...plain, label: "Bag", size: 96 })).toEqual(uniformRadii(48));
  });

  it("takes a part out of the tree however deep it sits, and says that it did", () => {
    /* a container holding a container holding the part being nested: the removal is two levels
       down, and a caller that only counted top-level items would keep the old tree and add a
       second copy of the part to the container it was dropped on */
    const kid: PlacedItem = { ...makeItem("button"), id: "kid", x: 4, y: 4 };
    const inner: PlacedItem = { ...makeItem("box"), id: "inner", x: 0, y: 0, children: [kid] };
    const outer: Item = { ...makeItem("box"), id: "outer", children: [inner] };
    const { items, changed } = pruneParts([outer], new Set(["kid"]));
    expect(changed).toBe(true);
    expect(findItemIn(items, "kid")).toBeNull();
    expect(findItemIn(items, "inner")).not.toBeNull();
    /* nothing named: the same tree comes back, and it is the very same objects */
    const untouched = pruneParts([outer], new Set(["nobody"]));
    expect(untouched.changed).toBe(false);
    expect(untouched.items[0]).toBe(outer);
    /* a container emptied of its children keeps its place with none */
    const emptied = pruneParts([outer], new Set(["kid", "inner"]));
    expect(emptied.changed).toBe(true);
    expect(emptied.items[0]).toBeDefined();
    expect(emptied.items[0].children).toBeUndefined();
  });

  it("moves a child inside its container, unless the child or the container says otherwise", () => {
    const parent: Item = { ...makeItem("box"), size: 200, size2: 200 };
    const kid: Item = { ...makeItem("image"), size: 120, size2: 80 };
    /* a child that fits slides inside: never past the container's edges */
    expect(childDragFree(parent, false)).toBe(false);
    expect(childDragRoom(parent, kid, {}, false)).toEqual({ w: 80, h: 120 });
    /* one that fills it in both directions has nowhere to go, so the drag moves the container */
    const big: Item = { ...makeItem("image"), size: 240, size2: 220 };
    expect(childDragRoom(parent, big, {}, false)).toEqual({ w: 0, h: 0 });
    /* a child the author picked moves itself, and may sit past an edge: they said which part they
       meant — a child container bigger than the box it sits in is exactly that case */
    expect(childDragFree(parent, true)).toBe(true);
    expect(childDragRoom(parent, big, {}, true)).toEqual({ w: Infinity, h: Infinity });
    /* and a scrolling container is a viewport: its content belongs outside it */
    const viewport: Item = { ...parent, scroll: "y" };
    expect(childDragFree(viewport, false)).toBe(true);
    expect(childDragRoom(viewport, big, {}, true)).toEqual({ w: Infinity, h: Infinity });
  });

  it("scrolls a container's content inside it, and says how far it can go", () => {
    /* the same container, made into a viewport: the box's own size is what is seen, the children
       are the content that moves inside it */
    const kids: PlacedItem[] = [
      { ...makeItem("image"), id: "a", x: 0, y: 0, size: 200 },
      { ...makeItem("image"), id: "b", x: 0, y: 240, size: 200 },
    ];
    const box: Item = { ...makeItem("box"), size: 200, size2: 300, children: kids };
    /* a box that does not scroll holds still, whatever it carries */
    expect(scrollRange(box, {})).toEqual({ x: 0, y: 0 });
    expect(scrollOffset(box, {}, { y: 120 })).toEqual({ x: 0, y: 0 });
    const tall: Item = { ...box, scroll: "y" };
    expect(scrollContent(tall, {})).toEqual({ w: 200, h: 440 });
    expect(scrollRange(tall, {})).toEqual({ x: 0, y: 140 });
    /* an axis that is not the one chosen has no room at all */
    expect(scrollRange({ ...box, scroll: "x" }, {})).toEqual({ x: 0, y: 0 });
    /* the visitor's offset, the author's, and neither past the end nor before the start */
    expect(scrollOffset(tall, {}, { y: 60 })).toEqual({ x: 0, y: 60 });
    expect(scrollOffset({ ...tall, scrollPos: { y: 40 } }, {})).toEqual({ x: 0, y: 40 });
    expect(scrollOffset(tall, {}, { y: 999 })).toEqual({ x: 0, y: 140 });
    expect(scrollOffset(tall, {}, { y: -40 })).toEqual({ x: 0, y: 0 });
    /* content that fits cannot be moved, so a slider for it has nowhere to go */
    expect(scrollRange({ ...tall, children: [kids[0]] }, {})).toEqual({ x: 0, y: 0 });
    /* shrinking a scrolling viewport hides content instead of squashing it */
    expect(resizedChildren(tall, { size2: 200 }, {})).toBeUndefined();
    expect(resizedChildren({ ...box }, { size2: 200 }, {})?.map((c) => c.y)).toEqual([0, 160]);
  });
});

describe("a part's own state machine", () => {
  const btn = (extra: Partial<Item> = {}): Item => ({ ...makeItem("button"), id: "b1", label: "分享", icon: "share", ...extra });
  const look = (id: string, extra: Partial<PartLook> = {}): PartLook => ({ id, ...extra });
  const step = (from: string, to: string, extra: Partial<PartStep> = {}): PartStep => ({ id: `s-${from}-${to}`, from, to, trigger: { kind: "tap" }, ...extra });
  const flow = (looks: PartLook[], steps: PartStep[]): PartFlow => ({ looks, steps });
  const at = (id: string, since = 0): MachineAt => ({ b1: { look: id, since } });
  const inGroup = (it: Item): Item => migrateFlows([{ id: "g1", x: 0, y: 0, axis: "x", items: [it] }])[0].items[0];

  it("walks the cycle an author drew: 分享, 领取, 已领取", () => {
    /* The example the feature exists for: three looks and two tap steps. */
    const share = look("l1", { label: "分享" });
    const claim = look("l2", { label: "领取", icon: "redeem" });
    const done = look("l3", { label: "已领取", icon: "check_circle", disabled: true });
    const f = flow([share, claim, done], [step(START_LOOK, "l2"), step("l2", "l3")]);
    const it = btn({ flow: f });
    /* the look no step has moved it out of is the one the author drew */
    expect(lookAt({}, "b1")).toBe(START_LOOK);
    expect(resolveStates(it, {}, 0).item).toBe(it);
    expect(firstTapStep(f, START_LOOK)?.to).toBe("l2");
    expect(firstTapStep(f, "l2")?.to).toBe("l3");
    /* the last look has no step out of it, so the tap is the plain action's again */
    expect(firstTapStep(f, "l3")).toBeNull();
    expect(resolveStates(it, at("l2"), 0).item).toMatchObject({ label: "领取", icon: "redeem" });
    expect(resolveStates(it, at("l3"), 0).item).toMatchObject({ label: "已领取", icon: "check_circle" });
    expect(resolveStates(it, at("l3"), 0)).toMatchObject({ disabled: true, hidden: false, grown: false });
    expect(tappable(resolveStates(it, at("l3"), 0))).toBe(false);
    /* two steps leaving one look are read in the order they were written */
    const two = flow([look("a"), look("b")], [step("l2", "a"), step("l2", "b")]);
    expect(firstTapStep(two, "l2")?.to).toBe("a");
    /* a step that names the drawn look goes back to exactly what the author made */
    expect(firstTapStep(flow([look("l2")], [step("l2", START_LOOK)]), "l2")?.to).toBe(START_LOOK);
  });

  it("keeps every field a look left alone, so editing the part still moves the nodes", () => {
    const it = btn({ flow: flow([look("l1", { icon: "favorite" })], []) });
    const drawn = resolveStates(it, at("l1"), 0).item;
    expect(drawn.icon).toBe("favorite");
    /* the words are the author's: the node only said what it changed */
    expect(drawn.label).toBe("分享");
    expect(lookItem(it, undefined)).toBe(it);
    /* an explicit null is no icon at all */
    expect(resolveStates(btn({ flow: flow([look("l1", { icon: null })], []) }), at("l1"), 0).item.icon).toBeNull();
    /* and a rooted node carries the flags the old effects carried */
    const flags = btn({ flow: flow([look("l1", { grow: true, hidden: true, variant: "outlined" })], []) });
    expect(resolveStates(flags, at("l1"), 0)).toMatchObject({ grown: true, hidden: true });
    expect(resolveStates(flags, at("l1"), 0).item.variant).toBe("outlined");
  });

  it("waits its own clock, counted from the look the part is in", () => {
    const f = flow(
      [look("building", { label: "建造中", disabled: true })],
      [step(START_LOOK, "building"), step("building", START_LOOK, { trigger: { kind: "after", seconds: 10 } })],
    );
    expect(firstDueStep(f, "building", 9)).toBeNull();
    expect(firstDueStep(f, "building", 10)?.to).toBe(START_LOOK);
    /* the wait left on a look reads as a countdown, and it is the soonest one that shows */
    const two = flow([look("a")], [step("building", "a", { trigger: { kind: "after", seconds: 30 } }), step("building", "a", { trigger: { kind: "after", seconds: 5 } })]);
    expect(waitLeft(two, "building", 2)).toBe(3);
    expect(waitLeft(two, START_LOOK, 0)).toBe(0);
    const it = btn({ flow: f });
    /* greyed out while it builds, with the seconds it has left over it */
    expect(resolveStates(it, at("building", 1000), 3000)).toMatchObject({ disabled: true, cooldown: 8 });
    expect(resolveStates(it, at("building", 1000), 12000)).toMatchObject({ disabled: true, cooldown: 0 });
    /* the look alone never moves itself: the preview's ticker takes the step */
    expect(resolveStates(it, at("building", 1000), 12000).item.label).toBe("建造中");
    expect(hasTimedSteps([it])).toBe(true);
    expect(hasTimedSteps([btn()])).toBe(false);
  });

  it("reads the state rules of an older document back as a machine", () => {
    const old: Item = {
      ...makeItem("button"),
      id: "b1",
      icon: "share",
      states: [
        { id: "s1", trigger: "tap", effect: "icon", value: "check_circle" },
        { id: "s2", trigger: "tap", effect: "label", value: "已领取" },
      ],
    };
    const read = inGroup(old);
    expect(read.states).toBeUndefined();
    const f = read.flow as PartFlow;
    expect(f.looks).toHaveLength(1);
    /* the effects of one tap are one look, and the icon swap is what a visitor taps back */
    expect(f.looks[0]).toMatchObject({ icon: "check_circle", label: "已领取" });
    expect(firstTapStep(f, START_LOOK)?.to).toBe(f.looks[0].id);
    expect(firstTapStep(f, f.looks[0].id)?.to).toBe(START_LOOK);
    expect(resolveStates(read, { b1: { look: f.looks[0].id, since: 0 } }, 0).item).toMatchObject({ icon: "check_circle", label: "已领取" });
    /* a claim stays claimed: with no icon swap there is nothing to go back to */
    const claim = inGroup({ ...makeItem("button"), id: "b2", states: [{ id: "s1", trigger: "tap", effect: "label", value: "已领取" }] });
    const cf = claim.flow as PartFlow;
    expect(firstTapStep(cf, cf.looks[0].id)).toBeNull();
    /* a cooldown is a greyed look the part waits its way out of */
    const cool = inGroup({ ...makeItem("button"), id: "b3", states: [{ id: "s1", trigger: "tap", effect: "cooldown", seconds: 5 }] });
    const kf = cool.flow as PartFlow;
    expect(kf.looks[0].disabled).toBe(true);
    expect(resolveStates(cool, { b3: { look: kf.looks[0].id, since: 1000 } }, 3000)).toMatchObject({ disabled: true, cooldown: 3 });
    expect(firstDueStep(kf, kf.looks[0].id, 5)?.to).toBe(START_LOOK);
    /* a bar's per-slot rules come back the same way */
    const bar = inGroup({ ...makeItem("bottomNav"), id: "nav", slotStates: { "tab:0": [{ id: "s1", trigger: "tap", effect: "label", value: "新消息" }] } });
    expect(bar.slotStates).toBeUndefined();
    expect(bar.slotFlows?.["tab:0"].looks).toHaveLength(1);
    /* a part with nothing to read is left exactly as it was */
    const plain = makeItem("button");
    expect(inGroup(plain)).toBe(plain);
    expect(inGroup(plain).flow).toBeUndefined();
  });

  it("still knows the effects an older document was written with", () => {
    expect(STATE_EFFECTS.map((e) => e.key)).toContain("icon");
    expect(STATE_EFFECTS.map((e) => e.key)).not.toContain("variant");
    expect(isStateEffect("variant")).toBe(true);
    expect(isStateEffect("icon")).toBe(true);
    expect(isStateEffect("chartreuse")).toBe(false);
    /* and one look is what one tap's effects become */
    expect(statesAsFlow([])).toBeUndefined();
    expect(statesAsFlow([{ id: "s", trigger: "tap", effect: "disable" }])?.looks[0].disabled).toBe(true);
  });
});

describe("composite parts", () => {
  const part: CustomPart = {
    id: "p1",
    name: "Card row",
    w: 300,
    h: 120,
    items: [
      { ...makeItem("box"), id: "b", x: 8, y: 8, size: 284, size2: 104, children: [{ ...makeItem("button"), id: "inner", x: 12, y: 12 }] },
      { ...makeItem("text"), id: "t", x: 20, y: 80 },
    ],
  };

  it("drops as one container holding a fresh copy of the set", () => {
    let n = 0;
    const box = compositeInstance(part, () => `n${++n}`);
    expect(box).toMatchObject({ kind: "box", label: "Card row", size: 300, size2: 120 });
    /* the frame draws nothing of its own, so an instance looks like the composed set */
    expect(box).toMatchObject({ fill: "surface", radiusTop: 0, radiusBottom: 0 });
    expect(box.children?.map((c) => c.id)).not.toContain("b");
    expect(box.children?.map((c) => c.id)).not.toContain("t");
    expect(box.children).toHaveLength(2);
    const ids = subtreeOf(box).map((it) => it.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(box.children?.[0]).toMatchObject({ x: 8, y: 8, size: 284, size2: 104 });
    /* the nesting travels with it, and nothing keeps the composed ids */
    expect(box.children?.[0].children?.[0]).toMatchObject({ x: 12, y: 12 });
    expect(subtreeOf(box).map((it) => it.id)).not.toContain("inner");
    /* the template itself is untouched */
    expect(part.items[0].id).toBe("b");
  });

  it("returns a template that is one container as that very container", () => {
    const single: CustomPart = { id: "p2", name: "Box set", w: 200, h: 120, items: [{ ...makeItem("box"), id: "b", x: 12, y: 12, size: 176, size2: 96, children: [{ ...makeItem("button"), id: "kid", x: 8, y: 8 }] }] };
    const one = compositeInstance(single, () => "z1");
    expect(one).toMatchObject({ kind: "box", id: "z1", size: 200, size2: 120 });
    expect(one.children?.[0]).toMatchObject({ x: 8, y: 8 });
  });

  it("lands a one-part template as that very part, so a bar stays a bar", () => {
    /* Wrapping a single bar in a box of its own size left nothing to grab — a child that fills its
       container cannot be dragged inside it — and it stopped behaving like the bar it is. */
    const bar: CustomPart = { id: "p3", name: "Navigation bar · folded", w: BAR_FOLDED_W, h: BAR_FOLDED_H, items: [{ ...makeItem("bottomNav"), id: "nav", x: 0, y: 0, barFolded: true, size: PHONE_W, size2: 80 }] };
    const one = compositeInstance(bar, () => "z2");
    expect(one).toMatchObject({ kind: "bottomNav", id: "z2", barFolded: true });
    /* the folded size is the pill's own: the width and height it carries are kept for unfolding */
    expect(one.size).toBe(PHONE_W);
    expect(one.size2).toBe(80);
    expect(sizeOf(one, {})).toEqual({ w: BAR_FOLDED_W, h: BAR_FOLDED_H });
    /* a plain part takes the size it was saved with */
    const button: CustomPart = { id: "p4", name: "Wide button", w: 220, h: 40, items: [{ ...makeItem("button"), id: "go", x: 0, y: 0 }] };
    expect(compositeInstance(button, () => "z3")).toMatchObject({ kind: "button", id: "z3", size: 220, size2: 40 });
    /* and a set of two parts is still one container holding them */
    expect(compositeInstance(part, () => "z4")).toMatchObject({ kind: "box", children: expect.any(Array) });
  });

  it("knows which navigation parts fold to a pill", () => {
    expect(foldsToPill({ ...makeItem("bottomNav"), barFolded: true })).toBe(true);
    expect(foldsToPill({ ...makeItem("navRail"), railFolded: true })).toBe(true);
    expect(foldsToPill(makeItem("bottomNav"))).toBe(false);
    expect(foldsToPill({ ...makeItem("box"), barFolded: true })).toBe(false);
  });

  it("scales a container's contents with it, offsets and sizes alike", () => {
    const kids = scaleChildren(
      [{ ...makeItem("button"), id: "a", x: 10, y: 20, size: 100, size2: 40, children: [{ ...makeItem("badge"), id: "b", x: 4, y: 6, size: 24 }] } as PlacedItem],
      2,
      0.5,
    );
    expect(kids[0]).toMatchObject({ x: 20, y: 10, size: 200, size2: 20 });
    expect(kids[0].children?.[0]).toMatchObject({ x: 8, y: 3, size: 48 });
  });
});

describe("the navigation bar's box", () => {
  /* The bar carries the gesture area as extra height so its background reaches the rounded
   * screen edge, and centres its destinations in that whole box. Pinned here because the
   * centring is what keeps the row from sitting high with a hem under its labels: shrinking
   * the box instead would move every bar already placed on the canvas. */
  it("keeps the 80dp row plus the gesture inset, and one of each per wrapped row", () => {
    const bar = makeItem("bottomNav");
    expect(sizeOf(bar, {}).h).toBe(80 + NAV_BAR_H);
    const wrapped = { ...bar, navPerRow: 2, tabs: Array.from({ length: 4 }, (_, i) => ({ icon: "", label: `t${i}` })) };
    expect(sizeOf(wrapped, {}).h).toBe((80 + NAV_BAR_H) * 2);
    /* an author-set height is kept as it is: the inset is not added on top of it */
    expect(sizeOf({ ...bar, size2: 96 }, {}).h).toBe(96);
  });
});

describe("nesting a part inside another", () => {
  /* A container dropped into another has to arrive with everything it holds. Only its own layer is
   * raised by the drop, so a child of it that kept the default layer would fall below its parent,
   * and `childShown` would read that as covered: the contents would vanish with no warning. */
  const kid = (id: string, z?: number): PlacedItem => ({ ...makeItem("button"), id, x: 8, y: 8, z } as PlacedItem);
  const box = (id: string, z: number | undefined, children: PlacedItem[]): PlacedItem => ({ ...makeItem("box"), id, x: 0, y: 0, z, children } as PlacedItem);

  it("raises only the container and leaves its contents below it without the helper", () => {
    const moved = { ...box("b", 11, [kid("k")]), z: 11 };
    expect(layerOf(moved)).toBe(11);
    expect(childShown(moved, moved.children![0])).toBe(false);
  });

  it("carries the contents up with the container, so all of it stays drawn", () => {
    const lifted = liftAbove(box("b", undefined, [kid("k")]), 11);
    expect(layerOf(lifted)).toBe(11);
    expect(layerOf(lifted.children![0])).toBe(11);
    expect(childShown(lifted, lifted.children![0])).toBe(true);
  });

  it("keeps a part that already sits high enough where it is", () => {
    const lifted = liftAbove(box("b", 40, [kid("k", 50)]), 11);
    expect(layerOf(lifted)).toBe(40);
    expect(layerOf(lifted.children![0])).toBe(50);
  });

  it("lifts every level of a deep tree, each measured from its own parent", () => {
    const deep = box("outer", undefined, [box("mid", undefined, [kid("leaf", 3)])]);
    const lifted = liftAbove(deep, 12);
    expect(layerOf(lifted)).toBe(12);
    const mid = lifted.children![0];
    expect(layerOf(mid)).toBe(12);
    expect(layerOf(mid.children![0])).toBe(12);
    expect(childShown(lifted, mid)).toBe(true);
    expect(childShown(mid, mid.children![0])).toBe(true);
  });

  it("leaves a part with nothing inside it alone apart from its own level", () => {
    const plain = liftAbove(kid("k"), 11);
    expect(plain).toMatchObject({ id: "k", z: 11 });
    expect(plain.children).toBeUndefined();
  });
});

describe("the mark a dialog page wears while it is worked on", () => {
  /* A dialog page is marked so it reads as a dialog and not as one more screen — the frame around it
   * on the canvas, and its row in the layers panel, from the same helper. It marks rather than paints:
   * the page's own background stays a screen's. A layer that fills the screen is that screen, so it is
   * left unmarked. */
  const dialog: Frame = { id: "d", name: "Dialog", x: 0, y: 0, role: "overlay", level: "modal" };

  it("marks the three levels that float over a screen in the dialog's own colour", () => {
    const p = paletteOf("purple");
    for (const level of ["popover", "sheet", "modal"] as const) {
      const tint = pageTintOf({ ...dialog, level }, p)!;
      expect(tint.bg).toBe(DIALOG_COLOR);
      /* the ink is derived from that colour, and has to be readable on it */
      expect(contrastRatio(tint.ink, tint.bg)).toBeGreaterThanOrEqual(3);
    }
    /* the mark is the same whatever the palette is: it is the author's colour, not a scheme role */
    expect(pageTintOf(dialog, paletteOf("green"))!.bg).toBe(DIALOG_COLOR);
  });

  it("leaves a screen, and a layer that takes the screen, with their own background", () => {
    const p = paletteOf("purple");
    expect(pageTintOf({ id: "s", name: "Home", x: 0, y: 0 }, p)).toBeNull();
    expect(pageTintOf({ ...dialog, role: undefined, level: undefined }, p)).toBeNull();
    /* these two paint their page for real: tinting them would misrepresent the design */
    expect(pageTintOf({ ...dialog, level: "fullscreen" }, p)).toBeNull();
    expect(pageTintOf({ ...dialog, level: "system" }, p)).toBeNull();
  });
});

describe("a tab row and its panels", () => {
  /* A tab row switches between the panels it holds: one panel per tab, in tab order, drawn only when
   * its tab is in front. That mapping by position is why a panel past the last tab is worth reporting:
   * no tab could ever bring it forward. */
  const row = (patch: Partial<Item> = {}): Item => ({ ...makeItem("tabs"), id: "row", ...patch });
  /* how many entries a fresh row starts with: the labels come from the language, so the tests count */
  const N = row().tabs!.length;

  it("draws only the panel of the tab in front", () => {
    const panels = [0, 1, 2].map((i) => ({ ...makeItem("box"), id: `p${i}`, x: 0, y: TAB_ROW_H, size: 390, size2: 200 }));
    const many = [...panels, { ...makeItem("box"), id: "p3", x: 0, y: TAB_ROW_H }];
    const item = { ...row({ selected: 1 }), children: many };
    expect(many.map((_, i) => childDrawn(item, many[i], i))).toEqual([false, true, false, false]);
    expect(many.map((c, i) => childDrawn({ ...item, selected: 3 }, c, i))).toEqual([false, false, false, true]);
    /* a plain container keeps drawing everything it holds */
    const box = { ...makeItem("box"), children: many };
    expect(many.map((_, i) => childDrawn(box, many[i], i))).toEqual([true, true, true, true]);
  });

  it("keeps the tab in front inside the tabs it has", () => {
    expect(tabIndexOf(row({ selected: 99 }))).toBe(N - 1);
    expect(tabIndexOf(row({ selected: undefined }))).toBe(0);
    expect(tabIndexOf(row({ tabs: [], selected: 2 }))).toBe(0);
  });

  it("makes one panel per tab, under the row, the first time it is asked", () => {
    const patch = tabPanelsPatch(row())!;
    expect(patch.children).toHaveLength(N);
    expect(patch.size2).toBe(TAB_ROW_H + TAB_PANEL_H);
    for (const [i, panel] of patch.children!.entries()) {
      expect(panel).toMatchObject({ kind: "box", x: 0, y: TAB_ROW_H, size: sizeOf(row(), {}).w, size2: TAB_PANEL_H });
      /* the panel is named after the tab it belongs to, which is what the layers list shows */
      expect(panel.label).toBe(row().tabs![i].label);
    }
  });

  it("changes nothing the second time, and never touches a panel the author filled in", () => {
    const once = { ...row(), ...tabPanelsPatch(row())! };
    expect(tabPanelsPatch(once)).toBeNull();
    expect(needsTabPanels(once)).toBe(false);
    /* a panel with something inside it keeps what it holds, and a taller row keeps its height */
    const edited = { ...once, size2: TAB_ROW_H + 500, children: [{ ...once.children![0], label: "Mine", children: [{ ...makeItem("button"), id: "kid", x: 8, y: 8 }] } as PlacedItem, ...once.children!.slice(1)] };
    expect(tabPanelsPatch(edited)).toBeNull();
    expect(edited.children![0].children).toHaveLength(1);
  });

  it("leaves panels past the last tab alone, rather than dropping the author's work", () => {
    const withExtra = { ...row(), ...tabPanelsPatch(row())!, tabs: row().tabs!.slice(0, 2) };
    expect(tabPanelsPatch(withExtra)).toBeNull();
    expect(needsTabPanels(withExtra)).toBe(false);
    expect(withExtra.children).toHaveLength(N);
  });

  it("takes the height the author gave it, and asks for room when there is none", () => {
    expect(needsTabPanels(row())).toBe(true);
    expect(needsTabPanels(row({ size2: TAB_ROW_H + TAB_PANEL_H, children: [] }))).toBe(true);
    /* long enough for the panels, but none made yet: still worth asking */
    const roomy = row({ size2: TAB_ROW_H + 300 });
    expect(tabPanelsPatch(roomy)!.children![0].size2).toBe(300);
  });

  it("follows the row when it is resized: the row keeps its height, the panels take the rest", () => {
    const panels = tabPanelsPatch(row())!.children!;
    const fitted = fitTabPanels(panels, 320, 400);
    expect(fitted.every((p) => p.y === TAB_ROW_H && p.x === 0 && p.size === 320 && p.size2 === 400 - TAB_ROW_H)).toBe(true);
  });

  it("brings a new tab's panel along, and draws it when the row is refitted", () => {
    /* the patch the inspector fires for 「add tab」: the tab list and the panels, made together */
    const addTab = (it: Item): Partial<Item> => {
      const count = tabCountPatch(it, (it.tabs?.length ?? 0) + 1, [{ icon: "", label: "New" }]);
      const panels = tabPanelsPatch({ ...it, ...count });
      return panels ? { ...count, ...panels } : count;
    };
    const start = { ...row(), ...tabPanelsPatch(row())! };
    expect(start.children).toHaveLength(N);
    const patch = addTab(start);
    expect(patch.tabs).toHaveLength(N + 1);
    expect(patch.children).toHaveLength(N + 1);
    /* the refit keeps the panel the patch brought in: dropping it is what left the new tab bare */
    const kids = resizedChildren(start, patch, {})!;
    expect(kids).toHaveLength(N + 1);
    expect(kids[N].label).toBe("New");
    expect(kids.every((p) => p.y === TAB_ROW_H && p.size2 === TAB_PANEL_H)).toBe(true);
    /* a row that had no panels at all gets its whole set from the same patch */
    const bare = addTab(row());
    expect(bare.children).toHaveLength(N + 1);
    expect(resizedChildren(row(), bare, {})).toHaveLength(N + 1);
  });

  it("still refits the panels a size patch does not carry", () => {
    const start = { ...row(), ...tabPanelsPatch(row())! };
    const grown = resizedChildren(start, { size2: TAB_ROW_H + 400 }, {})!;
    expect(grown).toHaveLength(N);
    expect(grown.every((p) => p.size2 === 400)).toBe(true);
    /* a patch that resizes nothing, or a part with no children, leaves the shape alone */
    expect(resizedChildren(start, { selected: 1 }, {})).toBeUndefined();
    expect(resizedChildren(row(), { size2: 400 }, {})).toBeUndefined();
  });

  it("is a Material underline row unless the author asks for buttons", () => {
    expect(tabStyleOf(row())).toBe("underline");
    expect(tabStyleOf(row({ tabStyle: "buttons" }))).toBe("buttons");
    expect(tabStyleOf(row({ tabStyle: "nonsense" as unknown as Item["tabStyle"] }))).toBe("underline");
  });
});

describe("a panel taken out of a tab row and put back", () => {
  /* A panel is known by its place in the row's list, so a panel leaving the row has to leave the
   * empty panel of its tab behind: without that, every later panel slides one tab back and the
   * author sees one tab wearing its neighbour's panel — under its neighbour's name. Putting the
   * panel back then has to land in that slot, or the panel and everything inside it ends up in the
   * panel of the tab in front of it. */
  const grandKid = (id: string): PlacedItem => ({ ...makeItem("button"), id, label: id, x: 8, y: 8 } as PlacedItem);
  const row = (): Item => ({
    ...makeItem("tabs"),
    id: "row",
    tabs: [
      { icon: "", label: "Role" },
      { icon: "", label: "Bag" },
      { icon: "", label: "Shop" },
    ],
  });
  /** the row with its panels made, the middle one filled with a part of its own */
  const full = (): Item => {
    const withPanels = { ...row(), ...tabPanelsPatch(row())! };
    return { ...withPanels, children: withPanels.children!.map((c, i) => (i === 1 ? { ...c, children: [grandKid("deep")] } : c)) };
  };
  /** the panel each tab draws, by name: switching to a tab brings its own panel forward */
  const drawn = (it: Item) =>
    (it.tabs ?? []).map((_, i) => {
      const row = { ...it, selected: i };
      return row.children!.find((c, k) => childDrawn(row, c, k))?.label ?? null;
    });

  it("leaves the empty panel of its own tab behind, so no panel slides to another tab", () => {
    const start = full();
    const left = start.children![1];
    expect(drawn(start)).toEqual(["Role", "Bag", "Shop"]);
    /* the editor takes the panel out of the row: the slot is filled again with a fresh panel */
    const after = { ...start, children: keepPanelSlots({ ...start, children: start.children!.filter((c) => c.id !== left.id) }, [1]) };
    expect(after.children).toHaveLength(3);
    expect(drawn(after)).toEqual(["Role", "Bag", "Shop"]);
    /* the stand-in is the tab's own empty panel, not the author's panel */
    expect(after.children![1].id).not.toBe(left.id);
    expect(after.children![1].children).toBeUndefined();
    /* and the panel that left still holds what the author put in it */
    expect(left.children).toHaveLength(1);
  });

  it("takes the panel back into its own slot, with everything inside it", () => {
    const start = full();
    const left = start.children![1];
    const after = { ...start, children: keepPanelSlots({ ...start, children: start.children!.filter((c) => c.id !== left.id) }, [1]) };
    const kids = restorePanel(after, left, {})!;
    const back = { ...after, children: kids };
    expect(kids[1].id).toBe(left.id);
    expect(kids[1].label).toBe("Bag");
    expect(kids[1].children!.map((c) => c.id)).toEqual(["deep"]);
    /* the row shows the panel again, with the part inside it drawn above its panel */
    expect(drawn(back)).toEqual(["Role", "Bag", "Shop"]);
    /* the panel sits above its row, and what it holds is not covered by it */
    expect(layerOf(kids[1])).toBeGreaterThan(layerOf(back));
    expect(childShown(kids[1], kids[1].children![0])).toBe(true);
    expect(kids.every((p) => p.x === 0 && p.y === TAB_ROW_H && p.size2 === TAB_PANEL_H)).toBe(true);
  });

  it("puts a deleted panel's empty slot back, and leaves a deleted row's own panels alone", () => {
    const start = full();
    const deep = start.children![1];
    /* deleting the panel in the layers panel: where it sat, and what holds it */
    const places = new Map<string, { parent: Item; at: number }>();
    slotsOf([start], null, places);
    expect(places.get(deep.id)).toMatchObject({ at: 1 });
    expect(places.get(deep.children![0].id)!.parent.id).toBe(deep.id);

    const after = refillPanels([{ ...start, children: start.children!.filter((c) => c.id !== deep.id) }], new Map([[start.id, [1]]]));
    expect(drawn(after[0])).toEqual(["Role", "Bag", "Shop"]);
    expect(after[0].children![1].id).not.toBe(deep.id);
    /* a row deleted whole takes its panels with it: nothing is put back for it */
    const rowGone = refillPanels([], new Map([[start.id, [1]]]));
    expect(rowGone).toEqual([]);
    /* and a container that is not a tab row is left exactly as it is */
    const box: Item = { ...makeItem("box"), id: "box", children: [grandKid("kid")] };
    expect(refillPanels([box], new Map())).toEqual([box]);
  });

  it("only takes a panel back into a free slot, and only for a box named after a tab", () => {
    const full_ = full();
    /* a panel with something in it is the author's work and is never written over: a box named for
       that tab has no free slot to take */
    expect(panelSlotFor(full_, full_.children![1])).toBeNull();
    expect(panelSlotFor(full_, { ...makeItem("box"), label: "Bag" })).toBeNull();
    /* while the empty panel of another tab is free for the taking */
    expect(panelSlotFor(full_, { ...makeItem("box"), label: "Role" })).toBe(0);
    /* a box with no name, a name no tab carries, and anything that is not a box stay out */
    expect(panelSlotFor(full_, makeItem("box"))).toBeNull();
    expect(panelSlotFor(full_, { ...makeItem("button"), label: "Bag" })).toBeNull();
    expect(restorePanel(full_, { ...makeItem("box"), label: "Nope" } as PlacedItem, {})).toBeNull();
  });
});

describe("panels follow the tabs they belong to", () => {
  /* The panel of a tab is the editor's own scaffolding while it is empty, so it goes with its tab.
   * One the author has put something in is kept and moved past the last tab, where no tab can bring it
   * forward and the review says so: losing work to a tab count would be much worse than an orphan. */
  const panel = (id: string, filled = false): PlacedItem => ({
    ...makeItem("box"),
    id,
    label: id,
    x: 0,
    y: TAB_ROW_H,
    ...(filled ? { children: [{ ...makeItem("button"), id: `${id}-kid`, x: 8, y: 8 } as PlacedItem] } : {}),
  } as PlacedItem);
  const row = (kids: PlacedItem[]): Item => ({ ...makeItem("tabs"), id: "row", tabs: [{ icon: "", label: "A" }, { icon: "", label: "B" }, { icon: "", label: "C" }], children: kids });

  it("drops the empty panel of a removed tab, keeping the rest in order", () => {
    const next = removeTabPatch(row([panel("a"), panel("b"), panel("c")]), 1);
    expect(next.tabs!.map((t) => t.label)).toEqual(["A", "C"]);
    expect(next.children!.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("keeps a panel the author has filled in, and moves it past the last tab", () => {
    const next = removeTabPatch(row([panel("a"), panel("b", true), panel("c")]), 1);
    expect(next.children!.map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(next.children![2].children).toHaveLength(1);
  });

  it("does the same when the tab count is lowered", () => {
    const next = tabCountPatch(row([panel("a"), panel("b"), panel("c", true)]), 1, [{ icon: "", label: "N" }]);
    expect(next.tabs).toHaveLength(1);
    /* the panel of the tab that stays, then the filled one that has no tab left */
    expect(next.children!.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("leaves every other kind of part's children alone", () => {
    const bar: Item = { ...makeItem("bottomNav"), id: "bar", children: [panel("p")] };
    expect(removeTabPatch(bar, 1).children).toBeUndefined();
    expect(tabCountPatch(bar, 2, [{ icon: "", label: "N" }]).children).toBeUndefined();
  });

  it("names the panel of the tab in front, and follows a tab rename while the name is still its own", () => {
    const withPanel = row([panel("a"), panel("b"), panel("c")]);
    withPanel.tabs = withPanel.tabs!.map((t, i) => ({ ...t, label: ["A", "B", "C"][i] }));
    withPanel.children = withPanel.children!.map((c, i) => ({ ...c, label: ["A", "B", "C"][i] }));
    expect(tabPanelId({ ...withPanel, selected: 2 })).toBe("c");
    expect(tabRenamePatch(withPanel, 1, "Bag")).toEqual({ children: [withPanel.children![0], { ...withPanel.children![1], label: "Bag" }, withPanel.children![2]] });
    /* a panel the author named themselves keeps its name */
    const mine = { ...withPanel, children: withPanel.children!.map((c, i) => (i === 1 ? { ...c, label: "Mine" } : c)) };
    expect(tabRenamePatch(mine, 1, "Bag")).toBeNull();
  });

  it("has no panel to name when the row has none, or the tab is past the last panel", () => {
    expect(tabPanelId(row([]))).toBeNull();
    expect(tabPanelId({ ...row([panel("a")]), selected: 2 })).toBeNull();
  });
});

describe("a document written while variables existed", () => {
  const flow = (machine: PartFlow): PartFlow => machine;

  it("drops the values, the conditional rules and the rules inside a part's machine", () => {
    const legacy = {
      ...makeItem("button"),
      id: "share",
      rules: [{ id: "r", when: [{ varId: "v", op: ">=", value: 1 }], do: { kind: "goto", to: "next", transition: "slide" } }],
      flow: flow({
        looks: [{ id: "l2", label: "领取" }],
        steps: [
          { id: "s1", from: START_LOOK, to: "l2", trigger: { kind: "tap" }, when: [{ varId: "v", op: ">=", value: 1 }], do: [{ kind: "set", varId: "v", value: 0 }, { kind: "look", target: "gift", icon: "done" }] } as never,
          { id: "s2", from: "l2", to: START_LOOK, trigger: { kind: "after", seconds: 5 } },
        ],
      }),
    } as Item;
    const [read] = migrateFlows([{ id: "g", x: 0, y: 0, axis: "x", items: [legacy] }]).map((g) => g.items[0]);
    expect((read as unknown as { rules?: unknown }).rules).toBeUndefined();
    expect(read.flow?.steps[0]).toEqual({ id: "s1", from: START_LOOK, to: "l2", trigger: { kind: "tap" }, do: [{ kind: "look", target: "gift", icon: "done" }] });
    /* a step that carried nothing but a guard stays a plain step */
    expect(read.flow?.steps[1]).toEqual({ id: "s2", from: "l2", to: START_LOOK, trigger: { kind: "after", seconds: 5 } });
  });

  it("hands an untouched part back as the very same one", () => {
    const plain = makeItem("button");
    const [read] = migrateFlows([{ id: "g", x: 0, y: 0, axis: "x", items: [plain] }]).map((g) => g.items[0]);
    expect(read).toBe(plain);
  });
});

describe("a look a step latches onto a part", () => {
  it("changes what it names and nothing else, so a document's old style choice is dropped", () => {
    const legacy = {
      ...makeItem("button"),
      id: "share",
      flow: {
        looks: [{ id: "l2", label: "领取" }],
        steps: [{ id: "s1", from: START_LOOK, to: "l2", trigger: { kind: "tap" as const }, do: [{ kind: "look" as const, target: "gift", icon: "done", color: "#FF8A00", variant: "outlined" as const }] }],
      },
    } as unknown as Item;
    const [read] = migrateFlows([{ id: "g", x: 0, y: 0, axis: "x", items: [legacy] }]).map((g) => g.items[0]);
    expect(read.flow?.steps[0].do).toEqual([{ kind: "look", target: "gift", icon: "done", color: "#FF8A00" }]);
    /* a machine that carries nothing legacy comes back as the same object */
    const clean = { ...makeItem("button"), id: "b", flow: { looks: [{ id: "l2" }], steps: [{ id: "s", from: START_LOOK, to: "l2", trigger: { kind: "tap" as const } }] } } as Item;
    const [same] = migrateFlows([{ id: "g", x: 0, y: 0, axis: "x", items: [clean] }]).map((g) => g.items[0]);
    expect(same).toBe(clean);
    expect(same.flow).toBe(clean.flow);
  });
});

describe("a step that walks a part's value", () => {
  /* A pair of buttons driving a slider is the commonest control in a game's settings: the step adds
     to or subtracts from the value the part is at, rather than jumping to a number. */
  it("adds, subtracts or writes outright, always inside the range", () => {
    expect(valueAfter("add", 40, 1)).toBe(41);
    expect(valueAfter("sub", 40, 1)).toBe(39);
    expect(valueAfter("set", 40, 70)).toBe(70);
    expect(valueAfter(undefined, 40, 70)).toBe(70);
    /* the ends are where they are: a step never takes the value past 0 or 100 */
    expect(valueAfter("add", 100, 1)).toBe(100);
    expect(valueAfter("sub", 0, 1)).toBe(0);
    expect(valueAfter("set", 40, 300)).toBe(100);
    expect(valueAfter("add", 40, 2.4)).toBe(42);
    expect(isValueOp("add")).toBe(true);
    expect(isValueOp("double")).toBe(false);
  });
});

describe("a text that reads another part", () => {
  /* A number beside a slider is the commonest readout in a game UI: the text carries the id of the
     part it reads, and the value it shows is the live one, so the drag moves both. */
  it("reads a moving control as a percentage, a row as its choice, and a switch as on or off", () => {
    const slider = { ...makeItem("slider"), id: "s", value: 40 };
    expect(readoutOf(slider, undefined, "en")).toBe("40%");
    expect(readoutOf(slider, 73, "en")).toBe("73%");
    /* out of the range is clamped, not wrapped: a readout never says 120 */
    expect(readoutOf(slider, 120, "en")).toBe("100%");
    const bar = { ...makeItem("progressBar"), value: 8 };
    expect(readoutOf(bar, undefined, "zh")).toBe("8%");
    const tabs = { ...makeItem("tabs"), selected: 1 };
    expect(readoutOf(tabs, undefined, "en")).toBe((tabs.tabs ?? [])[1].label);
    const pick = { ...makeItem("select"), selected: undefined };
    expect(readoutOf(pick, undefined, "en")).toBe((pick.tabs ?? [])[0].label);
    const sw = { ...makeItem("listItem"), switch: true, checked: true };
    expect(readoutOf(sw, undefined, "en")).toBe("On");
    expect(readoutOf({ ...sw, checked: false }, undefined, "zh")).toBe("关");
    /* and only the parts with something to read are offered as a source */
    expect(hasReadout(slider)).toBe(true);
    expect(hasReadout(makeItem("stepper"))).toBe(true);
    expect(hasReadout(sw)).toBe(true);
    expect(hasReadout(makeItem("button"))).toBe(false);
    expect(hasReadout(makeItem("text"))).toBe(false);
  });

  /* The percent sign is a switch on the part, and a text reading the value never carries it: the
     number is the author's to punctuate, and a slider that counts things is not a share of a hundred. */
  it("drops the percent sign when the author turns it off, and never puts it in a text", () => {
    const slider = { ...makeItem("slider"), id: "s", value: 40 };
    expect(unitOf(slider)).toBe(true);
    expect(unitOf({ ...slider, unit: true })).toBe(true);
    expect(unitOf({ ...slider, unit: false })).toBe(false);
    /* the part's own number follows the switch ... */
    expect(readoutOf(slider, undefined, "en")).toBe("40%");
    expect(readoutOf({ ...slider, unit: false }, 55, "en")).toBe("55");
    /* ... and a text read always gets the bare number, whatever the switch says */
    expect(readoutOf(slider, 73, "en", false)).toBe("73");
    expect(readoutOf({ ...slider, unit: false }, 73, "zh", false)).toBe("73");
    const bar = { ...makeItem("progressBar"), value: 8 };
    expect(readoutOf(bar, undefined, "zh", false)).toBe("8");
    /* a row or a switch reads the same words either way: nothing to punctuate */
    const sw = { ...makeItem("listItem"), switch: true, checked: true };
    expect(readoutOf(sw, undefined, "en", false)).toBe("On");
  });

  /* Words and a live number in one line: "出售数量： {v} / 10000" is the shape most screens want,
     and the token is where the number lands — before, after, or between two pieces of text. */
  it("puts a read value inside the author's own words at the token", () => {
    const reader = { ...makeItem("text"), label: "出售数量： {v} / 10000", shows: "s", mix: true };
    expect(mixText("出售数量： {v} / 10000", "4200")).toBe("出售数量： 4200 / 10000");
    /* every alias an author might type, and every place in the line */
    expect(mixText("{v} / {v}", "7")).toBe("7 / 7");
    expect(mixText("{value} 件", "7")).toBe("7 件");
    expect(mixText("共 {数值} 件", "7")).toBe("共 7 件");
    expect(mixText("已售 {值} 件", "7")).toBe("已售 7 件");
    /* no token at all: the number lands after the words rather than nowhere */
    expect(mixText("出售数量：", "8")).toBe("出售数量： 8");
    expect(mixText("", "8")).toBe("8");
    /* the switch decides whether the words are kept: off, the text is the value alone */
    expect(readText({ ...reader, mix: undefined }, "4200")).toBe("4200");
    expect(readText(reader, "4200")).toBe("出售数量： 4200 / 10000");
    /* the token is the one the editor inserts, and it is asked for only when the line has none */
    expect(VALUE_TOKEN).toBe("{v}");
    expect(hasValueToken("出售数量： {v} / 10000")).toBe(true);
    expect(hasValueToken("已售 {数值} 件")).toBe(true);
    expect(hasValueToken("出售数量：")).toBe(false);
    expect(hasValueToken("{x}")).toBe(false);
  });

  /* The top of a value is the author's: a percentage stops at a hundred, a count of things runs to
     ten thousand, and every way the number moves — drag, the part's own readout, a step — stops there. */
  it("lets a slider or a stepper say where its range ends", () => {
    const slider = { ...makeItem("slider"), id: "s", value: 4200, max: 10000 };
    expect(maxOf(slider)).toBe(10000);
    expect(maxOf({ ...slider, max: undefined })).toBe(MAX_DEF);
    /* a ceiling outside what a value may run to at all is brought back in, not trusted */
    expect(maxOf({ ...slider, max: 0 })).toBe(1);
    expect(maxOf({ ...slider, max: -50 })).toBe(1);
    expect(maxOf({ ...slider, max: 5_000_000 })).toBe(MAX_MAX);
    expect(clampMax(999.6)).toBe(1000);
    /* the readout is the value on that scale, and the switch still decides the sign */
    expect(readoutOf(slider, undefined, "en")).toBe("4200%");
    expect(readoutOf({ ...slider, unit: false }, 9000, "zh", false)).toBe("9000");
    expect(readoutOf(slider, 12000, "en")).toBe("10000%");
    /* a step lands inside it, and the same step on a percentage stops at a hundred */
    expect(valueAfter("add", 9500, 500, 10000)).toBe(10000);
    expect(valueAfter("add", 90, 500)).toBe(100);
    expect(valueAfter("sub", 200, 500, 10000)).toBe(0);
    expect(valueAfter("set", 0, 8000, 10000)).toBe(8000);
  });
});

describe("the properties a step may change on another part", () => {
  /* A rule writes only what it names: a step that shows a board's boxes must leave the board's
     colour alone, and the properties on offer are the ones the target really draws with. */
  it("writes the properties it names and nothing else", () => {
    expect(rulePatch({ kind: "look", target: "board", checkboxes: true })).toEqual({ checkboxes: true });
    expect(rulePatch({ kind: "look", label: "已装备", color: "primary", hidden: true })).toEqual({ label: "已装备", color: "primary", hidden: true });
    /* an icon set to nothing is the part drawn bare, which is why an empty string reads as null */
    expect(rulePatch({ kind: "look", icon: "" })).toEqual({ icon: null });
    expect(rulePatch({ kind: "look", icon: "swords" })).toEqual({ icon: "swords" });
    /* a step that names nothing writes nothing */
    expect(rulePatch({ kind: "look", target: "board" })).toEqual({});
  });

  it("offers each kind only the properties it draws with", () => {
    const fields = (kind: Kind) => ruleFieldsFor(makeItem(kind));
    expect(fields("invGrid")).toContain("checkboxes");
    expect(fields("box")).not.toContain("checkboxes");
    expect(fields("box")).toContain("fill");
    expect(fields("switch")).toContain("checked");
    expect(fields("text")).not.toContain("checked");
    expect(fields("slider")).toContain("value");
    expect(fields("button")).not.toContain("value");
    /* a row with options can have one of them chosen; one with none cannot */
    expect(fields("select")).toContain("selected");
    expect(fields("tabs")).toContain("selected");
    expect(ruleFieldsFor({ ...makeItem("tabs"), tabs: [] })).not.toContain("selected");
    /* the three flags every part can be given, whatever it is */
    for (const kind of ["box", "invGrid", "button", "text"] as Kind[]) {
      expect(fields(kind)).toEqual(expect.arrayContaining(["color", "disabled", "hidden", "grow"]));
    }
    /* only the fields a kind really has: a text has words, a divider has none */
    expect(fields("text")).toContain("label");
    expect(fields("divider")).not.toContain("label");
  });
});

describe("the name an author gives a part", () => {
  /* Renaming a row in the layers panel names that part and never writes over what it shows, so a
   * badge keeps its count and a button keeps its words. The name is what the row and the prompt
   * read; the part's own words stay in `label`, where the inspector edits them. */
  it("is shown in place of the words the part says", () => {
    const named = (patch: Partial<Item>): Item => ({ ...makeItem("button"), id: "b", label: "分享", ...patch });
    expect(itemNameOf(named({ name: "分享按钮" }), "zh")).toBe("分享按钮");
    expect(itemNameOf(named({}), "zh")).toBe("分享");
    expect(itemNameOf(named({ label: "", name: "" }), "zh")).toBe("按钮");
  });
});

describe("a background that paints nothing", () => {
  /* Every background picker offers 透明 first: a part left bare on the page, or a container drawn
   * over a picture, is a design the author means as often as a coloured one. */
  const p = paletteOf("purple");

  it("paints nothing and inks the page's own text colour", () => {
    expect(fillColor(TRANSPARENT, p, "surfaceContainerLow")).toBe("transparent");
    expect(fillInk(TRANSPARENT, p, "surfaceContainerLow")).toBe(p.onSurface);
    /* a role still reads as itself, and a missing fill falls back to the caller's default */
    expect(fillColor("primaryContainer", p, "surface")).toBe(p.primaryContainer);
    expect(fillColor(undefined, p, "surfaceContainerLow")).toBe(p.surfaceContainerLow);
    expect(fillInk(undefined, p, "surfaceContainerLow")).toBe(onToken("surfaceContainerLow", p));
  });

  it("is a colour a part may carry as its own, and a card's fill", () => {
    const card: Item = { ...makeItem("card"), fill: TRANSPARENT };
    expect(cardFillOf(card)).toBe(TRANSPARENT);
    expect(isCustomColor(TRANSPARENT)).toBe(true);
    expect(colorOverrideOf({ ...makeItem("box"), color: TRANSPARENT }, p)).toEqual({ main: "transparent", on: p.onSurface });
    /* and a progress bar with a transparent track draws none at all */
    expect(progressTrack({ ...makeItem("progressBar"), fill: TRANSPARENT }, p)).toMatchObject({ color: "transparent" });
  });
});

describe("the board a slot grid draws", () => {
  const grid = (patch: Partial<Item> = {}, size = 380, size2 = 320): Item => ({ ...makeItem("invGrid"), id: "g", size, size2, ...patch });

  it("fills the frame with as many cells of the author's size as fit", () => {
    /* Auto counts answer the frame, which is the point of the part: a wider frame really holds more
       cells rather than stretching the ones already there. */
    const short = slotGrid(grid({}, 380, 200), {});
    const tall = slotGrid(grid({}, 380, 400), {});
    const narrow = slotGrid(grid({}, 300, 320), {});
    const wide = slotGrid(grid({}, 380, 320), {});
    expect(tall.rows).toBeGreaterThan(short.rows);
    expect(wide.cols).toBeGreaterThan(narrow.cols);
    /* whatever the frame measures, a cell is the size the author set */
    expect(tall.cell).toBe(short.cell);
    expect(wide.cell).toBe(narrow.cell);
    expect(short.autoCols).toBe(true);
    expect(short.autoRows).toBe(true);
    /* the last cell of the board still sits inside the child frame */
    const last = short.cellAt(short.cols - 1, short.rows - 1);
    expect(last.x + short.cell).toBeLessThanOrEqual(short.panel.x + short.panel.w + 1);
    expect(last.y + short.cell).toBeLessThanOrEqual(short.panel.y + short.panel.h + 1);
    expect(short.count).toBe(short.cols * short.rows);
  });

  it("grows the child frame past the viewport when the author pins more rows than fit", () => {
    const auto = slotGrid(grid(), {});
    /* nothing to move while the rows are the ones that fit */
    expect(scrollRange(grid(), {})).toEqual({ x: 0, y: 0 });
    const pinned = grid({ gridRows: auto.rows + 4 });
    const g = slotGrid(pinned, {});
    expect(g.rows).toBe(auto.rows + 4);
    expect(g.autoRows).toBe(false);
    /* the board is taller than the frame, the child frame follows the board, and that is what
       the frame slides over */
    expect(g.panel.h).toBeGreaterThan(auto.panel.h);
    expect(scrollContent(pinned, {}).h).toBeGreaterThan(320);
    expect(scrollRange(pinned, {})).toEqual({ x: 0, y: scrollContent(pinned, {}).h - 320 });
    /* every slot on that board is a cell the author can put something in */
    expect(gridCells(pinned, {}).length).toBe(g.count);
    /* and a cell the author ticked is kept on the board too, shrink or not */
    const ticked: Item = { ...grid({}, 380, 140), children: gridCells({ ...grid({}, 380, 140), gridRows: 9 }, {}).map((c) => (c.cellRow === 7 ? { ...c, checked: true } : c)) };
    expect(slotGrid({ ...ticked, gridRows: undefined }, {}).rows).toBe(8);
  });

  it("keeps a pinned column count but never draws a row wider than the frame", () => {
    const three = slotGrid(grid({ gridCols: 3 }), {});
    expect(three.cols).toBe(3);
    expect(three.autoCols).toBe(false);
    /* twelve columns do not fit a phone-wide frame: the frame draws the ones that do, since a row
       too wide to see is a row the author could never reach by moving up and down */
    const many = slotGrid(grid({ gridCols: COLS_MAX }), {});
    expect(many.cols).toBeLessThan(COLS_MAX);
    expect(many.cellAt(many.cols - 1, 0).x + many.cell).toBeLessThanOrEqual(many.panel.x + many.panel.w + 1);
  });

  it("holds the cell size inside the range the inspector offers", () => {
    expect(cellOf(grid())).toBe(CELL_DEF);
    expect(cellOf(grid({ cell: 2 }))).toBe(CELL_MIN);
    expect(cellOf(grid({ cell: 9999 }))).toBe(CELL_MAX);
    /* the room between cells follows the cell, so one control changes the whole board */
    expect(cellGap(CELL_MAX)).toBeGreaterThan(cellGap(CELL_MIN));
  });

  it("gives every slot a container of its own, in reading order", () => {
    /* Each cell is a real box, which is what lets an author drop an icon button into one and have
       the layers panel, the prompt and the preview all agree that it is in there. */
    const board = makeItem("invGrid");
    const g = slotGrid(board, {});
    const kids = board.children ?? [];
    expect(kids.length).toBe(g.cols * g.rows);
    kids.forEach((c, i) => {
      const col = i % g.cols;
      const row = Math.floor(i / g.cols);
      expect(c.kind).toBe("box");
      expect(c.cellCol).toBe(col);
      expect(c.cellRow).toBe(row);
      expect(c.size).toBe(g.cell);
      expect(c.size2).toBe(g.cell);
      expect({ x: c.x, y: c.y }).toEqual(g.cellAt(col, row));
      expect(c.children).toBeUndefined();
      expect(c.name).toBeTruthy();
    });
    /* and laying the board out again changes nothing, so a patch that touches only the look of a
       board does not churn its cells */
    expect(gridCells(board, {})).toEqual(kids);
  });

  it("keeps what a cell holds when the frame, the cell size or the counts change", () => {
    const board = { ...makeItem("invGrid"), id: "g", size: 380, size2: 320 } as Item;
    const part = { ...makeItem("iconButton"), id: "ib", icon: "swords" } as PlacedItem;
    const filled = (it: Item): Item => ({ ...it, children: (it.children ?? []).map((c) => (c.cellCol === 2 && c.cellRow === 1 ? { ...c, checked: true, children: [part] } : c)) });
    const before = slotGrid(filled(board), {});
    /* the frame is made wider: the same cell is still the one holding the part */
    const wider = resizedChildren(filled(board), { size: 412 }, {}) ?? [];
    const cell = wider.find((c) => c.cellCol === 2 && c.cellRow === 1)!;
    expect(cell.children?.[0].id).toBe("ib");
    expect(cell.checked).toBe(true);
    expect(cell.x).not.toBe(slotGrid(filled(board), {}).cellAt(2, 1).x);
    expect(cell.x).toBe(slotGrid({ ...filled(board), size: 412 }, {}).cellAt(2, 1).x);
    /* a smaller frame hides nothing: the board reaches the rows that hold something */
    const shorter = resizedChildren(filled(board), { size2: 140 }, {}) ?? [];
    const still = shorter.filter((c) => c.cellCol === 2 && c.cellRow === 1);
    expect(still).toHaveLength(1);
    expect(still[0].children?.[0].id).toBe("ib");
    const board2 = { ...filled(board), size2: 140 };
    expect(slotGrid(board2, {}).rows).toBeGreaterThanOrEqual(2);
    expect(scrollRange({ ...board2, children: shorter }, {})).toEqual({ x: 0, y: slotGrid(board2, {}).content.h - 140 });
    /* the cell size is one control for the whole board */
    const bigger = resizedChildren(board, { cell: 80 }, {}) ?? [];
    expect(bigger.every((c) => c.size === 80 && c.size2 === 80)).toBe(true);
    expect(before.cell).toBe(CELL_DEF);
  });

  it("gives a document written before cells were containers its cells on the way in", () => {
    const bare: Item = { ...makeItem("invGrid"), id: "g", children: undefined };
    const old: Group = { id: "grp", x: 0, y: 0, axis: "x", items: [bare] };
    const read = withGridCells([old]);
    expect((read[0].items[0].children ?? []).length).toBe(slotGrid(read[0].items[0], {}).count);
    /* a board that already has them keeps the cells that hold something, identity included */
    const part = { ...makeItem("iconButton"), id: "ib" } as PlacedItem;
    const board = makeItem("invGrid");
    const withPart: Item = { ...board, children: (board.children ?? []).map((c, i) => (i === 3 ? { ...c, children: [part] } : c)) };
    const again = withGridCells([{ id: "grp", x: 0, y: 0, axis: "x", items: [withPart] }])[0].items[0];
    expect((again.children ?? []).find((c) => c.children?.length)?.children?.[0].id).toBe("ib");
    expect((again.children ?? []).length).toBe((withPart.children ?? []).length);
  });

  it("keeps its cells, and what they hold, at or above the board's own layer", () => {
    /* A child that sits below its parent is not drawn at all, so a board the author lifted — or one
       nested inside something, which lifts it — has to carry its cells up with it, or the whole
       board would show nothing but its own frame. */
    const bare = makeItem("invGrid");
    const part = { ...makeItem("iconButton"), id: "ib" } as PlacedItem;
    const withPart: Item = { ...bare, children: (bare.children ?? []).map((c, i) => (i === 0 ? { ...c, children: [part] } : c)) };
    /* at the default level nothing is written down: a cell is drawn where it stands */
    expect(gridCells(bare, {}).every((c) => c.z === undefined)).toBe(true);
    const raised: Item = { ...withPart, z: 14 };
    const cells = gridCells(raised, {});
    expect(cells.length).toBe((bare.children ?? []).length);
    expect(cells.every((c) => childShown(raised, c))).toBe(true);
    const filled = cells.find((c) => c.children?.length)!;
    expect(layerOf(filled)).toBeGreaterThanOrEqual(layerOf(raised));
    expect(layerOf(filled.children![0])).toBeGreaterThanOrEqual(layerOf(filled));
    /* and a cell the author had lifted higher on purpose keeps its own level */
    const high: Item = { ...raised, children: (withPart.children ?? []).map((c, i) => (i === 0 ? { ...c, z: 30 } : c)) };
    expect(gridCells(high, {}).find((c) => c.z === 30)?.z).toBe(30);
    /* the patch path is what a layer the author raises goes through */
    const patched = resizedChildren(withPart, { z: 20 }, {}) ?? [];
    expect(patched.every((c) => childShown({ ...withPart, z: 20 }, c))).toBe(true);
  });

  it("puts a cell's checkbox ten layers above it, so the layer control decides what wins", () => {
    /* The board's boxes are chrome: a part dropped into a cell gets the cell's level + 1, so the box
       is above it without anyone thinking about it. Raising a part past `cell + 10` — which the
       inspector's layer control does — is then the one way to put that part over the box. */
    const flat = cellBox(0, 0, 56, { x: 0, y: 0 });
    expect(gridCheckZ(flat)).toBe(20);
    expect(gridCheckZ(flat)).toBeGreaterThan(layerOf(flat) + 1);
    const lifted: Item = { ...flat, z: 30 };
    expect(gridCheckZ(lifted)).toBe(40);
    /* a board the author lifts takes its cells and their boxes with it */
    const board = { ...makeItem("invGrid"), z: 25 } as Item;
    const cells = gridCells(board, {});
    expect(gridCheckZ(cells[0])).toBeGreaterThan(layerOf(board) + 1);
    /* and a cell the author lifts carries what it holds, so nothing vanishes under it */
    const part = { ...makeItem("iconButton"), id: "ib" } as PlacedItem;
    const held: PlacedItem = { ...flat, children: [part] };
    const raised = resizedChildren(held, { z: 30 }, {}) ?? [];
    expect(layerOf(raised[0])).toBeGreaterThanOrEqual(30);
    /* a cell with nothing in it has nothing to carry */
    expect(resizedChildren(flat, { z: 30 }, {})).toBeUndefined();
  });

  it("follows the screen it is carried to, the way a box does", () => {
    /* A grid drawn to the phone's content width and as tall as its screen is a layout, not a size:
       carrying it to another screen takes the new width and height, which is how the board inside
       it follows the frame the author resized. */
    const from = { w: PHONE_W, h: PHONE_H };
    const to = { w: 600, h: 700 };
    const grid0: Item = { ...makeItem("invGrid"), id: "g", size: CONTENT_W, size2: PHONE_H };
    const box0: Item = { ...makeItem("box"), id: "b", size: CONTENT_W, size2: PHONE_H };
    const carried = carryItemSize(grid0, from, to);
    const box = carryItemSize(box0, from, to);
    expect(carried.size).toBe(600 - 32);
    expect(carried.size2).toBe(700);
    expect(carried.size).toBe(box.size);
    expect(carried.size2).toBe(box.size2);
    /* and a frame the author sized by hand stays the size they drew */
    const own: Item = { ...grid0, size: 300, size2: 240 };
    expect(carryItemSize(own, from, to)).toBe(own);
  });

  it("counts a frame too small for even one cell as one cell, capped at the offered range", () => {
    const pinned = slotGrid(grid({ gridCols: 4, gridRows: 5 }), {});
    expect(pinned.count).toBe(20);
    expect(slotGrid(grid({ gridRows: 999 }), {}).rows).toBe(ROWS_MAX);
    const tiny = slotGrid(grid({}, 8, 8), {});
    expect(tiny.cols).toBe(1);
    expect(tiny.rows).toBe(1);
    expect(tiny.panel.w).toBeGreaterThanOrEqual(tiny.cell);
  });
});
