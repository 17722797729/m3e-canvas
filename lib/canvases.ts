import { DEFAULT_PALETTE_KEY, DEFAULT_THEME, Doc, Theme } from "./tokens";
import { BUILTIN_CANVAS_ID, BUILTIN_CANVAS_NAME } from "./builtinCanvas";

/**
 * 画布
 * ---------------------------------------------------------------------------
 * 一个「画布」就是一份文档（它的屏幕、部件、配色…）。工作区页签始终对着**当前画布**；
 * 「模板」里的一套画布可以开成新的一个，于是可以同时开着好几份，在标签页之间来回看。
 *
 * 存储分两处，各管一半：
 *   `m3e:doc`       —— 当前画布这一份（沿用老键，单画布的流程因此一行都不用改）
 *   `m3e:canvases`  —— 清单：有哪几个画布、叫什么、当前是哪一个
 *
 * 外观里只有主题不在这里：它是应用级的，单独存在 `m3e:theme`（见 lib/appTheme.ts），
 * 内置那份、新建的和每一份画布都跟着它。文档里也写着 theme，但那只是导出/分享时
 * 带着的观感，打开时上屏的以应用级主题为准。
 *
 * 切走的时候当前画布已经由文档的自动保存写进 `m3e:doc` 了，所以清单里不必再存副本；
 * 切过去就是把它读出来交给编辑器。
 */
export type Canvas = {
  id: string;
  /** 面板上显示的名字 */
  name: string;
  /**
   * `builtin` 是随产品一起来的那一份（QQ 农场）：不能删除，
   * 名字固定，随时可以从这里恢复成它本来的样子；
   * `own` 是使用者自己的画布。
   */
  kind: "builtin" | "own";
  at: number;
};

/* 内置画布的 id 与名字从它自己的模块来：内容与身份放一处，免得两处对不上 */
export { BUILTIN_CANVAS_ID, BUILTIN_CANVAS_NAME } from "./builtinCanvas";

export type CanvasState = {
  list: Canvas[];
  activeId: string;
  /**
   * 每个标签页各自的那一份文档
   *
   * 切走时把当前文档存进来，切回来时取出去 —— 标签页因此是"并存的几套画布"，
   * 而不是几套共享同一份文档的壳子。当前这一份同时仍写在 `m3e:doc` 里，
   * 单画布的流程（保存项目、分享、AI 草稿）因此一行都不用改。
   */
  docs: Record<string, Doc>;
};

export const CANVASES_KEY = "m3e:canvases";

/** 够用的短 id：这份清单只存在本机 */
export const newCanvasId = () => Math.random().toString(36).slice(2, 10);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const readCanvas = (v: unknown): Canvas | null => {
  if (!isRecord(v)) return null;
  const id = typeof v.id === "string" ? v.id : "";
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!id || !name) return null;
  /* 老存储里的 kind 是 blank / template；一律读成自己的画布，
     要留的那一份由 ensureBuiltin 用固定 id 保证 */
  return { id, name, kind: "own", at: typeof v.at === "number" ? v.at : 0 };
};

/**
 * 读回标签页清单
 *
 * 没有存过（老用户第一次打开这一版）就给一个「当前画布」——
 * 它指向的正是已经在 `m3e:doc` 里的那份文档，所以升级不会丢东西。
 */
/**
 * 保证内置画布在清单里
 *
 * 它排第一、名字固定、删不掉。老存储里那条"来自模板"的记录（id 也是 qq-farm 之类）
 * 会被这条并掉：内容就是它的内容，名字统一成 QQ 农场。
 */
export function ensureBuiltin(state: CanvasState, blank: Doc): CanvasState {
  const builtin: Canvas = { id: BUILTIN_CANVAS_ID, name: BUILTIN_CANVAS_NAME, kind: "builtin", at: 0 };
  const rest = state.list.filter((c) => c.id !== BUILTIN_CANVAS_ID);
  return {
    list: [builtin, ...rest],
    /* 当前那一份还认得出就留着；认不出（老存储、或旧的空白占位）就落到内置那份 */
    activeId: state.activeId && state.activeId !== BUILTIN_CANVAS_ID && rest.some((c) => c.id === state.activeId) ? state.activeId : BUILTIN_CANVAS_ID,
    /* 内置那份兜底：没打开过、或者存的那份空了（旧构建留下的坏内容）都用出厂内容。
       只有"一屏都不剩"才会被换掉 —— 空的存档不可能是作者删出来的。 */
    docs: {
      ...state.docs,
      [BUILTIN_CANVAS_ID]: builtinDocOr(state.docs[BUILTIN_CANVAS_ID], blank),
    },
  };
}

/**
 * 内置那份该用哪份内容
 *
 * 没存过、或者存的那份连一屏都没有 —— 都用 `blank` 参数传进来的出厂内容。
 * 后半句是为了修旧构建留下的坏存档：那时内置内容生成得不对，
 * 于是"QQ 农场的流程图说画布上没有页面"。
 */
const builtinDocOr = (saved: Doc | undefined, blank: Doc): Doc =>
  saved && Array.isArray(saved.frames) && saved.frames.length > 0 ? saved : blank;

/** 一份画布是不是内置的（内置的不能删、不能改名） */
export const isBuiltinCanvas = (c: Canvas | undefined): boolean => !!c && (c.kind === "builtin" || c.id === BUILTIN_CANVAS_ID);

export function loadCanvases(storage: Storage | undefined): CanvasState {
  /* 第一次打开：当前就是内置那份（编辑器一进来就显示 QQ 农场，不是一张空白页） */
  const first = (): CanvasState => ({
    list: [{ id: BUILTIN_CANVAS_ID, name: BUILTIN_CANVAS_NAME, kind: "builtin", at: 0 }],
    activeId: BUILTIN_CANVAS_ID,
    docs: {},
  });
  try {
    if (!storage) return first();
    const raw = storage.getItem(CANVASES_KEY);
    if (!raw) return first();
    const v: unknown = JSON.parse(raw);
    if (!isRecord(v) || !Array.isArray(v.list)) return first();
    const list = v.list.map(readCanvas).filter((c): c is Canvas => !!c);
    if (list.length === 0) return first();
    const activeId = typeof v.activeId === "string" && list.some((c) => c.id === v.activeId) ? v.activeId : list[0].id;
    /* 只认清单里还有的那些标签页的文档，删掉的别留着占地方 */
    const docs: Record<string, Doc> = {};
    if (isRecord(v.docs)) {
      for (const c of list) {
        const one = (v.docs as Record<string, unknown>)[c.id];
        if (isRecord(one)) docs[c.id] = one as Doc;
      }
    }
    return { list, activeId, docs };
  } catch {
    const only = first();
    only.activeId = only.list[0].id;
    return only;
  }
}

export function saveCanvases(storage: Storage | undefined, state: CanvasState) {
  try {
    storage?.setItem(CANVASES_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * 打开的标签页
 *
 * 名字为空的那个是"当前画布"——第一次打开编辑器时它还没有名字，
 * 由文档自己的标题决定显示什么，所以这里只负责给一个有意义的称呼。
 */
export const canvasLabel = (c: Canvas, fallback: string): string => c.name.trim() || fallback;

/** 从模板开一个新画布 */
/** 复制一份画布：把某一份的内容再开一份（内置那份因此也能拿去改，原版不动） */
export function canvasCopy(prev: CanvasState, from: string, name: string, doc: Doc): CanvasState {
  const canvas: Canvas = { id: newCanvasId(), name, kind: "own", at: Date.now() };
  return { list: [...prev.list, canvas], activeId: canvas.id, docs: { ...prev.docs, [canvas.id]: doc } };
}

/**
 * 新画布沿用当前画布的哪些字段
 *
 * 只有"结构/平台"这一类：实现目标（platform）、屏幕模式（frame），
 * 以及作者自己攒的组件（customParts）—— 组件是作者的内容，一直是有意继承的。
 * 外观不在此列：配色、自定义配色回默认；主题则取**应用级**那一份（见 blankDoc）。
 */
export type BlankDocSource = Pick<Doc, "platform" | "frame" | "customParts">;

/**
 * 一份空白的画布：一屏、没有部件
 *
 * 这里是**逐字段**写明的一份新文档，而不是 `{ ...from, ... }`。
 * 展开当前画布会把它的 paletteKey / customPalette / dynamicColor / promptEdit
 * 一起带进新画布，「新建画布」于是顶着上一份的观感。所以 Doc 以后多出字段
 * 也不会再悄悄漏进来：要继承什么，必须在这里写明。别把这份字段清单"化简"回展开。
 *
 * 主题是例外，但**不是**"跟着源文档"：它是应用级设置（lib/appTheme.ts 的
 * `m3e:theme`），跟着作者设的那一次走。调用方把当前应用级主题传进来；
 * 不传（纯函数调用、没有应用级设置可言）就是出厂那套 DEFAULT_THEME，
 * 与一台全新机器上 loadAppTheme 的结果一致。
 */
export function blankDoc(from: BlankDocSource, home: string, theme: Theme = DEFAULT_THEME): Doc {
  return {
    /* 结构性的：屏幕模式与实现目标跟着作者现在这一份 —— 一块空白屏幕应该还是手机/桌面那一种 */
    frame: from.frame,
    platform: from.platform,
    /* 作者自己的组件：内容，不是外观，照旧继承 */
    customParts: from.customParts,
    /* 内容：一屏空白，没有部件 */
    groups: [],
    frames: [{ id: `f${Date.now().toString(36)}`, name: home, x: 0, y: 0, w: 412, h: 892 }],
    title: "",
    brief: "",
    /* 外观：配色回默认预设，不跟着当前画布 */
    paletteKey: DEFAULT_PALETTE_KEY,
    /* 主题是应用级设置：新画布跟着作者设的那一份，而不是这份源文档的旧观感 */
    theme,
  };
}

/**
 * 把应用级主题盖到清单里每一份画布的文档上
 *
 * 主题改一次，所有画布都得跟着：否则切回另一份画布时，它文档里存着的那套旧主题
 * 会把新设置顶掉。当前正开着的那一份不在清单里（它由编辑器自己那份状态承载），
 * 由调用方一并更新 —— 见 lib/appTheme.ts 的 setAppTheme。
 */
export const withAppTheme = (state: CanvasState, theme: Theme): CanvasState => ({
  ...state,
  docs: Object.fromEntries(Object.entries(state.docs).map(([id, d]) => [id, { ...d, theme }])),
});

/** 新开一个空白画布 */
export function canvasBlank(prev: CanvasState, name: string, doc: Doc): CanvasState {
  const canvas: Canvas = { id: newCanvasId(), name, kind: "own", at: Date.now() };
  return { list: [...prev.list, canvas], activeId: canvas.id, docs: { ...prev.docs, [canvas.id]: doc } };
}

/** 关掉一个标签页；关掉最后一个就留着一个空的，编辑器不可能是"零个画布" */
export function canvasClosed(prev: CanvasState, id: string, blank: Doc): CanvasState {
  /* 内置的那份删不掉：删它等于把随产品一起给的东西丢掉 */
  if (id === BUILTIN_CANVAS_ID) return prev;
  const docs = { ...prev.docs };
  delete docs[id];
  const list = prev.list.filter((c) => c.id !== id);
  if (list.length === 0) {
    const only: Canvas = { id: newCanvasId(), name: "", kind: "own", at: Date.now() };
    return { list: [only], activeId: only.id, docs: { [only.id]: blank } };
  }
  return { list, activeId: prev.activeId === id ? list[0].id : prev.activeId, docs };
}

/**
 * 切换画布：把手上这一份存进当前标签页，取出目标标签页那一份
 *
 * 返回新的清单与要交给编辑器的文档。目标还没写过文档（刚建的空标签页）就现给一份空白的。
 */
export function switchTo(prev: CanvasState, id: string, current: Doc, blank: Doc): { state: CanvasState; doc: Doc } {
  if (id === prev.activeId || !prev.list.some((c) => c.id === id)) return { state: prev, doc: current };
  const docs = { ...prev.docs, [prev.activeId]: current };
  const state: CanvasState = { ...prev, activeId: id, docs };
  return { state, doc: docs[id] ?? blank };
}

/** 把当前文档记进当前那个标签页（自动保存时用） */
export const withDoc = (prev: CanvasState, doc: Doc): CanvasState =>
  prev.activeId ? { ...prev, docs: { ...prev.docs, [prev.activeId]: doc } } : prev;

/**
 * 标签页上的名字跟着文档标题走
 *
 * 但**空标题不覆盖**：从模板开出来的那一份名字就是模板名（"QQ 农场"），
 * 而模板文档本身没有标题，若让它盖过去，标签页就会变成"未命名画布"。
 */
export const withName = (prev: CanvasState, name: string): CanvasState => {
  const trimmed = name.trim();
  if (!trimmed) return prev;
  return { ...prev, list: prev.list.map((c) => (c.id === prev.activeId ? { ...c, name: trimmed } : c)) };
};

/** 当前画布在清单里的那一条 */
export const activeCanvas = (state: CanvasState): Canvas | undefined => state.list.find((c) => c.id === state.activeId);

/** 把当前这一份文档写回存储（`m3e:doc` 就是"当前画布"的家） */
export function saveActiveDoc(storage: Storage | undefined, key: string, doc: Doc) {
  try {
    storage?.setItem(key, JSON.stringify(doc));
  } catch {}
}
