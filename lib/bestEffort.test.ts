import { describe, expect, it } from "vitest";
import { readDoc, readItem, readProject, readableGroups } from "./project";
import { tryDesign } from "./ai";
import { readShareHash, shareLink } from "./share";
import { KIND_SPEC, ROT_MAX, SIDE_RAIL_MIN, makeItem, type Doc, type Item } from "./tokens";

/* Reading a stored document is best effort, everywhere: repair what can be repaired, drop the part
 * when nothing can draw it, and never lose the canvas over one value. */

const item = (patch: Record<string, unknown> = {}): Item =>
  ({ id: "good", kind: "button", label: "Save", icon: null, variant: "filled", ...patch }) as Item;
const frame = (id: string, name: string) => ({ id, name, x: 0, y: 0 });
const doc = (items: unknown[]): unknown => ({
  title: "Sketch",
  brief: "A small app",
  paletteKey: "purple",
  frame: "phone",
  groups: [{ id: "group", x: 0, y: 0, axis: "x", items }],
  frames: [frame("home", "Home"), frame("shop", "Shop")],
});

/** the real round trip: what the editor writes out, parsed back off a file */
const saved = async (value: unknown) => readProject(new File([JSON.stringify(value)], "canvas.json"));

describe("a document with a part nothing can draw", () => {
  it("opens, drops that part, and leaves everything else exactly where it was", async () => {
    const value = doc([item(), { ...item({ id: "chart" }), kind: "chart" }, item({ id: "last", label: "Last" })]);
    const read = (await saved(value))!;
    expect(read).not.toBeNull();
    expect(read.groups[0].items.map((it) => it.id)).toEqual(["good", "last"]);
    /* the rest of the document is untouched */
    expect(read.title).toBe("Sketch");
    expect(read.brief).toBe("A small app");
    expect(read.frames).toEqual([frame("home", "Home"), frame("shop", "Shop")]);
    expect((value as { groups: { items: unknown[] }[] }).groups[0].items).toHaveLength(3);
  });

  it("still opens when the only part is the unreadable one — as an empty canvas", async () => {
    const read = (await saved(doc([{ ...item(), kind: "chart" }])))!;
    expect(read).not.toBeNull();
    expect(read.groups).toEqual([]);
    /* the screens stay: their names, sizes and places are the author's */
    expect(read.frames.map((f) => f.name)).toEqual(["Home", "Shop"]);
  });

  it("takes a run with it when the run held nothing else", () => {
    const read = readDoc(doc([{ ...item(), kind: "chart" }]))!;
    expect(read.groups).toEqual([]);
    expect(readableGroups((doc([{ ...item(), kind: "chart" }, item()]) as { groups: unknown[] }).groups)).toHaveLength(1);
  });

  it("keeps a part whose kind is retired, for the editor to migrate", async () => {
    const read = (await saved(doc([{ ...item(), kind: "moneyTree" }])))!;
    expect(read.groups[0].items[0].kind).toBe("moneyTree");
  });
});

describe("a part with a field this build cannot read", () => {
  it("is repaired, not dropped: a missing variant becomes the kind's own", async () => {
    /* the case that broke real imports: a part written without its variant */
    const read = (await saved(doc([{ id: "bare", kind: "button", label: "Save", icon: null }])))!;
    expect(read.groups[0].items).toHaveLength(1);
    expect(read.groups[0].items[0]).toMatchObject({ id: "bare", variant: KIND_SPEC.button.defVariant ?? "filled" });
    /* and the default is the kind's own, not one hard-coded answer: an icon button is tonal */
    const icon = readItem({ id: "i", kind: "iconButton", label: "", icon: "edit" })!;
    expect(icon.variant).toBe(KIND_SPEC.iconButton.defVariant);
    expect(readItem({ ...item(), variant: "fancy" })!.variant).toBe(KIND_SPEC.button.defVariant ?? "filled");
  });

  it("lets an unreadable value go and keeps the part", async () => {
    const odd = [
      item({ id: "unit", timerUnit: "fortnight" }),
      item({ id: "shape", shape: "triangle" }),
      item({ id: "fill", fill: "not-a-colour" }),
      item({ id: "thick", trackThickness: 99 }),
      item({ id: "text", label: 12 }),
    ];
    const read = (await saved(doc(odd)))!;
    expect(read.groups[0].items.map((it) => it.id)).toEqual(["unit", "shape", "fill", "thick", "text"]);
    const [u, s, f, t, x] = read.groups[0].items;
    expect(u).not.toHaveProperty("timerUnit");
    expect(s).not.toHaveProperty("shape");
    expect(f).not.toHaveProperty("fill");
    expect(t).not.toHaveProperty("trackThickness");
    /* a number where words were meant is read as the words it means */
    expect(x.label).toBe("12");
  });

  it("holds a count and a turn inside their own ranges, and repairs what a part is made of", () => {
    const it = readItem({ ...item(), timerValue: 500, rot: 900, sideRail: -4, id: 7, icon: 3, children: "no" })!;
    expect(it.timerValue).toBe(120);
    expect(it.rot).toBe(ROT_MAX);
    expect(it.sideRail).toBe(SIDE_RAIL_MIN);
    expect(typeof it.id).toBe("string");
    expect(it.icon).toBeNull();
    expect(it.children).toBeUndefined();
  });

  it("keeps the readable children of a container and lets the others go", () => {
    const parent = { ...makeItem("box"), id: "p", children: [{ ...item(), x: 0, y: 0 }, { ...item({ id: "bad" }), kind: "chart", x: 4, y: 4 }] };
    const read = readItem(parent)!;
    expect(read.children?.map((child) => child.id)).toEqual(["good"]);
    expect(readItem({ ...makeItem("box"), id: "p", children: [{ ...item(), x: 4, y: 4 }] })!.children?.[0]).toMatchObject({ x: 4, y: 4 });
    /* a child with no offset lands in the corner rather than taking the container down */
    expect(readItem({ ...makeItem("box"), id: "p", children: [{ ...item(), x: "left" }] })!.children?.[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("still refuses a part that is not a part at all", () => {
    expect(readItem(null)).toBeNull();
    expect(readItem("button")).toBeNull();
    expect(readItem({})).toBeNull();
    expect(readItem({ ...item(), kind: 7 })).toBeNull();
    /* a kind this build dropped is dropped too, with what it held */
    expect(readItem({ ...makeItem("box"), kind: "fabMenu" })).toBeNull();
  });
});

describe("the floor a file has to clear", () => {
  it("is the shape of a document: an object whose groups and frames are arrays", () => {
    expect(readDoc(null)).toBeNull();
    expect(readDoc([])).toBeNull();
    expect(readDoc("a document")).toBeNull();
    expect(readDoc(7)).toBeNull();
    expect(readDoc({})).toBeNull();
    expect(readDoc({ groups: [] })).toBeNull();
    expect(readDoc({ frames: [] })).toBeNull();
    expect(readDoc({ groups: {}, frames: [] })).toBeNull();
    expect(readDoc({ groups: [], frames: 7 })).toBeNull();
    /* the skeleton is enough: what is inside it is read best-effort */
    expect(readDoc({ groups: [], frames: [] })).toMatchObject({ groups: [], frames: [], title: "", brief: "" });
  });

  it("keeps the fields a document needs, and the ones another build wrote", () => {
    const read = readDoc({ groups: [], frames: [], futureField: { keep: true }, title: 12 })!;
    expect(read).toMatchObject({ title: "12", paletteKey: "purple", frame: "phone", futureField: { keep: true } });
    expect(readDoc({ groups: [], frames: [], theme: { dark: true } })!.theme).toMatchObject({ dark: true });
    expect(readDoc({ groups: [], frames: [], platform: "ios" })!.platform).toBeUndefined();
  });
});

describe("every reader of a stored document", () => {
  const odd = doc([item(), { ...item({ id: "chart" }), kind: "chart" }]);

  it("goes through the one lenient function", async () => {
    /* the file opener, a share link, the AI's answer and the recovered draft all call readDoc: the
       same JSON has to come back the same way through each of them */
    const direct = readDoc(odd)!;
    const fromFile = (await saved(odd))!;
    const fromLink = (await readShareHash(new URL(await shareLink(odd as Doc, "https://example.test/")).hash))!;
    const fromAi = tryDesign(JSON.stringify(odd))!;
    for (const read of [fromFile, fromLink, fromAi]) expect(read).toEqual(direct);
    expect(direct.groups[0].items.map((it) => it.id)).toEqual(["good"]);
  });

  it("reads the autosave through the same parts", () => {
    const groups = (odd as { groups: unknown[] }).groups;
    expect(readableGroups(groups)).toEqual(readDoc(odd)!.groups);
  });
});
