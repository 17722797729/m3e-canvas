import { describe, expect, it, vi } from "vitest";
import { isProject, projectFileName, readableGroups, readProject } from "./project";
import { updateRail } from "./rail";
import { KIND_ORDER, VARIANTS, railExpansionSide, type Doc, type Item } from "./tokens";

const item = (): Item => ({ id: "item", kind: "button", label: "Save", icon: null, variant: "filled" });
const doc = (): Doc => ({
  title: "Sketch", brief: "A small app", paletteKey: "purple", frame: "phone",
  groups: [{ id: "group", x: -12.5, y: 0, axis: "x", items: [item()] }],
  frames: [{ id: "frame", name: "Home", x: 0, y: -10 }],
});
const withItem = (patch: Record<string, unknown>) => {
  const value = doc();
  return { ...value, groups: [{ ...value.groups[0], items: [{ ...item(), ...patch }] }] };
};

describe("isProject", () => {
  it("accepts a current document without changing it", () => {
    const value = doc();
    const before = structuredClone(value);
    expect(isProject(value)).toBe(true);
    expect(value).toEqual(before);
  });

  it("accepts legacy minimal documents without supplying defaults", () => {
    const legacy = { groups: [], frames: [{ id: "f", name: "Home", x: 0, y: 0 }] };
    expect(isProject(legacy)).toBe(true);
    expect(legacy).not.toHaveProperty("platform");
    expect(legacy.frames[0]).not.toHaveProperty("w");
  });

  it.each([undefined, "android", "web"])("accepts platform %s", (platform) => {
    expect(isProject({ ...doc(), platform })).toBe(true);
  });

  it.each([null, "ios", "", 0, {}, true])("rejects platform %j", (platform) => {
    expect(isProject({ ...doc(), platform })).toBe(false);
  });

  it.each([null, undefined, true, 42, "{}", [], {}, { groups: [] }, { frames: [] },
    { groups: null, frames: [] }, { groups: {}, frames: [] }, { groups: [], frames: {} },
  ].map((value) => [value]))("rejects invalid document shape %# %o", (value) => {
    expect(isProject(value)).toBe(false);
  });

  it.each(KIND_ORDER)("accepts registered kind %s", (kind) => {
    expect(isProject(withItem({ kind }))).toBe(true);
  });

  it.each(VARIANTS)("accepts registered variant $key", ({ key }) => {
    expect(isProject(withItem({ variant: key }))).toBe(true);
  });

  it.each([true, false])("accepts a group lock set to %s", (locked) => {
    const value = doc();
    expect(isProject({ ...value, groups: [{ ...value.groups[0], locked }] })).toBe(true);
  });

  it.each([
    { id: 1 }, { x: NaN }, { x: Infinity }, { x: "0" }, { y: -Infinity }, { y: null },
    { axis: "z" }, { axis: undefined }, { items: [] }, { items: null }, { items: {} }, { items: [null] },
    { locked: "yes" }, { locked: 1 }, { locked: null },
  ])("rejects invalid group fields %# %o", (patch) => {
    const value = doc();
    expect(isProject({ ...value, groups: [{ ...value.groups[0], ...patch }] })).toBe(false);
  });

  it("checks every group, frame and item, not only the first", () => {
    const value = doc();
    expect(isProject({ ...value, groups: [...value.groups, null] })).toBe(false);
    expect(isProject({ ...value, frames: [...value.frames, null] })).toBe(false);
    expect(isProject({ ...value, groups: [{ ...value.groups[0], items: [item(), null] }] })).toBe(false);
  });

  it("accepts vertical groups and optional item fields including empty strings", () => {
    const value = withItem({ icon: "save", supporting: "", note: "", selected: 0,
      corners: { tl: 0, tr: 4, bl: 8, br: 12 },
      tabs: [{ label: "One", icon: "home" }, { label: "Two", icon: null }, { label: "" }],
    });
    value.groups[0].axis = "y";
    expect(isProject(value)).toBe(true);
    expect(isProject(withItem({ tabs: [] }))).toBe(true);
  });

  it("accepts card layout customization fields", () => {
    expect(isProject(withItem({
      kind: "card",
      imagePos: "trailing",
      imageSize: 96,
      contentAlign: "center",
      textColor: "primary",
    }))).toBe(true);
  });

  it.each([
    { id: undefined }, { id: 1 }, { kind: "unknown" }, { kind: null }, { label: 1 },
    { icon: undefined }, { icon: 1 }, { variant: "unknown" }, { variant: undefined },
    { supporting: null }, { note: 1 }, { selected: NaN }, { selected: Infinity }, { selected: "0" },
    { corners: null }, { corners: {} }, { corners: { tl: 0, tr: 0, bl: 0 } },
    { corners: { tl: "0", tr: 0, bl: 0, br: 0 } }, { corners: { tl: 0, tr: 0, bl: 0, br: Infinity } },
    { tabs: null }, { tabs: {} }, { tabs: [null] }, { tabs: [{ icon: "home" }] },
    { tabs: [{ label: 1 }] }, { tabs: [{ label: "Home", icon: 1 }] },
    { imagePos: "bottom" }, { imageSize: 0 }, { imageSize: NaN }, { contentAlign: "top" }, { textColor: "pink" },
  ])("rejects invalid item fields %# %o", (patch) => {
    expect(isProject(withItem(patch))).toBe(false);
  });

  it.each([
    { id: null }, { name: 1 }, { x: Infinity }, { x: "0" }, { y: NaN },
    { w: 0 }, { w: -1 }, { w: Infinity }, { w: "100" }, { w: null },
    { h: 0 }, { h: -1 }, { h: NaN }, { h: "100" }, { h: null }, { note: false },
  ])("rejects invalid frame fields %# %o", (patch) => {
    const value = doc();
    expect(isProject({ ...value, frames: [{ ...value.frames[0], ...patch }] })).toBe(false);
  });

  it.each(["top", "center", "bottom", "spread"])("accepts the body placement %s", (place) => {
    const value = doc();
    expect(isProject({ ...value, frames: [{ ...value.frames[0], place }] })).toBe(true);
  });

  it.each(["middle", "", 0, null])("rejects an unknown body placement %j", (place) => {
    const value = doc();
    expect(isProject({ ...value, frames: [{ ...value.frames[0], place }] })).toBe(false);
  });

  it("accepts positive fractional frame dimensions and an empty note", () => {
    const value = doc();
    expect(isProject({ ...value, frames: [{ ...value.frames[0], w: 0.5, h: 800, note: "" }] })).toBe(true);
  });
});

describe("projectFileName", () => {
  it.each([
    ["", "m3e-canvas.json"], [" \t\n ", "m3e-canvas.json"],
    ['\\/:*?"<>|', "m3e-canvas.json"],
    ["  My\t app\n name  ", "m3e-canvas My app name.json"],
    ['a\\b/c:d*e?f"g<h>i|j', "m3e-canvas a b c d e f g h i j.json"],
    ["設計 한국어 🎨.v2", "m3e-canvas 設計 한국어 🎨.v2.json"],
  ])("sanitizes %j to %j", (title, expected) => {
    expect(projectFileName({ ...doc(), title })).toBe(expected);
  });
});

describe("readProject", () => {
  it.each(["left", "right"])("does not persist the runtime %s expansion edge", async (side) => {
    const authored: Item = { ...item(), kind: "navRail", railExpanded: false, railModal: true, size2: 800,
      selected: 1, tabs: [{ icon: "home", label: "Home" }, { icon: "star", label: "Saved" }], note: "Keep my destinations",
    };
    const original = doc();
    original.frames = [{ ...original.frames[0], w: 1280, h: 800 }];
    original.groups = [{ ...original.groups[0], x: side === "left" ? 0 : 1184, y: -10, items: [authored] }];
    const project = { ...original, groups: updateRail(original.groups, original.frames, {}, authored.id, { railExpanded: true }) };
    const expanded = project.groups[0].items[0];
    expect(expanded[railExpansionSide]).toBe(side);
    expect(Reflect.ownKeys(expanded)).toContain(railExpansionSide);
    const json = JSON.stringify(project);
    const saved = await readProject(new File([json], "rail.json"));
    const expectedItem = { ...authored, railExpanded: true };
    expect(saved).not.toBeNull();
    expect(Reflect.ownKeys(saved!.groups[0].items[0])).toEqual(Reflect.ownKeys(expectedItem));
    expect(saved).toEqual({ ...original, groups: [{ ...original.groups[0], x: side === "left" ? 0 : 1060, items: [expectedItem] }] });
  });

  it.each([undefined, false, true])("accepts optional navigation rail booleans %s without changing them", (value) => {
    const project = withItem({ kind: "navRail", railExpanded: value, railModal: value });
    const before = structuredClone(project);
    expect(isProject(project)).toBe(true);
    expect(project).toEqual(before);
  });

  it.each(["railExpanded", "railModal"])("rejects non-boolean navigation rail field %s", (field) => {
    for (const value of [null, 0, 1, "true", "false", {}, []]) {
      expect(isProject(withItem({ kind: "navRail", [field]: value }))).toBe(false);
    }
  });

  it.each([undefined, 2, 4, 8, 16])("preserves progress thickness %s in project files", async (trackThickness) => {
    const value = withItem({ kind: "linearProgress", wavy: true, trackThickness });
    await expect(readProject(new File([JSON.stringify(value)], "progress.json"))).resolves.toEqual(value);
  });

  it.each([0, 1, 17, 4.5, -8, "8", null])("rejects invalid progress thickness %j", async (trackThickness) => {
    const value = withItem({ kind: "circularProgress", trackThickness });
    await expect(readProject(new File([JSON.stringify(value)], "progress.json"))).resolves.toBeNull();
  });

  it("reads a real File as JSON without relying on its name or MIME type", async () => {
    const value = doc();
    await expect(readProject(new File([JSON.stringify(value)], "sketch.txt", { type: "text/plain" }))).resolves.toEqual(value);
  });

  it("preserves a legacy file and unknown fields for the editor's migration step", async () => {
    const legacy = { groups: [], frames: [], futureField: { keep: true } };
    await expect(readProject(new File([JSON.stringify(legacy)], "old.json"))).resolves.toEqual(legacy);
  });

  it.each(["", "{", "null", "[]", '{"groups":[],"frames":{}}'])("returns null for invalid file contents %j", async (text) => {
    await expect(readProject(new File([text], "bad.json"))).resolves.toBeNull();
  });

  it("returns null for valid JSON with an invalid nested item", async () => {
    await expect(readProject(new File([JSON.stringify(withItem({ kind: "unknown" }))], "bad.json"))).resolves.toBeNull();
  });

  it("returns null when reading the File fails", async () => {
    const file = new File([], "unreadable.json");
    const read = vi.spyOn(file, "text").mockRejectedValue(new Error("Read failed"));
    try {
      await expect(readProject(file)).resolves.toBeNull();
    } finally {
      read.mockRestore();
    }
  });
});

/* a part can carry a colour, a level, its own state rules and the parts it holds */
describe("isProject: a part's own looks, level, rules and children", () => {
  it.each([
    { color: "primary" }, { color: "#1A2B3C" }, { z: 0 }, { z: 42 },
    { states: [{ id: "s", trigger: "tap", effect: "disable" }] },
    { states: [{ id: "s", trigger: "tap", effect: "cooldown", seconds: 5 }] },
    { states: [{ id: "s", trigger: "tap", effect: "label", value: "Wait" }] },
    { states: [] },
    { children: [{ ...item(), id: "kid", x: 4, y: 8 }] },
    { children: [{ ...item(), id: "kid", x: 4, y: 8, children: [{ ...item(), id: "deep", x: 1, y: 1 }] }] },
  ])("accepts %# %o", (patch) => {
    expect(isProject(withItem(patch))).toBe(true);
  });

  it.each([
    { color: "chartreuse" }, { color: "#12345" }, { color: 7 },
    { z: NaN }, { z: "10" },
    { states: null }, { states: {} }, { states: [null] }, { states: [{ id: "s", trigger: "tap" }] },
    { states: [{ id: "s", trigger: "longPress", effect: "disable" }] },
    { states: [{ id: "s", trigger: "tap", effect: "explode" }] },
    { states: [{ id: "s", trigger: "tap", effect: "cooldown", seconds: 0 }] },
    { states: [{ id: "s", trigger: "tap", effect: "label", value: 1 }] },
    { children: {} }, { children: [null] }, { children: [{ ...item(), id: "kid", x: 1 }] },
    { children: [{ ...item(), id: "kid", x: NaN, y: 0 }] },
    { children: [{ ...item(), id: "kid", x: 0, y: 0, kind: "chart" }] },
  ])("rejects %# %o", (patch) => {
    expect(isProject(withItem(patch))).toBe(false);
  });

  it("keeps a container and its children when a file is read back", async () => {
    const value = withItem({ kind: "box", children: [{ ...item(), id: "kid", label: "Go", x: 12, y: 20 }] });
    await expect(readProject(new File([JSON.stringify(value)], "nested.json"))).resolves.toEqual(value);
  });
});
/* the autosave is the one document that does not pass isProject; a part this build cannot
 * draw is left out rather than allowed to reach the layout as an unknown kind */
describe("readableGroups", () => {
  it("keeps a readable document exactly as it is", () => {
    const value = doc();
    const out = readableGroups(value.groups);
    expect(out).toEqual(value.groups);
    expect(out[0]).toBe(value.groups[0]);
    expect(out[0].items[0]).toBe(value.groups[0].items[0]);
  });

  it("leaves out an unknown part and keeps the order of the parts that survive", () => {
    const good = doc().groups[0];
    const out = readableGroups([{ ...good, items: [item(), { ...item(), id: "chart", kind: "chart" }, { ...item(), id: "last" }] }]);
    expect(out).toHaveLength(1);
    expect(out[0].items.map((it) => it.id)).toEqual(["item", "last"]);
  });

  it("drops a run that held nothing but unreadable parts", () => {
    const good = doc().groups[0];
    expect(readableGroups([{ ...good, items: [{ id: "chart", kind: "chart" }] }])).toEqual([]);
  });

  it("drops malformed groups and parts without touching the rest of the document", () => {
    const good = doc().groups[0];
    const out = readableGroups([
      null,
      { id: "no-items" },
      { ...good, items: null },
      good,
      { ...good, items: [null, { ...item(), label: 1 }, item()] },
    ]);
    expect(out.map((g) => g.id)).toEqual(["group", "group"]);
    expect(out[0].items).toHaveLength(1);
  });

  it.each([null, undefined, {}, { items: [item()] }, "groups", 7])("reads %# as no groups", (groups) => {
    expect(readableGroups(groups)).toEqual([]);
  });
});
