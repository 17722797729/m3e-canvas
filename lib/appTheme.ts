import { CanvasState, saveCanvases, withAppTheme } from "./canvases";
import { DEFAULT_THEME, Doc, normalizeTheme, Theme } from "./tokens";
import { themeForSystem } from "./systemTheme";

/**
 * 应用级主题
 * ---------------------------------------------------------------------------
 * 主题（深色 / 跟随系统 / 对比度 / 形状 / 字体 / 强调字 / 动效）是**一处设置**，
 * 不是每份画布各有一份：作者设一次，内置那份、新建的、以及所有已经开着的画布
 * 都跟着它。所以它单独存在 `m3e:theme`，而不是跟着 `m3e:doc` / `m3e:canvases`
 * 里那一份份文档走。
 *
 * 文档里仍然写着 `theme`：一份分享出去、导出成文件的文档本来就该带着"它长什么样"。
 * 但**打开文档时渲染用的是应用级主题**（见 themeForDoc），文档自带的那份只是它
 * 被写下来时的观感。配色（`paletteKey`）、自定义配色、动态取色、手改提示词仍然是
 * 每份画布各管各的，不在这里 —— 见 lib/canvases.ts 的 blankDoc。
 */
export const APP_THEME_KEY = "m3e:theme";

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * 存下来的应用级主题；这一版之前没存过就是 null
 *
 * 和别的设置一样，读的一律走 normalizeTheme：老版本少写的字段、坏掉的值
 * 都就地补成默认，而不是把整台机器判成"没设置过"。
 */
export function loadStoredAppTheme(storage: Storage | undefined): Theme | null {
  try {
    const raw = storage?.getItem(APP_THEME_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    return normalizeTheme(value as Partial<Theme>);
  } catch {
    return null;
  }
}

/** 应用级主题：没存过、或存坏了，就是出厂那套（浅色、标准对比度） */
export const loadAppTheme = (storage: Storage | undefined): Theme => loadStoredAppTheme(storage) ?? DEFAULT_THEME;

export function saveAppTheme(storage: Storage | undefined, theme: Theme) {
  try {
    storage?.setItem(APP_THEME_KEY, JSON.stringify(normalizeTheme(theme)));
  } catch {}
}

/**
 * 打开一份文档时，它按哪套主题渲染
 *
 * 这是"哪个主题上屏"的**唯一一处**判断：应用级主题。文档自带的那份不参与 ——
 * 否则"我设了深色"会在下一次切换画布、打开内置那份、或导入一个文件时，
 * 被那份文档里存的旧观感盖回去。
 *
 * 第三个参数是系统深浅色（`matchMedia` 读到的那一个）。开了深浅色模式
 * （`bothModes`）时，上屏的 `dark` 由它定 —— 规则本身在 lib/systemTheme.ts
 * 的 `themeForSystem`，纯函数；这里只是把它接在应用级这条路上。不传就只用应用级
 * 主题原样（没有 DOM 的地方、或还没读到系统值时）。
 */
export const themeForDoc = (appTheme: Theme, _doc?: Partial<Doc>, systemDark?: boolean): Theme =>
  typeof systemDark === "boolean" ? themeForSystem(appTheme, systemDark) : appTheme;

/**
 * 第一次用这一版：把"现在正在看的这一份"的主题升成应用级设置
 *
 * 没有 `m3e:theme`（老用户第一次打开新版）时，不能悄悄换成出厂那套 —— 那会让他们
 * 眼前的深色画布在下一次打开时变回浅色。取当前文档自带的主题存成应用级主题，
 * 并盖到清单里每一份画布上；没有当前文档（一条存档都没有）就用出厂那套。
 *
 * 已经有应用级主题时原样返回：这份设置只由作者改（setAppTheme），启动不覆盖它。
 */
export function adoptAppTheme(
  storage: Storage | undefined,
  activeDoc: Partial<Doc> | null | undefined,
  canvases: CanvasState,
): { theme: Theme; canvases: CanvasState } {
  const stored = loadStoredAppTheme(storage);
  if (stored) return { theme: stored, canvases };
  const theme = normalizeTheme(activeDoc?.theme);
  saveAppTheme(storage, theme);
  const next = withAppTheme(canvases, theme);
  saveCanvases(storage, next);
  return { theme, canvases: next };
}

/**
 * 改一条主题轴（每一个主题控件的唯一落点）
 *
 * 一次做三件事：
 *  1. 写应用级 store（`m3e:theme`）—— 下次打开还是它；
 *  2. 把新主题给当前这份文档；
 *  3. 盖到清单里**每一份画布**的文档上并落盘 —— 否则之后切过去的那一份
 *     会把它文档里存的旧主题带回屏幕上。
 *
 * 颜色页的亮度/跟随系统/对比度、形状页、字体页、动效页都只调它，谁也不自己去 setTheme。
 * 当前这份文档的落盘（`m3e:doc` 与当前标签页那一格）仍由编辑器的自动保存完成：
 * 主题进了 `doc`，自动保存自然会写它。
 */
export function setAppTheme(
  storage: Storage | undefined,
  canvases: CanvasState,
  activeDoc: Doc,
  patch: Partial<Theme>,
): { theme: Theme; canvases: CanvasState; doc: Doc } {
  const theme = normalizeTheme({ ...(loadStoredAppTheme(storage) ?? DEFAULT_THEME), ...patch });
  saveAppTheme(storage, theme);
  const next = withAppTheme(canvases, theme);
  saveCanvases(storage, next);
  return { theme, canvases: next, doc: { ...activeDoc, theme } };
}
