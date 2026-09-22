import { Doc, Group, KIND_ORDER, Kind, VARIANTS, isCardAlign, isCardImagePos, isConditionOp, isCustomColor, isOverlayLevel, isPlace, isRuleKind, isStateEffect, isTextToken, isPlatform, isTrackThickness, isVarKind, isVariant } from "./tokens";

/* A project file is the Doc as JSON, nothing more. Reading one back only checks
 * the shape the editor relies on; the same migrations that run on a saved
 * document then bring an older file up to date. */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const KINDS = new Set<string>(KIND_ORDER);

const validTabs = (tabs: unknown) =>
  tabs === undefined || (Array.isArray(tabs) && tabs.every((tab) => isRecord(tab) && typeof tab.label === "string" && (typeof tab.icon === "string" || tab.icon === null || tab.icon === undefined)));

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
  typeof step.to === "string" &&
  isRecord(step.trigger) &&
  (step.trigger.kind === "tap" || (step.trigger.kind === "after" && Number.isFinite(step.trigger.seconds) && (step.trigger.seconds as number) >= 0)) &&
  (step.when === undefined || (Array.isArray(step.when) && step.when.every(validCondition))) &&
  (step.do === undefined || (Array.isArray(step.do) && step.do.every(validRuleAction)));

const validFlow = (flow: unknown): boolean =>
  isRecord(flow) && Array.isArray(flow.looks) && flow.looks.every(validLook) && Array.isArray(flow.steps) && flow.steps.every(validStep);

/** the parts a container holds, each with the offset that places it inside the box */
const validChildren = (children: unknown): boolean =>
  children === undefined || (Array.isArray(children) && children.every((c) => validItem(c) && isRecord(c) && Number.isFinite(c.x) && Number.isFinite(c.y)));

/** a value a variable, a condition or a rule action carries */
const isVarValue = (v: unknown): boolean => typeof v === "string" || typeof v === "number" || typeof v === "boolean";

const validVar = (v: unknown) =>
  isRecord(v) && typeof v.id === "string" && typeof v.name === "string" && isVarKind(v.kind) && isVarValue(v.initial) && (v.pageId === undefined || typeof v.pageId === "string");

const validCondition = (c: unknown) => isRecord(c) && typeof c.varId === "string" && isConditionOp(c.op) && isVarValue(c.value);

/** What a rule does. A rule whose action this build does not understand is dropped rather
 *  than opened, because the preview would otherwise run something it cannot carry out. */
const validRuleAction = (a: unknown): boolean => {
  if (!isRecord(a) || !isRuleKind(a.kind)) return false;
  if (a.kind === "goto") return typeof a.to === "string" && typeof a.transition === "string";
  if (a.kind === "back" || a.kind === "close") return true;
  /* a look only sets the fields it names; an empty one is a rule that does nothing, which is allowed */
  if (a.kind === "look")
    return (
      [a.target, a.icon, a.label, a.color].every((v) => v === undefined || typeof v === "string") && (a.variant === undefined || isVariant(a.variant))
    );
  if (typeof a.varId !== "string") return false;
  if (a.kind === "set") return isVarValue(a.value);
  if (a.kind === "add") return Number.isFinite(a.delta);
  return true;
};

const validRule = (r: unknown) =>
  isRecord(r) &&
  typeof r.id === "string" &&
  (r.when === undefined || (Array.isArray(r.when) && r.when.every(validCondition))) &&
  (r.after === undefined || (Number.isFinite(r.after) && (r.after as number) >= 0)) &&
  validRuleAction(r.do);

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
  (item.states === undefined || (Array.isArray(item.states) && item.states.every(validState))) &&
  (item.slotStates === undefined ||
    (isRecord(item.slotStates) && Object.values(item.slotStates).every((list) => Array.isArray(list) && list.every(validState)))) &&
  (item.flow === undefined || validFlow(item.flow)) &&
  (item.slotFlows === undefined || (isRecord(item.slotFlows) && Object.values(item.slotFlows).every(validFlow))) &&
  (item.rules === undefined || (Array.isArray(item.rules) && item.rules.every(validRule))) &&
  validChildren(item.children) &&
  typeof item.id === "string" &&
  typeof item.kind === "string" &&
  KINDS.has(item.kind as Kind) &&
  typeof item.label === "string" &&
  (typeof item.icon === "string" || item.icon === null) &&
  VARIANTS.some((variant) => variant.key === item.variant) &&
  (item.supporting === undefined || typeof item.supporting === "string") &&
  (item.selected === undefined || Number.isFinite(item.selected)) &&
  (item.note === undefined || typeof item.note === "string") &&
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
  (frame.place === undefined || isPlace(frame.place));

/** whether a parsed file has the shape of a document the editor can open */
export const isProject = (value: unknown): value is Doc =>
  isRecord(value) &&
  Array.isArray(value.groups) &&
  Array.isArray(value.frames) &&
  value.groups.every(validGroup) &&
  value.frames.every(validFrame) &&
  (value.vars === undefined || (Array.isArray(value.vars) && value.vars.every(validVar))) &&
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
