import { describe, expect, it } from "vitest";
import { KIND_TEXT, LANGS, t } from "./i18n";
import { isPlacedItem, readDoc } from "./project";
import {
  AUTHOR_WIDTHS,
  FILL_CUSTOM_KINDS,
  KIND_ORDER,
  KIND_SPEC,
  MARK_GAP_MAX,
  MEASURED,
  NO_AUTO_CLOSE_KINDS,
  SIZE_MIN,
  assetPillMetrics,
  assetPillRadius,
  assetPillTextWidth,
  assetPillWidth,
  baseRadii,
  hidesAutoClose,
  iconSlotsOf,
  makeItem,
  sizeOf,
  variantsOf,
  type Item,
} from "./tokens";

/* The 資産框 composite as one part: an amount on a bar — a rectangle by default, rounded when asked,
 * and as wide as its own content unless the author pins a width. The label is pinned so the widths
 * below are the same in every language the test runs in ("1.6億" measures 36dp at the default 14). */
const pill = (patch: Partial<Item> = {}) => ({ ...makeItem("assetPill"), label: "1.6億", ...patch }) as Item;
const stored = (item: Item) => ({ groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [item] }], frames: [] });

describe("the asset pill as a kind", () => {
  it("sits under 内容 and carries an icon, an amount and a surface", () => {
    const spec = KIND_SPEC.assetPill;
    expect(spec.category).toBe("content");
    expect(KIND_ORDER).toContain("assetPill");
    expect(spec.hasIcon).toBe(true);
    expect(spec.hasLabel).toBe(true);
    expect(spec.hasFill).toBe(true);
    expect(spec.defIcon).toBe("paid");
    /* the composite's own box, drawn as the author asked: a rectangle unless they round it */
    /* the nominal size a catalogue prints, and no pinned width: the drawn width is the content's */
    expect([spec.w, spec.h]).toEqual([70, 28]);
    expect(spec.defSize).toBeUndefined();
    expect(spec.radius).toBe(0);
    /* and the author may pin one, with the 自动宽度 chip as the way back */
    expect(AUTHOR_WIDTHS).toContain("assetPill");
  });

  it("is named, and its amount written, in every offered language", () => {
    for (const { key } of LANGS) {
      const text = KIND_TEXT[key].assetPill;
      expect(text, key).toBeTruthy();
      expect(text.noun.trim(), key).not.toBe("");
      expect(text.label?.trim(), key).not.toBe("");
    }
    expect(KIND_TEXT.zh.assetPill.noun).toBe("资产框");
  });

  it("is the composite, freshly dropped", () => {
    const it = pill();
    expect(it.icon).toBe("paid");
    expect(it.fill).toBe("surfaceContainerHigh");
    /* nothing pins a width: a fresh one is as wide as its label and its left mark */
    expect(it.size).toBeUndefined();
    expect(sizeOf(it, {})).toEqual({ w: 70, h: 28 });
    /* one amount, so no second text row is offered for it */
    expect(KIND_SPEC.assetPill.hasSupporting).toBe(false);
  });

  it("estimates the width of its words from one documented formula", () => {
    /* the numbers a browser can be checked against: 全角 1em, 数字 0.6em, 大写 0.68em, 中标点 0.35em */
    expect(assetPillTextWidth("1.6亿", 14)).toBe(36);
    expect(assetPillTextWidth("1.6億", 14)).toBe(36);
    expect(assetPillTextWidth("1.6억", 14)).toBe(36);
    expect(assetPillTextWidth("160M", 14)).toBe(35);
    expect(assetPillTextWidth("123,456", 14)).toBe(55);
    expect(assetPillTextWidth("12", 14)).toBe(17);
    /* an empty label takes no room at all — the fallback */
    expect(assetPillTextWidth("", 14)).toBe(0);
    /* and the estimate follows the font the bar draws its words at */
    expect(assetPillTextWidth("1.6億", 20)).toBe(51);
    /* the layout numbers box and drawing share, at the default height */
    expect(assetPillMetrics(pill())).toEqual({ h: 28, chip: 20, gap: 6, inset: 4, font: 14 });
    expect(assetPillMetrics(pill({ size2: 40 }))).toEqual({ h: 40, chip: 29, gap: 9, inset: 6, font: 20 });
  });

  it("is as wide as its content, and an absent mark takes its chip AND its gap with it", () => {
    const both = pill({ icon2: "arrow_forward" });
    const left = pill();
    const right = pill({ icon: null, icon2: "arrow_forward" });
    const neither = pill({ icon: null });
    expect(assetPillWidth(both)).toBe(96);
    expect(assetPillWidth(left)).toBe(70);
    expect(assetPillWidth(neither)).toBe(44);
    /* each step is smaller than the last… */
    expect(assetPillWidth(both)).toBeGreaterThan(assetPillWidth(left));
    expect(assetPillWidth(left)).toBeGreaterThan(assetPillWidth(neither));
    /* …and the two single-mark bars are equal by symmetry, the bar being symmetric */
    expect(assetPillWidth(right)).toBe(assetPillWidth(left));
    /* removing a mark drops exactly its chip and the gap that went with it: 20 + 6 */
    expect(assetPillWidth(both) - assetPillWidth(left)).toBe(assetPillMetrics(both).chip + assetPillMetrics(both).gap);
    expect(assetPillWidth(left) - assetPillWidth(neither)).toBe(assetPillMetrics(left).chip + assetPillMetrics(left).gap);
    /* a label with no marks is nothing but its two insets… */
    expect(assetPillMetrics(pill({ icon: null, label: "" })).inset * 2).toBe(8);
    /* …and a bar with nothing in it at all still keeps the floor a part is grabbable at */
    expect(assetPillWidth(pill({ icon: null, label: "" }))).toBe(SIZE_MIN);
    expect(assetPillWidth(pill({ icon: null, label: "", size2: 1 }))).toBe(SIZE_MIN);
  });

  it("grows by exactly the spacing the author adds", () => {
    const one = pill();
    const two = pill({ icon2: "arrow_forward" });
    /* with one mark there is one gap, so +1dp of spacing is +1dp of bar */
    expect(assetPillWidth({ ...one, markGap: 7 }) - assetPillWidth(one)).toBe(1);
    expect(assetPillWidth({ ...one, markGap: 16 }) - assetPillWidth(one)).toBe(10);
    /* with two there are two gaps, so +1dp of spacing widens the bar by 2dp */
    expect(assetPillWidth({ ...two, markGap: 7 }) - assetPillWidth(two)).toBe(2);
    expect(assetPillWidth({ ...two, markGap: 20 })).toBe(96 + 2 * 14);
    /* and it never touches the words: the amount keeps its full estimated width */
    expect(assetPillWidth(two) - (assetPillMetrics(two).inset * 2 + assetPillMetrics(two).chip * 2 + assetPillMetrics(two).gap * 2)).toBe(36);
  });

  it("reports what the browser measured, and falls back to the estimate when nothing has", () => {
    const it = pill();
    /* nothing has measured it yet — the server render, a static export, the first frame, a test: the
       estimate is the box, and it is never zero */
    expect(sizeOf(it, {})).toEqual({ w: assetPillWidth(it), h: 28 });
    expect(sizeOf(it, {}).w).toBe(70);
    /* the editor's hidden layer measures the very same row and hands the number over: that is the box,
       however long the amount is — including a measurement wider than the estimate */
    expect(sizeOf(it, { [it.id]: 143 })).toEqual({ w: 143, h: 28 });
    expect(sizeOf(it, { [it.id]: 143 }).w).toBeGreaterThan(assetPillWidth(it));
    expect(sizeOf(it, { [it.id]: 42 })).toEqual({ w: 42, h: 28 });
    /* another part's measurement is not this part's */
    expect(sizeOf(it, { "someone-else": 400 })).toEqual({ w: 70, h: 28 });
    /* and a width the author pinned wins over both the measurement and the content */
    expect(sizeOf(pill({ size: 40 }), { [it.id]: 143 })).toEqual({ w: 40, h: 28 });
    /* the kinds the editor measures, and the one that may pin a width: the pill is both */
    expect(MEASURED).toContain("assetPill");
    expect(AUTHOR_WIDTHS).toContain("assetPill");
  });

  it("estimates a width that grows with the text, for every kind of amount", () => {
    /* the fallback has to be sane for whatever an author types: never shrinking as the text grows, and
       never less than the fixed parts around it. (The real width comes from the browser; this is what
       the box says until it has one.) */
    const withMark = assetPillMetrics(pill()).inset * 2 + assetPillMetrics(pill()).chip + assetPillMetrics(pill()).gap;
    const labels = ["1", "12", "160M", "1.6亿", "1.6億", "1.6억", "9.9万", "123,456", "1,234,567원", "Paid 12", "余额 ¥1,234,567.89"];
    for (const label of labels) {
      /* every one of them: the fixed parts plus the words, and never less than the bare bar */
      expect(assetPillWidth(pill({ label })), label).toBe(withMark + assetPillTextWidth(label, 14));
      expect(assetPillWidth(pill({ label })), label).toBeGreaterThan(assetPillWidth(pill({ label: "" })));
    }
    /* and the shape of it: a longer amount is a strictly wider bar */
    const longer = ["1", "12", "160M", "123,456", "1,234,567원", "余额 ¥1,234,567.89"];
    let was = 0;
    for (const label of longer) {
      const w = assetPillWidth(pill({ label }));
      expect(w, label).toBeGreaterThan(was);
      was = w;
    }
    /* an empty label takes no room of its own: nothing but the inset and the mark */
    expect(assetPillWidth(pill({ label: "" }))).toBe(assetPillMetrics(pill()).inset * 2 + assetPillMetrics(pill()).chip);
    /* and a much longer amount is a much wider bar */
    expect(assetPillWidth(pill({ label: "余额 ¥1,234,567.89" }))).toBeGreaterThan(assetPillWidth(pill({ label: "1.6亿" })));
  });

  it("lets the author pin a width, which then wins over the content", () => {
    const pinned = pill({ icon2: "arrow_forward", size: 40 });
    expect(sizeOf(pinned, {})).toEqual({ w: 40, h: 28 });
    expect(sizeOf(pill({ size: 200 }), {})).toEqual({ w: 200, h: 28 });
    /* the natural width is still what the content asks for, so the inspector can show it */
    expect(assetPillWidth(pinned)).toBe(96);
    expect(sizeOf(pill(), {})).toEqual({ w: assetPillWidth(pill()), h: 28 });
  });

  it("is a plain rectangle when the author has set no corner of its own", () => {
    /* 用户要求默认为长方形：未设 radiusTop 时圆角是 0，直角 */
    const it = pill();
    expect(KIND_SPEC.assetPill.radius).toBe(0);
    expect(assetPillRadius(it)).toBe(0);
    expect(baseRadii(it).tl).toBe(0);
    /* whatever its size: a rectangle stays a rectangle */
    expect(baseRadii({ ...it, size2: 40 }).tl).toBe(0);
    expect(baseRadii({ ...it, size: 120, size2: 36 }).tl).toBe(0);
    expect(sizeOf({ ...it, size: 120, size2: 36 }, {})).toEqual({ w: 120, h: 36 });
  });

  it("lets the author dress its two icons in any of the button kind's looks", () => {
    /* 作者要求：资产里的图标也要描边和标准，和按钮组件同一套 —— 一个选择管两个图标，用部件自己的
       variant 字段（条的底子还是 fill，各管各的）。 */
    expect(KIND_SPEC.assetPill.hasVariant).toBe(true);
    expect(variantsOf("assetPill")).toEqual(variantsOf("button"));
    expect(variantsOf("assetPill").map((v) => v.key)).toEqual(["filled", "tonal", "elevated", "outlined", "text"]);
    expect(variantsOf("assetPill").map((v) => v.key)).toContain("outlined");
    /* the default is the look the chips already had: a filled round mark */
    expect(KIND_SPEC.assetPill.defVariant).toBe("filled");
    expect(makeItem("assetPill").variant).toBe("filled");
  });

  it("draws the corner its author set, and holds it inside what the height allows", () => {
    expect(baseRadii(pill({ radiusTop: 4 })).tl).toBe(4);
    expect(baseRadii(pill({ radiusTop: 0 })).tl).toBe(0);
    /* past half the drawn height a corner stops meaning anything: the value is held there */
    expect(baseRadii(pill({ radiusTop: 99 })).tl).toBe(14);
    expect(baseRadii(pill({ radiusTop: 14, size2: 36 })).tl).toBe(14);
    expect(baseRadii(pill({ radiusTop: 99, size2: 36 })).tl).toBe(18);
    /* and below zero it is a square end */
    expect(baseRadii(pill({ radiusTop: -5 })).tl).toBe(0);
    expect(assetPillRadius(pill({ radiusTop: 7.6 }))).toBe(8);
    /* at the default height, half of it is as round as the corner can get */
    expect(assetPillRadius(pill({ radiusTop: 14 }))).toBe(14);
  });

  it("keeps an author's corner through a resize, clamped to the new half-height", () => {
    /* set wide and then made short: the number stays theirs, held to half of the new height — at that
       point the shape is as round as its height allows, and never distorted past it */
    expect(assetPillRadius(pill({ radiusTop: 20, size2: 28 }))).toBe(14);
    expect(assetPillRadius(pill({ radiusTop: 20, size2: 36 }))).toBe(18);
    expect(assetPillRadius(pill({ radiusTop: 6, size2: 20 }))).toBe(6);
    /* while an unset one goes on meaning a plain rectangle, at any size */
    expect(assetPillRadius(pill({ size2: 60 }))).toBe(0);
  });

  it("carries a mark on each side, and the right one is unset until it is asked for", () => {
    const it = pill();
    expect(it.icon).toBe("paid");
    expect(it.icon2).toBeUndefined();
    /* the generic icon control offers both slots here, each named for the side it is on */
    expect(iconSlotsOf(it).map((slot) => slot.key)).toEqual(["icon", "icon2"]);
    expect(iconSlotsOf(it).map((slot) => slot.label)).toEqual([t("leftIcon", "ja"), t("rightIcon", "ja")]);
    /* while every other kind keeps the slots it had: one for a single-icon part, none for a text */
    expect(iconSlotsOf(makeItem("button")).map((slot) => slot.key)).toEqual(["icon"]);
    expect(iconSlotsOf(makeItem("text"))).toEqual([]);
    expect(iconSlotsOf(pill({ icon2: "arrow_forward" })).map((slot) => slot.value)).toEqual(["paid", "arrow_forward"]);
  });

  it("names its two icons in every language, and leaves 图标 to the others", () => {
    for (const { key } of LANGS) {
      expect(t("leftIcon", key).trim(), key).not.toBe("");
      expect(t("rightIcon", key).trim(), key).not.toBe("");
      expect(t("leftIcon", key), key).not.toBe(t("icon", key));
      expect(t("rightIcon", key), key).not.toBe(t("icon", key));
    }
    expect(t("leftIcon", "zh")).toBe("左图标");
    expect(t("rightIcon", "zh")).toBe("右图标");
    expect(t("icon", "zh")).toBe("图标");
  });

  it("keeps no timer property unless a document gave it one", () => {
    expect(NO_AUTO_CLOSE_KINDS).toEqual(["itemCell", "assetPill"]);
    expect(FILL_CUSTOM_KINDS).toEqual(["itemCell", "assetPill"]);
    expect(hidesAutoClose({ kind: "assetPill" })).toBe(true);
    expect(hidesAutoClose({ kind: "itemCell" })).toBe(true);
    /* a stored readout that already carries a time keeps the row, so the time can be taken away */
    expect(hidesAutoClose({ kind: "assetPill", autoClose: 30 })).toBe(false);
    /* and every other kind keeps the row it always had */
    for (const kind of KIND_ORDER) {
      if (kind === "assetPill" || kind === "itemCell") continue;
      expect(hidesAutoClose({ kind }), kind).toBe(false);
    }
    expect(isPlacedItem(pill({ autoClose: 30 }))).toBe(true);
    expect(readDoc(stored(pill({ autoClose: 30 })))!.groups[0].items[0].autoClose).toBe(30);
  });

  it("opens a saved document with the fields it was written with", () => {
    const it = pill();
    expect(isPlacedItem(it)).toBe(true);
    const saved = pill({ label: "9.9万", icon: "diamond", icon2: "arrow_forward", fill: "#123456", radiusTop: 4, markGap: 12, size: 40 });
    expect(isPlacedItem(saved)).toBe(true);
    /* a real round trip: what the editor writes out is what a later visit parses back */
    const back = readDoc(JSON.parse(JSON.stringify(stored(saved))))!.groups[0].items[0] as Item;
    expect(back).toMatchObject({ label: "9.9万", icon: "diamond", icon2: "arrow_forward", fill: "#123456", size: 40, radiusTop: 4, markGap: 12 });
    expect(sizeOf(back, {})).toEqual({ w: 40, h: 28 });
    expect(baseRadii(back).tl).toBe(4);
    /* an unpinned, unspaced one comes back unpinned and unspaced, and measures itself again */
    const auto = readDoc(JSON.parse(JSON.stringify(stored(pill({ icon2: "arrow_forward" })))))!.groups[0].items[0] as Item;
    expect(auto).not.toHaveProperty("size");
    expect(auto).not.toHaveProperty("markGap");
    expect(sizeOf(auto, {})).toEqual({ w: 96, h: 28 });
  });

  it("holds a stored spacing inside its range instead of losing the part", () => {
    const read = (patch: Partial<Item>) => readDoc(JSON.parse(JSON.stringify(stored(pill(patch)))))!.groups[0].items[0] as Item;
    /* clamped, never rejected — and the bar is drawn at the clamped spacing */
    expect(read({ markGap: 999 })).toMatchObject({ markGap: MARK_GAP_MAX });
    expect(read({ markGap: -5 })).toMatchObject({ markGap: 0 });
    expect(sizeOf(read({ markGap: 999 }), {})).toEqual({ w: assetPillWidth({ ...pill(), markGap: MARK_GAP_MAX }), h: 28 });
    /* a spacing written as something that is not a number is let go: the height decides it again */
    const odd = read({ markGap: "wide" as never });
    expect(odd).not.toHaveProperty("markGap");
    expect(sizeOf(odd, {})).toEqual({ w: 70, h: 28 });
    /* and the rest of the part is untouched */
    expect(odd).toMatchObject({ kind: "assetPill", label: "1.6億", icon: "paid" });
  });

  it("is a rectangle by default in a document read back too", () => {
    const back = readDoc(JSON.parse(JSON.stringify(stored(pill()))))!.groups[0].items[0] as Item;
    expect(back).not.toHaveProperty("radiusTop");
    expect(baseRadii(back).tl).toBe(0);
  });

  it("holds a stored corner inside its range instead of losing the part", () => {
    /* best effort: a radius past half the height is clamped, a square end stays square, and the rest
       of the document is untouched */
    const saved = pill({ radiusTop: 999 });
    const back = readDoc(JSON.parse(JSON.stringify(stored(saved))))!.groups[0].items[0] as Item;
    expect(back).toMatchObject({ kind: "assetPill", radiusTop: 14, label: "1.6億", icon: "paid" });
    expect(sizeOf(back, {})).toEqual({ w: 70, h: 28 });
    expect(readDoc(JSON.parse(JSON.stringify(stored(pill({ radiusTop: -3 })))))!.groups[0].items[0]).toMatchObject({ radiusTop: 0 });
    /* a corner written as something that is not a number at all is let go, and the pill is a rectangle */
    const odd = readDoc(JSON.parse(JSON.stringify(stored(pill({ radiusTop: "round" as never })))))!.groups[0].items[0] as Item;
    expect(odd).not.toHaveProperty("radiusTop");
    expect(baseRadii(odd).tl).toBe(0);
    /* and a taller stored pill clamps to its own half-height */
    expect(readDoc(JSON.parse(JSON.stringify(stored(pill({ radiusTop: 999, size2: 40 })))))!.groups[0].items[0]).toMatchObject({ radiusTop: 20 });
  });
});
