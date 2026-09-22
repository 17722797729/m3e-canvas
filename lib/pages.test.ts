import { describe, expect, it } from "vitest";

import { existingDialogs, holdersOf, splitByPage } from "./pages";
import { makeItem, type Frame, type Group, type Item } from "./tokens";

/* The panel lists a document as its pages of layers plus the parts no page owns. The canvas draws
 * every group, so a group that falls out of both lists has no row at all — which is how a locked
 * rail outside its screen could not be selected, unlocked, moved or deleted again. */

const item = (id: string): Item => ({ ...makeItem("button"), id, label: id });
const group = (id: string, items: Item[]): Group => ({ id, x: 0, y: 0, axis: "x", items });
const frame = (id: string): Frame => ({ id, name: id, x: 0, y: 0 });

describe("splitByPage", () => {
  it("gives every group a home: a page, or the list of parts off the screens", () => {
    const frames = [frame("a"), frame("b")];
    const groups = [group("g1", [item("p1")]), group("g2", [item("p2")]), group("lost", [item("rail")])];
    const owner: Record<string, string> = { g1: "a", g2: "b" };
    const { byPage, loose } = splitByPage(groups, (id) => owner[id] ?? null);

    expect(byPage.get("a")?.map((g) => g.id)).toEqual(["g1"]);
    expect(byPage.get("b")?.map((g) => g.id)).toEqual(["g2"]);
    expect(loose.map((g) => g.id)).toEqual(["lost"]);
    /* nothing is dropped: the two lists hold the document between them */
    expect([...byPage.values()].flat().length + loose.length).toBe(groups.length);
    expect(frames.map((f) => byPage.get(f.id)?.length ?? 0)).toEqual([1, 1]);
  });

  it("omits a page that holds nothing instead of giving it an empty list", () => {
    const { byPage, loose } = splitByPage([group("g", [item("p")])], () => "a");
    expect(byPage.has("b")).toBe(false);
    expect(loose).toEqual([]);
    expect(byPage.get("a")).toHaveLength(1);
  });

  it("keeps every group in document order, so the rows read bottom layer first", () => {
    const groups = [group("first", [item("p1")]), group("second", [item("p2")]), group("third", [item("p3")])];
    const { byPage } = splitByPage(groups, () => "a");
    expect(byPage.get("a")?.map((g) => g.id)).toEqual(["first", "second", "third"]);
  });

  it("calls a document with no pages one long list of parts off the screens", () => {
    const groups = [group("g1", [item("p1")]), group("g2", [item("p2")])];
    const { byPage, loose } = splitByPage(groups, () => null);
    expect(byPage.size).toBe(0);
    expect(loose.map((g) => g.id)).toEqual(["g1", "g2"]);
  });

  it("follows the ownership it is handed, not the order the pages come in", () => {
    /* the editor decides ownership; the panel only groups by it, so a group pinned to the second
       page stays there even when it sits beside the first */
    const groups = [group("g1", [item("p1")]), group("g2", [item("p2")])];
    const { byPage } = splitByPage(groups, (id) => (id === "g1" ? "second" : "first"));
    expect(byPage.get("first")?.map((g) => g.id)).toEqual(["g2"]);
    expect(byPage.get("second")?.map((g) => g.id)).toEqual(["g1"]);
  });
});

describe("holdersOf", () => {
  /* The delete guard asks which groups hold the selected parts, because a locked group refuses to
   * give anything up. It has to walk into containers: a part nested in one is not one of the
   * group's own items, and a plain contains-check called exactly such a part undeletable and put
   * the blame on a lock that was never set. */
  const inner: Item = { ...makeItem("button"), id: "inner", label: "inner" };
  const box: Item = { ...makeItem("box"), id: "box", label: "box", children: [{ ...inner, x: 8, y: 8 }] };
  const deep: Item = { ...makeItem("box"), id: "outer", label: "outer", children: [{ ...box, id: "mid", x: 4, y: 4, children: [{ ...inner, id: "deepest", x: 2, y: 2 }] }] };

  it("counts a part buried in a container as held by its group", () => {
    const groups = [group("g", [box])];
    expect(holdersOf(groups, ["box"]).map((g) => g.id)).toEqual(["g"]);
    expect(holdersOf(groups, ["inner"]).map((g) => g.id)).toEqual(["g"]);
    expect(holdersOf([group("deep", [deep])], ["deepest"]).map((g) => g.id)).toEqual(["deep"]);
  });

  it("names only the groups that hold something from the selection", () => {
    const groups = [group("a", [item("p1")]), group("b", [box])];
    expect(holdersOf(groups, ["p1"]).map((g) => g.id)).toEqual(["a"]);
    expect(holdersOf(groups, ["inner"]).map((g) => g.id)).toEqual(["b"]);
    expect(holdersOf(groups, ["p1", "inner"]).map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("finds nothing for a selection that names no part at all, so a stale one is not called locked", () => {
    expect(holdersOf([group("g", [box])], ["gone"])).toEqual([]);
    expect(holdersOf([], ["box"])).toEqual([]);
  });

  it("leaves the locked decision to the caller, which is what the guard needs", () => {
    /* a nested part in a locked group: the part is held, and the group says it is protected */
    const locked = [{ ...group("g", [box]), locked: true }];
    const holders = holdersOf(locked, ["inner"]);
    expect(holders).toHaveLength(1);
    expect(holders.every((g) => g.locked)).toBe(true);
    /* unlocking the group is what makes the same selection deletable */
    expect(holdersOf([{ ...locked[0], locked: undefined }], ["inner"]).some((g) => !g.locked)).toBe(true);
  });
});

describe("existingDialogs", () => {
  /* A tap can open a dialog that is already there. Every overlay page is on offer; an overlay drawn
   * on a page only counts when it is drawn on the page the tap is on, because the preview looks a
   * tapped id up among the parts of the screen that was tapped. */
  const part = (patch: Partial<Item>): Item => ({ ...makeItem("button"), id: "x", label: "", ...patch });
  const bag: Frame = { ...frame("bag"), role: "overlay", level: "sheet" };
  const more: Frame = { ...frame("more"), role: "overlay" };

  it("offers every overlay page, with the level it carries", () => {
    const { id: _a, ...first } = existingDialogs([frame("home"), bag, more], [])[0];
    expect(first).toEqual({ frameId: "bag", label: "bag", level: "sheet", page: true });
    expect(existingDialogs([frame("home"), bag, more], []).map((d) => d.id)).toEqual(["bag", "more"]);
  });

  it("offers an overlay drawn on the page the tap is on", () => {
    const groups = [group("g", [part({ id: "drawer", label: "Drawer", overlay: "popover" })])];
    const list = existingDialogs([frame("home")], groups);
    expect(list).toEqual([{ id: "drawer", frameId: "", label: "Drawer", level: "popover", page: false }]);
  });

  it("leaves out a nested overlay, since only a page's own top level is ever reached", () => {
    const inner = part({ id: "inner", overlay: "modal" });
    const box: Item = { ...makeItem("box"), id: "box", label: "Box", children: [{ ...inner, x: 2, y: 2 }] };
    expect(existingDialogs([frame("home")], [group("g", [box])])).toEqual([]);
  });

  it("says nothing about a plain part or a plain page", () => {
    expect(existingDialogs([frame("home")], [group("g", [part({})])])).toEqual([]);
  });
});
