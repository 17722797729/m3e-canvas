import { Doc, Group, KIND_ORDER, LEGACY_KINDS, Kind, VARIANTS, isCardAlign, isCardImagePos, isCustomColor, isOverlayLevel, isPlace, isRuleKind, isTabSide, isStateEffect, isValueOp, isTextToken, isPlatform, isTrackThickness, isVariant } from "./tokens";

/* A project file is the Doc as JSON, nothing more. Reading one back only checks
 * the shape the editor relies on; the same migrations that run on a saved
 * document then bring an older file up to date. */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/* a retired kind is still readable: the editor turns it into what the palette offers now */
const KINDS = new Set<string>([...KIND_ORDER, ...LEGACY_KINDS]);

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
  (item.textColor === undefined || isTextToken(item.textColor)) &&
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
  validTabs(item.tabs);

const validGroup = (group: unknown) =>
  isRecord(group) &&
  typeof group.id === "string" &&
  Number.isFinite(group.x) &&
  Number.isFinite(group.y) &&
  (group.axis === "x" || group.axis === "y") &&
  (group.locked === undefined || typeof group.locked === "boolean") &&
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
  (frame.role === undefined || frame.role === "screen" || frame.role === "overlay") &&
  (frame.level === undefined || isOverlayLevel(frame.level)) &&
  /* seconds until an overlay page closes itself */
  (frame.autoClose === undefined || (Number.isFinite(frame.autoClose) && (frame.autoClose as number) >= 1)) &&
  (frame.place === undefined || isPlace(frame.place));

/** whether a parsed file has the shape of a document the editor can open */
export const isProject = (value: unknown): value is Doc =>
  isRecord(value) &&
  Array.isArray(value.groups) &&
  Array.isArray(value.frames) &&
  value.groups.every(validGroup) &&
  value.frames.every(validFrame) &&
  (value.platform === undefined || isPlatform(value.platform));

/** The runs of a stored document this build can still read. A file and a link pass
 *  `isProject` before they are opened, but the autosave is simply whatever the last visit
 *  left in localStorage: an older build, or another one on the same origin, can leave a
 *  part behind that this build has no spec for, and every reader of KIND_SPEC — sizeOf
 *  first — fails on it. Unknown parts are left out instead, so one stray part cannot take
 *  the canvas down with it; a run that held nothing else goes with them. */
export function readableGroups(groups: unknown): Group[] {
  if (!Array.isArray(groups)) return [];
  const out: Group[] = [];
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.items)) continue;
    const items = group.items.filter(validItem);
    if (items.length === 0) continue;
    out.push((items.length === group.items.length ? group : { ...group, items }) as unknown as Group);
  }
  return out;
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
    return isProject(next) ? next : null;
  } catch {
    return null;
  }
}
