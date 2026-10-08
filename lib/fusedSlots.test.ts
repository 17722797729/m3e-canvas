import { describe, expect, it } from "vitest";
import { readDoc, readItem } from "./project";
import {
  TASK_BAR_LOCK_ICON,
  disablesWholePart,
  hasTimedSteps,
  makeItem,
  mergeSlotStates,
  resolveSlotStates,
  resolveStates,
  slotLookOwner,
  tapLivesInside,
  type Item,
} from "./tokens";

/* 融合部件里那几颗按钮的两条规矩 —— 都不是哪一个部件专属，所以它们留在这里，跟着 tokens 走：
 *
 * 1) 一个槽位（栏的某一格、或融合部件里的一颗按钮）的机位是 `<部件id>:<槽位>`，而部件自己的外观只解
 *    `<部件id>`。融合部件里那些按钮不是画布上独立的部件，它们的"自己"就是这一块 —— 所以槽位那几台机器
 *    的状态必须并进来，不然机器跑了、屏幕上什么都没变（确认框那一次作者报的「配了隐藏面板却不生效」
 *    就是这件事，见 docs/reference-prototypes/confirm-box.md）。
 * 2) 栏的每一格**不并**：那是一个落点，它的 hidden/disabled 说的是那一格。
 */
describe("a fused part's slot machines", () => {
  const step = (extra: Record<string, unknown> = {}) => ({
    looks: [{ id: "s1", ...extra }],
    steps: [{ id: "st", from: ":start", to: "s1", trigger: { kind: "tap" }, do: [] }],
  });
  const at = (key: string) => ({ [key]: { look: "s1", since: 0 } });

  it("resolves a slot's look under `<id>:<slot>`, not under the part's own id", () => {
    const box = { ...makeItem("confirmBox"), id: "cb", slotFlows: { cancel: step({ hidden: true }) } } as unknown as Item;
    expect(resolveSlotStates(box, at("cb:cancel"), 0)[0].hidden).toBe(true);
    /* 光看部件自己的机位是看不出来的 —— 这就是"配了不生效"的根 */
    expect(resolveStates(box, at("cb:cancel"), 0).hidden).toBe(false);
    expect(resolveStates(box, at("cb"), 0).hidden).toBe(false);
  });

  it("keeps the main button's machine on the part itself: the empty key", () => {
    /* 主按钮（确认）的机位就是这一部件自己（`<id>`）—— 不是 `<id>:confirm`；「取消」才是一个槽
       （`cancel`，见 tokens 的 CONFIRM_BOX_MAIN / CONFIRM_BOX_CANCEL_SLOT）。 */
    const box = { ...makeItem("confirmBox"), id: "cb", slotFlows: {}, flow: step({ hidden: true }) } as unknown as Item;
    expect(resolveStates(box, at("cb"), 0).hidden).toBe(true);
    expect(resolveSlotStates(box, at("cb"), 0)).toEqual([]);
    /* 而一个刚放下的确认框两台机器都在（见 makeItem / CONFIRM_BOX_HIDE_STEP）：取消那台挂在
       `<id>:cancel` 上 */
    const fresh = { ...makeItem("confirmBox"), id: "cb" } as Item;
    expect(Object.keys(fresh.slotFlows ?? {})).toEqual(["cancel"]);
    expect(resolveSlotStates(fresh, at("cb:cancel"), 0)).toHaveLength(1);
  });

  it("merges hidden, disabled and the cooldown into the part", () => {
    const box = { ...makeItem("confirmBox"), id: "cb", slotFlows: { cancel: step({ hidden: true }) } } as unknown as Item;
    const own = resolveStates(box, {}, 0);
    const slots = resolveSlotStates(box, at("cb:cancel"), 0);
    expect(mergeSlotStates(own, slots).hidden).toBe(true);
    const grey = { ...makeItem("confirmBox"), id: "cb", slotFlows: { cancel: step({ disabled: true }) } } as unknown as Item;
    expect(mergeSlotStates(resolveStates(grey, {}, 0), resolveSlotStates(grey, at("cb:cancel"), 0)).disabled).toBe(true);
    /* 两台机器都没动时什么也不变 */
    expect(mergeSlotStates(own, resolveSlotStates(box, {}, 0)).hidden).toBe(false);
    expect(mergeSlotStates(own, []).hidden).toBe(false);
  });

  it("is only for fused parts: a bar's tab machine speaks about that tab", () => {
    const rail = { ...makeItem("navRail"), id: "rail", slotFlows: { "tab:0": step({ hidden: true }) } } as unknown as Item;
    expect(resolveSlotStates(rail, at("rail:tab:0"), 0)[0].hidden).toBe(true);
    /* 整条栏不受影响：判断"要不要并"的那一处（Preview 的 Tappable）看的就是这个 */
    expect(tapLivesInside("navRail")).toBe(false);
    expect(tapLivesInside("taskBar")).toBe(true);
    /* 确认框是第二个融合部件：整块框不吃点击、「置灰并停止响应」收在它那两颗按钮上 */
    expect(tapLivesInside("confirmBox")).toBe(true);
    /* 融合部件的判定也没变：整块不吃点击、「置灰并停止响应」收在里面的按钮上 */
    expect(disablesWholePart("taskBar")).toBe(false);
    expect(disablesWholePart("confirmBox")).toBe(false);
    expect(TASK_BAR_LOCK_ICON).toBe("lock");
  });

  /* 槽位那台机器「点击后变化 → 改变属性」落下的补丁算在谁头上：融合部件里那颗按钮的"自己"就是这一块
     （作者给确认框的「取消」配「隐藏」，说的就是把这一块收起来 —— 报的"确认生效、取消失效"就是这里
     传成了 null）；栏／标签页的每一格是一个落点，它那份补丁不该盖到整条栏上，所以没有归属。 */
  it("says whose look a slot step lands on: the fused part itself, and no one for a bar's cell", () => {
    /* 融合部件的槽位步骤落在这一块自己身上 */
    expect(slotLookOwner({ id: "cb", kind: "confirmBox" })).toBe("cb");
    expect(slotLookOwner({ id: "tb", kind: "taskBar" })).toBe("tb");
    /* 栏／标签页／工具栏的每一格、以及普通部件：没有归属（那一格自己的补丁不盖到整条栏上） */
    for (const kind of ["bottomNav", "navRail", "topAppBar", "tabs", "sideTabs", "toolbar", "box", "button"] as const) {
      expect(slotLookOwner({ id: "x", kind }), kind).toBeNull();
    }
  });
});

/* 槽位那台机器**存下来再读回来**还得是那台机器。曾经 `slotFlows` 是拿"每个键一张表"那支笔读的（那是
 * `slotStates` 的形状），于是 `{"cancel": {…}}` 读回来成了 `{"cancel": [{…}]}`：`firstTapStep` 读不到
 * `.steps`，那一格配的「点击后变化」在预览里整个失效（作者报的"取消配了隐藏却不生效"）；`hasTimedSteps`
 * 还会在那上面直接抛，读到这种文档预览就挂。 */
describe("a slot machine through save and load", () => {
  const stored = (item: Item) => ({ groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [item] }], frames: [] });
  const roundTrip = (item: Item) => readDoc(JSON.parse(JSON.stringify(stored(item))))!.groups[0].items[0] as Item;
  const tapHide = () => ({
    looks: [],
    steps: [{ id: "st", from: ":start", to: ":start", trigger: { kind: "tap" as const }, do: [{ kind: "look" as const, hidden: true }] }],
  });

  it("reads a fused part's slot back as one machine, not a list", () => {
    const back = roundTrip({ ...makeItem("confirmBox"), id: "cb", slotFlows: { cancel: tapHide() } } as Item);
    expect(Array.isArray(back.slotFlows!.cancel)).toBe(false);
    expect(back.slotFlows).toEqual({ cancel: tapHide() });
    /* 那台机器还在，所以槽位的步骤找得到（`firstTapStep` 读的正是 `.steps`） */
    expect(back.slotFlows!.cancel.steps).toHaveLength(1);
    /* 于是那一格的机位也解得出来（见 resolveSlotStates） */
    expect(resolveSlotStates(back, { "cb:cancel": { look: ":start", since: 0 } }, 0)).toHaveLength(1);
  });

  it("reads a bar's cell the same way — it was broken by the same pen", () => {
    const back = roundTrip({ ...makeItem("bottomNav"), id: "nav", slotFlows: { "tab:0": tapHide() } } as Item);
    expect(back.slotFlows).toEqual({ "tab:0": tapHide() });
  });

  it("still reads the list form our own reader used to write", () => {
    /* 被那个写法读过的文档，再存回去时写的正是 `[flow]` —— 不该因为我们自己的旧毛病把作者的机器丢掉 */
    const back = readItem({ ...makeItem("confirmBox"), id: "cb", slotFlows: { cancel: [tapHide()] } } as unknown as Item)!;
    expect(back.slotFlows).toEqual({ cancel: tapHide() });
  });

  it("keeps the preview's ticker from throwing on a document that holds one", () => {
    const after = { looks: [], steps: [{ id: "st", from: ":start", to: ":start", trigger: { kind: "after" as const, seconds: 3 }, do: [] }] };
    const read = readDoc(stored({ ...makeItem("confirmBox"), id: "cb", slotFlows: { cancel: after } } as Item))!;
    const items = read.groups.flatMap((g) => g.items);
    expect(() => hasTimedSteps(items)).not.toThrow();
    expect(hasTimedSteps(items)).toBe(true);
    /* 第二道保险：就算真拿到那种串成列表的形状（读回来之前不该有），也只是"看不出有没有等待的步骤"，
       不该让预览整个抛掉 —— 读回来之后 `slotFlows` 一定是那台机器本身（见上面那条）。 */
    const odd = { ...makeItem("confirmBox"), id: "odd", slotFlows: { cancel: [after] } } as unknown as Item;
    expect(() => hasTimedSteps([odd])).not.toThrow();
    expect(hasTimedSteps([odd])).toBe(false);
  });
});
