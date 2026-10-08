import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PALETTES, makeItem, type Doc } from "../lib/tokens";
import { Preview } from "./Preview";

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  cursor: 0,
  effects: [] as (() => void | (() => void))[],
  present: true,
  peek: false,
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [hooks.peek && initial === null ? { frameId: "next", t: "slideLeft" } : typeof initial === "function" ? initial() : initial, vi.fn()],
  useRef: (current: unknown) => hooks.refs[hooks.cursor++] ?? (hooks.refs[hooks.cursor - 1] = { current }),
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
  useMemo: (value: () => unknown) => value(),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("motion/react", () => ({
  AnimatePresence: "presence",
  motion: { div: "div", button: "button" },
  useReducedMotion: () => false,
  useIsPresent: () => hooks.present,
  useMotionValue: (value: number) => ({ get: () => value }),
  useTransform: () => 0,
}));
vi.mock("@/lib/tokens", () => import("../lib/tokens"));
vi.mock("@/lib/rail", () => import("../lib/rail"));
vi.mock("@/lib/railView", () => import("../lib/railView"));
vi.mock("@/lib/i18n", async () => ({ ...await import("../lib/i18n"), useLang: () => "en" }));
vi.mock("./M3Node", () => ({ M3Node: "node", Icon: "icon", ValueContext: { Provider: "provider" }, PartPressContext: { Provider: "part-press" } }));
vi.mock("./ui", () => ({ IconBtn: "button" }));

const doc: Doc = {
  frame: "phone", paletteKey: "purple", title: "", brief: "",
  frames: [{ id: "first", name: "First", x: 0, y: 0, w: 1280, h: 800 }, { id: "next", name: "Next", x: 1400, y: 0, w: 1280, h: 800 }],
  groups: [0, 1400].map((x, i) => ({
    id: `group-${i}`, x, y: 0, axis: "y",
    items: [{ id: `rail-${i}`, kind: "navRail", label: "", icon: "menu", variant: "filled", railExpanded: true, railModal: true }],
  })),
};
type Element = ReactElement<Record<string, unknown>>;
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children)];
}

// Like Loading.test.tsx, inspect the actual elements and effect callbacks without
// a DOM runtime. Browser tests cover Motion's presence propagation and real focus.
function screenElement(peek = false, source: Doc = doc) {
  hooks.peek = peek;
  const tree = Preview({ doc: source, widths: {}, palette: PALETTES[0], startId: "first", onClose: vi.fn() });
  const screens = elements(tree).filter((element) => typeof element.type === "function" && "frame" in element.props);
  hooks.peek = false;
  hooks.refs = [];
  // chosen by its prop rather than by position, so reordering the JSX cannot swap them
  const screen = screens.find((element) => (element.props.active === false) === peek);
  if (!screen) throw new Error(`no ${peek ? "peek" : "current"} screen rendered`);
  return screen;
}
function renderScreen(element: Element) {
  hooks.cursor = 0;
  hooks.effects = [];
  return (element.type as (props: Record<string, unknown>) => Element)(element.props);
}
function runEffects() {
  const cleanups = hooks.effects.map((effect) => effect());
  return () => cleanups.forEach((cleanup) => cleanup?.());
}

describe("preview screen modal lifecycle", () => {
  const previous = { isConnected: true, closest: vi.fn(), focus: vi.fn() };
  const toggle = { closest: () => ({}), focus: vi.fn(() => { documentState.activeElement = toggle; }) };
  const body = { closest: () => null };
  const documentState = { activeElement: previous as typeof previous | typeof toggle | typeof body | null, body };
  let previousInside = true;
  const host = { querySelector: vi.fn(() => toggle), contains: (element: unknown) => element === toggle || (element === previous && previousInside), focus: vi.fn() };
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  const attach = (tree: Element) => { (tree.props.ref as { current: unknown }).current = host; };

  beforeEach(() => {
    vi.clearAllMocks();
    hooks.refs = [];
    hooks.cursor = 0;
    hooks.effects = [];
    hooks.present = true;
    hooks.peek = false;
    previous.isConnected = true;
    previousInside = true;
    previous.closest.mockReturnValue(null);
    documentState.activeElement = previous;
    vi.stubGlobal("document", documentState);
    vi.stubGlobal("window", { addEventListener, removeEventListener });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the peek screen inert and free of modal side effects", () => {
    const element = screenElement(true);
    expect(element.props.active).toBe(false);
    const tree = renderScreen(element);
    attach(tree);
    const cleanup = runEffects();
    expect(tree.props).toMatchObject({ inert: true, "aria-hidden": true, role: "group", "aria-label": "Next" });
    expect(tree.props["aria-modal"]).toBeUndefined();
    expect(toggle.focus).not.toHaveBeenCalled();
    expect(host.focus).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
    cleanup();
    expect(previous.focus).not.toHaveBeenCalled();
    expect(host.focus).not.toHaveBeenCalled();
  });

  it.each(["nothing", "the body", "an inert subtree"])("takes focus itself when %s holds it as the screen on show", (holder) => {
    if (holder === "nothing") documentState.activeElement = null;
    else if (holder === "the body") documentState.activeElement = documentState.body;
    else previous.closest.mockReturnValue({});
    const element = screenElement();
    const tree = renderScreen({ ...element, props: { ...element.props, groups: [] } });
    attach(tree);
    runEffects();
    expect(tree.props).toMatchObject({ tabIndex: -1, role: "group", "aria-label": "First" });
    expect(host.focus).toHaveBeenCalledOnce();
    expect(toggle.focus).not.toHaveBeenCalled();
  });

  it("focuses and registers keyboard handling while the screen is active", () => {
    const element = screenElement();
    const tree = renderScreen(element);
    attach(tree);
    const cleanup = runEffects();
    expect(tree.props).toMatchObject({ inert: false, role: "dialog", "aria-modal": true });
    expect(toggle.focus).toHaveBeenCalledOnce();
    expect(addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    cleanup();
    expect(removeEventListener).toHaveBeenCalledWith("keydown", addEventListener.mock.calls[0][1], true);
  });

  it("deactivates a mounted modal without reclaiming focus when it exits", () => {
    const element = screenElement();
    attach(renderScreen(element));
    const cleanup = runEffects();
    expect(toggle.focus).toHaveBeenCalledOnce();
    expect(addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    const listener = addEventListener.mock.calls[0][1];
    vi.clearAllMocks();

    hooks.present = false;
    const exiting = renderScreen(element);
    expect(exiting.props).toMatchObject({ inert: true, "aria-hidden": true, role: "group" });
    expect(exiting.props["aria-modal"]).toBeUndefined();
    cleanup();
    expect(previous.focus).not.toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledWith("keydown", listener, true);
    const cleanupExiting = runEffects();
    expect(toggle.focus).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
    cleanupExiting();
    expect(previous.focus).not.toHaveBeenCalled();
  });

  it.each(["connected", "outside", "inert", "disconnected"])("restores a %s previous target only when safe on modal dismissal", (status) => {
    const element = screenElement();
    attach(renderScreen(element));
    const cleanup = runEffects();
    previous.isConnected = status !== "disconnected";
    previousInside = status !== "outside";
    previous.closest.mockReturnValue(status === "inert" ? {} : null);
    renderScreen({ ...element, props: { ...element.props, groups: [] } });
    cleanup();
    expect(previous.focus).toHaveBeenCalledTimes(status === "connected" ? 1 : 0);
    // an unusable previous target hands the keyboard to the screen itself, never to the body
    expect(host.focus).toHaveBeenCalledTimes(status === "connected" ? 0 : 1);
  });
});

/* 融合部件（任务信息条）里那一下点击归谁：标题、两个奖励格和领取按钮都是**同一个部件**的字段，
 * 而能点的只有那颗按钮。预览里每一次点按都要过 Tappable 上的那道门，所以这里直接读那道门与它交给
 * M3Node 的 PartPressContext：整条不接 onClick，按钮拿到那份 press；锁住（徽标里的锁图标）时两份
 * 都没有 —— 「当出现这个锁的图标时，该按钮点击时，禁止响应」就是这一条。判定本身在 lib/tokens 的
 * taskBarButtonLocked，普通部件照旧整块都是点击目标。 */
describe("a task bar's tap belongs to its button", () => {
  const partDoc = (kind: "taskBar" | "confirmBox" | "bottomNav" | "button", patch: Record<string, unknown>) =>
    ({
      ...doc,
      groups: [{ id: "g", x: 0, y: 0, axis: "y", items: [{ ...makeItem(kind), id: "tb", ...patch }] }],
    }) as unknown as Doc;
  /** the element the tap would land on: the preview's Tappable for this one part, rendered */
  const tappable = (kind: "taskBar" | "confirmBox" | "button" = "taskBar", patch: Record<string, unknown> = {}) => {
    hooks.refs = [];
    hooks.cursor = 0;
    hooks.effects = [];
    const tree = renderScreen(screenElement(false, partDoc(kind, patch)));
    const found = elements(tree).find((element) => typeof element.type === "function" && (element.props.item as { id?: string } | undefined)?.id === "tb");
    if (!found) throw new Error("no tappable for the part");
    hooks.cursor = 0;
    hooks.effects = [];
    /* the component's props are its inputs; the click path and the style are on what it draws */
    return (found.type as (props: Record<string, unknown>) => Element)(found.props);
  };
  /** 画在部件里面的那几颗按钮此刻的状态（融合部件用 PartPressContext 把它带下去）：
   *  `press` 是主按钮那一下，`pressSlot` 取某一颗槽位按钮（确认框的「取消」）那一下，
   *  `off` 是「置灰并停止响应」关掉了它们 */
  const buttonOf = (drawn: Element) => {
    const provider = elements(drawn).find((element) => element.type === "part-press");
    return (provider?.props.value ?? {}) as { press?: () => void; pressSlot?: (slot: string) => (() => void) | undefined; off?: boolean };
  };
  /** 这一下点击**归属**给谁：把这个部件的 Tappable 画出来，同时记下它那个 runtime —— 调用里面的按钮
   *  或槽位就落在同一个 runtime 上，于是能读到 `onStep(key, flow, owner)` 收到的那三个参数。 */
  const tapOwnerOf = (kind: "confirmBox" | "bottomNav" | "taskBar" | "button", id: string, patch: Record<string, unknown> = {}) => {
    hooks.refs = [];
    hooks.cursor = 0;
    hooks.effects = [];
    const tree = renderScreen(screenElement(false, partDoc(kind, { id, ...patch })));
    const found = elements(tree).find((element) => typeof element.type === "function" && (element.props.item as { id?: string } | undefined)?.id === id);
    if (!found) throw new Error("no tappable for the part");
    const runtime = found.props.states as { onStep: (key: string, flow: unknown, owner: string | null) => string };
    const spy = vi.spyOn(runtime, "onStep");
    /* 里面的按钮用的是同一批 ref（见上面的 useRef 桩）：不复位就会拿到上一件测试留下的"刚滚过"标志 */
    hooks.refs = [];
    hooks.cursor = 0;
    hooks.effects = [];
    const drawn = (found.type as (props: Record<string, unknown>) => Element)(found.props);
    return {
      drawn,
      props: found.props,
      calls: () => spy.mock.calls as unknown as [string, unknown, string | null][],
      /** 这一部件在某份"点住了的外观补丁"下画成什么：一份 hidden 就该整块收起来 */
      render: (pinned: Record<string, unknown>) => {
        hooks.refs = [];
        hooks.cursor = 0;
        hooks.effects = [];
        return (found.type as (props: Record<string, unknown>) => Element | null)({ ...found.props, states: { ...runtime, pinned } });
      },
    };
  };

  it("hands it to the button inside, never to the bar around it", () => {
    const bar = tappable();
    /* 整条不接这一下：点标题、点奖励格都不该走同一个 action */
    expect(bar.props.onClick).toBeUndefined();
    expect((bar.props.style as Record<string, unknown>).cursor).toBe("default");
    /* 画在它里面的领取按钮拿到了（M3Node 的 TaskBarContent 调它，见 PartPressContext） */
    expect(typeof buttonOf(bar).press).toBe("function");
    expect(buttonOf(bar).off).toBe(false);
  });

  /* 作者这一版的设计：新落下的确认框**两颗都把这一块收起来**（「里面我加了隐藏面板的逻辑」）。
     这里走的是整条链：点任一颗 → 派发到这一部件自己 → 那一步把 `hidden` 落在这一块上 → 画出来就是
     "没有这一块"。 */
  it("comes wired: a fresh confirm box's own two buttons both put it away", () => {
    const seen = tapOwnerOf("confirmBox", "cb");
    buttonOf(seen.drawn).press?.();
    buttonOf(seen.drawn).pressSlot?.("cancel")?.();
    /* 两台机器各是各的机位（主按钮是这一部件自己、取消是那个槽），归属都是这一块 */
    expect(seen.calls().map(([key, , owner]) => [key, owner])).toEqual([["cb", "cb"], ["cb:cancel", "cb"]]);
    /* 两台带着的都是同一步：点一下、隐藏这一块 */
    for (const [, flow] of seen.calls()) {
      expect((flow as { steps: { trigger: unknown; do: unknown }[] }).steps.map((s) => [s.trigger, s.do])).toEqual([
        [{ kind: "tap" }, [{ kind: "look", hidden: true }]],
      ]);
    }
    expect(seen.render({ cb: { hidden: true } })).toBeNull();
    expect(seen.render({})).not.toBeNull();
  });

  it("still answers a tap anywhere when the part is an ordinary one", () => {
    /* 单一部件里没有"看起来像按钮"的那一块时，整块照旧是点击目标 */
    const card = tappable("button", { action: "goto:next" });
    expect(typeof card.props.onClick).toBe("function");
    expect(buttonOf(card).press).toBeUndefined();
    expect(buttonOf(card).pressSlot).toBeUndefined();
  });

  it("carries no click path at all when the badge is the lock", () => {
    const locked = tappable("taskBar", { buttonBadgeIcon: "lock" });
    expect(locked.props.onClick).toBeUndefined();
    expect((locked.props.style as Record<string, unknown>).pointerEvents).toBe("none");
    /* 锁住时连条里那颗按钮也没有那一下：两道门问的是同一个判定 */
    expect(buttonOf(locked).press).toBeUndefined();
    /* 别的图标不是锁：一样的徽标、不一样的语义 */
    const other = tappable("taskBar", { buttonBadgeIcon: "lock_open" });
    expect(other.props.onClick).toBeUndefined();
    expect(typeof buttonOf(other).press).toBe("function");
    expect((other.props.style as Record<string, unknown>).pointerEvents).toBeUndefined();
  });

  /* 确认框：同一个部件里画着**两颗**普通按钮（左取消、右确认）。整块框一样不接这一下，两颗各拿各的
     那一下 —— 主按钮走 `press`（这一部件自己的状态机 + action），取消走 `pressSlot("cancel")`
     （`slotFlows.cancel` / `actions.cancel`，见 pickSlot）。 */
  it("hands the confirm box's two buttons their own taps, never to the frame", () => {
    const box = tappable("confirmBox");
    expect(box.props.onClick).toBeUndefined();
    expect((box.props.style as Record<string, unknown>).cursor).toBe("default");
    /* 主按钮（确认）那一下 */
    expect(typeof buttonOf(box).press).toBe("function");
    /* 取消那颗有它自己那一份 —— 哪怕还没配任何去处：槽位入口不能只看 `actions`（作者常常只配状态机，
       甚至先什么都不配），少看一样那颗按钮就根本没人接（见 confirm-box.md 里那两个坑之一） */
    expect(typeof buttonOf(box).pressSlot?.("cancel")).toBe("function");
    expect(buttonOf(box).off).toBe(false);
  });

  it("gives the cancel slot its own machine, wherever the author put it", () => {
    const step = { looks: [{ id: "s1", hidden: true }], steps: [{ id: "st", from: ":start", to: "s1", trigger: { kind: "tap" }, do: [] }] };
    /* 只配了状态机（「点击后变化 → 隐藏」） */
    const byFlow = tappable("confirmBox", { slotFlows: { cancel: step } });
    expect(typeof buttonOf(byFlow).pressSlot?.("cancel")).toBe("function");
    /* 只配了去处 */
    const byAction = tappable("confirmBox", { actions: { cancel: { to: "next", transition: "none" } } });
    expect(typeof buttonOf(byAction).pressSlot?.("cancel")).toBe("function");
    /* 两颗各管各的：主按钮那一份和取消那一份不是同一个 */
    expect(buttonOf(byFlow).press).not.toBe(buttonOf(byFlow).pressSlot?.("cancel"));
  });

  /* 作者报的那一件：两颗按钮都配「点击后变化 → 改变属性 → 隐藏」，确认生效、取消却不生效。
     根因是槽位那一步走的是 `pickSlot`，它把这台机器的"归属"传成了 null，于是那一步里那份外观补丁
     没有落点（见 Preview 的 runRuleAction：`const target = a.target ?? owner`）。融合部件里画在自己
     里面的那颗按钮**不是画布上独立的部件**，它的"自己"就是这一块 —— 归属必须是这一部件自己，和主
     按钮那一下同一处（见 lib/tokens 的 slotLookOwner）。 */
  it("latches a slot step onto the part, exactly as the main button's own step does", () => {
    const hide = { looks: [], steps: [{ id: "st", from: ":start", to: ":start", trigger: { kind: "tap" }, do: [{ kind: "look", hidden: true }] }] };
    const seen = tapOwnerOf("confirmBox", "tb", { flow: hide, slotFlows: { cancel: hide } });
    const drawn = seen.drawn;
    /* 主按钮（确认）那一下：归属是这一部件自己 */
    buttonOf(drawn).press?.();
    expect(seen.calls()).toEqual([["tb", expect.anything(), "tb"]]);
    /* 取消那一下：同样是这一部件自己 —— 不是 null，不然那份"隐藏"落不下去 */
    buttonOf(drawn).pressSlot?.("cancel")?.();
    expect(seen.calls()[1]).toEqual(["tb:cancel", expect.anything(), "tb"]);
    /* 那份补丁落到这一块上时，画出来就是"没有这一块"（Tappable 的 `own?.hidden || pin?.hidden`）——
       作者看到的那条链于是完整了：取消那一下 → onStep('tb:cancel', …, 'tb') → pinned.tb =
       {hidden: true} → 整块收起来。 */
    expect(seen.render({})).not.toBeNull();
    expect(seen.render({ tb: { hidden: true } })).toBeNull();
  });

  it("leaves a bar's cell unowned, so its own patch can never cover the whole bar", () => {
    /* 栏／标签页的每一格是一个**落点**：它那份"改变属性"说的是那一格，所以归属照旧是 null */
    const tap = { looks: [], steps: [{ id: "st", from: ":start", to: ":start", trigger: { kind: "tap" }, do: [{ kind: "look", hidden: true }] }] };
    const seen = tapOwnerOf("bottomNav", "nav", { slotFlows: { "tab:0": tap } });
    (seen.props.onSlot as (slot: string) => void)("tab:0");
    expect(seen.calls()).toEqual([["nav:tab:0", expect.anything(), null]]);
  });

  /* 时间到的那一步走的是另一条路（Screen 的定时循环），归属也得是同一处：一个确认框"三秒后自己收
     起来"不该因为写在「取消」那颗上就落空。 */
  it("gives a slot's timed step the same owner as its tap", () => {
    const after = {
      looks: [],
      steps: [{ id: "st", from: ":start", to: ":start", trigger: { kind: "after", seconds: 0 }, do: [{ kind: "look", hidden: true }] }],
    };
    hooks.refs = [];
    hooks.cursor = 0;
    hooks.effects = [];
    const tree = renderScreen(screenElement(false, partDoc("confirmBox", { slotFlows: { cancel: after } })));
    const screenEffects = hooks.effects.slice();
    const found = elements(tree).find((element) => typeof element.type === "function" && (element.props.item as { id?: string } | undefined)?.id === "tb");
    if (!found) throw new Error("no tappable for the part");
    const runtime = found.props.states as { take: (key: string, owner: string | null, step: unknown) => void };
    const taken = vi.spyOn(runtime, "take");
    /* 这一屏自己的 effect 也在这批里（其中一条要看焦点），所以给它一个最小 document */
    vi.stubGlobal("document", { activeElement: null, body: null, querySelector: () => null });
    try {
      screenEffects.forEach((effect) => effect());
    } finally {
      vi.unstubAllGlobals();
    }
    expect(taken.mock.calls.some(([key, owner]) => key === "tb:cancel" && owner === "tb")).toBe(true);
  });
});
