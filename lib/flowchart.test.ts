import { describe, expect, it } from "vitest";
import { buildFlow } from "./flow";
import {
  FLOW_KEY,
  FLOW_SHAPES,
  FlowBoard,
  FlowShape,
  addBox,
  boardBounds,
  boardFromFlow,
  connect,
  loadBoard,
  mergeBoard,
  moveBox,
  removeBox,
  renameBox,
  restyleBox,
  saveBoard,
  shapePath,
} from "./flowchart";
import { Doc, Item, applySlotTransition } from "./tokens";

const doc = (): Doc =>
  ({
    title: "T", brief: "", paletteKey: "purple", frame: "phone",
    frames: [
      { id: "a", name: "首页", x: 0, y: 0, w: 412, h: 892 },
      { id: "b", name: "设置", x: 500, y: 0, w: 412, h: 892 },
    ],
    groups: [
      { id: "g1", frameId: "a", x: 20, y: 300, axis: "x", items: [{ id: "i1", kind: "button", label: "去设置", icon: null, variant: "filled", x: 0, y: 0, action: { kind: "goto", to: "b", transition: "none" } }] },
    ],
  }) as unknown as Doc;

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage;
};

const shaped = (): FlowBoard => {
  const flow = buildFlow(doc(), "zh");
  const at = new Map(flow.nodes.map((n, i) => [n.id, { x: 40, y: 40 + i * 100 }]));
  return boardFromFlow(flow, at);
};

describe("从屏幕推到一张能改的图", () => {
  it("每屏一个节点，位置按分层布局给，说明来自那一屏", () => {
    const b = shaped();
    expect(b.boxes).toHaveLength(2);
    expect(b.links.length).toBeGreaterThan(0);
    for (const box of b.boxes) {
      expect(box.note).toBeTruthy();
      expect(Number.isFinite(box.x) && Number.isFinite(box.y)).toBe(true);
    }
    /* 屏幕给圆头（起止的分量），弹框给长方形（一个步骤）：按推导出来的身份对号 */
    const flow = buildFlow(doc(), "zh");
    for (const node of flow.nodes) {
      expect(b.boxes.find((x) => x.id === node.id)?.shape).toBe(node.kind === "popup" ? "process" : "terminator");
    }
  });
});

describe("改图", () => {
  it("拖动只动那一个节点", () => {
    const b = shaped();
    const moved = moveBox(b, b.boxes[0].id, 300, 400);
    expect(moved.boxes[0]).toMatchObject({ x: 300, y: 400 });
    expect(moved.boxes[1]).toEqual(b.boxes[1]);
    expect(b.boxes[0].x).not.toBe(300);
  });

  it("换形状不动位置与连线", () => {
    const b = shaped();
    const next = restyleBox(b, b.boxes[0].id, "decision");
    expect(next.boxes[0].shape).toBe("decision");
    expect(next.boxes[0]).toMatchObject({ x: b.boxes[0].x, y: b.boxes[0].y });
    expect(next.links).toEqual(b.links);
  });

  it("改名不动别的", () => {
    const b = shaped();
    expect(renameBox(b, b.boxes[0].id, "新的名字").boxes[0].label).toBe("新的名字");
  });

  it("自己加一个步骤：默认是长方形，可以再换成别的", () => {
    const b = addBox(shaped(), "判断有没有登录", 200, 200);
    const added = b.boxes[b.boxes.length - 1];
    expect(added.shape).toBe("process");
    expect(restyleBox(b, added.id, "decision").boxes[b.boxes.length - 1].shape).toBe("decision");
  });

  it("删节点时连着它的线一起走", () => {
    const b = shaped();
    const gone = b.boxes[0].id;
    const next = removeBox(b, gone);
    expect(next.boxes.some((x) => x.id === gone)).toBe(false);
    expect(next.links.some((l) => l.from === gone || l.to === gone)).toBe(false);
  });

  it("连线：同一个方向不重复连，也不连自己", () => {
    const b = shaped();
    const [x, y] = b.boxes;
    const one = connect(removeBox(b, y.id), x.id, y.id, "是");
    expect(one.links).toHaveLength(1);
    expect(connect(one, x.id, y.id)).toBe(one);
    expect(connect(one, x.id, x.id)).toBe(one);
  });
});

describe("存与读", () => {
  it("存下来再读回来：改动（位置、形状、连线）还在", () => {
    const store = memory();
    const b = restyleBox(moveBox(shaped(), shaped().boxes[0].id, 321, 123), shaped().boxes[0].id, "database");
    saveBoard(store, b);
    const back = loadBoard(store);
    expect(back?.boxes).toHaveLength(b.boxes.length);
    expect(back?.boxes[0]).toMatchObject({ shape: "database", x: 321, y: 123 });
    expect(back?.links).toHaveLength(b.links.length);
    /* 名字是从屏幕现算的，不存 */
    expect(back?.boxes[0].label).toBe("");
  });

  it("没存过就是 null（按屏幕推导）", () => {
    expect(loadBoard(memory())).toBeNull();
  });

  it("坏存档不会把图弄丢", () => {
    const store = memory();
    store.setItem(FLOW_KEY, "{ 不是 json");
    expect(loadBoard(store)).toBeNull();
    store.setItem(FLOW_KEY, JSON.stringify({ boxes: [{ id: "x" }, null, 7] }));
    expect(loadBoard(store)).toBeNull();
    /* 线指向不存在的节点：那条线丢掉，节点还在 */
    store.setItem(FLOW_KEY, JSON.stringify({ boxes: [{ id: "a", label: "甲", x: 0, y: 0 }], links: [{ from: "a", to: "鬼" }] }));
    const back = loadBoard(store);
    expect(back?.boxes).toHaveLength(1);
    expect(back?.links).toHaveLength(0);
  });
});

describe("画布范围", () => {
  it("按节点撑开，拖到边上也不会被裁", () => {
    const b = moveBox(shaped(), shaped().boxes[0].id, 2000, 1500);
    const box = boardBounds(b);
    expect(box.w).toBeGreaterThan(2000);
    expect(box.h).toBeGreaterThan(1500);
  });

  it("图比可见区小的时候撑满它（否则右边框落在可视区外，看着像被截掉）", () => {
    const small: FlowBoard = { boxes: [{ id: "a", label: "甲", shape: "process", x: 100, y: 80 }], links: [] };
    const box = boardBounds(small, 60, 1400, 700);
    expect(box.w).toBe(1400);
    expect(box.h).toBe(700);
  });

  it("节点挪到负坐标时留出净空：原点是负数，节点整体右移", () => {
    const b: FlowBoard = { boxes: [{ id: "a", label: "甲", shape: "process", x: -300, y: -200 }], links: [] };
    const box = boardBounds(b, 60, 1400, 700);
    /* 原点挪到 -360/-260，于是最左的节点在画布上落在 60 处 */
    expect(box.ox).toBe(-360);
    expect(box.oy).toBe(-260);
    expect(box.w).toBeGreaterThanOrEqual(1400);
  });
});

describe("形状", () => {
  it("每种形状都不同：长方形与圆头不能长得一样", () => {
    const shapes: FlowShape[] = ["process", "decision", "terminator", "data", "document", "database", "manual", "preparation", "connector"];
    const paths = shapes.map((s) => shapePath(s, 180, 64));
    expect(new Set(paths).size).toBe(shapes.length);
    /* 长方形是"软化的直角"，圆头是整条半圆（半径 h/2），两者必须拉开 */
    expect(shapePath("process", 180, 64)).toContain("A 6 6");
    /* 圆头的两端是半圆（用三次贝塞尔画），不再有圆弧 —— 这里看它是否对称 */
    expect(shapePath("terminator", 180, 64)).toBe(shapePath("terminator", 180, 64));
    /* 小尺寸（面板里的示意图）也不能撞 */
    expect(shapePath("process", 18, 12)).toContain("A 2 2");
    expect(shapePath("terminator", 18, 12)).toContain("C ");
    /* 菱形是四个顶点连起来 */
    expect(shapePath("decision", 180, 64)).toBe("M 90 1 L 179 32 L 90 63 L 1 32 Z");
  });

  it("在小尺寸下也各不相同（面板里的示意图形）", () => {
    const shapes: FlowShape[] = ["process", "decision", "terminator", "data", "document", "database", "manual", "preparation", "connector"];
    expect(new Set(shapes.map((s) => shapePath(s, 18, 12))).size).toBe(shapes.length);
  });
});

describe("文字跟着语言走，改动留着", () => {
  const made = (label: string, note: string): FlowBoard => ({
    boxes: [{ id: "a", label, note, shape: "terminator", x: 10, y: 20, frameId: "a" }],
    links: [],
  });

  it("存的是「改动」而不是文字：推导来的节点不带名字与说明", () => {
    const store = memory();
    saveBoard(store, made("首页", "首页是一个页面"));
    const raw = JSON.parse(String(store.getItem(FLOW_KEY)));
    expect(raw.boxes[0].label).toBeUndefined();
    expect(raw.boxes[0].note).toBeUndefined();
    expect(raw.boxes[0]).toMatchObject({ id: "a", x: 10, y: 20, shape: "terminator" });
  });

  /* 这就是那个 bug：界面切成中文，图上还是写它时的日文 */
  it("换一门语言再看，名字与说明是新算的那份，位置形状还是我改的", () => {
    const saved = { boxes: [{ id: "a", label: "ホーム", shape: "decision" as const, x: 300, y: 400, frameId: "a" }], links: [] };
    const fresh = made("首页", "首页是一个页面");
    const merged = mergeBoard(fresh, saved);
    expect(merged.boxes[0].label).toBe("首页");
    expect(merged.boxes[0].note).toBe("首页是一个页面");
    expect(merged.boxes[0]).toMatchObject({ x: 300, y: 400, shape: "decision" });
  });

  it("自己加的节点：文字是作者写的，原样留着", () => {
    const saved: FlowBoard = { boxes: [{ id: "x", label: "等审核", shape: "process", x: 5, y: 6, custom: true }], links: [] };
    const merged = mergeBoard(made("首页", ""), saved);
    expect(merged.boxes.find((b) => b.id === "x")).toMatchObject({ label: "等审核", x: 5, y: 6 });
  });

  it("屏幕没了的节点去掉；屏幕新加的节点补上", () => {
    const saved: FlowBoard = { boxes: [{ id: "gone", label: "", shape: "process", x: 0, y: 0, frameId: "gone" }], links: [] };
    const fresh: FlowBoard = { boxes: [{ id: "new", label: "新页", shape: "terminator", x: 0, y: 0, frameId: "new" }], links: [] };
    const merged = mergeBoard(fresh, saved);
    expect(merged.boxes.map((b) => b.id)).toEqual(["new"]);
  });
});

describe("形状的横边要真的存在", () => {
  /**
   * 这就是那个"被削平"的 bug：圆角弧的弦竖错了方向，鼓出来的部分朝形状内部，
   * 于是最上面那几十像素没有横边 —— 长方形、圆头、文档都中招。
   * 判据很直接：从左上角附近往右扫，必须能一路扫到右上角附近都是"在形状里"。
   * 这里用路径文字来断言：`H` 的终点必须真的落在另一侧的圆角起点上。
   */
  it("长方形/圆头/文档的顶边从左边一直连到右边", () => {
    const w = 180;
    for (const [name, d] of [
      ["process", shapePath("process", w, 64)],
      ["terminator", shapePath("terminator", w, 64)],
      ["document", shapePath("document", w, 64)],
    ] as const) {
      /* 顶边必须是一条真正的横线：`M l 1 H r` 里的 r 明显靠右（不是贴着左边） */
      const m = d.match(/M ([\d.]+) 1 H ([\d.]+)/);
      expect(m, `${name} 没有顶边：${d.slice(0, 60)}`).toBeTruthy();
      const [, l, r] = m!;
      expect(Number(l)).toBeGreaterThanOrEqual(1);
      expect(Number(r), `${name} 的顶边太短`).toBeGreaterThan(w / 2);
      expect(Number(r)).toBeGreaterThan(Number(l));
    }
  });

  it("所有形状都落在 0..w / 0..h 之内（不再靠视口兜住越界）", () => {
    const w = 180;
    const h = 64;
    /**
     * 把路径里**真正画到的点**取出来：按命令逐个解析，圆弧命令只取终点
     * （`rx ry rot large sweep x y` 里前五个是参数，不是坐标）。直接对
     * 全部数字取极值是错的 —— 半径会被误当成坐标。
     */
    const points = (d: string): [number, number][] => {
      const out: [number, number][] = [];
      const re = /([MLHVCQAZ])([^MLHVCQAZ]*)/gi;
      let cur: [number, number] = [0, 0];
      for (const m of d.matchAll(re)) {
        const cmd = m[1].toUpperCase();
        const nums = (m[2].match(/-?[\d.]+/g) ?? []).map(Number);
        if (cmd === "M" || cmd === "L" || cmd === "T") {
          for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
          if (nums.length >= 2) cur = [nums[nums.length - 2], nums[nums.length - 1]];
        } else if (cmd === "H") for (const x of nums) out.push([x, cur[1]]);
        else if (cmd === "V") for (const y of nums) out.push([cur[0], y]);
        else if (cmd === "C") for (let i = 0; i + 5 < nums.length; i += 6) { out.push([nums[i], nums[i + 1]], [nums[i + 2], nums[i + 3]], [nums[i + 4], nums[i + 5]]); cur = [nums[i + 4], nums[i + 5]]; }
        else if (cmd === "Q") for (let i = 0; i + 3 < nums.length; i += 4) { out.push([nums[i], nums[i + 1]], [nums[i + 2], nums[i + 3]]); cur = [nums[i + 2], nums[i + 3]]; }
        else if (cmd === "A") for (let i = 0; i + 6 < nums.length; i += 7) { out.push([nums[i + 5], nums[i + 6]]); cur = [nums[i + 5], nums[i + 6]]; }
      }
      return out;
    };
    for (const s of ["process", "decision", "terminator", "data", "document", "database", "manual", "preparation", "connector"] as const) {
      const pts = points(shapePath(s, w, h));
      expect(pts.length, `${s} 没解析出点`).toBeGreaterThan(2);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      expect(Math.min(...xs), `${s} 左边越界`).toBeGreaterThanOrEqual(0);
      expect(Math.max(...xs), `${s} 右边越界`).toBeLessThanOrEqual(w);
      expect(Math.min(...ys), `${s} 上边越界`).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys), `${s} 下边越界`).toBeLessThanOrEqual(h);
    }
  });
});

describe("栏上的入场方式是每一格的模板", () => {
  const bar = (): Item =>
    ({
      id: "bar", kind: "bottomNav", label: "", icon: null, variant: "filled",
      tabs: [
        { icon: "inventory_2", label: "仓库" },
        { icon: "store", label: "商店" },
      ],
      action: { to: "page", transition: "none", dialog: true },
      actions: {
        "tab:0": { to: "a", transition: "slide", dialog: true },
        "tab:1": { to: "b", transition: "fade", dialog: true },
      },
    }) as unknown as Item;

  it("换成从底层滑入时，每一格都跟着改", () => {
    const patch = applySlotTransition(bar(), "slideUp");
    expect(patch.actions?.["tab:0"].transition).toBe("slideUp");
    expect(patch.actions?.["tab:1"].transition).toBe("slideUp");
    expect(patch.action?.transition).toBe("slideUp");
    /* 目标不能被动到 */
    expect(patch.actions?.["tab:0"].to).toBe("a");
    expect(patch.actions?.["tab:1"].to).toBe("b");
  });

  it("没有分格的普通部件：只改它自己", () => {
    const plain = { id: "b", kind: "button", label: "去", icon: null, variant: "filled", action: { to: "x", transition: "none" } } as unknown as Item;
    expect(applySlotTransition(plain, "slideUp").action?.transition).toBe("slideUp");
  });
});
