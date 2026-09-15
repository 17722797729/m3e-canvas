import { describe, expect, it } from "vitest";

import { buildFlow, flowMarkdown, frameNameOf, itemNameOf, itemsOf, stateText, FLOW_TEXT, type Flow } from "./flow";
import { BACK_TARGET, type Doc, type Frame, type Group, type Item } from "./tokens";
import { KIND_TEXT } from "./i18n";

/* The document builders below are deliberately tiny: a test only spells out the
 * fields the flow reads, so it reads as the scenario it describes. */

const item = (patch: Partial<Item>): Item => ({ id: "i", kind: "button", label: "Go", icon: null, variant: "filled", ...patch });

const frame = (id: string, name: string, x = 0, y = 0): Frame => ({ id, name, x, y });

/** one screen per frame id, each run sitting at the frame's top-left corner */
const doc = (frames: Frame[], groups: Group[]): Doc => ({
  groups,
  frames,
  paletteKey: "purple",
  frame: "phone",
  title: "App",
  brief: "A small app",
});

/** a run of items on the frame with that id */
const run = (id: string, frame: Frame, items: Item[], patch: Partial<Group> = {}): Group => ({ id, x: frame.x, y: frame.y, axis: "x", items, ...patch });

const frames = [frame("home", "Home"), frame("details", "Details", 500), frame("popup", "Dialog", 1000)];

const nodeOf = (flow: Flow, id: string) => flow.nodes.find((n) => n.id === id)!;

describe("buildFlow nodes", () => {
  it("makes one node per frame, in frame order, and keeps a frame with no interactions", () => {
    const flow = buildFlow(doc(frames, [run("g", frames[0], [item({ id: "a", label: "Start" })])]), "en");
    expect(flow.nodes.map((n) => n.id)).toEqual(["home", "details", "popup"]);
    expect(flow.order).toEqual(["home", "details", "popup"]);
    expect(nodeOf(flow, "home").label).toBe("Home");
    expect(nodeOf(flow, "home").rules).toEqual([]);
    expect(nodeOf(flow, "home").description).toContain("Home is a screen");
  });

  it("names a part by its label, by its kind's noun when it has none, and never throws on an unknown kind", () => {
    expect(itemNameOf(item({ label: "Save" }), "en")).toBe("Save");
    expect(itemNameOf(item({ kind: "button", label: "  " }), "en")).toBe(KIND_TEXT.en["button"].noun);
    expect(itemNameOf(item({ kind: "nope" as Item["kind"], label: "" }), "en")).toBeTruthy();
    expect(itemNameOf(item({ kind: "fab", label: "", icon: "edit" }), "en")).toBe("edit");
    expect(frameNameOf("  ", "en")).toBe(FLOW_TEXT.en.untitled);
  });

  it("lists the first frame as a screen and a frame only ever opened as a popup", () => {
    const flow = buildFlow(
      doc(frames, [
        run("g1", frames[0], [item({ id: "a", label: "Open", action: { to: "popup", transition: "slide" } })]),
      ]),
      "en",
    );
    expect(nodeOf(flow, "home").kind).toBe("screen");
    expect(nodeOf(flow, "popup").kind).toBe("popup");
    expect(nodeOf(flow, "popup").description).toContain("popup");
    expect(nodeOf(flow, "popup").description).toContain("0 interactive parts");
  });

  it("walks the children of a part as if they were its own", () => {
    const child = item({ id: "child", label: "Nested", states: [{ id: "s1", trigger: "tap", effect: "hide" }] });
    const parent: Item = { ...item({ id: "parent", label: "Parent" }), children: [{ ...child, x: 8, y: 8 }] };
    const flow = buildFlow(doc([frames[0]], [run("g", frames[0], [parent])]), "en");
    expect(itemsOf(run("g", frames[0], [parent])).map((i) => i.id)).toEqual(["parent", "child"]);
    /* a part with no children at all is walked just the same */
    expect(itemsOf(run("g2", frames[0], [item({ id: "plain" })])).map((i) => i.id)).toEqual(["plain"]);
    expect(nodeOf(flow, "home").rules).toHaveLength(1);
    expect(nodeOf(flow, "home").rules[0]).toMatchObject({ kind: "state", itemId: "child" });
  });
});

describe("buildFlow edges", () => {
  it("merges every trigger of a from→to pair into one edge", () => {
    const flow = buildFlow(
      doc(frames, [
        run("g", frames[0], [
          item({ id: "a", label: "Start", action: { to: "details", transition: "slide" } }),
          item({ id: "b", label: "More", action: { to: "details", transition: "fade" } }),
        ]),
      ]),
      "en",
    );
    expect(flow.edges.map((e) => e.id)).toEqual(["home->details"]);
    expect(flow.edges[0].triggers.map((t) => t.itemId)).toEqual(["a", "b"]);
    expect(flow.edges[0].triggers.map((t) => t.itemLabel)).toEqual(["Start", "More"]);
  });

  it("says the source frame, the part and the target frame in English and in Japanese", () => {
    const en = buildFlow(doc(frames, [run("g", frames[0], [item({ id: "a", label: "Start", action: { to: "details", transition: "slide" } })])]), "en");
    const jp = [frame("home", "ホーム"), frame("details", "詳細", 500)];
    const ja = buildFlow(doc(jp, [run("g", jp[0], [item({ id: "a", label: "開始", action: { to: "details", transition: "slide" } })])]), "ja");
    expect(en.edges[0].label).toContain("Home");
    expect(en.edges[0].label).toContain("Details");
    expect(en.edges[0].description).toContain("Start");
    expect(en.edges[0].description).not.toBe(ja.edges[0].description);
    expect(ja.edges[0].label).toContain("ホーム");
    expect(ja.edges[0].label).toContain("詳細");
    expect(ja.edges[0].description).toContain("開始");
    expect(ja.nodes[0].label).toBe("ホーム");
    expect(ja.nodes[0].description).not.toBe(en.nodes[0].description);
  });

  it("ignores a `back` action, a missing target and a jump to the same frame", () => {
    const flow = buildFlow(
      doc(frames, [
        run("g", frames[0], [
          item({ id: "back", label: "Back", action: { to: BACK_TARGET, transition: "slideLeft" } }),
          item({ id: "gone", label: "Gone", action: { to: "nope", transition: "slide" } }),
          item({ id: "self", label: "Self", action: { to: "home", transition: "fade" } }),
        ]),
      ]),
      "en",
    );
    expect(flow.edges).toEqual([]);
    expect(nodeOf(flow, "home").rules).toEqual([]);
    /* the back action is still told, on the screen that carries it, and it counts
     * as a part that reacts even though it leaves no rule behind */
    expect(nodeOf(flow, "home").description).toContain("Back");
    expect(nodeOf(flow, "home").description).toContain("1 interactive part");
  });

  it("keeps the frame order but gives an unreachable frame depth 0", () => {
    const flow = buildFlow(
      doc(frames, [
        run("g1", frames[0], [item({ id: "a", label: "Next", action: { to: "details", transition: "slide" } })]),
        run("g2", frames[1], [item({ id: "b", label: "On", action: { to: "popup", transition: "fade" } })]),
      ]),
      "en",
    );
    expect(nodeOf(flow, "home").depth).toBe(0);
    expect(nodeOf(flow, "details").depth).toBe(1);
    expect(nodeOf(flow, "popup").depth).toBe(2);
    expect(flow.nodes.map((n) => n.id)).toEqual(["home", "details", "popup"]);

    const orphan = buildFlow(doc([frame("a", "A"), frame("b", "B", 0, 2000)], []), "en");
    expect(orphan.nodes.map((n) => n.depth)).toEqual([0, 0]);
  });
});

describe("state rules", () => {
  it("describes every effect in all four languages", () => {
    const states = [
      { id: "s1", trigger: "tap" as const, effect: "disable" as const },
      { id: "s2", trigger: "tap" as const, effect: "cooldown" as const, seconds: 5 },
      { id: "s3", trigger: "tap" as const, effect: "label" as const, value: "Done" },
      { id: "s4", trigger: "tap" as const, effect: "variant" as const, value: "tonal" },
      { id: "s5", trigger: "tap" as const, effect: "hide" as const },
    ];
    const value = doc([frames[0]], [run("g", frames[0], [item({ id: "a", label: "Tap", states })])]);
    for (const lang of ["ja", "en", "zh", "ko"] as const) {
      const flow = buildFlow(value, lang);
      const rules = nodeOf(flow, "home").rules;
      expect(rules.map((r) => r.kind)).toEqual(["state", "state", "state", "state", "state"]);
      for (const r of rules) expect(r.description.length).toBeGreaterThan(0);
      expect(rules.map((r) => r.description).join(" ")).toContain("Tap");
      const md = flowMarkdown(flow, lang);
      for (const r of rules) expect(md).toContain(r.description);
    }
    expect(stateText(states[1], "Tap", "en")).toContain("5");
    expect(stateText(states[2], "Tap", "en")).toContain("Done");
    expect(stateText(states[3], "Tap", "en")).toContain("tonal");
  });

  it("says a cooldown goes back to how the part looked", () => {
    const rule = { id: "s", trigger: "tap" as const, effect: "cooldown" as const, seconds: 4 };
    for (const lang of ["ja", "en", "zh", "ko"] as const) {
      expect(stateText(rule, "Tap", lang)).toContain("4");
      expect(FLOW_TEXT[lang].state.cooldown("Tap", "", "4")).toBe(stateText(rule, "Tap", lang));
    }
    expect(stateText(rule, "Tap", "en").toLowerCase()).toContain("goes back");
    expect(stateText(rule, "Tap", "zh")).toContain("恢复原样式");
  });

  it("names the destination that was tapped on a bar, not the bar itself", () => {
    const bar = item({
      id: "nav",
      kind: "bottomNav",
      label: "",
      tabs: [{ icon: "home", label: "Home" }, { icon: "swords", label: "Battle" }, { icon: "person", label: "Profile" }],
      actions: { "tab:1": { to: "details", transition: "slide" } },
    });
    const flow = buildFlow(doc(frames, [run("g", frames[0], [bar])]), "en");
    expect(flow.edges).toHaveLength(1);
    expect(flow.edges[0].label).toContain("Battle");
    expect(flow.edges[0].label).not.toContain(KIND_TEXT.en.bottomNav.noun);
    expect(flow.edges[0].description).toContain("Battle");
    expect(flow.edges[0].triggers[0]).toMatchObject({ itemId: "nav", itemLabel: "Battle" });
    /* a bar's own icon slot falls back to the bar's name when it has one */
    const bar2 = item({ id: "bar", kind: "topAppBar", label: "Inbox", icon: "menu", action: { to: "details", transition: "none" } });
    const flow2 = buildFlow(doc(frames, [run("g2", frames[0], [bar2])]), "en");
    expect(flow2.edges[0].label).toContain("Inbox");
  });

  it("keeps a state rule on its own node and names the part it belongs to", () => {
    const flow = buildFlow(
      doc(frames, [run("g", frames[0], [item({ id: "a", label: "Start", states: [{ id: "s", trigger: "tap", effect: "disable" }] })])]),
      "en",
    );
    expect(nodeOf(flow, "home").rules).toHaveLength(1);
    expect(nodeOf(flow, "details").rules).toEqual([]);
    expect(flow.edges).toEqual([]);
    expect(flowMarkdown(flow, "en")).toContain("Start");
  });
});

describe("flowMarkdown", () => {
  it("writes a title, a section per screen, its rules and the transition list", () => {
    const flow = buildFlow(
      doc(frames, [
        run("g", frames[0], [
          item({ id: "a", label: "Start", action: { to: "details", transition: "slide" }, states: [{ id: "s", trigger: "tap", effect: "disable" }] }),
        ]),
      ]),
      "en",
    );
    const md = flowMarkdown(flow, "en");
    expect(md.startsWith(`# ${FLOW_TEXT.en.title}`)).toBe(true);
    expect(md).toContain("## Home");
    expect(md).toContain("## Details");
    expect(md).toContain("## Dialog");
    expect(md).toContain(`## ${FLOW_TEXT.en.transitions}`);
    expect(md).toContain("Home → Details");
    expect(md).toContain(flow.edges[0].description);
    /* the state rule is listed on its own screen and again in the closing list */
    const state = nodeOf(flow, "home").rules.find((r) => r.kind === "state")!;
    expect(md.split("\n").filter((l) => l === `- ${state.description}`)).toHaveLength(1);
    expect(md.split("\n").filter((l) => l === `- Home: ${state.description}`)).toHaveLength(1);

    const ja = flowMarkdown(flow, "ja");
    expect(ja.startsWith(`# ${FLOW_TEXT.ja.title}`)).toBe(true);
    expect(ja).not.toBe(md);
  });

  it("says there is nothing to show for an empty document", () => {
    const md = flowMarkdown(buildFlow(doc([], []), "en"), "en");
    expect(md).toContain(FLOW_TEXT.en.empty);
    expect(md).toContain(FLOW_TEXT.en.emptyHint);
    expect(md.startsWith(`# ${FLOW_TEXT.en.title}`)).toBe(true);
  });
});
