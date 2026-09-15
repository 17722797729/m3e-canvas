import { Doc, Group, KIND_ORDER, Kind, VARIANTS, isCardAlign, isCardImagePos, isCustomColor, isPlace, isStateEffect, isTextToken, isPlatform, isTrackThickness } from "./tokens";

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

/** the parts a container holds, each with the offset that places it inside the box */
const validChildren = (children: unknown): boolean =>
  children === undefined || (Array.isArray(children) && children.every((c) => validItem(c) && isRecord(c) && Number.isFinite(c.x) && Number.isFinite(c.y)));

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
  (item.z === undefined || Number.isFinite(item.z)) &&
  (item.states === undefined || (Array.isArray(item.states) && item.states.every(validState))) &&
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
  (frame.place === undefined || isPlace(frame.place));

/** whether a parsed file has the shape of a document the editor can open */
export const isProject = (value: unknown): value is Doc =>
  isRecord(value) && Array.isArray(value.groups) && Array.isArray(value.frames) && value.groups.every(validGroup) && value.frames.every(validFrame) && (value.platform === undefined || isPlatform(value.platform));

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
