import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE_KEY, DEFAULT_THEME, Doc, PALETTES, normalizeTheme, paletteOf } from "./tokens";
import { isProject, readDoc } from "./project";
import { frameOfGroup, type CustomPart } from "./tokens";
import { BUILTIN_CANVAS_DOC } from "./builtinCanvas";
import {
  BUILTIN_CANVAS_ID,
  BUILTIN_CANVAS_NAME,
  CANVASES_KEY,
  CanvasState,
  activeCanvas,
  blankDoc,
  canvasBlank,
  canvasClosed,
  canvasCopy,
  canvasLabel,
  ensureBuiltin,
  isBuiltinCanvas,
  loadCanvases,
  saveCanvases,
  switchTo,
  withDoc,
  withName,
} from "./canvases";

const doc = (title: string): Doc => ({ title, brief: "", paletteKey: "purple", frame: "phone", frames: [], groups: [] });

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage;
};

/* 一份"自己的画布"：从内置那份出发，再开一份自己的并切过去 */
const fresh = (): CanvasState => {
  const base = ensureBuiltin(loadCanvases(memory()), doc(""));
  return canvasBlank(base, "我的", doc("我的"));
};

const withBuiltin = (): CanvasState => ensureBuiltin(withDoc(fresh(), doc("我的")), doc(""));

describe("画布标签页", () => {
  it("第一次打开就落在内置那份上（编辑器一进来就是 QQ 农场）", () => {
    const s = loadCanvases(memory());
    expect(s.list).toHaveLength(1);
    expect(s.list[0].id).toBe(BUILTIN_CANVAS_ID);
    expect(s.activeId).toBe(BUILTIN_CANVAS_ID);
  });

  it("坏的存档不会把清单弄崩", () => {
    const store = memory();
    store.setItem(CANVASES_KEY, "{ nope");
    expect(loadCanvases(store).list).toHaveLength(1);
    store.setItem(CANVASES_KEY, JSON.stringify({ list: [{ name: "" }, null, 7] }));
    expect(loadCanvases(store).list).toHaveLength(1);
  });
});

describe("从一份画布复制出另一份", () => {
  it("新开一份并把它的文档一起存进去", () => {
    const base = fresh();
    const s = canvasCopy(base, "x", "副本", doc("副本"));
    expect(s.list).toHaveLength(base.list.length + 1);
    const opened = activeCanvas(s)!;
    expect(opened.name).toBe("副本");
    expect(opened.kind).toBe("own");
    expect(s.docs[opened.id].title).toBe("副本");
  });

  it("并存：两份画布的文档各是各的", () => {
    const first = withDoc(fresh(), doc("甲"));
    const second = canvasCopy(first, first.activeId, "副本", doc("副本"));
    const back = switchTo(second, first.activeId, doc("副本改过"), doc("空白"));
    /* 切回去拿到的是"甲"，而刚离开的那份记着"副本改过" */
    expect(back.doc.title).toBe("甲");
    expect(back.state.docs[second.activeId].title).toBe("副本改过");
    expect(Object.keys(back.state.docs)).toHaveLength(first.list.length + 1);
  });
});

describe("切换与关闭", () => {
  it("切走时把手上这一份存进当前标签页，切回来拿到的还是它", () => {
    const base = withDoc(fresh(), doc("甲"));
    const two = canvasBlank(base, "空白", doc(""));
    /* 用户在"空白"上又改了点东西，然后切回"甲" */
    const edited = withDoc(two, doc("空白改过"));
    const { state, doc: target } = switchTo(edited, base.activeId, doc("空白改过"), doc("空白"));
    expect(target.title).toBe("甲");
    expect(state.docs[two.activeId].title).toBe("空白改过");
    expect(state.activeId).toBe(base.activeId);
  });

  it("切到不存在的画布不动", () => {
    const s = withDoc(fresh(), doc("甲"));
    expect(switchTo(s, "nope", doc("甲"), doc("空白")).state).toBe(s);
  });

  it("关掉正开着的那个就落到剩下的一份，文档也跟着删掉", () => {
    const base = withDoc(fresh(), doc("甲"));
    const two = canvasBlank(base, "空白", doc(""));
    const closed = canvasClosed(two, two.activeId, doc("空白"));
    expect(closed.list).toHaveLength(base.list.length);
    /* 关掉自己那一份之后落到内置那份（清单里的第一份） */
    expect(closed.activeId).toBe(closed.list[0].id);
    expect(closed.docs[two.activeId]).toBeUndefined();
  });

  it("关掉最后一份自己的会落到内置那份；内置那份永远删不掉", () => {
    const s = withDoc(fresh(), doc("甲"));
    const closed = canvasClosed(s, s.activeId, doc("空白"));
    expect(closed.list.some((c) => c.id === BUILTIN_CANVAS_ID)).toBe(true);
    expect(closed.activeId).toBe(BUILTIN_CANVAS_ID);
    /* 只剩内置那份时再删，什么也不变 */
    const again = canvasClosed({ ...closed, list: [closed.list[0]] }, BUILTIN_CANVAS_ID, doc("空白"));
    expect(again.list).toHaveLength(1);
  });

  it("内置那份删不掉", () => {
    const s = withBuiltin();
    expect(isBuiltinCanvas(s.list.find((c) => c.id === BUILTIN_CANVAS_ID))).toBe(true);
    expect(canvasClosed(s, BUILTIN_CANVAS_ID, doc("空白"))).toBe(s);
  });

  it("存下来再读回来，几份画布都还在", () => {
    const store = memory();
    /* 四份：内置的、自己那份、空白的、复制出来的 */
    let s = ensureBuiltin(fresh(), doc(""));
    s = withName(s, "甲");
    const mine = s.activeId;
    s = canvasBlank(s, "空白", doc(""));
    s = canvasCopy(s, mine, "副本", doc("副本"));
    expect(s.list).toHaveLength(4);
    /* 每份都留一份文档：模拟每份都被打开过、自动保存过 */
    const farm = s.activeId;
    s = { ...s, docs: { ...s.docs, [mine]: doc("甲"), [farm]: doc("副本") } };
    saveCanvases(store, s);

    const back = loadCanvases(store);
    expect(back.list).toHaveLength(4);
    expect(back.activeId).toBe(s.activeId);
    expect(back.docs[mine].title).toBe("甲");
    expect(back.docs[s.activeId].title).toBe("副本");
    expect(Object.keys(back.docs)).toHaveLength(4);
  });
});

describe("标签页上的名字", () => {
  it("名字为空的用文档标题称呼", () => {
    const s = ensureBuiltin(loadCanvases(memory()), doc(""));
    const empty = { ...s.list[0], name: "" };
    expect(canvasLabel(empty, "甲")).toBe("甲");
    expect(canvasLabel(empty, "")).toBe("");
  });

  /* 内置那份叫"QQ 农场"；它的文档没有标题，空标题不该把它盖掉 */
  it("空标题不覆盖已有的名字", () => {
    const named = canvasCopy(fresh(), "x", "QQ 农场副本", doc(""));
    const again = withName(named, "   ");
    expect(activeCanvas(again)!.name).toBe("QQ 农场副本");
    const renamed = withName(again, "改过的标题");
    expect(activeCanvas(renamed)!.name).toBe("改过的标题");
  });

  it("内置那份永远在清单里、排第一", () => {
    const s = ensureBuiltin(withDoc(fresh(), doc("甲")), doc(""));
    expect(s.list[0].id).toBe(BUILTIN_CANVAS_ID);
    expect(s.list[0].name).toBe(BUILTIN_CANVAS_NAME);
    /* 再加一次不会多出第二条 */
    expect(ensureBuiltin(s, doc("")).list.filter((c) => c.id === BUILTIN_CANVAS_ID)).toHaveLength(1);
  });
});

/* 内置画布的内容必须是"这份构建读得动"的文档：读不动的话，
   编辑器一进来是空的，流程图也会说"画布上还没有页面"。 */
describe("内置画布的内容", () => {
  it("是一份合法的文档，每一组都落得到某一屏上", () => {
    expect(isProject(BUILTIN_CANVAS_DOC)).toBe(true);
    expect(BUILTIN_CANVAS_DOC.frames.length).toBeGreaterThan(1);
    const ids = new Set(BUILTIN_CANVAS_DOC.frames.map((f) => f.id));
    /* 写了 frameId 的必须指得到那一屏 */
    for (const g of BUILTIN_CANVAS_DOC.groups) {
      if (g.frameId) expect(ids.has(g.frameId)).toBe(true);
    }
    /* 没写 frameId 的靠几何归属（frameOfGroup 的老路）：也必须在某一屏里面 */
    for (const g of BUILTIN_CANVAS_DOC.groups) {
      expect(frameOfGroup(g, BUILTIN_CANVAS_DOC.frames, {})?.id).toBeTruthy();
    }
  });

  it("自定义组件都在，主题和新画布同一套（不写 theme，读的时候补 DEFAULT_THEME）", () => {
    /* 内置那份不携带 theme：原稿的 high/square/robotoSerif 是当初那台机器的观感，
       会让内置画布和新画布看起来不一样（标题栏一个发灰一个发黑）。
       读文档的每一处都走 normalizeTheme，所以缺 theme 就等于 DEFAULT_THEME。 */
    expect(BUILTIN_CANVAS_DOC.theme).toBeUndefined();
    expect(normalizeTheme(BUILTIN_CANVAS_DOC.theme)).toEqual(DEFAULT_THEME);
    expect(normalizeTheme(BUILTIN_CANVAS_DOC.theme)).toBe(DEFAULT_THEME);
    /* 读过一道 readDoc 也一样：没有 theme，Editor 的 reset 分支就落到 DEFAULT_THEME */
    const read = readDoc(JSON.parse(JSON.stringify(BUILTIN_CANVAS_DOC)));
    expect(read).toBeTruthy();
    expect(read?.theme).toBeUndefined();
    expect(normalizeTheme(read?.theme)).toBe(DEFAULT_THEME);
    expect((BUILTIN_CANVAS_DOC.customParts ?? []).length).toBeGreaterThan(0);
  });

  /* 用户口径：内置那份要和「新建画布」出来的长得一样 */
  it("配色跟着应用默认走：不写 paletteKey，读的时候补 DEFAULT_PALETTE_KEY", () => {
    /* 内置那份**不携带** paletteKey：默认配色改了（purple → Mono）它跟着改，
       和 theme 是同一个道理。写死一套配色会变成"内置那份还紫着"，和默认失配。 */
    expect(BUILTIN_CANVAS_DOC.paletteKey).toBeUndefined();
    /* 读过一道 readDoc 就补上默认那套（readDoc 是每一处读文档的必经之路） */
    const read = readDoc(JSON.parse(JSON.stringify(BUILTIN_CANVAS_DOC)));
    expect(read?.paletteKey).toBe(DEFAULT_PALETTE_KEY);
    /* 而 DEFAULT_PALETTE_KEY 必须是 PALETTES 里真实存在的一套（mono） */
    expect(DEFAULT_PALETTE_KEY).toBe("mono");
    expect(PALETTES.some((p) => p.key === DEFAULT_PALETTE_KEY)).toBe(true);
    /* paletteKey 不是 custom 时 customPalette 本来就不生效，留着只会误导 */
    expect(BUILTIN_CANVAS_DOC.customPalette).toBeUndefined();
  });

  it("没有别的会和新建画布不一样的外观字段（theme 之外都查过）", () => {
    /* 新建画布那条路（Editor 的 reset 分支）的默认：动态取色关、实现目标随默认（Android）、
       屏幕模式 phone。内置那份要么不写（读的时候补默认），要么就和默认一样。
       唯一"多出来"的是 customParts —— 那是作者内容，不是漂移。 */
    expect(BUILTIN_CANVAS_DOC.dynamicColor).toBe(false);
    expect(BUILTIN_CANVAS_DOC.platform).toBeUndefined();
    expect(BUILTIN_CANVAS_DOC.frame).toBe("phone");
    expect(BUILTIN_CANVAS_DOC.title).toBe("");
    expect(BUILTIN_CANVAS_DOC.brief).toBe("");
  });
});

/* 「新建画布」出来的必须是干净的一份：外观回默认，只有结构性的设置跟着当前画布走。
   用户报的正是这条 —— 新画布继承了当前画布的 theme（那时是 square/robotoSerif），
   于是 paletteOf 走 schemeFromSeed 生成另一套，屏幕标题栏发黑。 */
describe("新建画布的文档：外观干净，结构照旧", () => {
  const parts: CustomPart[] = [{ id: "cp1", name: "我的卡片", w: 100, h: 40, items: [] }];
  /* 一份"被污染"的当前画布：外观全都不是默认，结构性设置也和默认不同 */
  const polluted = (): Doc => ({
    ...doc("污染源"),
    paletteKey: "custom",
    customPalette: { ...PALETTES[0], key: "custom", primary: "#123456" },
    dynamicColor: true,
    promptEdit: "手改过的提示词",
    theme: { ...DEFAULT_THEME, contrast: "medium", shape: "square", font: "robotoSerif" },
    platform: "web",
    frame: "blank",
    customParts: parts,
  });

  it("主题就是 DEFAULT_THEME（import 的那一个，不是手抄的副本）", () => {
    expect(blankDoc(polluted(), "首页").theme).toBe(DEFAULT_THEME);
  });

  it("配色回默认预设；自定义配色不漏进来（反向守卫）", () => {
    const src = polluted();
    /* 源画布确实是"自定义配色"：这条守卫没了就测不出漏不漏 */
    expect(src.paletteKey).toBe("custom");
    expect(src.customPalette).toBeTruthy();
    const blank = blankDoc(src, "首页");
    expect(blank.paletteKey).toBe(DEFAULT_PALETTE_KEY);
    expect(PALETTES.some((p) => p.key === DEFAULT_PALETTE_KEY)).toBe(true);
    expect(blank.customPalette).toBeUndefined();
  });

  it("真正落回默认配色那套（lib/tokens.ts 里 paletteOf 的默认分支）", () => {
    const src = polluted();
    const blank = blankDoc(src, "首页");
    const mono = PALETTES.find((p) => p.key === DEFAULT_PALETTE_KEY);
    expect(mono).toBeTruthy();
    /* 默认主题是高对比 + 跟随系统，所以 paletteOf 从 Mono 的种子生成高对比那套，
       但 key 仍然是默认的那一套；源画布那套（custom）是另一份。 */
    const resolved = paletteOf(blank.paletteKey, blank.customPalette, blank.theme);
    expect(resolved.key).toBe(DEFAULT_PALETTE_KEY);
    const fromSource = paletteOf(src.paletteKey, src.customPalette, src.theme);
    expect(fromSource.key).toBe("custom");
    expect(fromSource).not.toEqual(resolved);
    /* 标准对比 + 浅色那条路上读到的就是手写的 Mono 预设本身 */
    expect(paletteOf(blank.paletteKey, blank.customPalette, { ...blank.theme!, bothModes: false, contrast: "standard", dark: false })).toBe(mono);
  });

  it("结构性的设置照旧继承：平台、屏幕模式、作者自己的组件", () => {
    const blank = blankDoc(polluted(), "首页");
    expect(blank.platform).toBe("web");
    expect(blank.frame).toBe("blank");
    expect(blank.customParts).toBe(parts);
  });

  it("是逐字段的一份文档：只有这几个键，别的不会漏进来", () => {
    const blank = blankDoc(polluted(), "首页");
    expect(Object.keys(blank).sort()).toEqual(["brief", "customParts", "frame", "frames", "groups", "paletteKey", "platform", "theme", "title"]);
    /* 这两条以前是跟着展开漏进来的 */
    expect(blank.dynamicColor).toBeUndefined();
    expect(blank.promptEdit).toBeUndefined();
    expect(blank.title).toBe("");
    expect(blank.brief).toBe("");
    expect(blank.groups).toEqual([]);
    expect(blank.frames).toHaveLength(1);
    expect(blank.frames[0].name).toBe("首页");
  });

  /* 三个拿空白文档的入口都从这儿走（Editor 的 emptyDoc 也只是 blankDoc 的一层壳） */
  it("新建画布：新标签页那一格存的就是这份干净的文档", () => {
    const blank = blankDoc(polluted(), "首页");
    const s = canvasBlank(ensureBuiltin(loadCanvases(memory()), doc("")), "未命名画布", blank);
    expect(s.docs[s.activeId]).toBe(blank);
    expect(s.docs[s.activeId].theme).toBe(DEFAULT_THEME);
    expect(s.docs[s.activeId].paletteKey).toBe(DEFAULT_PALETTE_KEY);
    expect(s.docs[s.activeId].customPalette).toBeUndefined();
    expect(s.docs[s.activeId].platform).toBe("web");
    expect(s.docs[s.activeId].customParts).toBe(parts);
  });

  it("切换到一个还没写过文档的标签页：拿到的也是这份干净的文档", () => {
    const s0 = ensureBuiltin(loadCanvases(memory()), doc(""));
    const two = canvasBlank(s0, "空白", doc("旧的"));
    const blank = blankDoc(polluted(), "首页");
    /* 手上是内置那份，要切过去的那一格还没写过文档 */
    const from = { ...two, activeId: s0.activeId, docs: {} };
    const { state, doc: target } = switchTo(from, two.activeId, polluted(), blank);
    expect(state.activeId).toBe(two.activeId);
    expect(target).toBe(blank);
  });

  it("关掉最后一个标签页留下的那一份，也是这份干净的文档", () => {
    const blank = blankDoc(polluted(), "首页");
    const only: CanvasState = { list: [{ id: "only", name: "", kind: "own", at: 0 }], activeId: "only", docs: {} };
    const closed = canvasClosed(only, "only", blank);
    expect(closed.list).toHaveLength(1);
    expect(closed.docs[closed.activeId]).toBe(blank);
    expect(closed.docs[closed.activeId].theme).toBe(DEFAULT_THEME);
  });

  /* 真正走一遍存储：存进画布清单、再读回来（用户那台机器上的实际路径） */
  it("存下来再读回来，还是干净的那份", () => {
    const store = memory();
    const s = canvasBlank(ensureBuiltin(loadCanvases(store), doc("")), "新的", blankDoc(polluted(), "首页"));
    saveCanvases(store, s);
    const back = loadCanvases(store);
    const stored = readDoc(back.docs[back.activeId]);
    expect(stored).toBeTruthy();
    expect(stored!.theme).toEqual(DEFAULT_THEME);
    expect(stored!.paletteKey).toBe(DEFAULT_PALETTE_KEY);
    expect(stored!.customPalette).toBeUndefined();
    expect(stored!.dynamicColor).toBeUndefined();
    expect(stored!.promptEdit).toBeUndefined();
    /* 结构性的照样在 */
    expect(stored!.platform).toBe("web");
    expect(stored!.frame).toBe("blank");
    expect((stored!.customParts ?? []).map((c) => c.name)).toEqual(["我的卡片"]);
  });
});
