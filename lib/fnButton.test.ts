import { describe, expect, it } from "vitest";
import { KIND_TEXT, LANGS, setGlobalLang, t, type Lang } from "./i18n";
import { isPlacedItem, isProject, readDoc, readableGroups } from "./project";
import {
  FN_BUTTON_LINE,
  KIND_ORDER,
  MEASURED,
  PALETTES,
  cardTextColorOf,
  fnButtonNameInk,
  isTextColor,
  variantsOf,
  KIND_SPEC,
  ROUND_SHAPES,
  SHAPED,
  TIMER_DEF_UNIT,
  TIMER_DEF_VALUE,
  TIMER_UNITS,
  TIMER_VALUE_MAX,
  badgeOn,
  badgeTextOf,
  baseRadii,
  countdownLine,
  fnButtonCircle,
  fnButtonLines,
  isTimerUnit,
  makeItem,
  roundByNature,
  roundShapeRadius,
  scaleR,
  sizeOf,
  timerLeft,
  timerOn,
  timerText,
  timerTicks,
  timerUnitOf,
  timerValueOf,
  uniformRadii,
  type Item,
  type TimerUnit,
} from "./tokens";

const part = (patch: Partial<Item> = {}) => ({ ...makeItem("fnButton"), ...patch }) as Item;
const LANGS_ALL: Lang[] = ["ja", "en", "zh", "ko"];

/* The countdown is a pure formatter, not a clock: the elapsed time is handed in, so the canvas, the
 * PNG export and the preview all draw the same line from the same document. */
describe("a function button's countdown", () => {
  it("writes a count of days in the author's own language", () => {
    expect(timerText(6, "day", "zh")).toBe("6天");
    expect(timerText(6, "day", "ja")).toBe("6日");
    expect(timerText(6, "day", "ko")).toBe("6일");
    expect(timerText(6, "day", "en")).toBe("6d");
  });

  it("writes hours as hh:mm, with no seconds to flicker", () => {
    expect(timerText(3, "hour")).toBe("03:00");
    expect(timerText(30, "hour")).toBe("30:00");
    expect(timerText(0, "hour")).toBe("00:00");
    /* the hours run on rather than wrapping at a day, so the number keeps saying what was set */
    expect(timerText(50, "hour")).toBe("50:00");
  });

  it("writes minutes and seconds as mm:ss, minutes running on past the hour", () => {
    expect(timerText(3, "minute")).toBe("03:00");
    expect(timerText(2, "minute")).toBe("02:00");
    expect(timerText(90, "minute")).toBe("90:00");
    expect(timerText(3, "second")).toBe("00:03");
    expect(timerText(90, "second")).toBe("01:30");
  });

  it("holds a count that is missing, broken or negative at zero", () => {
    expect(timerText(0, "minute")).toBe("00:00");
    expect(timerText(-4, "day", "zh")).toBe("0天");
    expect(timerText(Number.NaN, "second")).toBe("00:00");
    expect(timerText(undefined, "minute")).toBe("00:00");
  });

  it("stops at the ceiling of 120, in every unit", () => {
    expect(TIMER_VALUE_MAX).toBe(120);
    /* exactly at it, each unit keeps its own shape */
    expect(timerText(120, "day", "zh")).toBe("120天");
    expect(timerText(120, "hour")).toBe("120:00");
    expect(timerText(120, "minute")).toBe("120:00");
    expect(timerText(120, "second")).toBe("02:00");
    /* one past it clamps to the ceiling, the same way a negative count clamps to zero */
    expect(timerText(121, "day", "zh")).toBe("120天");
    expect(timerText(121, "hour")).toBe("120:00");
    expect(timerText(121, "minute")).toBe("120:00");
    expect(timerText(121, "second")).toBe("02:00");
    /* and a number far above it is the ceiling too */
    expect(timerText(5000, "day", "zh")).toBe("120天");
    expect(timerText(5000, "minute")).toBe("120:00");
    expect(timerText(5000, "second")).toBe("02:00");
  });

  it("counts those seconds down from the clamped ceiling", () => {
    expect(timerLeft(121, "minute", 0)).toBe(120 * 60);
    expect(timerLeft(5000, "second", 0)).toBe(120);
    expect(timerLeft(5000, "second", 1)).toBe(119);
    expect(timerText(121, "second", "ja", 1)).toBe("01:59");
  });

  it("offers exactly the four units the author can pick from", () => {
    expect(TIMER_UNITS).toEqual(["day", "hour", "minute", "second"]);
    for (const unit of TIMER_UNITS) expect(isTimerUnit(unit)).toBe(true);
    expect(isTimerUnit("week")).toBe(false);
  });

  it("names each unit short enough for the segmented control, in every language", () => {
    const keys: Record<TimerUnit, Parameters<typeof t>[0]> = {
      day: "fnUnitDay",
      hour: "fnUnitHour",
      minute: "fnUnitMinute",
      second: "fnUnitSecond",
    };
    for (const lang of LANGS_ALL) {
      for (const unit of TIMER_UNITS) {
        const label = t(keys[unit], lang);
        expect(label.trim(), `${unit}.${lang}`).not.toBe("");
        /* four of them share one row of the panel: English keeps to a letter, the others to two
           characters at most, which is a word like 时 or 秒 */
        expect([...label].length, `${unit}.${lang}`).toBeLessThanOrEqual(lang === "en" ? 1 : 2);
      }
    }
    expect([t("fnUnitDay", "zh"), t("fnUnitHour", "zh"), t("fnUnitMinute", "zh"), t("fnUnitSecond", "zh")]).toEqual(["天", "时", "分", "秒"]);
    expect([t("fnUnitHour", "ja"), t("fnUnitMinute", "ja"), t("fnUnitHour", "ko"), t("fnUnitMinute", "ko")]).toEqual(["時", "分", "시", "분"]);
  });
});

describe("the second hand", () => {
  it("ticks for minutes and seconds only", () => {
    expect(timerTicks("minute")).toBe(true);
    expect(timerTicks("second")).toBe(true);
    /* days and hours show no seconds, so they start no clock at all */
    expect(timerTicks("day")).toBe(false);
    expect(timerTicks("hour")).toBe(false);
    for (const unit of ["day", "hour"] as const) expect(timerLeft(6, unit, 10)).toBeNull();
  });

  it("counts the seconds left, and stops at zero", () => {
    expect(timerLeft(2, "minute", 0)).toBe(120);
    expect(timerLeft(2, "minute", 1)).toBe(119);
    expect(timerLeft(2, "minute", 120)).toBe(0);
    expect(timerLeft(2, "minute", 200)).toBe(0);
    expect(timerLeft(3, "second", 1)).toBe(2);
    expect(timerLeft(3, "second", 9)).toBe(0);
    /* `timerLeft` works on the number it is handed: a part's own default is applied a level up, by
       `timerValueOf`, which is why a part with nothing set still counts 03:00 down */
    expect(timerLeft(undefined, "minute", 0)).toBe(0);
    expect(countdownLine(part({ timerValue: undefined }), "ja", 1)).toBe("02:59");
    expect(timerLeft(2, "minute", Number.NaN)).toBe(120);
  });

  it("draws the count the author set before anything has run", () => {
    expect(timerText(2, "minute", "ja", 0)).toBe("02:00");
    expect(timerText(3, "second", "ja", 0)).toBe("00:03");
  });

  it("draws one second less on every tick", () => {
    expect(timerText(2, "minute", "ja", 1)).toBe("01:59");
    expect(timerText(2, "minute", "ja", 5)).toBe("01:55");
    expect(timerText(3, "second", "ja", 1)).toBe("00:02");
    expect(timerText(3, "second", "ja", 2)).toBe("00:01");
    expect(timerText(3, "second", "ja", 3)).toBe("00:00");
  });

  it("stops at 00:00 rather than running negative or wrapping", () => {
    expect(timerText(3, "second", "ja", 60)).toBe("00:00");
    expect(timerText(1, "minute", "ja", 3600)).toBe("00:00");
  });
});

describe("the lines a function button draws", () => {
  it("says what the timer is set to, in the unit it is set in", () => {
    expect(countdownLine(part({ timer: true, timerValue: 6, timerUnit: "day" }), "zh")).toBe("6天");
    expect(countdownLine(part({ timer: true, timerValue: 3, timerUnit: "minute" }))).toBe("03:00");
    expect(countdownLine(part({ timer: true, timerValue: 6, timerUnit: "hour" }))).toBe("06:00");
    expect(countdownLine(part({ timer: true, timerValue: 45, timerUnit: "second" }))).toBe("00:45");
  });

  it("is left out entirely while the timer is off", () => {
    const off = part({ timer: false, timerValue: 6, timerUnit: "day" });
    expect(timerOn(off)).toBe(false);
    expect(countdownLine(off, "zh")).toBeNull();
  });

  it("clamps the value it reads, so the panel and the line agree on the top", () => {
    expect(timerValueOf({ timerValue: 120 })).toBe(120);
    expect(timerValueOf({ timerValue: 121 })).toBe(TIMER_VALUE_MAX);
    expect(timerValueOf({ timerValue: 5000 })).toBe(TIMER_VALUE_MAX);
  });

  it("falls back to three minutes when a document says nothing", () => {
    expect(timerValueOf({})).toBe(TIMER_DEF_VALUE);
    expect(timerUnitOf({})).toBe(TIMER_DEF_UNIT);
    expect(countdownLine(part({ timerValue: undefined, timerUnit: undefined }))).toBe("03:00");
    /* a unit this build cannot read is not trusted to name a line */
    expect(timerUnitOf({ timerUnit: "week" as never })).toBe(TIMER_DEF_UNIT);
  });

  it("counts only the lines that are actually there", () => {
    expect(fnButtonLines(part({ label: "活动", timer: true }))).toBe(2);
    expect(fnButtonLines(part({ label: "活动", timer: false }))).toBe(1);
    expect(fnButtonLines(part({ label: "  ", timer: true }))).toBe(1);
    expect(fnButtonLines(part({ label: "", timer: false }))).toBe(0);
  });

  it("is exactly as tall as what it says, in every combination", () => {
    /* both lines: the composite's own 50×76 */
    expect(sizeOf(part({ label: "活动", timer: true }), {})).toEqual({ w: 50, h: 50 + FN_BUTTON_LINE * 2 });
    /* the name only, the countdown only, and neither */
    expect(sizeOf(part({ label: "活动", timer: false }), {}).h).toBe(50 + FN_BUTTON_LINE);
    expect(sizeOf(part({ label: "", timer: true }), {}).h).toBe(50 + FN_BUTTON_LINE);
    expect(sizeOf(part({ label: "", timer: false }), {}).h).toBe(50);
    /* and a part with no name is a line shorter than one with a name */
    expect(sizeOf(part({ label: "" }), {}).h).toBe(sizeOf(part({ label: "活动" }), {}).h - FN_BUTTON_LINE);
  });

  it("keeps the height the author pins, whatever the lines do", () => {
    for (const patch of [{ label: "活动", timer: true }, { label: "活动", timer: false }, { label: "", timer: true }, { label: "", timer: false }]) {
      expect(sizeOf(part({ ...patch, size2: 96 }), {}).h).toBe(96);
    }
  });
});

describe("the button's shape", () => {
  it("is a circle by nature, with the circle as its default", () => {
    /* the shared switch the inspector and the phone sheet both draw reads the kind this way: a
       circle-by-nature part offers exactly the circle and the rounded square, and reads no `shape`
       as the circle */
    expect(SHAPED).toContain("fnButton");
    expect(roundByNature("fnButton")).toBe(true);
    expect(ROUND_SHAPES.map((sh) => sh.key)).toEqual(["round", "square"]);
    expect(makeItem("fnButton").shape).toBeUndefined();
    expect(baseRadii(part()).tl).toBe(25);
    expect(baseRadii(part({ shape: "round" })).tl).toBe(25);
  });

  it("takes the same rounded square an icon button takes", () => {
    /* the values are the icon button's own: the circle is half the diameter, the square is scaleR(8) */
    expect(roundShapeRadius("square", 50)).toBe(scaleR(8));
    expect(roundShapeRadius(undefined, 50)).toBe(25);
    expect(baseRadii(part({ shape: "square" }))).toEqual(uniformRadii(scaleR(8)));
    expect(baseRadii({ ...makeItem("fnButton"), shape: "square" }).tl).toBe(scaleR(8));
  });

  it("rounds the circle it actually draws, not the width it was given", () => {
    /* a pinned height leaves the lines their room first, and the corner follows the circle that is
       left — so a squeezed button is still a circle rather than a squarish blob */
    const squeezed = part({ label: "活动", timer: true, size2: 64 });
    expect(fnButtonCircle(squeezed)).toBe(64 - FN_BUTTON_LINE * 2);
    expect(baseRadii(squeezed).tl).toBe(Math.round((64 - FN_BUTTON_LINE * 2) / 2));
    expect(baseRadii({ ...squeezed, shape: "square" }).tl).toBe(scaleR(8));
    /* 压到连两行都放不下时，圆有个下限，不会缩成一个点 */
    expect(fnButtonCircle(part({ label: "活动", timer: true, size2: 40 }))).toBe(Math.max(8, 40 - FN_BUTTON_LINE * 2));
  });

  it("opens a saved document with the shape it was written with", () => {
    const it = makeItem("fnButton");
    expect(isPlacedItem({ ...it, shape: "round" })).toBe(true);
    expect(isPlacedItem({ ...it, shape: "square" })).toBe(true);
    /* an outline this build cannot draw is refused, the way an unknown unit is */
    expect(isPlacedItem({ ...it, shape: "triangle" })).toBe(false);
    expect(isPlacedItem({ ...it, shape: "circle" })).toBe(false);
  });
});

describe("the badge on the button's corner", () => {
  it("is off until it is switched on, and comes on empty", () => {
    expect(badgeOn({})).toBe(false);
    expect(badgeOn(part())).toBe(false);
    /* switching it on writes no words: the bare dot is the look a "new" mark has */
    const on = part({ badge: true });
    expect(badgeOn(on)).toBe(true);
    expect(badgeTextOf(on)).toBe("");
  });

  it("says whatever the author typed when there is anything to say", () => {
    expect(badgeTextOf({ badgeText: "3" })).toBe("3");
    expect(badgeTextOf({ badgeText: " 新 " })).toBe("新");
    expect(badgeTextOf({ badgeText: undefined })).toBe("");
  });

  it("is named in every language, the words as well as the switch", () => {
    for (const { key } of LANGS) {
      for (const uiKey of ["fnBadge", "fnBadgeText", "fnBadgeHint"] as const) {
        expect(t(uiKey, key).trim(), `${uiKey}.${key}`).not.toBe("");
      }
    }
  });
});

describe("the function button as a kind", () => {
  it("sits under 操作 — the actions category — so the palette offers it there", () => {
    expect(KIND_SPEC.fnButton.category).toBe("actions");
    expect(KIND_ORDER).toContain("fnButton");
  });

  it("carries the name and the icon of a button", () => {
    /* 功能名 is the author's label, and the icon in the circle is theirs to pick — the same control
       every labelled, icon-bearing kind gets */
    expect(KIND_SPEC.fnButton.hasLabel).toBe(true);
    expect(KIND_SPEC.fnButton.hasIcon).toBe(true);
    expect(KIND_SPEC.fnButton.defIcon).toBe("bolt");
    /* the spec's own height is the two-line one, which is what a fresh part is */
    expect(KIND_SPEC.fnButton.h).toBe(50 + FN_BUTTON_LINE * 2);
  });

  it("is named in every offered language", () => {
    for (const { key } of LANGS) {
      const text = KIND_TEXT[key].fnButton;
      expect(text, key).toBeTruthy();
      expect(text.noun.trim(), key).not.toBe("");
      expect(text.label?.trim(), key).not.toBe("");
    }
  });
});

describe("a freshly dropped function button", () => {
  it("comes with the icon and the countdown showing, at the composite's own size", () => {
    const it = makeItem("fnButton");
    expect(it.icon).toBe("bolt");
    expect(it.timer).toBe(true);
    expect(it.size).toBe(50);
    /* 高度按"一行文字占多高"推出来，不再写死 76 */
    expect(sizeOf(it, {})).toEqual({ w: 50, h: 50 + FN_BUTTON_LINE * 2 });
    expect(countdownLine(it)).toBe("03:00");
    /* the badge is off until the author asks for it */
    expect(it.badge).toBeUndefined();
  });
});

describe("the countdown in a saved document", () => {
  /** A document as storage would hold it: one function button in one run. */
  const stored = (patch: Partial<Item>, nested = false) => {
    const button = { ...makeItem("fnButton"), ...patch, id: "f" };
    const item = nested ? { ...makeItem("box"), id: "b", children: [{ ...button, x: 0, y: 0 }] } : button;
    return { groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [item] }], frames: [] };
  };
  const loaded = (patch: Partial<Item>, nested = false) => {
    /* a real round trip: what the editor writes out is what a later visit parses back */
    const doc = readDoc(JSON.parse(JSON.stringify(stored(patch, nested))))!;
    const item = doc.groups[0].items[0];
    return (nested ? item.children![0] : item) as Item;
  };

  it("opens with the fields it was written with", () => {
    const it = makeItem("fnButton");
    expect(isPlacedItem(it)).toBe(true);
    expect(isPlacedItem({ ...it, timerValue: 6, timerUnit: "day" })).toBe(true);
    expect(isPlacedItem({ ...it, timerValue: TIMER_VALUE_MAX })).toBe(true);
    expect(isPlacedItem({ ...it, badge: true })).toBe(true);
    expect(isPlacedItem({ ...it, badge: true, badgeText: "3" })).toBe(true);
  });

  it("clamps a stored count to the ceiling instead of refusing the document", () => {
    /* the document is still one of ours, whatever number a part was saved with */
    expect(isProject(stored({ timerValue: 200 }))).toBe(true);
    expect(loaded({ timerValue: 120 }).timerValue).toBe(120);
    expect(loaded({ timerValue: 200 }).timerValue).toBe(TIMER_VALUE_MAX);
    expect(loaded({ timerValue: 5000 }).timerValue).toBe(TIMER_VALUE_MAX);
    expect(loaded({ timerValue: 3 }).timerValue).toBe(3);
    expect(loaded({ timerValue: 0 }).timerValue).toBe(0);
    /* a fraction is a whole count, the way the slider writes one */
    expect(loaded({ timerValue: 4.6 }).timerValue).toBe(5);
  });

  it("treats a stored count that is negative or not a number as unset", () => {
    for (const bad of [-5, Number.NaN, "9", null, {}]) {
      const it = loaded({ timerValue: bad as never });
      expect(it.timerValue, String(bad)).toBeUndefined();
      /* the field is gone, so the part draws its own default — exactly as if it had never been saved */
      expect(timerValueOf(it), String(bad)).toBe(TIMER_DEF_VALUE);
      expect(countdownLine(it), String(bad)).toBe("03:00");
    }
  });

  it("corrects a part held inside a container as well", () => {
    expect(loaded({ timerValue: 300 }, true).timerValue).toBe(TIMER_VALUE_MAX);
    expect(loaded({ timerValue: -1 }, true).timerValue).toBeUndefined();
  });

  it("corrects what the canvas loader reads out of an autosave too", () => {
    /* the autosave never passes isProject: it is filtered run by run, so the same correction runs */
    const run = readableGroups(stored({ timerValue: 400 }).groups as never);
    expect((run[0].items[0] as Item).timerValue).toBe(TIMER_VALUE_MAX);
  });

  it("still refuses a field it cannot draw at all", () => {
    expect(isPlacedItem({ ...makeItem("fnButton"), timerUnit: "week" })).toBe(false);
    expect(isPlacedItem({ ...makeItem("fnButton"), timer: "yes" })).toBe(false);
    expect(isPlacedItem({ ...makeItem("fnButton"), badge: "yes" })).toBe(false);
    expect(isPlacedItem({ ...makeItem("fnButton"), badgeText: 3 })).toBe(false);
  });
});

/* 作者要求："样式"里增加描边和标准，参考按钮组件 —— 所以功能按钮用按钮的那一套，不再用 FAB 那一小套。 */
describe("the looks a function button offers", () => {
  it("is exactly the button kind's set, not the FAB subset", () => {
    expect(variantsOf("fnButton")).toEqual(variantsOf("button"));
    expect(variantsOf("fnButton").map((v) => v.key)).toEqual(["filled", "tonal", "elevated", "outlined", "text"]);
    /* the two the author named: 描边 (outlined) and the plain 标准 one (the text variant) */
    expect(variantsOf("fnButton").map((v) => v.key)).toContain("outlined");
    expect(variantsOf("fnButton").map((v) => v.key)).toContain("text");
    /* while the floating buttons keep the smaller set they always had */
    expect(variantsOf("fab").map((v) => v.key)).toEqual(["filled", "tonal"]);
    expect(variantsOf("extendedFab").map((v) => v.key)).toEqual(["filled", "tonal"]);
  });

  it("labels them the way the button kind does, in every language", () => {
    for (const { key } of LANGS) {
      setGlobalLang(key);
      expect(variantsOf("fnButton").map((v) => v.label), key).toEqual(variantsOf("button").map((v) => v.label));
      for (const v of variantsOf("fnButton")) expect(v.label.trim(), `${key}:${v.key}`).not.toBe("");
    }
    setGlobalLang("zh");
    expect(variantsOf("fnButton").map((v) => v.label)).toEqual(["填充", "色调", "凸起", "描边", "文本"]);
    setGlobalLang("en");
    expect(variantsOf("fnButton").map((v) => v.label)).toEqual(["Filled", "Tonal", "Elevated", "Outlined", "Text"]);
    setGlobalLang("ja");
    expect(variantsOf("fnButton").map((v) => v.label)).toEqual(["塗りつぶし", "トーナル", "浮き上がり", "枠線", "テキスト"]);
  });

  it("opens with the look it always had", () => {
    /* the set comes from the button kind; the default does not: a fresh one is still the tonal circle */
    expect(makeItem("fnButton").variant).toBe("tonal");
    expect(KIND_SPEC.fnButton.defVariant).toBe("tonal");
  });
});

/* 作者要求：功能按钮第一行文字可以自定义颜色（角色或自己的 #rrggbb）—— 第二行是计时，颜色照旧。 */
describe("the colour of the name line", () => {
  it("is the colour the part has always had until one is chosen", () => {
    const it = makeItem("fnButton");
    expect(it.textColor).toBeUndefined();
    expect(fnButtonNameInk(it, PALETTES[0])).toBe(PALETTES[0].onSurface);
    /* and it is exactly the colour the countdown line draws with, so nothing changed */
    expect(fnButtonNameInk(it, PALETTES[0])).toBe(PALETTES[0].onSurface);
  });

  it("resolves a role and a colour of the author's own", () => {
    const p = PALETTES[0];
    expect(fnButtonNameInk({ ...makeItem("fnButton"), textColor: "primary" }, p)).toBe(p.primary);
    expect(fnButtonNameInk({ ...makeItem("fnButton"), textColor: "onTertiaryContainer" }, p)).toBe(p.onTertiaryContainer);
    /* a #rrggbb is drawn as itself, whatever the palette says */
    expect(fnButtonNameInk({ ...makeItem("fnButton"), textColor: "#123456" }, p)).toBe("#123456");
    expect(fnButtonNameInk({ ...makeItem("fnButton"), textColor: "#ABCDEF" }, p)).toBe("#ABCDEF");
  });

  it("is a kind the browser does not measure, so a colour cannot move its box", () => {
    /* the width comes from its own spec (see sizeOf), not from a measurement — no width implications */
    expect(MEASURED).not.toContain("fnButton");
    expect(sizeOf(makeItem("fnButton"), {})).toEqual(sizeOf({ ...makeItem("fnButton"), textColor: "#123456" }, {}));
  });

  it("resolves a colour of the author's own on a card too, which shares the field", () => {
    /* textColor is the card's field as well: widening it to a hex must not change what a card does */
    expect(cardTextColorOf({ ...makeItem("card"), textColor: "#123456" }, PALETTES[0])).toBe("#123456");
    expect(cardTextColorOf({ ...makeItem("card"), textColor: "primary" }, PALETTES[0])).toBe(PALETTES[0].primary);
  });

  it("takes both kinds of text colour to be valid, and nothing else", () => {
    expect(isTextColor("onSurface")).toBe(true);
    expect(isTextColor("#123456")).toBe(true);
    expect(isTextColor("#abc")).toBe(false);
    expect(isTextColor("#12345g")).toBe(false);
    expect(isTextColor("chartreuse")).toBe(false);
    expect(isTextColor(7)).toBe(false);
    expect(isTextColor(null)).toBe(false);
  });

  it("keeps a good colour and lets a bad one go, without losing the part", () => {
    const stored = (patch: Record<string, unknown>) =>
      ({ groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [{ ...makeItem("fnButton"), id: "f", ...patch }] }], frames: [] });
    const back = (patch: Record<string, unknown>) => readDoc(JSON.parse(JSON.stringify(stored(patch))))!.groups[0].items[0];
    /* a real round trip for both kinds of value */
    expect(back({ textColor: "primary" }).textColor).toBe("primary");
    expect(back({ textColor: "#123456" }).textColor).toBe("#123456");
    /* an unknown token and a malformed hex are cleared — the part and the document are untouched */
    for (const bad of ["chartreuse", "#12345", "#12345g", "rgb(1,2,3)", 7, null, {}]) {
      const read = back({ textColor: bad });
      expect(read, JSON.stringify(bad)).not.toHaveProperty("textColor");
      expect(read).toMatchObject({ kind: "fnButton", id: "f" });
    }
    /* and the rest of the part is intact */
    expect(back({ textColor: "chartreuse", label: "イベント", icon: "bolt" })).toMatchObject({ label: "イベント", icon: "bolt" });
  });
});
