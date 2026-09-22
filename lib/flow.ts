import { BACK_TARGET, KIND_SPEC, START_LOOK, actionSlotsOf, actionsOf, frameRect, groupBounds, conditionText, isOverlayFrame, isWideRail, lookItem, overlayLevelOfFrame, subtreeOf, writeText, type Doc, type Group, type Item, type ItemState, type OverlayLevel, type PartFlow, type PartStep, type RuleAction, type StateEffect, type Var } from "./tokens";
import { KIND_TEXT, overlayLevelText, t, type Lang } from "./i18n";

/** the level's name in the UI language, for the diagram's node captions */
export const overlayLevelName = overlayLevelText;

/* the kind's own fallback noun, for a document written by a build that knows a
 * kind this one does not */

/* The graph the flow page draws and the description it exports, both derived from
 * the document alone. Nothing here reads the DOM, storage or the clock, so one
 * document always yields the same graph and the same sentences.
 *
 * A frame is a node; a tap that leads to another frame is an edge. Every
 * from→to pair is merged into a single edge listing the triggers that cause it,
 * so two buttons opening the same screen read as one transition. */

export type FlowNodeKind = "screen" | "popup";

export type FlowRule =
  | { kind: "jump"; nodeId: string; itemId: string; itemLabel: string; toFrameId: string; description: string; dialog?: boolean }
  | { kind: "state"; itemId: string; itemLabel: string; description: string };

export type FlowNode = {
  id: string;
  kind: FlowNodeKind;
  label: string;
  description: string;
  /** an overlay page's level: how it takes the screen over when a tap opens it */
  overlay?: OverlayLevel;
  /** interactive parts on this screen, in canvas order */
  rules: FlowRule[];
  /** BFS depth from the first frame, for layout */
  depth: number;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  /** short label drawn on the line, e.g. "点击「开始」" */
  label: string;
  /** full sentence for the description document */
  description: string;
  /** every trigger merged into this edge (one edge per from→to pair) */
  triggers: { itemId: string; itemLabel: string }[];
};

export type Flow = { nodes: FlowNode[]; edges: FlowEdge[]; order: string[] };

/** Everything the flow page and the Markdown writer say, in the four UI languages. */
export const FLOW_TEXT: Record<
  Lang,
  {
    title: string;
    empty: string;
    emptyHint: string;
    backToEditor: string;
    exportPng: string;
    exportMd: string;
    note: string;
    transitions: string;
    noEdges: string;
    noRules: string;
    tap: string;
    popup: string;
    screen: string;
    backNote: string;
    untitled: string;
    itemCount: (n: number) => string;
    nodeSummary: (name: string, kind: string, detail: string) => string;
    edgeSummary: (from: string, to: string) => string;
    backLine: (name: string, items: string) => string;
    /** the side rail's own collapse / expand button */
    railToggle: (item: string) => string;
    /** the navigation bar's own collapse / expand button */
    barToggle: (item: string) => string;
    /** a rule that opens a dialog screen of its own */
    dialogOpen: (from: string, item: string, to: string) => string;
    dialogLine: (from: string, item: string, to: string) => string;
    /** a conditional tap that changes a variable: `when` is empty for a rule with no condition */
    ruleWrite: (item: string, when: string, write: string) => string;
    /** what a part becomes while a look rule holds */
    look: (action: { icon?: string; label?: string; color?: string; variant?: string }) => string;
    jump: (from: string, item: string, to: string) => string;
    jumpMarkdown: (from: string, item: string, to: string) => string;
    jumpLine: (from: string, item: string, to: string) => string;
    state: Record<StateEffect, (item: string, value: string, seconds: string) => string>;
    /** how a step of a part's machine is set off */
    tapHow: string;
    afterHow: (seconds: string) => string;
    /** the look the author drew, named where a step goes back to it */
    drawnLook: string;
    /** what separates two changes in one look's description */
    changeJoin: string;
    /** the fields one look changes about its part, in words */
    lookChange: { label: (v: string) => string; icon: (v: string) => string; color: (v: string) => string; variant: (v: string) => string; off: string; grow: string; hide: string };
    /** one step of it: how it starts, the look it lands in, what that look changes, and the rest */
    step: (item: string, how: string, to: string, changes: string, extra: string) => string;
  }
> = {
  ja: {
    title: "画面フロー",
    empty: "キャンバスに画面がありません。",
    emptyHint: "エディタで画面とタップ遷移を作ると、ここにフローが表示されます。",
    backToEditor: "エディタに戻る",
    exportPng: "PNG を書き出す",
    exportMd: "説明を書き出す",
    note: "この図はドキュメントから自動生成されます。",
    transitions: "遷移",
    noEdges: "画面をつなぐ遷移はまだありません。",
    noRules: "この画面には操作がありません。",
    tap: "タップ",
    popup: "ポップアップ",
    screen: "画面",
    backNote: "前の画面に戻ります",
    untitled: "無題の画面",
    itemCount: (n) => `操作できる部品が ${n} 個`,
    nodeSummary: (name, kind, detail) => `${name} は${kind}です。${detail}。`,
    edgeSummary: (from, to) => `${from} から ${to} への遷移。`,
    backLine: (name, items) => `${name} では「${items}」で前の画面に戻ります。`,
    railToggle: (item) => `「${item}」の「V」でナビを上下に畳んで「^」に変わり、もう一度押すと開きます。`,
    barToggle: (item) => `「${item}」の「<」でナビの中身を畳んで「>」だけになり、もう一度押すと元に戻ります。`,
    jump: (from, item, to) => `${from} の「${item}」→ ${to}`,
    jumpMarkdown: (from, item, to) => `${from} の「${item}」をタップすると ${to} に移動します。`,
    jumpLine: (from, item, to) => `- ${from} の「${item}」をタップすると ${to} に移動します。`,
    dialogOpen: (from, item, to) => `${from} の「${item}」→ ${to}（ポップアップ）`,
    dialogLine: (from, item, to) => `${from} の「${item}」をタップすると ${to} のポップアップが開きます。`,
    ruleWrite: (item, when, write) => `「${item}」をタップすると${when ? `${when} のときは` : ""}${write} になります。`,
    look: (a) => `${a.label ? `表示は「${a.label}」` : ""}${a.icon ? `${a.label ? "、" : ""}アイコンは ${a.icon}` : ""}${a.variant ? `${a.label || a.icon ? "、" : ""}スタイルは ${a.variant}` : ""}${a.color ? `${a.label || a.icon || a.variant ? "、" : ""}色は ${a.color}` : ""}` || "見た目が変わる",
    tapHow: "タップすると",
    afterHow: (seconds) => `${seconds} 秒後に`,
    drawnLook: "最初の見た目",
    changeJoin: "、",
    lookChange: {
      label: (v) => `表示が「${v}」`,
      icon: (v) => `アイコンは ${v}`,
      color: (v) => `色は ${v}`,
      variant: (v) => `スタイルは ${v}`,
      off: "無効になる",
      grow: "大きくなる",
      hide: "隠れる",
    },
    step: (item, how, to, changes, extra) => `${how}「${item}」は${to}になります${changes ? `（${changes}）` : ""}${extra ? `。${extra}` : "。"}`,
    state: {
      disable: (item) => `「${item}」をタップすると、この部品は無効になります。`,
      cooldown: (item, _value, seconds) => `「${item}」をタップすると ${seconds} 秒間は灰色になり、カウントダウンが終わると元の見た目に戻ります。`,
      label: (item, value) => `「${item}」をタップすると、表示が「${value}」に変わります。`,
      color: (item, value) => `「${item}」をタップすると、色が ${value} に変わります。`,
      icon: (item, value) => `「${item}」をタップするとアイコンが ${value} に変わり、もう一度タップすると元に戻ります。`,
      variant: (item, value) => `「${item}」をタップすると、見た目が「${value}」に変わります。`,
      grow: (item) => `「${item}」をタップすると、この部品が大きくなります。`,
      hide: (item) => `「${item}」をタップすると、この部品は隠れます。`,
    },
  },
  en: {
    title: "Screen flow",
    empty: "There are no screens on the canvas yet.",
    emptyHint: "Draw screens and tap transitions in the editor and the flow shows up here.",
    backToEditor: "Back to editor",
    exportPng: "Export PNG",
    exportMd: "Export description",
    note: "This diagram is generated from the document.",
    transitions: "Transitions",
    noEdges: "No transition connects the screens yet.",
    noRules: "This screen has no interactions.",
    tap: "Tap",
    popup: "popup",
    screen: "screen",
    backNote: "a part on it goes back to the previous screen",
    untitled: "Untitled screen",
    itemCount: (n) => `${n} interactive ${n === 1 ? "part" : "parts"}`,
    nodeSummary: (name, kind, detail) => `${name} is a ${kind} with ${detail}.`,
    edgeSummary: (from, to) => `The transition from ${from} to ${to}.`,
    backLine: (name, items) => `On ${name}, "${items}" goes back to the previous screen.`,
    railToggle: (item) => `The "V" on "${item}" folds the rail up and turns into "^", which opens it again.`,
    barToggle: (item) => `On "${item}" the "<" folds the whole navigation away, leaving only ">", which brings it back.`,
    jump: (from, item, to) => `Tap "${item}" on ${from} → ${to}`,
    jumpMarkdown: (from, item, to) => `Tapping "${item}" on ${from} opens ${to}.`,
    jumpLine: (from, item, to) => `- Tapping "${item}" on ${from} opens ${to}.`,
    dialogOpen: (from, item, to) => `${from} "${item}" → ${to} (dialog)`,
    dialogLine: (from, item, to) => `Tapping "${item}" on ${from} opens the ${to} dialog.`,
    ruleWrite: (item, when, write) => `Tapping "${item}"${when ? ` when ${when}` : ""} sets ${write}.`,
    look: (a) => [a.label && `the label reads "${a.label}"`, a.icon && `the icon is ${a.icon}`, a.variant && `the style is ${a.variant}`, a.color && `the colour is ${a.color}`].filter(Boolean).join(", ") || "its look changes",
    tapHow: "Tapping",
    afterHow: (seconds) => `After ${seconds} seconds,`,
    drawnLook: "the drawn look",
    changeJoin: ", ",
    lookChange: {
      label: (v) => `its words read “${v}”`,
      icon: (v) => `its icon is ${v}`,
      color: (v) => `its colour is ${v}`,
      variant: (v) => `its style is ${v}`,
      off: "it stops answering",
      grow: "it grows",
      hide: "it disappears",
    },
    step: (item, how, to, changes, extra) => `${how} ${item} becomes ${to}${changes ? ` (${changes})` : ""}${extra ? `. ${extra}` : "."}`,
    state: {
      disable: (item) => `Tapping「${item}」 greys it out for good.`,
      cooldown: (item, _value, seconds) => `After tapping "${item}" the part is greyed for ${seconds} seconds, then goes back to how it looked.`,
      label: (item, value) => `After tapping "${item}" its text becomes "${value}".`,
      color: (item, value) => `After tapping "${item}" its colour becomes ${value}.`,
      icon: (item, value) => `Tapping "${item}" swaps its icon to ${value}, and tapping it again swaps it back.`,
      variant: (item, value) => `After tapping "${item}" its style becomes ${value}.`,
      grow: (item) => `After tapping "${item}" the part becomes larger.`,
      hide: (item) => `After tapping "${item}" the part is hidden.`,
    },
  },
  zh: {
    title: "页面流程",
    empty: "画布上还没有页面。",
    emptyHint: "在编辑器里画出页面并连接点击跳转后，这里会显示流程图。",
    backToEditor: "返回编辑器",
    exportPng: "导出 PNG",
    exportMd: "导出说明",
    note: "此图根据文档自动生成。",
    transitions: "跳转",
    noEdges: "还没有连接页面的跳转。",
    noRules: "此页面没有可操作的组件。",
    tap: "点击",
    popup: "弹窗",
    screen: "页面",
    backNote: "其中的部件会返回上一个页面",
    untitled: "未命名页面",
    itemCount: (n) => `${n} 个可操作组件`,
    nodeSummary: (name, kind, detail) => `${name} 是一个${kind}，包含${detail}。`,
    edgeSummary: (from, to) => `从 ${from} 到 ${to} 的跳转。`,
    backLine: (name, items) => `${name} 的「${items}」会返回上一个页面。`,
    railToggle: (item) => `点击「${item}」上的「V」把导航栏上下折叠并变成「^」，再点「^」即可展开。`,
    barToggle: (item) => `点击「${item}」上的「<」收起整个导航内容只留下「>」，再点「>」即恢复原样。`,
    jump: (from, item, to) => `点击 ${from} 的「${item}」→ ${to}`,
    jumpMarkdown: (from, item, to) => `点击 ${from} 的「${item}」会跳转到 ${to}。`,
    jumpLine: (from, item, to) => `- 点击 ${from} 的「${item}」会跳转到 ${to}。`,
    dialogOpen: (from, item, to) => `${from} 的「${item}」→ ${to}（弹框）`,
    dialogLine: (from, item, to) => `点击 ${from} 的「${item}」弹出 ${to} 弹框。`,
    ruleWrite: (item, when, write) => `点击「${item}」${when ? `且 ${when} 时` : ""}，${write}。`,
    look: (a) => [a.label && `文字变成「${a.label}」`, a.icon && `图标是 ${a.icon}`, a.variant && `样式是 ${a.variant}`, a.color && `颜色是 ${a.color}`].filter(Boolean).join("，") || "外观改变",
    tapHow: "点击后",
    afterHow: (seconds) => `${seconds} 秒后`,
    drawnLook: "起始外观",
    changeJoin: "、",
    lookChange: {
      label: (v) => `显示为「${v}」`,
      icon: (v) => `图标 ${v}`,
      color: (v) => `颜色 ${v}`,
      variant: (v) => `样式 ${v}`,
      off: "置灰并停止响应",
      grow: "放大",
      hide: "隐藏",
    },
    step: (item, how, to, changes, extra) => `${how}，「${item}」变成${to}${changes ? `（${changes}）` : ""}${extra ? `。${extra}` : "。"}`,
    state: {
      disable: (item) => `点击「${item}」后置灰，不再响应。`,
      cooldown: (item, _value, seconds) => `点击「${item}」后该组件置灰 ${seconds} 秒并显示倒计时，倒计时结束后恢复原样式。`,
      label: (item, value) => `点击「${item}」后，文字变为「${value}」。`,
      color: (item, value) => `点击「${item}」后，颜色变为 ${value}。`,
      icon: (item, value) => `点击「${item}」后图标变为 ${value}，再点击一次恢复原样。`,
      variant: (item, value) => `点击「${item}」后，样式变为「${value}」。`,
      grow: (item) => `点击「${item}」后，该组件会变大。`,
      hide: (item) => `点击「${item}」后，该组件隐藏。`,
    },
  },
  ko: {
    title: "화면 흐름",
    empty: "캔버스에 화면이 아직 없습니다.",
    emptyHint: "편집기에서 화면과 탭 전환을 만들면 여기에 흐름이 표시됩니다.",
    backToEditor: "편집기로 돌아가기",
    exportPng: "PNG 내보내기",
    exportMd: "설명 내보내기",
    note: "이 다이어그램은 문서에서 자동으로 만들어집니다.",
    transitions: "전환",
    noEdges: "화면을 잇는 전환이 아직 없습니다.",
    noRules: "이 화면에는 조작할 수 있는 요소가 없습니다.",
    tap: "탭",
    popup: "팝업",
    screen: "화면",
    backNote: "일부 요소가 이전 화면으로 돌아갑니다",
    untitled: "이름 없는 화면",
    itemCount: (n) => `조작할 수 있는 요소 ${n}개`,
    nodeSummary: (name, kind, detail) => `${name}은(는) ${kind}이며 ${detail}.`,
    edgeSummary: (from, to) => `${from}에서 ${to}(으)로 가는 전환입니다.`,
    backLine: (name, items) => `${name}의 "${items}"은(는) 이전 화면으로 돌아갑니다.`,
    railToggle: (item) => `"${item}"의 "V"를 누르면 내비게이션이 위아래로 접히고 "^"로 바뀌며, 다시 누르면 펼쳐집니다.`,
    barToggle: (item) => `"${item}"의 "<"를 누르면 내비게이션이 모두 접혀 ">"만 남고, 다시 누르면 원래대로 돌아옵니다.`,
    jump: (from, item, to) => `${from}의 "${item}" → ${to}`,
    jumpMarkdown: (from, item, to) => `${from}의 "${item}"을(를) 탭하면 ${to}(으)로 이동합니다.`,
    jumpLine: (from, item, to) => `- ${from}의 "${item}"을(를) 탭하면 ${to}(으)로 이동합니다.`,
    dialogOpen: (from, item, to) => `${from}의 "${item}" → ${to}(팝업)`,
    dialogLine: (from, item, to) => `${from}의 "${item}"을(를) 탭하면 ${to} 팝업이 열립니다.`,
    ruleWrite: (item, when, write) => `"${item}"을(를) 탭하면${when ? ` ${when}일 때` : ""} ${write}이(가) 됩니다.`,
    look: (a) => [a.label && `글자는 "${a.label}"`, a.icon && `아이콘은 ${a.icon}`, a.variant && `스타일은 ${a.variant}`, a.color && `색은 ${a.color}`].filter(Boolean).join(", ") || "모양이 바뀐다",
    tapHow: "탭하면",
    afterHow: (seconds) => `${seconds}초 뒤에`,
    drawnLook: "처음 모양",
    changeJoin: ", ",
    lookChange: {
      label: (v) => `글자는 "${v}"`,
      icon: (v) => `아이콘은 ${v}`,
      color: (v) => `색은 ${v}`,
      variant: (v) => `스타일은 ${v}`,
      off: "회색으로 바뀌고 반응하지 않음",
      grow: "커짐",
      hide: "숨겨짐",
    },
    step: (item, how, to, changes, extra) => `${how} "${item}"은(는) ${to}이(가) 됩니다${changes ? ` (${changes})` : ""}${extra ? `. ${extra}` : "."}`,
    state: {
      disable: (item) => `"${item}"을(를) 탭하면 이 요소를 사용할 수 없습니다.`,
      cooldown: (item, _value, seconds) => `"${item}"을(를) 탭하면 ${seconds}초 동안 회색으로 바뀌고 카운트다운이 끝나면 원래 모양으로 돌아옵니다.`,
      label: (item, value) => `"${item}"을(를) 탭하면 문구가 "${value}"(으)로 바뀝니다.`,
      color: (item, value) => `"${item}"을(를) 탭하면 색이 ${value}(으)로 바뀝니다.`,
      icon: (item, value) => `"${item}"을(를) 탭하면 아이콘이 ${value}(으)로 바뀌고, 다시 탭하면 원래대로 돌아옵니다.`,
      variant: (item, value) => `"${item}"을(를) 탭하면 스타일이 ${value}(으)로 바뀝니다.`,
      grow: (item) => `"${item}"을(를) 탭하면 이 요소가 커집니다.`,
      hide: (item) => `"${item}"을(를) 탭하면 이 요소가 숨겨집니다.`,
    },
  },
};

/** a part's name, the way the layers panel says it; a picture-only part falls
 *  back to its kind's noun so a rule never reads as an empty pair of quotes */
export function itemNameOf(it: Item, lang: Lang): string {
  const spec = KIND_SPEC[it.kind] ?? KIND_SPEC.box;
  const noun = KIND_TEXT[lang][it.kind]?.noun ?? spec.label;
  return it.label.trim() || noun;
}

/** The name of what was actually tapped. On a bar the tapped thing is a destination or
 *  an icon, not the bar itself: a bottom bar whose second destination reads "Battle"
 *  says "tapping Battle", never "tapping the navigation bar". */
export function triggerNameOf(it: Item, slot: string, lang: Lang): string {
  if (slot.startsWith("tab:")) {
    const i = Number(slot.slice(4));
    const label = (it.tabs?.[i]?.label ?? "").trim();
    return label || `${itemNameOf(it, lang)} ${i + 1}`;
  }
  if (slot === "icon" || slot === "icon2") {
    /* a bar the author named keeps that name; otherwise the icon is what is on screen */
    const own = it.label.trim();
    if (own) return own;
    const icon = (slot === "icon" ? it.icon : it.icon2) ?? "";
    return icon || itemNameOf(it, lang);
  }
  return itemNameOf(it, lang);
}

/** the name shown for a frame; a nameless frame still gets a readable title */
export const frameNameOf = (name: string, lang: Lang): string => name.trim() || FLOW_TEXT[lang].untitled;

/** Every part of a group in canvas order, a container's children walking with it.
 *  A child's own x / y is ignored: the flow only cares what it does. */
export function itemsOf(group: Group): Item[] {
  const out: Item[] = [];
  for (const it of group.items) out.push(...subtreeOf(it));
  return out;
}

/** The words a look reads as: what its author called it, or the line it shows while the part is
 *  in it. */
function lookWords(it: Item, flow: PartFlow | undefined, id: string, lang: Lang): string {
  if (id === START_LOOK) return FLOW_TEXT[lang].drawnLook;
  const look = flow?.looks.find((l) => l.id === id);
  if (!look) return FLOW_TEXT[lang].drawnLook;
  return look.name?.trim() || lookItem(it, look).label.trim() || itemNameOf(it, lang);
}

/** What one look changes about its part, in words. */
function lookChanges(flow: PartFlow | undefined, id: string, lang: Lang): string {
  const look = flow?.looks.find((l) => l.id === id);
  if (!look) return "";
  const w = FLOW_TEXT[lang].lookChange;
  const out: string[] = [];
  if (look.label !== undefined) out.push(w.label(look.label));
  if (look.icon !== undefined) out.push(w.icon(look.icon ?? "—"));
  if (look.color !== undefined) out.push(w.color(look.color));
  if (look.variant !== undefined) out.push(w.variant(look.variant));
  if (look.disabled) out.push(w.off);
  if (look.grow) out.push(w.grow);
  if (look.hidden) out.push(w.hide);
  return out.join(FLOW_TEXT[lang].changeJoin);
}

/** One step of a machine as a sentence: how it starts, where it lands, and what else it does. */
function stepText(it: Item, flow: PartFlow | undefined, step: PartStep, who: string, lang: Lang, when: string): string {
  const x = FLOW_TEXT[lang];
  const how = step.trigger.kind === "after" ? x.afterHow(String(step.trigger.seconds)) : x.tapHow;
  const extra = (step.do ?? []).map((a) => actionWords(a, lang)).filter(Boolean).join(x.changeJoin);
  const line = x.step(who, how, lookWords(it, flow, step.to, lang), lookChanges(flow, step.to, lang), extra);
  return when ? `${line}（${when}）` : line;
}

/** What else a step does, for the actions that are not a jump of their own. */
function actionWords(a: RuleAction, lang: Lang): string {
  if (a.kind === "look") return FLOW_TEXT[lang].look(a);
  if (a.kind === "set" || a.kind === "add" || a.kind === "toggle") return "";
  return "";
}

/** What a tap rule says: disable, cooldown, label, variant and hide, composed for the requested
 *  language. Documents written before a part's machine existed carry these; the editor reads them
 *  back as flows, so this is only reached by a document that was never opened. */
export function stateText(st: ItemState, label: string, lang: Lang): string {
  const say = FLOW_TEXT[lang].state[st.effect];
  if (!say) return "";
  return say(label, (st.value ?? "").trim(), String(st.seconds ?? 0));
}

/** One screen's sentence: its kind, how many of its parts react to a tap, and
 *  whether anything on it goes back. Back actions carry no edge, so a screen
 *  tells about them here instead. */
function describeNode(name: string, popup: boolean, interactive: number, back: string[], lang: Lang, level: OverlayLevel | null = null): string {
  const x = FLOW_TEXT[lang];
  /* an overlay page reads as its own level — a dialog, a panel, a system layer — rather than
     as a plain popup, because that word is what tells the reader how a tap behaves */
  const kind = level ? overlayLevelText(level, lang) : popup ? x.popup : x.screen;
  const head = x.nodeSummary(name, kind, x.itemCount(interactive));
  return `${head}${back.length ? ` ${x.backLine(name, back.join("、"))}` : ""}`;
}

/** The frame ids the home screen reaches by jumps, breadth first; a frame in a
 *  cycle or with no incoming transition is never reached and keeps depth 0. */
function depthsOf(homeId: string | undefined, jumps: Map<string, Set<string>>): Map<string, number> {
  const depth = new Map<string, number>();
  if (!homeId) return depth;
  depth.set(homeId, 0);
  const queue = [homeId];
  for (let i = 0; i < queue.length; i++) {
    for (const to of jumps.get(queue[i]) ?? []) {
      if (depth.has(to)) continue;
      depth.set(to, (depth.get(queue[i]) ?? 0) + 1);
      queue.push(to);
    }
  }
  return depth;
}

/** the frame a run sits in: the one containing the centre of its bounds, the same
 *  rule the canvas uses to decide which screen draws a run */
function frameOfGroup(g: Group, frames: Doc["frames"]): string {
  const bb = groupBounds(g, {});
  const cx = (bb.l + bb.r) / 2;
  const cy = (bb.t + bb.b) / 2;
  const hit = frames.find((f) => {
    const r = frameRect(f);
    return cx >= r.l && cx <= r.r && cy >= r.t && cy <= r.b;
  });
  /* a run outside every frame still belongs to the app: it is read on the first
   * screen rather than dropped, so no interaction is ever lost from the flow */
  return hit?.id ?? frames[0]?.id ?? "";
}

/**
 * The frame graph of a document plus the prose describing it.
 *
 * A frame is a **popup** when it is not the first frame, is opened from some
 * other frame, and opens nothing itself (no jump to any frame). Anything else is
 * a screen: the first frame, a frame nothing reaches (an orphan the author can
 * still jump to later), a frame with outgoing transitions, and every frame of a
 * cycle. The rule reads one frame at a time, so it never depends on the order
 * the frames happen to be stored in, beyond "the first frame is the home screen".
 *
 * Depth is the breadth-first distance from the first frame; a frame that is
 * never reached keeps depth 0 but is still listed, in frame order.
 */
export function buildFlow(doc: Doc, lang: Lang): Flow {
  const x = FLOW_TEXT[lang];
  const frames = doc.frames;
  const frameIds = new Set(frames.map((f) => f.id));
  /* the home screen is the first page that is a screen: an overlay can be listed first on
     the canvas and is still not where the visitor starts */
  const homeId = frames.find((f) => !isOverlayFrame(f))?.id;
  const overlayIds = new Set(frames.filter(isOverlayFrame).map((f) => f.id));
  /* the declared variables: conditions and writes are named by them, not by id */
  const vars: Var[] = doc.vars ?? [];
  const nameOf = (id: string) => frameNameOf(frames.find((f) => f.id === id)?.name ?? "", lang);

  /* A dialog lives on its own page as a hidden overlay, but the flow still reads it as a
   * place of its own, so a button that pops one draws the same A → A弹框 line. */
  const dialogs = new Map<string, string>();
  for (const g of doc.groups) {
    for (const it of itemsOf(g)) if (it.modal) dialogs.set(it.id, frameNameOf(it.label, lang));
  }
  const nodeName = (id: string) => dialogs.get(id) ?? nameOf(id);

  const rules = new Map<string, FlowRule[]>(frames.map((f) => [f.id, []]));
  const jumps = new Map<string, Set<string>>(frames.map((f) => [f.id, new Set<string>()]));
  const back = new Map<string, string[]>(frames.map((f) => [f.id, []]));
  /* parts that react to a tap; a part counts once however many rules it carries,
   * and a back action counts too even though it leaves no rule behind */
  const reactions = new Map<string, Set<string>>(frames.map((f) => [f.id, new Set<string>()]));

  for (const g of doc.groups) {
    const from = frameOfGroup(g, frames);
    if (!rules.has(from)) continue;
    for (const it of itemsOf(g)) {
      const label = itemNameOf(it, lang);
      let reacts = false;
      for (const { slot, action } of actionsOf(it)) {
        /* what the visitor taps is the destination or icon, so that is what the edge says */
        const hit = triggerNameOf(it, slot, lang);
        if (action.to === BACK_TARGET) {
          /* a back action pops the preview stack, so it is no edge at all */
          back.get(from)?.push(hit);
          reacts = true;
          continue;
        }
        const isDialog = dialogs.has(action.to);
        if ((!frameIds.has(action.to) && !isDialog) || action.to === from) continue;
        /* an overlay page is popped over the screen that tapped it, so the edge reads the
           same way a dialog does even though the target is a page of its own */
        const over = overlayIds.has(action.to);
        const pops = !!action.dialog || over;
        jumps.get(from)?.add(action.to);
        rules.get(from)?.push({
          kind: "jump",
          nodeId: from,
          itemId: it.id,
          itemLabel: hit,
          toFrameId: action.to,
          dialog: pops,
          description: pops ? x.dialogLine(nameOf(from), hit, nodeName(action.to)) : x.jumpMarkdown(nameOf(from), hit, nodeName(action.to)),
        });
        reacts = true;
      }
      /* Conditional taps: a rule that goes somewhere is an edge like any other, with its
         condition spelled out on it; a rule that writes a variable is a rule of the part. */
      const self = triggerNameOf(it, "", lang);
      for (const rule of it.rules ?? []) {
        const a = rule.do;
        const when = (rule.when ?? []).map((c) => conditionText(c, vars)).join(", ");
        if (a.kind === "back") {
          back.get(from)?.push(when ? `${self} (${when})` : self);
          reacts = true;
          continue;
        }
        if (a.kind === "close") {
          rules.get(from)?.push({ kind: "state", itemId: it.id, itemLabel: self, description: x.ruleWrite(label, when, "close") });
          reacts = true;
          continue;
        }
        if (a.kind === "goto") {
          const isDialog = dialogs.has(a.to);
          if ((!frameIds.has(a.to) && !isDialog) || a.to === from) continue;
          /* an overlay page is popped over the screen that tapped it, so the edge reads the
             same way a dialog does even though the target is a page of its own */
          const pops = isDialog || overlayIds.has(a.to);
          const named = when ? `${self} · ${when}` : self;
          jumps.get(from)?.add(a.to);
          rules.get(from)?.push({
            kind: "jump",
            nodeId: from,
            itemId: it.id,
            itemLabel: named,
            toFrameId: a.to,
            dialog: pops,
            description: pops ? x.dialogLine(nameOf(from), named, nodeName(a.to)) : x.jumpMarkdown(nameOf(from), named, nodeName(a.to)),
          });
          reacts = true;
          continue;
        }
        /* a look rule changes what the part shows while its conditions hold, so it reads as a
           state of that part rather than as a jump */
        if (a.kind === "look") {
          rules.get(from)?.push({ kind: "state", itemId: it.id, itemLabel: label, description: x.ruleWrite(label, when, x.look(a)) });
          reacts = true;
          continue;
        }
        const written = vars.find((v) => v.id === a.varId);
        if (!written) continue;
        rules.get(from)?.push({ kind: "state", itemId: it.id, itemLabel: label, description: x.ruleWrite(label, when, writeText(written, a)) });
        reacts = true;
      }
      /* a bar's own collapse button belongs to the flow too: it is a state change */
      if (it.kind === "navRail" && isWideRail(it)) {
        rules.get(from)?.push({ kind: "state", itemId: it.id, itemLabel: label, description: x.railToggle(label) });
        reacts = true;
      }
      if (it.kind === "bottomNav" && it.barFolded !== undefined) {
        rules.get(from)?.push({ kind: "state", itemId: it.id, itemLabel: label, description: x.barToggle(label) });
        reacts = true;
      }
      /* The machine a part runs reads as the moves it makes: one line per step, named after the
         look it lands in. A step that jumps is an edge of the screen flow like any other tap. */
      const sayMachine = (machine: PartFlow | undefined, who: string) => {
        for (const st of machine?.steps ?? []) {
          const when = (st.when ?? []).map((c) => conditionText(c, vars)).join("、");
          for (const a of st.do ?? []) {
            if (a.kind !== "goto" || (!frameIds.has(a.to) && !dialogs.has(a.to)) || a.to === from) continue;
            jumps.get(from)?.add(a.to);
            rules.get(from)?.push({
              kind: "jump",
              nodeId: from,
              itemId: it.id,
              itemLabel: who,
              toFrameId: a.to,
              dialog: dialogs.has(a.to) || overlayIds.has(a.to),
              description: x.jumpMarkdown(nameOf(from), who, nodeName(a.to)),
            });
          }
          rules.get(from)?.push({ kind: "state", itemId: it.id, itemLabel: who, description: stepText(it, machine, st, who, lang, when) });
          reacts = true;
        }
      };
      sayMachine(it.flow, label);
      /* a bar's destinations carry a machine of their own: they are named by their label */
      for (const [slot, machine] of Object.entries(it.slotFlows ?? {})) {
        const name = actionSlotsOf(it).find((s2) => s2.key === slot)?.label ?? slot;
        sayMachine(machine, `${label} · ${name}`);
      }
      /* the state rules a document was written with, for one that was never opened in the editor */
      for (const st of it.states ?? []) {
        const description = stateText(st, label, lang);
        if (!description) continue;
        rules.get(from)?.push({ kind: "state", itemId: it.id, itemLabel: label, description });
        reacts = true;
      }
      if (reacts) reactions.get(from)?.add(it.id);
    }
  }

  const depth = depthsOf(homeId, jumps);

  const nodes: FlowNode[] = frames.map((f) => {
    const reached = (depth.get(f.id) ?? 0) > 0;
    const opens = (jumps.get(f.id)?.size ?? 0) > 0;
    /* an overlay page is a popup by definition — it is opened over a screen, whatever it
       does afterwards — while a screen is a popup only when nothing but its opener leads
       anywhere from it */
    const overlay = isOverlayFrame(f) ? overlayLevelOfFrame(f) : null;
    const kind: FlowNodeKind = overlay || (f.id !== homeId && reached && !opens) ? "popup" : "screen";
    return {
      id: f.id,
      kind,
      label: nameOf(f.id),
      description: describeNode(nameOf(f.id), kind === "popup", reactions.get(f.id)?.size ?? 0, back.get(f.id) ?? [], lang, overlay),
      rules: rules.get(f.id) ?? [],
      depth: depth.get(f.id) ?? 0,
      ...(overlay ? { overlay } : undefined),
    };
  });

  /* every dialog overlay is a place the flow can land on: a popup that belongs to its page */
  for (const [id, label] of dialogs) {
    if (nodes.some((n) => n.id === id)) continue;
    nodes.push({
      id,
      kind: "popup",
      label,
      description: describeNode(label, true, 0, [], lang),
      rules: [],
      depth: depth.get(id) ?? 0,
    });
  }

  /* one edge per from→to pair, with every trigger of that pair merged in */
  const edges: FlowEdge[] = [];
  const at = new Map<string, number>();
  for (const n of nodes) {
    for (const r of n.rules) {
      if (r.kind !== "jump") continue;
      const id = `${r.nodeId}->${r.toFrameId}`;
      const i = at.get(id);
      if (i === undefined) {
        at.set(id, edges.length);
        edges.push({
          id,
          from: r.nodeId,
          to: r.toFrameId,
          label: r.dialog ? x.dialogOpen(nameOf(r.nodeId), r.itemLabel, nodeName(r.toFrameId)) : x.jump(nameOf(r.nodeId), r.itemLabel, nodeName(r.toFrameId)),
          description: r.description,
          triggers: [{ itemId: r.itemId, itemLabel: r.itemLabel }],
        });
      } else {
        edges[i].triggers.push({ itemId: r.itemId, itemLabel: r.itemLabel });
      }
    }
  }

  return { nodes, edges, order: nodes.map((n) => n.id) };
}

/** The flow as a Markdown document: a section per screen with every rule spelled
 *  out, then every transition, then each screen's state rules once more. */
export function flowMarkdown(flow: Flow, lang: Lang): string {
  const x = FLOW_TEXT[lang];
  const labelOf = new Map(flow.nodes.map((n) => [n.id, n.label]));
  const lines: string[] = [`# ${x.title}`, ""];

  if (flow.nodes.length === 0) {
    lines.push(x.empty, "", x.emptyHint, "");
    return lines.join("\n");
  }

  for (const n of flow.nodes) {
    lines.push(`## ${n.label}`, "", n.description, "");
    if (n.rules.length === 0) lines.push(x.noRules, "");
    for (const r of n.rules) lines.push(`- ${r.description}`);
    if (n.rules.length > 0) lines.push("");
  }

  lines.push(`## ${x.transitions}`, "");
  if (flow.edges.length === 0) lines.push(x.noEdges, "");
  for (const e of flow.edges) lines.push(`- ${labelOf.get(e.from) ?? e.from} → ${labelOf.get(e.to) ?? e.to}: ${e.description}`);
  if (flow.edges.length > 0) lines.push("");

  /* the state rules once more, gathered per screen, so the document ends on what
   *  a tap changes rather than on where a tap goes */
  let states = 0;
  for (const n of flow.nodes) {
    for (const r of n.rules) {
      if (r.kind !== "state") continue;
      lines.push(`- ${n.label}: ${r.description}`);
      states++;
    }
  }
  if (states > 0) lines.push("");
  return lines.join("\n");
}
