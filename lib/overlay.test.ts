import { describe, expect, it } from "vitest";

import {
  DEFAULT_OVERLAY_LEVEL,
  OVERLAY_LEVELS,
  OVERLAY_LEVEL_ICONS,
  OVERLAY_RULES,
  backTarget,
  isOverlayFrame,
  isOverlayItem,
  isOverlayLevel,
  makeItem,
  overlayLevelOf,
  overlayLevelOfFrame,
  overlayRuleOf,
  popLayer,
  pushLayer,
  forgetScreens,
  layersIn,
  withLayers,
  type Frame,
  type Layer,
  type LayerTrail,
} from "./tokens";

/* The overlay model is the one place the runtime cannot guess from the layer tree: a level
 * bundles the rules a tap and the back key follow, and the stack remembers the time order.
 * These tests pin both, because a regression here is invisible until a dialog is up. */

const frame = (id: string, patch: Partial<Frame> = {}): Frame => ({ id, name: id, x: 0, y: 0, ...patch });
const layer = (frameId: string, level: Layer["level"] = "modal"): Layer => ({ frameId, level, t: "fade" });

describe("overlay levels", () => {
  it("lists every level lightest first, each with an icon", () => {
    expect(OVERLAY_LEVELS).toEqual(["popover", "sheet", "modal", "fullscreen", "system"]);
    for (const level of OVERLAY_LEVELS) {
      expect(OVERLAY_RULES[level]).toBeDefined();
      expect(OVERLAY_LEVEL_ICONS[level]).toBeTruthy();
      expect(isOverlayLevel(level)).toBe(true);
    }
    expect(isOverlayLevel("dialog")).toBe(false);
    expect(overlayRuleOf(DEFAULT_OVERLAY_LEVEL)).toBe(OVERLAY_RULES.modal);
  });

  it("keeps a popover out of the way and a system layer impossible to wave off", () => {
    /* only the popover leaves the screen behind alive and closes on a tap beside it */
    expect(OVERLAY_RULES.popover).toMatchObject({ scrim: 0, inertBehind: false, dismissOnOutside: true, clears: "none" });
    for (const level of ["sheet", "modal", "fullscreen", "system"] as const) {
      expect(OVERLAY_RULES[level].inertBehind).toBe(true);
      expect(OVERLAY_RULES[level].dismissOnOutside).toBe(false);
    }
    /* system is the one level the back key cannot close */
    expect(OVERLAY_RULES.system.dismissOnBack).toBe(false);
    expect(OVERLAY_LEVELS.filter((l) => !OVERLAY_RULES[l].dismissOnBack)).toEqual(["system"]);
  });

  it("floats the three levels that sit over a screen, and takes the screen with the other two", () => {
    /* a floating layer draws only its parts: its page is the dialog's stage, not a second screen.
       The two that fill the screen are the screen, so they paint their own background. */
    expect(OVERLAY_LEVELS.filter((l) => OVERLAY_RULES[l].float)).toEqual(["popover", "sheet", "modal"]);
    expect(OVERLAY_RULES.fullscreen.float).toBe(false);
    expect(OVERLAY_RULES.system.float).toBe(false);
  });

  it("dims more for a dialog than for a panel, and not at all for a full screen layer", () => {
    expect(OVERLAY_RULES.sheet.scrim).toBeLessThan(OVERLAY_RULES.modal.scrim);
    expect(OVERLAY_RULES.popover.scrim).toBe(0);
    expect(OVERLAY_RULES.fullscreen.scrim).toBe(0);
  });

  it("reads an item's level, falling back to the pre-level `modal` spelling", () => {
    const legacy = { ...makeItem("dialog"), modal: true };
    expect(overlayLevelOf(legacy)).toBe("modal");
    expect(isOverlayItem(legacy)).toBe(true);
    expect(overlayLevelOf({ ...makeItem("dialog"), overlay: "sheet" })).toBe("sheet");
    /* an explicit level wins over the legacy flag: a document opened and re-saved keeps the
       author's newer choice */
    expect(overlayLevelOf({ ...legacy, overlay: "system" })).toBe("system");
    expect(overlayLevelOf(makeItem("button"))).toBeNull();
    expect(isOverlayItem(makeItem("button"))).toBe(false);
  });

  it("reads a page's role, treating every unmarked page as a screen", () => {
    expect(isOverlayFrame(frame("home"))).toBe(false);
    expect(isOverlayFrame(frame("bag", { role: "overlay" }))).toBe(true);
    expect(overlayLevelOfFrame(frame("bag", { role: "overlay" }))).toBe("modal");
    expect(overlayLevelOfFrame(frame("bag", { role: "overlay", level: "fullscreen" }))).toBe("fullscreen");
    /* a level on a plain screen is inert: only overlays read it */
    expect(isOverlayFrame(frame("home", { level: "system" }))).toBe(false);
  });
});

describe("the overlay stack", () => {
  it("opens one layer at a time and closes the last one first", () => {
    const one = pushLayer([], layer("dialogs"));
    expect(one.map((l) => l.frameId)).toEqual(["dialogs"]);
    const two = pushLayer(one, layer("details"));
    expect(two.map((l) => l.frameId)).toEqual(["dialogs", "details"]);
    /* the back key closes the newest, not the oldest */
    expect(popLayer(two).map((l) => l.frameId)).toEqual(["dialogs"]);
    expect(popLayer(one)).toEqual([]);
    expect(popLayer([])).toEqual([]);
  });

  it("brings an overlay that is already open to the front instead of opening twice", () => {
    const open = pushLayer(pushLayer([], layer("bag")), layer("details"));
    const again = pushLayer(open, layer("bag"));
    expect(again.map((l) => l.frameId)).toEqual(["details", "bag"]);
    expect(again).toHaveLength(2);
  });

  it("drops a popover when a dialog opens over it, but keeps the dialogs under it", () => {
    const open = pushLayer(pushLayer(pushLayer([], layer("bag")), layer("bubble", "popover")), layer("confirm"));
    expect(open.map((l) => l.frameId)).toEqual(["bag", "confirm"]);
    /* a dialog can open over another dialog: the visitor goes bag → item → confirm, and the
       back key walks that path back one step at a time */
    const bag = pushLayer([], layer("bag"));
    expect(pushLayer(bag, layer("bubble", "popover")).map((l) => l.frameId)).toEqual(["bag", "bubble"]);
  });

  it("clears the stack for a full screen or a system layer", () => {
    const deep = pushLayer(pushLayer([], layer("bag")), layer("details"));
    expect(pushLayer(deep, layer("activity", "fullscreen")).map((l) => l.frameId)).toEqual(["activity"]);
    /* a system layer ends whatever was in the middle, and keeps a system layer already up so
       two of them queue instead of cancelling each other */
    expect(pushLayer(deep, layer("login", "system")).map((l) => l.frameId)).toEqual(["login"]);
    expect(pushLayer(pushLayer([], layer("login", "system")), layer("network", "system")).map((l) => l.frameId)).toEqual(["login", "network"]);
    /* a popover on top of a system layer survives a popover, but not a dialog */
    const sys = pushLayer([], layer("login", "system"));
    expect(pushLayer(sys, layer("hint", "popover")).map((l) => l.frameId)).toEqual(["login", "hint"]);
    expect(pushLayer(sys, layer("hint", "popover"))[0].level).toBe("system");
  });

  it("refuses the back key for a system layer, and lets everything else through", () => {
    expect(backTarget([])).toBe("screen");
    expect(backTarget([layer("bag")])).toBe("layer");
    expect(backTarget([layer("login", "system")])).toBe("blocked");
    /* the top layer decides: a dialog under a system layer does not make the back key work */
    expect(backTarget([layer("bag"), layer("login", "system")])).toBe("blocked");
  });

  it("still closes a system layer when it is asked to outright", () => {
    /* the level refuses a gesture, not its own contents: a layer nobody can put away is a dead
       end, so the close the author puts inside one has to work */
    expect(popLayer([layer("login", "system")]).map((l) => l.frameId)).toEqual([]);
    expect(popLayer([layer("bag"), layer("login", "system")]).map((l) => l.frameId)).toEqual(["bag"]);
    expect(popLayer([])).toEqual([]);
  });
});

/* The trail is what makes a dialog feel like part of the screen it was popped from: the visitor
 * steps to another screen and back, and the dialog that was open is still open. */
describe("the overlays a screen leaves behind", () => {
  const bag = layer("bag", "modal");
  const tip = layer("tip", "popover");

  it("remembers what each screen has open, apart from the others", () => {
    let trail: LayerTrail = {};
    trail = withLayers(trail, "home", [bag]);
    trail = withLayers(trail, "shop", [tip]);
    expect(layersIn(trail, "home")).toEqual([bag]);
    expect(layersIn(trail, "shop")).toEqual([tip]);
    /* a screen the visitor never opened anything from has nothing open */
    expect(layersIn(trail, "quests")).toEqual([]);
    /* putting one screen's dialog away leaves the other screen's alone */
    trail = withLayers(trail, "home", []);
    expect(layersIn(trail, "home")).toEqual([]);
    expect(layersIn(trail, "shop")).toEqual([tip]);
  });

  it("hands back the same trail when a screen's list did not change, so a render cannot loop", () => {
    const trail: LayerTrail = { home: [bag] };
    expect(withLayers(trail, "home", trail.home)).toBe(trail);
    expect(withLayers(trail, "home", [bag])).not.toBe(trail);
  });

  it("forgets only the screens the document no longer holds", () => {
    const map = { home: [bag], shop: [tip] };
    expect(forgetScreens(map, new Set(["home", "shop"]))).toBe(map);
    expect(forgetScreens(map, new Set(["home"]))).toEqual({ home: [bag] });
    /* it serves the in-page overlay map as well, which holds an item id or null per screen */
    expect(forgetScreens({ a: "dlg", b: null }, new Set(["b"]))).toEqual({ b: null });
  });
});
