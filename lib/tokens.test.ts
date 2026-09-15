import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_THEME, KIND_SPEC, LAYER_DEFAULT, PALETTES, R_FULL, baseRadii, byLayer, carryItemSize, colorOverrideOf, connectSpecOf, connectable, compositeInstance, copySubtree, fitHeight, iconSlotsOf, isCustomColor, itemsOf, layerOf, makeItem, normalizeTheme, paletteForItem, parentOf, railLayoutWidth, railMetrics, resolveStates, runCorners, scaleChildren, scaleR, setGlobalShape, sizeOf, subtreeOf, tappable, isScrollableTabs, tabScrollOffset, removeTabPatch, tabCountPatch, SCROLL_TAB_W, uniformRadii, type CustomPart, type Group, type Item, type ItemState, type PlacedItem } from "./tokens";

afterEach(() => setGlobalShape("rounded")); // restore the module default

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
    expect(railMetrics(expanded)).toEqual({ width: 220, headerLeft: 16, inset: 12, top: 100, itemHeight: 56, gap: 0 });
    expect(railLayoutWidth(expanded)).toBe(220);
    const modal = { ...expanded, railModal: true };
    expect(sizeOf(modal, {}).w).toBe(220);
    expect(railLayoutWidth(modal)).toBe(96);
    expect(baseRadii(modal)).toEqual({ tl: 16, tr: 16, bl: 16, br: 16 });
    expect(baseRadii({ ...modal, radiusTop: 0 }).tl).toBe(0);
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

/* a document can carry a part this build has no spec for; geometry falling back to the
 * box keeps the editor drawing instead of failing on the first layout pass */
describe("a badge's size", () => {
  it("hugs its number by default and takes the size its author gives it", () => {
    const dot = { ...makeItem("badge"), label: "" };
    expect(sizeOf(dot, {})).toEqual({ w: 16, h: 6 });
    const numbered = makeItem("badge");
    expect(sizeOf(numbered, {})).toEqual({ w: 16, h: 16 });
    expect(sizeOf({ ...numbered, size: 40, size2: 24 }, {})).toEqual({ w: 40, h: 24 });
    /* a measured width stays the fallback when only the height was set */
    expect(sizeOf({ ...numbered, size2: 24 }, { [numbered.id]: 30 })).toEqual({ w: 30, h: 24 });
    expect(KIND_SPEC.badge.size).toBeDefined();
    expect(KIND_SPEC.badge.size2).toBeDefined();
  });
});

describe("a part of an unknown kind", () => {  const alien = { ...makeItem("button"), kind: "chart" } as unknown as Item;

  it("measures as the box rather than reading an undefined spec", () => {
    expect(sizeOf(alien, {})).toEqual({ w: KIND_SPEC.box.w, h: KIND_SPEC.box.h });
  });

  it("has box geometry at every entry point that reads a spec", () => {
    expect(baseRadii(alien)).toEqual(uniformRadii(scaleR(KIND_SPEC.box.radius)));
    expect(connectSpecOf(alien)).toBeUndefined();
    expect(connectable(alien)).toBe(false);
    expect(iconSlotsOf(alien)).toEqual([]);
    expect(() => fitHeight(alien, 100)).not.toThrow();
    expect(() => carryItemSize(alien, { w: 100, h: 100 }, { w: 200, h: 200 })).not.toThrow();
  });
});

describe("a part's own colour and layer", () => {
  const p = PALETTES[0];

  it("starts every part at the default level and follows a typed one", () => {
    expect(LAYER_DEFAULT).toBe(10);
    expect(layerOf(makeItem("button"))).toBe(LAYER_DEFAULT);
    expect(layerOf({ ...makeItem("button"), z: 40 })).toBe(40);
    expect(layerOf({ ...makeItem("button"), z: 0 })).toBe(0);
  });

  it("resolves a palette role and a hex literal, and ignores junk", () => {
    expect(isCustomColor("primary")).toBe(true);
    expect(isCustomColor("#1A2B3C")).toBe(true);
    expect(isCustomColor("#1a2b3c")).toBe(true);
    expect(isCustomColor("chartreuse")).toBe(false);
    expect(isCustomColor("#12345")).toBe(false);
    expect(isCustomColor(undefined)).toBe(false);
    expect(colorOverrideOf(makeItem("button"), p)).toBeNull();
    expect(colorOverrideOf({ ...makeItem("button"), color: "tertiaryContainer" }, p)).toEqual({ main: p.tertiaryContainer, on: p.onTertiaryContainer });
    expect(colorOverrideOf({ ...makeItem("button"), color: "#101010" }, p)?.main).toBe("#101010");
  });

  it("stands in for the primary role so every accent follows the part's colour", () => {
    const plain = paletteForItem(makeItem("button"), p);
    expect(plain).toBe(p);
    const own = paletteForItem({ ...makeItem("button"), color: "primary" }, p);
    expect(own.primary).toBe(p.primary);
    const hex = paletteForItem({ ...makeItem("text"), color: "#FFD400" }, p);
    expect(hex).toMatchObject({ primary: "#FFD400", primaryContainer: "#FFD400", onSurface: "#FFD400" });
  });
});

describe("containers and their children", () => {
  const kid = (id: string, x: number, y: number): PlacedItem => ({ ...makeItem("button"), id, x, y });
  const box = (id: string, children: PlacedItem[]): PlacedItem => ({ ...makeItem("box"), id, x: 0, y: 0, children });
  const groups = (): Group[] => [
    { id: "g1", x: 0, y: 0, axis: "x", items: [box("c1", [kid("k1", 10, 20), box("c2", [kid("k2", 1, 2)])]), kid("top", 300, 0)] },
  ];

  it("walks a document depth first, containers before what they hold", () => {
    expect(itemsOf(groups()).map((it) => it.id)).toEqual(["c1", "k1", "c2", "k2", "top"]);
    expect(subtreeOf(box("c1", [kid("k1", 0, 0), box("c2", [kid("k2", 0, 0)])])).map((it) => it.id)).toEqual(["c1", "k1", "c2", "k2"]);
  });

  it("names the container a part sits in, however deep", () => {
    expect(parentOf(groups(), "k2")?.id).toBe("c2");
    expect(parentOf(groups(), "k1")?.id).toBe("c1");
    expect(parentOf(groups(), "top")).toBeNull();
    expect(parentOf(groups(), "missing")).toBeNull();
  });

  it("copies a subtree with fresh ids, keeping the offsets and the children", () => {
    let n = 0;
    const ids = new Map<string, string>();
    const copy = copySubtree(box("c1", [kid("k1", 10, 20), box("c2", [kid("k2", 1, 2)])]) as PlacedItem, () => `n${++n}`, ids);
    expect(copy.id).toBe("n1");
    expect(copy.children?.map((c) => c.id)).toEqual(["n2", "n3"]);
    expect(copy.children?.[0]).toMatchObject({ x: 10, y: 20 });
    expect(copy.children?.[1].children?.[0]).toMatchObject({ id: "n4", x: 1, y: 2 });
    expect(ids.get("k2")).toBe("n4");
    /* the original tree is untouched */
    expect(copy.children).not.toBe(box("c1", []).children);
  });

  it("stacks a container's contents by level", () => {
    const low = { ...kid("a", 0, 0), z: 1 };
    const high = { ...kid("b", 0, 0), z: 30 };
    const same = kid("c", 0, 0);
    expect([high, same, low].sort(byLayer).map((it) => it.id)).toEqual(["a", "c", "b"]);
  });
});

describe("state transitions hung on a part", () => {
  const withRule = (rule: ItemState): Item => ({ ...makeItem("button"), states: [rule] });
  const rule = (effect: ItemState["effect"], extra: Partial<ItemState> = {}): ItemState => ({ id: "s1", trigger: "tap", effect, ...extra });

  it("leaves a part alone until its own tap has happened", () => {
    const it = withRule(rule("disable"));
    expect(resolveStates(it, {}, 1000)).toMatchObject({ hidden: false, disabled: false, cooldown: 0 });
    expect(tappable(resolveStates(it, {}, 1000))).toBe(true);
  });

  it("greys a part out for good once it has been tapped", () => {
    const it = withRule(rule("disable"));
    const after = resolveStates(it, { [it.id]: 1000 }, 9000);
    expect(after).toMatchObject({ disabled: true, hidden: false, cooldown: 0 });
    expect(after.item).toBe(it);
    expect(tappable(after)).toBe(false);
  });

  it("counts a cooldown down and lets the part answer again when it runs out", () => {
    const it = withRule(rule("cooldown", { seconds: 5 }));
    expect(resolveStates(it, { [it.id]: 1000 }, 2000).cooldown).toBe(4);
    expect(resolveStates(it, { [it.id]: 1000 }, 3000).disabled).toBe(true);
    expect(resolveStates(it, { [it.id]: 1000 }, 7000)).toMatchObject({ disabled: false, cooldown: 0 });
  });

  it("swaps the words and the look it was told to", () => {
    const words = withRule(rule("label", { value: "冷却中" }));
    expect(resolveStates(words, { [words.id]: 0 }, 1).item.label).toBe("冷却中");
    const look = withRule(rule("variant", { value: "outlined" }));
    expect(resolveStates(look, { [look.id]: 0 }, 1).item.variant).toBe("outlined");
    /* a variant that is not one of ours changes nothing */
    const junk = withRule(rule("variant", { value: "chartreuse" }));
    expect(resolveStates(junk, { [junk.id]: 0 }, 1).item).toBe(junk);
  });

  it("takes a hidden part off the screen", () => {
    const it = withRule(rule("hide"));
    expect(resolveStates(it, { [it.id]: 0 }, 1).hidden).toBe(true);
  });

  it("applies a part's rules in the order they were written", () => {
    const it: Item = { ...makeItem("button"), states: [rule("label", { value: "A" }), rule("label", { value: "B" })] };
    expect(resolveStates(it, { [it.id]: 0 }, 1).item.label).toBe("B");
  });

  it("brings a part that cooled down all the way back, other rules and all", () => {
    const it: Item = { ...makeItem("button"), color: "#111111", states: [rule("cooldown", { seconds: 5 }), rule("color", { value: "#FF0000" }), rule("label", { value: "Cooling" })] };
    const during = resolveStates(it, { [it.id]: 1000 }, 2000);
    expect(during).toMatchObject({ disabled: true, cooldown: 4 });
    expect(during.item).toMatchObject({ color: "#FF0000", label: "Cooling" });
    /* the moment the wait is over the part is exactly what its author drew */
    const after = resolveStates(it, { [it.id]: 1000 }, 7000);
    expect(after).toMatchObject({ item: it, hidden: false, disabled: false, cooldown: 0 });
    expect(after.item.color).toBe("#111111");
    expect(after.item.label).toBe(it.label);
  });

  it("paints a part in a colour of its own when the rule says so", () => {    const it = withRule(rule("color", { value: "#FF8A00" }));
    expect(resolveStates(it, { [it.id]: 0 }, 1).item.color).toBe("#FF8A00");
    const role = withRule(rule("color", { value: "tertiaryContainer" }));
    expect(resolveStates(role, { [role.id]: 0 }, 1).item.color).toBe("tertiaryContainer");
    /* a colour this build cannot resolve leaves the part as it was */
    const junk = withRule(rule("color", { value: "chartreuse" }));
    expect(resolveStates(junk, { [junk.id]: 0 }, 1).item).toBe(junk);
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
    expect(box).toMatchObject({ id: "n1", kind: "box", label: "Card row", size: 300, size2: 120 });
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
