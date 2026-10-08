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
  const partDoc = (kind: "taskBar" | "button", patch: Record<string, unknown>) =>
    ({
      ...doc,
      groups: [{ id: "g", x: 0, y: 0, axis: "y", items: [{ ...makeItem(kind), id: "tb", ...patch }] }],
    }) as unknown as Doc;
  /** the element the tap would land on: the preview's Tappable for this one part, rendered */
  const tappable = (kind: "taskBar" | "button" = "taskBar", patch: Record<string, unknown> = {}) => {
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
  /** 画在部件里面的那颗按钮此刻的状态（融合部件用 PartPressContext 把它带下去）：
   *  `press` 是那一下点击，`off` 是「置灰并停止响应」关掉了它 */
  const buttonOf = (drawn: Element) => {
    const provider = elements(drawn).find((element) => element.type === "part-press");
    return (provider?.props.value ?? {}) as { press?: () => void; off?: boolean };
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

  it("still answers a tap anywhere when the part is an ordinary one", () => {
    /* 单一部件里没有"看起来像按钮"的那一块时，整块照旧是点击目标 */
    const card = tappable("button", { action: "goto:next" });
    expect(typeof card.props.onClick).toBe("function");
    expect(buttonOf(card).press).toBeUndefined();
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
});
