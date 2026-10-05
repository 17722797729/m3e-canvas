import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { onColorFor } from "./color";
import { KIND_TEXT, LANGS, setGlobalLang, t } from "./i18n";
import { isPlacedItem, readDoc } from "./project";
import {
  ITEM_CELL_FILL,
  TIMED_KINDS,
  fillColor,
  fillInk,
  hasTimer,
  ITEM_CELL_LINE,
  ITEM_CELL_QUALITY,
  ITEM_CELL_RADIUS,
  KIND_ORDER,
  KIND_SPEC,
  badge2ColorOf,
  badge2On,
  badge2TextOf,
  itemCellBox,
  itemCellHeight,
  itemCellLines,
  makeItem,
  PALETTES,
  scaleR,
  sizeOf,
  type Item,
} from "./tokens";

const part = (patch: Partial<Item> = {}) => ({ ...makeItem("itemCell"), ...patch }) as Item;
const PALETTE = PALETTES[0];

describe("the item cell as a kind", () => {
  it("sits under 内容 — the content category — so the palette offers it there", () => {
    expect(KIND_SPEC.itemCell.category).toBe("content");
    expect(KIND_ORDER).toContain("itemCell");
  });

  it("carries the picture, the count, the name and two corner marks", () => {
    const spec = KIND_SPEC.itemCell;
    expect(spec.hasIcon).toBe(true);
    expect(spec.hasLabel).toBe(true);
    expect(spec.hasSupporting).toBe(true);
    expect(spec.hasFill).toBe(true);
    expect(spec.defIcon).toBe("eco");
    expect(spec.defSupporting).toBe("23");
    /* the composite's own 60×76, and the two marks it wore */
    expect([spec.w, spec.h]).toEqual([60, 60 + ITEM_CELL_LINE]);
    expect([spec.w, spec.h]).toEqual([60, 76]);
    expect(spec.defBadge2Text).toBe("普通");
    expect(spec.defBadgeText).toBe("新");
    expect(spec.radius).toBe(ITEM_CELL_RADIUS);
  });

  it("has no countdown of its own: the timer belongs to the function button alone", () => {
    expect(TIMED_KINDS).toEqual(["fnButton"]);
    expect(hasTimer(makeItem("fnButton"))).toBe(true);
    expect(hasTimer(makeItem("itemCell"))).toBe(false);
    /* and no other kind can grow one by accident */
    for (const kind of KIND_ORDER) expect(hasTimer({ kind }), kind).toBe(kind === "fnButton");
    /* the cell has none of the flags the timer's neighbours are read by either */
    expect(KIND_SPEC.itemCell.hasValue).toBeFalsy();
    /* while the button has no count field, so the cell's own rows cannot reach it */
    expect(KIND_SPEC.fnButton.hasSupporting).toBe(false);
  });

  it("is named in every offered language, words and marks alike", () => {
    for (const { key } of LANGS) {
      const text = KIND_TEXT[key].itemCell;
      expect(text, key).toBeTruthy();
      for (const [field, value] of Object.entries(text)) expect(value.trim(), `${key}.${field}`).not.toBe("");
    }
  });
});

describe("a freshly dropped item cell", () => {
  beforeEach(() => setGlobalLang("zh"));
  afterEach(() => setGlobalLang("ja"));

  it("is the composite, part for part", () => {
    const it = makeItem("itemCell");
    expect(it.icon).toBe("eco");
    expect(it.label).toBe("树叶");
    expect(it.supporting).toBe("23");
    expect(it.badge2).toBe(true);
    expect(it.badge2Text).toBe("普通");
    expect(it.badge2Color).toBe(ITEM_CELL_QUALITY);
    expect(it.badge).toBe(true);
    expect(it.badgeText).toBe("新");
    expect(it.fill).toBe(ITEM_CELL_FILL);
    expect(it.strokeWidth).toBe(1);
    expect(it.strokeColor).toBe("secondaryContainer");
    expect(it.size).toBe(60);
    expect(sizeOf(it, {})).toEqual({ w: 60, h: 76 });
  });

  it("writes those words in the author's own language", () => {
    setGlobalLang("en");
    const en = makeItem("itemCell");
    expect(en.label).toBe("Leaf");
    expect(en.badge2Text).toBe("Common");
    expect(en.badgeText).toBe("New");
  });
});

describe("the cell's own box", () => {
  it("is the part's width, and gives the name its line only when there is one", () => {
    expect(itemCellLines(part({ label: "树叶" }))).toBe(1);
    expect(itemCellLines(part({ label: "  " }))).toBe(0);
    expect(itemCellHeight(60, 1)).toBe(60 + ITEM_CELL_LINE);
    expect(itemCellHeight(60, 0)).toBe(60);
    /* a part with no name is a cell and nothing else */
    expect(sizeOf(part({ label: "" }), {})).toEqual({ w: 60, h: 60 });
    expect(itemCellBox(part({ label: "" }), 60)).toBe(60);
  });

  it("leaves the name its room when the author pins a height", () => {
    const pinned = part({ label: "树叶", size2: 96 });
    expect(sizeOf(pinned, {})).toEqual({ w: 60, h: 96 });
    expect(itemCellBox(pinned, 60)).toBe(60);
    /* squeezed below the cell's own height, the square gives way first — never the name's line */
    expect(itemCellBox(part({ label: "树叶", size2: 40 }), 60)).toBe(40 - ITEM_CELL_LINE);
    expect(itemCellBox(part({ label: "树叶", size2: 0 }), 60)).toBe(8);
  });
});

describe("the cell's own surface", () => {
  it("takes a colour of the author's own beside the palette roles", () => {
    /* the free colour disc writes a #rrggbb literal, so the fill resolver has to read one — the same
       rule `Item.color` and `Item.strokeColor` are read by */
    expect(fillColor("#7BAE7A", PALETTE, "surfaceContainerLow")).toBe("#7BAE7A");
    expect(fillInk("#7BAE7A", PALETTE, "surfaceContainerLow")).toBe(onColorFor("#7BAE7A"));
    /* a role, nothing at all and the fallback are all unchanged */
    expect(fillColor("surfaceContainerHigh", PALETTE, "surfaceContainerLow")).toBe(PALETTE.surfaceContainerHigh);
    expect(fillColor("transparent", PALETTE, "surfaceContainerLow")).toBe("transparent");
    expect(fillColor(undefined, PALETTE, "surfaceContainerLow")).toBe(PALETTE.surfaceContainerLow);
  });

  it("is named apart from the icon's colour", () => {
    for (const { key } of LANGS) {
      expect(t("iconColor", key).trim(), key).not.toBe("");
      expect(t("iconColor", key), key).not.toBe(t("bgColor", key));
      expect(t("iconColor", key), key).not.toBe(t("background", key));
    }
    expect(t("iconColor", "zh")).toBe("图标颜色");
  });
});

describe("the cell's two corner marks", () => {
  it("reads the second one the way it reads the first", () => {
    expect(badge2On({})).toBe(false);
    expect(badge2On(part({ badge2: true }))).toBe(true);
    expect(badge2TextOf({ badge2Text: " 普通 " })).toBe("普通");
    expect(badge2TextOf({ badge2Text: undefined })).toBe("");
    /* a colour is a palette role or a #rrggbb literal; anything else is left to the theme */
    expect(badge2ColorOf({ badge2Color: "#7BAE7A" })).toBe("#7BAE7A");
    expect(badge2ColorOf({ badge2Color: "tertiaryContainer" })).toBe("tertiaryContainer");
    expect(badge2ColorOf({ badge2Color: "not a colour" })).toBeUndefined();
    expect(badge2ColorOf({})).toBeUndefined();
  });

  it("is named on both controls in every language", () => {
    for (const { key } of LANGS) {
      expect(t("markLeft", key).trim(), key).not.toBe("");
      expect(t("markLeftHint", key).trim(), key).not.toBe("");
      expect(t("quantity", key).trim(), key).not.toBe("");
    }
  });

  it("keeps its own name for the theme's role", () => {
    expect(scaleR(ITEM_CELL_RADIUS)).toBe(ITEM_CELL_RADIUS);
  });
});

describe("an item cell in a saved document", () => {
  const stored = (patch: Partial<Item>) => ({
    groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [{ ...makeItem("itemCell"), ...patch, id: "c" }] }],
    frames: [],
  });
  const loaded = (patch: Partial<Item>) => readDoc(JSON.parse(JSON.stringify(stored(patch))))!.groups[0].items[0] as Item;

  it("opens with every field it was written with", () => {
    const it = makeItem("itemCell");
    expect(isPlacedItem(it)).toBe(true);
    for (const patch of [{ badge2: true }, { badge2: true, badge2Text: "史诗" }, { badge2: true, badge2Color: "tertiaryContainer" }]) {
      expect(isPlacedItem({ ...it, ...patch }), JSON.stringify(patch)).toBe(true);
      expect(loaded(patch)).toMatchObject(patch);
    }
    expect(loaded({ badge2: false, badge2Text: "" })).toMatchObject({ badge2: false, badge2Text: "" });
  });

  it("opens a cell that was stored with countdown fields, and simply ignores them", () => {
    /* the fields are another part's; a document carrying them is still one this build can draw */
    const withTimer = { ...makeItem("itemCell"), timer: true, timerValue: 6, timerUnit: "day" as const };
    expect(isPlacedItem(withTimer)).toBe(true);
    const back = loaded({ timer: true, timerValue: 6, timerUnit: "day" });
    expect(back.timer).toBe(true);
    expect(back.timerValue).toBe(6);
    /* no line is drawn from them and no room is kept for one: the box is still the cell's own */
    expect(itemCellLines(back)).toBe(1);
    expect(sizeOf(back, {})).toEqual({ w: 60, h: 76 });
  });

  it("keeps the surface colour it was saved with, role or #rrggbb alike", () => {
    expect(isPlacedItem({ ...makeItem("itemCell"), fill: "#123456" })).toBe(true);
    for (const fill of ["#123456", "tertiaryContainer", "transparent"]) {
      expect(loaded({ fill } as Partial<Item>).fill, fill).toBe(fill);
      expect(fillColor(loaded({ fill } as Partial<Item>).fill, PALETTE, ITEM_CELL_FILL), fill).not.toBeUndefined();
    }
  });

  it("still refuses a field it cannot draw at all", () => {
    expect(isPlacedItem({ ...makeItem("itemCell"), badge2: "yes" })).toBe(false);
    expect(isPlacedItem({ ...makeItem("itemCell"), badge2Text: 3 })).toBe(false);
    expect(isPlacedItem({ ...makeItem("itemCell"), badge2Color: "not a colour" })).toBe(false);
  });
});
