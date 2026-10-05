import type { Flow } from "./flow";

/**
 * 流程图的画布模型
 * ---------------------------------------------------------------------------
 * 流程图原本是"照着屏幕自动画出来的一张只读图"。现在它是一张**能改的图**：
 * 节点可以拖、可以换形状、可以自己加，改动存在本机。
 *
 * 两件事分开：
 *   · 从屏幕推导出来的图（`Flow`）是**底稿**，改了屏幕它跟着变；
 *   · 这里存的是**你在图上做的修改**（位置、形状、自己加的节点与连线）。
 * 底稿里没有的节点（自己加的）与底稿里没有的位置差异，都以这里为准。
 */

/** 常用流程形状。`process` 是最普通的长方形，其余按流程图惯例来 */
export type FlowShape =
  | "process"
  | "decision"
  | "terminator"
  | "data"
  | "document"
  | "database"
  | "manual"
  | "preparation"
  | "connector";

/** 每种形状在面板上叫什么、画成什么样 */
export const FLOW_SHAPES: { key: FlowShape; icon: string }[] = [
  { key: "process", icon: "crop_square" },
  { key: "decision", icon: "change_history" },
  { key: "terminator", icon: "stadium" },
  { key: "data", icon: "parallelogram" },
  { key: "document", icon: "description" },
  { key: "database", icon: "database" },
  { key: "manual", icon: "pan_tool_alt" },
  { key: "preparation", icon: "hexagon" },
  { key: "connector", icon: "circle" },
];

export type FlowBox = {
  id: string;
  /** 图上显示的文字 */
  label: string;
  shape: FlowShape;
  x: number;
  y: number;
  /** 从哪一屏推导来的；自己加的没有。有它就意味着"文字跟着屏幕走"，不存文本 */
  frameId?: string;
  /** 自己加的节点（作者写的字要留住） */
  custom?: boolean;
  /** 推导来的节点：这屏上有哪些可点的部件（只读） */
  note?: string;
};

export type FlowLink = {
  id: string;
  from: string;
  to: string;
  label: string;
};

export type FlowBoard = {
  boxes: FlowBox[];
  links: FlowLink[];
};

/**
 * 存下来的那份
 *
 * 比 `FlowBox` 少一个 `label`：从屏幕推导来的节点不存文字（文字现算），
 * 所以"存下来的盒子"允许没有名字。
 */
export type StoredBox = Omit<FlowBox, "label"> & { label?: string };
export type StoredBoard = { boxes: StoredBox[]; links: FlowLink[] };

export const FLOW_KEY = "m3e:flowchart";

/**
 * 一种形状的路径
 *
 * 都画在 w×h 的框里，节点因此可以随便换形状而不用重新排版。放在这里而不是组件里，
 * 是因为它是纯几何：谁来画都该是同一个形状，也方便直接测。
 *
 * 圆角一律用**显式的圆弧指令**（`A r r 0 0 1`，sweep 取 1），弦长也写清楚
 * （`H ${w - r}` 这样的终点）。曾经写成
 * `H ${w - r} A r r 0 0 1 ${w - r} ${h - 1}`：那个圆弧的弦是**竖着**的（从
 * (w-r,1) 到 (w-r,h-1)），鼓出来的方向朝形状内部 —— 于是最上面那几十像素
 * 根本没有横边，看上去就是"上下被削平了"。
 */
export function shapePath(shape: FlowShape, w: number, h: number): string {
  /* 长方形就是**长方形**：流程图里"步骤"是个方框，圆角只做一点点软化。
     原来取 min(h/3, 14)，在 64 高的节点上四角各吃掉 14px、两侧只剩 36px 直边，
     整块看上去就是个药丸（和"圆头"分不出来）。圆头才该是半圆。 */
  const r = Math.max(1, Math.min(6, h / 6));
  const st = Math.max(1, h / 2);
  const notch = Math.max(4, Math.min(w / 5, 14));
  const top = 1;
  const bot = h - 1;
  /**
   * 圆角矩形：四条直边 + 四段 90° 圆弧，圆角不让超过半高
   *
   * 这是教科书式的画法（直边走到圆角起点，再一段 `A r r 0 0 1` 转过去），
   * 半径 `r ≤ h/2`，因此永远不可能出现"弦比直径还长"的非法圆弧 ——
   * 之前直接把半径写成 `h/2` 再连一条横穿整个框的弦，渲染器只能把半径
   * 按比例放大，两端的半圆就被拉歪、鼓出一个角。
   */
  const rounded = (rWanted: number) => {
    const r = Math.max(1, Math.min(rWanted, h / 2, w / 2));
    return (
      `M ${r} ${top} H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${top + r}` +
      ` V ${bot - r} A ${r} ${r} 0 0 1 ${w - r - r} ${bot}` +
      ` H ${r} A ${r} ${r} 0 0 1 1 ${bot - r}` +
      ` V ${top + r} A ${r} ${r} 0 0 1 ${r} ${top} Z`
    );
  };
  /**
   * 首尾都是完整半圆的"体育场"（圆头）
   *
   * 半径取 `h/2` 时两端的半圆鼓出 `h/2`，整条要 `w ≥ h` 才装得下。
   * 装不下就按宽度把两端的半椭圆压扁（rx = w/2 - 1），仍是左右对称的胶囊，
   * 不会出现一边鼓一边瘪。
   *
   * 用三次贝塞尔画半圆弧：控制点取 `4/3·(√2−1)·r ≈ 0.5523r`，
   * 弦长不足 `h/2` 时参数自动按比例缩小，所以框再矮也不会越界。
   */
  const stadiumCap = (want: number) => {
    const ry = Math.max(1, Math.min(want, h / 2 - 1, (w - 2) / 2));
    const rx = Math.max(1, Math.min(ry, w / 2 - 1));
    const kx = (4 / 3) * (Math.SQRT2 - 1) * rx;
    const ky = (4 / 3) * (Math.SQRT2 - 1) * ry;
    const cy = h / 2;
    return (
      `M ${rx} ${top} H ${w - rx}` +
      ` C ${w - rx + kx} ${top} ${w - 1} ${cy - ky} ${w - 1} ${cy}` +
      ` C ${w - 1} ${cy + ky} ${w - rx + kx} ${bot} ${w - rx} ${bot}` +
      ` H ${rx}` +
      ` C ${rx - kx} ${bot} 1 ${cy + ky} 1 ${cy}` +
      ` C 1 ${cy - ky} ${rx - kx} ${top} ${rx} ${top} Z`
    );
  };
  switch (shape) {
    case "decision":
      return `M ${w / 2} ${top} L ${w - 1} ${h / 2} L ${w / 2} ${bot} L 1 ${h / 2} Z`;
    case "terminator":
      return stadiumCap(st);
    case "data":
      return `M ${notch} ${top} H ${w - 1} L ${w - notch} ${bot} H 1 Z`;
    case "document":
      /* 下面是波浪边：两段曲线接起来，最低点回到 h-1 之内 */
      return (
        `M ${r} ${top} H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${top + r} V ${h - 12} ` +
        `C ${w * 0.7} ${h - 1} ${w * 0.3} ${h - 20} 1 ${h - 11} ` +
        `V ${top + r} A ${r} ${r} 0 0 1 ${r} ${top} Z`
      );
    case "database": {
      /* 圆柱：顶上一整段椭圆弧，两侧直边，底面用一段向下鼓的弧 */
      const rx = (w - 2) / 2;
      const ry = Math.min(h * 0.2, h / 4);
      const b0 = h * 0.3;
      const b1 = h - 1 - ry;
      return (
        `M 1 ${b0} A ${rx} ${ry} 0 1 1 ${w - 1} ${b0} ` +
        `V ${b1} A ${rx} ${ry} 0 0 1 1 ${b1} Z`
      );
    }
    case "manual":
      /* 上边斜一点：手工操作 */
      return `M 1 ${h * 0.24} H ${w - 1} V ${bot} H 1 Z`;
    case "preparation":
      return `M ${notch * 1.6} ${top} H ${w - notch * 1.6} L ${w - 1} ${h / 2} L ${w - notch * 1.6} ${bot} H ${notch * 1.6} L 1 ${h / 2} Z`;
    case "connector": {
      /* 连接点就是个圆：取能放进框里的最大半径（小图标里会更圆） */
      const rad = Math.min(w / 2 - 1, h / 2 - 1);
      const cx = w / 2;
      const cy = h / 2;
      /* 四段 1/4 弧：两段 180° 弧的弦长是 0，是退化情形，各家渲染器处理不一 */
      return (
        `M ${cx - rad} ${cy} A ${rad} ${rad} 0 0 1 ${cx} ${cy - rad} ` +
        `A ${rad} ${rad} 0 0 1 ${cx + rad} ${cy} ` +
        `A ${rad} ${rad} 0 0 1 ${cx} ${cy + rad} ` +
        `A ${rad} ${rad} 0 0 1 ${cx - rad} ${cy} Z`
      );
    }
    case "process":
    default:
      return rounded(r);
  }
}
export const NODE_W = 180;
export const NODE_H = 64;
export const COL_GAP = 80;
export const ROW_GAP = 30;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const SHAPES = new Set(FLOW_SHAPES.map((s) => s.key));

const readShape = (v: unknown): FlowShape => (typeof v === "string" && SHAPES.has(v as FlowShape) ? (v as FlowShape) : "process");

/**
 * 读回流程图
 *
 * 只读回**作者改的那部分**：位置、形状、自己加的节点与连线。
 * 从屏幕推导来的节点，它的名字与说明**不存**：那是从屏幕现算的，
 * 存下来的话就会冻在写它时的那门语言里 —— 界面切成中文，图上还是日文。
 */
export function loadBoard(storage: Storage | undefined): FlowBoard | null {
  try {
    const raw = storage?.getItem(FLOW_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!isRecord(v) || !Array.isArray(v.boxes)) return null;
    const boxes: FlowBox[] = [];
    for (const b of v.boxes) {
      /* 名字可以没有：推导来的节点不存文字 */
      if (!isRecord(b) || typeof b.id !== "string") continue;
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      boxes.push({
        id: b.id,
        /* 推导来的节点不存文字；这里先留空，合并时用现算的那份补上 */
        label: typeof b.label === "string" ? b.label : "",
        shape: readShape(b.shape),
        x: Math.round(Number(b.x)),
        y: Math.round(Number(b.y)),
        ...(typeof b.frameId === "string" ? { frameId: b.frameId } : undefined),
        ...(b.custom === true ? { custom: true } : undefined),
        ...(b.custom === true && typeof b.note === "string" ? { note: b.note } : undefined),
      });
    }
    if (boxes.length === 0) return null;
    const ids = new Set(boxes.map((b) => b.id));
    const links: FlowLink[] = [];
    if (Array.isArray(v.links)) {
      for (const l of v.links) {
        if (!isRecord(l) || typeof l.from !== "string" || typeof l.to !== "string") continue;
        if (!ids.has(l.from) || !ids.has(l.to)) continue;
        links.push({ id: typeof l.id === "string" ? l.id : uid(), from: l.from, to: l.to, label: typeof l.label === "string" ? l.label : "" });
      }
    }
    return { boxes, links };
  } catch {
    return null;
  }
}

export function saveBoard(storage: Storage | undefined, board: FlowBoard) {
  try {
    /* 推导来的节点只留位置与形状：名字、说明都从屏幕现算，别冻在一种语言里 */
    const lean: StoredBoard = {
      links: board.links,
      boxes: board.boxes.map((b) =>
        b.custom
          ? { id: b.id, label: b.label, shape: b.shape, x: b.x, y: b.y, custom: true as const, ...(b.note ? { note: b.note } : undefined) }
          : { id: b.id, shape: b.shape, x: b.x, y: b.y, ...(b.frameId ? { frameId: b.frameId } : undefined) },
      ),
    };
    storage?.setItem(FLOW_KEY, JSON.stringify(lean));
  } catch {}
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * 从屏幕推导出的底稿做成一张初始图
 *
 * 位置取分层布局（和原来那张只读图一样），形状按它本来的身份给：
 * 弹框给 `process`（它是"弹出来的东西"而不是判断），屏幕给 `terminator`
 * —— 一个屏幕是流程的起点/终点那种分量，长方形留给中间的步骤。
 */
export function boardFromFlow(flow: Flow, at: Map<string, { x: number; y: number }>): FlowBoard {
  const boxes: FlowBox[] = flow.nodes.map((n) => {
    const p = at.get(n.id);
    return {
      id: n.id,
      label: n.label,
      shape: n.kind === "popup" ? "process" : "terminator",
      x: Math.round(p?.x ?? 0),
      y: Math.round(p?.y ?? 0),
      frameId: n.id,
      note: n.description,
    };
  });
  const links: FlowLink[] = flow.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, label: e.label }));
  return { boxes, links };
}

/**
 * 把存下来的改动贴回"从屏幕现算的图"上
 *
 * 推导来的节点：位置与形状取存的那份，名字与说明取新算的（因此跟着界面语言）；
 * 已经不在屏幕里的节点：去掉；作者自己加的那些：原样留着。
 */
export function mergeBoard(fresh: FlowBoard, saved: FlowBoard): FlowBoard {
  const freshById = new Map(fresh.boxes.map((b) => [b.id, b]));
  const boxes: FlowBox[] = [];
  for (const s of saved.boxes) {
    const now = freshById.get(s.id);
    if (s.custom) {
      boxes.push(s);
      continue;
    }
    /* 屏幕已经没了：这一格也就不该再留着 */
    if (!now) continue;
    boxes.push({ ...now, shape: s.shape, x: s.x, y: s.y });
  }
  /* 新出现的屏幕（作者又加了页）：补在图里，位置排到下面 */
  const kept = new Set(boxes.map((b) => b.id));
  let extra = 0;
  for (const b of fresh.boxes) {
    if (kept.has(b.id)) continue;
    boxes.push({ ...b, x: b.x, y: b.y + extra++ * (NODE_H + ROW_GAP) });
  }
  const ids = new Set(boxes.map((b) => b.id));
  return { boxes, links: fresh.links.filter((l) => ids.has(l.from) && ids.has(l.to)) };
}

/** 自己加一个步骤：放在给定位置的右侧，名字给个默认的 */
export function addBox(board: FlowBoard, label: string, x: number, y: number): FlowBoard {
  return { ...board, boxes: [...board.boxes, { id: uid(), label, shape: "process", x: Math.round(x), y: Math.round(y), custom: true }] };
}

export function moveBox(board: FlowBoard, id: string, x: number, y: number): FlowBoard {
  return { ...board, boxes: board.boxes.map((b) => (b.id === id ? { ...b, x: Math.round(x), y: Math.round(y) } : b)) };
}

export function restyleBox(board: FlowBoard, id: string, shape: FlowShape): FlowBoard {
  return { ...board, boxes: board.boxes.map((b) => (b.id === id ? { ...b, shape } : b)) };
}

export function renameBox(board: FlowBoard, id: string, label: string): FlowBoard {
  return { ...board, boxes: board.boxes.map((b) => (b.id === id ? { ...b, label } : b)) };
}

/** 删掉一个节点时，连着它的线也一起走 —— 留半截线没有意义 */
export function removeBox(board: FlowBoard, id: string): FlowBoard {
  return { boxes: board.boxes.filter((b) => b.id !== id), links: board.links.filter((l) => l.from !== id && l.to !== id) };
}

/** 连一条线；同一个方向上已经有一条就不重复连 */
export function connect(board: FlowBoard, from: string, to: string, label = ""): FlowBoard {
  if (from === to || board.links.some((l) => l.from === from && l.to === to)) return board;
  return { ...board, links: [...board.links, { id: uid(), from, to, label }] };
}

export const boxById = (board: FlowBoard, id: string | null): FlowBox | undefined => (id ? board.boxes.find((b) => b.id === id) : undefined);

/**
 * 整张图的包围盒，以及"原点要往左上挪多少"
 *
 * 两件事：
 *  1. 图的四周留出 `pad`，拖到边上也不贴住边框；
 *  2. 图比可见区域小的时候至少撑到 `minW`/`minH` —— 不然背景铺不满，
 *     右边的边框落在可视区之外，看起来就像被截掉。
 *
 * `ox`/`oy` 是负数或零：节点按它平移，于是"最左最上都留得住净空"。
 */
export function boardBounds(board: FlowBoard, pad = 60, minW = 0, minH = 0) {
  if (board.boxes.length === 0) return { w: Math.max(640, minW), h: Math.max(480, minH), ox: 0, oy: 0 };
  const l = Math.min(...board.boxes.map((b) => b.x));
  const t = Math.min(...board.boxes.map((b) => b.y));
  const r = Math.max(...board.boxes.map((b) => b.x + NODE_W));
  const b = Math.max(...board.boxes.map((b) => b.y + NODE_H));
  const ox = Math.min(0, l - pad);
  const oy = Math.min(0, t - pad);
  return { w: Math.max(r + pad, minW) - ox, h: Math.max(b + pad, minH) - oy, ox, oy };
}
