import { describe, expect, it } from "vitest";
import { LANGS, t } from "./i18n";
import { isPlacedItem, readDoc, readItem } from "./project";
import { buildPrompt } from "./prompt";
import {
  AUTHOR_WIDTHS,
  H,
  KIND_SPEC,
  MEASURED,
  SIZE_MIN,
  assetPillTextWidth,
  buttonMetrics,
  buttonWidth,
  makeItem,
  sizeOf,
  type Item,
} from "./tokens";

/* 按钮自己的那些数（和它的右徽标无关 —— 那一枚已经去掉了，见下面最后两组）。
 *
 * 按钮有两个宽度来源：作者钉的 `size`、浏览器量出来的那一行；都没有时才是 kind 自己的 128（MEASURED
 * 的意思就是"内容决定宽度"）。下面的标签都写死，宽度才和语言无关。 */
const btn = (patch: Partial<Item> = {}) => ({ ...makeItem("button"), id: "btn", label: "OK", icon: "swords", ...patch }) as Item;
const stored = (item: Item) => ({ groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [item] }], frames: [] });

describe("a button's box", () => {
  it("is kind's own width and height until something measures or pins it", () => {
    expect(sizeOf(btn(), {})).toEqual({ w: KIND_SPEC.button.w, h: H });
    expect(sizeOf(btn(), {})).toEqual({ w: 128, h: 56 });
    /* 量出来的数、以及作者钉的宽度，说了算 */
    expect(sizeOf(btn(), { btn: 300 })).toEqual({ w: 300, h: 56 });
    expect(sizeOf(btn({ size: 200 }), {})).toEqual({ w: 200, h: 56 });
    expect(sizeOf(btn({ size2: 40 }), {})).toEqual({ w: 128, h: 40 });
    /* 内容决定宽度这件事本身没变：量不到时才走 kind 那个数 */
    expect(MEASURED).toContain("button");
    expect(AUTHOR_WIDTHS).toContain("button");
  });

  it("keeps the row's own numbers: the pad, the gap and the icon of the medium button", () => {
    /* 逐字复算公式 —— scale = size2 / H，padX = (有字 ? (有图标 ? 22 : 26) : 16) * scale 再 Math.round，
       icon 24 * scale，font 16 * scale，gap 只有图标和文字同时在才是 8 * scale。七种高度 × 三种内容
       全部对得上（画出来的那一行由 M3Node.test.tsx 逐字节断言）。 */
    for (const size2 of [40, 56, 60, 64, 80, 112, 200]) {
      for (const [icon, label] of [["swords", "OK"], [null, "OK"], ["swords", ""]] as [string | null, string][]) {
        const it = btn({ size2, icon, label });
        const scale = size2 / H;
        const m = buttonMetrics(it);
        const at = `${size2}/${String(icon)}/${label}`;
        expect(m.pad, at).toBe(Math.round((label.trim() ? (icon ? 22 : 26) : 16) * scale));
        expect(m.gap, at).toBe(icon && label.trim() ? Math.round(8 * scale) : 0);
        expect(m.icon, at).toBe(Math.round(24 * scale));
        expect(m.font, at).toBe(Math.round(16 * scale));
        expect(m.pieces, at).toBe((icon ? 1 : 0) + (label.trim() ? 1 : 0));
      }
    }
    expect(buttonMetrics(btn())).toMatchObject({ gap: 8, pad: 22, icon: 24, font: 16, pieces: 2 });
    expect(buttonMetrics(btn({ icon: null }))).toMatchObject({ gap: 0, pad: 26 });
    expect(buttonMetrics(btn({ label: "" }))).toMatchObject({ gap: 0, pad: 16 });
  });

  it("never consults the estimator, so the number it reports cannot drift", () => {
    /* sizeOf 从不走 buttonWidth（估出来的数只服务于"还没被量到时"的画法与首帧）：它给的始终是 kind
       自己的 w，估出来的数再大也不影响盒子 */
    expect(buttonWidth(btn({ label: "a very long label indeed" }))).toBeGreaterThan(KIND_SPEC.button.w);
    expect(sizeOf(btn({ label: "a very long label indeed" }), {}).w).toBe(KIND_SPEC.button.w);
    const m = buttonMetrics(btn());
    expect(buttonWidth(btn())).toBe(m.pad * 2 + m.icon + assetPillTextWidth("OK", m.font) + m.gap);
    expect(buttonWidth(btn())).toBe(98);
    /* the estimator never goes below the smallest a part may be dragged to */
    expect(buttonWidth(btn({ label: "", icon: null }))).toBeGreaterThanOrEqual(SIZE_MIN);
  });
});

/* 按钮自己那枚右徽标已经去掉了（作者：「组件-按钮中有个右徽标属性，去掉此属性。不要影响其它按钮组件」）。
   老文档里还写着的 `badge` / `badgeText` 在读进来的路上让掉 —— 读的人是按种类删的，所以功能按钮、物品格
   和任务信息条的角标照旧读这一对字段（见 lib/project.ts 的 readItem）。 */
describe("a button with a badge an old document still carries", () => {
  it("lets the badge go on the way in, and loses nothing else", () => {
    const back = readItem({ ...btn(), badge: true, badgeText: "1", size: 120 })!;
    expect(back).toMatchObject({ kind: "button", label: "OK", icon: "swords", size: 120 });
    expect(back).not.toHaveProperty("badge");
    expect(back).not.toHaveProperty("badgeText");
    expect(isPlacedItem(back)).toBe(true);
    expect(sizeOf(back, {})).toEqual({ w: 120, h: 56 });
    /* 一整份文档也一样：那个字段没了，部件和别的字段都在 */
    const doc = readDoc(JSON.parse(JSON.stringify(stored({ ...btn(), badge: true, badgeText: "7" }))))!;
    const read = doc.groups[0].items[0] as Item;
    expect(read).toMatchObject({ kind: "button", label: "OK" });
    expect(read).not.toHaveProperty("badgeText");
    expect(sizeOf(read, {})).toEqual({ w: 128, h: 56 });
  });

  it("leaves the kinds that do have corner marks alone", () => {
    /* 这一对字段是通用字段：只有按钮那一份被让掉，别的种类照旧读它 */
    for (const kind of ["fnButton", "itemCell", "taskBar"] as const) {
      const read = readItem({ ...makeItem(kind), badge: true, badgeText: "新" })!;
      expect(read, kind).toMatchObject({ kind, badge: true, badgeText: "新" });
    }
  });
});

describe("a button in the prompt", () => {
  const doc = (item: Item) =>
    ({
      title: "T",
      brief: "",
      paletteKey: "purple",
      frame: "phone",
      platform: "android",
      groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [item] }],
      frames: [{ id: "f", name: "F", x: 0, y: 0 }],
    }) as never;

  it("says nothing about a badge any more, in every language", () => {
    const badgeWords = ['"NEW"', "「NEW」", "“NEW”", "NEW"];
    for (const { key } of LANGS) {
      const said = buildPrompt(doc(btn()), {}, undefined, key);
      expect(said, key).not.toContain("badge");
      /* 老文档里带着字也一样：提示里一个字都不提它 */
      const old = buildPrompt(doc({ ...btn(), badge: true, badgeText: "NEW" } as Item), {}, undefined, key);
      for (const word of badgeWords) expect(old, `${key}: ${word}`).not.toContain(word);
    }
  });
});
