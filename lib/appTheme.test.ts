import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE_KEY, DEFAULT_THEME, Doc, PALETTES, Theme, paletteOf } from "./tokens";
import {
  CanvasState,
  blankDoc,
  canvasBlank,
  ensureBuiltin,
  loadCanvases,
  saveCanvases,
  withDoc,
} from "./canvases";
import {
  APP_THEME_KEY,
  adoptAppTheme,
  loadAppTheme,
  loadStoredAppTheme,
  saveAppTheme,
  setAppTheme,
  themeForDoc,
} from "./appTheme";

/* 主题是应用级的：设一次，内置 + 新建 + 所有画布都跟着（`m3e:theme`）。
   这一组只测纯函数，不碰 DOM。 */

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage;
};

const doc = (title: string, theme?: Doc["theme"]): Doc => ({ title, brief: "", paletteKey: "purple", frame: "phone", frames: [], groups: [], ...(theme ? { theme } : {}) });

/** 一份当前画布 + 一份自己的画布（后者切到前面），两份的文档都在清单里 */
const twoCanvases = (): CanvasState => {
  const base = ensureBuiltin(loadCanvases(memory()), doc(""));
  const one = canvasBlank(base, "甲", doc("甲"));
  const two = canvasBlank(one, "乙", doc("乙"));
  return withDoc(two, doc("乙"));
};

const darkHigh: Theme = { ...DEFAULT_THEME, dark: true, contrast: "high" };

/** 一台"已经设过应用级主题"的机器 */
const storeWith = (theme: Theme): Storage => {
  const s = memory();
  saveAppTheme(s, theme);
  return s;
};

describe("应用级主题：存取", () => {
  it("全新安装（什么都没有）就是出厂那套：Mono + 高对比 + 跟随系统", () => {
    const store = memory();
    expect(loadStoredAppTheme(store)).toBeNull();
    expect(loadAppTheme(store)).toBe(DEFAULT_THEME);
    /* 出厂默认原样写一遍：以后改它必须是有意改，不能悄悄漂 */
    expect(DEFAULT_THEME).toEqual({ dark: false, bothModes: true, contrast: "high", shape: "rounded", font: "roboto", emphasized: false, motion: "standard" });
    /* dark:false 是"系统还没读到"的兜底（SSR / 首帧），不是"出厂浅色"：
       跟随系统开着时，上屏的深浅由 lib/systemTheme.ts 决定 */
    expect(DEFAULT_THEME.dark).toBe(false);
    expect(DEFAULT_THEME.bothModes).toBe(true);
    expect(DEFAULT_THEME.contrast).toBe("high");
  });

  it("全新安装解析出来是 Mono + 高对比 + 跟随系统（默认配色 key 真实存在）", () => {
    const theme = loadAppTheme(memory());
    expect(DEFAULT_PALETTE_KEY).toBe("mono");
    const mono = PALETTES.find((p) => p.key === DEFAULT_PALETTE_KEY);
    expect(mono, "DEFAULT_PALETTE_KEY 必须是 PALETTES 里真实存在的一套").toBeTruthy();
    /* 默认主题是高对比，所以 paletteOf 走生成分支；key 仍然是默认那一套 */
    expect(paletteOf(DEFAULT_PALETTE_KEY, undefined, theme).key).toBe(DEFAULT_PALETTE_KEY);
    /* 标准对比 + 浅色那条路上读到的就是手写的 Mono 预设本身 */
    expect(paletteOf(DEFAULT_PALETTE_KEY, undefined, { ...theme, contrast: "standard" })).toBe(mono);
  });

  it("存下来读回来是同一套；键就是 m3e:theme", () => {
    const store = memory();
    saveAppTheme(store, darkHigh);
    expect(store.getItem(APP_THEME_KEY)).toBeTruthy();
    expect(loadStoredAppTheme(store)).toEqual(darkHigh);
  });

  it("坏值/缺字段一律就地补默认，不把整台机器判成没设置过", () => {
    const store = memory();
    store.setItem(APP_THEME_KEY, "{ nope");
    expect(loadStoredAppTheme(store)).toBeNull();
    store.setItem(APP_THEME_KEY, "7");
    expect(loadStoredAppTheme(store)).toBeNull();
    store.setItem(APP_THEME_KEY, JSON.stringify({ dark: true, contrast: "blaring", shape: "pointy" }));
    expect(loadStoredAppTheme(store)).toEqual({ ...DEFAULT_THEME, dark: true });
  });
});

describe("新建画布：主题跟应用级设置，配色仍然回默认", () => {
  const source = (): Doc => ({
    ...doc("源画布"),
    paletteKey: "custom",
    customPalette: { ...PALETTES[0], key: "custom", primary: "#123456" },
    dynamicColor: true,
    promptEdit: "手改过的提示词",
    theme: { ...DEFAULT_THEME, contrast: "high", shape: "square" },
  });

  it("新画布拿到的就是当前应用级主题（不是 DEFAULT_THEME，也不是源文档那份）", () => {
    const store = memory();
    saveAppTheme(store, darkHigh);
    const app = loadAppTheme(store);
    const blank = blankDoc(source(), "首页", app);
    expect(blank.theme).toBe(app);
    expect(blank.theme).not.toBe(DEFAULT_THEME);
    expect(blank.theme).toEqual(darkHigh);
    /* 源文档那份高对比度不是新画布的主题 */
    expect(blank.theme).not.toEqual(source().theme);
  });

  it("应用级主题不同时，屏幕确实是深色那套（paletteOf 走另一条分支）", () => {
    const app = loadAppTheme(storeWith(darkHigh));
    const blank = blankDoc(source(), "首页", app);
    expect(paletteOf(blank.paletteKey, blank.customPalette, blank.theme)).not.toBe(PALETTES[0]);
    /* 出厂默认也不再是紫色那套：默认配色是 Mono */
    expect(DEFAULT_PALETTE_KEY).not.toBe(PALETTES[0].key);
    expect(paletteOf(DEFAULT_PALETTE_KEY, undefined, DEFAULT_THEME).key).toBe(DEFAULT_PALETTE_KEY);
  });

  it("配色/自定义配色/动态取色/手改提示词仍然硬回默认，字段清单一个不多", () => {
    const blank = blankDoc(source(), "首页", darkHigh);
    expect(Object.keys(blank).sort()).toEqual(["brief", "customParts", "frame", "frames", "groups", "paletteKey", "platform", "theme", "title"]);
    expect(blank.paletteKey).toBe(DEFAULT_PALETTE_KEY);
    expect(blank.customPalette).toBeUndefined();
    expect(blank.dynamicColor).toBeUndefined();
    expect(blank.promptEdit).toBeUndefined();
  });

  it("经 canvasBlank 落到新标签页那一格上，还是同一份", () => {
    const app = loadAppTheme(storeWith(darkHigh));
    const blank = blankDoc(source(), "首页", app);
    const state = canvasBlank(ensureBuiltin(loadCanvases(memory()), doc("")), "新的", blank);
    expect(state.docs[state.activeId]).toBe(blank);
    expect(state.docs[state.activeId].theme).toBe(app);
    expect(state.docs[state.activeId].paletteKey).toBe(DEFAULT_PALETTE_KEY);
  });

  it("不传主题时（纯函数调用）落到出厂那套，和全新机器一致", () => {
    expect(blankDoc(source(), "首页").theme).toBe(DEFAULT_THEME);
  });
});

describe("打开文档：上屏的主题以应用级为准", () => {
  it("文档自带一份旧主题，渲染用的还是应用级主题", () => {
    const stale = doc("旧的", { ...DEFAULT_THEME, contrast: "high", shape: "square" });
    const store = memory();
    saveAppTheme(store, darkHigh);
    const app = loadAppTheme(store);
    expect(themeForDoc(app, stale)).toBe(app);
    expect(themeForDoc(app, stale)).not.toEqual(stale.theme);
  });

  it("文档没有主题也一样（内置那份不写 theme）", () => {
    const app = loadAppTheme(storeWith(darkHigh));
    expect(themeForDoc(app, doc("内置"))).toBe(app);
    expect(themeForDoc(app)).toBe(app);
  });

  it("接上系统深浅色：bothModes 开着时按系统定 dark，关着时用作者选的那个", () => {
    /* DEFAULT_THEME 就是 bothModes: true，所以系统说了算 */
    expect(themeForDoc(DEFAULT_THEME, doc("内置"), true).dark).toBe(true);
    expect(themeForDoc(DEFAULT_THEME, doc("内置"), false).dark).toBe(false);
    /* 关掉跟随系统：系统是什么都不管 */
    const pinned = { ...DEFAULT_THEME, bothModes: false, dark: false };
    expect(themeForDoc(pinned, undefined, true).dark).toBe(false);
    expect(themeForDoc({ ...pinned, dark: true }, undefined, false).dark).toBe(true);
    /* 不传系统值（没有 DOM 的地方）就原样用应用级主题 */
    expect(themeForDoc(DEFAULT_THEME, undefined)).toBe(DEFAULT_THEME);
  });
});

describe("改一条主题轴：一处改，处处跟着", () => {
  it("写应用级 store、写当前文档、写清单里每一份画布（内存与落盘）", () => {
    const store = memory();
    const state = twoCanvases();
    /* 先让每一份文档带着各自的旧主题，才测得出"都跟着改了" */
    const stale = { ...DEFAULT_THEME, contrast: "high" as const, shape: "square" as const };
    const withStale: CanvasState = { ...state, docs: Object.fromEntries(Object.entries(state.docs).map(([id, d]) => [id, { ...d, theme: stale }])) };
    saveCanvases(store, withStale);
    const active = { ...(withStale.docs[withStale.activeId] as Doc), title: "乙" };

    const next = setAppTheme(store, withStale, active, { dark: true, contrast: "high" });

    /* (a) 应用级 store */
    expect(loadAppTheme(store)).toEqual(darkHigh);
    /* (b) 当前这份文档 */
    expect(next.doc.theme).toBe(next.theme);
    expect(next.doc.theme).toEqual(darkHigh);
    /* (c) 清单里每一份画布 */
    const ids = Object.keys(next.canvases.docs);
    expect(ids.length).toBeGreaterThan(1);
    for (const id of ids) expect(next.canvases.docs[id].theme).toBe(next.theme);
    /* 落盘的那一份也改了：之后切过去不会把旧主题带回来 */
    const back = loadCanvases(store);
    for (const id of Object.keys(back.docs)) expect(back.docs[id].theme).toEqual(darkHigh);
  });

  it("一次只改一条轴，其余轴保持现在这套", () => {
    const store = memory();
    const state = twoCanvases();
    saveAppTheme(store, { ...darkHigh, shape: "full", font: "robotoSerif" });
    const next = setAppTheme(store, state, state.docs[state.activeId], { motion: "expressive" });
    expect(next.theme).toEqual({ ...darkHigh, shape: "full", font: "robotoSerif", motion: "expressive" });
    expect(next.canvases.docs[state.activeId].theme).toBe(next.theme);
  });

  it("第一下改轴（store 里还没有值）从出厂那套出发", () => {
    const store = memory();
    const state = twoCanvases();
    const next = setAppTheme(store, state, state.docs[state.activeId], { dark: true });
    expect(next.theme).toEqual({ ...DEFAULT_THEME, dark: true });
    expect(loadStoredAppTheme(store)).toEqual({ ...DEFAULT_THEME, dark: true });
  });
});

describe("第一次用这一版：把正在看的那份升成应用级设置", () => {
  it("存着一份 contrast:'high' 的文档 → 应用级主题就是它，所有画布跟着它", () => {
    const store = memory();
    /* 老用户的机器：有画布清单，文档自带主题，但没有 m3e:theme */
    const state = twoCanvases();
    const stale = { ...DEFAULT_THEME, contrast: "high" as const, shape: "square" as const, dark: true };
    const withStale: CanvasState = { ...state, docs: Object.fromEntries(Object.entries(state.docs).map(([id, d]) => [id, { ...d, theme: stale }])) };
    saveCanvases(store, withStale);
    const active = withStale.docs[withStale.activeId];
    expect(loadStoredAppTheme(store)).toBeNull();

    const { theme, canvases } = adoptAppTheme(store, active, withStale);

    expect(theme).toEqual(stale);
    expect(loadStoredAppTheme(store)).toEqual(stale);
    for (const id of Object.keys(canvases.docs)) expect(canvases.docs[id].theme).toBe(theme);
    const back = loadCanvases(store);
    for (const id of Object.keys(back.docs)) expect(back.docs[id].theme).toEqual(stale);
  });

  it("一条存档都没有 → 出厂那套（跟随系统 + 高对比），不是深色", () => {
    const store = memory();
    const { theme, canvases } = adoptAppTheme(store, null, twoCanvases());
    expect(theme).toBe(DEFAULT_THEME);
    expect(theme.dark).toBe(false);
    expect(theme.bothModes).toBe(true);
    expect(theme.contrast).toBe("high");
    expect(loadStoredAppTheme(store)).toEqual(DEFAULT_THEME);
    expect(canvases.docs[canvases.activeId].theme).toBe(DEFAULT_THEME);
  });

  it("内置那份（文档不写 theme）→ 出厂那套，不是继承别的文档", () => {
    const store = memory();
    const { theme } = adoptAppTheme(store, { title: "", brief: "", paletteKey: "purple", frame: "phone", frames: [], groups: [] }, twoCanvases());
    expect(theme).toBe(DEFAULT_THEME);
  });

  it("已经有应用级主题时，启动不拿文档里那份旧主题盖掉它", () => {
    const store = memory();
    saveAppTheme(store, darkHigh);
    const staleDoc = doc("旧的", { ...DEFAULT_THEME, contrast: "high", shape: "square", dark: false });
    const state = withDoc(twoCanvases(), staleDoc);
    const { theme } = adoptAppTheme(store, staleDoc, state);
    expect(theme).toEqual(darkHigh);
    expect(loadStoredAppTheme(store)).toEqual(darkHigh);
  });
});
