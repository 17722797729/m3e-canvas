import { describe, expect, it } from "vitest";
import { KIND_TEXT, LANGS } from "./i18n";
import { isPlacedItem, isProject, readDoc, readItem, readableGroups } from "./project";
import { KIND_ORDER, KIND_SPEC, REMOVED_KINDS, isRemovedKind, makeItem, type Item, type PlacedItem } from "./tokens";

/* The FAB menu was dropped from the palette and from every registry. A document an author drew while
 * it existed is still a document: the shape check accepts it and the reader leaves those parts out,
 * rather than refusing the file and taking their whole canvas with it. */
const menu = () => ({ ...makeItem("box"), kind: "fabMenu", id: "m", tabs: [{ icon: "edit", label: "メモ" }] }) as unknown as Item;
const box = () => ({ ...makeItem("box"), id: "b", size2: 120 }) as Item;

/** A document as storage would hold it: one run of parts. */
const stored = (items: unknown[]) =>
  ({ title: "t", groups: [{ id: "g", x: 0, y: 0, axis: "x", items }], frames: [] });

describe("a kind this build dropped", () => {
  it("is out of every registry, in every language", () => {
    expect(REMOVED_KINDS).toContain("fabMenu");
    expect(isRemovedKind({ kind: "fabMenu" })).toBe(true);
    expect(isRemovedKind({ kind: "box" })).toBe(false);
    expect(isRemovedKind({})).toBe(false);
    expect(isRemovedKind(null)).toBe(false);
    expect(KIND_ORDER).not.toContain("fabMenu" as never);
    expect(Object.keys(KIND_SPEC)).not.toContain("fabMenu");
    for (const { key } of LANGS) expect(Object.keys(KIND_TEXT[key]), key).not.toContain("fabMenu");
  });

  it("no longer names the confirm box, which is a kind of its own again", () => {
    /* 上一版做到一半的 confirmBox 曾被列在这里（作者画布上那一枚会在读入时被丢掉）；重做之后它是
       组件面板里正常的一员，所以这个名字必须从这张表里拿掉 —— 留在表里的话，新画的确认框会被读成
       "这个构建画不出来的部件"，整块连同里面的东西一起消失。 */
    expect(REMOVED_KINDS).not.toContain("confirmBox");
    expect(isRemovedKind({ kind: "confirmBox" })).toBe(false);
    expect(KIND_ORDER).toContain("confirmBox" as never);
    expect(Object.keys(KIND_SPEC)).toContain("confirmBox");
    for (const { key } of LANGS) expect(Object.keys(KIND_TEXT[key]), key).toContain("confirmBox");
    /* 一份只画着确认框的文档读得回来，部件一个不少 */
    const it = { ...makeItem("confirmBox"), id: "cb", label: "温馨提示", label2: "确认", label3: "取消" } as Item;
    expect(isPlacedItem(it)).toBe(true);
    expect(readDoc(stored([it]))!.groups[0].items.map((x) => x.kind)).toEqual(["confirmBox"]);
  });

  it("does not make the document invalid, and its part is left out", () => {
    const doc: unknown = stored([menu(), box()]);
    expect(isProject(doc)).toBe(true);
    const read = readDoc(doc)!;
    expect(read.groups).toHaveLength(1);
    expect(read.groups[0].items.map((it) => it.kind)).toEqual(["box"]);
    /* the rest of the document is intact */
    expect(read.groups[0].items[0]).toMatchObject({ id: "b", size2: 120 });
    expect((read as { title?: string }).title).toBe("t");
  });

  it("takes the run with it when the run held nothing else", () => {
    /* a run of nothing but removed parts goes, so a document that was only that one reads as an empty
       canvas rather than as one whose parts this build cannot draw */
    expect(readDoc(stored([menu()]))!.groups).toEqual([]);
    expect(readDoc(stored([menu(), box()]))!.groups).toHaveLength(1);
  });

  it("goes quietly from inside a container, with the container still standing", () => {
    const parent = { ...makeItem("box"), id: "p", children: [{ ...(menu() as PlacedItem), x: 0, y: 0 }] } as Item;
    const kept = readDoc(stored([parent]))!.groups[0].items[0];
    expect(kept.id).toBe("p");
    expect(kept.children).toEqual([]);
    /* and the autosave's reader leaves it out the same way */
    expect((readableGroups(stored([menu(), box()]).groups)[0].items as Item[]).map((it) => it.kind)).toEqual(["box"]);
  });

  it("never arrives on its own from the market", () => {
    /* a part is checked to be one this build can draw: a removed kind is not, and is filtered out */
    expect(isPlacedItem(menu())).toBe(false);
    expect(isPlacedItem(box())).toBe(true);
    expect(readItem({ ...makeItem("box"), id: "x", children: [{ ...(menu() as PlacedItem), x: 0, y: 0 }] })!.children).toEqual([]);
  });
});
