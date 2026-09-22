import { describe, it, expect } from "vitest";

import { GAME_NAV_TABS, NAV_TABS, adoptDoc, isLang, LANGS, t, translateDefaultText, translateDoc } from "./i18n";
import type { Frame, Group, Item, PlacedItem } from "./tokens";

describe("isLang", () => {
  it("accepts every language the UI offers", () => {
    for (const { key } of LANGS) expect(isLang(key)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLang("fr")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});

/** a part as it is stored: only what the test's question needs, the rest left at its defaults */
const part = (kind: Item["kind"], label: string, rest: Partial<Item> = {}): Item => ({
  id: `${kind}-${label}`,
  kind,
  label,
  icon: null,
  variant: "filled",
  ...rest,
});

const group = (items: Item[]): Group => ({ id: "g1", x: 0, y: 0, axis: "x", items });
const frame = (name: string): Frame => ({ id: "f1", name, x: 0, y: 0 });

describe("translating a document's default words", () => {
  it("carries a part's own default label into the language being worked in", () => {
    const out = translateDoc({ groups: [group([part("button", "Favorite")])], frames: [] }, "zh");
    expect(out.groups[0].items[0].label).toBe("收藏");
  });

  it("leaves a name the author typed exactly as it was written", () => {
    const out = translateDoc({ groups: [group([part("button", "My own button")])], frames: [] }, "zh");
    expect(out.groups[0].items[0].label).toBe("My own button");
  });

  /* a bar's destinations are the words the author reads in the layers list and, on a wide rail,
   * on the canvas: a document drawn in another language has to read in this one */
  it("carries a bar's destinations over, the game set a rail draws from", () => {
    const rail = part("navRail", "Navigation rail", { tabs: GAME_NAV_TABS.en.slice(0, 2).map((tab) => ({ ...tab })) });
    const out = translateDoc({ groups: [group([rail])], frames: [] }, "zh");
    expect(out.groups[0].items[0].tabs?.map((tab) => tab.label)).toEqual(GAME_NAV_TABS.zh.slice(0, 2).map((tab) => tab.label));
  });

  it("carries over the plain navigation's words standing on a game part, as an older file has them", () => {
    /* the app's first rails drew their words from NAV_TABS: those defaults belong to this one too */
    const legacy = part("navRail", "Navigation rail", { tabs: NAV_TABS.en.map((tab) => ({ ...tab })) });
    const out = translateDoc({ groups: [group([legacy])], frames: [] }, "zh");
    expect(out.groups[0].items[0].tabs?.map((tab) => tab.label)).toEqual(NAV_TABS.zh.map((tab) => tab.label));
    expect(translateDefaultText("Settings", "navRail", "tab", "ja")).toBe("設定");
  });

  it("reaches a part inside a container, and the screen's own name", () => {
    const inner = { ...part("button", "Share"), x: 4, y: 4 } as PlacedItem;
    const box = part("box", "Container", { children: [inner] });
    const out = translateDoc({ groups: [group([box])], frames: [frame("Home")] }, "zh");
    expect((out.groups[0].items[0].children?.[0] as PlacedItem).label).toBe("分享");
    expect(out.frames[0].name).toBe(t("home", "zh"));
  });

  it("drops the lock the Layers panel used to offer, so a file that carries one is not frozen", () => {
    const out = adoptDoc({ groups: [{ ...group([part("button", "Share")]), locked: true }], frames: [] }, "zh");
    expect(out.groups[0].locked).toBeUndefined();
    /* and a document that never had one is handed back as it was */
    expect(adoptDoc({ groups: [group([part("button", "Share")])], frames: [] }, "zh").groups[0].locked).toBeUndefined();
  });

  it("keeps everything else about the document, and the document it was given", () => {
    const rail = part("navRail", "Navigation rail", { tabs: [{ icon: "swords", label: "Battle" }], selected: 0 });
    const doc = { groups: [{ ...group([rail]), locked: true, name: "run" }], frames: [frame("my screen")] };
    const out = translateDoc(doc, "zh");
    expect(out.groups[0].locked).toBe(true);
    expect(out.groups[0].name).toBe("run");
    expect(out.groups[0].items[0].tabs?.[0].icon).toBe("swords");
    expect(out.groups[0].items[0].selected).toBe(0);
    expect(out.frames[0].name).toBe("my screen");
    /* the copy is a new document: the one in the undo history must not be rewritten under it */
    expect(doc.groups[0].items[0].tabs?.[0].label).toBe("Battle");
  });
});
