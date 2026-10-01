import { describe, expect, it } from "vitest";
import { KIND_SPEC, makeItem, type Group, type Kind, type PlacedItem } from "./tokens";
import {
  CATEGORY_BY_CODE,
  CODE_OF_CATEGORY,
  authorOf,
  categoryIcon,
  categoryName,
  categoryOf,
  downloadText,
  formatWhen,
  packData,
  parseMarketData,
  partOf,
  tightenGroups,
} from "./market";

const placed = (kind: Kind, x: number, y: number) => ({ ...makeItem(kind), x, y }) as PlacedItem;

/** 一个自由组：组里每个部件带自己的偏移 */
const freeGroup = (x: number, y: number, items: PlacedItem[]): Group => ({
  id: "g1",
  x,
  y,
  axis: "x",
  free: true,
  pos: Object.fromEntries(items.map((it) => [it.id, { x: it.x, y: it.y }])),
  items: items.map((it) => ({ ...it, x: 0, y: 0 })),
});

/** 一个连排组：部件沿轴排开，位置由组的位置决定 */
const runGroup = (x: number, y: number, items: PlacedItem[]): Group => ({
  id: "g2",
  x,
  y,
  axis: "x",
  items: items.map((it) => ({ ...it, x: 0, y: 0 })),
});

/* 组件数据是别的版本写下来、别的版本读回去的格式，所以形状要钉死：
 * { w, h, groups[], items[], widths? } —— groups 用来还原连排，items 是给旧版本读的扁平兜底。 */
const oneGroup = (at: { x: number; y: number }, items: PlacedItem[]) =>
  tightenGroups([freeGroup(at.x, at.y, items)], {});

describe("component data round-trip", () => {
  it("packs the tight size, the groups and the flat fallback", () => {
    const tight = oneGroup({ x: 176, y: 234 }, [placed("button", 0, 0)]);
    const json = JSON.parse(packData(tight.groups, { w: tight.w, h: tight.h }));
    expect(Object.keys(json).sort()).toEqual(["groups", "h", "items", "w"]);
    expect(json.groups).toHaveLength(1);
    expect(json.items).toHaveLength(1);
  });

  it("reads back the same geometry", () => {
    const items = [placed("button", 16, 24), placed("text", 16, 80)];
    const tight = oneGroup({ x: 176, y: 234 }, items);
    const read = parseMarketData(packData(tight.groups, { w: tight.w, h: tight.h }));
    expect(read).not.toBeNull();
    /* 组还在，圆角与连排因此不会丢 */
    expect(read!.groups).toHaveLength(1);
    expect(read!.groups[0].free).toBe(true);
    expect(read!.groups[0].pos).toMatchObject({
      [items[0].id]: { x: 16, y: 24 },
      [items[1].id]: { x: 16, y: 80 },
    });
  });

  it("hands the palette a composite part of the same size", () => {
    const tight = oneGroup({ x: 0, y: 0 }, [placed("button", 0, 0)]);
    const custom = partOf(packData(tight.groups, { w: tight.w, h: tight.h }), "market-7", "抽奖轮盘");
    expect(custom).toMatchObject({ id: "market-7", name: "抽奖轮盘", w: tight.w, h: tight.h });
  });

  it("refuses data this build cannot draw, rather than opening half of it", () => {
    expect(parseMarketData(null)).toBeNull();
    expect(parseMarketData("")).toBeNull();
    expect(parseMarketData("not json")).toBeNull();
    expect(parseMarketData("[]")).toBeNull();
    expect(parseMarketData(JSON.stringify({ w: 320, h: 200 }))).toBeNull();
    expect(parseMarketData(JSON.stringify({ w: 0, h: 200, items: [placed("button", 0, 0)] }))).toBeNull();
    expect(parseMarketData(JSON.stringify({ w: 320, h: 200, items: [] }))).toBeNull();
  });

  it("drops a group it cannot read and keeps the rest", () => {
    const mixed = parseMarketData(
      JSON.stringify({
        w: 320,
        h: 200,
        groups: [
          { x: 0, y: 0, axis: "x", items: [placed("button", 0, 0)] },
          { x: 0, y: 0, axis: "sideways", items: [placed("text", 0, 0)] },
          { x: 0, y: 0, axis: "x", items: [] },
        ],
      }),
    );
    expect(mixed!.groups).toHaveLength(1);
  });

  it("still reads the old flat shape", () => {
    const items = [placed("button", 10, 20)];
    const read = parseMarketData(JSON.stringify({ w: 200, h: 100, items }));
    expect(read).not.toBeNull();
    expect(read!.groups).toHaveLength(0);
    expect(read!.items[0]).toMatchObject({ kind: "button", x: 10, y: 20 });
  });

  it("carries the measured widths of the source screen", () => {
    const items = [placed("button", 0, 0)];
    const tight = oneGroup({ x: 0, y: 0 }, items);
    const json = packData(tight.groups, { w: tight.w, h: tight.h }, { [items[0].id]: 140 });
    expect(JSON.parse(json).widths).toEqual({ [items[0].id]: 140 });
    expect(parseMarketData(json)!.widths).toEqual({ [items[0].id]: 140 });
  });

  it("leaves the widths out when there are none, so the data keeps its old fields", () => {
    const tight = oneGroup({ x: 0, y: 0 }, [placed("button", 0, 0)]);
    expect(Object.keys(JSON.parse(packData(tight.groups, { w: tight.w, h: tight.h }))).sort()).toEqual([
      "groups",
      "h",
      "items",
      "w",
    ]);
  });

  /* 上传时把「上传前的那一屏」也存下来：详情里照着它画，就是上传前的样子 */
  it("carries the whole screen the component came from", () => {
    const tight = oneGroup({ x: 176, y: 234 }, [placed("button", 0, 0)]);
    const screen = {
      name: "首页",
      w: 412,
      h: 892,
      bg: "surface",
      groups: [
        { x: 0, y: 0, axis: "x" as const, items: [placed("topAppBar", 0, 0)] },
        { x: 24, y: 400, axis: "x" as const, items: [placed("button", 0, 0), placed("button", 0, 0)] },
      ],
    };
    const read = parseMarketData(packData(tight.groups, { w: tight.w, h: tight.h }, undefined, screen));
    expect(read!.screen).toMatchObject({ name: "首页", w: 412, h: 892, bg: "surface" });
    /* 屏幕里的组还在，连排不会散架 */
    expect(read!.screen!.groups).toHaveLength(2);
    expect(read!.screen!.groups[1].items).toHaveLength(2);
    /* 组件自己的紧凑包围盒仍然是它自己那一块，两者互不影响 */
    expect(read!.w).toBe(tight.w);
  });

  it("has no screen for data written before it was stored", () => {
    const tight = oneGroup({ x: 0, y: 0 }, [placed("button", 0, 0)]);
    expect(parseMarketData(packData(tight.groups, { w: tight.w, h: tight.h }))!.screen).toBeUndefined();
  });

  /* 宽度表是别的版本写下来的，读不动的条目直接丢掉，不能让一个坏数字把预览毁掉 */
  it("drops width entries this build cannot read", () => {
    const items = [placed("button", 0, 0)];
    const tight = oneGroup({ x: 0, y: 0 }, items);
    const raw = JSON.stringify({
      w: tight.w,
      h: tight.h,
      groups: tight.groups,
      widths: { [items[0].id]: 140, bad: "wide", nan: null },
    });
    expect(parseMarketData(raw)!.widths).toEqual({ [items[0].id]: 140 });
  });
});

/* 上传的组件要收成它自己占的那一块，而不是整块屏幕 ——
 * 屏幕是 412×892，一个 60×76 的格子框上传后就该是 60×76。 */
describe("the tight box an uploaded component is cut to", () => {
  it("cuts a part on a screen down to the part itself", () => {
    const items = [placed("iconButton", 0, 0), placed("text", 14, 60)];
    const tight = tightenGroups([freeGroup(176, 234, items)], {});
    /* 屏幕左上角那 176/234 的空白没有被带进来 */
    expect(tight.w).toBeLessThan(140);
    expect(tight.h).toBeLessThan(140);
    expect(tight.groups[0].x).toBe(0);
    expect(tight.groups[0].y).toBe(0);
    expect(tight.groups[0].pos).toMatchObject({ [items[0].id]: { x: 0, y: 0 } });
  });

  it("keeps a run's own arrangement, moved as a whole", () => {
    const items = [placed("button", 0, 0), placed("button", 0, 0), placed("button", 0, 0)];
    const tight = tightenGroups([runGroup(24, 400, items)], {});
    expect(tight.groups[0].x).toBe(0);
    expect(tight.groups[0].y).toBe(0);
    expect(tight.groups[0].axis).toBe("x");
    /* 三个按钮并排的宽度，加上两道 GAP */
    expect(tight.w).toBeGreaterThan(200);
    expect(tight.h).toBeLessThan(80);
  });

  it("takes the box around every group, not just the first", () => {
    const a = freeGroup(100, 100, [placed("button", 0, 0)]);
    const b = freeGroup(300, 500, [placed("button", 0, 0)]);
    const tight = tightenGroups([a, b], {});
    expect(tight.groups[0].x).toBe(0);
    expect(tight.groups[0].y).toBe(0);
    expect(tight.groups[1].x).toBe(200);
    expect(tight.groups[1].y).toBe(400);
  });

  it("rounds the box to whole pixels, so nothing lands off the 4dp grid", () => {
    const tight = tightenGroups([freeGroup(10.4, 20.6, [placed("button", 0, 0)])], {});
    expect(Number.isInteger(tight.w)).toBe(true);
    expect(Number.isInteger(tight.h)).toBe(true);
    expect(Number.isInteger(tight.groups[0].x)).toBe(true);
  });

  it("returns nothing for an empty screen", () => {
    expect(tightenGroups([], {}).groups).toHaveLength(0);
  });
});

describe("component types", () => {
  it("maps every type code the backend offers onto a palette category", () => {
    expect(Object.keys(CATEGORY_BY_CODE).map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const [code, category] of Object.entries(CATEGORY_BY_CODE)) {
      expect(categoryOf(Number(code))).toBe(category);
      expect(CODE_OF_CATEGORY[category]).toBe(Number(code));
      expect(categoryName(category)).not.toBe("");
      expect(categoryIcon(category)).not.toBe("");
    }
  });

  it("falls back to content for a code from a newer backend", () => {
    expect(categoryOf(99)).toBe("content");
  });
});

describe("what a market row shows", () => {
  it("prefers the uploader's name and falls back to the original author", () => {
    expect(authorOf({ userName: "炽鸦" } as never)).toBe("炽鸦");
    expect(authorOf({ sourceUserName: "炽鸦" } as never)).toBe("炽鸦");
    expect(authorOf({} as never)).toBe("");
  });

  it("shortens a download count once it stops fitting", () => {
    expect(downloadText(0)).toBe("0");
    expect(downloadText(undefined)).toBe("0");
    expect(downloadText(999)).toBe("999");
    expect(downloadText(1000)).toBe("1k");
    expect(downloadText(1200)).toBe("1.2k");
    expect(downloadText(10000)).toBe("1w");
    expect(downloadText(12345)).toBe("1.2w");
  });
});

describe("how a review reads", () => {
  /* 上传记录上的时间：后端可能给毫秒数，也可能给日期串 */
  it("shows a backend timestamp as a short date", () => {
    const at = new Date(2026, 8, 30, 12, 5).getTime();
    expect(formatWhen(at)).toBe("2026-09-30 12:05");
    expect(formatWhen(String(at))).toBe("2026-09-30 12:05");
    expect(formatWhen("2026-09-30 12:05:00")).toBe("2026-09-30 12:05");
  });

  it("shows a dash for nothing, and the raw value for something it cannot read", () => {
    expect(formatWhen(undefined)).toBe("-");
    expect(formatWhen("")).toBe("-");
    expect(formatWhen("刚刚")).toBe("刚刚");
  });
});

/* 组件里的部件还是组件面板那一套，一个画不出来的形状要被挡在门外 */
describe("the parts inside a component", () => {
  it("keeps a known kind and its own offsets", () => {
    const it = { ...makeItem("card"), x: 8, y: 12 } as PlacedItem;
    const tight = oneGroup({ x: 40, y: 60 }, [it]);
    const read = parseMarketData(packData(tight.groups, { w: tight.w, h: tight.h }));
    expect(read!.groups[0].items[0]).toMatchObject({ id: it.id, kind: "card" });
  });

  it("draws every kind the palette offers from a component alone", () => {
    const items = (Object.keys(KIND_SPEC) as Kind[]).map((kind, i) => placed(kind, i, i));
    const tight = tightenGroups([freeGroup(24, 40, items)], {});
    const read = parseMarketData(packData(tight.groups, { w: tight.w, h: tight.h }));
    expect(read).not.toBeNull();
    expect(read!.groups[0].items).toHaveLength(items.length);
  });
});
