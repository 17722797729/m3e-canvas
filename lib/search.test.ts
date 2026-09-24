import { describe, expect, it } from "vitest";

import { searchLayers } from "./search";
import { makeItem, type Frame, type Group, type Item, type PlacedItem } from "./tokens";

/* Finding a row once a document has more pages than fit on screen. What a search looks through is
 * the whole point: a name the author typed, the words the part says, the words its destinations say,
 * its kind in the author's own language, and its id — which is what an agent reply or a prompt hands
 * back. */

const item = (id: string, extra: Partial<Item> = {}): Item => ({ ...makeItem("button"), id, label: id, ...extra });
const group = (id: string, items: Item[], extra: Partial<Group> = {}): Group => ({ id, x: 0, y: 0, axis: "y", items, ...extra });
const frame = (id: string, name: string, extra: Partial<Frame> = {}): Frame => ({ id, name, x: 0, y: 0, ...extra });

const doc = () => {
  const frames = [frame("home", "首页"), frame("bag", "仓库"), frame("detail", "道具详情", { note: "看一件道具的属性" })];
  const groups = [
    group("g1", [item("save", { label: "保存" }), item("b2", { label: "取消" })]),
    group("g2", [item("bagBtn", { label: "打开仓库", name: "背包入口" })]),
    group("g3", [
      { ...makeItem("tabs"), id: "tabs", label: "", tabs: [{ icon: "a", label: "材料" }, { icon: "b", label: "宝石" }] },
    ]),
    group(
      "g4",
      [
        { ...makeItem("box"), id: "holder", label: "卡片", children: [{ ...makeItem("text"), id: "deep", label: "稀有度" }] as PlacedItem[] },
      ],
      { frameId: "detail" },
    ),
    group("g5", [item("lost", { label: "屏幕外的按钮" })]),
  ];
  const owner: Record<string, string> = { g1: "home", g2: "home", g3: "detail", g4: "detail" };
  return { frames, groups, owner, frameIdOf: (id: string) => owner[id] ?? null };
};

describe("searchLayers", () => {
  it("finds a part by the name the author gave the row, not just by its words", () => {
    const { frames, groups, frameIdOf } = doc();
    const hits = searchLayers(frames, groups, frameIdOf, "背包", "zh");
    expect(hits.map((h) => h.itemId)).toEqual(["bagBtn"]);
    expect(hits[0].label).toBe("背包入口");
    /* the row says which page it lives on, since a result list reaches across pages */
    expect(hits[0].where).toBe("首页");
  });

  it("finds a part by its own words, its kind, one of its destinations, and its id", () => {
    const { frames, groups, frameIdOf } = doc();
    expect(searchLayers(frames, groups, frameIdOf, "保存", "zh").map((h) => h.itemId)).toEqual(["save"]);
    /* every button, wherever it is — the kind's noun is what the author reads in the panel */
    const buttons = searchLayers(frames, groups, frameIdOf, "按钮", "zh");
    expect(buttons.map((h) => h.itemId)).toEqual(["save", "b2", "bagBtn", "lost"]);
    expect(searchLayers(frames, groups, frameIdOf, "宝石", "zh").map((h) => h.itemId)).toEqual(["tabs"]);
    /* the id is what a prompt or an agent reply hands back */
    expect(searchLayers(frames, groups, frameIdOf, "bagBtn", "zh").map((h) => h.itemId)).toEqual(["bagBtn"]);
  });

  it("reaches inside containers, and finds a page by its name or what it is for", () => {
    const { frames, groups, frameIdOf } = doc();
    expect(searchLayers(frames, groups, frameIdOf, "稀有度", "zh").map((h) => h.itemId)).toEqual(["deep"]);
    const pages = searchLayers(frames, groups, frameIdOf, "详情", "zh");
    expect(pages.map((h) => [h.frameId, h.itemId])).toEqual([["detail", null]]);
    /* a page's own note is part of what it is, so a search can reach it by what it does */
    expect(searchLayers(frames, groups, frameIdOf, "属性", "zh").map((h) => h.frameId)).toEqual(["detail"]);
  });

  it("finds the parts no page owns, and says so rather than dropping them", () => {
    const { frames, groups, frameIdOf } = doc();
    const hits = searchLayers(frames, groups, frameIdOf, "屏幕外", "zh");
    expect(hits.map((h) => [h.frameId, h.itemId])).toEqual([["", "lost"]]);
    expect(hits[0].where).toBe("");
  });

  it("keeps document order, and finds nothing for an empty query", () => {
    const { frames, groups, frameIdOf } = doc();
    expect(searchLayers(frames, groups, frameIdOf, "  ", "zh")).toEqual([]);
    expect(searchLayers(frames, groups, frameIdOf, "", "zh")).toEqual([]);
    /* The pages are walked in document order, and a page's own row comes before the parts on it:
       the search reads the way the panel does, not as a flat sort by name. */
    const all = searchLayers(frames, groups, frameIdOf, "仓", "zh");
    expect(all.map((h) => [h.frameId, h.itemId])).toEqual([
      ["home", "bagBtn"],
      ["bag", null],
    ]);
    const detail = searchLayers(frames, groups, frameIdOf, "详情", "zh");
    expect(detail[0].itemId).toBeNull();
    /* the case does not matter, in any script */
    expect(searchLayers(frames, groups, frameIdOf, "BAGBTN", "zh").map((h) => h.itemId)).toEqual(["bagBtn"]);
  });

  it("says what a part is under its row when its own words are not the name", () => {
    const { frames, groups, frameIdOf } = doc();
    const [hit] = searchLayers(frames, groups, frameIdOf, "背包入口", "zh");
    expect(hit.label).toBe("背包入口");
    expect(hit.detail).toBe("打开仓库");
    /* a row named by its own words needs no second line */
    expect(searchLayers(frames, groups, frameIdOf, "保存", "zh")[0].detail).toBe("按钮");
  });
});
