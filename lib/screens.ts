/**
 * 一屏引用了哪些别的屏 —— 上传一个屏幕时判断"这一组要带走几屏"的唯一一处
 * ---------------------------------------------------------------------------
 * 组件落到别人的画布上时，引用是**按 id** 写的（一个 frame id，或者某个部件的 id），而 id 是文档内的：
 * 换一份文档就不成立了。所以跨屏联动必须在上传时就把引用到的屏**一起打包**，落地时再把引用重指到新建
 * 出来的屏上（见 docs/multi-screen-component.md）。这个文件只做前半截：**判断**。它不认识打包格式，
 * 也不碰界面 —— 输入一份文档和起屏，输出"要带哪几屏、有哪些引用、哪些已经指不到东西"。
 *
 * 四类引用都算跨屏，缺一类就会静默漏屏：
 *   · 部件自己的点击 `action.to`、栏上每一格 `actions[*].to` —— 目标可以是别的页，也可以是别的浮层页
 *   · 流程步骤里的跳转 `goto.to`
 *   · **屏自己的**滑动 `frame.swipe[方向]` —— 这条长在屏上、不在部件上，最容易漏
 *   · 流程步骤里改别的部件 `look.target`、文本读别的部件 `shows` —— 候选项本来就跨屏
 *
 * 两个哨兵值不算跨屏：`back`、`close`（`CLOSE_PANEL_TARGET`）——它们在预览里本地兑现，不点名任何屏，
 * 所以它们换了文档也照样成立。
 *
 * 还有两种"不算跨屏但也要留意"的，判断时按同一支笔处理：
 *   · 画在**本屏**上的浮层部件（`action.to` = 那个部件的 id）：不带走任何屏，但它的 id 落地时会换，
 *     所以落地那一步要把它一起重指 —— 判断阶段它既不算 out 也不算 dead，直接略过。
 *   · 指到已经不在的屏/部件的：算 dead 单独报出来（编辑器审计里那条「点击没有目标」就是它）。
 */

import {
  BACK_TARGET,
  CLOSE_PANEL_TARGET,
  FRAME_GAP,
  SWIPE_DIRS,
  copySubtree,
  findItemIn,
  frameOfGroup,
  isOverlayItem,
  itemsOf,
  uid,
  type Action,
  type Frame,
  type Group,
  type Item,
  type PartFlow,
  type PlacedItem,
} from "./tokens";
/* 只借它的类型：`ScreenData` 是组件带屏的打包格式（见 lib/market.ts）。`import type` 编译后不留
   运行时依赖，所以这里不会和 market.ts 绕成环。 */
import type { ScreenData, SerializedGroup } from "./market";

/** 一次上传最多带几屏（**含起屏自己**）：超过了就不让上传，见 `ScreenClosure.over` */
export const MAX_UPLOAD_SCREENS = 3;

/** 这一处引用是从哪儿来的。提示语里要分清楚，作者才知道该去改哪里。 */
export type RefVia = "tap" | "slot" | "goto" | "swipe" | "look" | "shows";

/** 一处引用 */
export type ScreenRef = {
  via: RefVia;
  /** 目标：一个 frame id，或者一个部件 id（`look` / `shows` / 页上的浮层） */
  to: string;
  /** 这一处引用长在哪个部件上；屏自己的滑动没有这一项 */
  itemId?: string;
  /** 目标落在哪一屏；`null` 表示指不到任何东西 */
  owner: string | null;
};

export type ScreenRefs = {
  /** 落点是**别的**屏的引用（漏一处就会少带一屏） */
  out: ScreenRef[];
  /** 指不到任何东西的引用（它们本来就没有去处，带上也变不好） */
  dead: ScreenRef[];
};

export type ScreenClosure = {
  /** 起屏在第一个，其余按发现顺序；**每个屏只出现一次**（A↔B 互相引用也只有这两个） */
  screens: Frame[];
  /** 指向闭包里另一屏的引用：落地时按这些重指 */
  refs: ScreenRef[];
  /** 已经指不到东西的引用 */
  dead: ScreenRef[];
  /** 超过 `MAX_UPLOAD_SCREENS`：不让上传。`screens` 仍是完整的，提示里才说得清多出来的是谁 */
  over: boolean;
};

/** 一个"要去的地方"落在哪一屏：frame id 就是它自己；画在某屏上的**浮层**部件看它被哪一组装着。
 *  别的部件不算去处（预览只在一屏的浮层里找这个 id，见 Preview 的 `dialogItemIds`）—— 那是死链。 */
const dialogOwnerOf = (id: string, groups: Group[], frames: Frame[], widths: Record<string, number>): string | null => {
  if (frames.some((f) => f.id === id)) return id;
  for (const g of groups) {
    const it = findItemIn(g.items, id);
    if (it) return isOverlayItem(it) ? (frameOfGroup(g, frames, widths)?.id ?? null) : null;
  }
  return null;
};

/** 一个**部件**落在哪一屏：`look` 与 `shows` 的目标可以是任何部件，不限于浮层 */
const partOwnerOf = (id: string, groups: Group[], frames: Frame[], widths: Record<string, number>): string | null => {
  for (const g of groups) if (findItemIn(g.items, id)) return frameOfGroup(g, frames, widths)?.id ?? null;
  return null;
};

/** 这一屏的组（`frameOfGroup` 认 `frameId`，老文档退回几何判断） */
export const groupsOfFrame = (frame: Frame, groups: Group[], frames: Frame[], widths: Record<string, number>): Group[] =>
  groups.filter((g) => frameOfGroup(g, frames, widths)?.id === frame.id);

/**
 * 这一屏引用了哪些**别的**屏，以及哪些引用已经指不到东西
 *
 * 落点在本屏内部的引用（页上的浮层部件、本屏自己的部件）不进 `out`：它们不带走任何屏。落地时那些
 * 引用照样要重指，但那是"照着带过去的部件重算一遍"，不需要在这里列。
 */
export function refsOfScreen(frame: Frame, groups: Group[], frames: Frame[], widths: Record<string, number>): ScreenRefs {
  const out: ScreenRef[] = [];
  const dead: ScreenRef[] = [];
  const place = (ref: ScreenRef) => {
    if (ref.owner === null) dead.push(ref);
    else if (ref.owner !== frame.id) out.push(ref);
  };

  /* 屏自己的滑动换屏 */
  for (const d of SWIPE_DIRS) {
    const to = frame.swipe?.[d.key];
    if (to) place({ via: "swipe", to, owner: dialogOwnerOf(to, groups, frames, widths) });
  }

  for (const g of groupsOfFrame(frame, groups, frames, widths)) {
    for (const it of itemsOf([g])) {
      /* 部件自己的点击，以及栏上每一格各自的点击 */
      const taps: { via: RefVia; action: Action | undefined }[] = [
        { via: "tap", action: it.action },
        ...Object.entries(it.actions ?? {}).map(([, action]) => ({ via: "slot" as const, action })),
      ];
      for (const { via, action } of taps) {
        if (!action || action.to === BACK_TARGET || action.to === CLOSE_PANEL_TARGET) continue;
        place({ via, to: action.to, itemId: it.id, owner: dialogOwnerOf(action.to, groups, frames, widths) });
      }
      /* 这台机器（部件自己的，以及它每一格的）每一步里做的事 */
      for (const machine of [...(it.flow ? [it.flow] : []), ...Object.values(it.slotFlows ?? {})]) {
        for (const st of machine.steps) {
          for (const act of st.do ?? []) {
            /* 跳转只能去一屏（预览的 go() 只认 frame id）：指到别处就是死链 */
            if (act.kind === "goto" && act.to !== BACK_TARGET && act.to !== CLOSE_PANEL_TARGET) {
              place({ via: "goto", to: act.to, itemId: it.id, owner: frames.some((f) => f.id === act.to) ? act.to : null });
            }
            /* 改别的部件：目标可以是任何部件，跨屏也成立 */
            if (act.kind === "look" && act.target) {
              place({ via: "look", to: act.target, itemId: it.id, owner: partOwnerOf(act.target, groups, frames, widths) });
            }
          }
        }
      }
      /* 文本读别的部件的值 */
      if (it.shows) place({ via: "shows", to: it.shows, itemId: it.id, owner: partOwnerOf(it.shows, groups, frames, widths) });
    }
  }
  return { out, dead };
}

/**
 * 从起屏出发，把引用到的屏一层层收齐（闭包）
 *
 * `screens` 每个屏只进一次：A→B→C 是三个，A↔B 互相引用也只有 A 和 B 两个 —— 环因此不需要特殊处理，
 * `seen` 就是去重。顺序是发现顺序，起屏在第一个，详情页与上传清单都按它展示。
 *
 * 超过 `max` 时 `over` 为真（**不让上传**）。这里照旧把闭包算完整：提示里要说得清"多出来的是哪几屏"，
 * 作者才知道去删哪条引用。
 */
export function screenClosure(
  start: Frame,
  groups: Group[],
  frames: Frame[],
  widths: Record<string, number>,
  max = MAX_UPLOAD_SCREENS,
): ScreenClosure {
  const byId = new Map(frames.map((f) => [f.id, f]));
  const seen = new Set<string>([start.id]);
  const screens: Frame[] = [];
  const refs: ScreenRef[] = [];
  const dead: ScreenRef[] = [];
  const queue: Frame[] = [start];
  while (queue.length > 0) {
    const frame = queue.shift()!;
    screens.push(frame);
    const found = refsOfScreen(frame, groups, frames, widths);
    refs.push(...found.out);
    dead.push(...found.dead);
    for (const ref of found.out) {
      if (!ref.owner || seen.has(ref.owner)) continue;
      const next = byId.get(ref.owner);
      if (!next) continue;
      seen.add(ref.owner);
      queue.push(next);
    }
  }
  return { screens, refs, dead, over: screens.length > max };
}

/** 每个屏被引用了多少处：上传清单里那句"被引用 N 处" */
export function refCountsOf(refs: ScreenRef[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ref of refs) {
    if (ref.owner) counts.set(ref.owner, (counts.get(ref.owner) ?? 0) + 1);
  }
  return counts;
}

/* ---------- 落地：把带过来的屏建成真屏，再把引用重指过去 ---------- */

/** 旧 id → 新 id */
export type IdMap = Map<string, string>;

export type PlacedScreens = {
  /** 新建出来的那几屏（**不含起屏** —— 它的内容就是这一次拖进来的组件本身） */
  frames: Frame[];
  /** 这些屏自己的组：坐标已经摆到画布上，里面的部件全是新 id */
  groups: Group[];
  /** 旧 frame id → 新 frame id：被引用的屏是新 id，**起屏 → 它落进的那一页** */
  frameMap: IdMap;
  /** 旧部件 id → 新部件 id：被引用屏里的那些 */
  itemMap: IdMap;
};

/** 一屏建成一页真屏：尺寸、底色与**身份**照带（浮层屏不写 `role` 就会变成一页普通屏幕） */
const frameFromScreen = (screen: ScreenData, id: string, x: number, y: number): Frame => ({
  id,
  name: screen.name,
  x: Math.round(x),
  y: Math.round(y),
  w: Math.max(1, Math.round(screen.w)),
  h: Math.max(1, Math.round(screen.h)),
  ...(screen.bg ? { bg: screen.bg as Frame["bg"] } : undefined),
  ...(screen.role ? { role: screen.role } : undefined),
  ...(screen.level ? { level: screen.level } : undefined),
  ...(screen.autoClose !== undefined ? { autoClose: screen.autoClose } : undefined),
  ...(screen.note ? { note: screen.note } : undefined),
});

/** 一屏里的一组复制到画布上：部件整棵换成新 id，组按屏自己的坐标系摆回去 */
const copyScreenGroup = (g: SerializedGroup, frameId: string, x: number, y: number, nextId: () => string, itemMap: IdMap): Group => {
  const items = g.items.map((it) => copySubtree(it, nextId, itemMap) as PlacedItem);
  /* 自由组的偏移表按**旧部件 id** 记：复制完要跟着换一遍，不然位置就丢了 */
  const pos: Record<string, { x: number; y: number }> = {};
  for (const [oldId, at] of Object.entries(g.pos ?? {})) pos[itemMap.get(oldId) ?? oldId] = at;
  return {
    id: nextId(),
    x: Math.round(x + g.x),
    y: Math.round(y + g.y),
    axis: g.axis,
    frameId,
    ...(g.free ? { free: true as const } : undefined),
    ...(Object.keys(pos).length ? { pos } : undefined),
    items,
  };
};

/**
 * 把组件带过来的那几屏**建成真屏**
 *
 * 起屏（`bundle[0]`）不建：它的内容就是这一次拖进来的组件本身，落在 `hostFrameId` 那一页上 ——
 * 所以"回到 A"这类引用要重指到那一页（组件在哪儿，A 就在哪儿）。其余每一屏都建成一页真屏：
 * `role` / `level` / `autoClose` / `bg` / `note` 照带（`role: "overlay"` 的落地后仍旧弹在那一屏上），
 * 部件整棵复制成新 id，组按屏自己的坐标系摆回去，屏与屏往右让开 `FRAME_GAP`（和新屏幕落在最右边的
 * 规矩同一个间距）。
 *
 * 认得出引用靠的是每一屏**上传前的 frame id**（`ScreenData.id`）：数据里那些引用写的就是它们；
 * 认不出来的一律原样留着，交给审计面板去报。
 */
export function placeScreens(
  bundle: ScreenData[],
  host: { frameId: string; x: number; y: number },
  nextId: () => string = uid,
): PlacedScreens {
  const frames: Frame[] = [];
  const groups: Group[] = [];
  const frameMap: IdMap = new Map();
  const itemMap: IdMap = new Map();
  const [start, ...rest] = bundle;
  if (start?.id) frameMap.set(start.id, host.frameId);
  let x = host.x;
  for (const screen of rest) {
    const id = nextId();
    if (screen.id) frameMap.set(screen.id, id);
    const w = Math.max(1, Math.round(screen.w));
    const frame = frameFromScreen(screen, id, x, host.y);
    frames.push(frame);
    for (const g of screen.groups) groups.push(copyScreenGroup(g, id, frame.x, frame.y, nextId, itemMap));
    x = Math.round(x) + w + FRAME_GAP;
  }
  return { frames, groups, frameMap, itemMap };
}

/**
 * 一组屏**原样**铺成一份文档（市场详情页的预览用它）
 *
 * 和落地那一步同一套映射：每一屏都建成一页真屏、部件整棵换成新 id，再把引用按两张表重指过去 ——
 * 于是 A 上那颗按钮点下去**真的会弹出 B 那一屏**（引用按 id 认路，换一份文档就必须重指，预览也一样；
 * 见 docs/multi-screen-component.md）。`startId` 是第一屏。
 *
 * **分两趟走**：先把每一屏的部件都复制出来（这一趟把 `itemMap` 填满），再统一重指 —— 引用可能指向
 * 后面才建出来的那一屏或那一个部件，边复制边重指就会漏掉它们。
 */
export function screensAsDoc(bundle: ScreenData[], nextId: () => string = uid): { frames: Frame[]; groups: Group[]; startId: string | null } {
  const frames: Frame[] = [];
  const frameMap: IdMap = new Map();
  const itemMap: IdMap = new Map();
  let x = 0;
  for (const screen of bundle) {
    const id = nextId();
    if (screen.id) frameMap.set(screen.id, id);
    const w = Math.max(1, Math.round(screen.w));
    frames.push(frameFromScreen(screen, id, x, 0));
    x = Math.round(x) + w + FRAME_GAP;
  }
  /* 第一趟：只复制（组先摆好，引用原样留着） */
  const copied = bundle.map((screen, i) => screen.groups.map((g) => copyScreenGroup(g, frames[i].id, frames[i].x, frames[i].y, nextId, itemMap)));
  /* 第二趟：两张表都齐了，再统一重指 */
  const groups = copied.flat().map((g) => ({ ...g, items: remapTree(g.items, frameMap, itemMap) }));
  return { frames, groups, startId: frames[0]?.id ?? null };
}

/** 一个去处：`back` / `close` 是本地兑现的哨兵，永远不动；其余按两张表换新 id，换不了就原样留着 */
const remapTarget = (to: string, frames: IdMap, items: IdMap): string =>
  to === BACK_TARGET || to === CLOSE_PANEL_TARGET ? to : (frames.get(to) ?? items.get(to) ?? to);

/** 流程里的跳转**只认 frame**（预览那条路就是这样：指到浮层部件是死链），所以不查部件表 */
const remapFrameTarget = (to: string, frames: IdMap): string =>
  to === BACK_TARGET || to === CLOSE_PANEL_TARGET ? to : (frames.get(to) ?? to);

const remapAction = (a: Action | undefined, frames: IdMap, items: IdMap): Action | undefined => {
  if (!a) return a;
  const to = remapTarget(a.to, frames, items);
  return to === a.to ? a : { ...a, to };
};

/** 一台机器里的引用：跳转只认 frame（预览那条路就是这样），"改别的部件"认部件 */
const remapMachine = (flow: PartFlow | undefined, frames: IdMap, items: IdMap): PartFlow | undefined => {
  if (!flow) return flow;
  let changed = false;
  const steps = flow.steps.map((st) => {
    if (!st.do?.length) return st;
    let touched = false;
    const actions = st.do.map((a) => {
      if (a.kind === "goto") {
        const to = remapFrameTarget(a.to, frames);
        if (to !== a.to) {
          touched = true;
          return { ...a, to };
        }
        return a;
      }
      if (a.kind === "look" && a.target) {
        const target = items.get(a.target) ?? a.target;
        if (target !== a.target) {
          touched = true;
          return { ...a, target };
        }
      }
      return a;
    });
    if (!touched) return st;
    changed = true;
    return { ...st, do: actions };
  });
  return changed ? { ...flow, steps } : flow;
};

/** 一张表里每一项都过一遍；一个都没动就把原对象还回去（没动过的机器照旧是它自己） */
const remapRecord = <T,>(record: Record<string, T> | undefined, map: (v: T) => T): Record<string, T> | undefined => {
  if (!record) return record;
  let changed = false;
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    const next = map(value);
    if (next !== value) changed = true;
    out[key] = next;
  }
  return changed ? out : record;
};

/**
 * 把一棵部件树里的引用重指到新 id 上 —— **只重指集合内的**
 *
 * 这是落地那一步的另一半：`placeScreens` 建出新屏与新部件 id，这里把写死的那些引用改过去。
 * 认不出来的一律原样留着（那是死链，由审计面板去报）；`back` / `close` 两个哨兵永远不动。
 *
 * 机器内部的东西一个都不碰：`flow` 的 `step.from/to` 是它自己的状态 id、`slotFlows` 的键是槽名，
 * 跟着机器一起走本来就自洽。
 */
export function remapRefs(it: Item, frames: IdMap, items: IdMap): Item {
  const action = remapAction(it.action, frames, items);
  const actions = remapRecord(it.actions, (a) => remapAction(a, frames, items)!);
  const flow = remapMachine(it.flow, frames, items);
  const slotFlows = remapRecord(it.slotFlows, (m) => remapMachine(m, frames, items)!);
  const shows = it.shows && items.has(it.shows) ? items.get(it.shows)! : it.shows;
  const children = remapTreeIfChanged(it.children, frames, items);
  const same =
    action === it.action &&
    actions === it.actions &&
    flow === it.flow &&
    slotFlows === it.slotFlows &&
    shows === it.shows &&
    children === it.children;
  if (same) return it;
  return {
    ...it,
    ...(action !== undefined ? { action } : undefined),
    ...(actions !== undefined ? { actions } : undefined),
    ...(flow !== undefined ? { flow } : undefined),
    ...(slotFlows !== undefined ? { slotFlows } : undefined),
    ...(shows !== undefined ? { shows } : undefined),
    ...(children !== undefined ? { children } : undefined),
  };
}

const remapTreeIfChanged = (kids: PlacedItem[] | undefined, frames: IdMap, items: IdMap): PlacedItem[] | undefined => {
  if (!kids) return kids;
  let changed = false;
  const out = kids.map((c) => {
    const next = remapRefs(c, frames, items) as PlacedItem;
    if (next !== c) changed = true;
    return next;
  });
  return changed ? out : kids;
};

/** 一串部件过一遍（落地的实例、以及每一屏复制出来的那些）。组里的部件在类型上只是 `Item`，
 *  位置是运行时带上的，所以这里不要求 `PlacedItem`。 */
export const remapTree = (items: Item[], frameMap: IdMap, itemMap: IdMap): Item[] =>
  remapTreeIfChanged(items as PlacedItem[], frameMap, itemMap)! as Item[];
