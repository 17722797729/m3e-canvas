/**
 * 市场组件的本地形态
 * ---------------------------------------------------------------------------
 * 后端的组件数据就是 m3e-canvas 的文档片段：{ w, h, items }，
 * 和作者在「添加为组合组件」时存下的 CustomPart 是同一个形状，
 * 所以市场组件落到画布上、落到组件面板里，走的都是组合组件那条已有的路。
 */

import {
  CATEGORIES,
  Category,
  CustomPart,
  GAP,
  Group,
  Item,
  PlacedItem,
  foldPlace,
  layoutOf,
  sizeOf,
} from "./tokens";
import { isPlacedItem } from "./project";
import type { ComponentTypeCode, MarketComponent, MyComponent } from "./syai";

/** 组件类型编码 ↔ 本地组件面板分类。顺序与后端 MarketComponentTypeEnum 一致。 */
const CATEGORY_OF: Record<ComponentTypeCode, Category> = {
  1: "actions",
  2: "navigation",
  3: "containment",
  4: "inputs",
  5: "content",
  6: "progress",
  7: "features",
};

export const CATEGORY_BY_CODE: Record<number, Category> = CATEGORY_OF;

/** 本地分类 → 组件类型编码，上传时用它把默认类型对上 */
export const CODE_OF_CATEGORY: Record<string, ComponentTypeCode> = Object.fromEntries(
  (Object.entries(CATEGORY_OF) as [string, Category][]).map(([code, category]) => [
    category,
    Number(code) as ComponentTypeCode,
  ]),
) as Record<string, ComponentTypeCode>;

/** 组件类型名，后端 type-list 还没回来时的兜底 */
export const TYPE_FALLBACK: Record<ComponentTypeCode, string> = {
  1: "操作",
  2: "导航",
  3: "容器",
  4: "输入",
  5: "内容",
  6: "进度",
  7: "功能",
};

export const TYPE_CODES: ComponentTypeCode[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * 一个组在组件数据里的样子
 *
 * 与编辑器里的 Group 同构，只少了一个 id：位置是相对组件左上角算好的，
 * 连排组因此还是连排组 —— 圆角、间距、折叠都和画布上一模一样。
 */
export interface SerializedGroup {
  x: number;
  y: number;
  axis: "x" | "y";
  /** 自由摆放的组：每个部件自己带偏移 */
  free?: boolean;
  pos?: Record<string, { x: number; y: number }>;
  items: PlacedItem[];
}

/** 上传时一起存下来的「原屏幕」：详情里照着它复现上传前的那一屏 */
export interface ScreenData {
  /** 屏幕名称 */
  name: string;
  /** 屏幕尺寸 */
  w: number;
  h: number;
  /** 屏幕底色 */
  bg?: string;
  /** 屏幕里的组，坐标已经相对屏幕左上角 */
  groups: SerializedGroup[];
}

/** 一个市场组件的数据解出来的本地形态 */
export interface MarketPart {
  part: CustomPart;
  w: number;
  h: number;
  /**
   * 上传前的那一屏（连同里面的组件）：详情页照着它画，所以预览里看到的就是上传前看到的。
   * 旧数据没有这一项，详情就只能画组件自己。
   */
  screen?: ScreenData;
  /** 紧凑包围盒里的这些组，按画布上的同一套几何画出来 */
  groups: Group[];
  /** 旧的扁平形态：逐个组件按绝对位置摆（没有组结构可依时用它） */
  items: PlacedItem[];
  /**
   * 这份组件在源屏幕上的实测宽度：按钮、标签片这类按文字量宽的部件靠它保持原样。
   * 旧版本上传的组件没有这一项，预览时回落到组件盒子的宽度。
   */
  widths?: Record<string, number>;
}

/** 一组内容在画布上占的那块地方：自由组用自己的偏移，连排组沿轴排开 */
export function groupExtent(
  g: Group,
  widths: Record<string, number>,
): { l: number; t: number; r: number; b: number } | null {
  if (g.free) {
    const placed = layoutOf(g, widths);
    if (placed.length === 0) return null;
    return {
      l: Math.min(...placed.map((p) => p.x)),
      t: Math.min(...placed.map((p) => p.y)),
      r: Math.max(...placed.map((p) => p.x + p.w)),
      b: Math.max(...placed.map((p) => p.y + p.h)),
    };
  }
  let off = 0;
  let r = g.x;
  let b = g.y;
  for (const it of g.items) {
    const sz = sizeOf(it, widths);
    /* 折叠的导航部件会被挪到它的按钮所在的角落，量边界时要一起算上 */
    const f = foldPlace(it, widths);
    r = Math.max(r, g.x + off + f.dx + sz.w);
    b = Math.max(b, (g.axis === "x" ? g.y : g.y + off) + f.dy + sz.h);
    off += (g.axis === "x" ? sz.w : sz.h) + GAP;
  }
  return { l: g.x, t: g.y, r, b };
}

/** 造一个只用来画图的 Group：id 只用于 React 的 key，不参与数据 */
const groupOf = (g: SerializedGroup, index: number): Group => ({
  id: g.items[0]?.id ? `g-${g.items[0].id}` : `g-${index}`,
  x: g.x,
  y: g.y,
  axis: g.axis,
  ...(g.free ? { free: true as const } : undefined),
  ...(g.pos ? { pos: g.pos } : undefined),
  items: g.items,
});

/** 把一组组数据读成可以画的组；读不动就返回空，让调用方回落到扁平形态 */
function readGroups(value: unknown): Group[] {
  if (!Array.isArray(value)) return [];
  const out: Group[] = [];
  value.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    if (!Array.isArray(raw.items) || raw.items.length === 0) return;
    if (raw.axis !== "x" && raw.axis !== "y") return;
    if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return;
    const items = raw.items.filter(isPlacedItem) as PlacedItem[];
    if (items.length === 0) return;
    const pos: Record<string, { x: number; y: number }> = {};
    if (isRecord(raw.pos)) {
      for (const [id, at] of Object.entries(raw.pos)) {
        if (isRecord(at) && Number.isFinite(at.x) && Number.isFinite(at.y)) pos[id] = { x: Number(at.x), y: Number(at.y) };
      }
    }
    out.push(
      groupOf(
        {
          x: Number(raw.x),
          y: Number(raw.y),
          axis: raw.axis,
          ...(raw.free ? { free: true } : undefined),
          ...(Object.keys(pos).length ? { pos } : undefined),
          items,
        },
        index,
      ),
    );
  });
  return out;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * 解析组件数据。市场里的组件可能是别的版本的编辑器上传的，
 * 这里只认自己画得出来的部分：结构不对就整体拒掉，免得一块坏数据把画布拖垮。
 */
export function parseMarketData(data: string | undefined | null): MarketPart | null {
  if (!data) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;

  const w = Number(raw.w);
  const h = Number(raw.h);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;

  /* 原屏幕是可选的：有它才画得出「上传前那一屏」 */
  let screen: ScreenData | undefined;
  if (isRecord(raw.screen)) {
    const sw = Number(raw.screen.w);
    const sh = Number(raw.screen.h);
    const screenGroups = readGroups(raw.screen.groups);
    if (Number.isFinite(sw) && Number.isFinite(sh) && sw > 0 && sh > 0 && screenGroups.length > 0) {
      screen = {
        name: typeof raw.screen.name === "string" ? raw.screen.name : "",
        w: Math.round(sw),
        h: Math.round(sh),
        ...(typeof raw.screen.bg === "string" ? { bg: raw.screen.bg } : undefined),
        groups: screenGroups.map((g) => ({
          x: g.x,
          y: g.y,
          axis: g.axis,
          ...(g.free ? { free: true as const } : undefined),
          ...(g.pos ? { pos: g.pos } : undefined),
          items: g.items as PlacedItem[],
        })),
      };
    }
  }

  /* 新形态是一组组存的（连排组因此还在）；老形态只有一个扁平的 items */
  const groups = readGroups(raw.groups);
  const items = Array.isArray(raw.items) ? (raw.items.filter(isPlacedItem) as PlacedItem[]) : [];
  if (groups.length === 0 && items.length === 0) return null;

  /* 实测宽度表是可选的：它只影响测量部件的宽度，读不出来就当没有 */
  const widths: Record<string, number> = {};
  if (isRecord(raw.widths)) {
    for (const [id, value] of Object.entries(raw.widths)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) widths[id] = value;
    }
  }

  const round = Math.round;
  return {
    w: round(w),
    h: round(h),
    groups,
    items,
    ...(screen ? { screen } : undefined),
    ...(Object.keys(widths).length ? { widths } : undefined),
    part: {
      id: "",
      name: "",
      w: round(w),
      h: round(h),
      items: items.length ? items : (groups.flatMap((g) => g.items) as PlacedItem[]),
    },
  };
}

/**
 * 把组件数据变成可以放进组件面板的组合组件；id 与名称由调用方决定
 *
 * `source` 记下来源：市场组件的编号。面板据此把它算进「已加入的组件」，
 * 而不是和作者自己存的组合组件混成一个「我的组件」。
 */
export function partOf(
  data: string | undefined | null,
  id: string,
  name: string,
  source?: string | number,
): CustomPart | null {
  const parsed = parseMarketData(data);
  if (!parsed) return null;
  return { ...parsed.part, id, name, ...(source !== undefined ? { source } : undefined) };
}

/** 这一份是市场里加来的，还是作者自己在画布上存下来的 */
export const isJoinedPart = (part: CustomPart): boolean =>
  part.source !== undefined && part.source !== "mine";

/**
 * 上传时打包组件数据
 * ---------------------------------------------------------------------------
 * `w`/`h` 是**组件自己的紧凑包围盒**，不是屏幕大小 —— 一个 60×76 的格子框上传后
 * 就该是 60×76，市场里、落到别人画布上时都不该拖着一整屏的空白。
 *
 * `groups` 保留组的结构，连排的按钮/列表项在市场里仍然是连排的（圆角与间距不走样）；
 * `items` 仍然写一份扁平的，好让读旧格式的版本也能画出东西。
 */
export const packData = (
  groups: SerializedGroup[],
  size: { w: number; h: number },
  widths?: Record<string, number>,
  screen?: ScreenData,
): string =>
  JSON.stringify({
    w: size.w,
    h: size.h,
    groups,
    items: groups.flatMap((g) => g.items),
    /* 原屏幕：详情页用它复现「上传前的那一屏」 */
    ...(screen && screen.groups.length ? { screen } : undefined),
    ...(widths && Object.keys(widths).length ? { widths } : undefined),
  });

/** 组件在列表里的一行小字：作者名 */
export const authorOf = (component: MarketComponent | MyComponent): string => {
  const own = (component as MarketComponent).userName;
  const from = (component as MyComponent).sourceUserName;
  return own || from || "";
};

/** 下载量的显示：过千折成 1.2k，过万折成 1.2w，列表里省一列宽度 */
export const downloadText = (count: number | undefined): string => {
  const n = count ?? 0;
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}w`;
};

/** 组件面板里各节的中文名，用来给「加入我的组件」标出落点 */
export const CATEGORY_NAMES: Record<Category, string> = {
  actions: "操作",
  navigation: "导航",
  containment: "容器",
  inputs: "输入",
  content: "内容",
  progress: "进度",
  features: "功能",
};

export const categoryName = (category: Category): string => CATEGORY_NAMES[category];

/** 一个组件在组件面板里落在哪一节 */
export const categoryOf = (code: number): Category =>
  CATEGORY_OF[code as ComponentTypeCode] ?? "content";

/** 本地分类的图标，列表与「加入我的组件」用同一套 */
export const categoryIcon = (category: Category): string =>
  CATEGORIES.find((c) => c.key === category)?.icon ?? "widgets";

/** 时间戳的短展示：后端可能给毫秒数，也可能给日期串（如 "2026-09-30 12:05:00"） */
export function formatWhen(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(/^\d+$/.test(value) ? Number(value) : value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 把一屏内容收成组件自己的紧凑包围盒
 * ---------------------------------------------------------------------------
 * 屏幕上的一屏是 412×892，可里面那个 60×76 的格子框才是要上传的东西。
 * 这里按编辑器画布的同一套几何（自由组、连排组、折叠位移）量出真正的边界，
 * 再把所有坐标平移到这个盒子的左上角 —— 组件的大小因此就是它自己占的那一块，
 * 落进市场、落到别人的画布上时都不会拖着一整块屏幕的空白。
 */
export function tightenGroups(
  groups: Group[],
  widths: Record<string, number>,
): { groups: SerializedGroup[]; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of groups) {
    const b = groupExtent(g, widths);
    if (!b) continue;
    minX = Math.min(minX, b.l);
    minY = Math.min(minY, b.t);
    maxX = Math.max(maxX, b.r);
    maxY = Math.max(maxY, b.b);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return { groups: [], w: 1, h: 1 };

  const dx = Math.round(minX);
  const dy = Math.round(minY);
  const shifted: SerializedGroup[] = groups.map((g) => {
    /* pos 里的偏移是相对组原点的（画布上算的是 g.x + pos.x），
       所以组整体挪了多远，pos 一分都不用改 */
    return {
      /* 取整：组件落在整数像素上，别处再画时不会有半像素的偏移 */
      x: Math.round(g.x - dx),
      y: Math.round(g.y - dy),
      axis: g.axis,
      ...(g.free ? { free: true as const } : undefined),
      ...(g.pos ? { pos: g.pos } : undefined),
      /* 折叠的导航部件在画布上被挪过一次：把这份位移写进坐标里，
         别处再画出来时就不会又挪一次 */
      items: (g.items as PlacedItem[]).map((it) => {
        const place = foldPlace(it, widths);
        return { ...it, x: it.x + place.dx, y: it.y + place.dy };
      }),
    };
  });

  return {
    groups: shifted,
    w: Math.max(1, Math.round(maxX - minX)),
    h: Math.max(1, Math.round(maxY - minY)),
  };
}
