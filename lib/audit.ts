import {
  BACK_TARGET,
  START_LOOK,
  actionsOf,
  readVars,
  ruleVars,
  frameOfGroup,
  groupsInFrame,
  isOverlayFrame,
  isOverlayItem,
  overlayLevelOf,
  overlayLevelOfFrame,
  overlayRuleOf,
  subtreeOf,
  type Doc,
  type Frame,
  type Item,
  type OverlayLevel,
} from "./tokens";
import type { Lang } from "./i18n";

/* The walkthrough report: what a play-through would run into, worked out from the document
 * alone. Nothing here reads the DOM, storage or the clock, so the same document always
 * yields the same list, and the panel can recompute it on every keystroke.
 *
 * The checks are the ones a prototype has to pass to be playable end to end: every tap
 * lands somewhere, every page can be reached, every overlay can be opened *and* closed, and
 * no screen is a dead end. Each issue names the page and the part to fix, so the report is a
 * to-do list rather than a verdict. */

export type AuditSeverity = "error" | "warning" | "info";

export type AuditKind =
  /** a tap points at a page or part that is not in the document any more */
  | "deadLink"
  /** a layer the visitor cannot leave: a system layer with no Back action of its own */
  | "overlayTrapped"
  /** an overlay page no tap ever opens */
  | "orphanOverlay"
  /** an in-page dialog no tap ever opens */
  | "orphanOverlayItem"
  /** a page nothing leads to */
  | "unreachable"
  /** a screen with nothing left to do on it */
  | "deadEnd"
  /** a tap that leads back to the page it sits on */
  | "selfJump"
  /** a rule names a variable the document does not declare */
  | "missingVar"
  /** a part's text reads `{name}` and nothing declares that name */
  | "unknownBinding"
  /** a variable nothing reads and nothing writes */
  | "unusedVar"
  /** a tab row holding more panels than it has tabs: the extra ones are never drawn */
  | "extraPanel"
  /** a step of a part's machine lands in a look that is not there any more */
  | "danglingLook"
  /** a look nothing moves the part into: a state an author drew but never reaches */
  | "unreachableLook"
  /** a page with no parts on it */
  | "emptyFrame"
  /** no pages at all: a blank canvas */
  | "noPages";

export type AuditIssue = {
  kind: AuditKind;
  severity: AuditSeverity;
  /** the page the issue is about; null when the part sits outside every page */
  frameId: string | null;
  /** the part that causes it, when one does */
  itemId: string | null;
  /** the id a broken link points at, so the report can say which one it was */
  targetId?: string;
  /** the variable a rule names, or the name a piece of text reads */
  varId?: string;
};

/** how bad each check is: an error breaks the prototype, a warning is probably a mistake */
export const AUDIT_SEVERITY: Record<AuditKind, AuditSeverity> = {
  deadLink: "error",
  overlayTrapped: "error",
  missingVar: "error",
  orphanOverlay: "warning",
  orphanOverlayItem: "warning",
  unreachable: "warning",
  deadEnd: "warning",
  selfJump: "warning",
  unknownBinding: "warning",
  extraPanel: "warning",
  danglingLook: "warning",
  emptyFrame: "info",
  unreachableLook: "info",
  unusedVar: "info",
  noPages: "info",
};

export const AUDIT_KINDS = Object.keys(AUDIT_SEVERITY) as AuditKind[];
const RANK: Record<AuditSeverity, number> = { error: 0, warning: 1, info: 2 };

/** the icon a severity or a check shows in the panel */
export const AUDIT_ICONS: Record<AuditSeverity, string> = { error: "error", warning: "warning", info: "info" };
export const AUDIT_KIND_ICONS: Record<AuditKind, string> = {
  deadLink: "link_off",
  overlayTrapped: "lock",
  orphanOverlay: "visibility_off",
  orphanOverlayItem: "layers_clear",
  unreachable: "wrong_location",
  deadEnd: "block",
  selfJump: "sync_problem",
  missingVar: "help",
  unknownBinding: "spellcheck",
  unusedVar: "inventory_2",
  extraPanel: "space_dashboard",
  danglingLook: "search_off",
  unreachableLook: "help_center",
  emptyFrame: "crop_square",
  noPages: "note_add",
};

/**
 * Whether a layer the visitor is inside can be left. A level the visitor may dismiss needs nothing;
 * one that refuses both the back key and the tap beside it (a system layer) has to carry its own
 * way out — a rule that closes the overlay, or a tap that goes somewhere. A Back action does *not*
 * count there: the back gesture is exactly what the level refuses.
 */
function canLeave(parts: Item[], level: OverlayLevel): boolean {
  const rule = overlayRuleOf(level);
  if (rule.dismissOnBack || rule.dismissOnOutside) return true;
  return parts.some(
    (it) =>
      actionsOf(it).some(({ action }) => action.to !== BACK_TARGET) ||
      (it.rules ?? []).some((r) => r.do.kind === "close" || r.do.kind === "goto"),
  );
}

/**
 * Every issue in a document, worst first. `widths` decides which page a run of parts belongs
 * to, exactly as the canvas does, so a part the author dragged onto a page is judged there.
 */
export function audit(doc: Doc, widths: Record<string, number>): AuditIssue[] {
  const out: AuditIssue[] = [];
  const frames = doc.frames;
  const frameIds = new Set(frames.map((f) => f.id));
  const push = (kind: AuditKind, frameId: string | null, itemId: string | null, targetId?: string, varId?: string) =>
    out.push({ kind, severity: AUDIT_SEVERITY[kind], frameId, itemId, ...(targetId !== undefined ? { targetId } : undefined), ...(varId !== undefined ? { varId } : undefined) });

  /* the variables the document declares, and the ones its text and rules actually name */
  const declaredVars = doc.vars ?? [];
  const declaredIds = new Set(declaredVars.map((v) => v.id));
  const declaredNames = new Set(declaredVars.map((v) => v.name));
  const usedIds = new Set<string>();

  if (frames.length === 0) push("noPages", null, null);

  /* Every part of every page, with the page it reads as belonging to. A link may point at a
     dialog that sits further down the document, so the whole document is read once before
     any link is judged. */
  const placed = doc.groups.map((g) => ({ g, frame: frameOfGroup(g, frames, widths) }));
  const overlayItems = new Map<string, { item: Item; frameId: string | null }>();
  for (const { g, frame } of placed) {
    for (const it of g.items.flatMap(subtreeOf)) {
      if (isOverlayItem(it)) overlayItems.set(it.id, { item: it, frameId: frame?.id ?? null });
    }
  }

  /* what every page can be left for: the graph the reachability walk below follows */
  const outgoing = new Map<string, Set<string>>(frames.map((f) => [f.id, new Set<string>()]));
  const targets = new Set<string>();
  for (const { g, frame } of placed) {
    const frameId = frame?.id ?? null;
    for (const it of g.items.flatMap(subtreeOf)) {
      for (const { action } of actionsOf(it)) {
        if (action.to === BACK_TARGET) continue;
        targets.add(action.to);
        /* a tap that leads nowhere, or back to the page it already stands on */
        if (!frameIds.has(action.to) && !overlayItems.has(action.to)) {
          push("deadLink", frameId, it.id, action.to);
          continue;
        }
        if (frameId && action.to === frameId) push("selfJump", frameId, it.id);
        if (frameId && frameIds.has(action.to)) outgoing.get(frameId)?.add(action.to);
      }
      /* a conditional tap leads somewhere just as a plain one does, and names variables the
         document has to declare: an undeclared one makes the rule silently do nothing */
      for (const rule of it.rules ?? []) {
        for (const id of ruleVars(rule).read) {
          usedIds.add(id);
          if (!declaredIds.has(id)) push("missingVar", frameId, it.id, undefined, id);
        }
        for (const id of ruleVars(rule).write) {
          usedIds.add(id);
          if (!declaredIds.has(id)) push("missingVar", frameId, it.id, undefined, id);
        }
        const a = rule.do;
        if (a.kind !== "goto") continue;
        targets.add(a.to);
        if (!frameIds.has(a.to) && !overlayItems.has(a.to)) {
          push("deadLink", frameId, it.id, a.to);
          continue;
        }
        if (frameId && a.to === frameId) push("selfJump", frameId, it.id);
        if (frameId && frameIds.has(a.to)) outgoing.get(frameId)?.add(a.to);
      }
      /* The machine a part runs: a step that lands in a look the machine does not have would draw
         the part as drawn, and a look nothing leads into is a state the visitor never sees. */
      for (const machine of [...(it.flow ? [it.flow] : []), ...Object.values(it.slotFlows ?? {})]) {
        const looks = new Set(machine.looks.map((l) => l.id));
        const reached = new Set<string>([START_LOOK]);
        for (const st of machine.steps) {
          if (st.from !== START_LOOK && !looks.has(st.from)) push("danglingLook", frameId, it.id, st.from);
          if (st.to !== START_LOOK && !looks.has(st.to)) push("danglingLook", frameId, it.id, st.to);
          else reached.add(st.to);
          for (const c of st.when ?? []) {
            usedIds.add(c.varId);
            if (!declaredIds.has(c.varId)) push("missingVar", frameId, it.id, undefined, c.varId);
          }
          for (const a of st.do ?? []) {
            if (a.kind === "goto") {
              targets.add(a.to);
              if (!frameIds.has(a.to) && !overlayItems.has(a.to)) push("deadLink", frameId, it.id, a.to);
              else if (frameId && frameIds.has(a.to)) outgoing.get(frameId)?.add(a.to);
              continue;
            }
            if (a.kind !== "set" && a.kind !== "add" && a.kind !== "toggle") continue;
            usedIds.add(a.varId);
            if (!declaredIds.has(a.varId)) push("missingVar", frameId, it.id, undefined, a.varId);
          }
        }
        for (const l of machine.looks) if (!reached.has(l.id)) push("unreachableLook", frameId, it.id, l.id);
      }
      /* A tab row switches between its panels by position, so a panel past the last tab has no tab
         that could ever bring it forward: it would simply never be drawn. */
      if (it.kind === "tabs" && (it.children?.length ?? 0) > (it.tabs?.length ?? 0)) push("extraPanel", frameId, it.id);
      /* text that reads a variable: an unknown name stays on the screen, which is worth a
         warning rather than an error, since the screen still reads */
      for (const name of [...readVars(it.label), ...readVars(it.supporting), ...(it.tabs ?? []).flatMap((t) => readVars(t.label))]) {
        const v = declaredVars.find((d) => d.name === name);
        if (v) usedIds.add(v.id);
        else push("unknownBinding", frameId, it.id, undefined, name);
      }
    }
  }

  /* a page nothing reaches: walk the taps from the home screen, swipes included */
  const homeId = frames.find((f) => !isOverlayFrame(f))?.id;
  const reached = new Set<string>();
  if (homeId) reached.add(homeId);
  const queue = homeId ? [homeId] : [];
  for (let i = 0; i < queue.length; i++) {
    const from = frames.find((f) => f.id === queue[i]);
    const next = [...(outgoing.get(queue[i]) ?? [])];
    for (const to of Object.values(from?.swipe ?? {})) if (to) next.push(to);
    for (const to of next) {
      if (reached.has(to) || !frameIds.has(to)) continue;
      reached.add(to);
      queue.push(to);
    }
  }

  const partsOf = (f: Frame) => groupsInFrame(doc.groups, f, frames, widths).flatMap((g) => g.items.flatMap(subtreeOf));

  for (const f of frames) {
    const parts = partsOf(f);
    /* An overlay has to be openable and closable; a screen has to be reachable and to lead
       somewhere. An overlay is reached by being opened, so "unreachable" never applies to it. */
    if (isOverlayFrame(f)) {
      if (!targets.has(f.id)) push("orphanOverlay", f.id, null);
      if (!canLeave(parts, overlayLevelOfFrame(f))) push("overlayTrapped", f.id, null);
    } else {
      if (f.id !== homeId && !reached.has(f.id)) push("unreachable", f.id, null);
      const leads = (outgoing.get(f.id)?.size ?? 0) > 0 || Object.values(f.swipe ?? {}).some(Boolean);
      const reacts = parts.some((it) => actionsOf(it).length > 0 || (it.states?.length ?? 0) > 0);
      /* the home screen is checked as well: a prototype that cannot be advanced from its first
         screen cannot be played at all, and that is the first thing worth knowing */
      if (parts.length > 0 && !leads && !reacts) push("deadEnd", f.id, null);
    }
    if (parts.length === 0) push("emptyFrame", f.id, null);
  }

  /* an in-page dialog no tap opens, or one the visitor cannot close */
  for (const [id, { item, frameId }] of overlayItems) {
    if (!targets.has(id)) push("orphanOverlayItem", frameId, id);
    if (!canLeave(subtreeOf(item), overlayLevelOf(item)!)) push("overlayTrapped", frameId, id);
  }

  /* a variable nothing reads and nothing writes is dead weight in the panel */
  for (const v of declaredVars) {
    if (!usedIds.has(v.id)) push("unusedVar", null, null, undefined, v.name);
  }

  /* a blank canvas says one thing, not one thing per stray group */
  const blank = out.every((i) => i.kind === "noPages");
  const ordered = blank ? out : out.filter((i) => i.kind !== "noPages");
  return ordered.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

/** how many issues of each severity a report holds */
export function auditCounts(issues: AuditIssue[]): Record<AuditSeverity, number> {
  const counts: Record<AuditSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.severity] += 1;
  return counts;
}

/** Everything the panel says, in the four UI languages. */
export const AUDIT_TEXT: Record<
  Lang,
  {
    empty: string;
    emptyHint: string;
    summary: (errors: number, warnings: number, infos: number) => string;
    /** the button that takes the author to the page or part */
    locate: string;
    /** the id a broken link points at */
    missing: string;
    /** the id of a part rather than its label, when it has no label of its own */
    untitledPart: string;
    severity: Record<AuditSeverity, string>;
    label: Record<AuditKind, string>;
    hint: Record<AuditKind, string>;
  }
> = {
  ja: {
    empty: "問題は見つかりませんでした。",
    emptyHint: "どの画面も到達でき、重ねた画面は開いて閉じられます。",
    summary: (e, w, i) => `エラー ${e} 件・警告 ${w} 件・情報 ${i} 件`,
    locate: "この画面を表示",
    missing: "参照先",
    untitledPart: "名前のない部品",
    severity: { error: "エラー", warning: "警告", info: "情報" },
    label: {
      deadLink: "タップの移動先がありません",
      overlayTrapped: "重ねた画面から出られません",
      orphanOverlay: "この重ね画面は開かれません",
      orphanOverlayItem: "このダイアログは開かれません",
      unreachable: "この画面には到達できません",
      deadEnd: "この画面では何も起きません",
      selfJump: "タップが同じ画面に戻ります",
      missingVar: "ルールが存在しない変数を参照しています",
      unknownBinding: "テキストが存在しない変数名を読んでいます",
      unusedVar: "この変数は使われていません",
      extraPanel: "タブよりパネルが多いです",
      danglingLook: "状態の移動先がありません",
      unreachableLook: "この状態には何も移りません",
      emptyFrame: "この画面は空です",
      noPages: "画面がまだありません",
    },
    hint: {
      deadLink: "移動先を残っている画面に変えるか、タップの設定を消してください。",
      overlayTrapped: "中に「重ね画面を閉じる」ルールか、別の画面へ移動するボタンを置いてください。システム層は戻るキーでも外側のタップでも閉じられません。",
      orphanOverlay: "どこかのボタンからこの画面を開くか、通常の画面に戻してください。",
      orphanOverlayItem: "ボタンにこのダイアログを結び付けるか（遷移 → ダイアログ）、削除してください。",
      unreachable: "他の画面からリンクするか、この画面を削除してください。",
      deadEnd: "タップ・スワイプ・状態ルールのいずれかを足すと、先へ進めるようになります。",
      selfJump: "別の画面へ向けるか、「戻る」に変えてください。",
      missingVar: "「変数」で追加するか、既存の変数に変えてください。",
      unknownBinding: "名前は「変数」の名称と完全に一致させてください。固定の数字なら参照は不要です。",
      unusedVar: "読む部品も書き換えるルールもありません。削除するか {name} で表示してください。",
      extraPanel: "タブの数より多いパネルは表示されません。パネルを消すか、タブを増やしてください。",
      danglingLook: "その状態はもうありません。移動先を選び直すか、この段を削除してください。",
      unreachableLook: "どこからも来ない状態です。別の状態から線を引くか、削除してください。",
      emptyFrame: "部品を置くか、この画面を削除してください。",
      noPages: "画面と部品を足すと、ここにチェック結果が出ます。",
    },
  },
  en: {
    empty: "Nothing to fix.",
    emptyHint: "Every page can be reached, and every overlay can be opened and closed.",
    summary: (e, w, i) => `${e} errors · ${w} warnings · ${i} notes`,
    locate: "Show this page",
    missing: "Points at",
    untitledPart: "Untitled part",
    severity: { error: "Error", warning: "Warning", info: "Note" },
    label: {
      deadLink: "A tap leads nowhere",
      overlayTrapped: "This layer cannot be left",
      orphanOverlay: "Nothing opens this overlay",
      orphanOverlayItem: "Nothing opens this dialog",
      unreachable: "Nothing reaches this page",
      deadEnd: "Nothing happens on this screen",
      selfJump: "A tap leads back to its own page",
      missingVar: "A rule names a variable that is not declared",
      unknownBinding: "Text reads a variable name nothing declares",
      unusedVar: "This variable is never used",
      extraPanel: "More panels than tabs",
      danglingLook: "A step lands in a state that is gone",
      unreachableLook: "Nothing moves the part into this state",
      emptyFrame: "This page is empty",
      noPages: "There are no pages yet",
    },
    hint: {
      deadLink: "Point the action at a page that is still here, or clear the action.",
      overlayTrapped: "Put a part inside whose rule closes the overlay, or one that goes to another page: a system layer answers neither the back key nor a tap beside it.",
      orphanOverlay: "Open it from a button somewhere, or turn it back into a screen.",
      orphanOverlayItem: "Bind a button to this dialog (Transitions → dialog), or delete it.",
      unreachable: "Link to it from another page, or delete it.",
      deadEnd: "Add a tap, a swipe or a state rule so the visitor can move on.",
      selfJump: "Point it at another page, or make it go Back.",
      missingVar: "Add it in the Variables panel, or point the rule at one that exists.",
      unknownBinding: "The name has to match the Variables panel exactly. A fixed number needs no binding.",
      unusedVar: "No part reads it and no rule touches it. Delete it, or show it with {name}.",
      extraPanel: "A panel past the last tab is never drawn: delete it, or add a tab for it.",
      danglingLook: "That state is no longer there: point the step at another one, or delete it.",
      unreachableLook: "No step leads here: draw one from another state, or delete it.",
      emptyFrame: "Add parts, or delete the page.",
      noPages: "Add a page and a part and the checks show up here.",
    },
  },
  zh: {
    empty: "没有发现问题。",
    emptyHint: "所有页面都能到达，叠加层既能打开也能关闭。",
    summary: (e, w, i) => `${e} 个错误 · ${w} 个警告 · ${i} 条提示`,
    locate: "定位到此页面",
    missing: "指向",
    untitledPart: "未命名组件",
    severity: { error: "错误", warning: "警告", info: "提示" },
    label: {
      deadLink: "点击没有目标",
      overlayTrapped: "叠加层无法退出",
      orphanOverlay: "没有入口打开此叠加层",
      orphanOverlayItem: "没有入口打开此弹框",
      unreachable: "没有路径到达此页面",
      deadEnd: "此页面上什么都不会发生",
      selfJump: "点击回到了自己所在的页面",
      missingVar: "规则引用了不存在的变量",
      unknownBinding: "文本引用了不存在的变量名",
      unusedVar: "这个变量没有被用到",
      extraPanel: "面板比标签多",
      danglingLook: "流转的目标状态已不存在",
      unreachableLook: "没有任何流转能进入这个状态",
      emptyFrame: "此页面是空的",
      noPages: "还没有任何页面",
    },
    hint: {
      deadLink: "把跳转改到仍然存在的页面，或清除这个动作。",
      overlayTrapped: "在里面放一个「关闭叠加层」的规则，或一个跳转到其它页面的按钮：系统层既不响应返回键，也不响应点击外部。",
      orphanOverlay: "从某个按钮打开它，或者把它改回普通页面。",
      orphanOverlayItem: "给按钮绑定这个弹框（状态流转 → 弹框），或者删除它。",
      unreachable: "从其他页面链接到它，或者删除这个页面。",
      deadEnd: "加一个点击、滑动或状态规则，让用户能继续往下走。",
      selfJump: "把它指向别的页面，或者改成「返回」。",
      missingVar: "在「变量」页添加它，或者把规则改到已有的变量上。",
      unknownBinding: "名称要和「变量」里的名称完全一致；固定数字不需要引用。",
      unusedVar: "没有组件读取它，也没有规则读写它。可以删掉，或者用 {name} 显示出来。",
      extraPanel: "超出标签数量的面板不会显示：删掉它，或者为它增加一个标签。",
      danglingLook: "那个状态已经被删掉了：重新选择去向，或者删除这一步。",
      unreachableLook: "没有一条线能走到它：从别的状态连一条，或者删掉它。",
      emptyFrame: "放入组件，或者删除这个页面。",
      noPages: "添加页面和组件后，这里会显示检查结果。",
    },
  },
  ko: {
    empty: "고칠 것이 없습니다.",
    emptyHint: "모든 페이지에 도달할 수 있고, 모든 오버레이는 열고 닫을 수 있습니다.",
    summary: (e, w, i) => `오류 ${e}개 · 경고 ${w}개 · 참고 ${i}개`,
    locate: "이 페이지 보기",
    missing: "가리키는 대상",
    untitledPart: "이름 없는 부품",
    severity: { error: "오류", warning: "경고", info: "참고" },
    label: {
      deadLink: "탭이 아무 데도 가지 않습니다",
      overlayTrapped: "이 레이어에서 나갈 수 없습니다",
      orphanOverlay: "이 오버레이를 여는 곳이 없습니다",
      orphanOverlayItem: "이 대화상자를 여는 곳이 없습니다",
      unreachable: "이 페이지에 도달할 수 없습니다",
      deadEnd: "이 화면에서는 아무 일도 일어나지 않습니다",
      selfJump: "탭이 자기 페이지로 돌아옵니다",
      missingVar: "규칙이 없는 변수를 가리킵니다",
      unknownBinding: "텍스트가 없는 변수 이름을 읽습니다",
      unusedVar: "이 변수는 쓰이지 않습니다",
      extraPanel: "패널이 탭보다 많습니다",
      danglingLook: "상태의 이동 대상이 없습니다",
      unreachableLook: "이 상태로 들어오는 것이 없습니다",
      emptyFrame: "이 페이지는 비어 있습니다",
      noPages: "아직 페이지가 없습니다",
    },
    hint: {
      deadLink: "남아 있는 페이지로 바꾸거나 이 동작을 지우세요.",
      overlayTrapped: "안에 '오버레이 닫기' 규칙이나 다른 페이지로 가는 버튼을 넣으세요. 시스템 레이어는 뒤로 가기 키와 바깥 탭 모두 듣지 않습니다.",
      orphanOverlay: "어딘가의 버튼에서 열거나 다시 일반 화면으로 바꾸세요.",
      orphanOverlayItem: "버튼에 이 대화상자를 연결하거나(전환 → 대화상자) 삭제하세요.",
      unreachable: "다른 페이지에서 연결하거나 이 페이지를 삭제하세요.",
      deadEnd: "탭, 스와이프, 상태 규칙 중 하나를 더하면 계속 진행할 수 있습니다.",
      selfJump: "다른 페이지로 돌리거나 '뒤로'로 바꾸세요.",
      missingVar: "'변수'에서 추가하거나 있는 변수로 바꾸세요.",
      unknownBinding: "이름은 '변수'의 이름과 정확히 같아야 합니다. 고정 숫자에는 참조가 필요 없습니다.",
      unusedVar: "읽는 부품도, 쓰는 규칙도 없습니다. 삭제하거나 {name}으로 표시하세요.",
      extraPanel: "탭 수보다 많은 패널은 표시되지 않습니다. 패널을 지우거나 탭을 늘리세요.",
      danglingLook: "그 상태는 더 이상 없습니다. 이동 대상을 다시 고르거나 이 단계를 삭제하세요.",
      unreachableLook: "어디서도 들어올 수 없는 상태입니다. 다른 상태에서 선을 잇거나 삭제하세요.",
      emptyFrame: "부품을 넣거나 이 페이지를 삭제하세요.",
      noPages: "페이지와 부품을 추가하면 여기에 점검 결과가 나옵니다.",
    },
  },
};
