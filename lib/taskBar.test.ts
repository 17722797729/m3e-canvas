import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KIND_TEXT, KO, LANGS, UI, setGlobalLang, t } from "./i18n";
import { isPlacedItem, readDoc, readItem, readProject } from "./project";
import { buildPrompt } from "./prompt";
import {
  FILL_CUSTOM_KINDS,
  KIND_ORDER,
  KIND_SPEC,
  NO_AUTO_CLOSE_KINDS,
  TASK_BAR_BADGE_H,
  TASK_BAR_BADGE_OVER_RIGHT,
  TASK_BAR_BADGE_OVER_TOP,
  TASK_BAR_BTN_H,
  TASK_BAR_BTN_W,
  TASK_BAR_CELL,
  TASK_BAR_FILL,
  TASK_BAR_GAP,
  TASK_BAR_H,
  TASK_BAR_LOCK_ICON,
  TASK_BAR_PAD_BOTTOM,
  TASK_BAR_PAD_TOP,
  TASK_BAR_RADIUS,
  TASK_BAR_TITLE_LINE,
  TAPPABLE,
  hasStateRow,
  badge2ColorOf,
  badgeColorOf,
  badgeOn,
  badgeTextOf,
  buttonBadgeWidth,
  iconSlotsOf,
  makeItem,
  setIconSlot,
  sizeOf,
  taskBarButtonBadge,
  taskBarButtonBadgeIcon,
  taskBarButtonBadgeOn,
  taskBarButtonLocked,
  taskBarMetrics,
  TASK_BAR_ICON,
  TASK_BAR_VALUE,
  disablesWholePart,
  lookItem,
  withLook,
  wordsKeyOf,
  wordsOf,
  type Item,
} from "./tokens";

/* 任务信息条（作者要求"只有一个单组件，就像功能按钮组件一样，将组合组件改为属性的方式融进单组件
 * 里面"）：一条任务的信息 —— 标题、两个奖励格（每格带固定奖励图标、固定数量 100 和两枚角标）和一个
 * 「领取」按钮（带右上角那枚徽标）—— 全都在一个部件里，每一块都是这条的属性而不是它的孩子。奖励格
 * 的个数、奖励图标和奖励数量都不是属性：永远是两个格子、那个固定的 TASK_BAR_ICON 和那个固定的
 * TASK_BAR_VALUE。
 *
 * 这里的标签都写死，盒子才和语言无关（和 itemCell / buttonBadge 那两个测试同一套写法）。 */
const bar = (patch: Partial<Item> = {}) =>
  ({
    ...makeItem("taskBar"),
    label: "每日登录游戏 (1/1)",
    value: 23,
    label2: "领取",
    ...patch,
  }) as Item;

const stored = (item: Item) => ({ groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [item] }], frames: [] });
const roundTrip = (item: Item) => readDoc(JSON.parse(JSON.stringify(stored(item))))!.groups[0].items[0] as Item;
const saved = async (item: Item) =>
  (await readProject(new File([JSON.stringify(stored(item))], "canvas.json")))!.groups[0].items[0] as Item;

describe("the task bar as a kind", () => {
  it("sits under 功能 beside the reward track, so the palette offers it there", () => {
    expect(KIND_SPEC.taskBar.category).toBe("features");
    expect(KIND_ORDER).toContain("taskBar");
    const features = KIND_ORDER.filter((k) => KIND_SPEC[k].category === "features");
    expect(features).toContain("taskBar");
    /* 紧挨着奖励进度条：两个都是"一条任务/奖励"那一类东西 */
    expect(features[features.indexOf("taskBar") + 1]).toBe("rewardTrack");
  });

  it("is one part: title, reward cells and a claim button are its own fields", () => {
    const spec = KIND_SPEC.taskBar;
    expect(spec.hasLabel).toBe(true);
    /* 奖励图标没有可改的控件：两个格子永远画那个固定的默认图标（见 TASK_BAR_ICON），所以这一条
       不声明 hasIcon —— 面板里也就没有"奖励图标"那一行 */
    expect(spec.hasIcon).toBe(false);
    expect(spec.hasFill).toBe(true);
    expect(spec.hasSupporting).toBe(false);
    /* 条没有"整条换一套样式"这回事：底是 fill，格子和按钮各画各的（和物品格一样） */
    expect(spec.hasVariant).toBe(false);
    /* 奖励数量不再是这一条的属性：格子里画的是那个固定的常量（TASK_BAR_VALUE），所以这一条既不声明
       `hasValue`（没有"状态"滑杆那一行），也没有别的控件去改它 —— 存下来的 `value` 读进来就让掉 */
    expect(spec.hasValue).toBeFalsy();
    expect(hasStateRow({ kind: "taskBar" })).toBe(false);
    /* 那个 composite 自己的 388×112 里，一个刚放下的条是 380×112 */
    expect([spec.w, spec.h]).toEqual([380, TASK_BAR_H]);
    expect([spec.w, spec.h]).toEqual([380, 112]);
    expect(spec.radius).toBe(TASK_BAR_RADIUS);
    expect(spec.paletteIcon).toBe("checklist");
    /* 一个刚放下的条已经画得出来：按钮文字和两枚角标都带默认。奖励格的图标、格子的个数和格子里那个
       数量都不是字段，是那三个固定的常量（见 TASK_BAR_ICON / TASK_BAR_VALUE） */
    expect(spec.defIcon).toBeNull();
    expect(TASK_BAR_ICON).toBe("redeem");
    expect(TASK_BAR_VALUE).toBe(100);
    expect(spec.defLabel2).toBe("受け取る");
    expect(spec.defBadgeText).toBe("新");
    expect(spec.defBadge2Text).toBe("普通");
    expect(spec.defButtonBadgeText).toBe("1");
    /* a bar is tapped like the parts it absorbed */
    expect(TAPPABLE).toContain("taskBar");
  });

  it("stands its button in a slot that reserves room for the badge above it", () => {
    const m = taskBarMetrics(bar());
    /* 作者新设计里的那颗按钮是 120×40（composite 的 120×40，框在 124×48 的「按钮框」里） */
    expect([TASK_BAR_BTN_W, TASK_BAR_BTN_H]).toEqual([120, 40]);
    expect([m.button.w, m.button.h]).toEqual([120, 40]);
    /* 徽标探出按钮的那两个方向和两个数：右边 9dp、上面 4dp（作者设计里按钮框比按钮宽 4、徽标又在框
       的右上角，换算到按钮这一格就是这个数） */
    expect([TASK_BAR_BADGE_OVER_RIGHT, TASK_BAR_BADGE_OVER_TOP]).toEqual([9, 4]);
    expect([m.badge.overRight, m.badge.overTop]).toEqual([9, 4]);
    /* 药丸自己的高（作者设计里那枚 21×20 的高） */
    expect(TASK_BAR_BADGE_H).toBe(20);
    expect(m.badge.h).toBe(20);
    /* 按钮那一槽 = 按钮和徽标探出去那一截的并集：槽的右上角就是徽标的右上角，按钮落在槽的左下角。
       于是"盒子等于画出来的东西"这件事对那枚探出按钮的徽标也成立 —— 不需要为它开例外。 */
    expect([m.slot.w, m.slot.h]).toEqual([129, 44]);
    expect(m.slot.w).toBe(m.button.w + m.badge.overRight);
    expect(m.slot.h).toBe(m.button.h + m.badge.overTop);
    /* 槽比按钮大，但仍旧比格子矮：行高还是格子那 56，一条还是 112 高 */
    expect(m.slot.h).toBeLessThan(m.cell);
    expect(m.row).toBe(Math.max(m.cell, m.slot.h));
    expect(m.row).toBe(56);
    expect(m.h).toBe(112);
  });

  it("leaves the kinds it was modelled on alone", () => {
    /* 资产框、市场组件和主题那一摊一个字都没动：这里只加了一个 kind */
    expect(FILL_CUSTOM_KINDS).toEqual(["itemCell", "assetPill"]);
    expect(NO_AUTO_CLOSE_KINDS).toEqual(["itemCell", "assetPill"]);
    expect(KIND_SPEC.itemCell.hasVariant).toBe(false);
    expect(KIND_SPEC.button.hasVariant).toBe(true);
    expect(KIND_SPEC.fnButton.hasVariant).toBe(true);
  });

  it("is named in every offered language", () => {
    for (const { key } of LANGS) {
      const text = KIND_TEXT[key].taskBar;
      expect(text, key).toBeTruthy();
      for (const [field, value] of Object.entries(text)) expect(value.trim(), `${key}.${field}`).not.toBe("");
      /* 每种语言都有一句话说得清它是什么 */
      expect(KIND_TEXT[key].taskBar.noun.trim(), key).not.toBe("");
    }
    /* 作者要的中文名就在调色板上（调色板非英语一路读的就是 noun） */
    expect(KIND_TEXT.zh.taskBar.noun).toBe("任务信息条");
    expect(KIND_TEXT.en.taskBar.noun).toBe("task bar");
    expect(KIND_SPEC.taskBar.label).toBe("Task bar");
  });

  it("names every property it still offers in the inspector, in all four languages", () => {
    expect(t("barTitle", "zh")).toBe("标题");
    expect(t("barButton", "zh")).toBe("按钮文字");
    expect(t("barBadge", "zh")).toBe("按钮右上徽标");
    expect(t("barBadgeIcon", "zh")).toBe("徽标图标");
    expect(t("markRight", "zh")).toBe("右上徽标");
    expect(t("markLeft", "zh")).toBe("左上徽标");
    for (const { key } of LANGS) {
      for (const k of ["taskBarHint", "barTitle", "barButton", "barBadge", "barBadgeHint", "barBadgeIcon", "markRight", "taskMarkHint"] as const) {
        expect(t(k, key).trim(), `${k}.${key}`).not.toBe("");
      }
      /* 这两枚角标的话不是同一句，也不能和功能按钮那个"徽标"混起来（按钮自己的右徽标已经去掉了） */
      expect(t("markRight", key), key).not.toBe(t("markLeft", key));
      expect(t("barBadge", key), key).not.toBe(t("fnBadge", key));
      expect(t("barBadge", key), key).not.toBe(t("badge", key));
    }
  });

  /* 这一条已经不再有的那三个属性（奖励数量、奖励格的个数、奖励图标）：它们的名字跟着控件一起删掉了，
     两个字典里都不该再留 —— 韩语表和主表由 i18n.parity.test 对齐，这里再点名一遍。 */
  it("no longer names the amount, the count or the reward icon it lost", () => {
    for (const gone of ["rewardValue", "barCells", "barCellsHint", "rewardIcon", "barIcons"]) {
      expect(UI, gone).not.toHaveProperty(gone);
      expect((KO as Record<string, string | undefined>)[gone], gone).toBeUndefined();
    }
  });
});

describe("where 「改变文字」 lands on a task bar", () => {
  it("is the button's words, never the title", () => {
    /* 一条任务的标题说的是"这是哪一条任务"，不该跟着一次点按改；那两个字在领取按钮上 */
    const changed = lookItem(bar(), { id: "look", label: "已领取" });
    expect(changed.label2).toBe("已领取");
    expect(changed.label).toBe("每日登录游戏 (1/1)");
    /* 规则扣上来的一份外观补丁（预览里的 pinned look）走同一处 */
    const pinned = withLook(bar(), { label: "已领取", color: "primary" });
    expect(pinned.label2).toBe("已领取");
    expect(pinned.label).toBe("每日登录游戏 (1/1)");
    expect(pinned.color).toBe("primary");
  });

  it("leaves every other kind changing its own text", () => {
    const btn = makeItem("button");
    expect(lookItem(btn, { id: "look", label: "已领取" }).label).toBe("已领取");
    expect(withLook(btn, { label: "已领取" }).label).toBe("已领取");
    /* 别的字段照旧落在自己身上 */
    expect(withLook(btn, { label: "已领取", icon: "check" }).icon).toBe("check");
  });

  it("reads its words back from the same field, so a look is not applied twice", () => {
    expect(wordsKeyOf(bar())).toBe("label2");
    expect(wordsOf(bar())).toBe("领取");
    /* 没有按钮文字时读回空串，而不是标题：不然一个改文字的 look 会被当成"没变"而丢掉 */
    expect(wordsOf(bar({ label2: undefined }))).toBe("");
    expect(wordsKeyOf(makeItem("button"))).toBe("label");
    expect(wordsOf(makeItem("button"))).toBe(makeItem("button").label);
  });
});

/* 「置灰并停止响应」也一样：任务信息条上灰的是那颗按钮，不是整条（作者：「该组件按钮置灰并响应时，
   是针对按钮，而不是整个组件」）。画法见 M3Node 的 TaskBarContent 与 Preview 的 greyed —— 这里钉住
   范围判定本身。 */
describe("where 「置灰并停止响应」 lands on a task bar", () => {
  it("is the button, not the bar", () => {
    expect(disablesWholePart("taskBar")).toBe(false);
  });

  it("stays the whole part for every other kind", () => {
    expect(disablesWholePart("button")).toBe(true);
    expect(disablesWholePart("card")).toBe(true);
    expect(disablesWholePart("rewardTrack")).toBe(true);
    expect(disablesWholePart("itemCell")).toBe(true);
  });
});

describe("a freshly dropped task bar", () => {
  beforeEach(() => setGlobalLang("zh"));
  afterEach(() => setGlobalLang("ja"));

  it("is the composite, part for part — one part, no children", () => {
    const it = makeItem("taskBar");
    expect(it.label).toBe("每日登录游戏 (1/1)");
    /* 奖励格的图标、格子的个数和格子里那个数量都不是这一条的字段：画出来的是那三个固定的常量
       （见 TASK_BAR_ICON / TASK_BAR_VALUE），所以刚落下的一条不带图标、不带个数，也**不带 `value`** */
    expect(TASK_BAR_VALUE).toBe(100);
    expect(it.icon).toBeNull();
    expect(it).not.toHaveProperty("value");
    expect(it).not.toHaveProperty("cellCount");
    expect(it.label2).toBe("领取");
    expect(it.badge).toBe(true);
    expect(it.badgeText).toBe("新");
    expect(it.badge2).toBe(true);
    expect(it.badge2Text).toBe("普通");
    expect(it.badge2Color).toBe("#7BAE7A");
    expect(it.buttonBadge).toBe(true);
    expect(it.buttonBadgeText).toBe("1");
    expect(it.fill).toBe(TASK_BAR_FILL);
    expect(it.radiusTop).toBe(TASK_BAR_RADIUS);
    /* 它就是一条 380×112 的信息条：没有任何孩子 */
    expect(it.children).toBeUndefined();
    expect(it.size).toBe(380);
    expect(sizeOf(it, {})).toEqual({ w: 380, h: 112 });
  });

  it("writes those words in the author's own language", () => {
    setGlobalLang("en");
    const en = makeItem("taskBar");
    expect(en.label).toBe("Daily login (1/1)");
    expect(en.label2).toBe("Claim");
    expect(en.badgeText).toBe("New");
    expect(en.badge2Text).toBe("Common");
    expect(en.buttonBadgeText).toBe("1");
  });

  it("carries the fields the confirmed list names, and reuses the corner marks' own", () => {
    /* 按钮徽标才是新的；奖励格的个数、奖励图标和奖励数量都已经不是字段了，所以 `bar()` 里那个存下来的
       `value: 23` 读了也不算数（见下面"老文档"那一组） */
    const it = bar();
    expect(it).not.toHaveProperty("cellCount");
    expect(it).toHaveProperty("buttonBadge");
    expect(it).toHaveProperty("buttonBadgeText");
    /* 角标①是现成的那一对加上新的颜色，角标②三件套原样复用 */
    expect(it).toHaveProperty("badge");
    expect(it).toHaveProperty("badgeText");
    expect(badgeOn(it)).toBe(true);
    expect(badgeTextOf(it)).toBe("新");
    expect(badge2ColorOf(it)).toBe("#7BAE7A");
    expect(badgeColorOf(it)).toBeUndefined();
    expect(taskBarButtonBadge(it)).toBe("1");
  });
});

describe("the task bar's box", () => {
  it("follows its content: the title's line, the cell row and the part's own padding", () => {
    const m = taskBarMetrics(bar());
    expect(m.h).toBe(m.padTop + m.titleLine + m.gap + m.row + m.padBottom);
    expect(m.h).toBe(TASK_BAR_PAD_TOP + TASK_BAR_TITLE_LINE + TASK_BAR_GAP + TASK_BAR_CELL + TASK_BAR_PAD_BOTTOM);
    expect(m.h).toBe(TASK_BAR_H);
    expect(m.h).toBe(112);
    /* 格子那一行是格子和按钮里高的那个 —— 按钮再高也撑得住条 */
    expect(m.row).toBe(Math.max(m.cell, m.button.h));
    expect(m.row).toBe(Math.max(TASK_BAR_CELL, TASK_BAR_BTN_H));
    expect(m.row).toBe(56);
    /* 那个 composite 的几个数，逐个数出来 */
    expect([m.padX, m.padTop, m.padBottom, m.titleFont, m.titleLine, m.gap, m.cell, m.cellGap, m.button.w, m.button.h]).toEqual([13, 14, 10, 17, 22, 10, 56, 23, TASK_BAR_BTN_W, TASK_BAR_BTN_H]);
    expect([m.button.w, m.button.h]).toEqual([120, 40]);
    /* 按钮那一槽：129×44 —— 行留给"按钮 + 它右上角那枚徽标"的地方 */
    expect([m.slot.w, m.slot.h]).toEqual([129, 44]);
  });

  it("pins the box for the invariant two-cell row, whatever it carries", () => {
    /* 奖励格永远是两个：一条刚放下的条是 380×112，少一个格子、多一个格子这种事已经不存在了
       （数一数那个属性去掉了，见 taskBarMetrics 的 `cells`） */
    expect(taskBarMetrics(bar()).cells).toBe(2);
    expect(sizeOf(bar(), {})).toEqual({ w: 380, h: 112 });
    /* 长标题：一行省略号，不把条撑高 */
    expect(sizeOf(bar({ label: "一条特别特别长的任务标题".repeat(8) }), {})).toEqual({ w: 380, h: 112 });
    /* 空标题：标题那一行和它的缝一起不占地方 —— 另一个明确的数，不是魔法常量 */
    expect(taskBarMetrics(bar({ label: "" })).titleLine).toBe(0);
    expect(taskBarMetrics(bar({ label: "   " })).gap).toBe(0);
    expect(sizeOf(bar({ label: "" }), {})).toEqual({ w: 380, h: 80 });
    expect(sizeOf(bar({ label: "" }), {}).h).toBe(TASK_BAR_PAD_TOP + 0 + 0 + TASK_BAR_CELL + TASK_BAR_PAD_BOTTOM);
    /* 角标和按钮上的徽标挂不挂都不动盒子：它们是绝对定位的角上药丸（和物品格的两个角标同一个道理）；
       按钮上那枚如今是"槽里排在按钮后面的一层"，槽的尺寸只跟按钮和它探出的那一截有关，和徽标的内容
       一个字都没关系 —— 是字、是图标、多长的字，都是同一个盒子 */
    const flags = [
      { badge: true, badge2: true, buttonBadge: true },
      { badge: false, badge2: false, buttonBadge: false },
      { badge: true, badge2: false, buttonBadge: true },
      { badge: false, badge2: true, buttonBadge: false },
      { buttonBadge: true, buttonBadgeText: "" },
      { badge: true, badgeText: "" },
      { badge2: true, badge2Text: "很长的品质名" },
      { buttonBadgeIcon: "lock" },
      { buttonBadgeIcon: "lock", buttonBadgeText: "很长的徽标文字" },
      { buttonBadgeIcon: "lock_open", buttonBadgeText: "" },
    ] as Partial<Item>[];
    for (const patch of flags) {
      expect(sizeOf(bar(patch), {}), JSON.stringify(patch)).toEqual({ w: 380, h: 112 });
      expect(taskBarMetrics(bar(patch)).markH, JSON.stringify(patch)).toBe(taskBarMetrics(bar()).markH);
    }
    /* 作者钉的宽和高仍旧说了算 */
    expect(sizeOf(bar({ size: 388 }), {})).toEqual({ w: 388, h: 112 });
    expect(sizeOf(bar({ size2: 40 }), {})).toEqual({ w: 380, h: 40 });
    expect(sizeOf(bar({ size: 388 }), { [bar().id]: 999 })).toEqual({ w: 388, h: 112 });
    /* 条不是"量出来的"部件：宽度不是一个估出来的数 */
    expect(sizeOf(bar(), {}).w).toBe(KIND_SPEC.taskBar.w);
  });

  it("keeps the corner pills inside the cell's own 18%, never under 10dp", () => {
    expect(taskBarMetrics(bar()).markH).toBe(Math.max(10, Math.round(TASK_BAR_CELL * 0.18)));
    expect(taskBarMetrics(bar()).markH).toBe(10);
    /* 格子不大不小，药丸也就一直是那一枚 —— 两个格子都是同一枚 */
    expect(taskBarMetrics(bar()).cells).toBe(2);
    expect(taskBarMetrics(bar()).markH).toBe(10);
  });
});

/* 老文档里可能还写着"奖励数量"（`value`）、"画几个奖励格"（`cellCount`）和"奖励图标"（`icon`）：这三个
   属性已经去掉了，这一条永远画**固定**的 100、**两个**格子、每个格子画那个**固定**的默认奖励图标
   （见 TASK_BAR_VALUE / TASK_BAR_ICON）。存下来的值读进来就让掉 —— 部件一个都不丢、盒子一个数都不
   变，和方向盘那两个被去掉的字段同一条规矩。`value` 是别的种类（滑杆、进度条、奖励进度条……）在用的
   通用字段：这里删的只是任务信息条自己那一份，别的种类照旧读它（见这一组最后那一条）。 */
describe("a task bar from a document that still names the amount, the count or the reward icon", () => {
  it("lets the reward amount go, whichever value it holds, and always draws the fixed 100", () => {
    expect(TASK_BAR_VALUE).toBe(100);
    for (const stored of [1, 0, 100, 23, -5, 1.6, 99999, Number.NaN, Number.POSITIVE_INFINITY, "9", "23", true, false, {}, [], null] as never[]) {
      const odd = readItem({ ...bar(), value: stored });
      expect(odd, String(stored)).not.toBeNull();
      /* 不是字段就没有值：读回来一个都不留（画的是那个常量，见 M3Node 的 TaskBarContent） */
      expect(odd, String(stored)).not.toHaveProperty("value");
      expect(sizeOf(odd!, {}), String(stored)).toEqual({ w: 380, h: 112 });
    }
  });

  it("lets the count go, whichever value it holds, and keeps the two-cell box", () => {
    for (const stored of [1, 2, 0, 5, 1.6, 99, Number.NaN, Number.POSITIVE_INFINITY, "9", true, {}, [], null] as never[]) {
      const odd = readItem({ ...bar(), cellCount: stored });
      expect(odd, String(stored)).not.toBeNull();
      expect(odd, String(stored)).not.toHaveProperty("cellCount");
      expect(sizeOf(odd!, {}), String(stored)).toEqual({ w: 380, h: 112 });
      expect(taskBarMetrics(odd!).cells, String(stored)).toBe(2);
    }
  });

  it("lets the reward icon go, always drawing the fixed one instead", () => {
    for (const stored of ["eco", "paid", "", 5, true, {}, [], null] as never[]) {
      const odd = readItem({ ...bar(), icon: stored });
      expect(odd, String(stored)).not.toBeNull();
      /* 不是字段就没有值：读回来是空的，画的是那个常量 */
      expect(odd!.icon, String(stored)).toBeNull();
      expect(TASK_BAR_ICON).toBe("redeem");
      expect(sizeOf(odd!, {}), String(stored)).toEqual({ w: 380, h: 112 });
    }
  });

  it("keeps the part and the whole document when a stored amount is garbage", () => {
    const doc = readDoc(JSON.parse(JSON.stringify(stored({ ...bar(), value: "9", cellCount: "9", icon: "eco" } as unknown as Item))))!;
    const back = doc.groups[0].items[0] as Item;
    expect(back.kind).toBe("taskBar");
    expect(back).not.toHaveProperty("value");
    expect(back).not.toHaveProperty("cellCount");
    expect(back.icon).toBeNull();
    /* 别的字段一个都没少，这一条和这一屏都还在 */
    expect(back).toMatchObject({ label: "每日登录游戏 (1/1)", label2: "领取", badge: true, badgeText: "新", badge2: true, badge2Text: "普通" });
    expect(doc.groups).toHaveLength(1);
    expect(sizeOf(back, {})).toEqual({ w: 380, h: 112 });
    expect(taskBarMetrics(back).cells).toBe(2);
  });

  it("leaves every other kind's own `value` alone — the field is still read for them", () => {
    /* 这一次让掉的只是任务信息条自己那一份：滑杆、奖励进度条这些种类照旧把 `value` 读回来 */
    const slider = readItem({ ...makeItem("slider"), value: 0 })!;
    expect(slider.value).toBe(0);
    const track = readItem({ ...makeItem("rewardTrack"), value: 45 })!;
    expect(track.value).toBe(45);
    /* 一个写在 `value` 位上的字符串照旧读不出来（对谁都是这条规矩），但部件都在 */
    expect(readItem({ ...makeItem("slider"), value: "23" as never })!.value).toBeUndefined();
    expect(readItem({ ...bar(), value: "23" as never })).not.toBeNull();
  });
});

/* 徽标里那个图标：作者要的"徽标也可以是图标"，走的是别处一样的那个图标槽（奖励格那个图标已经没有
   可改的槽了，所以这是这一条仅剩的一个）。一枚药丸只说一件事，所以图标在时字就不画了 —— 判定只写在
   这里（见 taskBarButtonBadgeOn）。 */
describe("the icon in the button's badge", () => {
  it("is the only slot the kind still offers, chosen with the picker every other icon uses", () => {
    const slots = iconSlotsOf(bar());
    /* 奖励图标不再是一个槽：格子里画的是那个固定的常量，所以这一条只剩徽标这个槽 */
    expect(slots.map((s) => s.key)).toEqual(["buttonBadgeIcon"]);
    expect(slots[0].label).toBe(t("barBadgeIcon"));
    expect(slots[0].value).toBeNull();
    /* 写进去、再清掉：走的就是通用的 setIconSlot，字段是 buttonBadgeIcon */
    expect(setIconSlot(bar(), "buttonBadgeIcon", "lock")).toEqual({ buttonBadgeIcon: "lock" });
    expect(setIconSlot(bar({ buttonBadgeIcon: "lock" }), "buttonBadgeIcon", null)).toEqual({ buttonBadgeIcon: null });
    /* 它不碰那两个字，也不碰开关：图标是内容，开关管的是字 */
    expect(setIconSlot(bar({ buttonBadgeText: "9", buttonBadge: true }), "buttonBadgeIcon", "lock")).toEqual({ buttonBadgeIcon: "lock" });
    expect(iconSlotsOf(bar({ buttonBadgeIcon: "lock" }))[0].value).toBe("lock");
  });

  it("is what the badge says when it is set, the words giving way", () => {
    expect(taskBarButtonBadgeIcon(bar({ buttonBadgeIcon: "lock" }))).toBe("lock");
    /* 空字、没写、存坏了的都不是图标 */
    expect(taskBarButtonBadgeIcon(bar({ buttonBadgeIcon: "" }))).toBeNull();
    expect(taskBarButtonBadgeIcon(bar({ buttonBadgeIcon: "   " }))).toBeNull();
    expect(taskBarButtonBadgeIcon(bar())).toBeNull();
    /* 图标有自己的内容就够画了，不必等那个开关（开关管的是字） */
    const iconOnly = bar({ buttonBadge: undefined, buttonBadgeText: undefined, buttonBadgeIcon: "lock" });
    expect(taskBarButtonBadgeOn(iconOnly)).toBe(true);
    /* 两个都写着：徽标说的是图标（图标优先） */
    const both = bar({ buttonBadge: true, buttonBadgeText: "9", buttonBadgeIcon: "lock" });
    expect(taskBarButtonBadgeIcon(both)).toBe("lock");
    expect(taskBarButtonBadge(both)).toBe("9");
    expect(taskBarButtonBadgeOn(both)).toBe(true);
    /* 一个字都没有、也没有图标：没有徽标 */
    expect(taskBarButtonBadgeOn(bar({ buttonBadge: false, buttonBadgeText: undefined }))).toBe(false);
    expect(taskBarButtonBadgeOn(bar({ buttonBadge: true, buttonBadgeText: "  " }))).toBe(false);
  });

  it("is read back and written down like any other icon name", () => {
    expect(readItem({ ...bar(), buttonBadgeIcon: "lock" })!.buttonBadgeIcon).toBe("lock");
    /* 清空的槽写成 null，读回来就等于没有 */
    expect(readItem({ ...bar(), buttonBadgeIcon: null })).not.toHaveProperty("buttonBadgeIcon");
    for (const bad of [5, true, {}, []] as never[]) {
      const odd = readItem({ ...bar(), buttonBadgeIcon: bad });
      expect(odd, String(bad)).not.toBeNull();
      expect(odd, String(bad)).not.toHaveProperty("buttonBadgeIcon");
      expect(taskBarButtonLocked(odd!), String(bad)).toBe(false);
    }
  });
});

/* 作者的原话：「当出现这个锁的图标时，该按钮点击时，禁止响应」。这是语义不是图案，所以只有这一处判定
   （见 taskBarButtonLocked），绘制、编辑器的按下和预览的点击路径都问它。 */
describe("the button the lock icon closes", () => {
  it("is locked by the lock icon and by nothing else", () => {
    expect(TASK_BAR_LOCK_ICON).toBe("lock");
    expect(taskBarButtonLocked(bar({ buttonBadgeIcon: "lock" }))).toBe(true);
    /* 别的图标不是锁：一样是画在按钮右上角的徽标，语义不同 */
    expect(taskBarButtonLocked(bar({ buttonBadgeIcon: "lock_open" }))).toBe(false);
    expect(taskBarButtonLocked(bar({ buttonBadgeIcon: "key" }))).toBe(false);
    expect(taskBarButtonLocked(bar())).toBe(false);
    expect(taskBarButtonLocked(bar({ buttonBadgeIcon: "" }))).toBe(false);
    /* 字里写着 lock 不算：锁是那枚图标的语义，不是一句提示词 */
    expect(taskBarButtonLocked(bar({ buttonBadge: true, buttonBadgeText: "lock" }))).toBe(false);
    /* 别的种类领着同一个字段也不锁（这条规矩只属于任务信息条） */
    expect(taskBarButtonLocked({ kind: "button", buttonBadgeIcon: "lock" })).toBe(false);
    expect(taskBarButtonLocked({ kind: "itemCell", buttonBadgeIcon: "lock" })).toBe(false);
    /* 图标优先：写着字的锁也是锁 —— 画出来的是锁，那它就必须真的锁 */
    expect(taskBarButtonLocked(bar({ buttonBadge: true, buttonBadgeText: "9", buttonBadgeIcon: "lock" }))).toBe(true);
  });

  it("keeps the box exactly where a bar without a lock keeps it", () => {
    expect(sizeOf(bar({ buttonBadgeIcon: "lock" }), {})).toEqual(sizeOf(bar(), {}));
    expect(sizeOf(bar({ buttonBadgeIcon: "lock" }), {})).toEqual({ w: 380, h: 112 });
    const m = taskBarMetrics(bar({ buttonBadgeIcon: "lock" }));
    expect(m.slot).toEqual(taskBarMetrics(bar()).slot);
  });
});

describe("a task bar through save and load", () => {
  it("keeps every field it was written with", () => {
    const it = bar({ badgeColor: "#123456", buttonBadgeText: "9", size: 388 });
    expect(isPlacedItem(it)).toBe(true);
    const back = roundTrip(it);
    expect(back).toMatchObject({
      kind: "taskBar",
      label: "每日登录游戏 (1/1)",
      label2: "领取",
      badge: true,
      badgeText: "新",
      badgeColor: "#123456",
      badge2: true,
      badge2Text: "普通",
      badge2Color: "#7BAE7A",
      buttonBadge: true,
      buttonBadgeText: "9",
      size: 388,
    });
    /* 写下去的那个 `value: 23` 不是这一条的字段：读回来就没有了（画的是固定的 100） */
    expect(back).not.toHaveProperty("value");
    expect(sizeOf(back, {})).toEqual({ w: 388, h: 112 });
    expect(taskBarButtonBadge(back)).toBe("9");
    expect(badgeColorOf(back)).toBe("#123456");
  });

  it("comes back through 「打开项目」 the same way (readProject)", async () => {
    const back = await saved(bar({ badgeColor: "#123456", buttonBadgeText: "9" }));
    expect(back).toMatchObject({ kind: "taskBar", badgeColor: "#123456", buttonBadgeText: "9" });
    expect(sizeOf(back, {})).toEqual({ w: 380, h: 112 });
    /* 关掉的东西读回来还是关着的：读的人不会替谁补默认（默认只属于新落下的部件） */
    const off = await saved(bar({ badge: undefined, badge2: undefined, buttonBadge: undefined }));
    expect(off).not.toHaveProperty("badge");
    expect(off).not.toHaveProperty("badge2");
    expect(off).not.toHaveProperty("buttonBadge");
    expect(off).not.toHaveProperty("cellCount");
    /* 两个奖励格、那个固定的奖励图标和那个固定的 100 都是画法，不是读回来的字段 */
    expect(taskBarMetrics(off).cells).toBe(2);
    expect(off.icon).toBeNull();
    expect(off).not.toHaveProperty("value");
    expect(taskBarButtonBadge(off)).toBeNull();
  });
});

describe("a task bar the document cannot read", () => {
  it("lets a colour it cannot read go, and keeps the one it can", () => {
    expect(readItem({ ...bar(), badgeColor: "#7BAE7A" })!.badgeColor).toBe("#7BAE7A");
    expect(readItem({ ...bar(), badgeColor: "primary" })!.badgeColor).toBe("primary");
    for (const bad of ["notAThing", "rgb(1,2,3)", 5, true, {}, []] as never[]) {
      const odd = readItem({ ...bar(), badgeColor: bad });
      expect(odd, String(bad)).not.toBeNull();
      expect(odd).not.toHaveProperty("badgeColor");
      expect(badgeColorOf(odd!)).toBeUndefined();
      /* 角标本身还在：坏的是一个颜色，不是那枚角标 */
      expect(badgeOn(odd!)).toBe(true);
      expect(sizeOf(odd!, {})).toEqual({ w: 380, h: 112 });
    }
  });

  it("reads the button's badge pair by the same rules as every other flag and word", () => {
    /* 开关：不是开关就不算开 */
    for (const bad of ["yes", 1, {}, []] as never[]) {
      const odd = readItem({ ...bar(), buttonBadge: bad });
      expect(odd, String(bad)).not.toBeNull();
      expect(odd).not.toHaveProperty("buttonBadge");
      expect(taskBarButtonBadge(odd!), String(bad)).toBeNull();
    }
    expect(readItem({ ...bar(), buttonBadge: false, buttonBadgeText: "9" })!.buttonBadge).toBe(false);
    /* 字：读不出来的就让掉（等于没有徽标），一个写在字位上的数字读成它表示的文字 */
    for (const bad of [{}, [], true, null] as never[]) {
      const odd = readItem({ ...bar(), buttonBadgeText: bad });
      expect(odd, String(bad)).not.toBeNull();
      expect(odd).not.toHaveProperty("buttonBadgeText");
      expect(taskBarButtonBadge(odd!), String(bad)).toBeNull();
    }
    const numeric = readItem({ ...bar(), buttonBadgeText: 9 })!;
    expect(numeric.buttonBadgeText).toBe("9");
    expect(taskBarButtonBadge(numeric)).toBe("9");
    /* 空字、只有空格的字：没有字的药丸什么也不说明，所以算没有徽标 */
    expect(taskBarButtonBadge({ buttonBadge: true, buttonBadgeText: "" })).toBeNull();
    expect(taskBarButtonBadge({ buttonBadge: true, buttonBadgeText: "  " })).toBeNull();
    expect(taskBarButtonBadge({ buttonBadgeText: "1" })).toBeNull();
  });

  it("lets the reward amount go by the same rules as the count and the icon, and never loses the screen", () => {
    /* 存下来的数量（读得出来的、读不出来的都一样）一律让掉：画的永远是那个固定的 100 */
    for (const stored of [0, 99999, -5, "23", null, true, {}, []] as never[]) {
      const odd = readItem({ ...bar(), value: stored });
      expect(odd, String(stored)).not.toBeNull();
      expect(odd, String(stored)).not.toHaveProperty("value");
      expect(odd!.kind, String(stored)).toBe("taskBar");
      expect(sizeOf(odd!, {}), String(stored)).toEqual({ w: 380, h: 112 });
    }
    /* 一整份文档：坏字段和那几个已经不在的属性都被让掉，别的字段和这一条都在，盒子还是那个盒子 */
    const doc = readDoc(JSON.parse(JSON.stringify(stored({ ...bar(), value: 0, cellCount: 99, icon: "eco", badgeColor: {}, buttonBadgeText: [] } as unknown as Item))))!;
    const back = doc.groups[0].items[0] as Item;
    expect(back).toMatchObject({ kind: "taskBar", label: "每日登录游戏 (1/1)", label2: "领取", badge: true, badgeText: "新", badge2: true, badge2Text: "普通" });
    expect(back).not.toHaveProperty("value");
    expect(back).not.toHaveProperty("cellCount");
    expect(back.icon).toBeNull();
    expect(back).not.toHaveProperty("badgeColor");
    expect(back).not.toHaveProperty("buttonBadgeText");
    expect(sizeOf(back, {})).toEqual({ w: 380, h: 112 });
    expect(doc.groups).toHaveLength(1);
  });
});

describe("a task bar in the prompt", () => {
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
  /* 这一条在提示里说的那一行 —— 整篇提示别的地方也有"新/最新版"这样的字，所以只在这一行上断言 */
  const NOUN: Record<string, string> = { ja: "タスク情報バー", en: "task bar", zh: "任务信息条", ko: "태스크 정보 바" };
  const barLine = (item: Item, lang: (typeof LANGS)[number]["key"]) =>
    buildPrompt(doc(item), {}, undefined, lang)
      .split("\n")
      .find((l) => l.includes(NOUN[lang])) ?? "";

  it("tells the coding agent what the bar is made of, in every language", () => {
    const said: Record<string, string[]> = {
      ja: ["タスク情報バー", "報酬マス 2 個", `${TASK_BAR_ICON} アイコンと数量 ${TASK_BAR_VALUE}`, "左上のバッジ", "右上のバッジ", "「领取」", "「1」のバッジ"],
      en: ["task bar", "2 reward cells", `the fixed ${TASK_BAR_ICON} icon`, `fixed amount ${TASK_BAR_VALUE}`, "top-left badge", "top-right badge", '"领取"', 'a "1" badge at its top right'],
      zh: ["任务信息条", "奖励格 2 个", `固定的 ${TASK_BAR_ICON} 图标`, `固定的数量 ${TASK_BAR_VALUE}`, "左上角标", "右上角标", "“领取”", "“1” 徽标"],
      ko: ["태스크 정보 바", "보상 칸 2개", `고정 ${TASK_BAR_ICON} 아이콘`, `고정 수량 ${TASK_BAR_VALUE}`, "왼쪽 위 배지", "오른쪽 위 배지", '"领取"', '"1" 배지'],
    };
    for (const { key } of LANGS) {
      const line = barLine(bar(), key);
      expect(line, key).not.toBe("");
      /* 格子数说的是那两个、图标说的是那个**固定**的默认图标、数量说的是那个**固定**的 100（三个属性
         都已经没了）—— 提示里要说得出来，不然画这一条的人不知道格子里画的是什么 */
      for (const words of said[key]) expect(line, `${key}: ${words}`).toContain(words);
      /* 现在的条没有"一个格子"这种画法，也没有"另一数量"这种画法：同一个部件写什么字段，提示里都是
         那两个格子、那个图标和那个 100 */
      expect(barLine(bar({ cellCount: 1 } as never), key), key).toBe(line);
      expect(barLine(bar({ value: 999 } as never), key), key).toBe(line);
      expect(barLine(bar({ value: undefined } as never), key), key).toBe(line);
    }
  });

  it("says the tap belongs to the button, not to the bar around it", () => {
    /* 融合部件里只有那颗按钮响应点击 —— 这条语义（见 Preview 的 PartPressContext）不写进提示，
       照着提示画这一条的人很容易把整条都接上点击（作者报的「点击相当于是点击整个容器」）。 */
    const said: Record<string, string> = {
      ja: "タップに反応するのはそのボタンだけ",
      en: "Only that button answers a tap",
      zh: "只有这颗按钮响应点击",
      ko: "탭에 반응하는 것은 그 버튼뿐입니다",
    };
    for (const { key } of LANGS) expect(barLine(bar(), key), key).toContain(said[key]);
  });

  it("says a look changes the button's words, in every language", () => {
    /* 「改变文字」这类外观落在按钮上（见 wordsKeyOf）：提示得说"按钮文字"，不然照着写代码的人会去改标题 */
    const said: Record<string, string> = {
      ja: "ボタンの文字は",
      en: "the button's words read",
      zh: "按钮文字为",
      ko: "버튼 글자는",
    };
    const withFlow = bar({
      flow: { looks: [{ id: "l2", label: "已领取" }], steps: [{ id: "s1", from: ":start", to: "l2", trigger: { kind: "tap" } }] },
    } as never);
    for (const { key } of LANGS) expect(buildPrompt(doc(withFlow), {}, undefined, key), key).toContain(said[key]);
  });

  it("says nothing about a mark or a badge that is switched off", () => {
    const off = bar({ badge: undefined, badgeText: undefined, badge2: undefined, badge2Text: undefined, buttonBadge: undefined, buttonBadgeText: undefined });
    const none: Record<string, string> = { ja: "左上のバッジ なし", en: "top-left badge none", zh: "左上角标 无", ko: "왼쪽 위 배지 없음" };
    for (const { key } of LANGS) {
      const line = barLine(off, key);
      expect(line, key).toContain(none[key]);
      /* 关掉的徽标一个字都不提 */
      expect(line, key).not.toContain("新");
      expect(line, key).not.toContain("普通");
      /* 也不说它是个容器：这一条没有孩子，提示里就不该有"中に重ねて/inside/里面"这种话 */
      expect(line, key).not.toContain("ボタン（右上に");
    }
  });

  it("spells out that the badge is a layer above the button and may hang outside it", () => {
    /* 画这一条的人必须知道那枚徽标压在按钮的上层、可以在按钮外面 —— 不然很容易又把它塞回按钮里面、
       被按钮自己的 overflow: hidden 裁掉。所以那一句话在，而且说的是"上层/above/重なり/위층"。 */
    const layer: Record<string, string> = { ja: "ボタンの上に重なり", en: "on a layer above the button", zh: "压在按钮的上层", ko: "버튼 위층에 겹치고" };
    const outside: Record<string, string> = { ja: "はみ出していてもよい", en: "free to sit outside its box", zh: "可以探出按钮的框", ko: "버튼 밖으로 나가도 됨" };
    for (const { key } of LANGS) {
      const line = barLine(bar(), key);
      expect(line, key).toContain(layer[key]);
      expect(line, key).toContain(outside[key]);
    }
    /* 徽标整个没挂（开关关着、也没有图标）时，这两句话一个字都不该出现：没有徽标就没有"上层"可言 */
    const none = bar({ buttonBadge: undefined, buttonBadgeText: undefined, buttonBadgeIcon: undefined });
    for (const { key } of LANGS) {
      const line = barLine(none, key);
      expect(line, key).not.toContain(layer[key]);
      expect(line, key).not.toContain(outside[key]);
    }
  });

  it("says the icon when the badge holds one, and says the button is closed when it is the lock", () => {
    /* 说的是那枚图标，不是那两个字（图标优先，和画出来的一致） */
    const icon = bar({ buttonBadgeIcon: "notifications", buttonBadgeText: "9" });
    for (const { key } of LANGS) {
      const line = barLine(icon, key);
      expect(line, key).toContain("notifications");
      expect(line, key).not.toContain("9");
    }
    /* 锁：说的是点它没有任何反应（不然提示里的按钮还是一颗能点的按钮） */
    const closed: Record<string, string> = { ja: "ロック中なのでタップしても何も起きない", en: "it is locked, so a tap does nothing", zh: "锁住时点击不会有任何反应", ko: "잠겨 있어 탭해도 아무 반응 없음" };
    for (const { key } of LANGS) {
      const line = barLine(bar({ buttonBadgeIcon: "lock", size: 388 }), key);
      expect(line, key).toContain("lock");
      expect(line, key).toContain(closed[key]);
    }
  });
});

/* 交出去的那份参考文件（docs/reference-prototypes/task-bar-component.single-part.json）：这一轮的成果。
   它是**一个部件**（没有孩子），带着作者新给的内容 —— 标题、两个格子那套角标、120×40 的按钮和它右上
   角那枚写着「3」的徽标；那个 388×112 的组合件不再作为 customPart 留着，老的「任务信息」308×92 原样
   还在。文件本身要读得进来（readDoc）也要装得上画布（readProject，「打开项目」走的就是它）。 */
describe("the delivered task bar reference file", () => {
  const file = resolve(process.cwd(), "docs/reference-prototypes/task-bar-component.single-part.json");
  const raw = () => JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const barsOf = (doc: { groups: { items: Item[] }[] }) => doc.groups.flatMap((g) => g.items).filter((it) => it.kind === "taskBar");

  it("reads as one part carrying the author's new content", () => {
    const doc = readDoc(raw());
    expect(doc).not.toBeNull();
    const bars = barsOf(doc!);
    expect(bars).toHaveLength(1);
    const it = bars[0];
    expect(it.children).toBeUndefined();
    expect(it).toMatchObject({
      kind: "taskBar",
      name: "任务信息条",
      label: "每日登录游戏   (1/1)",
      label2: "领取",
      badge: true,
      badgeText: "新",
      badge2: true,
      badge2Text: "普通",
      badge2Color: "#7BAE7A",
      buttonBadge: true,
      buttonBadgeText: "3",
      fill: "surfaceContainerLow",
      radiusTop: 16,
      size: 388,
    });
    /* 交出去的这份里已经不再写奖励数量、奖励格的个数，也不再写奖励图标：那个固定的 100、两个格子加
       那个固定图标就是画法（见 TASK_BAR_VALUE / TASK_BAR_ICON），文件里一个字段都不留 */
    expect(it).not.toHaveProperty("value");
    expect(it).not.toHaveProperty("cellCount");
    expect(it.icon).toBeNull();
    /* 徽标是那两个字"3"（作者这一版给的是字，不是图标）：没有图标，也就没有锁，按钮照常能点 */
    expect(taskBarButtonBadge(it)).toBe("3");
    expect(taskBarButtonBadgeIcon(it)).toBeNull();
    expect(taskBarButtonLocked(it)).toBe(false);
    /* 那个组合件不再留着；老的「任务信息」和别的六个原样都在 */
    const names = (doc!.customParts ?? []).map((c) => c.name);
    expect(names).not.toContain("任务信息条");
    expect(names).toContain("任务信息");
    expect(names).toHaveLength(7);
    expect(sizeOf(it, {})).toEqual({ w: 388, h: 112 });
    /* 这一条就是重画出来的那一版：按钮 120×40 站在给徽标留了地方的槽里 */
    expect(taskBarMetrics(it).button).toEqual({ w: 120, h: 40 });
    expect(taskBarMetrics(it).slot).toEqual({ w: 129, h: 44 });
  });

  it("loads through 「打开项目」 (readProject) the same way", async () => {
    const back = await readProject(new File([JSON.stringify(raw())], "canvas.json"));
    expect(back).not.toBeNull();
    const it = barsOf(back!)[0];
    expect(it.kind).toBe("taskBar");
    expect(it.children).toBeUndefined();
    expect(taskBarButtonBadge(it)).toBe("3");
    expect(sizeOf(it, {})).toEqual({ w: 388, h: 112 });
  });
});

