import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KIND_TEXT, KO, LANGS, UI, setGlobalLang, t } from "./i18n";
import { isPlacedItem, readDoc, readItem, readProject } from "./project";
import { buildPrompt } from "./prompt";
import {
  CONFIRM_BOX_BODY_MIN_H,
  CONFIRM_BOX_BTN_H,
  CONFIRM_BOX_BTN_W,
  CONFIRM_BOX_BUTTONS,
  CONFIRM_BOX_CANCEL_SLOT,
  CONFIRM_BOX_FILL,
  CONFIRM_BOX_H,
  CONFIRM_BOX_HIDE_STEP,
  CONFIRM_BOX_MAIN,
  CONFIRM_BOX_PAD_BOTTOM,
  CONFIRM_BOX_PAD_TOP,
  CONFIRM_BOX_PAD_X,
  CONFIRM_BOX_RADIUS,
  CONFIRM_BOX_TITLE_LINE,
  CONFIRM_BOX_W,
  KIND_ORDER,
  KIND_SPEC,
  TAPPABLE,
  actionSlotsOf,
  confirmBoxButtonWords,
  confirmBoxMainWords,
  confirmBoxMetrics,
  disablesWholePart,
  hasStateRow,
  hasTimedSteps,
  iconSlotsOf,
  makeItem,
  sizeOf,
  tapLivesInside,
  withLook,
  wordsKeyOf,
  wordsOf,
  wrapTextLines,
  type Item,
} from "./tokens";

/* 确认框（「确认框」）是第二个**融合部件**：作者在「上传屏幕2」里手摆的那一版原稿
 * （docs/reference-prototypes/confirm-box-component.json，交接说明见同目录的 confirm-box.md）被融成
 * 一个部件 —— 标题、正文和两颗普通按钮都是它自己的字段，不是它的孩子。这一份测试按任务信息条那一份
 * （lib/taskBar.test.ts）的路子写：一个部件的每一块都在数据里，所以不必碰 DOM 就能断言。 */

/* 一个刚放下的确认框，用作者原稿那几句话（写死，和语言无关）。 */
const box = (patch: Partial<Item> = {}) =>
  ({
    ...makeItem("confirmBox"),
    label: "温馨提示",
    supporting: "确认当前操作？",
    label2: "确认",
    label3: "取消",
    ...patch,
  }) as Item;

const stored = (item: Item) => ({ groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [item] }], frames: [] });
const roundTrip = (item: Item) => readDoc(JSON.parse(JSON.stringify(stored(item))))!.groups[0].items[0] as Item;
const saved = async (item: Item) =>
  (await readProject(new File([JSON.stringify(stored(item))], "canvas.json")))!.groups[0].items[0] as Item;

describe("the confirm box as a kind", () => {
  it("sits in 容器, right after the dialog", () => {
    expect(KIND_SPEC.confirmBox.category).toBe("containment");
    expect(KIND_ORDER).toContain("confirmBox");
    /* 挨着「对话框」：都是"问一句"的那一类（作者的要求，见 confirm-box.md） */
    expect(KIND_ORDER.indexOf("confirmBox")).toBe(KIND_ORDER.indexOf("dialog") + 1);
    expect(KIND_ORDER.filter((k) => KIND_SPEC[k].category === "containment")).toContain("confirmBox");
  });

  it("says what it is made of, and what it is not", () => {
    const spec = KIND_SPEC.confirmBox;
    /* 标题、正文和两颗按钮都是它自己的字段 —— 所以这三样都要有，而图标一样都没有 */
    expect(spec.hasLabel).toBe(true);
    expect(spec.hasSupporting).toBe(true);
    expect(spec.hasIcon).toBe(false);
    expect(spec.hasFill).toBe(true);
    /* 框的样子是它的 fill，没有"整块换一套样式"这回事（和任务信息条、物品格同一条规矩） */
    expect(spec.hasVariant).toBe(false);
    expect(spec.hasValue).toBeFalsy();
    /* 状态那一节讲的是"选中/数值/波浪/包含/滚动"，确认框一样都没有 */
    expect(hasStateRow({ kind: "confirmBox" })).toBe(false);
    expect(iconSlotsOf(box())).toEqual([]);
    expect([spec.w, spec.h]).toEqual([CONFIRM_BOX_W, CONFIRM_BOX_H]);
    expect([spec.w, spec.h]).toEqual([320, 200]);
    expect(spec.radius).toBe(CONFIRM_BOX_RADIUS);
    expect(spec.radius).toBe(28);
    expect(spec.paletteIcon).toBe("fact_check");
    expect(spec.defIcon).toBeNull();
    /* 两颗按钮的默认字：确认是 label2，取消是 label3 */
    expect(spec.defLabel2).toBe("確認");
    expect(spec.defLabel3).toBe("キャンセル");
    /* 融合部件：整块不吃点击，里面那两颗吃（见 tapLivesInside） */
    expect(TAPPABLE).toContain("confirmBox");
  });

  it("measures what it draws: 320×200, two 104×49 buttons, a 280×72 body strip", () => {
    const m = confirmBoxMetrics(box());
    expect([CONFIRM_BOX_W, CONFIRM_BOX_H]).toEqual([320, 200]);
    expect([CONFIRM_BOX_BTN_W, CONFIRM_BOX_BTN_H]).toEqual([104, 49]);
    expect(CONFIRM_BOX_BODY_MIN_H).toBe(72);
    expect([m.padX, m.padTop, m.padBottom, m.titleLine, m.gap]).toEqual([20, 14, 21, 24, 10]);
    expect([CONFIRM_BOX_PAD_X, CONFIRM_BOX_PAD_TOP, CONFIRM_BOX_PAD_BOTTOM]).toEqual([20, 14, 21]);
    expect(CONFIRM_BOX_TITLE_LINE).toBe(24);
    /* 正文带就是左右留白量出来的那一块：320 − 2×20 = 280；正文左对齐，带内左 25、上 10 */
    expect([m.band.w, m.band.h]).toEqual([280, 72]);
    expect([m.bodyPadLeft, m.bodyPadTop]).toEqual([25, 10]);
    expect([m.bodyFont, m.bodyLine]).toEqual([18, 26]);
    expect(m.button).toEqual({ w: 104, h: 49 });
    expect(m.titleFont).toBe(20);
    /* 一行的正文就是作者原稿那一档：200 = 14+24+10+72+10+49+21 */
    expect(m.h).toBe(200);
    expect(m.h).toBe(CONFIRM_BOX_H);
  });

  it("knows which button is which: cancel on the left, confirm on the right", () => {
    expect(CONFIRM_BOX_MAIN).toBe("");
    expect(CONFIRM_BOX_CANCEL_SLOT).toBe("cancel");
    expect(CONFIRM_BOX_BUTTONS.map((b) => [b.slot, b.field, b.where])).toEqual([
      ["cancel", "label3", "left"],
      ["", "label2", "right"],
    ]);
    const it0 = box();
    expect(confirmBoxButtonWords(it0, CONFIRM_BOX_MAIN)).toBe("确认");
    expect(confirmBoxButtonWords(it0, CONFIRM_BOX_CANCEL_SLOT)).toBe("取消");
    expect(confirmBoxMainWords(it0)).toBe("确认");
    /* 空白算没有字（画出来就是一颗空按钮，不该留一串空格） */
    expect(confirmBoxButtonWords(box({ label3: "   " }), CONFIRM_BOX_CANCEL_SLOT)).toBe("");
    expect(confirmBoxMainWords(box({ label2: undefined }))).toBe("");
    /* 去掉按钮的字不动另一颗、也不动标题与正文 */
    expect(box({ label2: "确定" }).label3).toBe("取消");
  });

  it("is named in every language", () => {
    for (const { key } of LANGS) {
      const text = KIND_TEXT[key].confirmBox;
      expect(text, key).toBeTruthy();
      for (const [field, value] of Object.entries(text)) expect(value, `${key}.${field}`).toBeTruthy();
    }
    expect(KIND_TEXT.zh.confirmBox).toMatchObject({ noun: "确认框", label: "温馨提示", supporting: "确认当前操作？", label2: "确认", label3: "取消" });
    expect(KIND_TEXT.en.confirmBox.noun).toBe("confirm box");
    expect(KIND_SPEC.confirmBox.label).toBe("Confirm box");
  });

  it("names the inspector's rows in every language", () => {
    expect(t("barTitle", "zh")).toBe("标题");
    expect(t("barButton", "zh")).toBe("按钮文字");
    expect(t("confirmButton", "zh")).toBe("确认按钮文字");
    expect(t("cancelButton", "zh")).toBe("取消按钮文字");
    /* 两颗按钮的名字不一样：不然作者分不出哪一行配哪一颗 */
    expect(t("confirmButton", "zh")).not.toBe(t("cancelButton", "zh"));
    for (const { key } of LANGS) {
      for (const k of ["confirmBoxHint", "barTitle", "barButton", "confirmButton", "cancelButton"]) {
        expect(t(k as never, key), `${key}.${k}`).toBeTruthy();
      }
    }
  });

  it("leaves the kinds it was modelled on alone", () => {
    /* 对话框还是对话框：312×220、带图标、带正文 */
    expect([KIND_SPEC.dialog.w, KIND_SPEC.dialog.h, KIND_SPEC.dialog.radius]).toEqual([312, 220, 28]);
    expect(KIND_SPEC.dialog.hasIcon).toBe(true);
    expect(KIND_SPEC.dialog.hasLabel).toBe(true);
    expect(KIND_SPEC.dialog.hasSupporting).toBe(true);
    /* 任务信息条那一套一点没动 */
    expect(KIND_SPEC.taskBar.category).toBe("features");
    expect(disablesWholePart("taskBar")).toBe(false);
  });
});

describe("where 「改变文字」 lands on a confirm box", () => {
  it("changes the confirm button's words, not the title", () => {
    const changed = withLook(box(), { label: "已确认" });
    expect(changed.label2).toBe("已确认");
    expect(changed.label).toBe("温馨提示");
    /* 取消那颗一个字都不动：它有自己的字（见 wordsKeyOf） */
    expect(changed.label3).toBe("取消");
  });

  it("keeps the rest of a look where it was", () => {
    const pinned = withLook(box(), { label: "已确认", color: "primary" });
    expect(pinned.color).toBe("primary");
    expect(pinned.label2).toBe("已确认");
  });

  it("says where those words live", () => {
    expect(wordsKeyOf(box())).toBe("label2");
    expect(wordsOf(box())).toBe("确认");
    expect(wordsOf(box({ label2: undefined }))).toBe("");
    expect(wordsKeyOf(makeItem("button"))).toBe("label");
    expect(wordsOf(makeItem("dialog"))).toBe("確認");
  });
});

describe("where 「置灰并停止响应」 lands on a confirm box", () => {
  it("greys the two buttons, never the frame", () => {
    expect(tapLivesInside("confirmBox")).toBe(true);
    expect(disablesWholePart("confirmBox")).toBe(false);
  });

  it("is still a whole-part matter for everything else", () => {
    for (const kind of ["button", "card", "dialog", "itemCell", "box"] as const) {
      expect(disablesWholePart(kind), kind).toBe(true);
    }
  });
});

describe("a freshly dropped confirm box", () => {
  beforeEach(() => setGlobalLang("zh"));
  afterEach(() => setGlobalLang("ja"));

  it("is already the author's draft: title, body and two buttons", () => {
    const it = makeItem("confirmBox");
    expect(it.label).toBe("温馨提示");
    expect(it.supporting).toBe("确认当前操作？");
    expect(it.label2).toBe("确认");
    expect(it.label3).toBe("取消");
    expect(it.icon).toBeNull();
    /* 底和圆角就是它画出来的那两样（和任务信息条同一条规矩） */
    expect(it.fill).toBe(CONFIRM_BOX_FILL);
    expect(it.radiusTop).toBe(CONFIRM_BOX_RADIUS);
    expect(it.size).toBe(CONFIRM_BOX_W);
    expect(it.children).toBeUndefined();
    expect(sizeOf(it, {})).toEqual({ w: 320, h: 200 });
  });

  /* 作者在这一版里把"隐藏面板"的逻辑加了回来，并要它成为组件本身（「里面我加了隐藏面板的逻辑……覆盖
     当前的确认框」）：新落下的确认框，两颗都配着「点一下 → 隐藏这一块」—— 点确认或取消都把这一块收
     起来。两台机器各是一台（主按钮在 `flow`、取消在 `slotFlows.cancel`），谁也不比谁特殊。 */
  it("already closes itself: both buttons put this box away", () => {
    const it = makeItem("confirmBox");
    /* 主按钮（确认）那一台：这一部件自己的机器 */
    expect(it.flow?.looks).toEqual([]);
    expect(it.flow?.steps).toHaveLength(1);
    expect(it.flow?.steps[0]).toMatchObject({ from: ":start", trigger: { kind: "tap" }, do: [{ kind: "look", hidden: true }] });
    /* 取消那一台：`slotFlows.cancel`，同样一步、同样那一下 */
    expect(Object.keys(it.slotFlows ?? {})).toEqual([CONFIRM_BOX_CANCEL_SLOT]);
    expect(it.slotFlows!.cancel).toEqual(it.flow);
    /* 两台不共用同一个对象：改一颗的字/机器不该动到另一颗 */
    expect(it.slotFlows!.cancel).not.toBe(it.flow);
    expect(it.slotFlows!.cancel.steps[0]).not.toBe(it.flow!.steps[0]);
    /* 这一步就是那一步：点下去把这一块收起来（`from: :start`、不写 `to`，和自动关闭同一种写法） */
    expect(CONFIRM_BOX_HIDE_STEP).toMatchObject({ from: ":start", trigger: { kind: "tap" }, do: [{ kind: "look", hidden: true }] });
    expect(CONFIRM_BOX_HIDE_STEP.to).toBeUndefined();
    /* 不是"等一会儿"，所以预览的计时器不必为它转起来 */
    expect(hasTimedSteps([it])).toBe(false);
  });

  it("keeps the two machines apart in the document, one per button", () => {
    const it = makeItem("confirmBox");
    /* 作者改了主按钮那一步：取消那一步一个字都不动（两颗各配各的） */
    const changed = { ...it, flow: { looks: [], steps: [{ ...it.flow!.steps[0], id: "other" }] } };
    expect(changed.slotFlows!.cancel.steps[0].id).toBe(it.slotFlows!.cancel.steps[0].id);
    /* 两台机器都存得下来、读得回来（存档走的是同一份 Item） */
    const back = roundTrip(it);
    expect(back.flow?.steps).toHaveLength(1);
    expect(back.slotFlows?.cancel.steps).toHaveLength(1);
    expect(back.slotFlows?.cancel.steps[0].do).toEqual([{ kind: "look", hidden: true }]);
  });

  it("speaks English when the editor does", () => {
    setGlobalLang("en");
    const it = makeItem("confirmBox");
    expect(it.label).toBe("Notice");
    expect(it.supporting).toBe("Run this action?");
    expect(it.label2).toBe("Confirm");
    expect(it.label3).toBe("Cancel");
  });

  it("offers no icon slot and no badge pair of its own", () => {
    const it = makeItem("confirmBox");
    expect(iconSlotsOf(it)).toEqual([]);
    expect(actionSlotsOf(it).map((s) => s.key)).toEqual([CONFIRM_BOX_CANCEL_SLOT]);
    expect(actionSlotsOf(it)[0].label).toBe("取消");
  });
});

describe("the confirm box's box", () => {
  it("adds its own留白 up to the height it draws at", () => {
    const m = confirmBoxMetrics(box());
    expect(m.h).toBe(m.padTop + m.titleLine + m.gap + m.band.h + m.gap + m.button.h + m.padBottom);
    expect(m.h).toBe(CONFIRM_BOX_H);
    expect(sizeOf(box(), {}).h).toBe(KIND_SPEC.confirmBox.h);
  });

  it("has three explicit heights: with both 200, no title 166, no body 118", () => {
    /* 空标题：那一行和它的缝一起不占；空正文：带和它后面那道缝一起不占 */
    expect(confirmBoxMetrics(box({ label: "" })).h).toBe(166);
    expect(confirmBoxMetrics(box({ label: "  " })).h).toBe(166);
    expect(confirmBoxMetrics(box({ supporting: "" })).h).toBe(118);
    expect(confirmBoxMetrics(box({ label: "", supporting: "" })).h).toBe(84);
    /* 有标题、没正文时，标题后面那道缝还在（118 = 14+24+10+0+0+49+21） */
    expect(confirmBoxMetrics(box({ supporting: "" })).h).toBe(CONFIRM_BOX_PAD_TOP + CONFIRM_BOX_TITLE_LINE + 10 + CONFIRM_BOX_BTN_H + CONFIRM_BOX_PAD_BOTTOM);
    expect(sizeOf(box({ label: "" }), {}).h).toBe(166);
    expect(sizeOf(box({ supporting: "" }), {}).h).toBe(118);
  });

  it("grows with the body's wrapped lines instead of clipping them", () => {
    /* 14 个全角字一行（14×18 = 252 ≤ 255）；29 个字因此折成 3 行 */
    const long = "确".repeat(29);
    const m = confirmBoxMetrics(box({ supporting: long }));
    expect(wrapTextLines(long, 18, 255)).toBe(3);
    expect(m.bodyLines).toBe(3);
    expect(m.band.h).toBe(10 + 3 * 26 + 10);
    expect(m.band.h).toBe(98);
    expect(m.h).toBe(CONFIRM_BOX_PAD_TOP + CONFIRM_BOX_TITLE_LINE + 10 + 98 + 10 + CONFIRM_BOX_BTN_H + CONFIRM_BOX_PAD_BOTTOM);
    expect(m.h).toBe(226);
    /* 两行还是那条 72 的下限：原稿那一档一点没变 */
    expect(confirmBoxMetrics(box({ supporting: "确".repeat(28) })).band.h).toBe(72);
    expect(confirmBoxMetrics(box({ supporting: "确".repeat(15) })).band.h).toBe(72);
    /* 作者自己敲的换行也算一行 */
    expect(wrapTextLines("一\n二", 18, 255)).toBe(2);
    expect(wrapTextLines("", 18, 255)).toBe(0);
  });

  it("moves the body strip with the frame's width", () => {
    const wide = confirmBoxMetrics(box({ size: 400 }));
    expect(wide.band.w).toBe(400 - CONFIRM_BOX_PAD_X * 2);
    expect(wide.band.w).toBe(360);
    /* 更宽的一行装得下更多字，所以同一段正文折的行数更少：20 个字 = 360dp，320 宽时两行、440 宽时一行 */
    expect(confirmBoxMetrics(box({ size: 440, supporting: "确".repeat(20) })).bodyLines).toBe(1);
    expect(confirmBoxMetrics(box({ size: 320, supporting: "确".repeat(20) })).bodyLines).toBe(2);
  });

  it("lets the author pin the height, and keeps the box's own numbers whatever it says", () => {
    expect(sizeOf(box({ size: 388 }), {}).w).toBe(388);
    expect(sizeOf(box({ size2: 240 }), {}).h).toBe(240);
    /* 两颗按钮写多长、有没有配去处，盒子都是同一个数 */
    for (const patch of [{ label2: "" }, { label3: "" }, { label2: "确定要这么做吗" }, { label2: "Confirm and continue", label3: "Cancel everything" }]) {
      expect(sizeOf(box(patch), {}), JSON.stringify(patch)).toEqual({ w: 320, h: 200 });
    }
  });
});

describe("a confirm box through save and load", () => {
  it("keeps every field it was drawn with, label3 included", () => {
    const it = box();
    expect(isPlacedItem(it)).toBe(true);
    const back = roundTrip(it);
    expect(back).toMatchObject({
      kind: "confirmBox",
      label: "温馨提示",
      supporting: "确认当前操作？",
      label2: "确认",
      label3: "取消",
      fill: CONFIRM_BOX_FILL,
      radiusTop: CONFIRM_BOX_RADIUS,
      size: 320,
    });
    expect(sizeOf(back, {})).toEqual({ w: 320, h: 200 });
    expect(confirmBoxButtonWords(back, CONFIRM_BOX_CANCEL_SLOT)).toBe("取消");
  });

  it("opens a real file with both button words intact", async () => {
    const back = await saved(box({ label2: "确定", label3: "再想想" }));
    expect(back).toMatchObject({ kind: "confirmBox", label2: "确定", label3: "再想想" });
    expect(confirmBoxMainWords(back)).toBe("确定");
    expect(sizeOf(back, {}).h).toBe(200);
  });

  it("repairs a button word the way it repairs every other word", () => {
    /* 数字当字读（作者可能就敲了个数），别的读不出来的让掉 —— 部件一个都不丢 */
    expect(readItem({ ...box(), label3: 5 })!.label3).toBe("5");
    for (const junk of [{}, [], true, null, undefined] as unknown[]) {
      const read = readItem({ ...box(), label3: junk });
      expect(read, JSON.stringify(junk)).toBeTruthy();
      expect(read!.label3, JSON.stringify(junk)).toBeUndefined();
      expect(read!.label2).toBe("确认");
    }
  });

  it("is no longer a kind this build drops", async () => {
    /* 上一版做到一半的那个 confirmBox 曾被列进 REMOVED_KINDS，重做时已经拿了出来：如今它和别的
       种类一样读得回来 */
    expect(isPlacedItem(box())).toBe(true);
    const read = readDoc(stored(box()))!;
    expect(read.groups[0].items.map((it) => it.kind)).toEqual(["confirmBox"]);
    /* 旧文档里别的种类的字段照旧（`icon` 不是确认框的字段，写进来也不影响它画什么） */
    const odd = readItem({ ...box(), icon: "eco" })!;
    expect(sizeOf(odd, {})).toEqual({ w: 320, h: 200 });
  });
});

describe("a confirm box in the prompt", () => {
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
  const NOUN: Record<string, string> = { ja: "確認ボックス", en: "confirm box", zh: "确认框", ko: "확인 상자" };
  const line = (item: Item, lang: (typeof LANGS)[number]["key"]) =>
    buildPrompt(doc(item), {}, undefined, lang)
      .split("\n")
      .find((l) => l.includes(NOUN[lang])) ?? "";

  it("says it is one part with the title, the body and two equal buttons", () => {
    for (const { key } of LANGS) {
      const text = line(box(), key);
      expect(text, key).not.toBe("");
      /* 两颗按钮的字都在这一行上，确认那颗（label2）与取消那颗（label3）一个不少 */
      expect(text, key).toContain("确认");
      expect(text, key).toContain("取消");
      /* 正文也在 */
      expect(text, key).toContain("确认当前操作？");
    }
  });

  it("says only those two answer a tap, never the frame", () => {
    for (const { key } of LANGS) {
      const all = buildPrompt(doc(box()), {}, undefined, key);
      /* 一句"只有按钮响应"的话，必须是这一部件说的 */
      expect(all, key).toMatch(key === "zh" ? /只有这两颗按钮响应点击/ : key === "en" ? /Only the two buttons answer a tap/ : key === "ja" ? /タップに反応するのはこの2つのボタンだけ/ : /이 두 버튼만 탭에 반응/);
    }
  });

  it("says a look changes the confirm button's words", () => {
    const flow = { looks: [{ id: "l2", label: "已确认" }], steps: [{ id: "s", from: ":start", to: "l2", trigger: { kind: "tap" as const }, do: [] }] };
    const said = buildPrompt(doc(box({ flow })), {}, undefined, "zh");
    expect(said).toContain("按钮文字为「已确认」");
  });

  it("also gets a style note with the author's own numbers", () => {
    const said = buildPrompt(doc(box()), {}, undefined, "zh");
    expect(said).toContain("确认框：宽 320dp，圆角 28dp");
    expect(said).toContain("104×49");
    expect(said).toContain("总高 200dp，没标题 166dp，没正文 118dp");
  });
});

describe("the confirm box's reference draft", () => {
  /* 作者在「上传屏幕2」里手摆的那一版原稿。这一份**不是**融合后的部件 —— 它是一个框加四个孩子
     （confirm-box.md：上次那版融合结果随部件一起删掉了，只留了原稿）。所以这里既钉住原稿一个数都
     没被动过，也钉住"融合成的那一个部件"确实就是照着它做的。 */
  const file = resolve(process.cwd(), "docs/reference-prototypes/confirm-box-component.json");
  const raw = () => JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  /* 作者的原稿说的是中文，所以这一节在中文下比（新落下的部件跟着编辑器的语言走） */
  beforeEach(() => setGlobalLang("zh"));
  afterEach(() => setGlobalLang("ja"));

  it("still reads as the author drew it: a 320×200 box holding its four pieces", () => {
    const read = readDoc(raw())!;
    const outer = read.groups.flatMap((g) => g.items);
    expect(outer).toHaveLength(1);
    const frame = outer[0];
    expect(frame.kind).toBe("box");
    expect([frame.size, frame.size2, frame.radiusTop, frame.radiusBottom, frame.fill]).toEqual([320, 200, 28, 28, "surfaceContainerHigh"]);
    const kids = frame.children ?? [];
    expect(kids.map((c) => c.kind)).toEqual(["text", "button", "button", "box"]);
    /* 标题：20dp 居中那一句 */
    expect(kids[0].label).toBe("温馨提示");
    expect(kids[0].size).toBe(20);
    /* 两颗按钮：各 104×49、同一行 y=130（原稿手摆的左右差 7dp 是作者的，融合时才收成对称） */
    expect([kids[1].size, kids[1].size2, kids[1].y]).toEqual([104, 49, 130]);
    expect([kids[2].size, kids[2].size2, kids[2].y]).toEqual([104, 49, 130]);
    /* 正文带：260×72 @ y=48，正文 18dp 在带内 */
    expect([kids[3].size, kids[3].size2, kids[3].y]).toEqual([260, 72, 48]);
    expect(kids[3].children?.map((c) => [c.label, c.size, c.y])).toEqual([["确认当前操作？", 18, 10]]);
    /* 原稿里没有"确认框"这个部位（它还没被融） */
    expect(outer.every((it) => it.kind !== "confirmBox")).toBe(true);
  });

  it("is what the palette's one part was made from", () => {
    const it = makeItem("confirmBox");
    /* 同一个框：320×200、圆角 28、surfaceContainerHigh */
    expect([it.size, sizeOf(it, {}).h, it.radiusTop, it.fill]).toEqual([320, 200, 28, CONFIRM_BOX_FILL]);
    /* 同一句话进了字段，而不是留在孩子里 */
    expect([it.label, it.supporting]).toEqual(["温馨提示", "确认当前操作？"]);
    expect(it.children).toBeUndefined();
    /* 两颗按钮各有各的字，且不再是画布上独立的部件 */
    expect([it.label2, it.label3]).toEqual(["确认", "取消"]);
  });

  it("is the delivered result the palette now hands out", () => {
    /* 作者交付的**融合结果**（成对使用的另一份）：一屏里就放着那一颗确认框，两颗都带着「点一下 → 隐藏这
       一块」。组件本身的默认（`makeItem`）以这一份为准 —— 同一句话、同一个尺寸、同一台机器。 */
    const delivered = resolve(process.cwd(), "docs/reference-prototypes/confirm-box-component.single-part.json");
    const read = readDoc(JSON.parse(readFileSync(delivered, "utf8")))!;
    const parts = read.groups.flatMap((g) => g.items);
    expect(parts).toHaveLength(1);
    const it = parts[0];
    expect(it.kind).toBe("confirmBox");
    expect(it.children).toBeUndefined();
    expect([it.label, it.supporting, it.label2, it.label3]).toEqual(["温馨提示", "确认当前操作？", "确认", "取消"]);
    expect([it.size, sizeOf(it, {}).h, it.radiusTop, it.fill]).toEqual([320, 200, 28, CONFIRM_BOX_FILL]);
    /* 隐藏那一手：主按钮一台、取消一台，都是「点一下 → 隐藏这一块」 */
    for (const machine of [it.flow, it.slotFlows?.cancel]) {
      expect(machine?.steps).toHaveLength(1);
      expect(machine?.steps[0].trigger).toEqual({ kind: "tap" });
      expect(machine?.steps[0].do).toEqual([{ kind: "look", hidden: true }]);
    }
    /* 于是新落下的那一个和它一模一样（两颗都把这一块收起来） */
    const fresh = makeItem("confirmBox");
    expect(fresh.flow?.steps.map((s) => s.do)).toEqual(it.flow?.steps.map((s) => s.do));
    expect(fresh.slotFlows?.cancel.steps.map((s) => s.do)).toEqual(it.slotFlows?.cancel.steps.map((s) => s.do));
    expect(sizeOf(fresh, {})).toEqual(sizeOf(it, {}));
  });
});
