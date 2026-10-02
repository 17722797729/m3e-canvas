import { describe, expect, it } from "vitest";
import { Group, PlacedItem } from "./tokens";
import {
  BUILTIN_TEMPLATES,
  QQ_FARM,
  Template,
  allTemplates,
  blankScreen,
  captureGroups,
  loadTemplates,
  restoreGroups,
  saveTemplates,
  screenCount,
  screensOf,
} from "./templates";

const placed = (id: string, x: number, y: number): PlacedItem =>
  ({ id, kind: "button", label: id, icon: null, variant: "filled", x, y }) as PlacedItem;

/* 画布上的连排组：部件坐标相对组原点 */
const runGroup = (): Group => ({
  id: "g1",
  frameId: "f1",
  x: 100,
  y: 200,
  axis: "x",
  items: [placed("a", 0, 0), placed("b", 60, 0)],
});

const freeGroup = (): Group => ({
  id: "g2",
  frameId: "f1",
  x: 10,
  y: 20,
  axis: "x",
  free: true,
  pos: { c: { x: -5, y: 0 } },
  items: [placed("c", 0, 0)],
});

describe("QQ 农场内置模板", () => {
  /* 屏幕数量由 scripts/make-template.mjs 从真实画布导入，测试不钉死数字 */
  it("有屏幕，且屏幕上确实摆着东西", () => {
    expect(QQ_FARM.builtin).toBe(true);
    expect(screenCount(QQ_FARM)).toBeGreaterThan(1);
    expect(QQ_FARM.screens.groups.length).toBeGreaterThan(0);
    /* 绝大多数屏幕要有内容；空的那一两个是作者自己留着的空屏（构建时画布上就是空的），
       不为它们编造内容，但也不能整份模板都空 */
    const filled = QQ_FARM.screens.frames.filter((f) => QQ_FARM.screens.groups.some((g) => g.frameId === f.id)).length;
    expect(filled).toBeGreaterThanOrEqual(Math.ceil(screenCount(QQ_FARM) * 0.8));
  });

  it("组与部件都认得自己的屏幕，没有落到画布外面的", () => {
    const ids = new Set(QQ_FARM.screens.frames.map((f) => f.id));
    for (const g of QQ_FARM.screens.groups) {
      expect(g.frameId && ids.has(g.frameId)).toBe(true);
      expect(g.items.length).toBeGreaterThan(0);
    }
  });

  it("本地覆盖会顶掉内置那一条，位置仍按内置的排", () => {
    const mine: Template[] = [{ id: "qq-farm", name: "QQ 农场", at: 5, custom: true, screens: blankScreen() as unknown as Template["screens"] }];
    const all = allTemplates(mine);
    /* 内置那条不再单独出现，只剩本地这份 */
    expect(all.filter((t) => t.id === "qq-farm")).toHaveLength(1);
    /* 覆盖来的仍然算内置：删不掉，只能再存一次 */
    expect(all[0].builtin).toBe(true);
    expect(all[0].custom).toBe(true);
  });

  it("内置模板排在自建模板前面，也删不掉", () => {
    const mine: Template[] = [{ id: "mine", name: "我的", screens: { frames: [], groups: [] } as unknown as Template["screens"] }];
    const all = allTemplates(mine);
    expect(all[0]).toBe(QQ_FARM);
    expect(all[all.length - 1].id).toBe("mine");
    expect(allTemplates([]).every((t) => t.builtin)).toBe(true);
    expect(BUILTIN_TEMPLATES.map((t) => t.id)).toContain("qq-farm");
  });
});

describe("套用模板", () => {
  it("每次取用都克隆一份、换上新 id：同一个模板放两次不该打架", () => {
    const once = screensOf(QQ_FARM);
    const twice = screensOf(QQ_FARM);
    expect(once.frames).toHaveLength(screenCount(QQ_FARM));
    const ids = new Set([...once.frames, ...once.groups, ...twice.frames].map((x) => x.id));
    expect(ids.size).toBe(once.frames.length + once.groups.length + twice.frames.length);
    /* 屏幕换了 id，组上的归属也要跟着换，否则组会掉到画布外面 */
    for (const g of once.groups) {
      expect(once.frames.some((f) => f.id === g.frameId)).toBe(true);
    }
  });

  it("恢复成画布坐标：连排组的部件回到相对组原点的位置", () => {
    const captured = captureGroups([runGroup()]);
    /* 存进模板时统一成全局坐标 */
    expect(captured[0].x).toBe(100);
    expect(captured[0].items.map((i) => i.x)).toEqual([100, 160]);
    /* 摆回画布时再减回去 */
    const back = restoreGroups(captured);
    expect(back[0].x).toBe(100);
    expect((back[0].items as PlacedItem[]).map((i) => i.x)).toEqual([0, 60]);
  });

  it("手摆的组本来就各带偏移，原样带走", () => {
    const captured = captureGroups([freeGroup()]);
    expect(captured[0].items[0].x).toBe(0);
    expect(captured[0].pos).toEqual({ c: { x: -5, y: 0 } });
    const back = restoreGroups(captured);
    expect((back[0].items as PlacedItem[])[0].x).toBe(0);
    expect(back[0].pos).toEqual({ c: { x: -5, y: 0 } });
  });
});

describe("新增模板之后从空白屏幕开始", () => {
  it("空白屏幕就是一屏、没有部件", () => {
    const fresh = blankScreen();
    expect(fresh.frames).toHaveLength(1);
    expect(fresh.groups).toHaveLength(0);
    expect(fresh.frames[0].w).toBe(412);
  });
});

describe("模板的存取", () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
    };
  };

  const withStorage = <T>(fn: () => T): T => {
    const real = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: memory(), configurable: true });
    try {
      return fn();
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: real, configurable: true });
    }
  };

  it("存进去再读回来，屏幕与组都还在", () => {
    withStorage(() => {
      const mine: Template[] = [
        { id: "t1", name: "卡牌游戏", at: 100, screens: { frames: [{ id: "f", name: "首页", x: 0, y: 0 }], groups: captureGroups([runGroup()]) } },
      ];
      saveTemplates(mine);
      const back = loadTemplates();
      expect(back).toHaveLength(1);
      expect(back[0].name).toBe("卡牌游戏");
      expect(back[0].screens.groups[0].items).toHaveLength(2);
    });
  });

  it("坏的存档不会把面板弄崩", () => {
    withStorage(() => {
      localStorage.setItem("m3e:templates", "{ not json");
      expect(loadTemplates()).toEqual([]);
      localStorage.setItem("m3e:templates", JSON.stringify([{ name: "" }, { screens: {} }, null, 7]));
      expect(loadTemplates()).toEqual([]);
      /* 一份只有屏幕、没有任何组的模板是合法的：那正是「全新的空白屏幕」 */
      localStorage.setItem(
        "m3e:templates",
        JSON.stringify([{ id: "ok", name: "空的", screens: { frames: [{ id: "f", name: "首页", x: 0, y: 0 }], groups: [] } }]),
      );
      expect(loadTemplates().map((t) => t.name)).toEqual(["空的"]);
    });
  });

  it("自己建的从新到旧排", () => {
    withStorage(() => {
      saveTemplates([
        { id: "old", name: "旧的", at: 1, screens: blankScreen() as unknown as Template["screens"] },
        { id: "new", name: "新的", at: 9, screens: blankScreen() as unknown as Template["screens"] },
      ]);
      expect(loadTemplates().map((t) => t.id)).toEqual(["new", "old"]);
    });
  });
});
