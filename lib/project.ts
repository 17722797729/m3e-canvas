import {
  DEFAULT_PALETTE_KEY,
  Doc,
  Frame,
  Group,
  Item,
  ItemState,
  KIND_ORDER,
  KIND_SPEC,
  MARK_GAP_MAX,
  LEGACY_KINDS,
  NavTab,
  PartFlow,
  PlacedItem,
  Prize,
  REMOVED_KINDS,
  Radii,
  Reward,
  ROT_MAX,
  SIDE_RAIL_MAX,
  SIDE_RAIL_MIN,
  TIMER_VALUE_MAX,
  VARIANTS,
  assetPillRadius,
  itemCellRadius,
  clamp,
  Kind,
  isButtonShape,
  isCardAlign,
  isCardImagePos,
  isCustomColor,
  isOverlayLevel,
  isPlace,
  isPlatform,
  isRemovedKind,
  isRuleKind,
  isStateEffect,
  isTabSide,
  isTextColor,
  isTimerUnit,
  isTrackThickness,
  isValueOp,
  isVariant,
  normalizeTheme,
  uid,
} from "./tokens";

/* A project file is the Doc as JSON, nothing more. Reading one back only checks
 * the shape the editor relies on; the same migrations that run on a saved
 * document then bring an older file up to date. */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/* A retired kind is still readable: the editor turns it into what the palette offers now. A kind
 *  this build dropped altogether is readable too, so a document holding one is still a document —
 *  the reader leaves those parts out instead (see readItem). */
const KINDS = new Set<string>([...KIND_ORDER, ...LEGACY_KINDS, ...REMOVED_KINDS]);

const validTabs = (tabs: unknown) =>
  tabs === undefined ||
  (Array.isArray(tabs) &&
    tabs.every(
      (tab) =>
        isRecord(tab) &&
        typeof tab.label === "string" &&
        (typeof tab.icon === "string" || tab.icon === null || tab.icon === undefined) &&
        /* a destination may hide its icon, and may carry a badge it can hide in turn */
        (tab.hideIcon === undefined || typeof tab.hideIcon === "boolean") &&
        (tab.badge === undefined || typeof tab.badge === "string") &&
        (tab.hideBadge === undefined || typeof tab.hideBadge === "boolean"),
    ));

/** the pool a prize wheel draws from: what each prize says, and how likely it is */
/** A reward track's list: where each reward waits, and what it hands out. `at` decides where its
 *  tile lands on the bar, so a value this build cannot read would draw the track wrong. */
const validRewards = (rewards: unknown) =>
  rewards === undefined ||
  (Array.isArray(rewards) &&
    rewards.every(
      (r) =>
        isRecord(r) &&
        Number.isFinite(r.at) &&
        (r.at as number) >= 0 &&
        typeof r.label === "string" &&
        (typeof r.icon === "string" || r.icon === null || r.icon === undefined),
    ));

const validPrizes = (prizes: unknown) =>
  prizes === undefined ||
  (Array.isArray(prizes) &&
    prizes.every(
      (pr) =>
        isRecord(pr) &&
        typeof pr.label === "string" &&
        (typeof pr.icon === "string" || pr.icon === null || pr.icon === undefined) &&
        (pr.weight === undefined || (Number.isFinite(pr.weight) && (pr.weight as number) >= 0)),
    ));

const validCorners = (c: unknown) => c === undefined || (isRecord(c) && ["tl", "tr", "bl", "br"].every((k) => Number.isFinite(c[k])));

/** one state transition hung on a part */
const validState = (s: unknown) =>
  isRecord(s) &&
  typeof s.id === "string" &&
  s.trigger === "tap" &&
  isStateEffect(s.effect) &&
  (s.value === undefined || typeof s.value === "string") &&
  (s.seconds === undefined || (Number.isFinite(s.seconds) && (s.seconds as number) > 0));

/** One look of a part's machine: a difference from the drawn part, so every field is optional
 *  except the id the steps name it by. */
const validLook = (look: unknown) =>
  isRecord(look) &&
  typeof look.id === "string" &&
  (look.name === undefined || typeof look.name === "string") &&
  (look.label === undefined || typeof look.label === "string") &&
  (look.icon === undefined || look.icon === null || typeof look.icon === "string") &&
  (look.color === undefined || typeof look.color === "string") &&
  (look.variant === undefined || isVariant(look.variant)) &&
  [look.disabled, look.grow, look.hidden].every((v) => v === undefined || typeof v === "boolean");

/** One step of it: where it leaves from, where it lands, and what sets it off. A step that names a
 *  look this build cannot find draws the part as drawn rather than throwing the document away, so
 *  the ids are checked for shape only — the review panel is what reports a dangling one. */
const validStep = (step: unknown) =>
  isRecord(step) &&
  typeof step.id === "string" &&
  typeof step.from === "string" &&
  /* a step with no destination keeps the part where it is: it only does what its actions say */
  (step.to === undefined || typeof step.to === "string") &&
  isRecord(step.trigger) &&
  (step.trigger.kind === "tap" || (step.trigger.kind === "after" && Number.isFinite(step.trigger.seconds) && (step.trigger.seconds as number) >= 0)) &&
  (step.do === undefined || (Array.isArray(step.do) && step.do.every(validStepAction)));

const validFlow = (flow: unknown): boolean =>
  isRecord(flow) && Array.isArray(flow.looks) && flow.looks.every(validLook) && Array.isArray(flow.steps) && flow.steps.every(validStep);

/** the parts a container holds, each with the offset that places it inside the box */
const validChildren = (children: unknown): boolean =>
  children === undefined || (Array.isArray(children) && children.every((c) => validItem(c) && isRecord(c) && Number.isFinite(c.x) && Number.isFinite(c.y)));

/** a value a variable, a condition or a rule action carries */
/** What a rule does. A rule whose action this build does not understand is dropped rather
 *  than opened, because the preview would otherwise run something it cannot carry out. */
const validRuleAction = (a: unknown): boolean => {
  if (!isRecord(a) || !isRuleKind(a.kind)) return false;
  if (a.kind === "goto") return typeof a.to === "string" && typeof a.transition === "string";
  if (a.kind === "back" || a.kind === "close" || a.kind === "closeAll") return true;
  /* a look only sets the fields it names; an empty one is a rule that does nothing, which is allowed */
  if (a.kind === "look") {
    /* What a step writes onto a part: every property it may name, checked against the type that
       property is drawn with. A value this build cannot read would be applied by a truthiness test —
       a star colour would turn a switch on — so they are checked rather than trusted. */
    const texts = [a.target, a.icon, a.label, a.color, a.fill];
    const bools = [a.checkboxes, a.checked, a.disabled, a.hidden, a.grow];
    const nums = [a.selected, a.value];
    return (
      texts.every((v) => v === undefined || typeof v === "string") &&
      (a.variant === undefined || isVariant(a.variant)) &&
      bools.every((v) => v === undefined || typeof v === "boolean") &&
      nums.every((v) => v === undefined || Number.isFinite(v)) &&
      (a.valueOp === undefined || isValueOp(a.valueOp))
    );
  }
  /* a step written while variables existed may still carry a write: the machine's reader drops it,
     and the file has to open for that to happen */
  return typeof a.varId === "string";
};

/** the actions a step may carry, the ones this build dropped included */
const validStepAction = (a: unknown): boolean =>
  isRecord(a) && (a.kind === "set" || a.kind === "add" || a.kind === "toggle") ? typeof a.varId === "string" : validRuleAction(a);

const validItem = (item: unknown): boolean =>
  isRecord(item) &&
  validCorners(item.corners) &&
  (item.railExpanded === undefined || typeof item.railExpanded === "boolean") &&
  (item.railModal === undefined || typeof item.railModal === "boolean") &&
  (item.trackThickness === undefined || isTrackThickness(item.trackThickness)) &&
  (item.imagePos === undefined || isCardImagePos(item.imagePos)) &&
  (item.imageSize === undefined || (Number.isFinite(item.imageSize) && (item.imageSize as number) > 0)) &&
  (item.contentAlign === undefined || isCardAlign(item.contentAlign)) &&
  (item.textColor === undefined || isTextColor(item.textColor)) &&
  (item.color === undefined || isCustomColor(item.color)) &&
  /* an overlay level decides how a tap behaves at runtime, so an unknown one must not reach
     the rule table: `overlayRuleOf` would hand back undefined and the preview would break */
  (item.overlay === undefined || isOverlayLevel(item.overlay)) &&
  /* documents saved while the canvas had a hide-this-part eye still carry the flag; nothing acts on
     it any more, but rejecting it would throw the whole document away */
  (item.hidden === undefined || typeof item.hidden === "boolean") &&
  (item.modal === undefined || typeof item.modal === "boolean") &&
  (item.z === undefined || Number.isFinite(item.z)) &&
  /* a slot grid's cell size and counts decide its whole layout, so a value this build cannot read
     would lay out a board of NaN: the fields are checked rather than trusted */
  (item.cell === undefined || Number.isFinite(item.cell)) &&
  (item.gridCols === undefined || (Number.isFinite(item.gridCols) && (item.gridCols as number) >= 1)) &&
  (item.gridRows === undefined || (Number.isFinite(item.gridRows) && (item.gridRows as number) >= 1)) &&
  (item.checkboxes === undefined || typeof item.checkboxes === "boolean") &&
  /* a board that shows item names: the switch and the words it draws, checked like the rest so a
     document cannot turn a name into a number */
  (item.cellNames === undefined || typeof item.cellNames === "boolean") &&
  (item.cellText === undefined || typeof item.cellText === "string") &&
  (item.cellCol === undefined || Number.isFinite(item.cellCol)) &&
  (item.cellRow === undefined || Number.isFinite(item.cellRow)) &&
  (item.shows === undefined || typeof item.shows === "string") &&
  (item.showValue === undefined || typeof item.showValue === "boolean") &&
  /* whether the number on the part carries its percent sign */
  (item.unit === undefined || typeof item.unit === "boolean") &&
  /* whether a reading text keeps its own words with the value dropped into them */
  (item.mix === undefined || typeof item.mix === "boolean") &&
  /* the panel of a tab: a box whose box is its tab row's to decide */
  (item.panel === undefined || typeof item.panel === "boolean") &&
  /* where a tab row keeps its labels */
  (item.tabSide === undefined || isTabSide(item.tabSide)) &&
  /* the share of a side row the labels take */
  (item.sideRail === undefined || (Number.isFinite(item.sideRail) && (item.sideRail as number) >= 1 && (item.sideRail as number) <= 90)) &&
  /* how far a part is turned, in degrees */
  (item.rot === undefined || (Number.isFinite(item.rot) && Math.abs(item.rot as number) <= 360)) &&
  /* seconds until a part puts itself away */
  (item.autoClose === undefined || (Number.isFinite(item.autoClose) && (item.autoClose as number) >= 1)) &&
  /* a function button's switch and the unit it counts in — a unit this build cannot read would draw
     a line it cannot vouch for. Its number is NOT checked here: a count this build cannot draw is
     corrected on the way in (see readItem), because losing a number must never lose the screen */
  (item.timer === undefined || typeof item.timer === "boolean") &&
  (item.timerUnit === undefined || isTimerUnit(item.timerUnit)) &&
  /* the badge a part wears and the words on it — a function button's corner mark, an item cell's "new"
     mark, and the pill on a button's right edge (作者要求按钮上那个可以开关的徽标，和角标共用这一对字段).
     A value this build cannot read is dropped on the way in rather than kept as a lie (readItem's
     ITEM_TEXT / ITEM_FLAG), so a broken badgeText leaves the part with no badge at all, never rejected */
  (item.badge === undefined || typeof item.badge === "boolean") &&
  (item.badgeText === undefined || typeof item.badgeText === "string") &&
  /* the item cell's other corner mark, and the colour of its pill: a role key or a #rrggbb literal */
  (item.badge2 === undefined || typeof item.badge2 === "boolean") &&
  (item.badge2Text === undefined || typeof item.badge2Text === "string") &&
  (item.badge2Color === undefined || isCustomColor(item.badge2Color)) &&
  /* the item cell's other corner mark, and the colour of its pill: a role key or a #rrggbb literal */
  (item.badge2 === undefined || typeof item.badge2 === "boolean") &&
  (item.badge2Text === undefined || typeof item.badge2Text === "string") &&
  (item.badge2Color === undefined || isCustomColor(item.badge2Color)) &&
  /* 任务信息条上第一枚角标的颜色，以及条里那个按钮右上角那枚徽标的开关、字和图标（`buttonBadge` /
     `buttonBadgeText` / `buttonBadgeIcon`，和 `badge`/`badgeText` 分开的一对，因为那两个在这一条上指的
     是格子的角标）。读不出来的值在读进来的路上被让掉或夹住（见 readItem），而不是把部件丢掉 */
  (item.badgeColor === undefined || isCustomColor(item.badgeColor)) &&
  (item.buttonBadge === undefined || typeof item.buttonBadge === "boolean") &&
  (item.buttonBadgeText === undefined || typeof item.buttonBadgeText === "string") &&
  /* 徽标里的那个图标：一个名字，或者空（没写 / 被清掉）。和 `icon` 一样收 null —— 别的版本写下的空
     槽不该让这一条读不进来 */
  (item.buttonBadgeIcon === undefined || item.buttonBadgeIcon === null || typeof item.buttonBadgeIcon === "string") &&
  /* the outline a button-like part wears: an outline this build cannot draw would be read as the
     kind's own, which is the wrong shape rather than a missing one */
  (item.shape === undefined || isButtonShape(item.shape)) &&
  /* the top of a slider's or a stepper's range */
  (item.max === undefined || (Number.isFinite(item.max) && (item.max as number) >= 1)) &&
  (item.states === undefined || (Array.isArray(item.states) && item.states.every(validState))) &&
  (item.slotStates === undefined ||
    (isRecord(item.slotStates) && Object.values(item.slotStates).every((list) => Array.isArray(list) && list.every(validState)))) &&
  (item.flow === undefined || validFlow(item.flow)) &&
  (item.slotFlows === undefined || (isRecord(item.slotFlows) && Object.values(item.slotFlows).every(validFlow))) &&
  validChildren(item.children) &&
  typeof item.id === "string" &&
  typeof item.kind === "string" &&
  KINDS.has(item.kind as Kind) &&
  typeof item.label === "string" &&
  (item.name === undefined || typeof item.name === "string") &&
  (typeof item.icon === "string" || item.icon === null) &&
  VARIANTS.some((variant) => variant.key === item.variant) &&
  (item.supporting === undefined || typeof item.supporting === "string") &&
  (item.selected === undefined || Number.isFinite(item.selected)) &&
  (item.note === undefined || typeof item.note === "string") &&
  (item.joystickReturn === undefined || typeof item.joystickReturn === "boolean") &&
  (item.many === undefined || (Number.isFinite(item.many) && (item.many as number) >= 2)) &&
  validPrizes(item.prizes) &&
  validRewards(item.rewards) &&
  validTabs(item.tabs);

/** whether a parsed value is exactly one part of a document this build can draw: the cheap per-part
 *  test, kept for callers that want one (the reading itself is best-effort — see `readItem`). */
export const isPlacedItem = (item: unknown): item is PlacedItem => validItem(item) && !isRemovedKind(item as { kind?: unknown });

/**
 * The countdown a stored part was written with, held inside what this build draws: past the ceiling
 * it is the ceiling, and a value that is negative or not a number at all is no count at all, so the
 * part falls back to its own default. `undefined` is also what a missing field gives, which is what
 * keeps a broken number behaving exactly like an absent one.
 */
const readCountdown = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(TIMER_VALUE_MAX, Math.round(value)) : undefined;

/* ---------- reading a stored document, best effort ---------- */

/* A document is read the way the autosave has always been read: its shape is required and its contents
 * are made safe. A field this build cannot read is repaired to the kind's own default or let go; a part
 * nothing can draw is dropped, with whatever it held; a run left with nothing goes with it; a screen
 * left with nothing stays, because the screen itself — its name, its size and its place — is the
 * author's. Nothing here throws a canvas away over one part or one value. */

/** A stored value as the text it means: a number is one an author may well have typed as a number. */
const readText = (v: unknown): string | undefined =>
  typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : undefined;
/** A stored value as a number, when it is one inside what the field allows; otherwise nothing. */
const readNum = (v: unknown, min = -Infinity, max = Infinity): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
/** A stored number held inside its own range rather than let go: the author's direction is kept. */
const readHold = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : undefined;
const readFlag = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
/** One of a fixed set of values (`isTimerUnit`, `isButtonShape`, …), or nothing at all. */
const readOne = <T>(v: unknown, is: (x: unknown) => x is T): T | undefined => (is(v) ? v : undefined);
/** Writes a field, or takes it out: what this build cannot read is let go rather than kept as a lie. */
const put = (into: Record<string, unknown>, key: string, value: unknown) => {
  if (value === undefined) delete into[key];
  else into[key] = value;
};

/** The words a part says. */
const ITEM_TEXT = ["name", "label2", "label3", "supporting", "note", "cellText", "src", "badgeText", "badge2Text", "buttonBadgeText"] as const;
/** The numbers it lays itself out with, each inside what its own field allows. */
const ITEM_NUM: [string, number, number][] = [
  ["size", 1, Infinity],
  ["size2", 1, Infinity],
  ["value", 0, Infinity],
  ["selected", -Infinity, Infinity],
  ["z", -Infinity, Infinity],
  ["cell", 1, Infinity],
  ["cellCol", 0, Infinity],
  ["cellRow", 0, Infinity],
  ["gridCols", 1, Infinity],
  ["gridRows", 1, Infinity],
  ["navPerRow", 1, Infinity],
  ["imageSize", 1, Infinity],
  ["autoClose", 1, Infinity],
  ["max", 1, Infinity],
  ["many", 2, Infinity],
];
/** The switches it carries: a value that is not a switch is not a switch, so the flag is let go. */
const ITEM_FLAG = [
  "switch", "checked", "noCheck", "noImage", "bold", "wavy", "contained", "panel", "hidden", "modal",
  "checkboxes", "cellNames", "showValue", "unit", "mix", "timer", "badge", "badge2", "buttonBadge",
  "joystickReturn", "barFolded", "railFolded", "railExpanded", "railModal",
] as const;

/** the destinations of a bar, a rail, a tab row or a menu: the readable entries, and no others */
const readTabs = (v: unknown): NavTab[] | undefined =>
  Array.isArray(v)
    ? v.filter(isRecord).map((tab) => ({
        ...tab,
        label: readText(tab.label) ?? "",
        icon: typeof tab.icon === "string" ? tab.icon : null,
        badge: readText(tab.badge),
        hideIcon: readFlag(tab.hideIcon),
        hideBadge: readFlag(tab.hideBadge),
      }) as NavTab)
    : undefined;
/** the pool a wheel draws from */
const readPrizes = (v: unknown): Prize[] | undefined =>
  Array.isArray(v)
    ? v.filter(isRecord).map((pr) => ({
        ...pr,
        label: readText(pr.label) ?? "",
        icon: typeof pr.icon === "string" ? pr.icon : null,
        weight: readNum(pr.weight, 0),
      }) as Prize)
    : undefined;
/** what waits at each step of a track: a reward with no place on the bar cannot be drawn, so it goes */
const readRewards = (v: unknown): Reward[] | undefined =>
  Array.isArray(v)
    ? v
        .filter((r) => isRecord(r) && Number.isFinite(r.at) && (r.at as number) >= 0)
        .map((r) => ({ ...r, at: readNum(r.at, 0) ?? 0, label: readText(r.label) ?? "", icon: typeof r.icon === "string" ? r.icon : null }) as Reward)
    : undefined;
/** a box's four corners: all four or none, since half a shape is none */
const readCorners = (v: unknown): Radii | undefined =>
  isRecord(v) && (["tl", "tr", "bl", "br"] as const).every((k) => Number.isFinite(v[k]))
    ? { tl: v.tl as number, tr: v.tr as number, bl: v.bl as number, br: v.br as number }
    : undefined;
/** the looks and steps of a machine: the readable ones, so a half-written machine still runs */
const readFlow = (v: unknown): PartFlow | undefined =>
  isRecord(v) && Array.isArray(v.looks) && Array.isArray(v.steps)
    ? ({ looks: v.looks.filter(validLook), steps: v.steps.filter(validStep) } as PartFlow)
    : undefined;
const readStates = (v: unknown): ItemState[] | undefined => (Array.isArray(v) ? v.filter(validState) : undefined);
/** 一台机器一张表，键就是 `slotFlows` 那些（栏的每一格、融合部件里的一颗按钮） */
const readSlotMap = <T,>(v: unknown, read: (x: unknown) => T[] | undefined): Record<string, T[]> | undefined => {
  if (!isRecord(v)) return undefined;
  const out: Record<string, T[]> = {};
  for (const [key, list] of Object.entries(v)) {
    const read_ = read(list);
    if (read_ && read_.length) out[key] = read_;
  }
  return Object.keys(out).length ? out : undefined;
};

/**
 * `slotFlows` 那张表：每一个键底下就是**一台机器**（一个 flow 对象），不是一串
 *
 * 它和 `slotStates` 不是同一种形状：`slotStates` 是"每个键一张表"（见 readSlotMap），而 `slotFlows`
 * 是"每个键一台机器"。以前这里拿 readSlotMap 套上一个 `[flow]` 的映射来读，于是存下来的
 * `{"cancel": {…}}` 读回来成了 `{"cancel": [{…}]}`：`firstTapStep` 读不到 `.steps`，那一格配的
 * 「点击后变化」在预览里整个失效 —— 作者报的「取消」配了隐藏却不生效就是这一件事；`hasTimedSteps`
 * 还会在那上面直接抛（读到这种文档预览就挂）。所以这里专门给它一支笔。
 *
 * 数组那一份照样认（取头一台）：被上面那个写法读过的文档，再存回去时写的正是这个形状，不该因为我们
 * 自己的旧毛病就把作者配好的机器丢掉。
 */
const readSlotFlows = (v: unknown): Record<string, PartFlow> | undefined => {
  if (!isRecord(v)) return undefined;
  const out: Record<string, PartFlow> = {};
  for (const [key, machine] of Object.entries(v)) {
    const flow = readFlow(Array.isArray(machine) ? machine[0] : machine);
    if (flow) out[key] = flow;
  }
  return Object.keys(out).length ? out : undefined;
};

/**
 * A part read back from a stored document. It is kept whenever this build has a spec for its kind —
 * everything else about it is made safe: a missing or unknown `variant` becomes the kind's own, a
 * field this build cannot read is let go so the kind's default stands in, and the things it holds are
 * read the same way. Only a part nothing can draw (an unknown or dropped kind) is given up, and it
 * takes its children with it. A field another build wrote under a name this one does not know is left
 * exactly as it was, so nothing another version added is lost.
 */
export function readItem(value: unknown): Item | null {
  if (!isRecord(value) || typeof value.kind !== "string" || !KINDS.has(value.kind) || isRemovedKind(value)) return null;
  const kind = value.kind as Kind;
  const spec = KIND_SPEC[kind];
  const it = { ...value } as Record<string, unknown>;
  it.kind = kind;
  it.id = readText(value.id) ?? uid();
  it.label = readText(value.label) ?? "";
  it.icon = typeof value.icon === "string" ? value.icon : null;
  /* a part with no variant of its own — or one this build cannot draw — wears the kind's own */
  it.variant = isVariant(value.variant) ? value.variant : (spec?.defVariant ?? "filled");
  put(it, "icon2", typeof value.icon2 === "string" ? value.icon2 : undefined);
  for (const key of ITEM_TEXT) put(it, key, readText(value[key]));
  for (const [key, min, max] of ITEM_NUM) put(it, key, readNum(value[key], min, max));
  for (const key of ITEM_FLAG) put(it, key, readFlag(value[key]));
  /* the fields that are one of a fixed set: a value outside it is let go, never the part */
  put(it, "overlay", readOne(value.overlay, isOverlayLevel));
  put(it, "tabSide", readOne(value.tabSide, isTabSide));
  put(it, "imagePos", readOne(value.imagePos, isCardImagePos));
  put(it, "contentAlign", readOne(value.contentAlign, isCardAlign));
  /* 文字色：角色或作者自己的 #rrggbb，读不出来的就清掉（best effort，绝不因此丢掉部件） */
  put(it, "textColor", readOne(value.textColor, isTextColor));
  put(it, "color", readOne(value.color, isCustomColor));
  put(it, "strokeColor", readOne(value.strokeColor, isCustomColor));
  put(it, "fill", readOne(value.fill, isCustomColor));
  put(it, "iconFill", value.iconFill === "none" || isCustomColor(value.iconFill) ? value.iconFill : undefined);
  put(it, "badge2Color", readOne(value.badge2Color, isCustomColor));
  /* 任务信息条的第一枚角标颜色（和 badge2Color 同一条规则），以及按钮右上角那枚徽标里的图标名 ——
     都要么是说得通的值，要么让掉，绝不因此丢掉部件或整份文档 */
  put(it, "badgeColor", readOne(value.badgeColor, isCustomColor));
  put(it, "buttonBadgeIcon", typeof value.buttonBadgeIcon === "string" ? value.buttonBadgeIcon : undefined);
  put(it, "shape", readOne(value.shape, isButtonShape));
  put(it, "timerUnit", readOne(value.timerUnit, isTimerUnit));
  put(it, "trackThickness", readOne(value.trackThickness, isTrackThickness));
  /* the countdown, the two corner marks and the turn are held inside their own ranges */
  put(it, "timerValue", readCountdown(value.timerValue));
  put(it, "rot", readHold(value.rot, -ROT_MAX, ROT_MAX));
  put(it, "sideRail", readHold(value.sideRail, SIDE_RAIL_MIN, SIDE_RAIL_MAX));
  /* the lists and the machines it owns: repaired entry by entry, because the part outlives a bad one */
  put(it, "tabs", readTabs(value.tabs));
  put(it, "prizes", readPrizes(value.prizes));
  put(it, "rewards", readRewards(value.rewards));
  put(it, "corners", readCorners(value.corners));
  put(it, "states", readStates(value.states));
  put(it, "flow", readFlow(value.flow));
  put(it, "slotStates", readSlotMap(value.slotStates, readStates));
  put(it, "slotFlows", readSlotFlows(value.slotFlows));
  /* what it holds: each child read the same way, so one bad part does not take its siblings with it */
  if (Array.isArray(value.children)) {
    /* a container the author emptied keeps its empty list, and a child nothing can draw is left out
       while its siblings stay */
    it.children = value.children.map(readPlace).filter((child): child is PlacedItem => !!child);
  } else put(it, "children", undefined);
  /* the corners a part rounds itself by: a number held at zero or above (a negative corner is no
     corner), and nothing at all when the value is not a number — the kind's own default stands in */
  const corner = (v: unknown) => {
    const n = readNum(v);
    return n === undefined ? undefined : Math.max(0, n);
  };
  /* 资产框的间距：读回来按滑杆的上下限夹住，和 rot / sideRail 一样（夹住，不是丢掉整个部件） */
  put(it, "markGap", readHold(value.markGap, 0, MARK_GAP_MAX));
  put(it, "radiusTop", corner(value.radiusTop));
  put(it, "radiusBottom", corner(value.radiusBottom));
  /* an asset frame draws its corner from its own height, so a stored number is only ever held inside
     that same range — clamped, never a reason to lose the part */
  if (kind === "assetPill" && typeof it.radiusTop === "number") put(it, "radiusTop", assetPillRadius(it as unknown as Item));
  /* 物品格同理：它画圆角用的是格子那个正方形（不是部件的高度），存下来的数也按同一个范围夹住 ——
     越界的值夹回来，绝不因此丢掉部件或整份文档（best effort）。 */
  if (kind === "itemCell" && typeof it.radiusTop === "number") put(it, "radiusTop", itemCellRadius(it as unknown as Item));
  /* a direction wheel carries no value and no maximum any more (see its spec): an older file is still
     opened, and the two fields are let go — a number nobody can set would leave a stuck pad */
  if (kind === "joystick") {
    delete it.value;
    delete it.max;
  }
  /* 按钮不再有"右徽标"这个属性了（作者：「去掉此属性」）：老文档里还写着的 badge / badgeText 让掉，
     部件一个都不丢。这两个字段是别的种类在用的通用字段（功能按钮与物品格的角标、任务信息条的两枚格子
     角标），这里删的只是按钮自己那一份，别的种类照旧读它。 */
  if (kind === "button") {
    delete it.badge;
    delete it.badgeText;
  }
  /* 任务信息条也不再有"奖励数量"、"画几个奖励格"和"奖励图标"这三个属性：数量永远是那个固定的 100
     （TASK_BAR_VALUE），格子永远两个，图标永远是那个默认的奖励图标（见 tokens 的 TASK_BAR_ICON）。
     老文档里还写着的话照样读得进来 —— 部件一个都不丢，只是这几个字段让掉，和上面方向盘那两个字段
     同一条规矩（读不出来的值尤其不是丢部件的理由）。`value` 是别的种类在用的通用字段，这里删的只是
     任务信息条自己那一份，别的种类照旧读它。 */
  if (kind === "taskBar") {
    delete it.value;
    delete it.cellCount;
    it.icon = null;
  }
  return it as unknown as Item;
}

/** a part inside a container, with the offset that places it there: a missing one lands at its corner */
function readPlace(value: unknown): PlacedItem | null {
  const it = readItem(value);
  if (!it || !isRecord(value)) return null;
  return { ...it, x: readNum(value.x) ?? 0, y: readNum(value.y) ?? 0 };
}

/** A run of a stored document: its parts read one by one, and a run left with nothing goes with them. */
const readGroup = (value: unknown): Group | null => {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const items = value.items.map((it) => (isRecord(it) ? readItem(it) : null)).filter((it): it is Item => !!it);
  if (items.length === 0) return null;
  const group = { ...value } as Record<string, unknown>;
  group.id = readText(value.id) ?? uid();
  group.x = readNum(value.x) ?? 0;
  group.y = readNum(value.y) ?? 0;
  group.axis = value.axis === "y" ? "y" : "x";
  group.items = items;
  /* `null` 是旧构建导出的"没锁"（当时的空值写法），读回来就是没锁 */
  put(group, "locked", readFlag(value.locked));
  put(group, "free", readFlag(value.free));
  put(group, "pos", readPositions(value.pos));
  return group as unknown as Group;
};

/** where the parts of a free run sit: only the offsets that are real places survive */
function readPositions(value: unknown): Record<string, { x: number; y: number }> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, { x: number; y: number }> = {};
  for (const [key, place] of Object.entries(value)) {
    if (isRecord(place)) out[key] = { x: readNum(place.x) ?? 0, y: readNum(place.y) ?? 0 };
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * A screen of a stored document. It is kept even when nothing inside it could be read: its name, its
 * size and its place are the author's, and a blank screen can be drawn in again, while a dropped one
 * cannot be got back — nor can the taps that pointed at it.
 */
const readFrame = (value: unknown): Frame | null => {
  if (!isRecord(value)) return null;
  const frame = { ...value } as Record<string, unknown>;
  frame.id = readText(value.id) ?? uid();
  frame.name = readText(value.name) ?? "";
  frame.x = readNum(value.x) ?? 0;
  frame.y = readNum(value.y) ?? 0;
  put(frame, "w", readNum(value.w, 1));
  put(frame, "h", readNum(value.h, 1));
  put(frame, "note", readText(value.note));
  put(frame, "locked", readFlag(value.locked));
  put(frame, "role", value.role === "overlay" ? "overlay" : value.role === "screen" ? "screen" : undefined);
  put(frame, "level", readOne(value.level, isOverlayLevel));
  put(frame, "autoClose", readNum(value.autoClose, 1));
  put(frame, "place", readOne(value.place, isPlace));
  return frame as unknown as Frame;
};

const validGroup = (group: unknown) =>
  isRecord(group) &&
  typeof group.id === "string" &&
  Number.isFinite(group.x) &&
  Number.isFinite(group.y) &&
  (group.axis === "x" || group.axis === "y") &&
  /* `null` 是旧构建导出的"没锁"（当时的空值写法）。校验里判它非法的话，
     整份文档都会被丢掉 —— 用户看到的就是"流程图说画布上没有页面"。 */
  (group.locked === undefined || group.locked === null || typeof group.locked === "boolean") &&
  Array.isArray(group.items) &&
  group.items.length > 0 &&
  group.items.every(validItem);

const validFrame = (frame: unknown) =>
  isRecord(frame) &&
  typeof frame.id === "string" &&
  typeof frame.name === "string" &&
  Number.isFinite(frame.x) &&
  Number.isFinite(frame.y) &&
  (frame.w === undefined || (Number.isFinite(frame.w) && (frame.w as number) > 0)) &&
  (frame.h === undefined || (Number.isFinite(frame.h) && (frame.h as number) > 0)) &&
  (frame.note === undefined || typeof frame.note === "string") &&
  /* 同上：旧导出里的 locked 可能是 null */
  (frame.locked === undefined || frame.locked === null || typeof frame.locked === "boolean") &&
  (frame.role === undefined || frame.role === "screen" || frame.role === "overlay") &&
  (frame.level === undefined || isOverlayLevel(frame.level)) &&
  /* seconds until an overlay page closes itself */
  (frame.autoClose === undefined || (Number.isFinite(frame.autoClose) && (frame.autoClose as number) >= 1)) &&
  (frame.place === undefined || isPlace(frame.place));

/** whether a parsed file is exactly one of our documents: the cheap shape test, part by part. Kept as
 *  a predicate for callers that want one (see `looksLikeProject`); the reading itself is lenient. */
export const isProject = (value: unknown): value is Doc =>
  isRecord(value) &&
  Array.isArray(value.groups) &&
  value.groups.every(validGroup) &&
  Array.isArray(value.frames) &&
  value.frames.every(validFrame) &&
  (value.platform === undefined || isPlatform(value.platform));

/** The runs of a stored document this build can read. The autosave is simply whatever the last visit
 *  left in localStorage: an older build, or another one on the same origin, can leave a part behind
 *  that this build has no spec for. Those parts are left out — with what they held — and a run that
 *  held nothing else goes with them, so one stray part cannot take the canvas down with it. */
export function readableGroups(groups: unknown): Group[] {
  if (!Array.isArray(groups)) return [];
  return groups.map((group) => readGroup(group)).filter((group): group is Group => !!group);
}

/** the file name a project is saved under: m3e-canvas, followed by the app's name when it has one */
export const projectFileName = (doc: Doc) => {
  const name = doc.title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name ? `m3e-canvas ${name}.json` : "m3e-canvas.json";
};

/**
 * 只留一屏的项目文件
 *
 * 「保存项目」给的是整份画布；这一个给的是**画布上的一屏**：那一屏自己的 `frames` 一项、落在它上面的
 * 组（由调用方按画布上同一套几何挑出来，见 frameOfGroup），其余原样带着（配色、主题、动态取色、自定义
 * 组件、平台……）—— 所以它是一份**能用的项目文件**：既能「打开项目」回到编辑器里继续画这一屏，也能交给
 * 别人（或编码代理）看清这一屏到底由哪些部件、哪些字段组成。
 *
 * 题目换成这一屏的名字：文件名因此是 `m3e-canvas 上传屏幕2.json`，打开它的人一眼知道这是哪一屏。
 * `frameId` 一起写上（`Group` 类型里没有这一项，存储里却一直有）：一屏一帧的文件里几何本来就分得清，
 * 写上只是让这份文件自己说得更明白。
 */
export function screenProject(doc: Doc, frame: Frame, groups: Group[]): Doc {
  return {
    ...doc,
    title: frame.name,
    frames: [frame],
    groups: groups.map((g) => ({ ...g, frameId: frame.id }) as Group),
  };
}

/**
 * A document read back from a file, a share link, an AI answer or storage — the one gate every reader
 * of a stored document comes through. What it requires is the shape of a document: an object whose
 * `groups` and `frames` are arrays, which is what keeps a random JSON file from opening as an empty
 * canvas. Everything inside is read best-effort (see readItem, readGroup, readFrame): unreadable parts
 * go, their runs go with them if nothing else was in them, screens stay, and a bad field costs only
 * itself. Returns `null` only when the value is not a document at all.
 */
export function readDoc(value: unknown): Doc | null {
  if (!isRecord(value) || !Array.isArray(value.groups) || !Array.isArray(value.frames)) return null;
  const doc = { ...value } as Record<string, unknown>;
  doc.groups = value.groups.map((group) => readGroup(group)).filter((group): group is Group => !!group);
  doc.frames = value.frames.map((frame) => readFrame(frame)).filter((frame): frame is Frame => !!frame);
  doc.title = readText(value.title) ?? "";
  doc.brief = readText(value.brief) ?? "";
  /* 没写 paletteKey 的文档（内置那份就是）落在**出厂默认配色**上，
     和新建画布同一套；不能再写 PALETTES[0]（那是 Purple，默认已经改成 Mono）。 */
  doc.paletteKey = readText(value.paletteKey) ?? DEFAULT_PALETTE_KEY;
  doc.frame = value.frame === "blank" ? "blank" : "phone";
  put(doc, "platform", readOne(value.platform, isPlatform));
  /* normalize once, so a scheme saved before the secondary role gets it and keeps it on re-save */
  put(doc, "theme", isRecord(value.theme) ? normalizeTheme(value.theme) : undefined);
  put(doc, "promptEdit", readText(value.promptEdit));
  put(doc, "dynamicColor", readFlag(value.dynamicColor));
  put(doc, "customPalette", isRecord(value.customPalette) && typeof value.customPalette.primary === "string" ? value.customPalette : undefined);
  return doc as unknown as Doc;
}

/** hands the document to the browser as a JSON download */
export function saveProject(doc: Doc) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = projectFileName(doc);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** reads a chosen file back into a document, or null when it is not one */
export async function readProject(file: File): Promise<Doc | null> {
  try {
    const next: unknown = JSON.parse(await file.text());
    return readDoc(next);
  } catch {
    return null;
  }
}
