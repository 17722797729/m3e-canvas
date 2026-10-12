import { describe, expect, it } from "vitest";
import {
  actionSlotsOf,
  listSlotKeys,
  makeItem,
  slotHasJob,
  slotLookOwner,
  slotsBesideSelf,
  type Item,
  type PartFlow,
  type RuleAction,
} from "./tokens";

/* 好友列表那种行：整行是一颗按钮（点开详情），两头那两颗图标**各自还可以是按钮**。
 * 从前两颗图标共用整行那一个去处（`item.action`），于是"点删除图标"和"点这一行"是同一件事。
 * 现在每颗图标各有各的 `actions[槽]` / `slotFlows[槽]`，`icon` 是左边那颗、`icon2` 是右边那颗。 */

const goTo = (to: string) => ({ to, transition: "none" as const });
const flowOf = (...do_: RuleAction[]): PartFlow => ({
  looks: [],
  steps: [{ id: "st", from: ":start", to: ":start", trigger: { kind: "tap" }, do: do_ }],
});
const row = (patch: Partial<Item> = {}): Item =>
  ({ ...makeItem("listItem"), id: "row", label: "好友·角色名(128级)", icon: "person", icon2: "delete", ...patch }) as Item;

describe("a list row's two icons", () => {
  it("offers each icon that exists as a target of its own", () => {
    expect(actionSlotsOf(row()).map((s) => [s.key, s.value])).toEqual([
      ["icon", "person"],
      ["icon2", "delete"],
    ]);
    /* 只有左边那颗也行 */
    expect(actionSlotsOf(row({ icon2: undefined })).map((s) => s.key)).toEqual(["icon"]);
    /* 一颗图标都没有就没有可配的目标 */
    expect(actionSlotsOf(row({ icon: "", icon2: undefined }))).toEqual([]);
  });

  it("counts as a button only once the author gives it a job", () => {
    /* 刚画出来的那两颗是装饰：点上去仍旧是整行那一下 */
    expect(listSlotKeys(row())).toEqual([]);
    expect(listSlotKeys(row({ actions: { icon2: goTo("B") } }))).toEqual(["icon2"]);
    expect(listSlotKeys(row({ slotFlows: { icon: flowOf({ kind: "look", hidden: true }) } }))).toEqual(["icon"]);
    /* 一台空机器不算活儿（刚建出来的机器就是这样） */
    expect(listSlotKeys(row({ slotFlows: { icon: flowOf() } }))).toEqual([]);
    expect(slotHasJob(row({ actions: { icon2: goTo("B") } }), "icon")).toBe(false);
    expect(slotHasJob(row({ actions: { icon2: goTo("B") } }), "icon2")).toBe(true);
  });

  it("leaves the trailing side to the switch when the row has one", () => {
    /* 有开关时右边画的是开关，不是图标（见 M3Node 的 listItem） */
    expect(listSlotKeys(row({ switch: true, actions: { icon2: goTo("B") } }))).toEqual([]);
    expect(listSlotKeys(row({ switch: true, actions: { icon: goTo("B") } }))).toEqual(["icon"]);
  });

  it("keeps the row and its icons side by side, and latches an icon's own change onto the row", () => {
    /* 整行自己那一下还在，所以「目标按钮」里空键（整行）要和两颗图标并列 */
    expect(slotsBesideSelf(row())).toBe(true);
    /* 给右边那颗配「隐藏」，说的是把这一行收起来 —— 那两颗图标不是画布上独立的部件 */
    expect(slotLookOwner(row())).toBe("row");
  });

  it("leaves the other shapes exactly as they were", () => {
    /* 栏上每一格照旧没有归属：那一格自己的隐藏说的是那一格（见 Preview 的 tabLook） */
    expect(slotsBesideSelf({ kind: "bottomNav" })).toBe(false);
    expect(slotLookOwner({ id: "nav", kind: "bottomNav" })).toBeNull();
    expect(actionSlotsOf(row({ kind: "button" }))).toEqual([]);
    /* 融合部件照旧：它自己那一下和里面的按钮并列，变化的落点也是它自己 */
    expect(slotsBesideSelf({ kind: "taskBar" })).toBe(true);
    expect(slotLookOwner({ id: "tb", kind: "taskBar" })).toBe("tb");
  });
});
