import { findItemIn, isOverlayFrame, overlayLevelOf, overlayLevelOfFrame, type Frame, type Group, type Item, type OverlayLevel } from "./tokens";

/**
 * How a document's layers split between its pages. The canvas draws every group it holds, so the
 * Layers panel has to offer a row for every group too: the groups of each page, plus the parts no
 * page owns. A group that lands in neither list has no row at all, so a rail left outside its screen
 * by a resize would be impossible to select, move or delete again.
 *
 * Ownership is the editor's own reading (`frameOfGroup`), passed in as a lookup, so the panel and
 * the canvas can never disagree about which page a group belongs to.
 */
export function splitByPage(groups: Group[], frameIdOf: (groupId: string) => string | null) {
  const byPage = new Map<string, Group[]>();
  const loose: Group[] = [];
  for (const g of groups) {
    const id = frameIdOf(g.id);
    if (!id) {
      loose.push(g);
      continue;
    }
    const list = byPage.get(id);
    if (list) list.push(g);
    else byPage.set(id, [g]);
  }
  return { byPage, loose };
}

/**
 * The groups that hold any of these parts, wherever the parts sit inside them. Ownership of a part
 * is the question the editor asks before it edits or deletes one: a group holds everything under it,
 * children included, so a contains-check that only looked at a group's own items would call a part
 * inside a container unowned — undeletable, and its own group never tidied for it.
 */
export function holdersOf(groups: Group[], ids: string[]): Group[] {
  return groups.filter((g) => ids.some((id) => !!findItemIn(g.items, id)));
}

/** A dialog a tap can open: an overlay page, or an overlay drawn on the page the tap sits on. */
export type DialogRef = {
  id: string;
  /** the page it lives on: its own id for an overlay page, the page it is drawn on for a part */
  frameId: string;
  label: string;
  level: OverlayLevel;
  /** true for an overlay page, false for an overlay drawn on a page */
  page: boolean;
};

/**
 * The dialogs already in the document, for a tap that should open one of them instead of a new one.
 * Every overlay page is on offer, wherever it sits. An overlay *drawn* on a page is only on offer
 * when it is drawn on the page the tap is on: the preview looks a tapped id up among the parts of
 * the screen that was tapped, so pointing across pages would silently do nothing. A nested one is
 * left out for the same reason — only the page's own top level is ever reached.
 */
export function existingDialogs(frames: Frame[], groups: Group[]): DialogRef[] {
  const pages: DialogRef[] = frames.filter(isOverlayFrame).map((f) => ({ id: f.id, frameId: f.id, label: f.name, level: overlayLevelOfFrame(f), page: true }));
  const drawn: DialogRef[] = [];
  for (const g of groups) {
    for (const it of g.items) {
      const level = overlayLevelOf(it);
      if (!level) continue;
      drawn.push({ id: it.id, frameId: "", label: it.label, level, page: false });
    }
  }
  return [...pages, ...drawn];
}
