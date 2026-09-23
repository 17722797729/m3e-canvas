import { describe, expect, it } from "vitest";

import { buildFlow, flowMarkdown, frameNameOf, itemNameOf, itemsOf, stateText, FLOW_TEXT, type Flow } from "./flow";
import { BACK_TARGET, START_LOOK, makeItem, type Doc, type Frame, type Group, type Item } from "./tokens";
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

describe("naming a part", () => {
  it("prefers the name its author gave the row over the text it shows", () => {
    const badge = item({ id: "b", kind: "badge", label: "3", name: "未读消息" });
    expect(itemNameOf(badge, "zh")).toBe("未读消息");
    /* an unnamed part is still named by its text, and a textless one by its kind */
    expect(itemNameOf(item({ id: "b2", kind: "badge", label: "3" }), "zh")).toBe("3");
    expect(itemNameOf(item({ id: "b3", kind: "badge", label: "" }), "zh")).toBe("徽标");
  });
});

describe("a part's machine", () => {
  const machine = (patch: Partial<Item>): Item =>
    item({
      id: "share",
      label: "分享",
      icon: "share",
      flow: {
        looks: [
          { id: "l2", label: "领取", icon: "redeem" },
          { id: "l3", label: "已领取", icon: "check_circle", disabled: true },
        ],
        steps: [
          { id: "s1", from: ":start", to: "l2", trigger: { kind: "tap" } },
          { id: "s2", from: "l2", to: "l3", trigger: { kind: "tap" } },
          { id: "s3", from: "l3", to: ":start", trigger: { kind: "after", seconds: 30 } },
        ],
      },
      ...patch,
    });

  it("describes every step as the move it makes, naming the look it lands in", () => {
    const home = frame("home", "Home");
    const flow = buildFlow(doc([home], [run("g", home, [machine({})])]), "zh");
    const said = nodeOf(flow, "home").rules.map((r) => r.description);
    expect(said).toHaveLength(3);
    /* the first step reaches the second look: the words it shows, and what that look changes */
    expect(said[0]).toContain("点击后");
    expect(said[0]).toContain("领取");
    expect(said[0]).toContain("图标 redeem");
    /* the drawn look is a target of its own, named rather than left blank */
    expect(said[2]).toContain("30 秒后");
    expect(said[2]).toContain(FLOW_TEXT.zh.drawnLook);
    /* and a look that greys the part out says so */
    expect(said[1]).toContain(FLOW_TEXT.zh.lookChange.off);
    expect(flowMarkdown(buildFlow(doc([home], [run("g", home, [machine({})])]), "en"), "en")).toContain("领取");
  });

  it("reads a step's jump as an edge of the screen flow, like any other tap", () => {
    const home = frame("home", "Home");
    const next = frame("next", "Next", 500);
    const flow = buildFlow(
      doc(
        [home, next],
        [
          run("g", home, [machine({ flow: { looks: [{ id: "l2", label: "领取" }], steps: [{ id: "s1", from: ":start", to: "l2", trigger: { kind: "tap" }, do: [{ kind: "goto", to: "next", transition: "slide" }] }] } })]),
          run("g2", next, [item({ id: "back", action: { to: BACK_TARGET, transition: "slide" } })]),
        ],
      ),
      "en",
    );
    expect(flow.edges.map((e) => `${e.from}->${e.to}`)).toContain("home->next");
    expect(nodeOf(flow, "home").rules.map((r) => r.kind)).toContain("jump");
  });
});

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
    /* an unnamed icon part reads as its kind's noun, never as its material symbol name */
    expect(itemNameOf(item({ kind: "fab", label: "", icon: "edit" }), "en")).toBe(KIND_TEXT.en["fab"].noun);
    expect(itemNameOf(item({ kind: "iconButton", label: "", icon: "edit" }), "en")).toBe(KIND_TEXT.en["iconButton"].noun);
    expect(itemNameOf(item({ kind: "iconButton", label: "Bag", icon: "edit" }), "en")).toBe("Bag");
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

describe("the navigation bar's fold button", () => {
  it("joins the page's rules when the bar carries one", () => {
    const folded = item({ id: "nav", kind: "bottomNav", barFolded: true, tabs: [{ icon: "swords", label: "Battle" }] });
    const flow = buildFlow(doc(frames, [run("g", frames[0], [folded])]), "en");
    const rule = nodeOf(flow, "home").rules.find((r) => r.kind === "state");
    expect(rule?.description).toContain("<");
    expect(rule?.description).toContain(">");
    /* a bar without the button says nothing about folding */
    const plain = item({ id: "nav2", kind: "bottomNav", tabs: [{ icon: "map", label: "Map" }] });
    expect(buildFlow(doc(frames, [run("g2", frames[0], [plain])]), "en").nodes[0].rules).toEqual([]);
  });
});

describe("the grow rule", () => {
  it("leaves the part a size up once it has been tapped", () => {
    const it2 = item({ id: "b", label: "Charge", states: [{ id: "s", trigger: "tap", effect: "grow" }] });
    const flow = buildFlow(doc(frames, [run("g", frames[0], [it2])]), "en");
    expect(nodeOf(flow, "home").rules[0].description).toContain("Charge");
    /* and nothing changes before the tap */
    expect(stateText({ id: "s", trigger: "tap", effect: "grow" }, "Charge", "zh")).toContain("变大");
  });
});

describe("the rail toggle and dialogs", () => {
  it("writes the rail's collapse button into the node's rules", () => {
    const rail = item({ id: "rail", kind: "navRail", label: "Menu", railExpanded: false, tabs: [{ icon: "map", label: "Map" }] });
    const flow = buildFlow(doc(frames, [run("g", frames[0], [rail])]), "en");
    const rule = nodeOf(flow, "home").rules.find((r) => r.kind === "state");
    expect(rule?.description).toContain("Menu");
    expect(rule?.description).toContain("V");
    for (const lang of ["ja", "zh", "ko"] as const) {
      expect(buildFlow(doc(frames, [run("g", frames[0], [rail])]), lang).nodes[0].rules.some((r) => r.kind === "state")).toBe(true);
    }
  });

  it("draws a dialog as an edge of its own, worded as a popup", () => {
    const button = item({ id: "b", label: "Shop", action: { to: "popup", transition: "expand", dialog: true } });
    const flow = buildFlow(doc(frames, [run("g", frames[0], [button])]), "en");
    expect(flow.edges).toHaveLength(1);
    expect(flow.edges[0]).toMatchObject({ from: "home", to: "popup" });
    expect(flow.edges[0].label).toContain("dialog");
    expect(flow.edges[0].description).toBe("Tapping \"Shop\" on Home opens the Dialog dialog.");
    expect(nodeOf(flow, "popup").kind).toBe("popup");
    expect(buildFlow(doc(frames, [run("g", frames[0], [button])]), "zh").edges[0].description).toContain("弹框");
  });
});

describe("an in-page dialog", () => {
  it("is a popup node of its own, with an edge from the page that pops it", () => {
    const button = item({ id: "b", label: "Shop", action: { to: "dlg", transition: "expand", dialog: true } });
    const panel: Item = { ...item({ id: "dlg", kind: "box", label: "弹框", modal: true }) };
    const flow = buildFlow(doc(frames, [run("g", frames[0], [button]), run("d", frames[0], [panel])]), "en");
    const node = flow.nodes.find((n) => n.id === "dlg");
    expect(node).toMatchObject({ kind: "popup", label: "弹框" });
    const edge = flow.edges.find((e) => e.to === "dlg");
    expect(edge).toMatchObject({ from: "home" });
    expect(edge?.description).toContain("弹框");
    /* the page the dialog lives on still reads as a screen */
    expect(flow.nodes.find((n) => n.id === "home")?.kind).toBe("screen");
    expect(flowMarkdown(flow, "en")).toContain("弹框");
  });
});

describe("overlay pages in the flow", () => {
  /* an overlay page is opened *over* a screen, so it reads as a popup of its own level and
     the edge into it is a pop-over rather than a jump — even though it is a frame like any
     other, which is what lets one bag page serve every screen that opens it */
  const bag: Frame = { ...frame("bag", "Bag", 500), role: "overlay", level: "modal" };
  const login: Frame = { ...frame("login", "Login", 1000), role: "overlay", level: "system" };
  const withOverlays = doc(
    [frames[0], frames[1], bag, login],
    [
      run("g1", frames[0], [
        item({ id: "a", label: "Bag", action: { to: "bag", transition: "expand" } }),
        item({ id: "b", label: "Sign in", action: { to: "login", transition: "fade" } }),
      ]),
      run("g2", frames[1], [item({ id: "c", label: "Bag", action: { to: "bag", transition: "expand" } })]),
    ],
  );

  it("makes an overlay a popup node naming its level", () => {
    const flow = buildFlow(withOverlays, "en");
    expect(nodeOf(flow, "bag").kind).toBe("popup");
    expect(nodeOf(flow, "bag").overlay).toBe("modal");
    expect(nodeOf(flow, "bag").description).toContain("Dialog");
    expect(nodeOf(flow, "login").overlay).toBe("system");
    expect(nodeOf(flow, "login").description).toContain("System");
    /* a plain screen carries no level at all */
    expect(nodeOf(flow, "home").overlay).toBeUndefined();
  });

  it("starts the graph at the first screen even when an overlay is listed first", () => {
    const reordered = doc(
      [bag, frames[0], frames[1], login],
      [run("g1", frames[0], [item({ id: "a", label: "Bag", action: { to: "bag", transition: "expand" } })])],
    );
    const flow = buildFlow(reordered, "en");
    expect(nodeOf(flow, "home").kind).toBe("screen");
    expect(nodeOf(flow, "bag").kind).toBe("popup");
    /* depth counts from the screen, so the bag is one step away from it */
    expect(nodeOf(flow, "bag").depth).toBe(1);
  });

  it("reads the edge into an overlay as a pop-up, once per page that opens it", () => {
    const flow = buildFlow(withOverlays, "en");
    const intoBag = flow.edges.find((e) => e.from === "home" && e.to === "bag")!;
    expect(intoBag.description).toContain(FLOW_TEXT.en.dialogLine("Home", "Bag", "Bag"));
    /* the same bag page is reachable from two screens: one node, two edges */
    expect(flow.edges.filter((e) => e.to === "bag")).toHaveLength(2);
    expect(flow.edges.find((e) => e.from === "details" && e.to === "bag")?.triggers).toHaveLength(1);
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

describe("a step that only acts", () => {
  /* The plus button of a stepper pair has nothing to become: its step keeps the part where it is,
     so the flow reads it as an action rather than as a move between looks. */
  it("reads as an action on the screen, not as a look it lands in", () => {
    const doc: Doc = {
      title: "T", brief: "", paletteKey: "purple", frame: "phone", platform: "android",
      frames: [{ id: "f", name: "Home", x: 0, y: 0 }],
      groups: [{ id: "g", x: 0, y: 100, axis: "y", items: [
        { ...makeItem("slider"), id: "sld", label: "音量", value: 40 },
        { ...makeItem("button"), id: "plus", label: "＋", flow: { looks: [], steps: [{ id: "s1", from: START_LOOK, trigger: { kind: "tap" as const }, do: [{ kind: "look" as const, target: "sld", value: 1, valueOp: "add" as const }] }] } },
      ] }],
    };
    const flow = buildFlow(doc, "en");
    const rules = flow.nodes.flatMap((n) => n.rules ?? []).filter((r) => r.kind === "state");
    expect(rules).toHaveLength(1);
    expect(rules[0].description).toContain("keeps the look it is in");
    expect(rules[0].description).toContain("goes up by 1");
  });
});
