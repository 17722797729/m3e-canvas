import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/* The Inspector and the mobile sheet pull in the whole editor chrome; the two parts that need the
 * browser (motion and the AI panel) are stubbed, the way the other component tests do, and both
 * sheets are rendered to static markup so the control can be read off the same way it is drawn. */
vi.mock("@/lib/tokens", () => import("../lib/tokens"));
vi.mock("@/lib/i18n", () => import("../lib/i18n"));
vi.mock("@/lib/color", () => import("../lib/color"));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ font: "sans" }), ensureFontLoaded: () => {} }));
vi.mock("@/lib/shapes", () => ({}));
vi.mock("@/lib/ai", () => ({ popHistory: () => undefined }));
vi.mock("motion/react", () => ({
  motion: { div: "div", span: "span", button: "button" },
  AnimatePresence: "div",
  useReducedMotion: () => false,
  useDragControls: () => ({ start: () => {} }),
}));
vi.mock("./Loading", () => ({ CircularProgress: "circle", LinearProgress: "bar", LoadingIndicator: "spinner" }));
vi.mock("./AiPanel", () => ({ AiWriteBtn: () => null, AiPanel: "div" }));

import { renderToStaticMarkup } from "react-dom/server";

import { LANGS, LangContext, t, type Lang } from "../lib/i18n";
import { PALETTES, makeItem, type Item } from "../lib/tokens";
import { FrameInspector, Inspector, lookFieldTitle, lookSeed } from "./Inspector";
import { MobileInspector } from "./Mobile";

const btn = (patch: Partial<Item> = {}) =>
  ({ ...makeItem("button"), id: "b", label: "OK", icon: "swords", ...patch }) as Item;
const ai = { ready: false, busy: false, onRun: () => {}, onCancel: () => {} };
const noop = () => {};

/* 两种语言都渲染得出来：面板里的字全部走 useLang()，所以把它包在对应的语言里 */
const inLang = (lang: Lang, node: ReactNode) => createElement(LangContext.Provider, { value: lang }, node);

const inspector = (item: Item, lang: Lang = "ja") =>
  renderToStaticMarkup(
    inLang(lang, createElement(Inspector as never, { ai, item, palette: PALETTES[0], frames: [], onChange: noop, onDelete: noop, onDuplicate: noop, multi: 1 } as never)),
  );
const sheet = (item: Item, lang: Lang = "ja") =>
  renderToStaticMarkup(
    inLang(lang, createElement(MobileInspector as never, { item, palette: PALETTES[0], onChange: noop, onDelete: noop, onDuplicate: noop, onClose: noop } as never)),
  );

/* 按钮不再有自己的"右徽标"这一项（作者：「组件-按钮中有个右徽标属性，去掉此属性。不要影响其它按钮
 * 组件」）：两个面板里都不该出现那一行，哪怕老文档里的按钮还带着 badge / badgeText。功能按钮和物品格
 * 的角标一个字没动。 */
describe("the badge control in the editors", () => {
  it.each([
    ["Inspector", inspector],
    ["mobile sheet", sheet],
  ])("has no row at all for a button in the %s", (_where, render) => {
    expect(render(btn())).not.toContain("badge");
    /* 老文档里带着字也一样：那一行不再出现 */
    const out = render(btn({ badge: true, badgeText: "1" }));
    expect(out).not.toContain(`aria-label="${t("fnBadge", "ja")}"`);
    expect(out).not.toContain(`placeholder="${t("badge", "ja")}"`);
  });

  it.each([
    ["Inspector", inspector],
    ["mobile sheet", sheet],
  ])("keeps the function button's own corner badge in the %s", (_where, render) => {
    const fn = { ...makeItem("fnButton"), id: "fn", label: "イベント", badge: true, badgeText: "3" } as Item;
    const out = render(fn);
    expect(out).toContain(`aria-label="${t("fnBadge", "ja")}"`);
    expect(out).toContain('value="3"');
  });

  /* 那一行提示只有桌面检查器有（手机面板从来只镜像开关与输入框） */
  it("explains the function button's empty badge in the Inspector", () => {
    const fn = { ...makeItem("fnButton"), id: "fn", label: "イベント", badge: true, badgeText: "3" } as Item;
    expect(inspector(fn)).toContain(t("fnBadgeHint", "ja"));
  });

  it.each([
    ["Inspector", inspector],
    ["mobile sheet", sheet],
  ])("keeps the item cell's corner badge in the %s", (_where, render) => {
    const cell = { ...makeItem("itemCell"), id: "c", label: "宝箱", badge: true, badgeText: "新" } as Item;
    expect(render(cell)).toContain(`aria-label="${t("fnBadge", "ja")}"`);
  });

  it.each([
    ["Inspector", inspector],
    ["mobile sheet", sheet],
  ])("shows no badge row for a kind that has none in the %s", (_where, render) => {
    const out = render(makeItem("text"));
    expect(out).not.toContain(t("fnBadge", "ja"));
  });

  it("leaves the button out of the two-slot icon list the asset pill has", () => {
    /* 按钮的徽标不是"右图标"：通用图标槽里按钮仍旧只有一格（那次把徽标做成尾巴上的图标，正是这里
       多出来的一格 —— 见 lib/tokens 的 iconSlotsOf 与 lib/assetPill.test.ts） */
    expect(inspector(btn())).not.toContain(t("rightIcon", "ja"));
    expect(inspector(btn())).toContain(t("icon", "ja"));
    const pill = { ...makeItem("assetPill"), id: "p" } as Item;
    expect(inspector(pill)).toContain(t("rightIcon", "ja"));
  });
});

/* 「改变文字」这一项打开时，字段里先摆着这个部件**此刻的文字**。任务信息条上是按钮上那两个字，
   不是标题 —— 摆错的话作者一改就把标题改了（见 lib/tokens 的 wordsOf / wordsKeyOf）。 */
describe("the value 「改变文字」 starts from", () => {
  const taskBar = { ...makeItem("taskBar"), id: "tb", label: "毎日ログイン (1/1)", label2: "受け取る" } as Item;

  it("is the button's words for a task bar", () => {
    expect(lookSeed("label", taskBar)).toBe("受け取る");
  });

  it("is the part's own line for every other kind", () => {
    expect(lookSeed("label", btn())).toBe("OK");
  });

  it("names the control after where those words live", () => {
    /* 任务信息条上这一项念作「按钮文字」，不是「改变文字」—— 说清了它到底改哪一处 */
    expect(lookFieldTitle("label", "state_label", taskBar)).toBe("barButton");
    expect(lookFieldTitle("label", "state_label", btn())).toBe("state_label");
    /* 别的字段的名字不受影响 */
    expect(lookFieldTitle("icon", "state_icon", taskBar)).toBe("state_icon");
  });

  it("is the confirm button's words for a confirm box", () => {
    /* 确认框上是那颗**确认**按钮的字（label2），不是标题、也不是取消那颗（见 wordsOf） */
    const box = { ...makeItem("confirmBox"), id: "cb", label: "温馨提示", label2: "确认", label3: "取消" } as Item;
    expect(lookSeed("label", box)).toBe("确认");
    expect(lookFieldTitle("label", "state_label", box)).toBe("confirmButton");
    /* 取消那颗有它自己的字；「改变文字」只改主按钮那一颗 */
    expect(box.label3).toBe("取消");
    expect(lookSeed("hidden", box)).toBe(true);
  });

  it("leaves the seeds of the other fields alone", () => {
    expect(lookSeed("hidden", taskBar)).toBe(true);
    expect(lookSeed("color", taskBar)).toBe("primary");
    expect(lookSeed("icon", btn())).toBe("swords");
  });
});

/* 流程编辑器里那张状态卡片也照预览的画法：普通部件被"置灰并停止响应"时整块灰，任务信息条只灰里面那
   颗按钮（见 disablesWholePart / LookPreview）。 */
describe("a state card that greys its part", () => {
  const flow = (disabled: boolean) => ({
    flow: { looks: [{ id: "l2", disabled }], steps: [{ id: "s1", from: ":start", to: "l2", trigger: { kind: "tap" } }] },
  });

  it("greys the whole card for an ordinary part", () => {
    const out = inspector(btn({ ...flow(true) } as never));
    expect(out).toContain("filter:grayscale(1)");
    /* 没有"按钮关掉了"这一说：整块灰就是整块灰 */
    expect(out).not.toContain("data-task-button-off");
  });

  it("greys only the claim button when the part is a fitted task bar", () => {
    const out = inspector({ ...makeItem("taskBar"), id: "tb", label: "每日登录游戏 (1/1)", label2: "领取", ...flow(true) } as Item);
    /* 面板里就一处灰，而且它落在"按钮关掉了"的那一槽自己身上 */
    expect((out.match(/filter:grayscale\(1\)/g) ?? []).length).toBe(1);
    const offAt = out.indexOf('data-task-button-off=""');
    expect(offAt).toBeGreaterThan(-1);
    const offTag = out.slice(offAt, out.indexOf(">", offAt));
    expect(offTag).toContain("filter:grayscale(1)");
    expect(offTag).toContain("opacity:0.55");
  });

  it("greys both of a confirm box's buttons, not the frame", () => {
    /* 作者：「是针对按钮，而不是整个组件」—— 确认框里画着自己那两颗，所以面板里两处灰，一处一颗 */
    const out = inspector({ ...makeItem("confirmBox"), id: "cb", label: "温馨提示", label2: "确认", label3: "取消", ...flow(true) } as Item);
    expect((out.match(/filter:grayscale\(1\)/g) ?? []).length).toBe(2);
    expect((out.match(/data-confirm-button-off=""/g) ?? []).length).toBe(2);
    /* 任务信息条那一槽的标记一个都不在 */
    expect(out).not.toContain("data-task-button-off");
  });
});

/* 「行为 → 目标按钮」：融合部件里画在自己里面的那颗**主按钮**也要能配去处。确认框里那颗是「确认」
   （它走这一部件自己的 `flow` / `action`），空键那一条因此摆在槽位前面，取消那颗（`cancel` 槽）排在
   它后面 —— 作者于是能在两个目标里挑（见 docs/reference-prototypes/confirm-box.md）。 */
describe("the tap targets a fused part offers", () => {
  it("offers a confirm box's two buttons, the main one first and chosen", () => {
    const out = inspector({ ...makeItem("confirmBox"), id: "cb", label: "温馨提示", supporting: "确认当前操作？", label2: "确认", label3: "取消" } as Item, "zh");
    const at = out.indexOf(t("tapTarget", "zh"));
    expect(at).toBeGreaterThan(-1);
    const seg = out.slice(at);
    /* 两颗各是一个目标，名字就是那颗按钮自己的字 */
    expect(seg).toContain('title="确认"');
    expect(seg).toContain('title="取消"');
    expect(seg.indexOf('title="确认"')).toBeLessThan(seg.indexOf('title="取消"'));
    /* 打开时选中的是主按钮（确认）—— 主按钮的规则就落在 item.flow / item.action 上 */
    const main = seg.slice(seg.indexOf('title="确认"'), seg.indexOf('title="取消"'));
    expect(main).toContain(`background:${PALETTES[0].primary}`);
  });

  it("offers the claim button alone on a task bar", () => {
    /* 任务信息条只有那一颗：一个目标不摆"目标按钮"那一行，和从前一样 */
    const out = inspector({ ...makeItem("taskBar"), id: "tb", label: "每日登录游戏 (1/1)", label2: "领取" } as Item, "zh");
    expect(out).not.toContain(t("tapTarget", "zh"));
  });
});

/* 「点击后变化」那一句话只在**什么都没配**的时候才说：一份机器可以只有步骤、没有自己的状态
   （"留在原地，只做动作"），而新落下的确认框就带着这样一步（「点一下 → 隐藏这一块」）。 */
describe("the invitation to configure a tap", () => {
  it("is there for a part that does nothing yet", () => {
    expect(inspector({ ...makeItem("button"), id: "b", label: "OK" } as Item, "zh")).toContain(t("transitionsHint", "zh"));
  });

  it("is gone once the machine has a step, even with no state of its own", () => {
    const box = makeItem("confirmBox") as Item;
    expect(box.flow?.steps).toHaveLength(1);
    expect(box.flow?.looks).toEqual([]);
    const out = inspector({ ...box, id: "cb" }, "zh");
    expect(out).not.toContain(t("transitionsHint", "zh"));
    /* 那一台机器照旧画在下面（点一下、隐藏），只是不再招呼作者"加一条" */
    expect(out).toContain(t("transitions", "zh"));
  });
});

/* 一屏的导出那一节：提示词（复制）、图片，和**这一屏自己的 JSON**（作者要一屏一屏地交给别人看由哪些
   部件组成，见 lib/project 的 screenProject）。三者并排在一个按钮行里。 */describe("the screen's export row", () => {
  const frame = { id: "f", name: "上传屏幕2", x: 0, y: 0, w: 412, h: 892 } as never;
  const screen = (onSaveJson: () => void) =>
    renderToStaticMarkup(
      createElement(FrameInspector as never, {
        frame,
        palette: PALETTES[0],
        onChange: noop,
        onDelete: noop,
        onDuplicate: noop,
        onPreview: noop,
        prompt: "prompt",
        onSaveImage: async () => {},
        onSaveJson,
        frames: [frame],
        ai,
        onSize: noop,
      } as never),
    );

  it("offers the JSON of this screen beside the prompt and the image", () => {
    const out = screen(noop);
    expect(out).toContain(t("saveJson", "ja"));
    expect(out).toContain(t("saveImage", "ja"));
    expect(out).toContain(t("prompt", "ja"));
  });
});
