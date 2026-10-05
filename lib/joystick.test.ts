import { describe, expect, it } from "vitest";
import { isPlacedItem, readDoc } from "./project";
import {
  JOYSTICK_MAX,
  JOYSTICK_SIZE,
  joystickTravel,
  KIND_ORDER,
  KIND_SPEC,
  hasStateRow,
  joystickKnob,
  makeItem,
  maxOf,
  sizeOf,
  type Item,
  type Kind,
} from "./tokens";

const pad = (patch: Partial<Item> = {}) => ({ ...makeItem("joystick"), ...patch }) as Item;

/** A document as storage would hold it, and the part this build reads back out of it. */
const storedDoc = (item: Item) => ({ groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [item] }], frames: [] });
const loadedItem = (item: Item) => readDoc(JSON.parse(JSON.stringify(storedDoc(item))))!.groups[0].items[0] as Item;

/* The kinds whose 状态 row the inspector shows, as the flags stand today. A pad is not one of them:
 * the joystick sets no value, and the row it would live in is gone with the capability. */
const STATE_KINDS: Kind[] = [
  "chip", "listItem", "box", "invGrid", "switch", "checkbox", "radio", "slider", "stepper",
  "loadingIndicator", "linearProgress", "progressBar", "circularProgress", "calendar", "rewardTrack",
];
const VALUE_KINDS: Kind[] = ["slider", "stepper", "linearProgress", "progressBar", "circularProgress", "calendar", "rewardTrack"];

describe("the direction wheel sets no value", () => {
  it("advertises no value, so no surface can offer one", () => {
    expect(KIND_SPEC.joystick.hasValue).toBeFalsy();
    expect(KIND_SPEC.joystick.hasChecked).toBeFalsy();
    expect(pad().value).toBeUndefined();
    expect(pad().max).toBeUndefined();
    expect(hasStateRow({ kind: "joystick" })).toBe(false);
    /* a turn of its own is the stick's geometry, not a range an author fills in */
    expect(JOYSTICK_MAX).toBe(360);
    const turned = joystickKnob(JOYSTICK_MAX / 4, JOYSTICK_SIZE);
    expect(turned.dx).toBe(joystickTravel(JOYSTICK_SIZE));
    expect(turned.dy).toBe(0);
  });

  it("loses the row through the gate itself, not through a check on the kind", () => {
    /* the same part, advertised as having a value, gets the row back — the gate reads the flag, and
       the joystick is simply the kind that no longer sets it */
    expect(hasStateRow({ kind: "joystick" }, { ...KIND_SPEC.joystick, hasValue: true })).toBe(true);
    expect(hasStateRow({ kind: "slider" })).toBe(true);
    expect(hasStateRow({ kind: "text" })).toBe(false);
  });

  it("leaves every other kind's state row exactly where it was", () => {
    /* the whole list, so a later edit cannot quietly strip someone else's control */
    expect(KIND_ORDER.filter((k) => hasStateRow({ kind: k }))).toEqual(STATE_KINDS);
    expect(STATE_KINDS).not.toContain("joystick");
    expect(KIND_ORDER.filter((k) => KIND_SPEC[k].hasValue)).toEqual(VALUE_KINDS);
    expect(VALUE_KINDS).not.toContain("joystick");
  });

  it("keeps the pad's own properties: size, fill and the circle are untouched", () => {
    const it = pad({ fill: "#123456", size: 180 });
    expect(sizeOf(it, {})).toEqual({ w: 180, h: 180 });
    expect(it.fill).toBe("#123456");
    /* with no maximum of its own it reads as any other valueless part: the default, unused here */
    expect(maxOf(it)).toBe(100);
  });
});

describe("a stored direction wheel", () => {
  it("opens a document carrying a value and a maximum, and ignores both", () => {
    /* the two fields stay valid for any kind, so an older file is still one this build opens… */
    expect(isPlacedItem({ ...makeItem("joystick"), value: 270, max: 360 })).toBe(true);
    /* …and the pad drops them on the way in: nobody can set that number any more, so it must not
       leave the stick parked at an angle with no way back */
    const back = loadedItem(pad({ value: 270, max: 360 }));
    expect(back.value).toBeUndefined();
    expect(back.max).toBeUndefined();
    expect(back.kind).toBe("joystick");
    expect(sizeOf(back, {})).toEqual({ w: JOYSTICK_SIZE, h: JOYSTICK_SIZE });
  });

  it("goes on keeping the value of every kind that has one", () => {
    const slider = { ...makeItem("slider"), value: 40, max: 200 } as Item;
    expect(loadedItem(slider)).toMatchObject({ kind: "slider", value: 40, max: 200 });
    /* and the pad's own fields are only ever dropped for the pad */
    expect(loadedItem({ ...slider, max: 200 })).toMatchObject({ max: 200 });
  });
});
