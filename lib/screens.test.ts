import { describe, expect, it } from "vitest";
import {
  BACK_TARGET,
  CLOSE_PANEL_TARGET,
  FRAME_GAP,
  makeItem,
  type Frame,
  type Group,
  type Item,
  type PartFlow,
  type Doc,
  type PlacedItem,
  type RuleAction,
} from "./tokens";
import { MAX_UPLOAD_SCREENS, placeScreens, refCountsOf, refsOfScreen, remapRefs, remapTree, screenClosure, screensAsDoc } from "./screens";
import type { ScreenData } from "./market";
import { packData, parseMarketData, screenDataOf } from "./market";
import { audit } from "./audit";

/* 上传一个屏幕时要判断"这一组要带走几屏"。全部是纯数据，所以这里不碰界面也不碰打包格式：
 * 一份文档 + 一个起屏进，要带的屏、越界的引用、死链出来。 */

const frame = (id: string, patch: Partial<Frame> = {}): Frame => ({ id, name: id.toUpperCase(), x: 0, y: 0, w: 412, h: 892, ...patch });

/** 一屏一组：组认 `frameId`，所以这里不用管坐标 */
const doc = (screens: Record<string, Item[]>, patch: Record<string, Partial<Frame>> = {}) => {
  const ids = Object.keys(screens);
  const frames = ids.map((id) => frame(id, patch[id]));
  const groups: Group[] = ids.map((id) => ({
    id: `g-${id}`,
    x: 0,
    y: 0,
    axis: "x",
    frameId: id,
    items: screens[id].map((it, i) => ({ ...it, x: i * 60, y: 0 }) as PlacedItem),
  }));
  return { frames, groups };
};

const part = (id: string, patch: Partial<Item> = {}): Item => ({ ...makeItem("button"), id, label: id, ...patch }) as Item;
const goTo = (to: string) => ({ to, transition: "none" as const });
/** 一台只有一步的机器：点一下，做这几件事 */
const flowOf = (...do_: RuleAction[]): PartFlow => ({
  looks: [],
  steps: [{ id: "st", from: ":start", to: ":start", trigger: { kind: "tap" }, do: do_ }],
});
/** 一个画在本屏上的浮层容器 */
const sheet = (id: string, children: Item[] = []): Item =>
  ({ ...makeItem("box"), id, label: id, overlay: "modal", children: children.map((c, i) => ({ ...c, x: 0, y: i * 40 }) as PlacedItem) }) as Item;

const closureOf = (source: ReturnType<typeof doc>, start: string) =>
  screenClosure(source.frames.find((f) => f.id === start)!, source.groups, source.frames, {});
const refsOf = (source: ReturnType<typeof doc>, id: string) =>
  refsOfScreen(source.frames.find((f) => f.id === id)!, source.groups, source.frames, {});

describe("what a screen references", () => {
  it("counts a tap at another screen, and carries it", () => {
    const d = doc({ A: [part("a1", { action: goTo("B") })], B: [part("b1")] });
    const { out, dead } = refsOf(d, "A");
    expect(dead).toEqual([]);
    expect(out).toEqual([{ via: "tap", to: "B", itemId: "a1", owner: "B" }]);
    const closure = closureOf(d, "A");
    expect(closure.screens.map((f) => f.id)).toEqual(["A", "B"]);
    expect(closure.over).toBe(false);
  });

  it("carries an overlay screen the same way — a 弹框 is still a screen", () => {
    const d = doc({ A: [part("a1", { action: goTo("B") })], B: [part("b1")] }, { B: { role: "overlay", level: "modal" } });
    const closure = closureOf(d, "A");
    expect(closure.screens.map((f) => f.id)).toEqual(["A", "B"]);
    /* 它还是那一屏：role / level 原样跟着走，落地后仍旧弹在那一屏上 */
    expect(closure.screens[1].role).toBe("overlay");
    expect(closure.screens[1].level).toBe("modal");
  });

  it("counts a bar slot's own tap", () => {
    const d = doc({ A: [part("bar", { kind: "confirmBox", actions: { cancel: goTo("B") } })], B: [part("b1")] });
    expect(refsOf(d, "A").out).toEqual([{ via: "slot", to: "B", itemId: "bar", owner: "B" }]);
  });

  it("counts a swipe set on the screen itself", () => {
    /* 这一条长在屏上、不在部件上 —— 最容易漏的那一类 */
    const d = doc({ A: [part("a1")], B: [part("b1")] }, { A: { swipe: { left: "B" } } });
    const { out, dead } = refsOf(d, "A");
    expect(dead).toEqual([]);
    expect(out).toEqual([{ via: "swipe", to: "B", owner: "B" }]);
    expect(out[0].itemId).toBeUndefined();
    expect(closureOf(d, "A").screens.map((f) => f.id)).toEqual(["A", "B"]);
  });

  it("counts a step that changes a part living on another screen", () => {
    const d = doc({ A: [part("a1", { flow: flowOf({ kind: "look", target: "c1", hidden: true }) })], C: [part("c1")] });
    expect(refsOf(d, "A").out).toEqual([{ via: "look", to: "c1", itemId: "a1", owner: "C" }]);
    expect(closureOf(d, "A").screens.map((f) => f.id)).toEqual(["A", "C"]);
  });

  it("counts a step that jumps, and a text that reads another screen's part", () => {
    const jump = doc({ A: [part("a1", { flow: flowOf({ kind: "goto", to: "B", transition: "none" }) })], B: [part("b1")] });
    expect(refsOf(jump, "A").out).toEqual([{ via: "goto", to: "B", itemId: "a1", owner: "B" }]);
    const reading = doc({ A: [part("t1", { kind: "text", shows: "d1" })], D: [part("d1")] });
    expect(refsOf(reading, "A").out).toEqual([{ via: "shows", to: "d1", itemId: "t1", owner: "D" }]);
    expect(closureOf(reading, "A").screens.map((f) => f.id)).toEqual(["A", "D"]);
  });

  it("looks inside containers too", () => {
    const nested = part("wrap", { kind: "box", children: [{ ...part("deep", { action: goTo("B") }), x: 0, y: 0 } as PlacedItem] });
    const d = doc({ A: [nested], B: [part("b1")] });
    expect(refsOf(d, "A").out).toEqual([{ via: "tap", to: "B", itemId: "deep", owner: "B" }]);
  });

  it("leaves the two sentinels alone: back and close don't name any screen", () => {
    const d = doc({ A: [part("a1", { action: goTo(BACK_TARGET) }), part("a2", { action: goTo(CLOSE_PANEL_TARGET) })] });
    const { out, dead } = refsOf(d, "A");
    expect(out).toEqual([]);
    expect(dead).toEqual([]);
  });

  it("leaves a reference that never leaves this screen out of both lists", () => {
    /* 画在**本屏**上的浮层：不带走任何屏。它的 id 落地时会换，那由落地那一步重指（见 docs） */
    const d = doc({ A: [part("open", { action: goTo("ov") }), sheet("ov")] });
    const { out, dead } = refsOf(d, "A");
    expect(out).toEqual([]);
    expect(dead).toEqual([]);
  });

  it("reports a reference that leads nowhere as dead, and carries nothing for it", () => {
    const d = doc({ A: [part("a1", { action: goTo("gone") }), part("a2", { action: goTo("plain") })], B: [part("plain")] });
    /* `plain` 是一个普通部件：预览只在一屏的浮层里找这个 id，所以它和"没有这个 id"一样是死链 */
    const { out, dead } = refsOf(d, "A");
    expect(out).toEqual([]);
    expect(dead).toEqual([
      { via: "tap", to: "gone", itemId: "a1", owner: null },
      { via: "tap", to: "plain", itemId: "a2", owner: null },
    ]);
    expect(closureOf(d, "A").screens.map((f) => f.id)).toEqual(["A"]);
  });

  it("knows a goto can only land on a screen, while a tap may also open an overlay drawn on one", () => {
    /* 流程里的跳转走 go()，只认 frame id；指到一个浮层部件是死链（那条路不会打开它） */
    const rule = doc({ A: [part("a1", { flow: flowOf({ kind: "goto", to: "ov", transition: "none" }) }), sheet("ov")] });
    expect(refsOf(rule, "A").dead).toEqual([{ via: "goto", to: "ov", itemId: "a1", owner: null }]);
    /* 而点击可以打开那道浮层，它落在本屏上，所以既不是 out 也不是 dead */
    const tap = doc({ A: [part("a1", { action: goTo("ov") }), sheet("ov")] });
    expect(refsOf(tap, "A")).toEqual({ out: [], dead: [] });
  });
});

describe("the closure a screen carries", () => {
  it("follows a chain, and refuses to go past three screens", () => {
    const chain = (n: number) => {
      const screens: Record<string, Item[]> = {};
      for (let i = 0; i < n; i++) {
        const id = String.fromCharCode(65 + i);
        const next = String.fromCharCode(66 + i);
        screens[id] = [part(`${id}1`, i < n - 1 ? { action: goTo(next) } : {})];
      }
      return doc(screens);
    };
    expect(MAX_UPLOAD_SCREENS).toBe(3);
    /* A→B→C 正好三屏：允许 */
    const three = closureOf(chain(3), "A");
    expect(three.screens.map((f) => f.id)).toEqual(["A", "B", "C"]);
    expect(three.over).toBe(false);
    /* A→B→C→D 四屏：不让上传，但闭包照样算完整，提示里才说得清多出来的是谁 */
    const four = closureOf(chain(4), "A");
    expect(four.screens.map((f) => f.id)).toEqual(["A", "B", "C", "D"]);
    expect(four.over).toBe(true);
  });

  it("carries a mutual pair once each — a loop is not a reason to bring anything twice", () => {
    const d = doc({ A: [part("a1", { action: goTo("B") })], B: [part("b1", { action: goTo("A") })] });
    const closure = closureOf(d, "A");
    expect(closure.screens.map((f) => f.id)).toEqual(["A", "B"]);
    /* 两条引用都在，落地时要按它们各指一遍 */
    expect(closure.refs.map((r) => [r.to, r.owner])).toEqual([["B", "B"], ["A", "A"]]);
    expect(closure.over).toBe(false);
  });

  it("does not chase a screen that only points back at one already carried", () => {
    /* A→B、A→C、B→C、C→B：B 与 C 各一次 */
    const d = doc({
      A: [part("a1", { action: goTo("B") }), part("a2", { action: goTo("C") })],
      B: [part("b1", { action: goTo("C") })],
      C: [part("c1", { action: goTo("B") })],
    });
    expect(closureOf(d, "A").screens.map((f) => f.id)).toEqual(["A", "B", "C"]);
  });

  it("ignores a screen pointing at itself", () => {
    const d = doc({ A: [part("a1", { action: goTo("A") })], B: [part("b1")] }, { A: { swipe: { right: "A" } } });
    const { out, dead } = refsOf(d, "A");
    expect(out).toEqual([]);
    expect(dead).toEqual([]);
    expect(closureOf(d, "A").screens.map((f) => f.id)).toEqual(["A"]);
  });

  it("gathers what a carried screen itself references, and counts who is referenced how often", () => {
    /* A→B（两处：一处点击、一步跳转）、A→C、B→D：从 A 出发要带 A、B、C、D 四屏（超上限），引用一条不少 */
    const d = doc({
      A: [part("a1", { action: goTo("B") }), part("a2", { action: goTo("C") }), part("a3", { flow: flowOf({ kind: "goto", to: "B", transition: "none" }) })],
      B: [part("b1", { action: goTo("D") })],
      C: [part("c1")],
      D: [part("d1")],
    });
    const closure = closureOf(d, "A");
    expect(closure.screens.map((f) => f.id)).toEqual(["A", "B", "C", "D"]);
    expect(closure.over).toBe(true);
    const counts = refCountsOf(closure.refs);
    expect(counts.get("B")).toBe(2);
    expect(counts.get("C")).toBe(1);
    expect(counts.get("D")).toBe(1);
    /* 起屏自己不被谁引用 */
    expect(counts.get("A")).toBeUndefined();
  });

  it("hands back the screens themselves, so role, level and everything else travel with them", () => {
    const d = doc(
      { A: [part("a1", { action: goTo("B") })], B: [part("b1")] },
      { B: { role: "overlay", level: "sheet", autoClose: 3, note: "问一句" } },
    );
    const b = closureOf(d, "A").screens[1];
    expect([b.role, b.level, b.autoClose, b.note]).toEqual(["overlay", "sheet", 3, "问一句"]);
  });
});

/* ---------- 落地：建真屏 + 重指引用 ---------- */

describe("landing the screens a component brings", () => {
  const placed_ = (id: string, patch: Partial<Item> = {}): PlacedItem => ({ ...part(id, patch), x: 0, y: 0 });
  const screenOf = (id: string | undefined, name: string, items: PlacedItem[], patch: Partial<ScreenData> = {}): ScreenData => ({
    ...(id ? { id } : undefined),
    name,
    w: 412,
    h: 892,
    groups: [{ x: 10, y: 20, axis: "x", items }],
    ...patch,
  });

  it("builds the referenced screens as real pages, leaving the start screen to the instance", () => {
    let n = 0;
    const nextId = () => `new${++n}`;
    const placed = placeScreens(
      [
        screenOf("A", "甲", [placed_("a1")]),
        screenOf("B", "乙", [placed_("b1")], { role: "overlay", level: "modal" }),
        screenOf("C", "丙", [placed_("c1")], { w: 300, h: 500 }),
      ],
      { frameId: "host", x: 1000, y: 50 },
      nextId,
    );
    /* 起屏不建：它的内容就是拖进来的那个实例；被引用的两屏各建一页真屏 */
    expect(placed.frames.map((f) => [f.name, f.w, f.h, f.role, f.level])).toEqual([
      ["乙", 412, 892, "overlay", "modal"],
      ["丙", 300, 500, undefined, undefined],
    ]);
    /* 摆在起屏右边，屏与屏之间是新屏幕那个间距 */
    expect(placed.frames.map((f) => [f.x, f.y])).toEqual([
      [1000, 50],
      [1000 + 412 + FRAME_GAP, 50],
    ]);
    /* 旧 id 对上新的：起屏指向组件所落的那一页 */
    expect(placed.frameMap.get("A")).toBe("host");
    expect(placed.frameMap.get("B")).toBe(placed.frames[0].id);
    expect(placed.frameMap.get("C")).toBe(placed.frames[1].id);
    expect(placed.itemMap.get("b1")).toBe(placed.groups[0].items[0].id);
    /* 组摆在那一屏自己的坐标系里，并且认这一屏 */
    expect([placed.groups[0].x, placed.groups[0].y, placed.groups[0].frameId]).toEqual([1010, 70, placed.frames[0].id]);
  });

  it("keeps a free group's own offsets when its parts get new ids", () => {
    const free: ScreenData = {
      id: "B",
      name: "乙",
      w: 412,
      h: 892,
      groups: [{ x: 0, y: 0, axis: "x", free: true, pos: { b1: { x: 5, y: 6 } }, items: [placed_("b1")] }],
    };
    const placed = placeScreens([screenOf("A", "甲", []), free], { frameId: "host", x: 0, y: 0 });
    const moved = placed.itemMap.get("b1")!;
    expect(placed.groups[0].pos?.[moved]).toEqual({ x: 5, y: 6 });
  });

  it("turns every kind of reference onto the new ids, and leaves the sentinels alone", () => {
    const frameMap = new Map([
      ["A", "host"],
      ["B", "B2"],
    ]);
    const itemMap = new Map([
      ["b1", "b1x"],
      ["a9", "a9x"],
    ]);
    const instance = {
      ...part("i1"),
      action: { to: "B", transition: "none" as const },
      actions: { cancel: { to: "A", transition: "none" as const }, go: { to: "close", transition: "none" as const } },
      flow: flowOf({ kind: "goto", to: "B", transition: "none" }, { kind: "look", target: "b1", hidden: true }),
      shows: "a9",
    } as Item;

    const out = remapRefs(instance, frameMap, itemMap);
    expect(out.action?.to).toBe("B2");
    expect(out.actions?.cancel.to).toBe("host");
    /* 两个哨兵在本地兑现，谁也动不了它们 */
    expect(out.actions?.go.to).toBe(CLOSE_PANEL_TARGET);
    expect(out.flow?.steps[0].do).toEqual([
      { kind: "goto", to: "B2", transition: "none" },
      { kind: "look", target: "b1x", hidden: true },
    ]);
    expect(out.shows).toBe("a9x");
    /* 机器内部的状态 id 一个都不碰 */
    expect([out.flow?.steps[0].from, out.flow?.steps[0].to]).toEqual([":start", ":start"]);
  });

  it("hands back the very same part when nothing it says points anywhere", () => {
    const plain = part("p1");
    expect(remapRefs(plain, new Map([["A", "host"]]), new Map())).toBe(plain);
    /* 认不出来的目标原样留着（那是死链，交给审计面板） */
    const odd = part("p2", { action: { to: "gone", transition: "none" } });
    expect(remapRefs(odd, new Map([["A", "host"]]), new Map())).toBe(odd);
  });

  it("looks inside containers too, and remaps a whole run at once", () => {
    const wrap = {
      ...part("w1"),
      children: [{ ...part("deep", { action: { to: "B", transition: "none" } }), x: 0, y: 0 } as PlacedItem],
    } as Item;
    const out = remapRefs(wrap, new Map([["B", "B2"]]), new Map());
    expect(out.children?.[0].action?.to).toBe("B2");

    const run = [placed_("p1", { action: { to: "B", transition: "none" } }), placed_("p2")];
    const remapped = remapTree(run, new Map([["B", "B2"]]), new Map());
    expect(remapped[0].action?.to).toBe("B2");
    /* 没动过的那一个还是它自己 */
    expect(remapped[1]).toBe(run[1]);
  });

  it("cannot rebuild a screen that carries no id — the link simply stays where it was", () => {
    /* 老组件（那一版还没有 id）：屏照样画得出来，只是没人认得那些引用 */
    const placed = placeScreens([screenOf(undefined, "旧的一屏", [placed_("x1")])], { frameId: "host", x: 0, y: 0 });
    expect(placed.frames).toEqual([]);
    expect([...placed.frameMap]).toEqual([]);
  });

  /* 整条链的验收：作者那边 A→B（弹框）、B→C、C→B（环）打包上传，接收方落地之后
     **一处死链都不该剩下** —— 流程图与文档都是从文档现算的，所以它们也就自动有了那几屏。 */
  it("lands a three-screen component with no dead link left anywhere", () => {
    const author = (id: string, items: Item[], patch: Partial<Frame> = {}): { frame: Frame; group: Group } => ({
      frame: { id, name: id, x: 0, y: 0, w: 412, h: 892, ...patch },
      group: { id: `g-${id}`, x: 12, y: 34, axis: "x", frameId: id, items: items.map((it) => ({ ...it, x: 0, y: 0 }) as PlacedItem) },
    });
    const a = author("A", [part("a1", { action: goTo("B") })]);
    const b = author("B", [part("b1", { action: goTo("C") })], { role: "overlay", level: "modal" });
    /* 走一个圈回到起屏：C 那一颗指向 A，落地时该指到"组件所落的那一页" */
    const c = author("C", [part("c1", { action: goTo("A") })]);
    const frames = [a.frame, b.frame, c.frame];
    const groups = [a.group, b.group, c.group];
    /* 打包 → 读回来：屏名、身份与组都原样还在 */
    const bundle = frames.map((f) => screenDataOf(f, groups, frames, {}));
    const tight = [{ x: a.group.x, y: a.group.y, axis: a.group.axis, items: a.group.items as PlacedItem[] }];
    const parsed = parseMarketData(packData(tight, { w: 412, h: 892 }, undefined, bundle[0], bundle))!;
    expect(parsed.screens.map((s) => s.name)).toEqual(["A", "B", "C"]);

    /* 接收方：一次落地（起屏指向组件所落的那一页），再把实例自己与那几屏的引用都重指一遍 */
    const placed = placeScreens(parsed.screens, { frameId: "host", x: 0, y: 0 });
    expect(placed.frames.map((f) => f.name)).toEqual(["B", "C"]);
    const doc = {
      frame: "phone",
      paletteKey: "mono",
      title: "接收方",
      brief: "",
      frames: [{ id: "host", name: "我的页", x: 0, y: 0, w: 412, h: 892 }, ...placed.frames],
      groups: [
        { id: "g-host", x: 0, y: 0, axis: "x", frameId: "host", items: remapTree(parsed.groups[0].items, placed.frameMap, placed.itemMap) },
        ...placed.groups.map((g) => ({ ...g, items: remapTree(g.items, placed.frameMap, placed.itemMap) })),
      ],
    } as Doc;

    /* 验收标准：一处死链都没有 */
    expect(audit(doc, {}).filter((issue) => issue.kind === "deadLink")).toEqual([]);
    /* 每一条线都指到了新家：A 那一颗 → 新建出来的 B；B → 新建出来的 C；C 转回 A → 组件所落的那一页 */
    expect((doc.groups[0].items[0] as Item).action?.to).toBe(placed.frameMap.get("B"));
    expect((doc.groups[1].items[0] as Item).action?.to).toBe(placed.frameMap.get("C"));
    expect((doc.groups[2].items[0] as Item).action?.to).toBe("host");
  });
});

/* 市场详情页的预览：**整组**屏铺成一份文档，于是 A 上那颗按钮点下去真的会弹出 B 那一屏。
 * （从前预览只铺当前那一屏，A 的引用指着一个文档里不存在的 id，点下去什么都不发生。） */
describe("laying the whole group out as one document (the market detail preview)", () => {
  const placed_ = (id: string, patch: Partial<Item> = {}): PlacedItem => ({ ...part(id, patch), x: 0, y: 0 });
  const screenOf = (id: string, name: string, items: PlacedItem[], patch: Partial<ScreenData> = {}): ScreenData => ({
    id,
    name,
    w: 412,
    h: 892,
    groups: [{ x: 10, y: 20, axis: "x", items }],
    ...patch,
  });

  it("keeps every screen, with A's button pointing at the B that is right there in the document", () => {
    const { frames, groups, startId } = screensAsDoc([
      screenOf("A", "甲", [placed_("a1", { action: goTo("B") })]),
      screenOf("B", "乙", [placed_("b1")], { role: "overlay", level: "modal" }),
    ]);
    expect(frames.map((f) => f.name)).toEqual(["甲", "乙"]);
    expect(startId).toBe(frames[0].id);
    /* 浮层屏照旧是浮层：预览里它是弹在甲上面的那一层，不是一页普通屏幕 */
    expect([frames[1].role, frames[1].level]).toEqual(["overlay", "modal"]);
    /* 甲那颗按钮现在指到文档里真的存在的那一屏 */
    expect(groups[0].items[0].action?.to).toBe(frames[1].id);
    /* 一屏一组，各认各的屏 */
    expect(groups.map((g) => g.frameId)).toEqual(frames.map((f) => f.id));
  });

  it("resolves a reference that names a part of a screen built later on", () => {
    /* 复制与重指分两趟走的原因：边复制边重指，甲里那条"改丙上的部件"就查不到丙 —— 丙那时还没建出来 */
    const { frames, groups } = screensAsDoc([
      screenOf("A", "甲", [placed_("a1", { flow: flowOf({ kind: "look", target: "c9", hidden: true }) })]),
      screenOf("B", "乙", [placed_("b1")]),
      screenOf("C", "丙", [placed_("c9")]),
    ]);
    const target = groups[0].items[0].flow?.steps[0].do?.[0];
    expect(target).toEqual({ kind: "look", target: groups[2].items[0].id, hidden: true });
    expect(frames).toHaveLength(3);
  });

  it("closes a loop inside the preview document too", () => {
    const { frames, groups } = screensAsDoc([
      screenOf("A", "甲", [placed_("a1", { action: goTo("B") })]),
      screenOf("B", "乙", [placed_("b1", { action: goTo("A") })], { role: "overlay", level: "sheet" }),
    ]);
    expect(groups[0].items[0].action?.to).toBe(frames[1].id);
    expect(groups[1].items[0].action?.to).toBe(frames[0].id);
  });

  it("hands back nothing at all for a component that carries no screen", () => {
    expect(screensAsDoc([])).toEqual({ frames: [], groups: [], startId: null });
  });
});
