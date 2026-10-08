import type { CSSProperties } from "react";
import { GAME_NAV_TABS, KIND_TEXT,
  PRIZE_TEXT, REWARD_TEXT, Lang, TAB_LABELS, getLang, t, SELECT_OPTIONS } from "./i18n";
import { Contrast, isHex, isLightColor, onColorFor, schemeFromSeed } from "./color";

/* ---------- geometry ---------- */
export const H = 56; // M3 medium button height (dp)
export const GAP = 3; // connected group spacing
export const R_FULL = 28; // outer corner of a connected run
export const R_INNER = 8; // inner corner when connected (M3 small)

/** magnetic field size, along the run and across it */
export const SNAP_MAIN = 44;
export const SNAP_CROSS = 24;
/** how sharply the pull ramps up (higher = gentler at the edge) */
export const PULL_EXP = 2.2;
/** ms allowed for the landing animation before the item is committed */
export const SETTLE_MS = 340;

/** phone screen used by the "phone" canvas mode (Pixel-like, dp) */
/* Pixel-class phone, 412 dp wide; kept at 892 dp tall so the whole screen fits the canvas */
export const PHONE_W = 412;
export const PHONE_H = 892;
export const PHONE_R = 40;
export const DESKTOP_W = 1280;
export const DESKTOP_H = 800;
export const DESKTOP_R = 28;
/** M3 window size classes: a screen this wide is "expanded", where the navigation bar becomes a rail */
export const EXPANDED_W = 840;
export const isExpanded = (w: number) => w >= EXPANDED_W;
/** navigation rail: width, top inset and the pitch of one destination (56×32 indicator, label, gap) */
export const RAIL_W = 80;
/** How many lines a navigation's destinations take: more than `per` of them wrap. */
export const navRows = (count: number, per: number | undefined) => (per && per > 0 ? Math.max(1, Math.ceil(count / per)) : 1);

/** How many destinations share one line of a bar — one column of a rail. */
export const navPerLine = (count: number, per: number | undefined) => (per && per > 0 ? Math.min(count || 1, per) : count || 1);

/**
 * Where one destination of a navigation part sits: which line it is on, how far into that line, how
 * many share it and how many lines there are. A bar wraps a line at a time, a rail starts a new
 * column, and both the drawing and the hit areas are read off this, so a tap lands on the
 * destination it looks like it hits.
 */
export function navCell(count: number, per: number | undefined, index: number) {
  const perLine = navPerLine(count, per);
  const lines = Math.max(1, Math.ceil(Math.max(1, count) / perLine));
  const line = Math.floor(index / perLine);
  return {
    perLine,
    lines,
    line,
    at: index % perLine,
    /* a line with fewer destinations than the widest is the last one: a bar packs it to the
       trailing edge, which is where its hit areas have to sit too */
    inLine: Math.min(perLine, count - line * perLine),
  };
}

export const RAIL_TOP = 44;
/** the pill a folded navigation bar shrinks to: just room for its own arrow */
export const BAR_FOLDED_W = 56;
export const BAR_FOLDED_H = 56;
/** A tab row: the row itself, and the panel area a row gets when its panels are made for it. */
export const TAB_ROW_H = 48;
/** The label column a side tab row keeps on its left: the room its destinations need, which is what
 *  the page beside them starts after. */
export const SIDE_TAB_W = 132;
/** The share of a side row the labels take by default, as a percentage of its width. */
export const SIDE_RAIL_PCT = 32;
export const SIDE_RAIL_MIN = 10;
export const SIDE_RAIL_MAX = 50;
export const TAB_PANEL_H = 240;
export const RAIL_ITEM_H = 52;
export const RAIL_GAP = 12;
/** the fold / menu button heading a wide rail, and the gap before its destinations */
export const RAIL_HEADER_H = 48;
export const RAIL_HEADER_GAP = 4;
/**
 * The corner of the highlight a tapped destination wears — a navigation bar's or rail's own
 * active indicator — and the size of the words under it. The indicator is square rather than the
 * pill M3 draws, which is what a game's navigation reads like; both follow the document's shape
 * scale.
 */
export const NAV_INDICATOR_R = 8;
export const NAV_LABEL_FONT = 12;
/** The indicator is a square around the icon, not the wide pill M3 draws across the destination;
 *  it is as tall as the icon plus its padding, and the icon itself is a little bigger than M3's. */
export const NAV_INDICATOR = 38;
export const NAV_ICON = 26;

/** the room a rail keeps under its last destination */
export const RAIL_BOTTOM = 8;
/** the shortest a destination's cell may be squeezed to when a rail is too small for its column */
export const RAIL_CELL_MIN = 28;
/** M3 Expressive navigation rail tokens; the 80dp rail above is kept for saved sketches. */
export const RAIL_COLLAPSED_W = 96;
export const RAIL_EXPANDED_W = 220;
export const isWideRail = (it: Item) => it.railExpanded !== undefined || it.railModal === true;
export const railWidth = (it: Item) =>
  it.size ?? (it.railExpanded ? RAIL_EXPANDED_W : isWideRail(it) ? RAIL_COLLAPSED_W : RAIL_W);
/** Modal expansion overlays the body, retaining only the collapsed rail's layout slot. */
export const railLayoutWidth = (it: Item) => (it.railModal ? Math.min(RAIL_COLLAPSED_W, railWidth(it)) : railWidth(it));
/** Runtime-only expansion edge: copied by item edits, never included in JSON. */
export const railExpansionSide = Symbol("railExpansionSide");
/** Shared drawing / hit-area geometry. A wide rail is headed by its 48dp fold button, and the
 *  destinations begin just under it — the two are read from here by the canvas, the preview and the
 *  editor's own fold button, so what is drawn and what answers a tap cannot drift apart. */
export function railMetrics(it: Item) {
  const wide = isWideRail(it);
  /* The header sits 4dp below the top edge whether the rail is folded or not, so folding does not
     move the button; the destinations begin right under it. */
  const headerTop = wide ? 4 : 0;
  /* folded, the header is the whole pill and sits at its corner; open, it lines up with the
     destinations (16dp in an expanded rail, centred in a collapsed one) */
  const headerLeft = it.railFolded ? 4 : it.railExpanded ? 16 : Math.round((railWidth(it) - 48) / 2);
  const top = wide ? headerTop + RAIL_HEADER_H + RAIL_HEADER_GAP : RAIL_TOP;
  const itemHeight = wide ? 56 : RAIL_ITEM_H;
  const gap = wide ? (it.railExpanded ? 0 : 4) : RAIL_GAP;
  /* The destinations fit the rail the author gave it. A rail with room to spare keeps M3's own
     pitch; one too short for its column squeezes the cells together rather than letting them run
     out of the bottom of the rail. */
  const perColumn = Math.max(1, navPerLine(it.tabs?.length ?? 0, it.navPerRow));
  const avail = Math.max(0, (it.size2 ?? specOf(it).h) - top - RAIL_BOTTOM);
  const needed = perColumn * itemHeight + (perColumn - 1) * gap;
  const pitch = needed <= avail ? itemHeight + gap : Math.max(RAIL_CELL_MIN, avail / perColumn);
  return {
    width: railWidth(it),
    headerLeft,
    headerTop,
    inset: wide ? 12 : 6,
    top,
    itemHeight,
    gap,
    /** the distance from one destination to the next, squeezed when the rail is short */
    pitch,
    /** how tall a destination's own cell is */
    cellHeight: Math.min(itemHeight, pitch),
  };
}
/**
 * How far a navigation part moves when it folds, so that its own button stays where it was: a bar
 * keeps the corner its button sits in (trailing edge, bottom edge), a rail keeps its header put.
 * The caller applies the same shift the other way when the part opens again — the stored width and
 * height of a folded part are still the open ones, so both boxes can be measured either way.
 */
export function foldShift(it: Item, widths: Record<string, number>): { dx: number; dy: number } {
  if (it.kind === "bottomNav") {
    const open = sizeOf({ ...it, barFolded: false }, widths);
    const pill = sizeOf({ ...it, barFolded: true }, widths);
    /* the button owns the bar's trailing end and its full height, so the pill keeps that end (the
       bar shrinks to the right) and the button's centre: folding leaves the button itself alone */
    return { dx: open.w - pill.w, dy: Math.round((open.h - pill.h) / 2) };
  }
  if (it.kind === "navRail") {
    const open = railMetrics({ ...it, railFolded: false });
    const pill = railMetrics({ ...it, railFolded: true });
    return { dx: open.headerLeft - pill.headerLeft, dy: open.headerTop - pill.headerTop };
  }
  return { dx: 0, dy: 0 };
}

/**
 * The ink a navigation destination's label reads in. The label sits on the part's own background —
 * the indicator pill is only the icon's own circle — so a selected label is `onSurface` and the
 * pill keeps `onSecondaryContainer` for the icon: reading the label in the pill's ink painted
 * white words on a white rail under any scheme whose pill is dark.
 */
export const navLabelInk = (on: boolean): TextToken => (on ? "onSurface" : "onSurfaceVariant");

/**
 * Where one destination of a rail sits: the column it is in, how far across and down that is, and
 * the room its own cell takes. A wide rail starts a new column at its own width; the 80dp rail kept
 * for saved sketches packs its columns into a centred row. The drawing and the hit areas are both
 * read from this, so a tap on the second column cannot land on the first.
 */
export function railCell(it: Item, count: number, index: number) {
  const rail = railMetrics(it);
  const wide = isWideRail(it);
  const cell = navCell(count, it.navPerRow, index);
  /* A destination takes the room the rail has for it: the plain 56dp-wide pill on a rail at its own
     width, and the whole inner width once the author stretches the rail — which is what gives a
     longer label somewhere to be. A rail squeezed narrower takes its destinations down with it. */
  const itemW = Math.max(RAIL_CELL_MIN, rail.width - 12);
  /* the narrow rail's columns are laid out as one centred row */
  const spread = cell.lines * itemW + (cell.lines - 1) * RAIL_GAP;
  const start = Math.round((wide ? 0 : (rail.width * cell.lines - spread) / 2));
  const pitch = wide ? rail.width : itemW + RAIL_GAP;
  return {
    left: (wide ? rail.inset : start) + cell.line * pitch,
    width: wide ? rail.width - rail.inset * 2 : itemW,
    top: rail.top + cell.at * rail.pitch,
    height: rail.cellHeight,
  };
}

/** system insets: the status bar above a top app bar and the gesture area below a navigation bar.
 *  Both bars carry their inset as extra height so their background reaches the rounded screen edge.
 *  A navigation bar centres its destinations in the whole box rather than in the 80dp above its
 *  inset: the row is short enough to stay clear of the gesture area, and centring it in the inset
 *  box instead left a hem under the labels that read as a mistake. */
export const STATUS_BAR_H = 24;
export const NAV_BAR_H = 24;
/** M3 layout margin: parts that are not edge-to-edge sit this far from the screen edge */
export const PHONE_MARGIN = 16;
export const contentWidth = (width: number) => width - PHONE_MARGIN * 2;
export const halfWidth = (width: number) => (contentWidth(width) - PHONE_MARGIN) / 2;
/** width of a part that spans the screen with a margin on both sides */
export const CONTENT_W = contentWidth(PHONE_W);
/** width of one of two parts sharing a row, with a margin-sized gutter between them */
export const HALF_W = halfWidth(PHONE_W);
/** width presets offered in the inspector: two columns, with margins, edge-to-edge */
export const WIDTH_PRESETS = [HALF_W, CONTENT_W, PHONE_W];
/** height presets for free-form boxes: half the screen, the whole screen */
export const HEIGHT_PRESETS = [PHONE_H / 2, PHONE_H];
/** bezel around the screen and the label above it */
export const BEZEL = 10;
export const FRAME_LABEL_H = 44;
/** horizontal distance between newly added frames */
export const FRAME_GAP = 120;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const uid = () => Math.random().toString(36).slice(2, 10);

export type Radii = { tl: number; tr: number; bl: number; br: number };
export const uniformRadii = (r: number): Radii => ({ tl: r, tr: r, bl: r, br: r });

/* ---------- color ---------- */
export type Palette = {
  key: string;
  label: string;
  /** the color a custom scheme was generated from */
  seed?: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  inversePrimary: string;
  secondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  surface: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
};

const ERROR = {
  error: "#B3261E",
  onError: "#FFFFFF",
  errorContainer: "#F9DEDC",
  onErrorContainer: "#410E0B",
};

/* presets are authored without secondary; it is derived from the seed below */
const PRESETS: Omit<Palette, "secondary">[] = [
  {
    key: "purple",
    label: "Purple",
    primary: "#6750A4",
    onPrimary: "#FFFFFF",
    primaryContainer: "#EADDFF",
    onPrimaryContainer: "#21005D",
    inversePrimary: "#D0BCFF",
    secondaryContainer: "#E8DEF8",
    onSecondaryContainer: "#1D192B",
    tertiaryContainer: "#FFD8E4",
    onTertiaryContainer: "#31111D",
    surface: "#FEF7FF",
    surfaceContainerLow: "#F7F2FA",
    surfaceContainer: "#F3EDF7",
    surfaceContainerHigh: "#ECE6F0",
    surfaceContainerHighest: "#E6E0E9",
    onSurface: "#1D1B20",
    onSurfaceVariant: "#49454F",
    outline: "#79747E",
    outlineVariant: "#CAC4D0",
    inverseSurface: "#322F35",
    inverseOnSurface: "#F5EFF7",
    ...ERROR,
  },
  {
    key: "blue",
    label: "Blue",
    primary: "#0B57D0",
    onPrimary: "#FFFFFF",
    primaryContainer: "#D3E3FD",
    onPrimaryContainer: "#041E49",
    inversePrimary: "#A8C7FA",
    secondaryContainer: "#DCE2F9",
    onSecondaryContainer: "#131C2B",
    tertiaryContainer: "#FFD8EE",
    onTertiaryContainer: "#2E1125",
    surface: "#FAF9FD",
    surfaceContainerLow: "#F3F3FA",
    surfaceContainer: "#EEEDF3",
    surfaceContainerHigh: "#E9E8EF",
    surfaceContainerHighest: "#E3E2E6",
    onSurface: "#1B1B1F",
    onSurfaceVariant: "#44474E",
    outline: "#74777F",
    outlineVariant: "#C4C6D0",
    inverseSurface: "#303034",
    inverseOnSurface: "#F2F0F4",
    ...ERROR,
  },
  {
    key: "green",
    label: "Green",
    primary: "#2E6A45",
    onPrimary: "#FFFFFF",
    primaryContainer: "#B0F1C2",
    onPrimaryContainer: "#00210F",
    inversePrimary: "#95D5A7",
    secondaryContainer: "#D3E8D8",
    onSecondaryContainer: "#102016",
    tertiaryContainer: "#C2E8FF",
    onTertiaryContainer: "#001E2C",
    surface: "#F6FBF4",
    surfaceContainerLow: "#F0F5EE",
    surfaceContainer: "#EAF0E8",
    surfaceContainerHigh: "#E4EAE2",
    surfaceContainerHighest: "#DEE4DC",
    onSurface: "#181D18",
    onSurfaceVariant: "#414941",
    outline: "#707972",
    outlineVariant: "#BFC9C0",
    inverseSurface: "#2D322D",
    inverseOnSurface: "#EEF2EB",
    ...ERROR,
  },
  {
    key: "coral",
    label: "Coral",
    primary: "#984061",
    onPrimary: "#FFFFFF",
    primaryContainer: "#FFD9E2",
    onPrimaryContainer: "#3E001D",
    inversePrimary: "#FFB0C8",
    secondaryContainer: "#F6DDE4",
    onSecondaryContainer: "#31101D",
    tertiaryContainer: "#FFDBCA",
    onTertiaryContainer: "#2C1600",
    surface: "#FFF8F8",
    surfaceContainerLow: "#FCF0F2",
    surfaceContainer: "#F6EBED",
    surfaceContainerHigh: "#F3E5E9",
    surfaceContainerHighest: "#EEE0E3",
    onSurface: "#201A1B",
    onSurfaceVariant: "#524346",
    outline: "#847377",
    outlineVariant: "#D5C2C6",
    inverseSurface: "#352F30",
    inverseOnSurface: "#FAEEEF",
    ...ERROR,
  },
  {
    key: "amber",
    label: "Amber",
    primary: "#8B5000",
    onPrimary: "#FFFFFF",
    primaryContainer: "#FFDCC2",
    onPrimaryContainer: "#2C1600",
    inversePrimary: "#FFB77C",
    secondaryContainer: "#F6DFC8",
    onSecondaryContainer: "#271905",
    tertiaryContainer: "#D5EDC0",
    onTertiaryContainer: "#0E2004",
    surface: "#FFF8F5",
    surfaceContainerLow: "#FCF1EA",
    surfaceContainer: "#F7ECE4",
    surfaceContainerHigh: "#F3E6DE",
    surfaceContainerHighest: "#EDE0D8",
    onSurface: "#211A14",
    onSurfaceVariant: "#51443B",
    outline: "#83746A",
    outlineVariant: "#D6C3B6",
    inverseSurface: "#362F28",
    inverseOnSurface: "#FBEEE5",
    ...ERROR,
  },
  {
    key: "teal",
    label: "Teal",
    primary: "#00696E",
    onPrimary: "#FFFFFF",
    primaryContainer: "#9CF1F6",
    onPrimaryContainer: "#002022",
    inversePrimary: "#80D5DA",
    secondaryContainer: "#CCE8E9",
    onSecondaryContainer: "#051F20",
    tertiaryContainer: "#D2E4FF",
    onTertiaryContainer: "#001C3B",
    surface: "#F4FBFB",
    surfaceContainerLow: "#EEF5F5",
    surfaceContainer: "#E8EFEF",
    surfaceContainerHigh: "#E2EAEA",
    surfaceContainerHighest: "#DDE4E4",
    onSurface: "#161D1D",
    onSurfaceVariant: "#3F4948",
    outline: "#6F7979",
    outlineVariant: "#BEC8C8",
    inverseSurface: "#2B3232",
    inverseOnSurface: "#ECF2F2",
    ...ERROR,
  },
  {
    key: "mono",
    label: "Mono",
    primary: "#4A4459",
    onPrimary: "#FFFFFF",
    primaryContainer: "#E6E0F0",
    onPrimaryContainer: "#1A1626",
    inversePrimary: "#CFC3E0",
    secondaryContainer: "#E6E1E6",
    onSecondaryContainer: "#1B1B1F",
    tertiaryContainer: "#E9E0EA",
    onTertiaryContainer: "#1E1A22",
    surface: "#FCF8FD",
    surfaceContainerLow: "#F5F1F6",
    surfaceContainer: "#EFEBF0",
    surfaceContainerHigh: "#E9E5EA",
    surfaceContainerHighest: "#E4E0E5",
    onSurface: "#1C1B1F",
    onSurfaceVariant: "#48454E",
    outline: "#79747E",
    outlineVariant: "#CAC4D0",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    ...ERROR,
  },
];
export const PALETTES: Palette[] = PRESETS.map((p) => ({ ...p, secondary: schemeFromSeed(p.primary, p.label, { keepChroma: true }).secondary }));

/** 一份画布的默认配色：Mono（`PALETTES` 里 key 为 `"mono"` 的那一套，预设里的第五套）。
 *  新建画布、缺 paletteKey 的老文档、清空后回落的默认值都读它，
 *  免得"默认配色"在几处各写一遍字符串。
 *  注意它**不是** `PALETTES[0]`（那是 Purple）：出厂默认已经是 Mono，
 *  读文档补默认值的地方要么用它，要么写 `PALETTES[0].key` 就等于把默认配方又写死回紫色。 */
export const DEFAULT_PALETTE_KEY = "mono";

/* ---------- theme: the four expressive axes ---------- */
export type ShapeScale = "square" | "rounded" | "full";
export type FontKey = "roboto" | "robotoFlex" | "robotoSerif" | "system";
export type MotionScheme = "standard" | "expressive";
export type { Contrast };

export type Theme = {
  dark: boolean;
  /** 跟随系统深浅色（深浅色模式）：开着时上屏的 `dark` 由系统决定，
   *  见 lib/systemTheme.ts 的 themeForSystem；`dark` 这时只是"系统还不知道"时的兜底
   *  （SSR / 首帧），以及关掉它之后要用哪一个 */
  bothModes: boolean;
  contrast: Contrast;
  shape: ShapeScale;
  font: FontKey;
  /** headings and labels take the heavier M3 Expressive "emphasized" styles */
  emphasized: boolean;
  motion: MotionScheme;
};

/** 出厂设置：Mono 配色 + 高对比度 + 跟随系统深浅色（深浅色模式），其余轴是 M3 的标准那套。
 *  `dark: false` 是有意的：跟随系统时真正的深/浅由 lib/systemTheme.ts 决定，
 *  这里只是系统还没读到之前的兜底（SSR 与首帧画的就是它），以及关掉跟随系统后的落点。 */
export const DEFAULT_THEME: Theme = { dark: false, bothModes: true, contrast: "high", shape: "rounded", font: "roboto", emphasized: false, motion: "standard" };

/** a stored theme with any missing or unknown field replaced by its default */
export function normalizeTheme(t: Partial<Theme> | undefined): Theme {
  const d = DEFAULT_THEME;
  if (!t) return d;
  return {
    dark: typeof t.dark === "boolean" ? t.dark : d.dark,
    bothModes: typeof t.bothModes === "boolean" ? t.bothModes : d.bothModes,
    contrast: CONTRASTS.some((c) => c.key === t.contrast) ? (t.contrast as Contrast) : d.contrast,
    shape: SHAPES.some((c) => c.key === t.shape) ? (t.shape as ShapeScale) : d.shape,
    font: FONTS.some((c) => c.key === t.font) ? (t.font as FontKey) : d.font,
    emphasized: typeof t.emphasized === "boolean" ? t.emphasized : d.emphasized,
    motion: t.motion === "expressive" || t.motion === "standard" ? t.motion : d.motion,
  };
}

export const SHAPES: { key: ShapeScale; label: string; icon: string }[] = [
  { key: "square", label: "Square", icon: "crop_square" },
  { key: "rounded", label: "Rounded", icon: "rounded_corner" },
  { key: "full", label: "Full", icon: "circle" },
];

export const FONTS: { key: FontKey; label: string; family: string; /** Google Fonts family to fetch, if any */ google?: string }[] = [
  { key: "roboto", label: "Roboto", family: "Roboto, system-ui, sans-serif" },
  { key: "robotoFlex", label: "Roboto Flex", family: "'Roboto Flex', Roboto, system-ui, sans-serif", google: "Roboto+Flex:wght@400;500;600;700" },
  { key: "robotoSerif", label: "Roboto Serif", family: "'Roboto Serif', Georgia, serif", google: "Roboto+Serif:wght@400;500;600;700" },
  { key: "system", label: "System", family: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
];

/** The Noto Sans face that covers a language's script, spliced in behind the chosen
 *  face so CJK text renders the same on every OS. English needs none. */
export const LANG_FONT: Record<Lang, { family: string; google: string } | null> = {
  ja: { family: "'Noto Sans JP'", google: "Noto+Sans+JP:wght@400;500;600;700" },
  zh: { family: "'Noto Sans SC'", google: "Noto+Sans+SC:wght@400;500;600;700" },
  ko: { family: "'Noto Sans KR'", google: "Noto+Sans+KR:wght@400;500;600;700" },
  en: null,
};

/** a family list with the language's Noto face placed before the generic fallbacks */
const withLangFont = (family: string, lang?: Lang) => {
  const extra = lang ? LANG_FONT[lang]?.family : undefined;
  if (!extra) return family;
  const parts = family.split(",").map((s) => s.trim());
  const at = parts.findIndex((s) => /^(system-ui|-apple-system|Georgia|serif|sans-serif)$/.test(s));
  parts.splice(at < 0 ? parts.length : at, 0, extra);
  return parts.join(", ");
};

/** the chosen face, with the language's Noto face behind it; the system font is left to the device */
export const fontFamilyOf = (f: FontKey, lang?: Lang) => {
  const family = FONTS.find((x) => x.key === f)?.family ?? FONTS[0].family;
  return f === "system" ? family : withLangFont(family, lang);
};
/** the editor's own font: Roboto, then the language's Noto face */
export const uiFontFamily = (lang?: Lang) => withLangFont("Roboto, system-ui, sans-serif", lang);

export const CONTRASTS: { key: Contrast; label: string }[] = [
  { key: "standard", label: "Standard" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

/** the shape scale that rendering helpers read outside React; the page sets it once per render */
let curShape: ShapeScale = "rounded";
export const setGlobalShape = (s: ShapeScale) => {
  curShape = s;
};
export const getShape = () => curShape;

/** a default corner radius under the document's shape scale */
export function scaleR(r: number): number {
  if (curShape === "square") return Math.round(r * 0.35);
  if (curShape === "full") return Math.round(r * 1.6);
  return r;
}

/** The scheme the document renders with. Hand-written presets and the author's
 *  fine-tuned custom scheme are light and standard contrast; dark mode and the
 *  other contrast levels are generated from the same seed. */
export function paletteOf(key: string, custom?: Palette | null, theme?: Theme): Palette {
  /* 认不出的 key（老文档、别的构建写下的值）落在**出厂默认配色**上，而不是预设里的第一套：
     "默认是哪一套"只有 DEFAULT_PALETTE_KEY 一处。`PALETTES[0]` 只在连默认都查不到时兜底。 */
  const fallback = PALETTES.find((p) => p.key === DEFAULT_PALETTE_KEY) ?? PALETTES[0];
  const base = (key === "custom" && custom) || PALETTES.find((p) => p.key === key) || fallback;
  if (!theme || (!theme.dark && theme.contrast === "standard")) {
    /* Saved custom schemes may predate the secondary role. */
    return base.secondary ? base : { ...base, secondary: schemeFromSeed(base.seed ?? base.primary).secondary };
  }
  const seed = base.seed ?? base.primary;
  /* a preset's hue and chroma are deliberate (Mono is nearly grey), so they are kept as they are */
  return { ...schemeFromSeed(seed, base.label, { dark: theme.dark, contrast: theme.contrast, keepChroma: base.key !== "custom" }), key: base.key };
}

/* ---------- contrast roles a component can take ---------- */
export type Variant = "filled" | "tonal" | "elevated" | "outlined" | "text";

export const VARIANTS: { key: Variant; label: string }[] = [
  { key: "filled", label: "Filled" },
  { key: "tonal", label: "Tonal" },
  { key: "elevated", label: "Elevated" },
  { key: "outlined", label: "Outlined" },
  { key: "text", label: "Text" },
];

export const isVariant = (v: unknown): v is Variant => VARIANTS.some((variant) => variant.key === v);

export function variantStyle(v: Variant, p: Palette): CSSProperties {
  switch (v) {
    case "filled":
      return { background: p.primary, color: p.onPrimary, border: "none" };
    case "tonal":
      return { background: p.secondaryContainer, color: p.onSecondaryContainer, border: "none" };
    case "elevated":
      return { background: p.surfaceContainerLow, color: p.primary, border: "none" };
    case "outlined":
      return { background: "transparent", color: p.primary, border: `1px solid ${p.outline}` };
    case "text":
      return { background: "transparent", color: p.primary, border: "none" };
  }
}

/**
 * How much bigger or smaller than M3's medium button a button is: its words, its icon and its
 * padding scale with this, so a button the author makes taller grows everything inside it too.
 */
export const buttonScale = (it: Item) => (it.size2 ?? H) / H;

/**
 * 按钮里每一块占多大 —— 图标、字号、内边距、相邻两块之间留的缝。包围盒（sizeOf，量不到时走
 * buttonWidth）和绘制（M3Node 的 ButtonContent）都从这里取，所以"盒子大小"和"画出来的样子"不会各说
 * 各话。
 *
 * **这一行只有左图标和文字两块**：按钮不再有自己的右徽标（作者：「去掉此属性」—— 那几个角上的徽标
 * 仍旧是功能按钮、物品格和任务信息条自己的），所以 gap 是"图标与文字同时存在才留"、pad 是 22 / 26 /
 * 16、图标是 24 * scale。
 */
export const buttonMetrics = (it: Partial<Item>) => {
  const scale = buttonScale(it as Item);
  const hasIcon = !!it.icon;
  const hasLabel = !!(it.label ?? "").trim();
  const pieces = [hasIcon, hasLabel].filter(Boolean).length;
  return {
    scale,
    icon: Math.round(24 * scale),
    font: Math.round(16 * scale),
    /** 相邻两块之间留的缝：只有一块内容时不留 */
    gap: pieces > 1 ? Math.round(8 * scale) : 0,
    /** 行里的内容块数（左图标 / 文字），画和量都按它排 */
    pieces,
    /** 两端的留白：有字有图标是 22，只有字是 26，连字都没有是 16（M3 的按钮内边距） */
    pad: Math.round((hasLabel ? (hasIcon ? 22 : 26) : 16) * scale),
  };
};

/**
 * 右徽标那枚药丸的宽：画它的是 BadgeContent（见 M3Node），这里复算的是同一件事 —— 里面的数字/文字
 * 按它自己的字号估一个宽（assetPillTextWidth，和资产框共用那份"量不到时的兜底"），两边是它自己的内边距
 * max(2, 高/4)，并且不窄于自己的高（BadgeContent 的 minWidth）—— 所以一位数就是一枚 16dp 的圆药丸。
 * 没有字就是没有徽标，宽 0。
 */
export const buttonBadgeWidth = (text: string, height: number): number => {
  const t = text.trim();
  if (!t) return 0;
  const pad = Math.max(2, Math.round(height / 4));
  const font = Math.max(8, Math.min(20, Math.round(height * 0.7)));
  return Math.max(height, assetPillTextWidth(t, font) + pad * 2);
};

/**
 * 按钮在没有浏览器测量时的自然宽度（服务端渲染、静态导出、首帧、测试）：两端留白 + 行里每一块内容，
 * 加上相邻两块之间的间距 —— 缺的图标既不占图标也不占间距，所以把一个图标拿掉按钮就变短。
 *
 * 量的就是 ButtonContent 画的那一行：**只有左图标和文字** —— 右上角那枚药丸是绝对定位的，不占行里的
 * 位置，所以挂不挂徽标都是这个数（看那枚药丸自己多宽，见 buttonBadgeWidth）。真正画在编辑器里时按钮是
 * MEASURED 的：宽度由浏览器量出这一行的自然宽（同样与徽标无关），作者钉了宽度就用作者的数字（见
 * sizeOf）；**sizeOf 从不走这里** —— 它给的始终是 kind 自己的 w（或者作者钉的宽），有没有徽标都一样，
 * 于是徽标开、关，按钮的盒子逐字不变。
 */
export const buttonWidth = (it: Partial<Item>): number => {
  const m = buttonMetrics(it);
  const label = (it.label ?? "").trim();
  const pieces = [it.icon ? m.icon : 0, label ? assetPillTextWidth(label, m.font) : 0].filter((n) => n > 0);
  const inner = pieces.reduce((sum, n) => sum + n, 0) + Math.max(0, pieces.length - 1) * m.gap;
  return Math.max(SIZE_MIN, Math.round(m.pad * 2 + inner));
};

export function variantShadow(v: Variant): string {
  if (v === "elevated") return "0 1px 3px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.10)";
  return "none";
}

/** The shadow a floating button wears so it reads as floating on any surface. Named once so the part
 *  that draws one (see `shadowOf` and the function button's circle) cannot drift apart. */
export const FAB_SHADOW = "0 3px 8px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.12)";

/**
 * 样式 set a kind offers in the inspector, with the labels the author sees. It lives here, beside the
 * variants themselves, because it is data about kinds — and so the sets can be compared in a test.
 *
 * 功能按钮 takes the button kind's own set: 作者要求"增加描边和标准，参考按钮组件"，所以它不再用 FAB
 * 的那一小套（填充/色调），而是按钮的五种。
 */
export function variantsOf(kind: Kind): { key: Variant; label: string }[] {
  const variants = VARIANTS.map((v) => ({ ...v, label: t(v.key) }));
  switch (kind) {
    case "card":
      return [
        { key: "tonal", label: t("filled") },
        { key: "elevated", label: t("elevated") },
        { key: "outlined", label: t("outlined") },
      ];
    case "textField":
    case "select":
      return [
        { key: "outlined", label: t("outlined") },
        { key: "filled", label: t("filled") },
      ];
    case "chip":
      return [
        { key: "outlined", label: t("outlined") },
        { key: "tonal", label: t("elevated") },
      ];
    case "fab":
    case "extendedFab":
      return variants.filter((v) => v.key !== "text" && v.key !== "elevated" && v.key !== "outlined");
    case "splitButton":
      return variants.filter((v) => v.key !== "text");
    case "toolbar":
      return [
        { key: "tonal", label: t("standard") },
        { key: "filled", label: t("vibrant") },
      ];
    case "iconButton":
      return variants.filter((v) => v.key !== "elevated" && v.key !== "text").concat({
        key: "text",
        label: t("standard"),
      });
    default:
      return variants;
  }
}

/* ---------- component kinds ---------- */
export type Kind =
  | "box"
  | "invGrid"
  | "button"
  | "iconButton"
  | "fab"
  | "extendedFab"
  | "fnButton"
  | "itemCell"
  | "chip"
  | "topAppBar"
  | "bottomNav"
  | "navRail"
  | "searchBar"
  | "card"
  | "listItem"
  | "dialog"
  | "snackbar"
  | "textField"
  | "select"
  | "switch"
  | "checkbox"
  | "slider"
  | "stepper"
  /** A kind the palette no longer offers: documents written while it existed are read back as a
   *  plain slider when they open, so nothing an author drew is lost. */
  | "sliderInput"
  | "text"
  | "image"
  | "camera"
  | "map"
  | "divider"
  | "loadingIndicator"
  | "linearProgress"
  | "progressBar"
  | "circularProgress"
  | "splitButton"
  | "assetPill"
  /** 任务信息条：任务的信息、两个奖励格和一个「领取」按钮，全在一个部件里（见 taskBarMetrics） */
  | "taskBar"
  /** 确认框：标题、正文和两颗按钮全在一个部件里（见 confirmBoxMetrics）。这是第二个**融合部件**：
   *  它和任务信息条一样没有孩子，看起来像按钮的那两块画在自己里面，点击归它们
   *  （见 tapLivesInside / PartPressContext），整块框不吃点击。 */
  | "confirmBox"
  | "toolbar"
  | "tabs"
  | "sideTabs"
  | "joystick"
  | "wheel"
  | "gridWheel"
  | "gacha"
  | "slot"
  | "calendar"
  /* Retired kinds: the palette no longer offers them, a document that holds one is still read
     (see LEGACY_KINDS), and the editor turns it into the part that replaced it. */
  | "moneyTree"
  | "eggSmash"
  | "rewardTrack"
  | "radio"
  | "badge";

/**
 * A row whose children are the pages of its tabs: the tabs across the top, and the same thing stood on
 * its side, with the destinations down the left. Everything about panels — one per tab, in tab order,
 * the one in front drawn — is the same for both, so they are one thing to the rest of the editor.
 */
export const isTabRow = (it: Item | null | undefined): boolean => !!it && (it.kind === "tabs" || it.kind === "sideTabs");

/** Whether a destination draws its icon, and the badge it carries when it has one. A destination can
 *  hide either without losing it: an author who takes a badge away for a while wants it back. */
export const tabShowsIcon = (tab: NavTab) => !tab.hideIcon && !!tab.icon;
export const tabBadge = (tab: NavTab): string | null => (tab.hideBadge ? null : (tab.badge ?? "").trim() || null);

/** Which edge of a tab row its labels sit on. A row across the page uses top or bottom; a row stood on
 *  its side uses left or right. */
export type TabSide = "top" | "bottom" | "left" | "right";
export const TAB_SIDES: TabSide[] = ["top", "bottom", "left", "right"];
export const isTabSide = (v: unknown): v is TabSide => TAB_SIDES.some((s) => s === v);

/**
 * Where a tab row keeps its labels — and so where its page goes, which is the other side. A value the
 * kind does not use reads as that kind's own default, so a document drawn before the choice existed,
 * or one whose kind changed, keeps the look it was designed with: the strip on top, the labels on the
 * left.
 */
export const labelSideOf = (it: { kind?: Kind; tabSide?: TabSide }): TabSide =>
  it.kind === "sideTabs" ? (it.tabSide === "right" ? "right" : "left") : it.tabSide === "bottom" ? "bottom" : "top";
/** The side row: the labels stand in a column instead of a strip. */
export const isSideTabs = (it: Item | undefined): boolean => !!it && it.kind === "sideTabs";

export type Axis = "x" | "y";
/** kinds that fuse into a run: buttons side by side, list items stacked */
export type ConnectSpec = { axis: Axis; outer: number; inner: number; family: string };

/** `presets` are quick picks shown as chips; values outside min..max are hidden */
export type SizeSpec = { min: number; max: number; step: number; icon: string; presets?: number[] };

export type Category = "actions" | "navigation" | "containment" | "inputs" | "content" | "progress" | "features";

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "actions", label: "Actions", icon: "touch_app" },
  { key: "navigation", label: "Navigation", icon: "explore" },
  { key: "containment", label: "Containment", icon: "web_asset" },
  { key: "inputs", label: "Inputs", icon: "toggle_on" },
  { key: "content", label: "Content", icon: "notes" },
  { key: "progress", label: "Progress", icon: "progress_activity" },
  { key: "features", label: "Features", icon: "auto_awesome" },
];

export type KindSpec = {
  label: string;
  /** short Japanese noun used by the prompt generator */
  noun: string;
  category: Category;
  paletteIcon: string;
  /** intrinsic size; buttons measure their content, sized kinds use `size` */
  w: number;
  h: number;
  radius: number;
  hasVariant: boolean;
  hasLabel: boolean;
  hasSupporting: boolean;
  hasIcon: boolean;
  hasChecked?: boolean;
  /** carries a list of icon + label entries (navigation bar, tabs, toolbar) */
  hasTabs?: boolean;
  /** second dimension (height) for free-form boxes */
  size2?: SizeSpec;
  hasFill?: boolean;
  /** offers the scroll switch: the axes a container's content can be moved along */
  hasScroll?: boolean;
  hasValue?: boolean;
  /** carries a pool of prizes, each with its own chance: a wheel that is drawn */
  hasPrizes?: boolean;
  /** carries a list of rewards along a track, each claimable at its own progress */
  hasRewards?: boolean;
  hasWavy?: boolean;
  hasContained?: boolean;
  connect?: ConnectSpec;
  size?: SizeSpec;
  defLabel: string;
  defIcon: string | null;
  defSupporting?: string;
  /** the words a fresh part's own second button starts with, where a kind has one (the task bar's
   *  「领取」, a gacha's 10-draw button — see `Item.label2`) */
  defLabel2?: string;
  /** the words a fresh part's own **third** button starts with: one kind has one — the confirm box's
   *  取消 (see `Item.label3`) */
  defLabel3?: string;
  /** the words a fresh part's corner marks start with (see `Item.badgeText` / `Item.badge2Text`) */
  defBadgeText?: string;
  defBadge2Text?: string;
  /** the words a fresh task bar's button badge starts with (see `Item.buttonBadgeText`) */
  defButtonBadgeText?: string;
  defIcon2?: string;
  defSize?: number;
  defVariant?: Variant;
};

/** How tall a slider is: its track and handle, and the room above them for the number when the
 *  author asks the part to show one. */
export const SLIDER_H = 44;
export const SLIDER_VALUE_H = 64;

/** The pad a direction wheel is drawn at, and the two prize wheels: all three are square by
 *  default, so a width the author sets carries the height with it. */
export const JOYSTICK_SIZE = 132;
export const WHEEL_SIZE = 220;
export const GRID_WHEEL_SIZE = 240;
/** the capsule machine, the slot machine and the check-in calendar */
export const GACHA_W = 170;
export const GACHA_H = 210;
export const SLOT_W = 280;
export const SLOT_H = 150;
export const CALENDAR_W = 300;
export const CALENDAR_H = 280;
/** how many days a check-in calendar shows, and how many fit on one row */
export const CALENDAR_DAYS = 30;
export const CALENDAR_COLS = 7;
/** How far the knob of a direction wheel travels from the middle, at the pad's default size. It is
 *  a share of the pad, so a bigger pad has a bigger travel and the pad keeps its look. */
export const JOYSTICK_TRAVEL = 0.32;
/** The turn a pad's knob measures, in degrees: a full circle. The pad has no value of its own to set
 *  (see its spec), so this is the geometry of the stick rather than a range an author fills in. */
export const JOYSTICK_MAX = 360;

/** The smallest a part may be dragged to. Every part allows it, whatever it is: a prototype often
 *  needs a two-character-wide button or a thumbnail of a screen, and a part smaller than its content
 *  clips the way a real one does — refusing the size would only make the author fight the editor. */
export const SIZE_MIN = 20;

/* ---------- the function button's countdown ---------- */

/** The line of words under a function button's circle: its name, and the countdown below it while the
 *  timer is on. Thirteen is a 50dp button's line, which is what makes a fresh one 50×76 — the size the
 *  floating button with its stack of two lines has always been. */
/* 一行文字要占多高
 *
 * 13 画出来的字只有 12px，作者反馈"有点小"。字要放大，行框就必须跟着长 ——
 * 否则字会顶到行外去（行的位置是按这个值算的，见 fnButtonHeight）。 */
export const FN_BUTTON_LINE = 18;
/** How tall a function button is: its own width as a circle, plus a line for each line it actually
 *  draws — an empty name and a switched-off timer take no room at all. An author who wants a different
 *  proportion sets the height outright (`Item.size2`), which is what the inspector's height slider
 *  writes and which wins over this. */
export const fnButtonHeight = (size: number, lines: number) => size + FN_BUTTON_LINE * lines;

/** The units a countdown counts in: a day, an hour, a minute, a second. */
export type TimerUnit = "day" | "hour" | "minute" | "second";
export const TIMER_UNITS: TimerUnit[] = ["day", "hour", "minute", "second"];
export const isTimerUnit = (v: unknown): v is TimerUnit => TIMER_UNITS.some((u) => u === v);
/** how many seconds one unit of a countdown is worth, for the ones written as a clock */
const TIMER_SECONDS: Record<TimerUnit, number> = { day: 86400, hour: 3600, minute: 60, second: 1 };
/** What a fresh function button counts down: three minutes, so a dropped one reads 03:00. */
export const TIMER_DEF_VALUE = 3;
export const TIMER_DEF_UNIT: TimerUnit = "minute";
/** The top of a countdown, in whatever unit it counts in: two hours, or two minutes, or a hundred and
 *  twenty days. A number the author types into the slider, and the ceiling every reader clamps to. */
export const TIMER_VALUE_MAX = 120;

/* ---------- the item cell ---------- */

/** The line of words under an item cell: the item's own name. Sixteen is a 60dp cell's line, which is
 *  what makes a fresh one 60×76 — the size the 背包格子 composite has always been. */
export const ITEM_CELL_LINE = 16;
/** How tall a cell is: the square itself, plus a line for the name under it when it has one. An empty
 *  name takes no room at all, and a height the author pinned wins over this (see `sizeOf`). */
export const itemCellHeight = (size: number, lines: number) => size + ITEM_CELL_LINE * lines;
/** How many lines of words the cell draws under itself: its name, when it has one. */
export const itemCellLines = (it: Item) => ((it.label ?? "").trim() ? 1 : 0);
/** 资产框的图标与金额之间可以留多宽：编辑器的滑杆上限，读回来也按它封顶 */
export const MARK_GAP_MAX = 24;

/**
 * 资产框的排版尺寸 —— 内容行有多高、图标多大、留白多宽、字多大。包围盒（sizeOf）和绘制（M3Node）
 * 都从这里取，所以"盒子大小"和"画出来的样子"不会各说各话。
 *
 * 每一项都跟着绘制高度走：比高 28 的时候是 20dp 的圆图标、6dp 的间距、4dp 的左右留白、14dp 的字。
 * 间距（markGap）是唯一可以由作者改的一项，未设时按高度推算，和以前的样子一致。
 */
export const assetPillMetrics = (it: Partial<Item>) => {
  const h = it.size2 ?? KIND_SPEC.assetPill.h;
  return {
    h,
    chip: Math.max(12, Math.round(h * 0.72)),
    gap: it.markGap ?? Math.max(4, Math.round(h * 0.22)),
    inset: Math.max(3, Math.round(h * 0.14)),
    font: Math.max(9, Math.min(20, Math.round(h * 0.5))),
  };
};

/**
 * 一个字大约占几个 em —— 全角（汉字、假名、谚文）算 1、大写和数字 0.6〜0.68、小写 0.52、空格标点更窄。
 *
 * 这是**估算**，不是测量：资产框量不到宽度时用它兜底（见 assetPillTextWidth），确认框用它算正文折成
 * 几行（见 wrapTextLines）。两处共用同一支笔，所以"盒子多高"和"字画了几行"不会各说各话。
 */
export const glyphEm = (ch: string): number => {
  const code = ch.codePointAt(0) ?? 0;
  if (ch === " ") return 0.28;
  if (code >= 0x2e80) return 1; /* 汉字、假名、谚文、全角符号 */
  if (ch >= "0" && ch <= "9") return 0.6;
  if (ch >= "A" && ch <= "Z") return 0.68;
  if (ch >= "a" && ch <= "z") return 0.52;
  return 0.35; /* 小数点、逗号、币种符号…… */
};

/**
 * 资产框里文字有多宽的**估算** —— 不是测量，而是量不到时的兜底（服务端渲染、静态导出、首帧、测试）。
 * 一个字宽约一个字号：全角（汉字、假名、谚文）算 1em，大写和数字 0.6〜0.68em，小写 0.52em，空格标点
 * 更窄。空标签就是 0（不占位置）。
 *
 * 真正常用的是浏览器的量：资产框在 MEASURED 里，编辑器会把内容行隐式渲染一遍量出宽度交给 sizeOf
 * （见 M3Node 的 AssetPillContent 与 Editor 的测量层）。估算只在量不到时顶上——它偏短时也不会把文字
 * 挤掉：宽度由内容决定时文字不缩不省略（文字只在作者钉了宽度时才让位）。
 */
export const assetPillTextWidth = (text: string, font: number): number => {
  let em = 0;
  for (const ch of text) em += glyphEm(ch);
  return Math.round(em * font);
};

/**
 * 资产框的自然宽度：留白 + 每个存在的图标 + 文字，加上相邻两块之间的间距（缺的图标既不占图标也不占
 * 间距，所以删掉一个图标整条就变短）。文字按上面的估算算——这是量不到时的兜底；量得到时 sizeOf 用的
 * 是浏览器给的数（见 MEASURED）。作者钉了宽度就用作者的数字。
 */
export const assetPillWidth = (it: Partial<Item>): number => {
  const m = assetPillMetrics(it);
  const text = (it.label ?? "").trim();
  const pieces = [it.icon ? m.chip : 0, text ? assetPillTextWidth(text, m.font) : 0, it.icon2 ? m.chip : 0].filter((n) => n > 0);
  const inner = pieces.reduce((sum, n) => sum + n, 0) + Math.max(0, pieces.length - 1) * m.gap;
  return Math.max(SIZE_MIN, Math.round(m.inset * 2 + inner));
};

/** 资产框默认是长方形：用户明确要求"默认为长方形，可以设置圆角数值"，所以 radiusTop 未设时圆角为 0
 *  （名字里的 pill 是历史，不是默认形状）。
 *
 *  The corner an asset frame is drawn with: the number the author set, held inside what its height
 *  allows — past half the height a corner stops meaning anything (the browser distorts the shape).
 *  Zero, the default, is a sharp rectangle; half the height makes it a capsule. The corner follows the
 *  drawn height, so a frame the author shortened has its radius held to the new half-height rather
 *  than losing the shape. */
export const assetPillRadius = (it: Partial<Item>, height = sizeOf(it as Item, {}).h): number =>
  Math.min(Math.floor(height / 2), Math.max(0, Math.round(it.radiusTop ?? 0)));

/** The square a cell draws: its own width, or whatever a pinned height leaves once the name has its
 *  line — the drawing, the corner it is given and the marks on it all measure the cell with this. */
export const itemCellBox = (it: Item, width = it.size ?? KIND_SPEC.itemCell.defSize ?? KIND_SPEC.itemCell.w): number => {
  const lines = itemCellLines(it);
  return Math.max(8, Math.min(width, (it.size2 ?? itemCellHeight(width, lines)) - ITEM_CELL_LINE * lines));
};
/** 物品格的圆角：作者设的那个数（radiusTop，和资产框共用同一个「圆角」控件），按**格子画出来的
 *  正方形的一半**封顶 —— 格子是 60×76 的部件（正方形 + 名字那一行），量圆角要用里面那个正方形，
 *  不是部件的高度。不设就是 0，也就是直角。
 *
 *  The corner an item cell is drawn with, held inside what the drawn square allows — past half that
 *  square a corner stops meaning anything (the browser distorts the shape). Zero, the default the
 *  author asked for, is a sharp rectangle; half the square makes it a circle. */
export const itemCellRadius = (it: Partial<Item>, side = itemCellBox(it as Item)): number =>
  Math.min(Math.floor(side / 2), Math.max(0, Math.round(it.radiusTop ?? 0)));
/** 用户明确要求：物品格默认是直角 —— 所以这个"kind 自己的默认圆角"是 0（名字里 itemCellRadius
 *  才是真正画出来的圆角，作者设过就按作者的、并按正方形的一半封顶）。 */
export const ITEM_CELL_RADIUS = 0;
/** The surface a fresh cell sits on, and the green a fresh quality mark is written in — the two the
 *  背包格子 composite was drawn with. */
export const ITEM_CELL_FILL: ColorToken = "surfaceContainerHigh";
export const ITEM_CELL_QUALITY = "#7BAE7A";

/* ---------- the task bar ---------- */

/* 任务信息条的每一块占多大 —— 留白、标题那一行、格子那一行和里头那个按钮。包围盒（sizeOf）和绘制
 * （M3Node 的 TaskBarContent）都从这里取，所以"盒子大小"和"画出来的样子"不会各说各话。
 *
 * 这些数就是 任务信息条 composite 的那几个：13 的左右留白、14 的上留白、17dp 的标题（一行 22）、
 * 标题和格子之间 10、格子 56（composite 里的 56×60 的方块）、两个格子之间 23、底部 10 —— 加起来
 * 正好 112，也就是那个 composite 的高度，一个刚放下的任务信息条就是它。 */

/** 左右留白：标题、格子和最右边的按钮都从这里起步 */
export const TASK_BAR_PAD_X = 13;
/** 上留白 */
export const TASK_BAR_PAD_TOP = 14;
/** 下留白 */
export const TASK_BAR_PAD_BOTTOM = 10;
/** 标题的字号，和一行文字占多高 */
export const TASK_BAR_TITLE_FONT = 17;
export const TASK_BAR_TITLE_LINE = 22;
/** 标题和格子那一行之间留的缝 */
export const TASK_BAR_GAP = 10;
/** 一个奖励格的边长（正方形：格子底下没有名字那一行） */
export const TASK_BAR_CELL = 56;
/** 两个奖励格之间留的缝 */
export const TASK_BAR_CELL_GAP = 23;
/** 条里那个按钮：作者新设计里的 120×40，画它的是按钮自己的内容渲染器（见 M3Node 的 ButtonContent） */
export const TASK_BAR_BTN_W = 120;
export const TASK_BAR_BTN_H = 40;
/** 按钮右上角那枚徽标：作者设计里那枚是 21×20，药丸的高就是这一个数。宽由内容算 —— 是字就按字自己
 *  量（`buttonBadgeWidth`，和按钮自己那枚徽标同一支笔；"3" 量出来正好 20），是图标就是一枚圆药丸（宽
 *  就是高）。 */
export const TASK_BAR_BADGE_H = 20;
/** 那枚徽标压在按钮的右上角，允许**探出按钮的框**：右边缘越过按钮的右边缘 9dp、上边缘高出按钮的
 *  上边缘 4dp（作者设计里按钮框 124×48 框着 120×40 的按钮，徽标在框的右上角 —— 换算到按钮这一格
 *  就是这两个数）。 */
export const TASK_BAR_BADGE_OVER_RIGHT = 9;
export const TASK_BAR_BADGE_OVER_TOP = 4;
/** 徽标画的是这枚图标时，按钮就是"锁住的"：点了没有反应。这是**语义**不是图案，所以只在这里写
 *  一次（见 taskBarButtonLocked）。 */
export const TASK_BAR_LOCK_ICON = "lock";
/** 一个刚放下的任务信息条画出来多高：有标题的那一档（见 taskBarMetrics） */
export const TASK_BAR_H = TASK_BAR_PAD_TOP + TASK_BAR_TITLE_LINE + TASK_BAR_GAP + TASK_BAR_CELL + TASK_BAR_PAD_BOTTOM;
/** 条自己的圆角（那个 composite 的框是 16） */
export const TASK_BAR_RADIUS = 16;
/** 条自己的底子：composite 那个框画出来的那一层（它的 `color` 压过了 `fill`，见 boxStyle）—— 格子
 *  是 surfaceContainerHigh，所以在它上面读得出来 */
export const TASK_BAR_FILL: ColorToken = "surfaceContainerLow";
/** 奖励格里的那个数字：**固定**的 100 —— 和奖励格的个数（两个）、格子里那个图标（TASK_BAR_ICON）
 *  同一条规矩，这一条画出来的三个事实都是常量。奖励数量那个属性已经去掉了（作者：「奖励数量属性
 *  去掉，该数量默认 100就行。」），所以条上既没有改它的控件，也没有让它变的字段：`value` 是别处
 *  在用的通用字段，任务信息条读进来时把它让掉（见 project.ts 的 readItem），画的时候也不看它 ——
 *  老文档里写着的 23、0、"9" 读回来一个都不留，格子照旧画 100。 */
export const TASK_BAR_VALUE = 100;
/** 奖励格里那个图标：那个 composite 的图标，**固定**这一个 —— 作者要的是"奖励图标也默认一个图标，
 *  无需更改图标按钮"，所以条上没有改它的控件，存下来的 `icon` 也让掉（见 project.ts 的 readItem 和
 *  M3Node 的 TaskBarContent）。颜色仍是主题的 primary。 */
export const TASK_BAR_ICON = "redeem";
/** 每个奖励格那圈发丝线：和物品格一模一样（1dp 的 secondaryContainer），所以条里的格子和单独放的
 *  一个物品格看起来是同一个东西。 */
export const TASK_BAR_CELL_STROKE = 1;
export const TASK_BAR_CELL_STROKE_COLOR: ColorToken = "secondaryContainer";

/**
 * 任务信息条有多高，以及里面每一块画在哪 —— 绘制和包围盒共用的一处（sizeOf 的 taskBar 一档）。
 *
 * 高 = 上留白 + 标题那一行 + 缝 + 格子那一行 + 下留白，一行都不少：标题空着时那一行和它的缝一起
 * 不占地方（和物品格的名字那一行同一个规矩），所以"没有标题"是另一个明确的数（80），不是一个魔法
 * 常量。格子那一行的高度是格子和按钮那一槽里高的那个 —— 按钮再高也撑得住条。
 *
 * 奖励格永远是**两个**（那个 composite 的样子）：数一数这个属性已经去掉了，一格和两格也不再是
 * 两种画法（见下面的 `cells`）。
 *
 * 条里那个按钮站在一个**槽**里（`slot`）：槽比按钮宽出"徽标往右探出去"的那 9dp、高出一截"徽标往
 * 上探出去"的那 4dp —— 作者设计里的 124×48 按钮框正是这么框着 120×40 的按钮的（徽标又是绝对定位
 * 压在框的右上角）。槽是**行里真正占地方的那一块**，所以那枚徽标虽然探出了按钮（作者的模型：徽标
 * 在按钮的上层、可以在按钮外面），却仍旧落在这一条自己的盒子里：盒子还是画出来的那个，没有例外。
 *
 * 徽标挂不挂、字多长、是字还是图标，这里一个数都不动（药丸自己多宽由 buttonBadgeWidth 算）：槽的
 * 宽高只跟按钮和那 9/4 有关。
 */
export const taskBarMetrics = (it: Partial<Item>) => {
  const cell = TASK_BAR_CELL;
  /* 标题空着就没有标题那一行，缝也跟着不留（和 name 空着不留名字那一行同一个道理） */
  const titleLine = (it.label ?? "").trim() ? TASK_BAR_TITLE_LINE : 0;
  const gap = titleLine ? TASK_BAR_GAP : 0;
  const button = { w: TASK_BAR_BTN_W, h: TASK_BAR_BTN_H };
  /* 徽标压在按钮右上角：药丸的高，以及它越过按钮右上角的那两个数 */
  const badge = { h: TASK_BAR_BADGE_H, overRight: TASK_BAR_BADGE_OVER_RIGHT, overTop: TASK_BAR_BADGE_OVER_TOP };
  /* 按钮那一槽 = 按钮和"徽标探出去的那一截"的并集：徽标的右上角正好落在槽的右上角，按钮落在槽的
     左下角。所以槽就是这一块画出来的外框，行按它排（见上面那段） */
  const slot = { w: button.w + badge.overRight, h: button.h + badge.overTop };
  const row = Math.max(cell, slot.h);
  return {
    padX: TASK_BAR_PAD_X,
    padTop: TASK_BAR_PAD_TOP,
    padBottom: TASK_BAR_PAD_BOTTOM,
    titleFont: TASK_BAR_TITLE_FONT,
    titleLine,
    gap,
    /** 奖励格永远两个 —— 那个 composite 的样子，不是作者设的数（见上面那段） */
    cells: 2,
    cell,
    cellGap: TASK_BAR_CELL_GAP,
    /** 格子那一行的高度：格子和按钮那一槽里高的那个（按钮再高也撑得住条） */
    row,
    /** 条里那个按钮自己画出来多大（120×40），位置在槽的左下角 */
    button,
    /** 按钮那一槽：行里给按钮和它右上角那枚徽标留的地方（129×44） */
    slot,
    /** 那枚徽标（药丸的高 h，以及越过按钮右上角的 overRight / overTop） */
    badge,
    /** 每个格子角上那枚药丸多高：物品格那条规矩（格子边长的 18%，再小也留 10dp） */
    markH: Math.max(10, Math.round(cell * 0.18)),
    h: TASK_BAR_PAD_TOP + titleLine + gap + row + TASK_BAR_PAD_BOTTOM,
  };
};

/** 条里那个按钮右上角画的徽标写的是什么字：就是这一条自己的一对字段（`buttonBadge` 开关 +
 *  `buttonBadgeText` 内容）。没有字的药丸什么也不说明，所以没写、或者存坏了被读掉的空字，都算
 *  **没有徽标**（宽由 `buttonBadgeWidth` 算，画的也是同一支笔）。
 *  徽标也有可能是图标（`buttonBadgeIcon`）：图标在时画的是图标，这几个字就不画了，但字段还在 ——
 *  看 `taskBarButtonBadgeIcon` / `taskBarButtonBadgeOn`。 */
export const taskBarButtonBadge = (it: Partial<Item>): string | null =>
  (it.buttonBadge ? (it.buttonBadgeText ?? "").trim() : "") || null;

/** 条里那个按钮右上角那枚徽标里的图标（作者在「图标」一节里选的，和奖励图标同一个选择器）。
 *  没写、写坏了被读掉的都算没有图标。它**不受 `buttonBadge` 开关管**：图标本身就是内容，选上了
 *  就画（开关管的是那两个字，那两个没有字就算没有徽标）。 */
export const taskBarButtonBadgeIcon = (it: Partial<Item>): string | null => {
  const icon = typeof it.buttonBadgeIcon === "string" ? it.buttonBadgeIcon.trim() : "";
  return icon || null;
};

/**
 * 条里那个按钮右上角有没有那枚徽标，以及画的是谁：**图标优先**。一枚 20dp 的药丸只说一件事，而
 * 图标是更具体的那一件（锁说的是"这颗按钮现在不能按"，旁边再挤一个数字只会把话说糊）；字是退路。
 * 图标和字都没有，就是没有徽标。绘制、提示和判定都走这里，所以画的和说的不会各说各话。
 */
export const taskBarButtonBadgeOn = (it: Partial<Item>): boolean =>
  !!(taskBarButtonBadgeIcon(it) || taskBarButtonBadge(it));

/**
 * 条里那枚徽标画的是锁图标时，那颗按钮是"锁住的"：点着没有反应 —— 这是**语义**，不是一枚图案。
 * 作者的原话是「当出现这个锁的图标时，该按钮点击时，禁止响应」，所以判定只写在这一处：绘制、编辑
 * 器的按下反馈、预览的点击路径都问它，谁也不自己认一遍字符串。要换一枚别的图标当"锁"，改这里的
 * 一个常量就够（见 TASK_BAR_LOCK_ICON）。
 */
export const taskBarButtonLocked = (it: Partial<Item>): boolean =>
  it.kind === "taskBar" && taskBarButtonBadgeIcon(it) === TASK_BAR_LOCK_ICON;

/**
 * 哪些部件是**融合部件**：看起来像按钮的那一块画在部件**里面**，点击归那一块，整块部件不接这一下
 *
 * 任务信息条（右端那颗「领取」按钮）和确认框（那两颗普通按钮）都是。判定只有这一处：预览里
 * `Tappable` 据此不做点击目标（`innerTap`）、把「置灰并停止响应」的范围收在里面的按钮上
 * （`disablesWholePart`）、并把槽位那几台机器并进这一块（`resolveSlotStates` 那一路）。
 */
export const tapLivesInside = (kind: Kind): boolean => kind === "taskBar" || kind === "confirmBox";

/* ---------- the confirm box ---------- */

/* 确认框的每一块占多大 —— 标题那一行、正文带和底下那两颗按钮。包围盒（sizeOf）和绘制（M3Node 的
 * ConfirmBoxContent）都从这里取，所以"盒子大小"和"画出来的样子"不会各说各话。
 *
 * 这些数是按作者在「上传屏幕2」里手摆的那一版原稿量出来的
 * （docs/reference-prototypes/confirm-box-component.json，交接说明见同目录的 confirm-box.md）：
 *   box 320×200、圆角 28、surfaceContainerHigh
 *   14 的上留白 → 20dp 的标题（一行 24）→ 10 的缝 → 正文带 72（y=48）→ 10 的缝 → 两颗 104×49 的
 *   按钮（y=130）→ 21 的下留白
 * 加起来正好 200：14 + 24 + 10 + 72 + 10 + 49 + 21。标题空着时那一行和它的缝一起不占；正文空着时带和
 * 它后面那道缝一起不占 —— 所以"没标题"和"没正文"也都是明确的数（见 confirmBoxMetrics）。
 */

/** 框的默认宽度（作者原稿的 320）；高度跟着内容走 */
export const CONFIRM_BOX_W = 320;
/** 上留白 */
export const CONFIRM_BOX_PAD_TOP = 14;
/** 下留白 */
export const CONFIRM_BOX_PAD_BOTTOM = 21;
/** 左右留白：底下那两颗按钮和正文带都从这里起步（原稿两颗按钮就是左右各 20、对称） */
export const CONFIRM_BOX_PAD_X = 20;
/** 标题的字号，和一行占多高（20dp 的字，一行 24）—— 标题**居中**，和对话框一样 */
export const CONFIRM_BOX_TITLE_FONT = 20;
export const CONFIRM_BOX_TITLE_LINE = 24;
/** 标题→正文带、正文带→按钮之间留的缝 */
export const CONFIRM_BOX_GAP = 10;
/** 正文的字号，以及它一行占多高：18dp 的字，一行 26（原稿那条 72 高的带正好装两行） */
export const CONFIRM_BOX_BODY_FONT = 18;
export const CONFIRM_BOX_BODY_LINE = 26;
/** 正文在带里**左对齐**：带内左 25、上 10。原稿的正文落在框内 45 的地方（它的带在 x=26、正文在带内
 *  x=19）；融合后带跟着左右留白（20）走，带内 25 就还是那个 45 —— 所以这是个位置，不是"带内再留白"。 */
export const CONFIRM_BOX_BODY_PAD_LEFT = 25;
export const CONFIRM_BOX_BODY_PAD_TOP = 10;
export const CONFIRM_BOX_BODY_PAD_BOTTOM = 10;
/** 正文带的高：原稿是 72，正文折行折到两行以上时带（和框）跟着长，不裁字 —— 72 正好是"两行 + 上下
 *  各 10"（2 × 26 + 20），所以它是个**下限**，不是一个固定的数（见 confirmBoxMetrics）。 */
export const CONFIRM_BOX_BODY_MIN_H = 72;
/** 底下那两颗按钮：各 104×49。原稿是手摆的（左 20 / 右 27，差 7dp），融合后**左右各 20**、对称，
 *  中间那道缝因此在 320 宽时是 72。两颗都是普通按钮，长得一模一样，只有各自的词和去处不同。 */
export const CONFIRM_BOX_BTN_W = 104;
export const CONFIRM_BOX_BTN_H = 49;
/** 框自己的圆角（作者原稿的 28） */
export const CONFIRM_BOX_RADIUS = 28;
/** 框自己的底：原稿那个框画出来的那一层。正文带的底和它**同色**（原稿就是这样画的），所以带在框上
 *  其实看不见 —— 它只是正文的排版盒子，量折行用的（见 confirmBoxMetrics）。 */
export const CONFIRM_BOX_FILL: ColorToken = "surfaceContainerHigh";
/** 一个刚放下的确认框画出来多高：标题和正文都在的那一档（见 confirmBoxMetrics）。没标题是 166、
 *  没正文是 118、两个都没有是 84 —— 都是同一道式子算出来的。 */
export const CONFIRM_BOX_H =
  CONFIRM_BOX_PAD_TOP + CONFIRM_BOX_TITLE_LINE + CONFIRM_BOX_GAP + CONFIRM_BOX_BODY_MIN_H + CONFIRM_BOX_GAP + CONFIRM_BOX_BTN_H + CONFIRM_BOX_PAD_BOTTOM;

/** 确认框里**主按钮**（确认）的槽位键：空键，说的是"这一部件自己的状态机与动作"（`flow` / `action`），
 *  和栏上的"整条自己的那一下"同一个约定。 */
export const CONFIRM_BOX_MAIN = "";
/** 确认框里**取消**按钮的槽位键：它自己那台机器与它自己那个动作落在 `slotFlows.cancel` /
 *  `actions.cancel`（见 Preview 的 pickSlot）。 */
export const CONFIRM_BOX_CANCEL_SLOT = "cancel";

/**
 * 一段文字按 `width` 折成几行 —— 用 glyphEm 同一支笔估宽，再贪心地断行。
 *
 * 确认框的正文折行靠它：汉字一个字一个字地断，和浏览器画出来的一样；西文在空格处断，估出来的行数
 * 偶尔会和浏览器差一行，所以带给了 72 这个下限（两行），小差别看不出来。
 *
 * 绘制和包围盒走的是同一个函数：不然"盒子多高"和"字画了几行"会各说各话，最后就是裁字。
 */
export function wrapTextLines(text: string, font: number, width: number): number {
  if (!text) return 0;
  const limit = Math.max(1, width);
  let lines = 1;
  let used = 0;
  for (const ch of text) {
    if (ch === "\n") {
      lines += 1;
      used = 0;
      continue;
    }
    const w = glyphEm(ch) * font;
    if (used > 0 && used + w > limit) {
      lines += 1;
      used = w;
    } else {
      used += w;
    }
  }
  return lines;
}

/**
 * 确认框有多高，以及里面每一块画在哪 —— 绘制和包围盒共用的一处（sizeOf 的 confirmBox 一档）。
 *
 * 高 = 上留白 + 标题那一行 + 缝 + 正文带 + 缝 + 按钮那一行 + 下留白，一行都不少；标题空着时那一行和
 * 它的缝一起不占地方，正文空着时带和它后面那道缝一起不占地方（和任务信息条同一个规矩）。
 *
 * 正文带是左右留白量出来的那一块（框宽减去左右各 20），正文在带里左对齐（带内左 25、上 10）；带的
 * 高取 CONFIRM_BOX_BODY_MIN_H（两行的量），折行折过头就跟着长。
 */
export const confirmBoxMetrics = (it: Partial<Item>) => {
  const title = (it.label ?? "").trim();
  const body = (it.supporting ?? "").trim();
  const titleLine = title ? CONFIRM_BOX_TITLE_LINE : 0;
  const gap = CONFIRM_BOX_GAP;
  /* 带就是左右留白量出来的那一块：框宽变了，带跟着变（原稿 320 宽时它是 280） */
  const bandW = Math.max(1, (it.size ?? CONFIRM_BOX_W) - CONFIRM_BOX_PAD_X * 2);
  /* 正文能占的宽度：带内左 25 之后剩下的那一截 */
  const bodyW = Math.max(1, bandW - CONFIRM_BOX_BODY_PAD_LEFT);
  const bodyLines = wrapTextLines(body, CONFIRM_BOX_BODY_FONT, bodyW);
  const bandH = bodyLines
    ? Math.max(CONFIRM_BOX_BODY_MIN_H, CONFIRM_BOX_BODY_PAD_TOP + bodyLines * CONFIRM_BOX_BODY_LINE + CONFIRM_BOX_BODY_PAD_BOTTOM)
    : 0;
  return {
    padTop: CONFIRM_BOX_PAD_TOP,
    padBottom: CONFIRM_BOX_PAD_BOTTOM,
    padX: CONFIRM_BOX_PAD_X,
    titleFont: CONFIRM_BOX_TITLE_FONT,
    titleLine,
    gap,
    /** 正文带：宽是框宽减去左右留白；高是"两行"的下限（详见函数头） */
    band: { w: bandW, h: bandH },
    bodyFont: CONFIRM_BOX_BODY_FONT,
    bodyLine: CONFIRM_BOX_BODY_LINE,
    bodyPadLeft: CONFIRM_BOX_BODY_PAD_LEFT,
    bodyPadTop: CONFIRM_BOX_BODY_PAD_TOP,
    bodyLines,
    /** 两颗按钮画出来多大（各 104×49） */
    button: { w: CONFIRM_BOX_BTN_W, h: CONFIRM_BOX_BTN_H },
    /** 上留白 + 标题 + 缝 + 带 + 缝 + 按钮 + 下留白：空的那几块连缝一起不占 */
    h:
      CONFIRM_BOX_PAD_TOP +
      titleLine +
      (titleLine ? gap : 0) +
      bandH +
      (bandH ? gap : 0) +
      CONFIRM_BOX_BTN_H +
      CONFIRM_BOX_PAD_BOTTOM,
  };
};

/**
 * 确认框那两颗按钮各是谁、摆在哪、字在哪个字段上
 *
 * 左边「取消」、右边「确认」—— 顺序照着编辑器自己那个确认框（components/ui.tsx 的 ConfirmDialog：
 * 取消在左、确认在右）。作者原稿那两颗是普通按钮、没有名字，所以哪一颗在左由这一处定。
 *
 * 两颗的机制**一模一样**（作者：「取消和确认是完全一样的普通按钮，跟名称没有关系」）：点下去都是
 * "那颗按钮自己的状态机 → 那颗按钮自己的动作"，各自独立配置。唯一的差别是键 —— 确认（主按钮）用
 * 空键、走这一部件自己的 `flow` / `action`；取消用 `cancel` 槽、走 `slotFlows.cancel` /
 * `actions.cancel`（见 CONFIRM_BOX_MAIN / CONFIRM_BOX_CANCEL_SLOT）。
 */
export const CONFIRM_BOX_BUTTONS: { slot: string; field: "label2" | "label3"; where: "left" | "right" }[] = [
  { slot: CONFIRM_BOX_CANCEL_SLOT, field: "label3", where: "left" },
  { slot: CONFIRM_BOX_MAIN, field: "label2", where: "right" },
];

/** 确认框里一颗按钮上的字：主按钮（确认）是 `label2`，取消是 `label3`（见 CONFIRM_BOX_BUTTONS） */
export const confirmBoxButtonWords = (it: Partial<Item>, slot: string): string =>
  slot === CONFIRM_BOX_CANCEL_SLOT ? (it.label3 ?? "").trim() : (it.label2 ?? "").trim();

/** 确认框里**主按钮**（确认）上的字：一次"改文字"的外观补丁落在它身上（见 wordsOf） */
export const confirmBoxMainWords = (it: Partial<Item>): string => (it.label2 ?? "").trim();

/** The count a value stands for: whole, never negative, never past the ceiling — the one place that
 *  policy lives, so the slider, the formatter and the document check all agree. */
const timerCount = (value: number | undefined) =>
  Math.min(TIMER_VALUE_MAX, Math.max(0, Math.round(Number.isFinite(value) ? (value as number) : 0)));

/** Whether the inspector gives a part a 状态 section: the ones with a state of their own to set —
 *  checked, a value, waves, a container's grip, a scroll — and a list item's trailing switch. One
 *  gate, so a kind that stops offering a state (a direction wheel sets no value) loses the row with
 *  it, and every kind that has one keeps it. */
export const hasStateRow = (it: Pick<Item, "kind">, spec: KindSpec | undefined = KIND_SPEC[it.kind]) =>
  !!spec && (!!spec.hasChecked || !!spec.hasValue || !!spec.hasWavy || !!spec.hasContained || !!spec.hasScroll || it.kind === "listItem");

/** Kinds the palette no longer offers but a document may still hold: they stay readable so an older
 *  document opens, and the editor's reader turns them into what the palette offers instead. */
export const LEGACY_KINDS: Kind[] = ["sliderInput", "moneyTree", "eggSmash"];

/** Kinds this build has dropped altogether — the part is gone, not replaced. A document stored while
 *  they existed is still a document: the shape check accepts it (see project.ts) and the reader leaves
 *  those parts out, along with whatever they held, so nothing an author drew throws their canvas away.
 *  Kept by name rather than by `Kind`, because the union no longer has them. */
export const REMOVED_KINDS: string[] = ["fabMenu"];
export const isRemovedKind = (it: { kind?: unknown } | null | undefined): boolean =>
  !!it && typeof it.kind === "string" && REMOVED_KINDS.includes(it.kind);

/** How tall a fresh track is, and the measurements its own drawing is laid out with: the square tile
 *  a reward sits in, the room between two tiles, the bar itself, and the line of numbers under it. */
export const REWARD_TRACK_H = 108;
export const REWARD_TILE = 56;
export const REWARD_TILE_GAP = 8;
export const REWARD_NUM_H = 18;
/** The progress a fresh track runs to, which is what the four default rewards are laid out on. */
export const REWARD_DEF_MAX = 60;
export const REWARD_DEFAULT_ATS = [10, 20, 30, 60];

export const KIND_SPEC: Record<Kind, KindSpec> = {
  box: {
    label: "Box",
    noun: "ボックス",
    category: "containment",
    paletteIcon: "check_box_outline_blank",
    w: PHONE_W,
    h: 220,
    radius: 28,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    /* a box has no checked state of its own: the drag handle it once drew is gone */
    hasFill: true,
    /* and it can be made to scroll: the same container, with content that moves inside it */
    hasScroll: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: HEIGHT_PRESETS },
    defLabel: "",
    defIcon: null,
    defSize: PHONE_W,
  },
  invGrid: {
    label: "Slot Grid",
    noun: "スロットグリッド",
    category: "containment",
    paletteIcon: "grid_view",
    /* A frame of inventory cells: wider than a phone's content area and tall enough to hold a
       couple of rows of a default cell, so a fresh one is already a board the author can resize. */
    w: CONTENT_W,
    h: 320,
    radius: 24,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    /* the icon is not the part's own: it is the placeholder drawn in every cell */
    hasIcon: true,
    hasFill: true,
    /* the frame scrolls over its cells: pins rows and it becomes the inventory window */
    hasScroll: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [240, 320, PHONE_H / 2, PHONE_H] },
    defLabel: "",
    defIcon: null,
    defSize: CONTENT_W,
  },
  itemCell: {
    label: "Item cell",
    noun: "アイテム",
    category: "content",
    paletteIcon: "inventory_2",
    /* One cell of a board, with the item's picture, its count, its two corner marks and its name
       below — the 背包格子 composite as a single draggable kind. The width is the cell's; the height
       follows it (see itemCellHeight) unless the author pins one. */
    w: 60,
    h: 60 + ITEM_CELL_LINE,
    radius: ITEM_CELL_RADIUS,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: true,
    hasIcon: true,
    hasFill: true,
    size: { min: SIZE_MIN, max: 200, step: 2, icon: "open_in_full", presets: [40, 48, 60, 76, 96] },
    size2: { min: SIZE_MIN, max: 300, step: 2, icon: "height", presets: [60, 60 + ITEM_CELL_LINE, 96] },
    defLabel: "木の葉",
    defIcon: "eco",
    defSupporting: "23",
    defBadgeText: "新",
    defBadge2Text: "普通",
    defSize: 60,
  },
  assetPill: {
    label: "Asset pill",
    noun: "資産バー",
    category: "content",
    paletteIcon: "paid",
    /* An amount on a bar: the 資産框 composite as a single draggable kind — a round icon and the
       number beside it, on the surface the composite was drawn on.

       `w` is only a nominal number for anything that wants one (the catalogue, a palette tile): the
       drawn width is the content's own — 留白 + 图标 + 文字 + 间距，见 assetPillWidth — so removing a
       mark shortens the bar and widening the mark spacing lengthens it. A fresh one (label "1.6億" and
       the left mark) measures 70. Nothing pins a width unless the author does (no `defSize`), and the
       presets below are explicit overrides with the 自动宽度 chip as the way back.

       用户要求：默认为长方形，可以设置圆角数值 —— 所以 radius 是 0（直角），圆角由作者用 radiusTop
       自己设，画的时候按高度的一半封顶（见 assetPillRadius）。 */
    w: 70,
    h: 28,
    radius: 0,
    /* 两边的圆图标有样式可选（描边/标准……），用部件自己的 variant 字段：一个选择管两个图标，
       条本身的底子是 fill，和图标各管各的（见 AssetPillContent 的 mark）。 */
    hasVariant: true,
    defVariant: "filled",
    hasLabel: true,
    hasSupporting: false,
    hasIcon: true,
    hasFill: true,
    /* 80 是只放一个图标和短数字的紧凑尺寸，100 是默认，160 留给长数字 */
    size: { min: SIZE_MIN, max: 260, step: 2, icon: "width", presets: [80, 100, 160] },
    size2: { min: SIZE_MIN, max: 96, step: 2, icon: "height", presets: [24, 28, 36] },
    defLabel: "1.6億",
    defIcon: "paid",
  },
  button: {
    label: "Button",
    noun: "ボタン",
    category: "actions",
    paletteIcon: "buttons_alt",
    w: 128,
    h: H,
    radius: R_FULL,
    hasVariant: true,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: true,
    connect: { axis: "x", outer: R_FULL, inner: R_INNER, family: "button" },
    /* M3's medium button is 56dp tall; a bigger one is often asked for, so the height is the
       author's to set as well as the width */
    size2: { min: SIZE_MIN, max: 200, step: 4, icon: "height", presets: [40, 48, 56, 64, 80] },
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: [HALF_W, CONTENT_W] },
    defLabel: "ボタン",
    defIcon: "swords",
  },
  iconButton: {
    label: "Icon Button",
    noun: "アイコンボタン",
    category: "actions",
    paletteIcon: "radio_button_checked",
    w: 48,
    h: 48,
    radius: 24,
    hasVariant: true,
    /* an icon button is one shape holding one icon: it is not a button with words, so the label
       row stays out of the inspector and a dropped text never becomes a caption of its own */
    hasLabel: false,
    hasSupporting: false,
    hasIcon: true,
    connect: { axis: "x", outer: 24, inner: R_INNER, family: "button" },
    size: { min: SIZE_MIN, max: 96, step: 4, icon: "open_in_full", presets: [40, 48, 56, 96] },
    defLabel: "",
    defIcon: "sports_esports",
    defSize: 48,
    defVariant: "tonal",
  },
  fab: {
    label: "FAB",
    noun: "FAB（フローティングボタン）",
    category: "actions",
    paletteIcon: "add_circle",
    w: 56,
    h: 56,
    radius: 16,
    hasVariant: true,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: true,
    size: { min: SIZE_MIN, max: 128, step: 4, icon: "open_in_full", presets: [40, 56, 96] },
    defLabel: "",
    defIcon: "bolt",
    defSize: 56,
    defVariant: "tonal",
  },
  extendedFab: {

    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width" },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [40, 56, 64] },
    label: "Extended FAB",
    noun: "拡張 FAB",
    category: "actions",
    paletteIcon: "add_box",
    w: 0,
    h: 56,
    radius: 16,
    hasVariant: true,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: true,
    defLabel: "作成",
    defIcon: "rocket_launch",
    defVariant: "tonal",
  },
  fnButton: {
    label: "Function Button",
    noun: "機能ボタン",
    category: "actions",
    paletteIcon: "timer",
    /* A floating button and the words under it in one part: the width is the circle's, and the height
       follows it — the circle plus a line per thing it says (see sizeOf). It is the 悬浮按钮·时间
       composite as a single draggable kind. */
    w: 50,
    h: 50 + FN_BUTTON_LINE * 2,
    radius: 8,
    hasVariant: true,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: true,
    size: { min: SIZE_MIN, max: 128, step: 2, icon: "open_in_full", presets: [40, 50, 56, 96] },
    size2: { min: SIZE_MIN, max: 320, step: 2, icon: "height", presets: [50 + FN_BUTTON_LINE * 2, 96] },
    defLabel: "イベント",
    defIcon: "bolt",
    defSize: 50,
    defVariant: "tonal",
  },
  chip: {

    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width" },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [24, 32, 48] },
    label: "Chip",
    noun: "チップ",
    category: "actions",
    paletteIcon: "label",
    w: 0,
    h: 32,
    radius: 8,
    hasVariant: true,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: true,
    hasChecked: true,
    connect: { axis: "x", outer: 16, inner: 4, family: "chip" },
    defLabel: "チップ",
    defIcon: null,
    defVariant: "outlined",
  },
  topAppBar: {
    label: "Top App Bar",
    noun: "トップアプリバー",
    category: "navigation",
    paletteIcon: "toolbar",
    w: PHONE_W,
    h: 64 + STATUS_BAR_H,
    radius: 0,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [64, 88] },
    defLabel: "タイトル",
    defIcon: "menu",
    defIcon2: "more_vert",
    defSize: PHONE_W,
  },
  bottomNav: {
    label: "Navigation Bar",
    noun: "ナビゲーションバー",
    category: "navigation",
    paletteIcon: "bottom_navigation",
    w: PHONE_W,
    h: 80 + NAV_BAR_H,
    radius: 0,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasTabs: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },
    /* the bar's own height: the icon row plus whatever label room the author wants */
    size2: { min: SIZE_MIN, max: 200, step: 4, icon: "height" },
    defLabel: "",
    defIcon: null,
    defSize: PHONE_W,
  },
  navRail: {
    label: "Navigation Rail",
    noun: "ナビゲーションレール",
    category: "navigation",
    paletteIcon: "side_navigation",
    w: RAIL_W,
    h: PHONE_H,
    radius: 0,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasTabs: true,
    /* a rail's width is its own: 56dp of icons up to a wide two-column rail */
    size: { min: SIZE_MIN, max: 320, step: 4, icon: "width" },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: HEIGHT_PRESETS },
    defLabel: "",
    defIcon: null,
  },
  searchBar: {
    label: "Search Bar",
    noun: "検索バー",
    category: "navigation",
    paletteIcon: "search",
    w: CONTENT_W,
    h: 56,
    radius: 28,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [40, 56, 64] },
    defLabel: "検索",
    defIcon: "search",
    defIcon2: "mic",
    defSize: CONTENT_W,
  },
  card: {
    label: "Card",
    noun: "カード",
    category: "containment",
    paletteIcon: "web_asset",
    w: CONTENT_W,
    h: 223,
    radius: 20,
    hasVariant: true,
    hasLabel: true,
    hasSupporting: true,
    hasIcon: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [120, 188, 280] },
    hasFill: true,
    defLabel: "カードの見出し",
    defIcon: "image",
    defSupporting: "補足テキストがここに入ります。",
    defSize: CONTENT_W,
    defVariant: "tonal",
  },
  listItem: {
    label: "List Item",
    noun: "リスト項目",
    category: "containment",
    paletteIcon: "list",
    w: CONTENT_W,
    h: 72,
    radius: R_FULL,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: true,
    hasIcon: true,
    hasFill: true,
    connect: { axis: "y", outer: R_FULL, inner: R_INNER, family: "list" },
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [56, 72, 96] },
    defLabel: "リスト項目",
    defIcon: "person",
    defSupporting: "サブテキスト",
    defIcon2: "chevron_right",
    defSize: CONTENT_W,
  },
  dialog: {

    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width" },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [140, 220, 320] },
    label: "Dialog",
    noun: "ダイアログ",
    category: "containment",
    paletteIcon: "chat_bubble",
    w: 312,
    h: 220,
    radius: 28,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: true,
    hasIcon: true,
    defLabel: "確認",
    defIcon: "info",
    defSupporting: "この操作を実行しますか？",
  },
  confirmBox: {
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: [CONFIRM_BOX_W, CONTENT_W] },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [CONFIRM_BOX_H, 166] },
    label: "Confirm box",
    noun: "確認ボックス",
    /* 确认框：标题、正文和两颗普通按钮全收在一个部件里 —— 像功能按钮那样"一个部件、其余是属性"，而不是
       一个框加三个孩子（作者要求"融合成单组件"，见 docs/reference-prototypes/confirm-box.md）。宽度是
       作者的（默认 320），高度跟着内容走（见 confirmBoxMetrics）。 */
    category: "containment",
    paletteIcon: "fact_check",
    w: CONFIRM_BOX_W,
    h: CONFIRM_BOX_H,
    radius: CONFIRM_BOX_RADIUS,
    /* 框的样子是它的 fill：那条正文带和它同色（于是在框上看不见，见 CONFIRM_BOX_FILL），两颗按钮画的
       是按钮自己的 filled 那一套 —— 没有"整块换一套样式"这回事，和任务信息条、物品格同一条规矩。 */
    hasVariant: false,
    hasLabel: true,
    hasSupporting: true,
    /* 框上没有图标：作者原稿里就没有，也没有哪个字段是画图标用的 */
    hasIcon: false,
    hasFill: true,
    defLabel: "お知らせ",
    defSupporting: "この操作を実行しますか？",
    defLabel2: "確認",
    /* 取消按钮的字（见 Item.label3）：左边那颗，和确认一样是普通按钮 */
    defLabel3: "キャンセル",
    defIcon: null,
    defSize: CONFIRM_BOX_W,
  },
  snackbar: {

    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width" },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [40, 48, 64] },
    label: "Snackbar",
    noun: "スナックバー",
    category: "containment",
    paletteIcon: "call_to_action",
    w: 344,
    h: 48,
    radius: 8,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: true,
    hasIcon: false,
    defLabel: "保存しました",
    defIcon: null,
    defSupporting: "元に戻す",
  },
  textField: {
    label: "Text Field",
    noun: "テキスト入力",
    category: "inputs",
    paletteIcon: "text_fields",
    w: CONTENT_W,
    h: 56,
    radius: 16,
    hasVariant: true,
    hasLabel: true,
    hasSupporting: true,
    hasIcon: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [40, 56, 64] },
    defLabel: "ラベル",
    defIcon: "search",
    defSupporting: "",
    defSize: CONTENT_W,
    defVariant: "outlined",
  },
  select: {
    label: "Dropdown",
    noun: "ドロップダウン",
    category: "inputs",
    paletteIcon: "arrow_drop_down_circle",
    w: CONTENT_W,
    h: 56,
    radius: 16,
    hasVariant: true,
    hasLabel: true,
    hasSupporting: true,
    hasIcon: true,
    hasTabs: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [40, 56, 64] },
    defLabel: "ラベル",
    defIcon: null,
    defSupporting: "",
    defSize: CONTENT_W,
    defVariant: "outlined",
  },
  switch: {
    label: "Switch",
    noun: "スイッチ",
    category: "inputs",
    paletteIcon: "toggle_on",
    w: 160,
    h: 48,
    radius: 16,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasChecked: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [24, 32, 48] },
    defLabel: "通知",
    defIcon: null,
  },
  checkbox: {

    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width" },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [32, 40, 48] },
    label: "Checkbox",
    noun: "チェックボックス",
    category: "inputs",
    paletteIcon: "check_box",
    w: 0,
    h: 40,
    radius: 4,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasChecked: true,
    defLabel: "同意する",
    defIcon: null,
  },
  slider: {
    label: "Slider",
    noun: "スライダー",
    category: "inputs",
    paletteIcon: "sliders",
    w: CONTENT_W,
    h: 44,
    radius: 22,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasValue: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [32, 44, 56] },
    defLabel: "",
    defIcon: null,
    defSize: CONTENT_W,
  },
  stepper: {
    label: "Stepper",
    noun: "ステッパー",
    category: "inputs",
    paletteIcon: "exposure",
    /* a minus, the number itself, and a plus: the number is the part's value, so a rule or a
       bound text reads it the way it reads a slider's */
    w: 200,
    h: 56,
    radius: 28,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasValue: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: [160, 200, 240, CONTENT_W] },
    size2: { min: SIZE_MIN, max: 96, step: 4, icon: "height", presets: [48, 56, 64] },
    defLabel: "数量",
    defIcon: null,
    defSize: 200,
  },
  /* retired: the palette offers the slider and the stepper instead, and a document that holds one
     of these opens as a slider */
  sliderInput: {
    label: "Slider Field",
    noun: "スライダー入力",
    category: "inputs",
    paletteIcon: "tune",
    /* a slider with the number under it and a minus and a plus beside the number: the one control a
       settings row needs, where the slider scrubs, the box can be typed into, and the buttons step */
    w: CONTENT_W,
    h: 104,
    radius: 20,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasValue: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: [260, 300, CONTENT_W] },
    size2: { min: SIZE_MIN, max: 200, step: 4, icon: "height", presets: [88, 104, 120] },
    defLabel: "音量",
    defIcon: null,
    defSize: CONTENT_W,
  },
  text: {
    label: "Text",
    noun: "テキスト",
    category: "content",
    paletteIcon: "title",
    w: 0,
    h: 40,
    radius: 0,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    size: { min: 12, max: 57, step: 1, icon: "format_size", presets: [14, 16, 22, 28, 32, 45, 57] },
    defLabel: "見出し",
    defIcon: null,
    defSize: 28,
  },
  image: {
    label: "Image",
    noun: "画像",
    category: "content",
    paletteIcon: "image",
    w: 200,
    h: 200,
    radius: 20,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: true,
    /* An image is a box an author crops a picture into: its own width and height, like a camera
       preview or a map, rather than one number that keeps it square. */
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: [96, HALF_W, CONTENT_W, PHONE_W] },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [120, 200, PHONE_H] },
    defLabel: "",
    defIcon: "image",
    defSize: 200,
  },
  camera: {
    label: "Camera",
    noun: "カメラ",
    category: "content",
    paletteIcon: "photo_camera",
    w: CONTENT_W,
    h: Math.round((CONTENT_W * 4) / 3),
    radius: 20,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: [HALF_W, CONTENT_W, PHONE_W] },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [280, 507, PHONE_H] },
    defLabel: "",
    defIcon: "photo_camera",
    defSize: CONTENT_W,
  },
  map: {
    label: "Map",
    noun: "地図",
    category: "content",
    paletteIcon: "map",
    w: CONTENT_W,
    h: Math.round((CONTENT_W * 3) / 4),
    radius: 20,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: [HALF_W, CONTENT_W, PHONE_W] },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [200, 285, PHONE_H] },
    defLabel: "",
    defIcon: "map",
    defSize: CONTENT_W,
  },
  divider: {
    label: "Divider",
    noun: "区切り線",
    category: "content",
    paletteIcon: "horizontal_rule",
    w: CONTENT_W,
    h: 16,
    radius: 0,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },
    size2: { min: 4, max: 64, step: 2, icon: "height", presets: [4, 8, 16, 32] },
    defLabel: "",
    defIcon: null,
    defSize: CONTENT_W,
  },
  loadingIndicator: {
    label: "Loading Indicator",
    noun: "ローディングインジケータ",
    category: "progress",
    paletteIcon: "motion_blur",
    w: 48,
    h: 48,
    radius: 24,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasContained: true,
    size: { min: SIZE_MIN, max: 128, step: 4, icon: "open_in_full", presets: [32, 48, 64, 96] },
    defLabel: "",
    defIcon: null,
    defSize: 48,
  },
  linearProgress: {
    label: "Linear Progress",
    noun: "リニアプログレス",
    category: "progress",
    paletteIcon: "linear_scale",
    w: CONTENT_W,
    h: 24,
    radius: 12,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasValue: true,
    hasWavy: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [16, 24, 32] },
    defLabel: "",
    defIcon: null,
    defSize: CONTENT_W,
  },
  progressBar: {
    label: "Progress Bar",
    noun: "プログレスバー",
    category: "progress",
    paletteIcon: "space_bar",
    /* A game's own bar: slim, and its box *is* the bar, so the author's width and height are the
       bar's own rather than a cell the track floats in. The words it carries are drawn in it. */
    w: CONTENT_W,
    h: 10,
    radius: 5,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasValue: true,
    /* the track is the author's to fill, and by default there is none: a bare bar over the page */
    hasFill: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },
    size2: { min: 4, max: 64, step: 2, icon: "height", presets: [6, 10, 16, 28] },
    defLabel: "",
    defIcon: null,
    defSize: CONTENT_W,
  },
  circularProgress: {
    label: "Circular Progress",
    noun: "サーキュラープログレス",
    category: "progress",
    paletteIcon: "progress_activity",
    w: 48,
    h: 48,
    radius: 24,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasValue: true,
    hasWavy: true,
    size: { min: SIZE_MIN, max: 120, step: 4, icon: "open_in_full", presets: [24, 40, 48, 52, 64] },
    defLabel: "",
    defIcon: null,
    defSize: 48,
  },
  splitButton: {

    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width" },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [40, 56, 64] },
    label: "Split Button",
    noun: "スプリットボタン",
    category: "actions",
    paletteIcon: "splitscreen_right",
    w: 0,
    h: H,
    radius: R_FULL,
    hasVariant: true,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: true,
    defLabel: "送信",
    defIcon: "send",
    defVariant: "filled",
  },
  toolbar: {

    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width" },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [48, 64, 80] },
    label: "Toolbar",
    noun: "ツールバー",
    category: "navigation",
    paletteIcon: "toolbar",
    w: 0,
    h: 64,
    radius: 32,
    hasVariant: true,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasTabs: true,
    defLabel: "",
    defIcon: null,
    defVariant: "tonal",
  },
  sideTabs: {
    label: "Side tabs",
    noun: "サイドタブ",
    category: "navigation",
    paletteIcon: "vertical_split",
    w: PHONE_W,
    h: SIDE_TAB_W,
    radius: 0,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasTabs: true,
    /* the labels stand down the left, so the width is split and the height is the page */
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [160, 240, 320] },
    defLabel: "",
    defIcon: null,
    defVariant: "filled",
  },
  tabs: {
    label: "Tabs",
    noun: "タブ",
    category: "navigation",
    paletteIcon: "tab",
    w: PHONE_W,
    h: TAB_ROW_H,
    radius: 0,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasTabs: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: WIDTH_PRESETS },
    /* the row alone at its default; an author who wants the panels below it takes the height up */
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: HEIGHT_PRESETS },
    defLabel: "",
    defIcon: null,
    defSize: PHONE_W,
  },
  radio: {

    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width" },

    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [32, 40, 48] },
    label: "Radio Button",
    noun: "ラジオボタン",
    category: "inputs",
    paletteIcon: "radio_button_checked",
    w: 0,
    h: 40,
    radius: 20,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasChecked: true,
    defLabel: "選択肢",
    defIcon: null,
  },
  badge: {
    label: "Badge",
    noun: "バッジ",
    category: "content",
    paletteIcon: "notifications_unread",
    /* the width it draws when the author has not set one: a numbered badge is 16dp, and a width of
       its own may still be set — the size row reads this, so it shows the size the badge has */
    w: 16,
    h: 16,
    radius: 8,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    defLabel: "3",
    defIcon: null,
    /* a badge is a pill or a dot, and either can be given its own size */
    size: { min: 6, max: 160, step: 1, icon: "width" },
    size2: { min: 6, max: 160, step: 1, icon: "height" },
  },
  joystick: {
    label: "Direction wheel",
    noun: "方向ホイール",
    category: "actions",
    paletteIcon: "gamepad",
    w: JOYSTICK_SIZE,
    h: JOYSTICK_SIZE,
    /* a round pad: the knob travels inside it, and its roundness is the part's own shape */
    radius: JOYSTICK_SIZE / 2,
    hasVariant: false,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    /* No value and no maximum: a pad is moved with the finger, it is not set to a number. Leaving the
       flag off is what keeps the inspector's 状态 row, the plan's "adjustable" and a rule's value field
       away from it — one capability, advertised honestly. */
    /* One side only: the pad is a circle, so a height of its own could only stretch it out of shape.
       The size control resizes it round. */
    size: { min: 64, max: 320, step: 4, icon: "open_in_full", presets: [96, 132, 180] },
    defLabel: "",
    defIcon: null,
    defSize: JOYSTICK_SIZE,
  },
  wheel: {
    label: "Prize wheel",
    noun: "円形ルーレット",
    category: "features",
    paletteIcon: "donut_large",
    w: WHEEL_SIZE,
    h: WHEEL_SIZE,
    radius: WHEEL_SIZE / 2,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    /* the pool of prizes, and the words of the button in the middle */
    hasPrizes: true,
    size: { min: 120, max: 420, step: 4, icon: "width", presets: [180, 220, 280] },
    size2: { min: 120, max: 420, step: 4, icon: "height", presets: [180, 220, 280] },
    defLabel: "抽奖",
    defIcon: null,
    defSize: WHEEL_SIZE,
  },
  gacha: {
    label: "Capsule machine",
    noun: "ガチャ",
    category: "features",
    paletteIcon: "toys",
    w: GACHA_W,
    h: GACHA_H,
    radius: 18,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasPrizes: true,
    size: { min: 100, max: 320, step: 4, icon: "width", presets: [140, 170, 210] },
    size2: { min: 120, max: 400, step: 4, icon: "height", presets: [180, 210, 250] },
    defLabel: "扭一个",
    defIcon: null,
    defSize: GACHA_W,
  },
  taskBar: {
    label: "Task bar",
    noun: "タスク情報バー",
    /* 任务信息条：一条任务的信息 —— 标题、两个奖励格（格子自己画图标、数量、两枚角标）和一个
       「领取」按钮（它右上角还压着一枚徽标，是字或图标，可以探出按钮的框）—— 全都收在一个部件里，
       像功能按钮那样"一个部件、其余是属性"，而不是一个框加四个孩子。宽度是作者的（默认一个手机
       内容宽），高度跟着内容走（见 taskBarMetrics）。 */
    category: "features",
    paletteIcon: "checklist",
    w: CONTENT_W,
    h: TASK_BAR_H,
    radius: TASK_BAR_RADIUS,
    /* 条的样子是它的 fill 加上每个格子自己的底，没有"整条换一套样式"这回事 —— 和物品格一样（见
       KIND_SPEC.itemCell）：里面的按钮画的是按钮自己的 filled 那一套，格子的底是格子自己的。 */
    hasVariant: false,
    hasLabel: true,
    /* 奖励数量不是 supporting，也不是这一条的字段了：两个格子里那个数字是**固定**的常量
       （TASK_BAR_VALUE，见上），所以这一条既没有"状态"滑杆，也没有别的控件去改它；条上也没有第二行
       文字 */
    hasSupporting: false,
    /* 奖励图标不可改：两个格子永远画那个固定的默认奖励图标（TASK_BAR_ICON），所以这一条没有"图标"
      这个属性 —— 面板里就少一行改图标的控件（作者：「奖励图标也默认一个图标，无需更改图标按钮」）。
       条上唯一还能选的图标是按钮右上角那枚徽标里的那一个（见 iconSlotsOf 的 taskBar 一档）。 */
    hasIcon: false,
    hasFill: true,
    size: { min: SIZE_MIN, max: PHONE_W, step: 4, icon: "width", presets: [CONTENT_W, PHONE_W] },
    size2: { min: SIZE_MIN, max: PHONE_H, step: 4, icon: "height", presets: [TASK_BAR_H, 140] },
    defLabel: "毎日ログイン (1/1)",
    defLabel2: "受け取る",
    /* 奖励格的图标是固定的常量，不是每一条自己的字段：新落下的条照样只带标题、数量和按钮文字 */
    defIcon: null,
    defBadgeText: "新",
    defBadge2Text: "普通",
    /* 按钮右上那枚徽标：和按钮种类一样，默认就戴着（作者要的是一个可以开关的徽标），内容是中性的 1 */
    defButtonBadgeText: "1",
    defSize: CONTENT_W,
  },
    rewardTrack: {
    label: "Reward track",
    /* A progress bar that hands things out: the visitor's progress is the part's value, and every
       reward on the track is claimed by tapping it once the progress has reached it. */
    noun: "報酬トラック",
    category: "features",
    paletteIcon: "linear_scale",
    w: CONTENT_W,
    h: REWARD_TRACK_H,
    radius: 20,
    hasVariant: false,
    /* the track is its own drawing: a bar, the marks along it and a tile over each one, so there is
       no part label to draw on it */
    hasLabel: false,
    hasSupporting: false,
    hasIcon: false,
    hasRewards: true,
    hasValue: true,
    size: { min: 200, max: PHONE_W, step: 4, icon: "width", presets: [CONTENT_W, PHONE_W] },
    size2: { min: 84, max: 220, step: 4, icon: "height", presets: [96, REWARD_TRACK_H, 130] },
    defLabel: "",
    defIcon: null,
    defSize: CONTENT_W,
  },
    slot: {
    label: "Shake to draw",
    noun: "シェイク",
    category: "features",
    paletteIcon: "casino",
    w: SLOT_W,
    h: SLOT_H,
    radius: 18,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasPrizes: true,
    size: { min: 120, max: 420, step: 4, icon: "width", presets: [220, 280, 340] },
    size2: { min: 80, max: 260, step: 4, icon: "height", presets: [120, 150, 190] },
    defLabel: "摇一摇",
    defIcon: null,
    defSize: SLOT_W,
  },
  /* retired: the palette offers neither of these any more — a document that holds one is migrated
     *  to the capsule machine on load (see `migrateGroups`), and this is here so the part still
     *  measures correctly on the way through */
  eggSmash: {
    label: "Golden eggs",
    noun: "金の卵",
    category: "features",
    paletteIcon: "egg_alt",
    w: 260,
    h: 200,
    radius: 18,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasPrizes: true,
    hasValue: true,
    size: { min: 160, max: 420, step: 4, icon: "width", presets: [220, 260, 320] },
    size2: { min: 120, max: 380, step: 4, icon: "height", presets: [170, 200, 250] },
    defLabel: "砸金蛋",
    defIcon: null,
    defSize: 260,
  },
  moneyTree: {
    label: "Money tree",
    noun: "金のなる木",
    category: "features",
    paletteIcon: "park",
    w: 190,
    h: 220,
    radius: 18,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasPrizes: true,
    size: { min: 120, max: 360, step: 4, icon: "width", presets: [160, 190, 240] },
    size2: { min: 140, max: 420, step: 4, icon: "height", presets: [190, 220, 260] },
    defLabel: "摇一摇",
    defIcon: null,
    defSize: 190,
  },
  calendar: {
    label: "Check-in calendar",
    noun: "カレンダー",
    category: "features",
    paletteIcon: "calendar_month",
    w: CALENDAR_W,
    h: CALENDAR_H,
    radius: 20,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasValue: true,
    size: { min: 180, max: 420, step: 4, icon: "width", presets: [260, 300, 340] },
    size2: { min: 180, max: 460, step: 4, icon: "height", presets: [240, 280, 320] },
    defLabel: "签到",
    defIcon: null,
    defSize: CALENDAR_W,
  },
  gridWheel: {
    label: "Grid prize wheel",
    noun: "四角ルーレット",
    category: "features",
    paletteIcon: "grid_view",
    w: GRID_WHEEL_SIZE,
    h: GRID_WHEEL_SIZE,
    radius: 20,
    hasVariant: false,
    hasLabel: true,
    hasSupporting: false,
    hasIcon: false,
    hasPrizes: true,
    size: { min: 140, max: 460, step: 4, icon: "width", presets: [200, 240, 300] },
    size2: { min: 140, max: 460, step: 4, icon: "height", presets: [200, 240, 300] },
    defLabel: "抽奖",
    defIcon: null,
    defSize: GRID_WHEEL_SIZE,
  },
};

export const KIND_ORDER: Kind[] = [
  /* the function button leads 操作: it is the part an author reaches for first in that category */
  "fnButton",
  "button",
  "iconButton",
  "fab",
  "extendedFab",
  "splitButton",
  "chip",
  "joystick",
  "topAppBar",
  "bottomNav",
  "navRail",
  "toolbar",
  "tabs",
  "sideTabs",
  "searchBar",
  "card",
  "listItem",
  "box",
  "invGrid",
  "itemCell",
  "assetPill",
  "dialog",
  /* 确认框挨着「对话框」：都是"问一句"的那一类（见 docs/reference-prototypes/confirm-box.md） */
  "confirmBox",
  "snackbar",
  "textField",
  "select",
  "switch",
  "checkbox",
  "radio",
  "slider",
  "stepper",
  "text",
  "image",
  "camera",
  "map",
  "badge",
  "divider",
  "loadingIndicator",
  "linearProgress",
  "progressBar",
  "circularProgress",
  "wheel",
  "gridWheel",
  "gacha",
  "slot",
  "calendar",
  /* 任务信息条是功能那一节的：它和奖励进度条是同一类东西（一条任务/奖励），排在它旁边 */
  "taskBar",
  "rewardTrack",
];

/* ---------- screen data ---------- */
export type NavTab = {
  icon: string;
  label: string;
  /** whether the icon is drawn: unset means it is, so a destination keeps its icon when the author
   *  hides it for a while and wants it back, rather than having to pick it again */
  hideIcon?: boolean;
  /** a short thing this destination says about itself — a count of what waits behind it, a "new"
   *  — drawn at its top trailing corner in the error colour, the way a game marks a tab */
  badge?: string;
  /** whether that badge is drawn: unset means it is */
  hideBadge?: boolean;
  /** the preview greys this destination out once its own rule has fired (never saved) */
  disabled?: boolean;
  /** the preview keeps this destination a size up once its own rule has fired (never saved) */
  grown?: boolean;
};

export type Item = {
  id: string;
  kind: Kind;
  label: string;
  /** The author's own name for this part: what the layers panel shows and renames, and what the
   *  prompt and the flow call it. It is never the part's words — those are `label`, edited in the
   *  inspector — so renaming a row cannot rewrite what the part displays. Unset means the row names
   *  the part by its own text, and then by its kind. */
  name?: string;
  icon: string | null;
  icon2?: string | null;
  variant: Variant;
  supporting?: string;
  size?: number;
  radiusTop?: number;
  radiusBottom?: number;
  /** boxes only: each corner on its own, when the pairs above are not enough */
  corners?: Radii;
  tabs?: NavTab[];
  /** navigation bars, rails and tab rows: index of the selected destination (0 when unset) */
  selected?: number;
  /** list items: a switch at the trailing end instead of an icon; `checked` is its state */
  switch?: boolean;
  /** cards: no image area; `src` puts a picture in it */
  noImage?: boolean;
  /** 资产框：图标和金额之间的间距（dp）。未设时按绘制高度推算（见 assetPillMetrics），
   *  设了就是作者自己的数：它决定自然宽度，间距拉长整条就跟着变长。 */
  markGap?: number;
  /** cards: where the image area sits — the top when unset, a full-height side column, or the whole background behind the text */
  imagePos?: CardImagePos;
  /** cards: the image area's size in dp — its height on top, its width at a side; a background image fills the card */
  imageSize?: number;
  /** cards: where the text block sits vertically; unset means the top, or the bottom over a background image */
  contentAlign?: CardAlign;
  /** The colour of the words, instead of the automatic one: a card's headline and body, and (the name
   *  line only — the countdown keeps its own ink) a function button's 功能名. A role, or a `#rrggbb`. */
  textColor?: TextColor;
  /** on/off state for switches, checkboxes and chips */
  checked?: boolean;
  /** the words of a second button, where a part offers two ways to draw (ten at once) */
  label2?: string;
  /** The words of a **third** button. One kind asks for it: the confirm box (「确认框」), whose two
   *  ordinary buttons are `label2` (确认) and `label3` (取消) — the author's own mapping, kept by
   *  `confirmBoxMetrics`. Fused like `label2`, so a document that holds it needs no new shape. */
  label3?: string;

  /** how many times that second button draws */
  many?: number;
  /** a switch whose handle stays plain when on, without the check icon */
  noCheck?: boolean;
  /** 0..100 for sliders and determinate progress; undefined = indeterminate */
  value?: number;
  /** a direction wheel whose knob springs back to the middle when the finger lifts: undefined means
   *  it does, which is what a movement stick does */
  joystickReturn?: boolean;
  /** the pool a prize wheel draws from, in the order the prizes are drawn on it */
  prizes?: Prize[];
  wavy?: boolean;
  /** Undefined retains the original rail; false/true select the collapsed/expanded expressive rail. */
  railExpanded?: boolean;
  /** Expanded rail overlays a scrim rather than taking additional layout space. */
  railModal?: boolean;
  [railExpansionSide]?: "left" | "right";
  /** Progress track thickness in dp (TRACK_MIN..TRACK_MAX); omitted uses the standard 4dp stroke. */
  trackThickness?: number;
  contained?: boolean;
  /** free text the author writes about what this part does */
  note?: string;
  /** what `note` said before the AI rewrote it, so the rewrite can be undone */
  noteHistory?: string[];
  bold?: boolean;
  /** height for free-form boxes */
  size2?: number;
  /** Slot grids only: what one cell measures — the same whatever the frame measures */
  cell?: number;
  /** Slot grids only: how many cells across; unset lets the frame's width decide */
  gridCols?: number;
  /** Slot grids only: how many rows of cells; unset lets the frame's height decide, and more
   *  rows than fit are what the frame scrolls over */
  gridRows?: number;
  /** Slot grids only: whether every cell shows a checkbox the visitor can tick */
  checkboxes?: boolean;
  /** Slot grids only: the item name under the cells. It is drawn under a cell that holds something
   *  and left off an empty slot — a name labels an item, and a bare slot has none. Turning it on
   *  also widens the row pitch by the name's own height, so the words of one row never touch the
   *  cells of the next. */
  cellNames?: boolean;
  /** Slot grids only: the words under a cell. Unset means the kind's own placeholder — 「物品名」 in
   *  the author's language — so switching the names on shows something at once. */
  cellText?: string;
  /** A slot grid's cell: which column of the board it sits in. Its place is its slot rather than
   *  its own x and y, so the frame can be resized without the cell losing what it holds. */
  cellCol?: number;
  cellRow?: number;
  /** A text that reads another part instead of its own words: the id of the part whose value it
   *  shows — a volume slider's number beside the slider, live while the visitor drags it. */
  shows?: string;
  /** A reward track's own list: what waits at each step of the progress, and how far along that is.
   *  The part's own `value` is how far the visitor has come. */
  rewards?: Reward[];
  /** Sliders and bars: draw the value on the part itself, so a number a button or a drag moves is
   *  there to be read without a second component bound to it. */
  showValue?: boolean;
  /** Whether that number carries its percent sign. Unset means it does, so a document drawn before
   *  the switch existed keeps the look it was designed with; `false` drops the sign for a slider
   *  that stands for something that is not a share of a hundred. */
  unit?: boolean;
  /** A text that reads a part keeps its own words as well (`shows` + `mix`): the value lands where
   *  the words say `{v}`, so "出售数量： {v} / 10000" is a sentence with a live number in it. */
  mix?: boolean;
  /** The panel of a tab: the room under a tab row that holds what that tab shows. Its box is the
   *  row's to decide — one panel per tab, filling the area under the strip — so it is not dragged,
   *  not sized, and never listed as a container the author placed. */
  panel?: boolean;
  tabSide?: TabSide;
  /** A side row only: the share of its width the labels take, as a percentage — the page takes the
   *  rest, so this is the ratio between the two. Unset is a third of the box, which is the column the
   *  part has always had. */
  sideRail?: number;
  /** How far the part is turned, in degrees: unset is straight. It turns the way it is drawn — the
   *  box, its corners, its words and everything it holds — while the place it takes in the layout, and
   *  the rectangle the editor lines it up by, stay where they are. */
  rot?: number;
  /** The top of a slider's or a stepper's range: unset is a hundred, which is what a percentage
   *  stops at, while "出售数量 … / 10000" wants a ceiling of its own. Drag, the number on the part,
   *  the ＋/− buttons and the numbers a rule adds all stop here. */
  max?: number;
  /** Seconds until this part puts itself away — the activity entry that closes after three days, the
   *  bubble that dismisses itself. The count runs on the preview's own clock and starts when the
   *  part appears: a container when its screen is shown, an overlay when it opens. A part hides, and
   *  takes its children with it; an overlay closes the way a tap outside it does. */
  autoClose?: number;
  /** A function button only: whether the countdown line under its name is drawn. Off, the line is left
   *  out rather than drawn empty — the part shows the button and the name, and nothing else. */
  timer?: boolean;
  /** How many units that countdown stands at, and which unit it counts in; unset is three minutes. */
  timerValue?: number;
  timerUnit?: TimerUnit;
  /** A function button or a button: whether it wears a badge on the top-right of its circle (see
   *  `badgeOn`). On a task bar the same switch means the **first corner mark of every reward cell**,
   *  which sits on the cell's top-left and may carry a colour of its own (`badgeColor`) — the corners
   *  are the part's own business, exactly as an item cell's two marks are. (A navigation
   *  destination's own `badge` is a different field on a different type: that one is the words, this
   *  one is the switch.) */
  badge?: boolean;
  /** What that badge says. Unset or empty draws the bare dot a "new" mark is, which is why switching
   *  the badge on does not write any words. */
  badgeText?: string;
  /** A task bar only: the colour of that first mark's pill — a palette role or a #rrggbb literal,
   *  read by the same rule `Item.color` reads by; unset leaves the pill in the theme's own role.
   *  (The second mark's colour is `badge2Color`, the field an item cell already uses for its own.) */
  badgeColor?: string;
  /** An item cell only: the second mark it wears, on the top-left of the cell — the quality tag a
   *  game brands an item with. Its own colour is a palette role or a #rrggbb literal, the same rule
   *  `Item.color` reads by; unset leaves the mark in the theme's own role. On a task bar the same
   *  three fields mean the second corner mark of every reward cell, drawn on the cell's top-right. */
  badge2?: boolean;
  badge2Text?: string;
  badge2Color?: string;
  /** A task bar only: whether the button inside the bar wears a badge on its top-right corner. This
   *  is a pair of its own rather than `badge`/`badgeText`, because on a task bar those two are the
   *  first cell mark (see above). The words are what decides the badge: an empty one draws nothing
   *  at all, the way a button's own corner badge behaves (see `taskBarButtonBadge`). The badge is
   *  drawn as a layer *above* the button, at the button's top right, and it may hang outside the
   *  button's box — the row reserves the room for it (see `taskBarMetrics`). */
  buttonBadge?: boolean;
  buttonBadgeText?: string;
  /** A task bar only: the icon in that same badge. The badge holds words or an icon — the icon wins
   *  when both are set (see `taskBarButtonBadgeIcon` / `taskBarButtonBadgeOn`). It is chosen through
   *  the ordinary icon slot (the 「图标」 section), so it is the control every other slot uses. The
   *  lock icon is not just a picture: the badge then locks the button, which answers no tap at all
   *  (see `taskBarButtonLocked`). */
  buttonBadgeIcon?: string | null;
  /** the background this part paints, or `transparent` to let what is behind it show */
  fill?: FillToken;
  /** containers: the axes the visitor can move the content along; unset holds still */
  scroll?: ScrollAxis;
  /** containers: the offset the content starts at — what the author designs, and where the visitor begins */
  scrollPos?: { x?: number; y?: number };
  /** background behind a list item's leading icon; "none" draws the icon bare */
  iconFill?: FillToken | "none";
  /** data URL of a user-picked image */
  src?: string;
  /** tap navigation to another frame */
  action?: Action;
  /** per-slot tap navigation for bars: "icon" / "icon2" on a top app bar, "tab:N" on a navigation bar */
  actions?: Record<string, Action>;
  /** the look a toggle button takes once tapped; undefined = not a toggle */
  toggle?: ToggleLook;
  /** a border drawn inside the part: its thickness in dp; 0 or unset means none */
  strokeWidth?: number;
  /** the border's colour: a palette role key or a #rrggbb literal; unset uses outline */
  strokeColor?: string;
  /** The state machine of this part: the looks a tap moves it between, drawn as a flow in the
   *  inspector. Documents written before flows carry `states`, which is read back as one. */
  flow?: PartFlow;
  /** Interaction rules hung on this part, the old way: read back as a flow when the document is
   *  opened, and kept so those documents still open. */
  states?: ItemState[];
  /** The parts this one holds: a container's children, drawn inside its box. Their x/y
   *  are offsets from the container's top-left corner, so moving or resizing the
   *  container carries them along. */
  children?: PlacedItem[];
  /** a colour of this part's own: a palette role key or a #rrggbb literal. Unset keeps
   *  the role the kind would pick for itself. */
  color?: string;
  /** buttons and other round-able kinds: the outline they take. Unset is the kind's
   *  own shape (a pill for a button, a circle for an icon button or a FAB). */
  /** This container is an overlay: the screen keeps it hidden until a tap opens it, and
   *  the level says how it takes the screen over. Unset with `modal` set reads as "modal". */
  overlay?: OverlayLevel;
  /** the spelling of `overlay: "modal"` used by documents saved before levels existed */
  modal?: boolean;
  /** a navigation bar with a collapse button: unset means the bar has none. Folded hides
   *  every destination's label and keeps the icons. */
  barFolded?: boolean;
  /** a side rail whose own button has folded every destination away, leaving the button */
  railFolded?: boolean;
  /** Rules hung on one destination of a bar rather than on the bar itself: the key is the
   *  slot `actionSlotsOf` names ("tab:2", "icon", ...). */
  slotStates?: Record<string, ItemState[]>;
  /** one machine per slot of a bar, keyed the way `slotStates` is: the tab that changes when tapped */
  slotFlows?: Record<string, PartFlow>;
  /** how many destinations fit on one line: more than this wraps the bar onto another row
   *  (a rail grows another column). Unset means they all share one line. */
  navPerRow?: number;
  /** tab rows only: the M3 underline, or the buttons most games switch pages with. Unset is underline. */
  tabStyle?: TabStyle;
  shape?: ButtonShape;
  /** stacking level among the parts it shares a screen with: a higher one draws on top.
   *  Unset means LAYER_DEFAULT. */
  z?: number;
};

/* ---------- state transitions hung on a part ---------- */

/** What a tap changes about the part itself. `disable` and `cooldown` grey the part
 *  out (a cooldown also counts down for `seconds`), `label`, `color` and `icon`
 *  swap what the part says or looks like using `value`, and `hide` takes it off screen. */
export type StateEffect = "disable" | "cooldown" | "label" | "color" | "icon" | "grow" | "hide" | "variant";
export const STATE_EFFECTS: { key: StateEffect; icon: string }[] = [
  { key: "disable", icon: "block" },
  { key: "cooldown", icon: "timer" },
  { key: "label", icon: "edit" },
  { key: "color", icon: "format_color_fill" },
  { key: "icon", icon: "emoji_symbols" },
  { key: "grow", icon: "open_in_full" },
  { key: "hide", icon: "visibility_off" },
];
/** Documents written while a tap could swap the *variant* still carry that rule: it keeps working
 *  and stays valid, it is simply no longer offered — an icon is the thing a tap changes now. */
export const LEGACY_STATE_EFFECTS: StateEffect[] = ["variant"];
export const isStateEffect = (v: unknown): v is StateEffect =>
  STATE_EFFECTS.some((e) => e.key === v) || LEGACY_STATE_EFFECTS.includes(v as StateEffect);

export type ItemState = {
  id: string;
  /** what sets the rule off; only a tap for now */
  trigger: "tap";
  effect: StateEffect;
  /** the label a `label` rule writes, or the variant a `variant` rule takes */
  value?: string;
  /** a `cooldown` rule's length in seconds */
  seconds?: number;
};

/* ---------- a part's own state machine ---------- */

/**
 * One look a part can be in. A field left out keeps whatever the author drew, so a node that only
 * swaps the icon says exactly that: a look is a difference from the part rather than a copy of it,
 * and editing the part still moves every node that never overrode the field.
 */
export type PartLook = {
  id: string;
  /** what the flow calls this node; unset reads as the label the part shows while in it */
  name?: string;
  label?: string;
  /** null draws the node with no icon at all */
  icon?: string | null;
  /** a palette role key or a #rrggbb literal, as Item.color is */
  color?: string;
  variant?: Variant;
  /** the node greys the part out: it stops answering taps while it is in it */
  disabled?: boolean;
  /** the node draws the part a size up */
  grow?: boolean;
  /** the node takes the part off the screen */
  hidden?: boolean;
};

/** The look a part is drawn in: the one its author made, before any step has been taken. */
export const START_LOOK = ":start";

/** What sets a step off: the visitor's tap, or a wait counted from the moment the part entered the
 *  look it is in. */
export type StepTrigger = { kind: "tap" } | { kind: "after"; seconds: number };

/** One transition of the machine: from a look (or START_LOOK) to another, once its conditions hold.
 *  Two steps leaving the same look are read in order, which is the only order an author has to
 *  think about — and it is local to one look rather than to the whole part. */
export type PartStep = {
  id: string;
  from: string;
  /** The look the step lands in. Left out, the part keeps the look it is in and the step only does
   *  what `do` says — which is what a button that just drives another part needs: it stays where it
   *  is, so the very same tap fires again and again instead of walking off after one press. */
  to?: string;
  trigger: StepTrigger;
  /** what else the step does, in order: a jump, or a look latched onto a part */
  do?: RuleAction[];
};

/** The looks a part can be in and the steps between them. Every part has one of its own; each slot
 *  of a bar can have one as well, which is what makes a tab change when it is tapped. */
export type PartFlow = { looks: PartLook[]; steps: PartStep[] };

export const isTimedStep = (s: PartStep) => s.trigger.kind === "after";
export const stepSeconds = (s: PartStep) => (s.trigger.kind === "after" ? Math.max(0, s.trigger.seconds) : 0);
/** the look an id names, or undefined for the drawn part */
export const lookOf = (flow: PartFlow | undefined, id: string | undefined) => (id ? flow?.looks.find((l) => l.id === id) : undefined);
/** the steps that leave a look, in the order they were written */
export const stepsFrom = (flow: PartFlow | undefined, from: string) => (flow?.steps ?? []).filter((s) => s.from === from);

/**
 * 一个部件的"文字"放在哪个字段上
 *
 * 大多数部件就是它自己那行 `label`。融合部件不是：任务信息条的文字是右端那颗**领取按钮**上的两个字
 * （「受け取る」→「受け取り済み」），确认框的文字是那颗**确认按钮**上的两个字（「确认」→「已确认」）——
 * 标题说的是"这是哪一条任务 / 这是个什么框"，不该跟着一次点按改。所以"改文字"这类外观
 * （`PartLook.label` 与 `RulePatch.label`）落在按钮文字（`label2`）上 —— 画（lookItem）、面板里那个
 * 字段的起始值（Inspector 的 lookSeed）、流程图的节点名（flow.ts 的 lookWords）、提示里那句话
 * （prompt.ts）全都走这一个判定，改一处就够。
 */
export const wordsKeyOf = (it: Pick<Item, "kind">): "label" | "label2" => (tapLivesInside(it.kind) ? "label2" : "label");

/** 这个部件此刻的文字：融合部件读那颗主按钮上的字，其余读自己那行 */
export const wordsOf = (it: Item): string => (tapLivesInside(it.kind) ? it.label2 ?? "" : it.label);

/** 一次"改文字"落成补丁：融合部件落到那颗主按钮的文字上（见 wordsKeyOf） */
export const wordsPatch = (it: Pick<Item, "kind">, words: string): Partial<Item> =>
  tapLivesInside(it.kind) ? { label2: words } : { label: words };

/**
 * 「置灰并停止响应」画在哪个范围上：整块部件，还是部件里那颗按钮
 *
 * 普通部件整块灰掉、整块不再收事件。融合部件（任务信息条、确认框）不是：条里唯一活着的、框里能点的
 * 都是那几颗**按钮** —— 点击归它们（见 Preview 的 PartPressContext）、文字归它们（wordsKeyOf）、所以
 * "置灰并停止响应"也该只灰它们：标题、奖励格、正文带照旧，整块部件也不吃 `pointer-events: none`
 * （在那个容器里还能拖着滚）。
 */
export const disablesWholePart = (kind: Kind): boolean => !tapLivesInside(kind);

/** 一整份外观补丁落在一个部件上：`label` 走 wordsKeyOf 那一处，其余字段照旧。 */
export function withLook(it: Item, patch: RulePatch | undefined): Item {
  if (!patch) return it;
  const { label, ...rest } = patch;
  const next = { ...it, ...rest };
  return label === undefined ? next : { ...next, ...wordsPatch(it, label) };
}

/** The part as one of its looks draws it: the drawn part with the node's own fields on top. */
export function lookItem(it: Item, look: PartLook | undefined): Item {
  if (!look) return it;
  let out = it;
  if (look.label !== undefined && look.label !== wordsOf(out)) out = { ...out, ...wordsPatch(out, look.label) };
  if (look.icon !== undefined && look.icon !== it.icon) out = { ...out, icon: look.icon };
  if (look.color !== undefined && look.color !== it.color) out = { ...out, color: look.color };
  if (look.variant !== undefined && look.variant !== it.variant) out = { ...out, variant: look.variant };
  return out;
}

/** The step a *tap* takes from this look, or null when the part's plain action is what runs.
 *  Two steps leave the same look in the order they were written, so that is the whole of the
 *  order an author thinks about. */
export function firstTapStep(flow: PartFlow | undefined, from: string): PartStep | null {
  for (const s of stepsFrom(flow, from)) if (s.trigger.kind === "tap") return s;
  return null;
}

/** The step that has come round on its own, counted from the moment the part entered this look. */
export function firstDueStep(flow: PartFlow | undefined, from: string, elapsed: number): PartStep | null {
  for (const s of stepsFrom(flow, from)) if (s.trigger.kind === "after" && elapsed >= Math.max(0, s.trigger.seconds)) return s;
  return null;
}

/** Whole seconds still to wait for the soonest timed step leaving this look, 0 when the look holds
 *  no clock: a look that greys the part out and comes back shows the wait as a countdown. */
export function waitLeft(flow: PartFlow | undefined, from: string, elapsed: number): number {
  let best = 0;
  for (const s of stepsFrom(flow, from)) {
    if (s.trigger.kind !== "after") continue;
    const left = Math.max(0, s.trigger.seconds - elapsed);
    if (best === 0 || left < best) best = left;
  }
  return best;
}

/** Whether any part carries a step that waits: the ticker only has to run when one does. */
export function hasTimedSteps(items: Item[]): boolean {
  return items.some(
    (it) =>
      (it.flow?.steps ?? []).some(isTimedStep) ||
      /* 槽位那几台机器照旧一台一台看；`?? []` 和 audit.ts / prompt.ts 那几处同一支笔，读坏的文档不该
         让预览整个挂掉（`readSlotFlows` 之后本来就不会有那种形状了，这是第二道保险） */
      Object.values(it.slotFlows ?? {}).some((f) => (f?.steps ?? []).some(isTimedStep)) ||
      (it.children ? hasTimedSteps(it.children) : false),
  );
}

/** Whether any part puts itself away on a clock: a ticker has to run for that too, or a document
 *  whose only timer is an auto-close would sit there and never count down. */
export function hasAutoClose(items: Item[]): boolean {
  return items.some((it) => !!it.autoClose || (it.children ? hasAutoClose(it.children) : false));
}

/** What a part that puts itself away does when its time is up: it keeps the look it is in and hides
 *  itself, children and all — the same latch a button outside it would set, so a container's contents
 *  go with it and nothing behind a hidden part can be tapped. An overlay takes the other road and
 *  closes, which is the runtime's own business rather than a patch on the part. */
/** What a new auto-close counts to before the author says otherwise: long enough to read a bubble,
 *  short enough that a prototype is not slowed down by it. */
export const AUTO_CLOSE_DEF = 5;

export const AUTO_HIDE_STEP: PartStep = { id: "auto-close", from: START_LOOK, trigger: { kind: "after", seconds: 0 }, do: [{ kind: "look", hidden: true }] };

/**
 * 确认框那两颗按钮各自那一下：**点下去就把这一块收起来**
 *
 * 一个步骤、不另立状态（`looks` 空着 —— 换的不是"画成什么样"，而是"还在不在"，所以机位仍旧是画出来的
 * 那一个）：`from: :start`、不写 `to`，和自动关闭那一步（AUTO_HIDE_STEP）同一个写法——那一步"点住了的
 * 外观"就落在这一块自己身上（见 Preview 的 runRuleAction 与 lib/tokens 的 slotLookOwner）。两颗配的是
 * 同一步：作者在这一版里加上的"隐藏面板"逻辑，也就是「不管是确认还是取消，默认关闭此面板」
 * （见 docs/reference-prototypes/confirm-box.md）。
 *
 * 去处仍旧归作者：在「点击后变化」里把这一步改成"关闭当前面板"、跳去某一屏、或者干脆清掉，都是作者自己
 * 的事 —— 这一份只是新落下的那颗确认框的起点。
 */
export const CONFIRM_BOX_HIDE_STEP: PartStep = { id: "confirm-box-hide", from: START_LOOK, trigger: { kind: "tap" }, do: [{ kind: "look", hidden: true }] };

/** 一台"点一下就把这一块收起来"的机器：就一个步骤，没有自己的状态（见 CONFIRM_BOX_HIDE_STEP）。
 *  每次调用都造一份新的，两颗按钮的两台机器（以及两个部件之间）因此不共用同一个对象。 */
export const confirmBoxHideFlow = (): PartFlow => ({ looks: [], steps: [{ ...CONFIRM_BOX_HIDE_STEP }] });

/** Where a part is: the look it is in, and the moment on the preview's clock it got there. */
export type AtLook = { look: string; since: number };
export type MachineAt = Record<string, AtLook | undefined>;
/** the look a part is in, the drawn one for a part no step has moved yet */
export const lookAt = (at: MachineAt, id: string) => at[id]?.look ?? START_LOOK;

/**
 * The state rules a document was written with, read back as a machine: one tap that swapped the
 * part's look becomes a node the tap reaches — and, when the icon was the thing it changed, the
 * same tap takes it back, which is how those documents flipped. A cooldown becomes a greyed node
 * the part waits its way out of, and a plain disable, grow or hide becomes a node it stays in.
 */
export function statesAsFlow(states: ItemState[]): PartFlow | undefined {
  const cooling = states.find((s) => s.effect === "cooldown");
  if (states.length === 0) return undefined;
  const look: PartLook = { id: uid() };
  for (const s of states) {
    switch (s.effect) {
      case "disable":
        look.disabled = true;
        break;
      case "grow":
        look.grow = true;
        break;
      case "hide":
        look.hidden = true;
        break;
      case "label":
        if (s.value !== undefined) look.label = s.value;
        break;
      case "icon":
        look.icon = s.value ? s.value : null;
        break;
      case "color":
        if (isCustomColor(s.value)) look.color = s.value;
        break;
      case "variant":
        if (isVariant(s.value)) look.variant = s.value;
        break;
      case "cooldown":
        break;
    }
  }
  if (cooling) look.disabled = true;
  const steps: PartStep[] = [{ id: uid(), from: START_LOOK, to: look.id, trigger: { kind: "tap" } }];
  if (states.some((s) => s.effect === "icon")) steps.push({ id: uid(), from: look.id, to: START_LOOK, trigger: { kind: "tap" } });
  if (cooling) steps.push({ id: uid(), from: look.id, to: START_LOOK, trigger: { kind: "after", seconds: Math.max(1, cooling.seconds ?? 3) } });
  return { looks: [look], steps };
}

/**
 * Every part in a document, with the state rules it was written with read back as a flow. This runs
 * as a document is opened, so the editor, the preview and the prompt only ever see machines.
 */
export function migrateFlows(groups: Group[]): Group[] {
  /** A step written while variables existed may carry a guard or a write: neither can run any more,
   *  so both are dropped. A machine that needs nothing dropped is handed back as it is. */
  const tidy = (machine: PartFlow | undefined): PartFlow | undefined => {
    if (!machine) return machine;
    let changed = false;
    const steps = machine.steps.map((st) => {
      const legacy = st as PartStep & { when?: unknown };
      const acts = st.do ?? [];
      const kept = acts
        .filter((a) => a.kind === "goto" || a.kind === "back" || a.kind === "close" || a.kind === "closeAll" || a.kind === "look")
        /* a look was once able to restyle the part it aims at: that choice is gone */
        .map((a) => (a.kind === "look" && a.variant !== undefined ? { kind: "look" as const, target: a.target, icon: a.icon, label: a.label, color: a.color } : a))
        /* and a transition the picker no longer offers reads back as no animation */
        .map((a) => {
          if (a.kind !== "goto") return a;
          const t = retiredTransition(a.transition);
          return t === a.transition ? a : { ...a, transition: t };
        });
      /* Nothing to drop: the very same step goes back, so an untouched machine keeps its identity. */
      if (legacy.when === undefined && kept.length === acts.length && kept.every((a, i) => a === acts[i])) return st;
      changed = true;
      const { when: _when, ...clean } = legacy;
      return { ...clean, ...(kept.length ? { do: kept } : {}) } as PartStep;
    });
    return changed ? { looks: machine.looks, steps } : machine;
  };
  const walk = <T extends Item>(it: T): T => {
    const children = it.children?.map(walk);
    const nested = children && children.some((c, i) => c !== it.children?.[i]) ? children : it.children;
    /* what a document written before this build carries, and this one does not */
    const legacy = it as Item & { rules?: unknown; states?: ItemState[]; slotStates?: Record<string, ItemState[]> };
    const { rules: _rules, states, slotStates, ...rest } = legacy;
    const madeFlow = states && states.length ? statesAsFlow(states) : undefined;
    /* a document from a build that wrote something else there must not take the editor down:
       only a real list of rules becomes a machine */
    const madeSlots = slotStates
      ? Object.entries(slotStates).reduce<Record<string, PartFlow>>((acc, [key, list]) => {
          if (!Array.isArray(list)) return acc;
          const made = statesAsFlow(list);
          if (made) acc[key] = made;
          return acc;
        }, {})
      : undefined;
    /* A jump the plain action asks for carries a transition too — the same retired value comes back
       as no animation, so a document reads the same whichever way its tap was written. */
    const keptAction = it.action
      ? (() => {
          const t = retiredTransition(it.action!.transition, !!it.action!.dialog);
          return t === it.action.transition ? it.action : { ...it.action, transition: t };
        })()
      : undefined;
    const keptActions = it.actions
      ? Object.entries(it.actions).reduce<NonNullable<Item["actions"]>>((acc, [key, a]) => {
          if (!a) return acc;
          const t = retiredTransition(a.transition, !!a.dialog);
          acc[key] = t === a.transition ? a : { ...a, transition: t };
          return acc;
        }, {})
      : undefined;
    const actionsChanged = !!it.actions && !!keptActions && Object.entries(it.actions).some(([k, a]) => keptActions[k] !== a);
    const flow = tidy(madeFlow ?? it.flow);
    const slotFlows = Object.entries(madeSlots ?? it.slotFlows ?? {}).reduce<Record<string, PartFlow>>((acc, [key, machine]) => {
      const kept = tidy(machine);
      if (kept) acc[key] = kept;
      return acc;
    }, {});
    const hadSlots = Object.keys(it.slotFlows ?? {}).length > 0;
    const blank = _rules === undefined && states === undefined && slotStates === undefined && flow === it.flow && !hadSlots && nested === it.children && keptAction === it.action && !actionsChanged;
    /* nothing to read back: the part itself, untouched, so an untouched document keeps its identity */
    if (blank) return it;
    return {
      ...rest,
      ...(nested ? { children: nested } : {}),
      ...(flow ? { flow } : {}),
      ...(Object.keys(slotFlows).length ? { slotFlows } : {}),
      ...(keptAction !== it.action ? { action: keptAction } : {}),
      ...(actionsChanged ? { actions: keptActions } : {}),
    } as T;
  };
  return groups.map((g) => {
    const items = g.items.map(walk);
    return items.some((x, i) => x !== g.items[i]) ? { ...g, items } : g;
  });
}

export type ToggleLook = { icon?: string | null; variant?: Variant; label?: string };

/** what a step of a machine, or a part's own tap, can do besides landing somewhere */
export type RuleAction =
  /** the same places a plain tap can go: a page, or an overlay popped over this one */
  | { kind: "goto"; to: string; transition: Transition }
  /** the previous screen, as the preview's back button does it */
  | { kind: "back" }
  /** puts away the overlay the part stands in */
  | { kind: "close" }
  /** every overlay this screen has open, a page that closes the whole stack in one tap */
  | { kind: "closeAll" }
  /** What a step changes about a part: `target` names the part it changes, and leaving it out changes
   *  the part the step belongs to — a claim button can therefore turn the gift icon beside it into a
   *  claimed one. Only the properties the action names are written, so a step that says nothing about
   *  one leaves it exactly as it found it. A document written while an action could also restyle the
   *  part keeps its `variant` here; the reader drops it. */
  | ({ kind: "look"; target?: string; variant?: Variant; valueOp?: ValueOp } & RulePatch);


/** What a step does to a number: writes one, or walks the one the part is already at — which is what
 *  turns a plus button into a stepper rather than a jump to a number. */
export type ValueOp = "set" | "add" | "sub";
export const VALUE_OPS: { key: ValueOp; icon: string }[] = [
  { key: "set", icon: "login" },
  { key: "add", icon: "add" },
  { key: "sub", icon: "remove" },
];
export const isValueOp = (v: unknown): v is ValueOp => VALUE_OPS.some((o) => o.key === v);

/** What a value runs up to before the author says otherwise, and how far that ceiling may be pushed:
 *  a volume or a percentage stops at a hundred, a count of things runs to ten thousand. */
export const MAX_DEF = 100;
export const MAX_MIN = 1;
export const MAX_MAX = 1_000_000;

/** A ceiling the author typed, brought into the range a value may run to at all. */
export const clampMax = (n: number) => Math.max(MAX_MIN, Math.min(MAX_MAX, Math.round(n)));

/** The top of a part's value: the author's own maximum, a hundred unless they set one. It reads no
 *  more than the one field, so a caller that has only an id and a max in hand can still ask. */
export const maxOf = (it: { max?: number }): number => clampMax(it.max ?? MAX_DEF);

/** A share of the part's range, whole: every value a step or a drag writes lands in that range. */
export const clampValue = (n: number, max: number = MAX_DEF) => Math.max(0, Math.min(Math.max(MAX_MIN, max), Math.round(n)));

/** The value a step asks for. `set` writes the number it carries; `add` and `sub` walk the value the
 *  part is at now, one step at a time, which is how a pair of buttons drives a slider. */
export function valueAfter(op: ValueOp | undefined, current: number, amount: number, max: number = MAX_DEF): number {
  return clampValue(op === "add" ? current + amount : op === "sub" ? current - amount : amount, max);
}

/**
 * The properties a step may set on a part. They are the part's own fields, plus the three flags a look
 * can carry, and every one of them is something the part *draws with*: nothing here moves a part or
 * changes its size, so a step can change one without the layout having to be worked out again.
 */
export const RULE_FIELDS = ["label", "icon", "color", "fill", "checkboxes", "checked", "selected", "value", "disabled", "hidden", "grow"] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

/** What a step writes onto the part it names: the fields it mentions, and the flags a look may set.
 *  A rule changes how a part is drawn, never what it is: its id, its kind, what it holds and its own
 *  machine are not a step's to write. */
export type RulePatch = Partial<Omit<Item, "id" | "kind" | "children" | "flow" | "slotFlows" | "states" | "slotStates">> &
  Partial<Pick<PartLook, "disabled" | "hidden" | "grow">>;

/** Which of those properties a part of this kind really has: only the ones it draws with, so the
 *  list the author picks from reads as that component's own properties rather than every field there
 *  is. A rule may aim a look at another part, and the part it aims at is what decides the list. */
export function ruleFieldsFor(it: Item): RuleField[] {
  const spec = specOf(it);
  const out: RuleField[] = [];
  if (spec.hasLabel) out.push("label");
  if (spec.hasIcon) out.push("icon");
  out.push("color");
  if (spec.hasFill) out.push("fill");
  if (it.kind === "invGrid") out.push("checkboxes");
  if (spec.hasChecked || it.kind === "listItem") out.push("checked");
  if ((isTabRow(it) || it.kind === "select") && (it.tabs?.length ?? 0) > 0) out.push("selected");
  if (spec.hasValue) out.push("value");
  /* the three flags a look carries: they are how a rule greys a part out, takes it off the screen
     or makes it stand a size up, without that part needing a machine of its own */
  out.push("disabled", "hidden", "grow");
  return out;
}

/** What a look action asks for, as the patch a step latches onto its part: only the fields it names.
 *  An icon set to nothing is the part drawn bare, which is why an empty string reads as `null`. */
export function rulePatch(a: Extract<RuleAction, { kind: "look" }>): RulePatch {
  const out: Record<string, unknown> = {};
  for (const k of RULE_FIELDS) {
    const v = (a as Record<string, unknown>)[k];
    if (v === undefined) continue;
    out[k] = k === "icon" && typeof v === "string" && !v ? null : v;
  }
  return out as RulePatch;
}

export const RULE_ACTIONS: { key: RuleAction["kind"]; icon: string }[] = [
  { key: "goto", icon: "login" },
  { key: "back", icon: "arrow_back" },
  { key: "close", icon: "close_fullscreen" },
  { key: "closeAll", icon: "layers_clear" },
  { key: "look", icon: "format_paint" },
];
export const isRuleKind = (v: unknown): v is RuleAction["kind"] => RULE_ACTIONS.some((a) => a.key === v);

/** a part placed inside a container: its own offsets from the container's top-left */
/** the outlines a button-like part can take */
export type ButtonShape = "default" | "round" | "square";
export const BUTTON_SHAPES: { key: ButtonShape; icon: string }[] = [
  { key: "default", icon: "rectangle" },
  { key: "round", icon: "circle" },
  { key: "square", icon: "square" },
];
/**
 * The surface a badge paints. A badge is a pill of its own rather than a box, so nothing else paints
 * it: the colour the author gave it fills the pill (the error role when they gave none), and the
 * border they asked for rings the same pill — an inset ring on the box behind it would sit under it
 * and never be seen.
 */
export function badgeSurface(it: Item, p: Palette): { background: string; color: string; boxShadow?: string } {
  const own = colorOverrideOf(it, p);
  const stroke = strokeOf(it, p);
  return { background: own?.main ?? p.error, color: own?.on ?? p.onError, ...(stroke ? { boxShadow: stroke } : undefined) };
}

/**
 * Whether a part takes a dragged *text* into itself: a part that writes text of its own — a button,
 * a card — so a caption can be dropped straight onto the control it belongs to. A text is not one
 * of them, and a container is a target for anything already.
 */
export const takesText = (it: Item) => it.kind !== "text" && !!KIND_SPEC[it.kind]?.hasLabel;

/** kinds whose outline the shape switch controls */
export const SHAPED: Kind[] = ["button", "iconButton", "fab", "extendedFab", "fnButton"];
/** the shapes a kind that is a circle by nature — an icon button, a FAB, a function button — can take */
export const ROUND_SHAPES: { key: ButtonShape; icon: string }[] = [
  { key: "round", icon: "circle" },
  { key: "square", icon: "square" },
];
/** whether a kind wears a circle unless the author asks for a square */
export const roundByNature = (kind: Kind) => kind === "iconButton" || kind === "fab" || kind === "fnButton";
/** The corner a circle-by-nature part wears: a true circle unless the author asked for the rounded
 *  square an icon button takes (`scaleR(8)`, the document's own shape scale). `size` is the circle's
 *  diameter, which is not always the part's width — a function button makes room for its lines first. */
export const roundShapeRadius = (shape: ButtonShape | undefined, size: number) =>
  shape === "square" ? scaleR(8) : Math.round(size / 2);
export const isButtonShape = (v: unknown): v is ButtonShape => BUTTON_SHAPES.some((x) => x.key === v);

export type PlacedItem = Item & { x: number; y: number };

/** The axes a container's content can be moved along. A container without one holds still. */
export type ScrollAxis = "x" | "y" | "both";

/** kinds that can act as a toggle button in the preview */
export const TOGGLEABLE: Kind[] = ["button", "iconButton", "fab", "extendedFab"];

/** target id that pops the preview stack instead of opening a frame */
export const BACK_TARGET = "back";

/**
 * 关掉"当前那一层面板"的落点
 *
 * 和 `BACK_TARGET` 一样是一个特殊目标，由预览来兑现（见 components/Preview.tsx 的 runAction）：面板是
 * 这一屏上的一层叠加（`dialog.openId`）就把它收起来；这一屏自己就是被当弹框压上来的，就退回上一层。
 * 作者画弹框时的老写法 `to: BACK_TARGET` 也是"回去"，但面板没有上一屏可回时"返回"是没反应的 ——
 * 这个落点说的是"关掉我所在的那层面板"这件事本身。
 *
 * 它**只是一个可选的目标**，不是任何部件的默认（作者：「改回默认无操作」）：在「行为」一节里给哪颗按钮
 * 选上它，那颗按钮才关面板。检查器那颗按钮的候选里有它（见 components/Inspector.tsx 的 FrameSelect）。
 */
export const CLOSE_PANEL_TARGET = "close";

/** a swipe on a frame: the finger's direction */
export type SwipeDir = "left" | "right" | "up" | "down";
export const SWIPE_DIRS: { key: SwipeDir; icon: string; transition: Transition }[] = [
  { key: "left", icon: "swipe_left", transition: "slide" },
  { key: "right", icon: "swipe_right", transition: "slideLeft" },
  { key: "up", icon: "swipe_up", transition: "slideUp" },
  { key: "down", icon: "swipe_down", transition: "slideDown" },
];

/** how a sliding transition moves: the axis, where the new screen enters from and
 *  where the old one parks, as fractions of the screen */
export const SLIDE_SPEC: Partial<Record<Transition, { axis: "x" | "y"; enter: number; exit: number }>> = {
  slide: { axis: "x", enter: 1, exit: -0.3 },
  slideLeft: { axis: "x", enter: -1, exit: 0.3 },
  slideUp: { axis: "y", enter: 1, exit: -0.3 },
  slideDown: { axis: "y", enter: -1, exit: 0.3 },
};

/** `expand` is retired: documents written while it was offered are read back as "none" (see
 *  `retiredTransition`), so no picker shows it and no new rule can ask for it. */
export type Transition = "slide" | "slideLeft" | "slideUp" | "slideDown" | "fade" | "expand" | "none";

/** How far from its own place an overlay's page starts when it comes in: the offset is measured from
 *  the screen's edge, not from the page's own box. A screen is the whole stage, so a share of it is a
 *  share of the screen; a dialog is a small box of its own, and the same share of that would only
 *  nudge it — a page set to slide up from the bottom would move barely at all while the dim behind it
 *  appeared, which reads as the dialog standing still and the background moving. */
export function layerEntryOffset(t: Transition, w: number, h: number, stageW: number, stageH: number): { x: number; y: number } {
  const spec = SLIDE_SPEC[t];
  if (!spec) return { x: 0, y: 0 };
  const far = (spec.axis === "y" ? stageH + h : stageW + w) / 2;
  const sign = spec.enter > 0 ? 1 : -1;
  return spec.axis === "y" ? { x: 0, y: sign * far } : { x: sign * far, y: 0 };
}
/** What a retired transition comes back as. A dialog is the one case that keeps a movement: taught
 *  to zoom — the dialog cards' own old default — it would otherwise open with no entrance at all, a
 *  tap that moves nothing while the screen behind it does. A page reads back as no animation, which
 *  is the quiet default the picker now starts from. */
export const retiredTransition = (t: Transition, dialog = false): Transition =>
  t === "expand" ? (dialog ? "slideUp" : "none") : t;
export type Action = {
  to: string;
  transition: Transition;
  /** the target is a dialog of its own: the button pops it over this screen */
  dialog?: boolean;
};

export const TRANSITIONS: { key: Transition; label: string; icon: string }[] = [
  { key: "slide", label: "Slide from right", icon: "arrow_back" },
  { key: "slideLeft", label: "Slide from left", icon: "arrow_forward" },
  { key: "slideUp", label: "Slide from bottom", icon: "arrow_upward" },
  { key: "slideDown", label: "Slide from top", icon: "arrow_downward" },
  { key: "fade", label: "Fade", icon: "blur_on" },
  { key: "none", label: "None", icon: "block" },
];

/**
 * 把整条栏/标签行的入场方式铺到它每个目的地上
 *
 * 底栏上写下的动作里带着一个入场方式，可**点下去的其实是某一格**，走的是那一格
 * 自己的动作 —— 作者在"点击后跳转"里把栏上的入场方式改成"从底层滑入"，
 * 点那一格却毫无变化，就是这个原因。
 *
 * 因此栏上的那条是**模板**：换入场方式时，把每一格跟着改掉。这样作者的所见即所得，
 * 也不必改数据结构（老文档里每一格都是显式写下的值，继续照用）。
 */
export function applySlotTransition(it: Item, transition: Transition): Partial<Item> {
  const keys = actionSlotsOf(it).map((s) => s.key);
  if (keys.length === 0) return { action: it.action ? { ...it.action, transition } : undefined };
  const actions = { ...(it.actions ?? {}) };
  for (const key of keys) {
    const a = actions[key];
    if (a) actions[key] = { ...a, transition };
  }
  return {
    ...(it.action ? { action: { ...it.action, transition } } : {}),
    ...(Object.keys(actions).length ? { actions } : {}),
  };
}

/** slots on a bar that can each carry their own tap action */
export function actionSlotsOf(it: Item): IconSlot[] {
  if (it.kind === "topAppBar" || it.kind === "bottomNav" || it.kind === "navRail" || it.kind === "toolbar") return iconSlotsOf(it).filter((s) => !!s.value);
  /* 确认框里那颗「取消」按钮是一个落点：它自己那台机器、它自己那个动作，落在 `slotFlows.cancel` /
     `actions.cancel`（见 CONFIRM_BOX_CANCEL_SLOT 与 Preview 的 pickSlot）。**主按钮不在这里** —— 它那
     一下就是这一部件自己的（`flow` / `action`），面板把空键那一条摆在槽位前面，于是「目标按钮」里两颗
     都能选（见 Inspector 的 StateRules 与 docs/reference-prototypes/confirm-box.md）。 */
  if (it.kind === "confirmBox") return [{ key: CONFIRM_BOX_CANCEL_SLOT, label: confirmBoxButtonWords(it, CONFIRM_BOX_CANCEL_SLOT) || t("cancel"), value: null }];
  if (isTabRow(it)) return (it.tabs ?? []).map((t, i) => ({ key: `tab:${i}`, label: t.label || `${i + 1}`, value: null }));
  return [];
}

/** the icon a toggle button shows when on: an explicit null means none */
export const toggleIcon = (it: Item): string | null => (it.toggle && it.toggle.icon !== undefined ? it.toggle.icon : it.icon);

/** a free group down to one part is just that part again */
export function collapseFree(g: Group, widths: Record<string, number>): Group {
  if (!g.free || g.items.length !== 1) return g;
  const pl = layoutOf(g, widths)[0];
  return { id: g.id, x: pl.x, y: pl.y, axis: connectSpecOf(g.items[0])?.axis ?? "x", items: g.items };
}

/**
 * Where one tap's action is kept. A destination of a bar is a button of its own, so a dialog bound to
 * the "warehouse" destination belongs to that destination — binding it to the bar instead would leave
 * the destination doing nothing and the whole bar opening the dialog. A plain part keeps its own.
 */
export const actionPatchFor = (it: Item, target: string | null, action: Action): Partial<Item> =>
  target ? { actions: { ...(it.actions ?? {}), [target]: action } } : { action };

/** every navigation an item carries: its own action plus per-slot ones */
export function actionsOf(it: Item): { slot: string; action: Action }[] {
  const out: { slot: string; action: Action }[] = [];
  if (it.action) out.push({ slot: "", action: it.action });
  for (const [slot, action] of Object.entries(it.actions ?? {})) if (action) out.push({ slot, action });
  return out;
}

/** kinds a user can tap in the preview */
export const TAPPABLE: Kind[] = ["button", "iconButton", "fab", "extendedFab", "fnButton", "chip", "listItem", "itemCell", "assetPill", "taskBar", "confirmBox", "card", "image", "text", "splitButton", "radio", "wheel", "gridWheel", "gacha", "slot", "calendar", "rewardTrack"];

/** Where each day of a check-in calendar sits: seven to a row, the way a month is printed. */
export function calendarCell(day: number): { row: number; col: number } {
  const i = Math.max(0, day - 1);
  return { row: Math.floor(i / CALENDAR_COLS), col: i % CALENDAR_COLS };
}
/** How many rows a calendar of that many days takes. */
export const calendarRows = (days: number = CALENDAR_DAYS) => Math.ceil(Math.max(1, days) / CALENDAR_COLS);

/* ---------- the wheels, and the pad beside them ---------- */

/** One prize of a wheel: the words it shows, an icon if it has one, and how likely it is. Chances are
 *  written as weights rather than percentages: the wheel works out a share of the whole, so an author
 *  adding a prize never has to go back and re-add the others to a hundred. */
export type Prize = { label: string; icon?: string | null; weight?: number };

/* ---------- a reward track ---------- */

/** One thing a progress track hands out: where on the track it waits (`at`, in the part's own
 *  range), the icon on its tile, and the words under it — the count of what is given, usually. */
export type Reward = { at: number; icon?: string | null; label: string };

/** The rewards an author has not written any of: four steps along the default track. */
export function defaultRewards(): Reward[] {
  const icons = ["redeem", "savings", "inventory_2", "workspace_premium"];
  return REWARD_DEFAULT_ATS.map((at, i) => ({ at, icon: icons[i % icons.length], label: REWARD_TEXT[getLang()][i] ?? "" }));
}

/** A track's rewards: the author's own, or the four that come with a fresh one. */
export const rewardsOf = (it: { rewards?: Reward[] }): Reward[] => (it.rewards && it.rewards.length ? it.rewards : defaultRewards());

/** Where a reward's count sits on the track: the author's number, kept inside the range the bar
 *  actually runs to, so a reward typed past the end still shows on it rather than off it. */
export const rewardAt = (r: Reward, max: number): number => Math.max(0, Math.min(max, Math.round(r.at)));

/** Whether the visitor has come far enough for a reward: at the number itself it is ready, which is
 *  what the mock everyone draws shows — the reward sitting on the mark is the one just unlocked. */
export const rewardReady = (value: number, at: number): boolean => value >= at;

/** Where a reward's claim is remembered at runtime: one key per reward, so a claimed one stays
 *  claimed while the visitor moves on and comes back. */
export const rewardClaimKey = (id: string, i: number) => `${id}:claim:${i}`;

/** One reward as it is drawn: its place along the track in pixels, and whether it is in reach. */
export type RewardMark = { i: number; reward: Reward; at: number; pct: number; x: number; y: number; size: number; ready: boolean };

/** How a track lays its own rewards out: tiles along the top, each over the mark it belongs to, and
 *  the bar along the bottom. Tiles are pushed apart rather than drawn one over the other, keeping the
 *  order the author gave them, so two rewards close together still read as two. */
export function rewardMarks(it: Item, widths: Record<string, number>): { w: number; h: number; tile: number; barY: number; barH: number; numH: number; value: number; max: number; marks: RewardMark[] } {
  const { w, h } = sizeOf(it, widths);
  const max = maxOf(it);
  const value = clampValue(it.value ?? 0, max);
  const tile = Math.max(24, Math.min(REWARD_TILE, Math.round(h * 0.52)));
  const numH = Math.max(12, Math.min(REWARD_NUM_H, Math.round(h * 0.18)));
  const barH = Math.max(8, Math.min(REWARD_NUM_H, Math.round(h * 0.18)));
  const barY = Math.max(tile, h - numH - barH);
  const rewards = rewardsOf(it);
  /* left to right, a tile never sits closer to the last one than a tile and the gap: the author's
     order is what a track reads by, and a later reward belongs further along */
  const marks: RewardMark[] = rewards.map((reward, i) => {
    const at = rewardAt(reward, max);
    const pct = max > 0 ? at / max : 0;
    return { i, reward, at, pct, x: Math.round(pct * w - tile / 2), y: 0, size: tile, ready: rewardReady(value, at) };
  });
  let cursor = 0;
  for (const m of marks) {
    m.x = Math.max(m.x, cursor);
    cursor = m.x + tile + REWARD_TILE_GAP;
  }
  /* and back from the end, so the last reward on the track stays on the track */
  let back = w - tile;
  for (let i = marks.length - 1; i >= 0; i--) {
    marks[i].x = Math.min(Math.max(marks[i].x, 0), Math.max(0, back));
    back = marks[i].x - tile - REWARD_TILE_GAP;
  }
  return { w, h, tile, barY, barH, numH, value, max, marks };
}

/** What the second button of a capsule machine says — "ten at once" unless the author writes
 *  something else. */
export const MANY_DEF = 10;
export const MANY_MIN = 2;
export const MANY_MAX = 50;
export const manyOf = (it: { many?: number }) => Math.max(MANY_MIN, Math.min(MANY_MAX, Math.round(it.many ?? MANY_DEF)));
export const secondLabel = (it: { kind: Kind; label2?: string; many?: number }) =>
  (it.label2?.trim() || KIND_TEXT[getLang()][it.kind]?.label2 || "").replace("{n}", String(manyOf(it)));

/** Which prize three reels have won: three of a kind beats two, and a row with no pair has won
 *  nothing. `reels` are indexes into the pool; the answer is an index, or -1 for no win. */
export function slotWin(reels: number[]): number {
  const [a, b, c] = reels;
  if (a === undefined) return -1;
  if (a === b && b === c) return a;
  if (a === b) return a;
  if (b === c) return b;
  if (a === c) return a;
  return -1;
}

/** What a prize that says nothing shows: the pool's own "thanks for playing" entry, so a cell left
 *  blank on a square wheel — or a prize whose words the author cleared — reads as what it is. */
export const blankPrizeLabel = () => PRIZE_TEXT[getLang()][1] ?? "";
export const prizeLabel = (pr: Prize | undefined) => (pr?.label?.trim() ? pr.label : blankPrizeLabel());

/** The weight a prize is read at: its own, or one — an even chance among the prizes that say nothing.
 *  A weight of zero is a prize that can never come up, which is what taking one out of the draw
 *  without taking it off the wheel means. */
export const prizeWeight = (pr: Prize) => Math.max(0, pr.weight ?? 1);

/** Each prize's share of the whole, as a percentage that adds up to a hundred: the last one takes the
 *  rounding the others left over, so the list always reads as a whole. */
export function prizeChances(prizes: Prize[]): number[] {
  const total = prizes.reduce((sum, pr) => sum + prizeWeight(pr), 0);
  if (prizes.length === 0) return [];
  if (total <= 0) return prizes.map(() => Math.round(100 / prizes.length));
  const out: number[] = [];
  let used = 0;
  prizes.forEach((pr, i) => {
    if (i === prizes.length - 1) {
      out.push(Math.max(0, 100 - used));
      return;
    }
    const pct = Math.round((prizeWeight(pr) / total) * 100);
    used += pct;
    out.push(pct);
  });
  return out;
}

/** Which prize a roll of the wheel lands on. `roll` is a number in [0, 1) — the draw itself is the
 *  caller's, so a wheel can be tested without one. An empty pool has no prize to land on. */
export function pickPrize(prizes: Prize[], roll: number): number {
  const total = prizes.reduce((sum, pr) => sum + prizeWeight(pr), 0);
  if (prizes.length === 0 || total <= 0) return 0;
  let at = Math.max(0, Math.min(0.999999, roll)) * total;
  for (let i = 0; i < prizes.length; i++) {
    at -= prizeWeight(prizes[i]);
    if (at < 0) return i;
  }
  return prizes.length - 1;
}

/** Where a prize's wedge sits on a round wheel: angles in degrees, measured from the top and running
 *  clockwise, which is the way a wheel is drawn and the way the pointer reads it. */
export function wheelSlice(index: number, count: number): { start: number; sweep: number } {
  const n = Math.max(1, count);
  const sweep = 360 / n;
  return { start: index * sweep, sweep };
}

/** The rotation a wheel ends at so the pointer — which sits at the top — reads the winning wedge.
 *  `turns` whole turns are added first, which is what makes a spin look like a spin. */
export function wheelStopAngle(index: number, count: number, turns = 5): number {
  const { start, sweep } = wheelSlice(index, count);
  /* the wheel turns clockwise; the pointer reads the wedge that comes round to the top */
  return turns * 360 - (start + sweep / 2);
}

/** Which wedge the pointer reads at a given rotation: what the wheel shows while it turns. */
export function wheelIndexAt(angle: number, count: number): number {
  const n = Math.max(1, count);
  const sweep = 360 / n;
  const at = ((-angle % 360) + 360) % 360;
  return Math.min(n - 1, Math.floor(at / sweep));
}

/** The grid a square wheel is drawn on: the smallest one whose edge cells can hold every prize. The
 *  prizes run around that edge in the order they are written, and the middle is the button. */
export function gridRing(count: number): { rows: number; cols: number } {
  const n = Math.max(1, count);
  /* The smallest grid whose edge holds every prize and whose middle still has a cell for the button.
     It need not be square: nine prizes want three rows of four — ten cells round the edge — rather
     than the sixteen of a five-by-five. Ties go to the squarer grid. */
  let best: { rows: number; cols: number } | null = null;
  let bestWaste = Infinity;
  let bestGap = Infinity;
  for (let rows = 3; rows <= n + 3; rows++) {
    for (let cols = 3; cols <= n + 3; cols++) {
      const edge = 2 * (rows + cols) - 4;
      if (edge < n) continue;
      /* the grid that wastes the fewest cells wins; a tie goes to the squarer one, so sixteen prizes
         fill a five-by-five rather than a long three-by-seven */
      const waste = edge - n;
      const gap = Math.abs(rows - cols);
      if (!best || waste < bestWaste || (waste === bestWaste && gap < bestGap)) {
        best = { rows, cols };
        bestWaste = waste;
        bestGap = gap;
      }
    }
  }
  return best ?? { rows: 3, cols: Math.max(3, n) };
}

/** Every cell round the edge of that grid, in the order the highlight follows: clockwise from the
 *  top left corner. The cells the pool does not reach are drawn as the pool's blank prize, so a
 *  three-prize square wheel is a full ring rather than three cards and a gap. */
export function gridEdgeCells(count: number): { row: number; col: number }[] {
  const { rows, cols } = gridRing(count);
  const edge: { row: number; col: number }[] = [];
  for (let col = 0; col < cols; col++) edge.push({ row: 0, col });
  for (let row = 1; row < rows; row++) edge.push({ row, col: cols - 1 });
  if (rows > 1) for (let col = cols - 2; col >= 0; col--) edge.push({ row: rows - 1, col });
  if (cols > 1) for (let row = rows - 2; row >= 1; row--) edge.push({ row, col: 0 });
  return edge;
}

/** Where each prize sits on that edge, in the order they are written. The prizes are spread evenly,
 *  so a pool that does not fill every cell is laid out symmetrically instead of leaving one side
 *  crowded. */
export function gridRingCells(count: number): { row: number; col: number }[] {
  const edge = gridEdgeCells(count);
  const n = Math.max(1, count);
  const picked: { row: number; col: number }[] = [];
  for (let i = 0; i < n; i++) picked.push(edge[Math.round((i * edge.length) / n) % edge.length]);
  return picked;
}

/** How far the knob of a direction wheel travels from the middle, in the pad's own units. */
export const joystickTravel = (size: number) => Math.max(8, Math.round(size * JOYSTICK_TRAVEL));

/** The knob's place in the pad, in the pad's own units, from the angle its value stands for: 0° is
 *  straight up and the angle runs clockwise, the way the arrows on the pad read. */
export function joystickKnob(angle: number, size: number, out = true): { dx: number; dy: number } {
  if (!out) return { dx: 0, dy: 0 };
  const r = joystickTravel(size);
  const rad = ((angle - 90) * Math.PI) / 180;
  return { dx: Math.round(Math.cos(rad) * r), dy: Math.round(Math.sin(rad) * r) };
}

/** The angle a finger at (dx, dy) from the middle points at: 0° straight up, clockwise. */
export function joystickAngle(dx: number, dy: number): number {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return Math.round(((deg % 360) + 360) % 360);
}

/** palette roles a user may pick as a background */
export type ColorToken =
  | "surface"
  | "surfaceContainerLow"
  | "surfaceContainer"
  | "surfaceContainerHigh"
  | "surfaceContainerHighest"
  | "primaryContainer"
  | "secondaryContainer"
  | "tertiaryContainer"
  | "primary"
  | "inverseSurface";

/** The background that paints nothing: what is behind the part shows through, which is what a
 *  container drawn over a picture, or a button left bare on the page, is for. */
export const TRANSPARENT = "transparent";
/** What a background field holds: a palette role, nothing at all, or a `#rrggbb` colour of the
 *  author's own — the same rule `Item.color` and `Item.strokeColor` are read by, and what the free
 *  colour disc (see CustomColorDisc) writes. */
export type FillToken = ColorToken | typeof TRANSPARENT | `#${string}`;

export const COLOR_TOKENS: { key: ColorToken; label: string }[] = [
  { key: "surface", label: "Surface" },
  { key: "surfaceContainerLow", label: "Container low" },
  { key: "surfaceContainer", label: "Container" },
  { key: "surfaceContainerHigh", label: "Container high" },
  { key: "surfaceContainerHighest", label: "Container highest" },
  { key: "primaryContainer", label: "Primary container" },
  { key: "secondaryContainer", label: "Secondary container" },
  { key: "tertiaryContainer", label: "Tertiary container" },
  { key: "primary", label: "Primary" },
  { key: "inverseSurface", label: "Inverse surface" },
];

/** The colour a background paints: a palette role, a colour of the author's own, or nothing. */
export const fillColor = (t: FillToken | undefined, p: Palette, fallback: ColorToken): string =>
  t === TRANSPARENT ? "transparent" : t !== undefined && isHex(t) ? t : p[(t as ColorToken | undefined) ?? fallback];

/** The ink that reads on it: the readable ink of the author's own colour, and over no background at
 *  all the page's own text colour. */
export const fillInk = (t: FillToken | undefined, p: Palette, fallback: ColorToken): string =>
  t === TRANSPARENT ? p.onSurface : t !== undefined && isHex(t) ? onColorFor(t) : onToken((t as ColorToken | undefined) ?? fallback, p);

/** readable foreground for a chosen background token */
/** the background a card draws when no token is set: it follows the variant */
export const cardDefaultFillOf = (variant: Variant): ColorToken =>
  variant === "outlined" ? "surface" : variant === "elevated" ? "surfaceContainerLow" : "surfaceContainerHighest";
export const cardFillOf = (it: Item): FillToken => it.fill ?? cardDefaultFillOf(it.variant);

/** where a card's image area sits; sketches saved before placement existed stay on top */
export type CardImagePos = "top" | "leading" | "trailing" | "background";
export const isCardImagePos = (v: unknown): v is CardImagePos => v === "top" || v === "leading" || v === "trailing" || v === "background";
export const cardImagePosOf = (it: Item): CardImagePos => it.imagePos ?? "top";

/** the five card layouts the editor offers: the placements plus "no image", as one choice */
export type CardLayout = CardImagePos | "none";
export const cardLayoutOf = (it: Item): CardLayout => (it.noImage ? "none" : cardImagePosOf(it));
/** the fields a layout choice sets; the top layout is the unset default so old sketches stay untouched */
export const cardLayoutPatch = (layout: CardLayout): Pick<Item, "noImage" | "imagePos"> =>
  layout === "none" ? { noImage: true, imagePos: undefined } : { noImage: undefined, imagePos: layout === "top" ? undefined : layout };

export type CardAlign = "start" | "center" | "end";
export const isCardAlign = (v: unknown): v is CardAlign => v === "start" || v === "center" || v === "end";
/** the text block's vertical position: the top, or the bottom when it lies over a background image */
export const cardContentAlignOf = (it: Item): CardAlign => it.contentAlign ?? (!it.noImage && cardImagePosOf(it) === "background" ? "end" : "start");

/** the color roles a card's text may be set to; "on" roles pair with the containers offered as backgrounds */
export type TextToken = "primary" | "secondary" | "onSurface" | "onSurfaceVariant" | "onPrimaryContainer" | "onSecondaryContainer" | "onTertiaryContainer" | "inverseOnSurface";
/** 文字颜色和别的颜色字段一样：给一个角色，或给作者自己的 #rrggbb */
export type TextColor = TextToken | `#${string}`;
export const TEXT_TOKENS: { key: TextToken; label: string }[] = [
  { key: "onSurface", label: "On surface" },
  { key: "onSurfaceVariant", label: "On surface variant" },
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "onPrimaryContainer", label: "On primary container" },
  { key: "onSecondaryContainer", label: "On secondary container" },
  { key: "onTertiaryContainer", label: "On tertiary container" },
  { key: "inverseOnSurface", label: "Inverse on surface" },
];
export const isTextToken = (v: unknown): v is TextToken => TEXT_TOKENS.some((t) => t.key === v);
/** a text colour this build can draw: one of the roles, or a literal the author picked */
export const isTextColor = (v: unknown): v is TextColor => isTextToken(v) || (typeof v === "string" && isHex(v));
/**
 * The colour a "role, or a colour of the author's own" field draws with: a `#rrggbb` as it is, a role
 * from the palette otherwise — the same rule `color`, `fill` and `strokeColor` already follow.
 */
export const roleColor = (v: string, p: Palette): string => (isHex(v) ? v : ((p as Record<string, string>)[v] ?? p.onSurface));

/** the card's text color: the chosen role or colour, else white over a photo, the container's
 *  "on" color over a placeholder background or a chosen fill, and onSurface otherwise */
export function cardTextColorOf(it: Item, p: Palette): string {
  const own = colorOverrideOf(it, p);
  if (own) return own.on;
  if (it.textColor) return roleColor(it.textColor, p);
  if (!it.noImage && cardImagePosOf(it) === "background") return it.src ? "#ffffff" : p.onPrimaryContainer;
  return fillInk(it.fill, p, "surfaceContainerHighest");
}
/** the body's color: a plain card keeps M3's onSurfaceVariant at full opacity; anything
 *  colored, filled or over an image reuses the headline color at reduced opacity */
export function cardBodyColorOf(it: Item, p: Palette): { color: string; opacity: number } {
  const plain = !it.color && !it.textColor && !it.fill && (it.noImage || cardImagePosOf(it) !== "background");
  return plain ? { color: p.onSurfaceVariant, opacity: 1 } : { color: cardTextColorOf(it, p), opacity: 0.8 };
}
/** the scrim under text on a photo: it fades in from the text's side, dark under light
 *  text and light under dark text, so the words stay readable either way */
export function cardScrimOf(ink: string, align: CardAlign): string {
  const c = isLightColor(ink) ? "0,0,0" : "255,255,255";
  const a = isLightColor(ink) ? 0.65 : 0.72;
  if (align === "start") return `linear-gradient(rgba(${c},${a}), rgba(${c},0) 60%)`;
  if (align === "center") return `rgba(${c},${a * 0.65})`;
  return `linear-gradient(rgba(${c},0) 40%, rgba(${c},${a}))`;
}

/* Card spacing is fixed: content sits 20dp from the edge, the headline and body are
 * 4dp apart, and the image area keeps 12dp from the text. */
export const CARD_PADDING = 20;
export const CARD_TEXT_GAP = 4;
export const CARD_MEDIA_GAP = 12;

/** default width of a card's side image column (an M3 horizontal-card thumbnail) */
export const CARD_SIDE_IMAGE_W = 80;
/** the least room an image must leave the text: one headline and one body line tall, or a readable column wide */
const CARD_MIN_TEXT_H = 48;
const CARD_MIN_TEXT_W = 96;
/** the smallest image area the editor offers */
export const CARD_IMAGE_MIN = 40;
/** the largest the image area can be inside this card without pushing its text out:
 *  a top band is bounded by the drawn height, a side column by the drawn width */
export function cardImageMaxOf(it: Item): number {
  const { w, h } = sizeOf(it, {});
  const room = cardImagePosOf(it) === "top" ? h - CARD_MIN_TEXT_H : w - CARD_MIN_TEXT_W;
  return Math.max(CARD_IMAGE_MIN, room - CARD_PADDING * 2 - CARD_MEDIA_GAP);
}
/** the image area's extent in dp: the author's value, else 28% of the card's width
 *  on top or the standard column on a side, never beyond cardImageMaxOf */
export function cardImageSizeOf(it: Item): number {
  const top = cardImagePosOf(it) === "top";
  const size = it.imageSize ?? (top ? Math.round((it.size ?? KIND_SPEC.card.defSize ?? KIND_SPEC.card.w) * 0.28) : CARD_SIDE_IMAGE_W);
  return Math.min(size, cardImageMaxOf(it));
}

export function onToken(t: ColorToken, p: Palette): string {
  switch (t) {
    case "primary":
      return p.onPrimary;
    case "primaryContainer":
      return p.onPrimaryContainer;
    case "secondaryContainer":
      return p.onSecondaryContainer;
    case "tertiaryContainer":
      return p.onTertiaryContainer;
    case "inverseSurface":
      return p.inverseOnSurface;
    default:
      return p.onSurface;
  }
}

/* ---------- a part's own colour and layer ---------- */

/** every part starts at this level; a higher one draws over the parts beside it */
export const LAYER_DEFAULT = 10;
/** the level a part draws at: its own, else the default */
export const layerOf = (it: Item) => it.z ?? LAYER_DEFAULT;

/** whether a part carries a colour this build can resolve: a palette role or a hex literal */
export const isCustomColor = (v: unknown): v is string =>
  typeof v === "string" && (v === TRANSPARENT || isHex(v) || COLOR_TOKENS.some(({ key }) => key === v));

/** the surface and ink a part's own colour makes, or null when it keeps the kind's role */
export function colorOverrideOf(it: Item, p: Palette): { main: string; on: string } | null {
  if (!isCustomColor(it.color)) return null;
  /* a part with no background of its own reads in the page's own ink */
  if (it.color === TRANSPARENT) return { main: "transparent", on: p.onSurface };
  return isHex(it.color)
    ? { main: it.color, on: onColorFor(it.color) }
    : { main: p[it.color as ColorToken], on: onToken(it.color as ColorToken, p) };
}

/** The scheme a part draws from, with its own colour standing in for the primary role:
 *  every accent the kind uses (fills, tracks, selected icons) follows it, and a plain
 *  text part inks itself with it. */
export function paletteForItem(it: Item, p: Palette): Palette {
  const own = colorOverrideOf(it, p);
  if (!own) return p;
  return {
    ...p,
    primary: own.main,
    onPrimary: own.on,
    primaryContainer: own.main,
    onPrimaryContainer: own.on,
    ...(it.kind === "text" ? { onSurface: own.main } : undefined),
  };
}

/* ---------- containers and their children ---------- */

/** What a part has become once its own machine has moved it: the look it is in, its flags, and the
 *  wait left on the step that will take it out of it. */
export type PartState = {
  /** the part as its rules leave it: a label or a look may have changed */
  item: Item;
  hidden: boolean;
  /** the part stands a size up, as a rule asked it to */
  grown: boolean;
  /** greyed out and no longer answering taps */
  disabled: boolean;
  /** whole seconds still to wait, 0 when nothing is cooling down */
  cooldown: number;
};

export function resolveStates(it: Item, at: MachineAt, now: number): PartState {
  const entry = at[it.id];
  const look = lookOf(it.flow, entry?.look);
  const elapsed = entry ? Math.max(0, (now - entry.since) / 1000) : 0;
  /* the wait is a property of the look, not of one step's guard: a greyed node that comes back
     counts down whether or not the step out of it is also conditional */
  const left = look ? waitLeft(it.flow, look.id, elapsed) : 0;
  return {
    item: lookItem(it, look),
    hidden: !!look?.hidden,
    grown: !!look?.grow,
    disabled: !!look?.disabled,
    cooldown: look?.disabled && left > 0 ? Math.ceil(left) : 0,
  };
}

/**
 * 一个槽位那台机器「点击后变化 → 改变属性」落下的那份外观补丁算在**谁**头上
 *
 * 栏、标签页、工具栏的每一格是一个**落点**：它的 hidden/disabled 说的是那一格（见 Preview 的
 * tabLook），所以那一格自己的步骤里那份"改变属性"不该盖到整条栏上 —— 它没有归属（`null`），什么也不落
 * （预览里那份补丁的落点是 `a.target ?? owner`，见 Preview 的 runRuleAction）。
 *
 * 融合部件（任务信息条、确认框）不一样：画在自己里面的那几颗按钮**不是画布上独立的部件**，它们的"自己"
 * 就是这一块 —— 作者给「取消」配「隐藏」时，说的是把这一块收起来（作者：「取消按钮就是个普通按钮就
 * 行」，见 docs/reference-prototypes/confirm-box.md）。所以归属是这一部件自己，和主按钮那一下同一处
 * （Preview 的 fireTap 传的也是它自己）。
 */
export const slotLookOwner = (it: Pick<Item, "id" | "kind">): string | null => (tapLivesInside(it.kind) ? it.id : null);

/**
 * 融合部件里那几颗按钮各自的状态机解出来的状态
 *
 * 一个槽位（栏的某一格，或者一个融合部件里那几颗按钮）的机位是 `<部件id>:<槽位>`（见 Preview 的
 * pickSlot 与 tabLook）。对融合部件来说那几颗按钮**不是画布上独立的部件** —— 它们的"自己"就是这一块，
 * 所以作者在「点击后变化」里给它配「隐藏」时，说的是把这一块收起来。
 *
 * 今天只有确认框带槽位（它那颗「取消」按钮，见 CONFIRM_BOX_CANCEL_SLOT）；任务信息条的领取按钮是主
 * 按钮，走的是这一部件自己的机位。这两个助手是当初为融合部件留下的（见
 * docs/reference-prototypes/confirm-box.md 里那两条坑）。
 */
export const resolveSlotStates = (it: Item, at: MachineAt, now: number): PartState[] =>
  Object.entries(it.slotFlows ?? {}).map(([slot, flow]) => resolveStates({ ...it, id: `${it.id}:${slot}`, flow }, at, now));

/**
 * 把槽位那几台机器的状态并进部件自己的状态
 *
 * **只对融合部件用**（见 Preview 的 Tappable）：它们的槽位是画在自己里面的按钮，那几台机器做的事
 * （隐藏 / 置灰 / 冷却）落在这一块上 —— 作者配「取消 → 隐藏面板」正是这个意思，不并进来就会出现
 * "机器跑了但屏幕上什么都没变"。栏的每一格不在此列：那是一个落点，它的 hidden/disabled 说的是那一格
 * （见 Preview 的 tabLook）。
 */
export const mergeSlotStates = (own: PartState, slots: PartState[]): PartState =>
  slots.length === 0
    ? own
    : {
        ...own,
        hidden: own.hidden || slots.some((st) => st.hidden),
        disabled: own.disabled || slots.some((st) => st.disabled),
        cooldown: Math.max(own.cooldown, ...slots.map((st) => st.cooldown)),
      };

/** whether a part answers a tap at all: a hidden part is gone, a disabled one ignores it */
export const tappable = (state: PartState) => !state.hidden && !state.disabled;

/** a part and everything it holds, parents before children */
export function subtreeOf(it: Item): Item[] {
  const out: Item[] = [it];
  for (const c of it.children ?? []) out.push(...subtreeOf(c));
  return out;
}

/** One part anywhere in a tree, containers searched depth first. Ownership questions — is this
 *  part held by that group, is that group locked over it — have to walk the tree: a part inside a
 *  container is not one of the group's own items, and a plain contains-check would miss it. */
export function findItemIn(items: Item[], id: string): Item | null {
  for (const it of items) {
    if (it.id === id) return it;
    const found = it.children ? findItemIn(it.children, id) : null;
    if (found) return found;
  }
  return null;
}

/** every part a document holds, containers' children included, in canvas order */
export function itemsOf(groups: Group[]): Item[] {
  const out: Item[] = [];
  for (const g of groups) for (const it of g.items) out.push(...subtreeOf(it));
  return out;
}

/** the container a part sits in, or null when it sits on the screen itself */
export function parentOf(groups: Group[], id: string): Item | null {
  const walk = (it: Item): Item | null => {
    for (const c of it.children ?? []) {
      if (c.id === id) return it;
      const found = walk(c);
      if (found) return found;
    }
    return null;
  };
  for (const g of groups) for (const it of g.items) {
    const found = walk(it);
    if (found) return found;
  }
  return null;
}

/** a part's own level, then its children's: the order a container stacks its contents in */
export const byLayer = (a: Item, b: Item) => layerOf(a) - layerOf(b);

/** The border a part draws inside itself, written as a shadow so no layout moves for it;
 *  a thickness of 0 (or nothing at all) leaves the part without a border. */
export function strokeOf(it: Item, p: Palette): string | null {
  const w = it.strokeWidth;
  if (typeof w !== "number" || w <= 0) return null;
  const colour = isCustomColor(it.strokeColor)
    ? isHex(it.strokeColor)
      ? it.strokeColor
      : p[it.strokeColor as ColorToken]
    : p.outline;
  return `inset 0 0 0 ${Math.round(w)}px ${colour}`;
}

/** Whether a container lets a child be seen. A child is drawn inside its container, so a
 *  child the author put BELOW the container is covered by it: the box hides it. */
export const childShown = (parent: Item, child: Item) => layerOf(child) >= layerOf(parent);

/**
 * Raises a part's whole subtree to sit at or above `floor`. A container moved into another one has
 * to carry its contents' layers along: only the container itself is given the level the drop asks
 * for, and a child that kept the default would end up below its own parent — which `childShown`
 * reads as "covered", so the contents of a nested container would simply not be drawn.
 */
export function liftAbove(it: PlacedItem, floor: number): PlacedItem {
  const node = layerOf(it) < floor ? { ...it, z: floor } : it;
  const kids = it.children;
  return kids ? { ...node, children: kids.map((c) => liftAbove(c, layerOf(node))) } : node;
}

/** the part does not move as it folds */
export const NO_FOLD = { dx: 0, dy: 0 };

/** How far a part moves as it folds: nothing at all unless it is a navigation part folded to its pill. */
export const foldPlace = (it: Item, widths: Record<string, number>) => (foldsToPill(it) ? foldShift(it, widths) : NO_FOLD);

/**
 * The same fold, as the margins that put a part there inside a run: a run lays its parts out itself,
 * so the place `layoutOf` computes for a folded navigation part has to be handed to it this way.
 */
export function foldMargins(it: Item, widths: Record<string, number>): { marginLeft?: number; marginTop?: number } {
  const f = foldPlace(it, widths);
  return f.dx || f.dy ? { marginLeft: f.dx || undefined, marginTop: f.dy || undefined } : {};
}

/** A copy of a part and everything it holds, with fresh ids from `next`. The mapping is
 *  written into `ids` so a caller can also remap the interactions that point at them. */
export function copySubtree(it: Item, next: () => string, ids: Map<string, string>): Item {
  const id = next();
  ids.set(it.id, id);
  return {
    ...it,
    id,
    ...(it.tabs ? { tabs: it.tabs.map((t) => ({ ...t })) } : undefined),
    ...(it.states ? { states: it.states.map((s) => ({ ...s, id: next() })) } : undefined),
    ...(it.children ? { children: it.children.map((c) => copySubtree(c, next, ids)) as PlacedItem[] } : undefined),
  };
}

export type Frame = {
  id: string;
  name: string;
  x: number;
  y: number;
  /** dimensions are optional so documents saved before desktop frames remain phone-sized */
  w?: number;
  h?: number;
  bg?: FillToken;
  /** what this screen is for, in the author's words; goes into the prompt */
  note?: string;
  /** what `note` said before the AI rewrote it */
  noteHistory?: string[];
  /** frame ids reached by swiping in each direction */
  swipe?: Partial<Record<SwipeDir, string>>;
  /** where Tidy puts the body rows between the bars: from the top unless the author says otherwise */
  place?: Place;
  /** A screen the visitor navigates to, or an overlay popped over one. Unset reads as a
   *  screen, so documents saved before overlays existed keep behaving the way they did. */
  role?: FrameRole;
  /** overlays only: the level whose rules it takes. Unset reads as "modal". */
  level?: OverlayLevel;
  /** overlay pages only: seconds until this page closes itself, counted from it opening — a bubble
   *  that dismisses itself the way a toast does. Unset means it waits for the visitor. */
  autoClose?: number;
};

/** how Tidy stacks the body of a screen: from the top, centered, against the bottom bar, or spread out */
export type Place = "top" | "center" | "bottom" | "spread";
export const PLACES: { key: Place; icon: string }[] = [
  { key: "top", icon: "vertical_align_top" },
  { key: "center", icon: "vertical_align_center" },
  { key: "bottom", icon: "vertical_align_bottom" },
  { key: "spread", icon: "expand" },
];
export const isPlace = (v: unknown): v is Place => v === "top" || v === "center" || v === "bottom" || v === "spread";

/** how a selection of parts is lined up: an edge or centre to share, or equal gaps along an axis */
export type AlignKind = "left" | "centerH" | "right" | "distributeH" | "top" | "centerV" | "bottom" | "distributeV";

export type FramePreset = "phone" | "landscape" | "desktop";
/** a phone held sideways: the portrait screen turned around */
export const LANDSCAPE_W = PHONE_H;
export const LANDSCAPE_H = PHONE_W;
export const frameSizeOf = (f: Frame) => ({ w: f.w ?? PHONE_W, h: f.h ?? PHONE_H });
export const isLandscapeFrame = (f: Frame) => {
  const { w, h } = frameSizeOf(f);
  return w === LANDSCAPE_W && h === LANDSCAPE_H;
};
/* a landscape screen is still a phone: rounded glass, a status bar, one-handed layout */
export const isPhoneFrame = (f: Frame) => {
  const { w, h } = frameSizeOf(f);
  return (w === PHONE_W && h === PHONE_H) || isLandscapeFrame(f);
};
export const framePresetOf = (f: Frame): FramePreset => (isLandscapeFrame(f) ? "landscape" : isPhoneFrame(f) ? "phone" : "desktop");
export const framePresetPatch = (preset: FramePreset): Pick<Frame, "w" | "h"> =>
  preset === "desktop" ? { w: DESKTOP_W, h: DESKTOP_H } : preset === "landscape" ? { w: LANDSCAPE_W, h: LANDSCAPE_H } : { w: undefined, h: undefined };
export const frameRect = (f: Frame) => {
  const { w, h } = frameSizeOf(f);
  return { l: f.x, t: f.y, r: f.x + w, b: f.y + h };
};
/** the corner radius of a screen: a phone's rounded glass, a flatter window for the desktop */
export const frameRadius = (f: Frame) => (isPhoneFrame(f) ? PHONE_R : DESKTOP_R);

/* ---------- overlays ---------- */

/** A page is either somewhere the visitor navigates to, or an overlay popped over one. */
export type FrameRole = "screen" | "overlay";

/**
 * How an overlay takes the screen over. A level is nothing but a bundle of runtime rules
 * — how dark the screen behind goes, whether it still takes taps, who owns the keyboard,
 * what the back key does — so the preview, the flow diagram and the spec document all read
 * one table instead of each deciding for itself.
 *
 * This is deliberately *not* the layer tree. Parts nest inside parts for layout; a level
 * says what the visitor can reach. A part three containers deep can still be a full-screen
 * overlay, which is why the level is always written down rather than read off the nesting.
 */
export type OverlayLevel = "popover" | "sheet" | "modal" | "fullscreen" | "system";

export type OverlayRule = {
  /** the dim laid over the screen behind; 0 draws none */
  scrim: number;
  /** the screen behind stops taking taps and stops being read out */
  inertBehind: boolean;
  /** a tap beside the layer closes it: what a scrimless popover does instead of blocking */
  dismissOnOutside: boolean;
  /** the keyboard moves into the layer and Tab stays inside it */
  focusTrap: boolean;
  /** Esc and the preview's back button close it; a system layer has to be dealt with */
  dismissOnBack: boolean;
  /** what opening it does to the layers already open */
  clears: "none" | "popovers" | "all";
  /**
   * The layer floats over the screen rather than taking it over, so only the parts drawn on its page
   * appear: the page is the dialog's *stage*, and its own background is not drawn. A level that
   * fills the screen (full screen, system) is the screen instead, and paints its background.
   */
  float: boolean;
};

export const OVERLAY_RULES: Record<OverlayLevel, OverlayRule> = {
  /* a bubble or a menu: it hangs off a part, the screen behind keeps working, and a tap
     anywhere else puts it away */
  popover: { scrim: 0, inertBehind: false, dismissOnOutside: true, focusTrap: false, dismissOnBack: true, clears: "none", float: true },
  /* a panel slid in from an edge: the screen behind waits behind a light dim */
  sheet: { scrim: 0.24, inertBehind: true, dismissOnOutside: false, focusTrap: true, dismissOnBack: true, clears: "popovers", float: true },
  /* the ordinary dialog: dimmed, blocking, and the back key closes it */
  modal: { scrim: 0.32, inertBehind: true, dismissOnOutside: false, focusTrap: true, dismissOnBack: true, clears: "popovers", float: true },
  /* an activity page or a battle result drawn over everything: it *is* the screen now, so
     nothing below it survives */
  fullscreen: { scrim: 0, inertBehind: true, dismissOnOutside: false, focusTrap: true, dismissOnBack: true, clears: "all", float: false },
  /* sign-in, payment, a dropped connection: it cannot be waved away, and opening one ends
     whatever the visitor was in the middle of */
  system: { scrim: 0, inertBehind: true, dismissOnOutside: false, focusTrap: true, dismissOnBack: false, clears: "all", float: false },
};

/** lightest first: the order the pickers list them in, and what a spec table reads down */
export const OVERLAY_LEVELS: OverlayLevel[] = ["popover", "sheet", "modal", "fullscreen", "system"];
/** the icon each level's picker button shows */
export const OVERLAY_LEVEL_ICONS: Record<OverlayLevel, string> = {
  popover: "chat_bubble",
  sheet: "view_sidebar",
  modal: "picture_in_picture_alt",
  fullscreen: "fullscreen",
  system: "priority_high",
};
/** the two things a page can be: somewhere to go, or something popped over it */
export const FRAME_ROLES: { key: FrameRole; icon: string }[] = [
  { key: "screen", icon: "crop_portrait" },
  { key: "overlay", icon: "picture_in_picture_alt" },
];
export const DEFAULT_OVERLAY_LEVEL: OverlayLevel = "modal";
export const isOverlayLevel = (v: unknown): v is OverlayLevel => OVERLAY_LEVELS.some((l) => l === v);
export const overlayRuleOf = (level: OverlayLevel) => OVERLAY_RULES[level];

/** the level this part's overlay takes, or null when it is an ordinary part */
export const overlayLevelOf = (it: Item): OverlayLevel | null => it.overlay ?? (it.modal ? DEFAULT_OVERLAY_LEVEL : null);
export const isOverlayItem = (it: Item) => overlayLevelOf(it) !== null;
export const isOverlayFrame = (f: Frame) => f.role === "overlay";
export const overlayLevelOfFrame = (f: Frame) => f.level ?? DEFAULT_OVERLAY_LEVEL;

/**
 * One overlay the preview has open, or one step of the stack it plays back. The stack is
 * the *time* order — what was opened last — which the layer tree cannot express: a tree
 * says what is drawn where, never what the back key should close.
 */
export type Layer = { frameId: string; level: OverlayLevel; t: Transition };

/**
 * Opens an overlay, applying the level's own rules to the layers already open. Re-opening
 * one that is already up brings it to the front instead of stacking a second copy, which is
 * what keeps a screen that re-opens its own bag from growing a tower of them.
 */
export function pushLayer(layers: Layer[], next: Layer): Layer[] {
  const { clears } = overlayRuleOf(next.level);
  const rest = layers.filter((l) => l.frameId !== next.frameId);
  const kept =
    clears === "none" ? rest : clears === "popovers" ? rest.filter((l) => l.level !== "popover") : rest.filter((l) => l.level === "system");
  return [...kept, next];
}

/**
 * What each screen has open, keyed by the screen that popped it. An overlay is a step in the trail
 * a visitor leaves behind, not a property of "the screen on show": stepping to another screen and
 * coming back finds the first one exactly as it was left — a dialog still open is still open, and
 * one the visitor put away stays away.
 */
export type LayerTrail = Record<string, Layer[]>;

/** the overlays one screen has open, oldest first */
export const layersIn = (trail: LayerTrail, screenId: string): Layer[] => trail[screenId] ?? [];

/** the trail with one screen's overlays replaced; an unchanged list keeps the trail itself */
export const withLayers = (trail: LayerTrail, screenId: string, next: Layer[]): LayerTrail =>
  layersIn(trail, screenId) === next ? trail : { ...trail, [screenId]: next };

/** a per-screen map, or the trail, without the screens a document no longer holds */
export function forgetScreens<T>(map: Record<string, T>, alive: Set<string>): Record<string, T> {
  const kept = Object.entries(map).filter(([id]) => alive.has(id));
  return kept.length === Object.keys(map).length ? map : Object.fromEntries(kept);
}

/**
 * Takes the top overlay off the stack. This is the *explicit* close — the scrim tap, or a part
 * whose rule says "close the overlay" — and it works at every level. A level that refuses the
 * back key is refusing a *gesture*, not its own contents: a system layer nobody can put away is
 * a dead end, so the way out of one is a Close of its own. `backTarget` is what asks the back key.
 */
export function popLayer(layers: Layer[]): Layer[] {
  if (layers.length === 0) return layers;
  return layers.slice(0, -1);
}

/**
 * The colour that marks a dialog page while it is being worked on: a warm tone of the author's
 * choosing, picked to stand apart from every surface a palette offers. Readable ink is derived from
 * it, the way a part with a colour of its own gets its own ink.
 */
export const DIALOG_COLOR = "#e9b69f";

/**
 * What marks a page as a dialog rather than as one more screen: the frame drawn around it on the
 * canvas, and its row in the layers panel. It is a mark, not a surface — the page's own background is
 * left exactly as a screen's, so what the author sees inside the frame is the design. One helper, so
 * the canvas and the panel can never disagree about which pages are dialogs.
 */
export const pageTintOf = (f: Frame, p: Palette): { bg: string; ink: string } | null =>
  isOverlayFrame(f) && overlayRuleOf(overlayLevelOfFrame(f)).float ? { bg: DIALOG_COLOR, ink: onColorFor(DIALOG_COLOR) } : null;

/** What the back key reaches: the top overlay, the screen stack, or nothing at all. */
export const backTarget = (layers: Layer[]): "layer" | "screen" | "blocked" => {
  const top = layers[layers.length - 1];
  if (!top) return "screen";
  return overlayRuleOf(top.level).dismissOnBack ? "layer" : "blocked";
};

/** parts that span the screen edge to edge and follow its width when it changes */
export const FULL_WIDTH: Kind[] = ["topAppBar", "bottomNav", "tabs", "sideTabs"];

/** Kinds drawn to the width of what they say until the author gives them one. Their own width has to
 *  beat the measurement the canvas took of them, in `sizeOf` and in the renderer alike. */
export const AUTHOR_WIDTHS: Kind[] = ["switch", "button", "badge", "chip", "checkbox", "radio", "extendedFab", "splitButton", "assetPill"];

/** The spec a part draws from. A part whose kind this build does not know — one from a
 *  document another build wrote, or one left in state while this list was being edited —
 *  falls back to the box, so no geometry call takes the editor down with it. */
const specOf = (it: Item): KindSpec => KIND_SPEC[it.kind] ?? KIND_SPEC.box;

/** a part no taller than the screen it is placed on: a box or a rail sized to a phone shrinks to a shorter screen */
export function fitHeight(it: Item, screenH: number): Item {
  const spec = specOf(it);
  if (!spec.size2 && it.kind !== "navRail") return it;
  const h = it.size2 ?? spec.h;
  return h > screenH ? regrid({ ...it, size2: screenH }) : it;
}

/** A part carried from one screen size to another: edge-to-edge parts take the new
 *  width, a part sized to the old content or screen width takes the new one, and a
 *  box as tall as the old screen takes the new height. A card or an image keeps its
 *  size, since its height follows its width. Nothing ends up wider than the new
 *  content area. */
export function carryItemSize(it: Item, from: { w: number; h: number }, to: { w: number; h: number }): Item {
  const spec = specOf(it);
  const patch: Partial<Item> = {};
  const keepsShape = it.kind === "card" || it.kind === "image" || it.kind === "camera" || it.kind === "map";
  if (spec.size && (spec.size.icon === "width" || keepsShape)) {
    /* only a size that is a width; a text size or an icon button's square are left alone */
    const cur = it.size ?? spec.defSize ?? spec.w;
    if (FULL_WIDTH.includes(it.kind)) {
      /* a bar the author narrowed on purpose stays narrow; one that spanned the screen still does */
      if (cur === from.w || cur > to.w) patch.size = to.w;
    } else if (keepsShape) {
      if (cur > contentWidth(to.w)) patch.size = contentWidth(to.w);
    } else if (cur === from.w) patch.size = to.w;
    else if (cur === contentWidth(from.w)) patch.size = contentWidth(to.w);
    else if (cur === halfWidth(from.w)) patch.size = halfWidth(to.w);
    else if (cur > to.w) patch.size = to.w;
    else if (cur > contentWidth(to.w) && it.kind !== "box" && it.kind !== "invGrid") patch.size = contentWidth(to.w);
  }
  if ((it.kind === "box" || it.kind === "invGrid" || it.kind === "navRail") && (it.size2 ?? spec.h) === from.h) patch.size2 = to.h;
  /* an image, camera or map the author gave a height keeps its aspect ratio when its width changes */
  if ((it.kind === "image" || it.kind === "camera" || it.kind === "map") && it.size2 !== undefined && patch.size !== undefined) {
    const cur = it.size ?? spec.defSize ?? spec.w;
    patch.size2 = Math.round((it.size2 * patch.size) / cur);
  }
  return Object.keys(patch).length ? regrid({ ...it, ...patch }) : it;
}

export type Placed = { item: Item; index: number; x: number; y: number; w: number; h: number };

/** where each part of a run sits in world space: a connected run lays its parts
 *  out along its axis, a free group keeps the offsets it was grouped with */
export function layoutOf(g: Group, widths: Record<string, number>): Placed[] {
  const out: Placed[] = [];
  let off = 0;
  g.items.forEach((it, index) => {
    const sz = sizeOf(it, widths);
    /* A folded navigation part is drawn at the corner its own button sits in (see foldShift), so the
       pill stays under the button instead of flying off to the other end. Everything that reads a
       part's place — the canvas, the export, hit-testing, alignment — comes through here. */
    const f = foldPlace(it, widths);
    if (g.free) {
      const o = g.pos?.[it.id] ?? { x: 0, y: 0 };
      out.push({ item: it, index, x: g.x + o.x + f.dx, y: g.y + o.y + f.dy, w: sz.w, h: sz.h });
      return;
    }
    out.push({ item: it, index, x: (g.axis === "x" ? g.x + off : g.x) + f.dx, y: (g.axis === "x" ? g.y : g.y + off) + f.dy, w: sz.w, h: sz.h });
    off += (g.axis === "x" ? sz.w : sz.h) + GAP;
  });
  return out;
}

/** world-space bounds of a whole run */
export function groupBounds(g: Group, widths: Record<string, number>) {
  let l = g.x;
  let t = g.y;
  let r = g.x;
  let b = g.y;
  for (const pl of layoutOf(g, widths)) {
    l = Math.min(l, pl.x);
    t = Math.min(t, pl.y);
    r = Math.max(r, pl.x + pl.w);
    b = Math.max(b, pl.y + pl.h);
  }
  return { l, t, r, b };
}

/** A free group written as the runs it holds: parts of one family that still sit
 *  one GAP apart along their axis stay a connected run, everything else is a run
 *  of one. Layout logic, the prompt and ungrouping all see the same runs, in the
 *  group's own order (later = drawn on top), which is what the layers panel edits. */
export function explodeGroup(g: Group, widths: Record<string, number>): Group[] {
  if (!g.free) return [g];
  const placed = [...layoutOf(g, widths)].sort((a, b) => a.y - b.y || a.x - b.x);
  const rank = new Map(g.items.map((it, i) => [it.id, i]));
  const used = new Set<string>();
  const out: Group[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) <= 3;
  for (const start of placed) {
    if (used.has(start.item.id)) continue;
    used.add(start.item.id);
    const run = [start];
    const axis = connectSpecOf(start.item)?.axis ?? "x";
    let last = start;
    for (;;) {
      const next = placed.find(
        (q) =>
          !used.has(q.item.id) &&
          canJoin(last.item, q.item) &&
          (axis === "x" ? near(q.y, last.y) && near(q.x, last.x + last.w + GAP) : near(q.x, last.x) && near(q.y, last.y + last.h + GAP)),
      );
      if (!next) break;
      used.add(next.item.id);
      run.push(next);
      last = next;
    }
    /* named after the member the group lists first, so the name survives a reorder */
    const anchor = run.reduce((a, b) => ((rank.get(a.item.id) ?? 0) <= (rank.get(b.item.id) ?? 0) ? a : b));
    out.push({ id: `${g.id}:${anchor.item.id}`, x: start.x, y: start.y, axis, items: run.map((r) => r.item) });
  }
  const first = (r: Group) => Math.min(...r.items.map((it) => rank.get(it.id) ?? 0));
  return out.sort((a, b) => first(a) - first(b));
}

/** corners of one part of a run: round outside, small where it meets a neighbour */
export function runCorners(axis: Axis, first: boolean, last: boolean, outer: number, inner: number): Radii {
  const a = first ? outer : inner;
  const b = last ? outer : inner;
  return axis === "x" ? { tl: a, bl: a, tr: b, br: b } : { tl: a, tr: a, bl: b, br: b };
}

/**
 * One button of a group that reads as a single control — a row of tab buttons, say. The buttons sit
 * flush against one another: only the two ends of the group are rounded, the shared edge between
 * neighbours is a single 1px line, and each button but the first is pulled over the one before it.
 */
export function connectedButton(i: number, n: number, outer: number, inner: number): { margin: number; radii: Radii } {
  return { margin: i > 0 ? -1 : 0, radii: runCorners("x", i === 0, i === n - 1, outer, inner) };
}

/**
 * The corners of one part of a run: the shape the author gave it wins — a circle stays a circle,
 * whatever the document's shape scale and the run's neighbours say — then the connected look, then
 * the kind's own corners. The preview reads this for its parts, so what it draws is what the canvas
 * draws; a lone part of a run is round all over.
 */
export function runPartRadii(it: Item, first: boolean, last: boolean, axis: Axis): Radii {
  if (it.shape) return baseRadii(it);
  const conn = connectSpecOf(it);
  if (!conn) return baseRadii(it);
  if (first && last) return uniformRadii(conn.outer);
  return runCorners(axis, first, last, conn.outer, conn.inner);
}

/** the corner radii of every part across the given runs */
export function radiiOfRuns(runs: Group[]): Map<string, Radii> {
  const out = new Map<string, Radii>();
  for (const run of runs) {
    const n = run.items.length;
    run.items.forEach((it, i) => {
      /* a part the author gave a shape of its own (a circle, say) keeps it, even in a run */
      if (it.shape) {
        out.set(it.id, baseRadii(it));
        return;
      }
      const c = connectSpecOf(it);
      out.set(it.id, c ? runCorners(run.axis, i === 0, i === n - 1, c.outer, c.inner) : baseRadii(it));
    });
  }
  return out;
}

/** the corner radii of every part in a free group, with its hidden runs kept connected */
export function freeRadii(g: Group, widths: Record<string, number>): Map<string, Radii> {
  return radiiOfRuns(explodeGroup(g, widths));
}

/** a run belongs to the frame that contains its centre */
export function frameOfGroup(g: Group, frames: Frame[], widths: Record<string, number>): Frame | undefined {
  /* A group the author has placed on a screen stays on it: widening that screen must not
     swallow the parts of the screen beside it. Groups saved before this was recorded fall
     back to the geometry below, which is how the canvas always read them. */
  if (g.frameId) {
    const placed = frames.find((f) => f.id === g.frameId);
    if (placed) return placed;
  }
  const bb = groupBounds(g, widths);
  const cx = (bb.l + bb.r) / 2;
  const cy = (bb.t + bb.b) / 2;
  return frames.find((f) => {
    const fr = frameRect(f);
    return cx >= fr.l && cx <= fr.r && cy >= fr.t && cy <= fr.b;
  });
}

export const groupsInFrame = (groups: Group[], f: Frame, frames: Frame[], widths: Record<string, number>) =>
  groups.filter((g) => frameOfGroup(g, frames, widths)?.id === f.id);

export type Group = {
  id: string;
  /** the name the layers panel shows for it; unset means it is named after its parts */
  name?: string;
  x: number;
  y: number;
  axis: Axis;
  items: Item[];
  /** A group the Layers panel used to be able to lock: it cannot be dragged, deleted or tidied, but
   *  stays selectable. Nothing locks a group any more, so only a document drawn back then carries
   *  one; `adoptDoc` drops it as the document is read in. */
  locked?: boolean;
  /** a hand-made group: parts keep their own offsets (in `pos`) and move as one layer */
  free?: boolean;
  /** the screen this group belongs to, once the editor has placed it on one */
  frameId?: string;
  pos?: Record<string, { x: number; y: number }>;
};

export type FrameMode = "blank" | "phone";

/** where the generated prompt asks for the app to be built */
export type Platform = "android" | "web";
export const DEFAULT_PLATFORM: Platform = "android";
export const isPlatform = (v: unknown): v is Platform => v === "android" || v === "web";
/** The target the prompt assumes when the author has not picked one: the web as
 *  soon as a desktop screen exists, Android otherwise. */
export const defaultPlatformOf = (frames: Frame[], mode: FrameMode): Platform => (mode === "phone" && frames.some((f) => !isPhoneFrame(f)) ? "web" : DEFAULT_PLATFORM);

export type Doc = {
  groups: Group[];
  frames: Frame[];
  paletteKey: string;
  /** the author's own scheme, used when paletteKey is "custom" */
  customPalette?: Palette;
  /** the app should take its colors from the user's wallpaper (Material You) */
  dynamicColor?: boolean;
  frame: FrameMode;
  /** the implementation target the prompt names; Android unless the author picks the web */
  platform?: Platform;
  title: string;
  brief: string;
  /** the prompt as the author rewrote it by hand; undefined means the generated one */
  promptEdit?: string;
  /** shape, type, motion and the light / dark and contrast switches */
  theme?: Theme;
  /** the author's own composite parts: ready-made sets of parts the palette offers */
  customParts?: CustomPart[];
};

/** A set of parts the author composed once and can drop again and again. On the canvas
 *  an instance is a container holding the parts, so the set keeps its own layout and
 *  the layers panel shows the containment. */
export type CustomPart = {
  id: string;
  name: string;
  /**
   * 从哪来的：市场组件的编号，或 "mine"（作者自己在画布上存下来的组合组件）。
   *
   * 两者在组件面板里都要出现，但只有市场来的那一批属于「已加入的组件」，
   * 而且它们不能互相顶掉 —— 名字撞上时，本地存的那个才是该被覆盖的一份。
   */
  source?: string | number;
  /** the box an instance takes, before anything inside it is edited */
  w: number;
  h: number;
  /** the parts, with their offsets from the composite's top-left corner */
  items: PlacedItem[];
};

/** A container's contents, stretched with it: every offset and every size the parts
 *  carry of their own follows the box, however deep the nesting goes. */
export function scaleChildren(kids: PlacedItem[], sx: number, sy: number): PlacedItem[] {
  const one = (v: number | undefined, k: number) => (v === undefined ? undefined : Math.max(1, Math.round(v * k)));
  return kids.map((c) => ({
    ...c,
    x: Math.round(c.x * sx),
    y: Math.round(c.y * sy),
    ...(c.size !== undefined ? { size: one(c.size, sx) } : undefined),
    ...(c.size2 !== undefined ? { size2: one(c.size2, sy) } : undefined),
    ...(c.children ? { children: scaleChildren(c.children, sx, sy) } : undefined),
  }));
}

/** Whether a part's size is decided by a fold rather than by the author: folded, a navigation bar
 *  and a rail really are the small pill their own button sits in, while the width and height they
 *  carry are the ones they want again the moment they are opened. */
export const foldsToPill = (it: Item) => (it.kind === "bottomNav" && !!it.barFolded) || (it.kind === "navRail" && !!it.railFolded);

/**
 * The part a composite becomes on a screen. A set of several parts lands as one container box
 * holding a fresh copy of everything the author composed, so an instance can be moved, edited or
 * deleted whole — and so does a template that is already one container. A template of a *single*
 * part lands as that very part: wrapping a bar or a rail in a box of its own size leaves nothing to
 * grab (a child that fills its container cannot be moved inside it) and stops it behaving like the
 * part it is.
 */
export function compositeInstance(part: CustomPart, id: () => string = uid): Item {
  const copied = part.items.map((it) => copySubtree(it, id, new Map()) as PlacedItem);
  const only = copied[0];
  if (copied.length === 1 && only) {
    /* a part that folds to a pill keeps the width and height it will want when it opens again */
    return foldsToPill(only) ? only : { ...only, size: part.w, size2: part.h };
  }
  const box = makeItem("box");
  box.id = id();
  box.label = part.name;
  box.size = part.w;
  box.size2 = part.h;
  /* the box is only the frame the parts were composed in: it draws nothing of its own,
   * so an instance on a screen looks just like the set did in the compose dialog */
  box.fill = "surface";
  box.radiusTop = 0;
  box.radiusBottom = 0;
  box.children = copied;
  return box;
}

/** the destinations a bar starts with: the game functions, the first few that fit a bar */
export const defaultTabs = (count = 4): NavTab[] => GAME_NAV_TABS[getLang()].slice(0, count).map((t) => ({ ...t }));

const TOOLBAR_ICONS = ["format_bold", "format_italic", "format_underlined", "attach_file", "format_color_text", "more_vert"];

/** the entries a kind starts with, also used to fill in rows the author adds */
/** The pool a fresh prize wheel starts with, in the language the editor is in. */
export function defaultPrizes(): Prize[] {
  const icons = ["emoji_events", "sentiment_dissatisfied", "military_tech", "refresh", "workspace_premium", "redeem", "star", "sentiment_dissatisfied", "refresh"];
  return PRIZE_TEXT[getLang()].map((label, i) => ({ label, icon: icons[i % icons.length] }));
}

export function defaultTabsFor(kind: Kind): NavTab[] {
  switch (kind) {
    case "tabs":
    case "sideTabs":
      return TAB_LABELS[getLang()].map((label) => ({ icon: "", label }));
    case "select":
      return SELECT_OPTIONS[getLang()].map((label) => ({ icon: "", label }));
    case "toolbar":
      return TOOLBAR_ICONS.map((icon) => ({ icon, label: "" }));
    case "bottomNav":
    case "navRail":
      /* every game function is on offer, so a bar grown past four keeps going */
      return GAME_NAV_TABS[getLang()].map((t) => ({ ...t }));
    default:
      return defaultTabs();
  }
}

export function makeItem(kind: Kind): Item {
  const s = KIND_SPEC[kind];
  const text = KIND_TEXT[getLang()][kind];
  const it: Item = {
    id: uid(),
    kind,
    label: text?.label ?? s.defLabel,
    icon: s.defIcon,
    variant: s.defVariant ?? "filled",
  };
  if (s.defSupporting !== undefined) it.supporting = text?.supporting ?? s.defSupporting;
  if (s.defLabel2 !== undefined) it.label2 = text?.label2 ?? s.defLabel2;
  /* 第三颗按钮的字（确认框的取消）：只有这一类有（见 Item.label3） */
  if (s.defLabel3 !== undefined) it.label3 = text?.label3 ?? s.defLabel3;
  if (s.defIcon2 !== undefined) it.icon2 = s.defIcon2;
  if (s.defSize !== undefined) it.size = s.defSize;
  if (s.hasChecked) it.checked = kind !== "chip";
  /* a fresh wheel comes with a pool to draw from, and a pad with a full turn to point at */
  if (kind === "wheel" || kind === "gridWheel" || kind === "gacha" || kind === "slot") it.prizes = defaultPrizes();
  if (kind === "gacha") it.label2 = "";
  if (kind === "rewardTrack") {
    /* a track an author drops is already a working one: four rewards spread along it and the
       visitor part of the way there, so the thing that makes it a track — a reward going from
       ready to claimed — can be tried on the spot. Its progress is a count of things, not a share
       of a hundred, so its number carries no percent sign. */
    it.rewards = defaultRewards();
    it.max = REWARD_DEF_MAX;
    it.value = 20;
    it.unit = false;
  }
  if (kind === "fnButton") {
    /* A fresh one already shows what makes it this part: the icon in the circle, the name under it and
       a countdown running, so the two lines can be tried on the spot. */
    it.timer = true;
    it.timerValue = TIMER_DEF_VALUE;
    it.timerUnit = TIMER_DEF_UNIT;
  }
  if (kind === "assetPill") {
    /* A fresh one is the composite: an amount on the surface it was drawn on. Its round icon comes
       from the spec's default, and its capsule corner from the box (see baseRadii). */
    it.fill = "surfaceContainerHigh";
  }
  if (kind === "itemCell") {
    /* A fresh cell is a whole piece of loot, the way the composite was: the picture, the count, the
       quality tag on its top-left, the "new" mark on its top-right and the name under it. Its surface
       and its hairline are the ones the composite was drawn on. */
    it.badge2 = true;
    it.badge2Text = text?.badge2Text ?? s.defBadge2Text ?? "";
    it.badge2Color = ITEM_CELL_QUALITY;
    it.badge = true;
    it.badgeText = text?.badgeText ?? s.defBadgeText ?? "";
    it.fill = ITEM_CELL_FILL;
    /* the cell's ring is the cell's own: `strokeWidth`/`strokeColor` are read by its body (see the
       renderer), not by the plain box around the whole part */
    it.strokeWidth = 1;
    it.strokeColor = "secondaryContainer";
  }
  if (kind === "taskBar") {
    /* 一个刚放下的任务信息条已经是一条完整的任务：标题、两个奖励格（每个都有那个**固定**的奖励
       图标和一个**固定**的 100）、右端一个「领取」按钮和它右上角那枚徽标，还有条自己的底和圆角 ——
       它就是那个 composite，只是变成了一个部件。奖励格的个数、图标和数量都是画法，不是字段：这一条
       不写 `value`、不写 `cellCount`、也不写奖励图标（见 TASK_BAR_VALUE / readItem）。 */
    it.label2 = text?.label2 ?? s.defLabel2 ?? "";
    it.badge = true;
    it.badgeText = text?.badgeText ?? s.defBadgeText ?? "";
    it.badge2 = true;
    it.badge2Text = text?.badge2Text ?? s.defBadge2Text ?? "";
    /* 右边那一枚角标是品质色（和物品格画品质那枚一样），左边那一枚用主题自己的角色 */
    it.badge2Color = ITEM_CELL_QUALITY;
    it.buttonBadge = true;
    it.buttonBadgeText = text?.buttonBadgeText ?? s.defButtonBadgeText ?? "";
    it.fill = TASK_BAR_FILL;
    it.radiusTop = TASK_BAR_RADIUS;
  }
  if (kind === "confirmBox") {
    /* 一个刚放下的确认框就是作者在这一版里做成的那一个：标题、正文带和两颗普通按钮（确认 = label2、
       取消 = label3），**两颗点下去都把这一块收起来**（作者加上的"隐藏面板"逻辑，见
       CONFIRM_BOX_HIDE_STEP），底和圆角也写成它自己画出来的那两样，和任务信息条同一条规矩。主按钮的
       机器是这一部件自己的 `flow`，取消那台在 `slotFlows.cancel`（见 CONFIRM_BOX_MAIN /
       CONFIRM_BOX_CANCEL_SLOT）—— 两颗各是一台，谁也不比谁特殊。 */
    it.fill = CONFIRM_BOX_FILL;
    it.radiusTop = CONFIRM_BOX_RADIUS;
    it.flow = confirmBoxHideFlow();
    it.slotFlows = { [CONFIRM_BOX_CANCEL_SLOT]: confirmBoxHideFlow() };
  }
  if (kind === "box") {
    it.size2 = 220;
    it.radiusTop = 28;
    it.radiusBottom = 28;
    it.fill = "surfaceContainerHigh";
  }
  if (kind === "invGrid") {
    /* A fresh grid is a whole inventory window: it takes the width it is drawn at, holds a few
       rows of default cells, and scrolls, so pinning more rows is the only thing left to do. Its
       corners are written down like a box's, so the prompt and the inspector agree with the canvas
       about the default instead of each guessing at it. The cells are real container boxes from the
       start: that is what lets an author drop a part straight into one. */
    it.size2 = KIND_SPEC.invGrid.h;
    it.radiusTop = KIND_SPEC.invGrid.radius;
    it.radiusBottom = KIND_SPEC.invGrid.radius;
    it.fill = "surfaceContainer";
    it.scroll = "y";
    it.children = gridCells(it, {});
  }
  /* An icon button is a circle: saying so outright keeps it one even where it sits in a run beside
     a button, which is what its shape switch shows and what the author asked for. */
  if (kind === "iconButton") it.shape = "round";
  if (kind === "slider" || kind === "stepper") it.value = 40;
  if (kind === "progressBar") it.value = PROGRESS_DEFAULT;
  if (kind === "bottomNav") {
    it.tabs = defaultTabs();
    it.radiusTop = 0;
    it.radiusBottom = 0;
    /* The fold button comes with the bar: `false` is "shown, destinations out", `true` is folded,
       and only a document written before this existed has no button at all. */
    it.barFolded = false;
  }
  if (kind === "navRail") {
    /* the side rail speaks the game UI's language: inventory, map, party, achievements */
    it.tabs = GAME_NAV_TABS[getLang()].map((tab) => ({ ...tab }));
    /* the expressive rail, whose header is its own fold button */
    it.railExpanded = false;
  }
  if (kind === "tabs" || kind === "sideTabs" || kind === "select") it.tabs = defaultTabsFor(kind);
  if (kind === "toolbar") it.tabs = defaultTabsFor(kind).slice(0, 4);
  return it;
}

/** What a fresh progress bar shows, and what a bar with no value falls back to. */
export const PROGRESS_DEFAULT = 60;

/** A progress bar's share of its track, 0..100: what the author set, never outside the bar. */
export const progressValue = (it: Item): number => Math.max(0, Math.min(100, Math.round(it.value ?? PROGRESS_DEFAULT)));

/**
 * What a progress bar draws behind its fill, and the ink that reads on it. A bar starts with no
 * track at all — the page shows through, so a game bar is just its fill — and the background the
 * author picks (or leaves out) decides what the words over the empty part are inked with.
 */
export function progressTrack(it: Item, p: Palette): { color: string; ink: string } {
  return it.fill ? { color: fillColor(it.fill, p, "surfaceContainerHighest"), ink: fillInk(it.fill, p, "surfaceContainerHighest") } : { color: "transparent", ink: p.onSurface };
}

/** Content-sized kinds are measured in the DOM; the rest derive from spec + size. */
/**
 * The kinds whose width the browser decides from their real content. The editor renders a hidden copy of
 * each in a fixed, invisible layer, measures it, and hands the numbers to `sizeOf` — so a part drawn to
 * its own words is boxed at exactly the width those words take in the loaded font, not at a guess.
 *
 * 资产框 is here for the author's sake: 输入的金额多长，条就多长，不会因为估算偏短而把文字省略掉。
 */
export const MEASURED: Kind[] = ["button", "extendedFab", "chip", "switch", "checkbox", "text", "splitButton", "radio", "badge", "assetPill"];

/** Progress track thickness range in dp; Material's standard bar is 4 and its thick bar 8. */
export const TRACK_MIN = 2;
export const TRACK_MAX = 16;
export const TRACK_DEFAULT = 4;
/** A ring can only be so thick before its gap swallows it: a sixth of the diameter, never under 4. */
export const maxRingThickness = (size: number) => Math.max(TRACK_DEFAULT, Math.min(TRACK_MAX, Math.floor(size / 6)));
export const isTrackThickness = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= TRACK_MIN && v <= TRACK_MAX;
/** The thickness actually drawn: a ring caps the value by its own diameter. */
export const progressThickness = (it: Item): number => {
  const v = isTrackThickness(it.trackThickness) ? it.trackThickness : TRACK_DEFAULT;
  return it.kind === "circularProgress" ? Math.min(v, maxRingThickness(it.size ?? KIND_SPEC.circularProgress.w)) : v;
};

export function sizeOf(it: Item, widths: Record<string, number>) {
  const s = specOf(it);
  const n = it.size ?? s.defSize ?? s.w;
  switch (it.kind) {
    case "switch":
      return { w: it.size ?? widths[it.id] ?? s.w, h: it.size2 ?? s.h };
    case "button":
      /* 按钮是内容决定宽度的（MEASURED）：宽度优先用浏览器量出来的那一行；量不到时（服务端渲染、静态
         导出、首帧、测试）才是 kind 自己的 s.w。 */
      return { w: it.size ?? widths[it.id] ?? s.w, h: it.size2 ?? s.h };
    case "extendedFab":
    case "chip":
    case "checkbox":
    case "splitButton":
    case "radio":
      /* as wide as its own words until the author gives it a width of its own */
      return { w: it.size ?? widths[it.id] ?? 128, h: it.size2 ?? s.h };
    case "badge":
      return { w: it.size ?? widths[it.id] ?? 16, h: it.size2 ?? (it.label.trim() ? s.h : 6) };
    case "toolbar":
      return { w: it.size ?? toolbarWidth(it), h: it.size2 ?? s.h };
    case "tabs":
    case "sideTabs":
      return { w: n, h: it.size2 ?? s.h };
    /* a pad and a round wheel are round: a width the author sets carries the height with it. The
       square wheel is only square by default — the author stretches it into a rectangle whenever the
       cells want to be wider than they are tall. */
    case "joystick":
      /* a round pad is square: one side for the circle, whatever height a document still carries */
      return { w: n, h: n };
    case "wheel":
      return { w: n, h: it.size2 ?? n };
    case "gridWheel":
    case "gacha":
    case "slot":
    case "calendar":
    case "rewardTrack":
      return { w: n, h: it.size2 ?? s.h };
    case "text":
      return { w: widths[it.id] ?? 120, h: Math.round(n * 1.3) };
    case "iconButton":
    case "fab":
    case "circularProgress":
    case "loadingIndicator":
      return { w: n, h: n };
    case "fnButton":
      /* the circle its own width gives it, plus a line for each line it draws — the author's height wins */
      return { w: n, h: it.size2 ?? fnButtonHeight(n, fnButtonLines(it)) };
    case "itemCell":
      /* the square its own width gives it, plus the name's line when it has one — the author's height wins */
      return { w: n, h: it.size2 ?? itemCellHeight(n, itemCellLines(it)) };
    case "taskBar":
      /* 条的高度跟着内容走：标题那一行（空标题就不占）、格子那一行（格子与按钮里高的那个）和条自己
         的留白，全部来自那个唯一的助手（见 taskBarMetrics）。宽度是作者的。角标和按钮上的徽标是绝
         对定位的角上药丸，一点不算进来 —— 它们挂不挂、写多长，这里都是同一个数。作者钉的高矮说了算。 */
      return { w: n, h: it.size2 ?? taskBarMetrics(it).h };
    case "confirmBox":
      /* 框的高跟着内容走：标题那一行（空标题就不占）、正文带（正文折几行就多高，两行是下限）和框
         自己的留白，全都来自那个唯一的助手（见 confirmBoxMetrics）。宽度是作者的。里面那两颗按钮画
         在框自己里面，一点不算进来 —— 它们写多长、有没有配去处，这里都是同一个数。作者钉的高说了算。 */
      return { w: n, h: it.size2 ?? confirmBoxMetrics(it).h };
    case "image":
      /* square until the author gives it a height, the way a camera preview starts 4:3 */
      return { w: n, h: it.size2 ?? n };
    case "camera":
      return { w: n, h: it.size2 ?? Math.round((n * 4) / 3) };
    case "map":
      return { w: n, h: it.size2 ?? Math.round((n * 3) / 4) };
    case "topAppBar":
      /* the status-bar inset belongs to a phone: a bar wider than one has no status bar above it.
       * (An Android tablet does; the canvas leaves that to the prompt.) */
      return { w: n, h: it.size2 ?? 64 + (n > PHONE_W ? 0 : STATUS_BAR_H) };
    case "bottomNav": {
      /* Folded, the bar is a small pill holding nothing but its own button: the whole bar
       * really changes size, so the fold is visible wherever it is looked at. */
      if (it.barFolded) return { w: BAR_FOLDED_W, h: BAR_FOLDED_H };
      const rows = navRows(it.tabs?.length ?? 0, it.navPerRow);
      return { w: n, h: it.size2 ?? s.h * rows };
    }
    case "searchBar":
    case "bottomNav":
    case "listItem":
    case "listItem":
    case "textField":
    case "select":
    case "linearProgress":
    case "divider":
    /* an amount on a bar: as wide as its own content — 留白 + 图标 + 文字 + 间距，删掉图标就变短 —
       直到作者钉了一个宽度。宽度优先用浏览器量出来的那个数（见 MEASURED；也可能来自别的绘制路径），
       还没量到时退回估算（见 assetPillWidth），所以静态导出和首帧也有一个合理的盒子。
       高是作者的高，圆角跟着盒子走（见 baseRadii）。 */
    case "assetPill":
      return { w: it.size ?? widths[it.id] ?? assetPillWidth(it), h: it.size2 ?? s.h };
    case "slider":
      /* a slider that shows its number needs the room above the track to show it in */
      return { w: n, h: it.size2 ?? (it.showValue ? SLIDER_VALUE_H : SLIDER_H) };
    case "progressBar":
    case "stepper":
    case "card":
      return { w: n, h: it.size2 ?? Math.round(n * 0.5875) };
    case "dialog":
    case "snackbar":
      /* a dialog is as wide as M3's own until the author says otherwise, and its height is theirs */
      return { w: n, h: it.size2 ?? s.h };
    case "box":
    case "invGrid":
      return { w: n, h: it.size2 ?? s.h };
    case "navRail": {
      /* folded, the rail is the same small pill its button sits in */
      if (it.railFolded) return { w: BAR_FOLDED_W, h: BAR_FOLDED_H };
      return { w: railWidth(it) * navRows(it.tabs?.length ?? 0, it.navPerRow), h: it.size2 ?? s.h };
    }
    default:
      return { w: s.w, h: s.h };
  }
}

/** Corners for a part that is not part of a connected run. Defaults follow the
 *  document's shape scale; a radius the author typed in is kept as is. */
export function baseRadii(it: Item): Radii {
  const s = specOf(it);
  switch (it.kind) {
    case "box":
      if (it.corners) return { ...it.corners };
    // falls through
    case "bottomNav":
    case "topAppBar":
    case "tabs":
    case "sideTabs": {
      const t = it.radiusTop ?? 0;
      const b = it.radiusBottom ?? 0;
      return { tl: t, tr: t, bl: b, br: b };
    }
    case "navRail": {
      /* a rail's corners are its left and right sides: radiusTop is the left pair, radiusBottom the right */
      const modalRadius = it.railExpanded && it.railModal ? 16 : 0;
      const l = it.radiusTop ?? modalRadius;
      const r = it.radiusBottom ?? modalRadius;
      return { tl: l, bl: l, tr: r, br: r };
    }
    case "fab":
      /* a circle keeps its roundness whatever the document's shape scale says */
      if (it.shape === "round") return uniformRadii(Math.round((it.size ?? 56) / 2));
      if (it.shape === "square") return uniformRadii(scaleR(8));
      return uniformRadii(scaleR(Math.round((it.size ?? 56) * 0.28)));
    case "iconButton":
      /* a square is the author asking for one; otherwise an icon button is a circle, and keeps it
         whatever the document's shape scale says — exactly as a round FAB does */
      if (it.shape === "square") return uniformRadii(scaleR(8));
      return uniformRadii(Math.round((it.size ?? 48) / 2));
    case "fnButton":
      /* the same two outlines an icon button wears (see roundShapeRadius); the circle's own diameter
         is what decides its roundness, so a part that made room for its lines stays a true circle */
      return uniformRadii(roundShapeRadius(it.shape, fnButtonCircle(it)));
    case "joystick":
      /* a movement pad is a circle by nature and keeps it whatever the document's shape scale says —
         a square-theme document drew a squarish pad. The corner follows the box the pad is drawn in,
         so a resized pad is still a circle (see sizeOf) */
      return uniformRadii(Math.round(sizeOf(it, {}).w / 2));
    case "assetPill":
      /* an amount on a bar: the corner the author set — a sharp rectangle when they set none, a
         capsule when they round it to half the height — whatever the shape scale says (see
         assetPillRadius) */
      return uniformRadii(assetPillRadius(it));
    case "itemCell":
      /* 物品格的圆角：作者用「圆角」控件设的那个数，按格子画出来的正方形的一半封顶（见
         itemCellRadius）。不设就是直角 —— 用户要求的默认。assetPill 是另一个 kind，各画各的。 */
      return uniformRadii(itemCellRadius(it));
    case "confirmBox":
      /* 确认框的圆角：作者设的那个数（「圆角」控件），不设就是 kind 自己的 28 —— 作者原稿那个框就是
         28。四条边同一个数：一个确认框是一个圆角矩形。 */
    case "taskBar":
      /* 任务信息条的圆角：作者设的那个数（「圆角」控件），不设就是 kind 自己的 16 —— 那个 composite
         的框就是 16。四条边同一个数：一条信息条是一个圆角矩形，不像框那样上下一对一对地设。 */
      return uniformRadii(Math.max(0, Math.round(it.radiusTop ?? s.radius)));
    case "chip":
    case "splitButton":
    case "radio":
    case "badge":
      return uniformRadii(s.radius);
    case "stepper":
      /* the stepper is a pill the height it is drawn, the way a field of that shape reads */
      return uniformRadii(Math.round((it.size2 ?? s.h) / 2));
    case "circularProgress":
    case "loadingIndicator":
      return uniformRadii((it.size ?? 48) / 2);
    case "progressBar":
      /* the ends are half the bar's own height, so a slim bar is a pill and a thick one a slab */
      return uniformRadii(Math.round((it.size2 ?? s.h) / 2));
    case "card":
    case "invGrid":
    case "image":
    case "camera":
    case "map":
      return uniformRadii(it.radiusTop ?? scaleR(s.radius));
    case "badge":
    case "radio":
    case "splitButton":
      return uniformRadii(s.radius);
    case "button":
    case "extendedFab":
      /* The shape switch: a pill by default (M3's medium height), and a round part is that pill at
         whatever height the author gave it — so a button as tall as it is wide is a true circle. */
      if (it.shape === "round") return uniformRadii(Math.round((it.size2 ?? H) / 2));
      if (it.shape === "square") return uniformRadii(scaleR(8));
      return uniformRadii(scaleR(s.radius));
    default:
      return uniformRadii(scaleR(s.radius));
  }
}

/** a tab row fits up to this many fixed tabs; more become M3 scrollable tabs */
export const FIXED_TABS_MAX = 5;
/** width of one scrollable tab; M3 asks for at least 90dp */
export const SCROLL_TAB_W = 96;

/** a tab row scrolls once it holds more tabs than M3 fixes in place and they would not fit its width */
export const isScrollableTabs = (it: Item) => {
  const n = it.tabs?.length ?? 0;
  return it.kind === "tabs" && n > FIXED_TABS_MAX && n * SCROLL_TAB_W > sizeOf(it, {}).w;
};

/** per-tab tap targets renumbered after the tab list changed; `to(j)` gives the old index j its new one, or nothing */
function remapTabActions(actions: Item["actions"], to: (j: number) => number | undefined): Item["actions"] {
  if (!actions) return undefined;
  const next: NonNullable<Item["actions"]> = {};
  for (const [key, a] of Object.entries(actions)) {
    const m = /^tab:(\d+)$/.exec(key);
    if (!m) {
      next[key] = a;
      continue;
    }
    const j = to(Number(m[1]));
    if (j !== undefined) next[`tab:${j}`] = a;
  }
  return Object.keys(next).length ? next : undefined;
}

/** the patch that drops entry i: later entries, the selected index and the tap targets move up one; a
 *  dropdown may end with no initial value, a bar or tab row keeps the entry that takes the removed one's place */
export function removeTabPatch(it: Item, i: number): Pick<Item, "tabs" | "selected" | "actions" | "children"> {
  const tabs = (it.tabs ?? []).filter((_, j) => j !== i);
  const sel = it.selected;
  const last = Math.max(0, tabs.length - 1);
  const selected =
    sel === undefined ? undefined : sel > i ? sel - 1 : sel < i ? sel : it.kind === "select" ? undefined : Math.min(i, last);
  /* a tab row's panels follow the tabs, or the one that was dropped would sit in the document under
     the name of a tab that no longer exists */
  const children = isTabRow(it) ? withoutPanel(it.children, (j) => j === i) : undefined;
  /* what a removed tab's panel held moves into the panel in front rather than sitting in a shell no
     canvas can ever show */
  const folded = children ? foldOrphanPanels({ ...it, tabs, selected, children }).children : undefined;
  return {
    tabs,
    selected,
    actions: remapTabActions(it.actions, (j) => (j === i ? undefined : j > i ? j - 1 : j)),
    ...(folded ? { children: folded } : undefined),
  };
}

/** the patch that sets the entry count: extra entries come from the defaults, and the tap targets of dropped entries go */
export function tabCountPatch(it: Item, n: number, defaults: NavTab[]): Pick<Item, "tabs" | "selected" | "actions" | "children" | "size2"> {
  const cur = it.tabs ?? [];
  const tabs: NavTab[] = [];
  for (let i = 0; i < n; i++) tabs.push(cur[i] ? { ...cur[i] } : { ...defaults[i % defaults.length] });
  const keptRaw = isTabRow(it) ? withoutPanel(it.children, (j) => j >= n) : undefined;
  const kept = keptRaw ? foldOrphanPanels({ ...it, tabs, children: keptRaw }).children : undefined;
  /* A tab with no panel under it is a label with nothing to show — and a panel is the tab's slot,
     known by its place in the row, so a tab that arrives without one can never be filled. The panels
     the new tabs need are made here, the way a removal puts the slot it opened back. */
  const kids = kept ? [...kept] : undefined;
  if (kids) {
    const row = { ...it, tabs };
    const w = sizeOf(row, {}).w;
    const area = panelArea(row);
    while (kids.length < n) kids.push(freshPanel(tabs[kids.length]?.label ?? "", w, area, kids.length));
    return {
      tabs,
      selected: it.selected !== undefined && it.selected >= n ? undefined : it.selected,
      actions: remapTabActions(it.actions, (j) => (j < n ? j : undefined)),
      children: kids,
      /* the strip keeps its height and the rest of the box goes to the panels, so a row that only
         had room for its tabs grows to hold the new one */
      size2: Math.max(it.size2 ?? TAB_ROW_H, TAB_ROW_H + area),
    };
  }
  return {
    tabs,
    selected: it.selected !== undefined && it.selected >= n ? undefined : it.selected,
    actions: remapTabActions(it.actions, (j) => (j < n ? j : undefined)),
    ...(kept ? { children: kept } : undefined),
  };
}

/** Whether a tab row is still short of panels, or of the room to show them. Cheap enough to ask on
 *  every render: it allocates nothing, unlike the patch that fixes it. */
export const needsTabPanels = (it: Item) =>
  isTabRow(it) && (it.tabs?.length ?? 0) > 0 && ((it.children?.length ?? 0) < (it.tabs?.length ?? 0) || (it.size2 ?? TAB_ROW_H) < tabRowMin(it));

/**
 * Where a part lands when it becomes a child: inside the box, pulled in when it sat past the edge, and
 * raised above everything it carries with it.
 */
export function childAt(
  parent: Item,
  kid: Item,
  at: { l: number; t: number },
  /* where the parent stands on the canvas: a child's offsets are measured from its own box */
  parentAt: { l: number; t: number },
  widths: Record<string, number>,
): PlacedItem {
  const box = sizeOf(parent, widths);
  const size = sizeOf(kid, widths);
  return liftAbove(
    {
      ...(kid as PlacedItem),
      x: Math.round(clamp(at.l - parentAt.l, 0, Math.max(0, box.w - size.w))),
      y: Math.round(clamp(at.t - parentAt.t, 0, Math.max(0, box.h - size.h))),
    },
    layerOf(parent) + 1,
  );
}

/** The room a tab row leaves for the panels under its tab strip. */
const panelArea = (row: Item) => Math.max(TAB_PANEL_H, (row.size2 ?? TAB_ROW_H) - TAB_ROW_H);

/** What a side row's labels take of its width: their own column, never more than half the box, so the
 *  page beside them keeps something to be. */
export const sideRailW = (row: Item) => {
  const width = row.size ?? PHONE_W;
  const pct = Math.max(SIDE_RAIL_MIN, Math.min(SIDE_RAIL_MAX, Math.round(row.sideRail ?? SIDE_RAIL_PCT)));
  return Math.max(48, Math.round((width * pct) / 100));
};

/** How tall a tab row has to be to show a page at all: a strip's height under the labels, or — on its
 *  side — simply the room a page needs. */
export const tabRowMin = (row: Item) => (isSideTabs(row) ? TAB_ROW_H + TAB_PANEL_H : TAB_ROW_H + TAB_PANEL_H);

/**
 * The box a tab row leaves for the page of the tab in front: under the strip for a row of tabs, beside
 * the labels for a row stood on its side. One place decides it, so a panel is always where its row can
 * show it — and so a drop, a resize and the canvas all agree.
 */
export const panelBox = (row: Item, w: number, h: number): { x: number; y: number; size: number; size2: number } => {
  const rail = sideRailW(row);
  switch (labelSideOf(row)) {
    /* the labels under the page, which is the strip at the foot of the box */
    case "bottom":
      return { x: 0, y: 0, size: Math.round(w), size2: Math.max(0, Math.round(h - TAB_ROW_H)) };
    /* the labels down the right, so the page takes the left */
    case "right":
      return { x: 0, y: 0, size: Math.max(0, Math.round(w - rail)), size2: Math.max(0, Math.round(h)) };
    case "left":
      return { x: rail, y: 0, size: Math.max(0, Math.round(w - rail)), size2: Math.max(0, Math.round(h)) };
    default:
      return { x: 0, y: TAB_ROW_H, size: Math.round(w), size2: Math.max(0, Math.round(h - TAB_ROW_H)) };
  }
};

/** The empty panel a tab starts with: the row's own width, right under its tab strip. */
export function freshPanel(label: string, w: number, area: number, at = 0): PlacedItem {
  /* A panel is scaffolding with a name of its own: without one the layers list reads it as another
     container the author made, and a row they cannot remove — the panel comes straight back, since a
     row's panels are known by their place — is the most confusing row there is. Named, it says which
     tab it belongs to. */
  const words = label.trim();
  return {
    ...makeItem("box"),
    panel: true,
    name: words ? `${t("tabPanel")} · ${words}` : `${t("tabPanel")} ${at + 1}`,
    label,
    x: 0,
    y: TAB_ROW_H,
    size: w,
    size2: area,
  };
}

/**
 * The panels a tab row needs: one container per tab, in tab order, filling the area under the row. It
 * only ever adds what is missing and makes room for it, so pressing it twice changes nothing — and a
 * panel the author has already filled in is never touched. Panels past the last tab are left alone as
 * well: dropping one would be dropping the author's work.
 */
export function tabPanelsPatch(it: Item): Pick<Item, "children" | "size2"> | null {
  const tabs = it.tabs ?? [];
  if (!isTabRow(it) || tabs.length === 0) return null;
  const have = it.children ?? [];
  const size = sizeOf(it, {});
  /* the row grows to hold a page before the panels are laid out in it, so the panel a fresh tab gets
     is exactly the room the row will have — not the room it had */
  const size2 = Math.max(it.size2 ?? 0, tabRowMin(it));
  const box = panelBox({ ...it, size2 }, size.w, size2);
  const children =
    have.length >= tabs.length
      ? have
      : [
          ...have,
          ...Array.from({ length: tabs.length - have.length }, (_, k) =>
            /* a fresh panel is the room its tab shows, in the place its row puts it */
            ({ ...freshPanel(tabs[have.length + k].label, box.size, box.size2, have.length + k), x: box.x, y: box.y }),
          ),
        ];
  const grown = it.size2 === undefined || it.size2 < size2;
  if (children.length === have.length && !grown) return null;
  return { children, size2 };
}

/**
 * The children a tab row keeps when panels leave it: every vacated slot is filled with the empty
 * panel of its tab. Panels are known by their place in the row's list, so a slot left open would
 * slide every later panel one tab back — the author would see one tab wearing its neighbour's
 * panel, under its neighbour's name. `row` is the row as it stands after they left, and `gone`
 * names the places that opened up.
 */
export function keepPanelSlots(row: Item, gone: number[]): PlacedItem[] {
  const out = [...(row.children ?? [])];
  if (!isTabRow(row) || gone.length === 0) return out;
  const size = sizeOf(row, {});
  const h2 = Math.max(row.size2 ?? 0, tabRowMin(row));
  const box = panelBox({ ...row, size2: h2 }, size.w, h2);
  /* from the back, so an insert never moves a place still to be filled */
  for (const at of [...new Set(gone)].sort((a, b) => b - a))
    out.splice(at, 0, { ...freshPanel(row.tabs?.[at]?.label ?? "", box.size, box.size2, at), x: box.x, y: box.y });
  return out;
}

/**
 * The panel a box dropped on a tab row takes the place of: the empty panel of the tab the box is
 * named after, so a panel the author took out of the row goes back to its own tab. Null when no
 * panel is free — a panel with something in it is the author's work and is never overwritten.
 */
export function panelSlotFor(row: Item, part: Item): number | null {
  if (!isTabRow(row) || part.kind !== "box") return null;
  const label = part.label.trim();
  if (!label) return null;
  const kids = row.children ?? [];
  const at = (row.tabs ?? []).findIndex((tab, i) => tab.label.trim() === label && !kids[i]?.children?.length);
  return at < 0 ? null : at;
}

/**
 * The row's children after a part is put back in the panel named for it: the part takes that slot,
 * drawn right above its row and refitted to it, with everything it holds. Null when no panel is
 * free — the part then belongs inside the panel of the tab in front, which is the caller's
 * fallback.
 */
export function restorePanel(row: Item, part: PlacedItem, widths: Record<string, number>): PlacedItem[] | null {
  const at = panelSlotFor(row, part);
  if (at === null) return null;
  const kids = [...(row.children ?? [])];
  /* the caller makes the row's panels first, so the slot is usually there already; a short list is
     filled out so the part still lands on the tab it is named after */
  const size = sizeOf(row, {});
  const h2 = Math.max(row.size2 ?? 0, tabRowMin(row));
  const box = panelBox({ ...row, size2: h2 }, size.w, h2);
  while (kids.length <= at) kids.push({ ...freshPanel(row.tabs?.[kids.length]?.label ?? "", box.size, box.size2, kids.length), x: box.x, y: box.y });
  /* the part goes into the slot with the row's own box: the same place, whichever way the row faces */
  kids[at] = liftAbove({ ...part, x: box.x, y: box.y, size: box.size, size2: box.size2 }, layerOf(row) + 1);
  return fitTabPanels(kids, row, size.w, h2);
}

/** Panels follow their row when it is resized: the row keeps its height and the panels take what is
 *  left, rather than being stretched away from the row the way proportional scaling would. */
export const fitTabPanels = (panels: PlacedItem[], row: Item, w: number, h: number, floor = LAYER_DEFAULT): PlacedItem[] => {
  const box = panelBox(row, w, h);
  return panels.map((c) => {
    /* A panel below its own row is not drawn at all — a child under its container never is — so a row
       the author lifted takes its panels up with it, exactly as a board takes its cells. */
    const fitted: PlacedItem = { ...c, x: box.x, y: box.y, size: box.size, size2: box.size2 };
    return liftAbove(fitted, floor);
  });
};

/**
 * The nearest part among `ids` that holds `id`: the container the author picked in the layers panel.
 * A drag that lands on something drawn over it belongs to that container, not to whatever the
 * pointer happens to be over.
 */
export function selectedAncestor(groups: Group[], id: string, ids: string[]): Item | null {
  for (let p = parentOf(groups, id); p; p = parentOf(groups, p.id)) if (ids.includes(p.id)) return p;
  return null;
}

/**
 * Whether a child may be dragged past the edges of the container that holds it. Two cases say yes:
 * a container that scrolls is a viewport, so its children are content that belongs outside it, and a
 * child the author picked in the layers panel is the part they said they meant. Everything else keeps
 * its children inside.
 */
export const childDragFree = (parent: Item, picked: boolean): boolean => !!parent.scroll || picked;

/**
 * How far a child may be moved within its container. A free child has no limit (it may sit past the
 * viewport, which is what the visitor scrolls to); any other child stays fully inside — and one that
 * fills the container in both directions has no room at all, which is how a drag comes to move the
 * container instead.
 */
export function childDragRoom(parent: Item, child: Item, widths: Record<string, number>, free: boolean): { w: number; h: number } {
  if (free) return { w: Infinity, h: Infinity };
  const box = sizeOf(parent, widths);
  const sz = sizeOf(child, widths);
  return { w: Math.max(0, box.w - sz.w), h: Math.max(0, box.h - sz.h) };
}

/**
 * The tree without the parts `gone` names, and whether anything went at any depth. A container that
 * loses one of its own children keeps the rest, and only the containers the pruning actually touched
 * come back as new objects — so `changed` is what tells a caller that its tree is not the one it
 * passed in, however deep the removal was.
 */
export function pruneParts(items: Item[], gone: Set<string>): { items: Item[]; changed: boolean } {
  let changed = false;
  const walk = (list: Item[]): Item[] => {
    const out: Item[] = [];
    for (const it of list) {
      if (gone.has(it.id)) {
        changed = true;
        continue;
      }
      if (!it.children) {
        out.push(it);
        continue;
      }
      const kids = walk(it.children);
      if (!kids.length && it.children.length) changed = true;
      /* an untouched container comes back as itself, so pruning a deep part does not rebuild the
         whole tree above it */
      if (kids.length === it.children.length && kids.every((c, i) => c === it.children![i])) {
        out.push(it);
        continue;
      }
      out.push(kids.length ? { ...it, children: kids as PlacedItem[] } : { ...it, children: undefined });
    }
    return out;
  };
  const next = walk(items);
  return { items: next, changed };
}

/** Where each part sits: the container that holds it, and its place in that container's list. */
export function slotsOf(items: Item[], parent: Item | null, out: Map<string, { parent: Item; at: number }>): void {
  items.forEach((it, at) => {
    if (parent) out.set(it.id, { parent, at });
    if (it.children) slotsOf(it.children, it, out);
  });
}

/**
 * The tree with a fresh empty panel back in every slot a tab row has just lost (see keepPanelSlots):
 * `lost` names the row and the places it lost, so the rows a removal shortened are the only ones
 * touched.
 */
export function refillPanels(items: Item[], lost: Map<string, number[]>): Item[] {
  return items.map((it) => {
    const kids = it.children ? refillPanels(it.children, lost) : undefined;
    const gone = lost.get(it.id);
    if (!gone?.length) return kids ? { ...it, children: kids as PlacedItem[] } : it;
    return { ...it, children: keepPanelSlots({ ...it, children: kids as PlacedItem[] }, gone) };
  });
}

/**
 * The children a size patch leaves behind — `undefined` when the patch does not resize anything
 * or the part holds nothing.
 *
 * The children the patch itself carries win over the ones already on the part: a patch that
 * brings a panel in (adding a tab, say) must not be overruled by the shorter list that was
 * there before, which is what left a new tab without its panel. A tab row keeps its row height
 * and hands the rest of the box to its panels; any other container scales what it holds with
 * the box.
 */
export function resizedChildren(before: Item, patch: Partial<Item>, widths: Record<string, number>): PlacedItem[] | undefined {
  /* A board is its slots: nothing stretches and nothing is left behind, the cells are simply laid
     out again for the size, the cell size and the counts the patch asks for. */
  if (before.kind === "invGrid") {
    /* a layer the author raised is a board change like any other: its cells have to come up with it */
    const geometry = "size" in patch || "size2" in patch || "cell" in patch || "gridCols" in patch || "gridRows" in patch || "cellNames" in patch || "z" in patch;
    return geometry ? gridCells({ ...before, ...patch }, widths) : undefined;
  }
  /* A cell the author lifts carries what it holds, for the same reason a board does: a part left
     sitting below its own container is not drawn at all. */
  if (isGridCell(before) && "z" in patch) {
    const next = { ...before, ...patch } as PlacedItem;
    return liftAbove(next, layerOf(next)).children;
  }
  /* A tab row's panels answer a change of layer as well as a change of size: the row is what they hang
     under, and one left below it is a panel nothing draws. */
  /* A tab row's panels answer a change of layer, and a change of side: the labels moving to the other
     edge sends the page to the other side with them, and a panel left where it was is a blank box the
     author cannot explain. */
  if (isTabRow(before) && ("z" in patch || "tabSide" in patch || "sideRail" in patch) && !("size" in patch || "size2" in patch)) {
    const kids = patch.children ?? before.children;
    if (!kids?.length) return undefined;
    const row = { ...before, ...patch } as Item;
    const now = sizeOf(row, widths);
    return fitTabPanels(kids as PlacedItem[], row, now.w, now.h, layerOf(row));
  }
  if (!("size" in patch || "size2" in patch)) return undefined;
  const kids = patch.children ?? before.children;
  if (!kids?.length) return undefined;
  /* A scrolling container's size is its viewport: shrinking it hides content, it does not squash it,
     so its children keep the size they were drawn at. */
  if (before.scroll) return undefined;
  const next = { ...before, ...patch };
  if (isTabRow(before)) {
    const now = sizeOf(next, widths);
    return fitTabPanels(kids as PlacedItem[], next, now.w, now.h, layerOf(next));
  }
  const was = sizeOf(before, widths);
  const now = sizeOf(next, widths);
  return scaleChildren(kids, now.w / Math.max(1, was.w), now.h / Math.max(1, was.h));
}

/**
 * The parts a step may be aimed at. A step can name a part anywhere in the document, not only on the
 * page its own part stands on: a pickup on one page fills a slot in the bag on another, and the two
 * are the same prototype. The page is carried along because two pages can each hold a "Bag slot" —
 * the list has to say which one it means — and the parts of the page in play come first, since that
 * is where an author usually aims.
 *
 * A board's own cells are left out: they are the board's slots rather than parts of a screen. What
 * is left out too is the part the step belongs to and everything it holds, which a step that leaves
 * `target` out already means.
 */
export type RuleTarget = { id: string; name: string; kind: Kind; where: string; item: Item };

export function ruleTargets(
  groups: Group[],
  frameIdOf: (groupId: string) => string | null,
  frameName: (frameId: string) => string,
  pageId: string | null,
  /** the part the step belongs to and everything it holds: a step that names nothing means it */
  except: Set<string>,
  nameOfPart: (it: Item) => string,
): RuleTarget[] {
  const here: RuleTarget[] = [];
  const away: RuleTarget[] = [];
  for (const g of groups) {
    const frameId = frameIdOf(g.id);
    const where = frameId ? frameName(frameId) : "";
    const mine = frameId !== null && frameId === pageId;
    for (const it of itemsOf([g])) {
      if (except.has(it.id) || isGridCell(it)) continue;
      const hit: RuleTarget = { id: it.id, name: nameOfPart(it), kind: it.kind, where, item: it };
      (mine ? here : away).push(hit);
    }
  }
  return [...here, ...away];
}

/* ---------- what a bound text reads ---------- */

/** The kinds whose value a text can read: the ones a visitor can move or choose. */
export const READOUT_KINDS: Kind[] = ["slider", "stepper", "progressBar", "linearProgress", "circularProgress", "rewardTrack", "select", "tabs", "sideTabs"];

/** Whether a part has a value worth showing beside it. */
export const hasReadout = (it: Item) => READOUT_KINDS.includes(it.kind) || !!it.switch || !!it.autoClose;

/** How many seconds a part's timer has left, from the count it was given and how long it has run.
 *  `undefined` when the part carries no timer at all. */
export function countdownLeft(autoClose: number | undefined, elapsed: number | undefined): number | undefined {
  if (!autoClose || autoClose <= 0) return undefined;
  return Math.max(0, Math.ceil(autoClose - Math.max(0, elapsed ?? 0)));
}

/** Whether a part a text reads is counting down rather than carrying a number. */
export const readsTimer = (it: Item | undefined | null) => !!it?.autoClose;

/** two digits, the way a clock writes them: 3 reads as 03 */
const pad2 = (n: number) => String(n).padStart(2, "0");

/** A count of seconds as a clock: 5 minutes reads as 05:00 and counts down, an hour keeps its hour.
 *  A text bound to a part with a timer shows this, so a screen can say how long the visitor has. */
export function clockText(totalSeconds: number): string {
  const all = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(all / 3600);
  const m = Math.floor((all % 3600) / 60);
  const s = all % 60;
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/* ---------- the function button's countdown ---------- */

/** The word a count of days ends with, in the author's own language: 6天 in Chinese, 6d in English. */
const DAY_UNIT: Record<Lang, string> = { ja: "日", en: "d", zh: "天", ko: "일" };

/** Whether the function button draws its second line at all. */
export const timerOn = (it: Pick<Item, "timer">) => !!it.timer;
/** How many units the countdown stands at: the author's number, held inside the ceiling so the
 *  slider that edits it and the line that draws it can never disagree about the top of the range. */
export const timerValueOf = (it: Pick<Item, "timerValue">) => timerCount(it.timerValue ?? TIMER_DEF_VALUE);
/** Which unit that count is in. */
export const timerUnitOf = (it: Pick<Item, "timerUnit">) => (isTimerUnit(it.timerUnit) ? it.timerUnit : TIMER_DEF_UNIT);

/** The kinds whose fill row ends with the free colour disc (see `TokenChips`' `custom`): a part whose
 *  surface is its whole look can wear a colour of the author's own, and that colour is one chip among
 *  the roles rather than a control on a line of its own. */
export const FILL_CUSTOM_KINDS: Kind[] = ["itemCell", "assetPill"];

/** The kinds whose properties hold nothing to do with a clock: no 定时关闭 row is offered for them at
 *  all. A readout is not a part that puts itself away — but one a stored document already gave a time
 *  to keeps the row, so that time can still be taken away (see `hidesAutoClose`). */
export const NO_AUTO_CLOSE_KINDS: Kind[] = ["itemCell", "assetPill"];
/** Whether this part hides the 定时关闭 row the inspector gives every other kind. */
export const hidesAutoClose = (it: Pick<Item, "kind" | "autoClose">) =>
  NO_AUTO_CLOSE_KINDS.includes(it.kind) && it.autoClose === undefined;

/** The kinds whose countdown the inspector and the phone sheet edit: the function button, and nothing
 *  else. One list, because a part that has no countdown must not be offered one — an item cell's
 *  properties are its picture, its count, its marks and its name. */
export const TIMED_KINDS: Kind[] = ["fnButton"];
export const hasTimer = (it: Pick<Item, "kind">) => TIMED_KINDS.includes(it.kind);

/** Whether a count in this unit is drawn to the second. Minutes and seconds are; days and hours are
 *  not, because a part flickering through the seconds of six days reads as a clock rather than as the
 *  count the author set — and a line without seconds has nothing to tick. */
export const timerTicks = (unit: TimerUnit) => unit === "minute" || unit === "second";

/** How many count units a value stands for, in seconds: what the ticking units run down from. */
export const timerSeconds = (value: number | undefined, unit: TimerUnit): number => timerCount(value) * TIMER_SECONDS[unit];

/**
 * What is left of a countdown after `elapsed` seconds have run, in seconds — or `null` for the units
 * that do not tick. It is pure: the caller hands the time in, which is what keeps the ticking out of
 * the document and lets one second hand drive every part on the screen.
 */
export function timerLeft(value: number | undefined, unit: TimerUnit, elapsed: number): number | null {
  if (!timerTicks(unit)) return null;
  /* a broken elapsed time counts as none: one bad frame must not blank a line the author set */
  const run = Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed)) : 0;
  return Math.max(0, timerSeconds(value, unit) - run);
}

/** a count of seconds as mm:ss: minutes run on past the hour rather than growing an hours field,
 *  because this line counts down and is not the time of day. */
const msText = (totalSeconds: number) => {
  const all = Math.max(0, Math.round(totalSeconds));
  return `${pad2(Math.floor(all / 60))}:${pad2(all % 60)}`;
};

/** a count of seconds as hh:mm: an hour's line leaves the seconds out, and the hours run on past a
 *  day rather than wrapping, so the number always says what the author set. */
const hmText = (totalSeconds: number) => {
  const all = Math.max(0, Math.round(totalSeconds));
  return `${pad2(Math.floor(all / 3600))}:${pad2(Math.floor((all % 3600) / 60))}`;
};

/**
 * A countdown as the one line under the function name. Days keep the day they are counted in — 6天 —
 * because "06:00:00" for six days reads as a time of day; an hour is hh:mm, and minutes and seconds are
 * mm:ss and run down as the visitor watches (`elapsed` is how long the part has been on screen).
 *
 * It is a pure formatter: the elapsed time is handed in, so the canvas, the export and the preview all
 * draw the same line from the same document, and nothing here reads a clock or writes one back.
 */
export function timerText(value: number | undefined, unit: TimerUnit, lang: Lang = getLang(), elapsed = 0): string {
  const n = timerCount(value);
  if (unit === "day") return `${n}${DAY_UNIT[lang] ?? DAY_UNIT.en}`;
  if (unit === "hour") return hmText(n * TIMER_SECONDS.hour);
  return msText(timerLeft(n, unit, elapsed) ?? 0);
}

/** The second line of a function button, or `null` while its timer is off: the line is left out rather
 *  than drawn empty, which is what the renderer and the height both read. */
export const countdownLine = (it: Item, lang: Lang = getLang(), elapsed = 0): string | null =>
  timerOn(it) ? timerText(timerValueOf(it), timerUnitOf(it), lang, elapsed) : null;

/** How many lines of words the part actually draws: its name when it has one, and its countdown while
 *  the timer is on. An empty line is not drawn and takes no room, so the part is exactly as tall as
 *  what it says — the geometry (`sizeOf`) and the drawing both come through here. */
export const fnButtonLines = (it: Item): number => ((it.label ?? "").trim() ? 1 : 0) + (timerOn(it) ? 1 : 0);

/**
 * The ink a function button's own name is drawn with: the colour the author chose (a role or a colour
 * of their own), or the `onSurface` every line of the part has always used. This is **the first line
 * only** — the countdown under it keeps `onSurface`, so a colour on the name cannot bleed into the
 * time (see FnButtonContent).
 */
export const fnButtonNameInk = (it: Item, p: Palette): string => (it.textColor ? roleColor(it.textColor, p) : p.onSurface);

/** The circle a function button draws: its own width, or whatever a pinned height leaves once the
 *  lines have taken their room. The drawing, the corner it is given and the badge that sits on it all
 *  measure the button with this one function, so none of them can drift from the others. */
export const fnButtonCircle = (it: Item, width = it.size ?? KIND_SPEC.fnButton.defSize ?? KIND_SPEC.fnButton.w): number => {
  const lines = fnButtonLines(it);
  return Math.max(8, Math.min(width, (it.size2 ?? fnButtonHeight(width, lines)) - FN_BUTTON_LINE * lines));
};

/* ---------- the badge on a function button's corner ---------- */

/** Whether a part wears the corner mark it can be given: a function button's badge, an item cell's
 *  top-right one. (A navigation destination's own `badge` is a different thing — that one is the
 *  words, this one is the switch.) */
export const badgeOn = (it: Pick<Item, "badge">) => !!it.badge;
/** What that badge says. Empty is a state of its own: the bare dot a "new" mark is. */
export const badgeTextOf = (it: Pick<Item, "badgeText">) => (it.badgeText ?? "").trim();
/** The item cell's other corner mark, on the top-left: whether it is drawn, what it says and the
 *  colour of the pill — a palette role, a #rrggbb literal, or unset for the theme's own role. */
export const badge2On = (it: Pick<Item, "badge2">) => !!it.badge2;
export const badge2TextOf = (it: Pick<Item, "badge2Text">) => (it.badge2Text ?? "").trim();
export const badge2ColorOf = (it: Pick<Item, "badge2Color">) => (isCustomColor(it.badge2Color) ? it.badge2Color : undefined);
/** 任务信息条第一条角标（格子左上角）的颜色：角色或作者自己的 #rrggbb，读不出来的算没设
 *  （和上面 `badge2Color` 同一条规则、同一个 `isCustomColor`）。 */
export const badgeColorOf = (it: Pick<Item, "badgeColor">) => (isCustomColor(it.badgeColor) ? it.badgeColor : undefined);


/** Whether a part's own number carries its percent sign: unset is yes, `false` is the author saying
 *  the number stands on its own. */
export const unitOf = (it: Item) => it.unit !== false;

/**
 * The value of a part as one line of text: a number with its percent sign for the controls a visitor
 * moves, the chosen option for a row, and on or off for a switch. `live` is what the visitor has
 * moved it to, which is what makes a text bound to a slider follow the drag as it happens.
 *
 * `unit` is false when the value is read *into* a text the author wrote: there the number stands on
 * its own, because the words around it belong to the author — "%" on the slider is a switch of its
 * own (`Item.unit`), not something every sentence about the number has to carry.
 */
export function readoutOf(it: Item, live?: number, lang?: Lang, unit = true): string {
  const words = { on: { ja: "オン", en: "On", zh: "开", ko: "켜짐" }, off: { ja: "オフ", en: "Off", zh: "关", ko: "꺼짐" } };
  const pick = (w: { ja: string; en: string; zh: string; ko: string }) => w[lang ?? getLang()];
  if (isTabRow(it) || it.kind === "select") {
    const tabs = it.tabs ?? [];
    return tabs[tabIndexOf(it)]?.label.trim() || "—";
  }
  if (it.switch) return pick(it.checked ? words.on : words.off);
  /* A part counting its own timer down reads as a clock: the canvas has no running clock, so it
     shows the whole time the part was given — 05:00 for the container that closes in five minutes —
     and the preview counts it down from there. */
  if (it.autoClose) return clockText(it.autoClose);
  const v = clampValue(live ?? it.value ?? 0, maxOf(it));
  return unit && unitOf(it) ? `${v}%` : `${v}`;
}

/** Where the author's own words take a bound part's value: `出售数量： {v} / 10000`. The aliases are
 *  there because the token is typed into a Chinese, Japanese or English sentence alike. */
export const VALUE_TOKEN = "{v}";
const VALUE_TOKENS = /\{(?:v|value|值|数值|값)\}/i;

/** Whether the author's words already say where the value goes: the editor offers to add the token
 *  only when they do not, so one press cannot leave a line with two of them. */
export const hasValueToken = (label: string) => VALUE_TOKENS.test(label);

/**
 * The author's words with the value in them: the number lands where they wrote `{v}`, and a text that
 * never wrote one gets the value after its words, which is what an author who wants both gets without
 * having to learn the token first.
 */
export function mixText(label: string, value: string): string {
  return hasValueToken(label) ? label.replace(new RegExp(VALUE_TOKENS.source, "gi"), () => value) : `${label} ${value}`.trim();
}

/**
 * What a text that reads another part shows: the value alone, or — when the author asked for both
 * (`Item.mix`) — their own words with the value inside them.
 */
export function readText(reader: Item, value: string): string {
  return reader.mix ? mixText(reader.label ?? "", value) : value;
}

/* ---------- slot grids ---------- */

/** The frame's own inset around the child frame, and the child frame's inset around its cells. */
export const GRID_PAD = 10;
export const GRID_PANEL_PAD = 8;
/** What a cell measures before the author says otherwise, and how far the size may be pushed. */
export const CELL_DEF = 56;
export const CELL_MIN = 24;
export const CELL_MAX = 160;
/** The room one cell's item name takes under it: a board that shows names adds this to the row
 *  pitch, so the interval between two rows is the author's own cell gap — plus exactly this, which
 *  is what keeps the words of one row off the cells of the next. */
export const CELL_NAME_H = 14;
/** What that name is set in: small enough to sit under a 56dp cell without crowding it. */
export const CELL_NAME_FONT = 10;
/** How many cells the author may ask for on each axis: more than this is not a game board. */
export const COLS_MAX = 12;
export const ROWS_MAX = 30;

export const clampCell = (n: number) => Math.max(CELL_MIN, Math.min(CELL_MAX, Math.round(n)));
/** The size of one cell: the same whatever the frame measures, which is the point of the part. */
export const cellOf = (it: Item): number => clampCell(it.cell ?? CELL_DEF);
/** The room between two cells: a share of the cell, so one control changes the whole board. */
export const cellGap = (cell: number): number => Math.max(4, Math.round(cell * 0.16));
export const cellRadius = (): number => Math.max(4, scaleR(10));
export const panelRadius = (): number => Math.max(8, scaleR(18));

/** How far above its cell the checkbox over that cell rides. Ten is what makes the whole thing work
 *  with the one layer control the editor already has: a part dropped into a cell lands one layer
 *  above that cell, so the box is over anything the author puts in — and raising a part past
 *  `cell + 10` (`21` and up at the default level) is how they say they want it over the box instead.
 *  A board the author lifts carries its cells and their boxes up together, so the boxes stay on top
 *  of their own cells whatever the board's own layer is. */
export const GRID_CHECK_LIFT = 10;
/** The layer a cell's checkbox is drawn at: its cell's own, ten above it. At the default level that
 *  is layer 20, which is the number the inspector shows the author. */
export const gridCheckZ = (cell: Item): number => layerOf(cell) + GRID_CHECK_LIFT;

/** Which slot a cell sits in, written as one key so a cell can be looked up by its place. */
export const cellKey = (col: number, row: number) => `${col}:${row}`;
export const cellSlot = (it: Item): { col: number; row: number } | null =>
  Number.isFinite(it.cellCol) && Number.isFinite(it.cellRow) ? { col: it.cellCol!, row: it.cellRow! } : null;
/** Whether a part is one of a board's cells rather than something an author drew. */
export const isGridCell = (it: Item) => cellSlot(it) !== null;

/**
 * One cell of a board: a small container box the author can put parts in. It is a plain box in every
 * other way — the canvas, the layers panel and the preview all treat it as one — and its look is
 * written down when it is made so that a cell the author has restyled stays as they left it.
 */
export function cellBox(col: number, row: number, cell: number, at: { x: number; y: number }, floor = LAYER_DEFAULT): PlacedItem {
  const r = cellRadius();
  return {
    ...makeItem("box"),
    name: `${t("gridCells")}${row + 1}-${col + 1}`,
    cellCol: col,
    cellRow: row,
    x: at.x,
    y: at.y,
    size: cell,
    size2: cell,
    /* A cell is drawn inside its board, and a child that sits below its parent is not drawn at all:
       a board the author lifted — or one that was nested, which lifts it — would otherwise hide
       every cell it has. */
    ...(floor > LAYER_DEFAULT ? { z: floor } : {}),
    radiusTop: r,
    radiusBottom: r,
    fill: "surfaceContainerLow",
    /* a hairline inside the cell, so an empty board still reads as a grid of cells */
    strokeWidth: 1,
    strokeColor: "outlineVariant",
  };
}

/**
 * The cells a board holds: one per slot, in reading order, each carrying whatever the author put in
 * it. A cell keeps its place by its slot rather than by its own x and y, so resizing the frame, or
 * changing the cell size, moves every cell without any of them losing what it holds — and a slot
 * that has just come into being gets an empty cell waiting in it.
 *
 * Nothing is ever thrown away here: a cell that holds something pushes the board out to reach it
 * (`slotGrid` reads the used slots), so shrinking a frame hides nothing the author made.
 */
export function gridCells(it: Item, widths: Record<string, number>): PlacedItem[] {
  const g = slotGrid(it, widths);
  const floor = layerOf(it);
  const held = new Map<string, PlacedItem>();
  const loose: PlacedItem[] = [];
  for (const c of it.children ?? []) {
    const slot = cellSlot(c);
    if (slot) held.set(cellKey(slot.col, slot.row), c);
    /* a child that claims no slot is left alone: a hand-written document may hold one */
    else loose.push(c);
  }
  const out: PlacedItem[] = [];
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      const at = g.cellAt(col, row);
      const have = held.get(cellKey(col, row));
      if (!have) {
        out.push(cellBox(col, row, g.cell, at, floor));
        continue;
      }
      /* A cell that has fallen below its board — the board was lifted after the cell was made, or
         nested with its cells already in it — is raised, and everything it holds comes with it. */
      const base = layerOf(have) < floor ? liftAbove(have, floor) : have;
      const same = base === have && base.x === at.x && base.y === at.y && base.size === g.cell && base.size2 === g.cell && base.cellCol === col && base.cellRow === row;
      out.push(same ? have : { ...base, cellCol: col, cellRow: row, x: at.x, y: at.y, size: g.cell, size2: g.cell });
    }
  }
  return [...out, ...loose];
}

/**
 * Every board in a document laid out: a document written before cells were containers holds boards
 * that were only drawn, and a board may arrive from a file with no cells at all. Reading is when
 * both are put right, so nothing downstream has to wonder whether a board has its slots.
 */
/**
 * Panels of a row an older build drew come back named: a panel is scaffolding, and one with no name
 * of its own reads in the layers list as another container the author made — a row they cannot
 * remove, because a row's panels are known by their place and come straight back. A panel the
 * author has named is left exactly as it is.
 */
export function syncTabPanels(groups: Group[]): Group[] {
  const walk = (it: Item): Item => {
    const kids = it.children?.map(walk) as PlacedItem[] | undefined;
    let next: Item = kids ? { ...it, children: kids } : it;
    if (!isTabRow(next)) return next;
    next = foldOrphanPanels(next);
    const patch = tabPanelsPatch(next);
    if (patch) next = { ...next, ...patch };
    /* A panel's box is the row's: the room under the strip, the row's own width. A panel an older
       build left with a box of its own — one that covers the tab strip, or reaches past the row —
       takes the author's aim away from the tabs and puts a drop inside a panel that cannot be seen.
       Fitting it here is the same thing a resize does, so the row and its panels always agree. */
    const size = sizeOf(next, {});
    return nameOneRow({ ...next, children: fitTabPanels((next.children ?? []) as PlacedItem[], next, size.w, size.h, layerOf(next)) });
  };
  return groups.map((g) => ({ ...g, items: g.items.map(walk) }));
}

/** How far a part may be turned: past half a turn it is the same picture again, and the control is
 *  easier to aim than a circle that keeps going. */
export const ROT_MAX = 180;
/** The turn a part stands at, in degrees: what the author set, brought into range. */
export const rotOf = (it: Item) => Math.max(-ROT_MAX, Math.min(ROT_MAX, Math.round(it.rot ?? 0)));
/** The turn as a transform, so the canvas, the preview and an export draw it the same way. Unset
 *  means no transform at all, which keeps a part that is not turned free of one. */
export const rotStyle = (it: Item): string | undefined => (rotOf(it) ? `rotate(${rotOf(it)}deg)` : undefined);

/** Whether a part is the panel of a tab: a box that stands for one destination of a tab row. */
export const isTabPanel = (it: Item | undefined): boolean => !!it?.panel;

/** One tab row with every unnamed panel named after the tab it stands for. */
function nameOneRow(it: Item): Item {
  if (!isTabRow(it)) return it;
  return {
    ...it,
    children: (it.children ?? []).map((c, i) => {
      /* a child of a tab row is that row's panel, whether or not the build that made it said so */
      const panel: PlacedItem = c.panel ? c : { ...c, panel: true };
      if (panel.name?.trim() || panel.kind !== "box") return panel;
      const words = (panel.label ?? "").trim() || (it.tabs?.[i]?.label ?? "").trim();
      return { ...panel, name: words ? `${t("tabPanel")} · ${words}` : `${t("tabPanel")} ${i + 1}` };
    }),
  };
}

export function namePanels(groups: Group[]): Group[] {
  const walk = (it: Item): Item => {
    const kids = it.children?.map(walk) as PlacedItem[] | undefined;
    if (!isTabRow(it) || !kids?.length) return kids ? { ...it, children: kids } : it;
    return {
      ...it,
      children: kids.map((c, i) => {
        if (c.name?.trim() || c.kind !== "box") return c;
        const words = (c.label ?? "").trim() || (it.tabs?.[i]?.label ?? "").trim();
        return { ...c, name: words ? `${t("tabPanel")} · ${words}` : `${t("tabPanel")} ${i + 1}` };
      }),
    };
  };
  return groups.map((g) => ({ ...g, items: g.items.map(walk) }));
}

export function withGridCells(groups: Group[]): Group[] {
  const one = (it: Item): Item => {
    const kids = it.children?.map(one) as PlacedItem[] | undefined;
    const next: Item = kids ? { ...it, children: kids } : it;
    return next.kind === "invGrid" ? { ...next, children: gridCells(next, {}) } : next;
  };
  return groups.map((g) => ({ ...g, items: g.items.map(one) }));
}

/** A part whose board has to answer the size it has just been given: a frame that changed size, or
 *  one carried to another screen, takes its cells with it. */
const regrid = (it: Item): Item => (it.kind === "invGrid" ? { ...it, children: gridCells(it, {}) } : it);

/**
 * A frame of cells: what the author asked for, laid out inside the box they drew.
 *
 * The two counts and the cell size are the author's, and how a box of this size answers them is what
 * makes the part general. A count left out follows the box, so enlarging the frame really adds cells
 * instead of stretching the ones already there; a count the author pins is kept, and when those rows
 * reach past the bottom of the frame the child frame simply grows taller and the frame scrolls over
 * it. Columns are the one thing that is capped: a row wider than the frame cannot be reached by
 * moving up and down, so a count that does not fit is drawn as the number that does. A slot that
 * holds a part is on the board whatever the counts say: the author's work is never hidden by a
 * resize, it just scrolls.
 */
export type SlotGrid = {
  /** how many cells across and down the frame draws */
  cols: number;
  rows: number;
  /** the cell size and the room between cells */
  cell: number;
  gap: number;
  /** the room a cell's own item name takes under it: the row pitch is this wider than the column
   *  pitch, and zero when the board shows no names */
  nameH: number;
  /** the child frame: the panel the cells sit on, in the part's own coordinates */
  panel: { x: number; y: number; w: number; h: number };
  /** where a cell's top-left corner sits, as an offset from the part's top-left corner */
  cellAt: (col: number, row: number) => { x: number; y: number };
  /** the cells the frame draws, and how many that is */
  count: number;
  /** whether the counts follow the frame rather than the author */
  autoCols: boolean;
  autoRows: boolean;
  /** the whole board: what a full row and a full column of cells measures */
  boardW: number;
  boardH: number;
  /** what the frame's content takes, which is what can be scrolled over */
  content: { w: number; h: number };
};

export function slotGrid(it: Item, widths: Record<string, number>): SlotGrid {
  const { w, h } = sizeOf(it, widths);
  const cell = cellOf(it);
  const gap = cellGap(cell);
  /* the child frame, and the room its cells have inside it */
  const view = { w: Math.max(cell, w - GRID_PAD * 2), h: Math.max(cell, h - GRID_PAD * 2) };
  const room = { w: Math.max(cell, view.w - GRID_PANEL_PAD * 2), h: Math.max(cell, view.h - GRID_PANEL_PAD * 2) };
  /* the room one cell's name takes under it: the rows are laid out with it folded into their pitch,
     so switching the names on moves the rows apart instead of drawing words over the next row */
  const nameH = it.cellNames ? CELL_NAME_H : 0;
  const fits = (span: number) => Math.max(1, Math.floor((span + gap) / (cell + gap)));
  const fitsRows = (span: number) => Math.max(1, Math.floor((span + gap) / (cell + gap + nameH)));
  const autoCols = it.gridCols === undefined;
  const autoRows = it.gridRows === undefined;
  /* the board reaches every cell that holds something, so a frame the author made smaller scrolls
     over the rest of the board rather than swallowing it */
  let usedCol = -1;
  let usedRow = -1;
  for (const c of it.children ?? []) {
    const slot = cellSlot(c);
    /* a cell the author ticked counts as used just as one holding a part does: a tick is something
       they made, and a frame made smaller must scroll to it rather than quietly drop it */
    if (!slot || (!(c.children?.length ?? 0) && !c.checked)) continue;
    usedCol = Math.max(usedCol, slot.col);
    usedRow = Math.max(usedRow, slot.row);
  }
  /* a count the author pins is still capped by the room one row has: moving up and down cannot
     reach a column that is off the side, so the frame draws the ones that are on it */
  const wanted = autoCols ? fits(room.w) : Math.min(Math.round(it.gridCols!), fits(room.w));
  const cols = Math.max(1, Math.min(COLS_MAX, Math.max(wanted, usedCol + 1)));
  const rows = Math.max(1, Math.min(ROWS_MAX, Math.max(autoRows ? fitsRows(room.h) : Math.round(it.gridRows!), usedRow + 1)));
  const boardW = cols * cell + (cols - 1) * gap;
  /* the board is as tall as its rows and the names under them: the last row's name belongs to the
     board too, or it would hang outside the panel it sits on */
  const boardH = rows * cell + (rows - 1) * gap + rows * nameH;
  const panel = {
    x: GRID_PAD,
    y: GRID_PAD,
    w: Math.max(view.w, boardW + GRID_PANEL_PAD * 2),
    h: Math.max(view.h, boardH + GRID_PANEL_PAD * 2),
  };
  const left = panel.x + Math.round((panel.w - boardW) / 2);
  const top = panel.y + GRID_PANEL_PAD;
  return {
    cols,
    rows,
    cell,
    gap,
    nameH,
    panel,
    cellAt: (col, row) => ({ x: left + col * (cell + gap), y: top + row * (cell + gap + nameH) }),
    count: cols * rows,
    autoCols,
    autoRows,
    boardW,
    boardH,
    content: { w, h: GRID_PAD * 2 + panel.h },
  };
}

/** How much room a scrolling container's content takes, measured from its top-left corner. */
export function scrollContent(it: Item, widths: Record<string, number>): { w: number; h: number } {
  /* a slot grid brings its own content: its cells are drawn rather than held, so a frame with no
     children at all still has something to move */
  if (it.kind === "invGrid") return slotGrid(it, widths).content;
  let w = 0;
  let h = 0;
  for (const c of it.children ?? []) {
    const s = sizeOf(c, widths);
    /* a folded navigation part inside is drawn at its corner, so its place counts from there */
    const f = foldPlace(c, widths);
    w = Math.max(w, c.x + f.dx + s.w);
    h = Math.max(h, c.y + f.dy + s.h);
  }
  return { w, h };
}

/** How far a scrolling container's content can move on each axis: nothing when it fits. */
export function scrollRange(it: Item, widths: Record<string, number>): { x: number; y: number } {
  if (!it.scroll) return { x: 0, y: 0 };
  const view = sizeOf(it, widths);
  const content = scrollContent(it, widths);
  return {
    x: it.scroll === "x" || it.scroll === "both" ? Math.max(0, Math.round(content.w - view.w)) : 0,
    y: it.scroll === "y" || it.scroll === "both" ? Math.max(0, Math.round(content.h - view.h)) : 0,
  };
}

/**
 * Where a scrolling container's content is drawn: what the visitor has moved it to when the preview is
 * live, otherwise the offset the author designed, never negative and never past the content's end.
 */
export function scrollOffset(
  it: Item,
  widths: Record<string, number>,
  live?: { x?: number; y?: number },
): { x: number; y: number } {
  if (!it.scroll) return { x: 0, y: 0 };
  const range = scrollRange(it, widths);
  const at = { ...it.scrollPos, ...live };
  const clamp = (v: number | undefined, max: number) => Math.max(0, Math.min(max, Math.round(v ?? 0)));
  return { x: clamp(at.x, range.x), y: clamp(at.y, range.y) };
}

/** The children patch a tab rename carries: a panel still named after its tab follows it, and one the
 *  author has named themselves is left alone. */
export function tabRenamePatch(it: Item, i: number, label: string): Pick<Item, "children"> | null {
  const panel = isTabRow(it) ? it.children?.[i] : undefined;
  if (!panel || panel.label !== (it.tabs?.[i]?.label ?? "")) return null;
  return { children: it.children!.map((c, j) => (j === i ? { ...c, label } : c)) };
}

/** how a tab row reads: M3's underline, or buttons — which is how most games switch pages. */
export type TabStyle = "underline" | "buttons";
export const TAB_STYLES: { key: TabStyle; icon: string }[] = [
  { key: "underline", icon: "border_bottom" },
  { key: "buttons", icon: "buttons_alt" },
];
export const isTabStyle = (v: unknown): v is TabStyle => v === "underline" || v === "buttons";
export const tabStyleOf = (it: Item): TabStyle => (isTabStyle(it.tabStyle) ? it.tabStyle : "underline");

/** Which tab is in front. A tab row draws one panel, and this is the one. */
export const tabIndexOf = (it: Item) => Math.min(Math.max(0, it.selected ?? 0), Math.max(0, (it.tabs?.length ?? 1) - 1));

/** The panel of the tab in front, when the row has one. */
export const tabPanelId = (it: Item): string | null => it.children?.[tabIndexOf(it)]?.id ?? null;

/**
 * The panels a tab row keeps when the tab at `gone` leaves it. The panel of that tab is the editor's
 * own scaffolding while it is empty, so it goes with its tab; one the author has already put
 * something in is kept and moved to the end, where it has no tab to bring it forward and the review
 * says so — losing the author's work to a tab count would be much worse than an orphan panel.
 */
function withoutPanel(kids: PlacedItem[] | undefined, gone: (j: number, count: number) => boolean): PlacedItem[] | undefined {
  if (!kids?.length) return undefined;
  const kept: PlacedItem[] = [];
  const orphans: PlacedItem[] = [];
  kids.forEach((panel, j) => {
    if (!gone(j, kids.length)) kept.push(panel);
    else if ((panel.children?.length ?? 0) > 0) orphans.push(panel);
  });
  return [...kept, ...orphans];
}

/**
 * A tab row with more panels than tabs: the extra ones are panels a removed tab left behind, kept so
 * the work in them is not lost — but nothing can ever show them. The row draws the panel of the tab in
 * front, and a panel with no tab behind it can never be that one, so anything dropped into it (it is
 * listed, and it takes a drop like any other container) is invisible for good.
 *
 * Their contents move into the panel of the tab in front, where the author can see and reach them
 * again, and the empty shells go. A row with nothing to fold is handed back as it is.
 */
export function foldOrphanPanels(it: Item): Item {
  const tabs = it.tabs ?? [];
  const kids = it.children ?? [];
  if (!isTabRow(it) || tabs.length === 0 || kids.length <= tabs.length) return it;
  const front = tabIndexOf(it);
  const moved = kids.slice(tabs.length).flatMap((panel) => panel.children ?? []);
  if (moved.length === 0) return { ...it, children: kids.slice(0, tabs.length) };
  return {
    ...it,
    children: kids.slice(0, tabs.length).map((panel, i) =>
      i === front ? { ...panel, children: [...(panel.children ?? []), ...moved.map((c) => liftAbove(c, layerOf(panel) + 1))] as PlacedItem[] } : panel,
    ),
  };
}

/** Whether a container draws a child of its own: a tab row keeps only the panel of the tab in front,
 *  which is what makes switching tabs switch the page under them. */
export const childDrawn = (parent: Item, child: Item, index: number) => childShown(parent, child) && (!isTabRow(parent) || index === tabIndexOf(parent));

/**
 * Every part the canvas actually draws, found by walking the tree the way the canvas draws it: a
 * child that sits below its container is not drawn, and a tab row draws only the panel of the tab in
 * front.
 *
 * A part that is not drawn is not a place a drop can land either. Two panels of one tab row stand at
 * the same place, so a drag inside the panel on show would otherwise find the panel of the tab behind
 * it — smaller, and just as close under the pointer — take the part into it, and the part would leave
 * the screen and its own row behind without a word.
 */
export function drawnIds(items: Item[]): Set<string> {
  const out = new Set<string>();
  const walk = (it: Item) => {
    out.add(it.id);
    (it.children ?? []).forEach((c, i) => {
      if (childDrawn(it, c, i)) walk(c);
    });
  };
  items.forEach(walk);
  return out;
}

/** how far a scrollable tab row is shifted left so the selected tab is in view with half of the
 *  next one peeking in; the drawing and the preview's hit areas share it, so a tap lands on the tab that is shown */
export function tabScrollOffset(it: Item, width: number): number {
  if (!isScrollableTabs(it)) return 0;
  const n = it.tabs?.length ?? 0;
  const sel = Math.min(it.selected ?? 0, Math.max(0, n - 1));
  const max = Math.max(0, n * SCROLL_TAB_W - width);
  return Math.max(0, Math.min(max, (sel + 1.5) * SCROLL_TAB_W - width));
}
/** a toolbar hugs its icon buttons: 48dp each with 4dp between, 8dp at the ends */
export const toolbarWidth = (it: Item) => {
  const n = Math.max(1, it.tabs?.length ?? 0);
  return 16 + n * 48 + (n - 1) * 4;
};

export const connectSpecOf = (it: Item): ConnectSpec | undefined => {
  const c = specOf(it).connect;
  return c && { ...c, outer: scaleR(c.outer), inner: scaleR(c.inner) };
};
export const connectable = (it: Item) => !!specOf(it).connect;
/** two parts fuse when they share an axis and a family (buttons and icon buttons mix) */
export const canJoin = (a: Item, b: Item) => {
  const sa = connectSpecOf(a);
  const sb = connectSpecOf(b);
  return !!sa && !!sb && sa.axis === sb.axis && sa.family === sb.family;
};

/* ---------- icon slots ---------- */
export type IconSlot = { key: string; label: string; value: string | null };

export function iconSlotsOf(it: Item): IconSlot[] {
  switch (it.kind) {
    case "assetPill":
      /* an amount on a capsule: the mark it was drawn with on the left, and one the author may add on
         the right (unset is no right-hand mark at all) */
      return [
        { key: "icon", label: t("leftIcon"), value: it.icon },
        { key: "icon2", label: t("rightIcon"), value: it.icon2 ?? null },
      ];
    case "taskBar":
      /* 任务信息条只剩一个图标槽了：按钮右上角那枚徽标里的图标（作者要的"比如锁的图标"）。奖励格
         画的是那个固定的默认图标（TASK_BAR_ICON），没有可改的槽，所以这里不再有 `icon` 那一项 ——
         面板里也就没有"奖励图标"那一行。槽走的是别处一样的那个选择器（见 setIconSlot 的
         buttonBadgeIcon 一档）。 */
      return [{ key: "buttonBadgeIcon", label: t("barBadgeIcon"), value: it.buttonBadgeIcon ?? null }];
    case "listItem":
    case "topAppBar":
    case "searchBar":
      return [
        { key: "icon", label: t("leading"), value: it.icon },
        { key: "icon2", label: t("trailing"), value: it.icon2 ?? null },
      ];
    case "bottomNav":
    case "navRail":
    case "toolbar":
    /* a tab row's icons are its destinations' own, exactly as a bar's are */
    case "tabs":
    case "sideTabs":
      return (it.tabs ?? []).map((t, i) => ({
        key: `tab:${i}`,
        label: `${i + 1}`,
        value: t.icon || null,
      }));
    default:
      return specOf(it).hasIcon
        ? [{ key: "icon", label: t("icon"), value: it.icon }]
        : [];
  }
}

export function setIconSlot(it: Item, key: string, v: string | null): Partial<Item> {
  if (key === "icon") return { icon: v };
  if (key === "icon2") return { icon2: v };
  /* 任务信息条按钮右上角那枚徽标里的图标：写进它自己的字段，徽标就由字变成图标（图标优先，见
     taskBarButtonBadgeIcon）。清掉就退回那两个字 —— 开关 `buttonBadge` 一动不动，它管的是字。 */
  if (key === "buttonBadgeIcon") return { buttonBadgeIcon: v };
  if (key === "toggle") return { toggle: { ...(it.toggle ?? {}), icon: v } };
  if (key.startsWith("tab:")) {
    const i = Number(key.slice(4));
    const tabs = (it.tabs ?? []).map((t, j) => (j === i ? { ...t, icon: v ?? "" } : t));
    return { tabs };
  }
  return {};
}
