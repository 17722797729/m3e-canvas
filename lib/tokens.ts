import type { CSSProperties } from "react";
import { FAB_MENU_TABS, GAME_NAV_TABS, KIND_TEXT, Lang, TAB_LABELS, getLang, t, SELECT_OPTIONS } from "./i18n";
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
  const itemW = RAIL_W - 12;
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

/* ---------- theme: the four expressive axes ---------- */
export type ShapeScale = "square" | "rounded" | "full";
export type FontKey = "roboto" | "robotoFlex" | "robotoSerif" | "system";
export type MotionScheme = "standard" | "expressive";
export type { Contrast };

export type Theme = {
  dark: boolean;
  /** the app follows the system setting; the canvas shows the mode chosen in `dark` */
  bothModes: boolean;
  contrast: Contrast;
  shape: ShapeScale;
  font: FontKey;
  /** headings and labels take the heavier M3 Expressive "emphasized" styles */
  emphasized: boolean;
  motion: MotionScheme;
};

export const DEFAULT_THEME: Theme = { dark: false, bothModes: false, contrast: "standard", shape: "rounded", font: "roboto", emphasized: false, motion: "standard" };

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
  const base = (key === "custom" && custom) || PALETTES.find((p) => p.key === key) || PALETTES[0];
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

export function variantShadow(v: Variant): string {
  if (v === "elevated") return "0 1px 3px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.10)";
  return "none";
}

/* ---------- component kinds ---------- */
export type Kind =
  | "box"
  | "invGrid"
  | "button"
  | "iconButton"
  | "fab"
  | "extendedFab"
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
  | "fabMenu"
  | "toolbar"
  | "tabs"
  | "radio"
  | "badge";

export type Axis = "x" | "y";
/** kinds that fuse into a run: buttons side by side, list items stacked */
export type ConnectSpec = { axis: Axis; outer: number; inner: number; family: string };

/** `presets` are quick picks shown as chips; values outside min..max are hidden */
export type SizeSpec = { min: number; max: number; step: number; icon: string; presets?: number[] };

export type Category = "actions" | "navigation" | "containment" | "inputs" | "content" | "progress";

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "actions", label: "Actions", icon: "touch_app" },
  { key: "navigation", label: "Navigation", icon: "explore" },
  { key: "containment", label: "Containment", icon: "web_asset" },
  { key: "inputs", label: "Inputs", icon: "toggle_on" },
  { key: "content", label: "Content", icon: "notes" },
  { key: "progress", label: "Progress", icon: "progress_activity" },
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
  /** carries a list of icon + label entries (navigation bar, tabs, FAB menu, toolbar) */
  hasTabs?: boolean;
  /** second dimension (height) for free-form boxes */
  size2?: SizeSpec;
  hasFill?: boolean;
  /** offers the scroll switch: the axes a container's content can be moved along */
  hasScroll?: boolean;
  hasValue?: boolean;
  hasWavy?: boolean;
  hasContained?: boolean;
  connect?: ConnectSpec;
  size?: SizeSpec;
  defLabel: string;
  defIcon: string | null;
  defSupporting?: string;
  defIcon2?: string;
  defSize?: number;
  defVariant?: Variant;
};

/** How tall a slider is: its track and handle, and the room above them for the number when the
 *  author asks the part to show one. */
export const SLIDER_H = 44;
export const SLIDER_VALUE_H = 64;

/** The smallest a part may be dragged to. Every part allows it, whatever it is: a prototype often
 *  needs a two-character-wide button or a thumbnail of a screen, and a part smaller than its content
 *  clips the way a real one does — refusing the size would only make the author fight the editor. */
export const SIZE_MIN = 20;

/** Kinds the palette no longer offers but a document may still hold: they stay readable so an older
 *  document opens, and the editor's reader turns them into what the palette offers instead. */
export const LEGACY_KINDS: Kind[] = ["sliderInput"];

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
  fabMenu: {
    label: "FAB Menu",
    noun: "FAB メニュー",
    category: "actions",
    paletteIcon: "add_circle",
    w: 220,
    h: 56,
    radius: 16,
    hasVariant: true,
    hasLabel: false,
    hasSupporting: false,
    hasIcon: true,
    hasTabs: true,
    size: { min: SIZE_MIN, max: CONTENT_W, step: 4, icon: "width", presets: [220, HALF_W, CONTENT_W] },
    defLabel: "",
    defIcon: "close",
    defSize: 220,
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
};

export const KIND_ORDER: Kind[] = [
  "button",
  "iconButton",
  "fab",
  "extendedFab",
  "splitButton",
  "fabMenu",
  "chip",
  "topAppBar",
  "bottomNav",
  "navRail",
  "toolbar",
  "tabs",
  "searchBar",
  "card",
  "listItem",
  "box",
  "invGrid",
  "dialog",
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
];

/* ---------- screen data ---------- */
export type NavTab = {
  icon: string;
  label: string;
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
  /** cards: where the image area sits — the top when unset, a full-height side column, or the whole background behind the text */
  imagePos?: CardImagePos;
  /** cards: the image area's size in dp — its height on top, its width at a side; a background image fills the card */
  imageSize?: number;
  /** cards: where the text block sits vertically; unset means the top, or the bottom over a background image */
  contentAlign?: CardAlign;
  /** cards: a color role for the headline and body instead of the automatic one */
  textColor?: TextToken;
  /** on/off state for switches, checkboxes and chips */
  checked?: boolean;
  /** a switch whose handle stays plain when on, without the check icon */
  noCheck?: boolean;
  /** 0..100 for sliders and determinate progress; undefined = indeterminate */
  value?: number;
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
  /** A slot grid's cell: which column of the board it sits in. Its place is its slot rather than
   *  its own x and y, so the frame can be resized without the cell losing what it holds. */
  cellCol?: number;
  cellRow?: number;
  /** A text that reads another part instead of its own words: the id of the part whose value it
   *  shows — a volume slider's number beside the slider, live while the visitor drags it. */
  shows?: string;
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
  /** The top of a slider's or a stepper's range: unset is a hundred, which is what a percentage
   *  stops at, while "出售数量 … / 10000" wants a ceiling of its own. Drag, the number on the part,
   *  the ＋/− buttons and the numbers a rule adds all stop here. */
  max?: number;
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

/** The part as one of its looks draws it: the drawn part with the node's own fields on top. */
export function lookItem(it: Item, look: PartLook | undefined): Item {
  if (!look) return it;
  let out = it;
  if (look.label !== undefined && look.label !== it.label) out = { ...out, label: look.label };
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
      Object.values(it.slotFlows ?? {}).some((f) => f.steps.some(isTimedStep)) ||
      (it.children ? hasTimedSteps(it.children) : false),
  );
}

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
        .filter((a) => a.kind === "goto" || a.kind === "back" || a.kind === "close" || a.kind === "look")
        /* a look was once able to restyle the part it aims at: that choice is gone */
        .map((a) => (a.kind === "look" && a.variant !== undefined ? { kind: "look" as const, target: a.target, icon: a.icon, label: a.label, color: a.color } : a));
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
    const flow = tidy(madeFlow ?? it.flow);
    const slotFlows = Object.entries(madeSlots ?? it.slotFlows ?? {}).reduce<Record<string, PartFlow>>((acc, [key, machine]) => {
      const kept = tidy(machine);
      if (kept) acc[key] = kept;
      return acc;
    }, {});
    const hadSlots = Object.keys(it.slotFlows ?? {}).length > 0;
    const blank = _rules === undefined && states === undefined && slotStates === undefined && flow === it.flow && !hadSlots && nested === it.children;
    /* nothing to read back: the part itself, untouched, so an untouched document keeps its identity */
    if (blank) return it;
    return {
      ...rest,
      ...(nested ? { children: nested } : {}),
      ...(flow ? { flow } : {}),
      ...(Object.keys(slotFlows).length ? { slotFlows } : {}),
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
  if ((it.kind === "tabs" || it.kind === "select") && (it.tabs?.length ?? 0) > 0) out.push("selected");
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
export const SHAPED: Kind[] = ["button", "iconButton", "fab", "extendedFab"];
/** the shapes a kind that is a circle by nature — an icon button, a FAB — can take */
export const ROUND_SHAPES: { key: ButtonShape; icon: string }[] = [
  { key: "round", icon: "circle" },
  { key: "square", icon: "square" },
];
/** whether a kind wears a circle unless the author asks for a square */
export const roundByNature = (kind: Kind) => kind === "iconButton" || kind === "fab";
export const isButtonShape = (v: unknown): v is ButtonShape => BUTTON_SHAPES.some((x) => x.key === v);

export type PlacedItem = Item & { x: number; y: number };

/** The axes a container's content can be moved along. A container without one holds still. */
export type ScrollAxis = "x" | "y" | "both";

/** kinds that can act as a toggle button in the preview */
export const TOGGLEABLE: Kind[] = ["button", "iconButton", "fab", "extendedFab"];

/** target id that pops the preview stack instead of opening a frame */
export const BACK_TARGET = "back";

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

export type Transition = "slide" | "slideLeft" | "slideUp" | "slideDown" | "fade" | "expand" | "none";
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
  { key: "expand", label: "Expand", icon: "open_in_full" },
  { key: "none", label: "None", icon: "block" },
];

/** slots on a bar that can each carry their own tap action */
export function actionSlotsOf(it: Item): IconSlot[] {
  if (it.kind === "topAppBar" || it.kind === "bottomNav" || it.kind === "navRail" || it.kind === "toolbar") return iconSlotsOf(it).filter((s) => !!s.value);
  if (it.kind === "fabMenu") return (it.tabs ?? []).map((t, i) => ({ key: `tab:${i}`, label: t.label || `${i + 1}`, value: t.icon || null }));
  if (it.kind === "tabs") return (it.tabs ?? []).map((t, i) => ({ key: `tab:${i}`, label: t.label || `${i + 1}`, value: null }));
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
export const TAPPABLE: Kind[] = ["button", "iconButton", "fab", "extendedFab", "chip", "listItem", "card", "image", "text", "splitButton", "radio"];

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
/** What a background field holds: a palette role, or nothing at all. */
export type FillToken = ColorToken | typeof TRANSPARENT;

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

/** The colour a background paints: a palette role, or nothing at all. */
export const fillColor = (t: FillToken | undefined, p: Palette, fallback: ColorToken): string => (t === TRANSPARENT ? "transparent" : p[t ?? fallback]);

/** The ink that reads on it: over no background at all, the page's own text colour. */
export const fillInk = (t: FillToken | undefined, p: Palette, fallback: ColorToken): string => (t === TRANSPARENT ? p.onSurface : onToken(t ?? fallback, p));

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
/** the card's text color: the chosen role, else white over a photo, the container's
 *  "on" color over a placeholder background or a chosen fill, and onSurface otherwise */
export function cardTextColorOf(it: Item, p: Palette): string {
  const own = colorOverrideOf(it, p);
  if (own) return own.on;
  if (it.textColor) return p[it.textColor];
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
export const FULL_WIDTH: Kind[] = ["topAppBar", "bottomNav", "tabs"];

/** Kinds drawn to the width of what they say until the author gives them one. Their own width has to
 *  beat the measurement the canvas took of them, in `sizeOf` and in the renderer alike. */
export const AUTHOR_WIDTHS: Kind[] = ["switch", "button", "badge", "chip", "checkbox", "radio", "extendedFab", "splitButton"];

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
export function defaultTabsFor(kind: Kind): NavTab[] {
  switch (kind) {
    case "tabs":
      return TAB_LABELS[getLang()].map((label) => ({ icon: "", label }));
    case "select":
      return SELECT_OPTIONS[getLang()].map((label) => ({ icon: "", label }));
    case "fabMenu":
      return FAB_MENU_TABS[getLang()].map((t) => ({ ...t }));
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
  if (s.defIcon2 !== undefined) it.icon2 = s.defIcon2;
  if (s.defSize !== undefined) it.size = s.defSize;
  if (s.hasChecked) it.checked = kind !== "chip";
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
  if (kind === "tabs" || kind === "fabMenu" || kind === "select") it.tabs = defaultTabsFor(kind);
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
export const MEASURED: Kind[] = ["button", "extendedFab", "chip", "switch", "checkbox", "text", "splitButton", "radio", "badge"];

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
    case "button":
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
    case "fabMenu":
      return { w: n, h: 56 + (it.tabs?.length ?? 0) * (FAB_MENU_ITEM_H + FAB_MENU_GAP) };
    case "toolbar":
      return { w: it.size ?? toolbarWidth(it), h: it.size2 ?? s.h };
    case "tabs":
      return { w: n, h: it.size2 ?? s.h };
    case "text":
      return { w: widths[it.id] ?? 120, h: Math.round(n * 1.3) };
    case "iconButton":
    case "fab":
    case "circularProgress":
    case "loadingIndicator":
      return { w: n, h: n };
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
      return { w: n, h: it.size2 ?? s.h };
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
    case "tabs": {
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
    case "fabMenu":
      return uniformRadii(0);
    case "iconButton":
      /* a square is the author asking for one; otherwise an icon button is a circle, and keeps it
         whatever the document's shape scale says — exactly as a round FAB does */
      if (it.shape === "square") return uniformRadii(scaleR(8));
      return uniformRadii(Math.round((it.size ?? 48) / 2));
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

export const FAB_MENU_ITEM_H = 56;

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
  const children = it.kind === "tabs" ? withoutPanel(it.children, (j) => j === i) : undefined;
  return {
    tabs,
    selected,
    actions: remapTabActions(it.actions, (j) => (j === i ? undefined : j > i ? j - 1 : j)),
    ...(children ? { children } : undefined),
  };
}

/** the patch that sets the entry count: extra entries come from the defaults, and the tap targets of dropped entries go */
export function tabCountPatch(it: Item, n: number, defaults: NavTab[]): Pick<Item, "tabs" | "selected" | "actions" | "children"> {
  const cur = it.tabs ?? [];
  const tabs: NavTab[] = [];
  for (let i = 0; i < n; i++) tabs.push(cur[i] ? { ...cur[i] } : { ...defaults[i % defaults.length] });
  const children = it.kind === "tabs" ? withoutPanel(it.children, (j) => j >= n) : undefined;
  return {
    tabs,
    selected: it.selected !== undefined && it.selected >= n ? undefined : it.selected,
    actions: remapTabActions(it.actions, (j) => (j < n ? j : undefined)),
    ...(children ? { children } : undefined),
  };
}

/** Whether a tab row is still short of panels, or of the room to show them. Cheap enough to ask on
 *  every render: it allocates nothing, unlike the patch that fixes it. */
export const needsTabPanels = (it: Item) =>
  it.kind === "tabs" && (it.tabs?.length ?? 0) > 0 && ((it.children?.length ?? 0) < (it.tabs?.length ?? 0) || (it.size2 ?? TAB_ROW_H) < TAB_ROW_H + TAB_PANEL_H);

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

/** The empty panel a tab starts with: the row's own width, right under its tab strip. */
export function freshPanel(label: string, w: number, area: number): PlacedItem {
  return { ...makeItem("box"), label, x: 0, y: TAB_ROW_H, size: w, size2: area };
}

/**
 * The panels a tab row needs: one container per tab, in tab order, filling the area under the row. It
 * only ever adds what is missing and makes room for it, so pressing it twice changes nothing — and a
 * panel the author has already filled in is never touched. Panels past the last tab are left alone as
 * well: dropping one would be dropping the author's work.
 */
export function tabPanelsPatch(it: Item): Pick<Item, "children" | "size2"> | null {
  const tabs = it.tabs ?? [];
  if (it.kind !== "tabs" || tabs.length === 0) return null;
  const have = it.children ?? [];
  const area = panelArea(it);
  const w = sizeOf(it, {}).w;
  const children = have.length >= tabs.length ? have : [...have, ...Array.from({ length: tabs.length - have.length }, (_, k) => freshPanel(tabs[have.length + k].label, w, area))];
  const size2 = TAB_ROW_H + area;
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
  if (row.kind !== "tabs" || gone.length === 0) return out;
  const w = sizeOf(row, {}).w;
  const area = panelArea(row);
  /* from the back, so an insert never moves a place still to be filled */
  for (const at of [...new Set(gone)].sort((a, b) => b - a)) out.splice(at, 0, freshPanel(row.tabs?.[at]?.label ?? "", w, area));
  return out;
}

/**
 * The panel a box dropped on a tab row takes the place of: the empty panel of the tab the box is
 * named after, so a panel the author took out of the row goes back to its own tab. Null when no
 * panel is free — a panel with something in it is the author's work and is never overwritten.
 */
export function panelSlotFor(row: Item, part: Item): number | null {
  if (row.kind !== "tabs" || part.kind !== "box") return null;
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
  while (kids.length <= at) kids.push(freshPanel(row.tabs?.[kids.length]?.label ?? "", sizeOf(row, {}).w, panelArea(row)));
  kids[at] = liftAbove({ ...part, x: 0, y: TAB_ROW_H }, layerOf(row) + 1);
  const size = sizeOf(row, widths);
  return fitTabPanels(kids, size.w, size.h);
}

/** Panels follow their row when it is resized: the row keeps its height and the panels take what is
 *  left, rather than being stretched away from the row the way proportional scaling would. */
export const fitTabPanels = (panels: PlacedItem[], w: number, h: number): PlacedItem[] =>
  panels.map((c) => ({ ...c, x: 0, y: TAB_ROW_H, size: w, size2: Math.max(0, Math.round(h - TAB_ROW_H)) }));

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
    const geometry = "size" in patch || "size2" in patch || "cell" in patch || "gridCols" in patch || "gridRows" in patch || "z" in patch;
    return geometry ? gridCells({ ...before, ...patch }, widths) : undefined;
  }
  /* A cell the author lifts carries what it holds, for the same reason a board does: a part left
     sitting below its own container is not drawn at all. */
  if (isGridCell(before) && "z" in patch) {
    const next = { ...before, ...patch } as PlacedItem;
    return liftAbove(next, layerOf(next)).children;
  }
  if (!("size" in patch || "size2" in patch)) return undefined;
  const kids = patch.children ?? before.children;
  if (!kids?.length) return undefined;
  /* A scrolling container's size is its viewport: shrinking it hides content, it does not squash it,
     so its children keep the size they were drawn at. */
  if (before.scroll) return undefined;
  const next = { ...before, ...patch };
  if (before.kind === "tabs") {
    const now = sizeOf(next, widths);
    return fitTabPanels(kids, now.w, now.h);
  }
  const was = sizeOf(before, widths);
  const now = sizeOf(next, widths);
  return scaleChildren(kids, now.w / Math.max(1, was.w), now.h / Math.max(1, was.h));
}

/* ---------- what a bound text reads ---------- */

/** The kinds whose value a text can read: the ones a visitor can move or choose. */
export const READOUT_KINDS: Kind[] = ["slider", "stepper", "progressBar", "linearProgress", "circularProgress", "select", "tabs"];

/** Whether a part has a value worth showing beside it. */
export const hasReadout = (it: Item) => READOUT_KINDS.includes(it.kind) || !!it.switch;

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
  if (it.kind === "tabs" || it.kind === "select") {
    const tabs = it.tabs ?? [];
    return tabs[tabIndexOf(it)]?.label.trim() || "—";
  }
  if (it.switch) return pick(it.checked ? words.on : words.off);
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
  const fits = (span: number) => Math.max(1, Math.floor((span + gap) / (cell + gap)));
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
  const rows = Math.max(1, Math.min(ROWS_MAX, Math.max(autoRows ? fits(room.h) : Math.round(it.gridRows!), usedRow + 1)));
  const boardW = cols * cell + (cols - 1) * gap;
  const boardH = rows * cell + (rows - 1) * gap;
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
    panel,
    cellAt: (col, row) => ({ x: left + col * (cell + gap), y: top + row * (cell + gap) }),
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
  const panel = it.kind === "tabs" ? it.children?.[i] : undefined;
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

/** Whether a container draws a child of its own: a tab row keeps only the panel of the tab in front,
 *  which is what makes switching tabs switch the page under them. */
export const childDrawn = (parent: Item, child: Item, index: number) => childShown(parent, child) && (parent.kind !== "tabs" || index === tabIndexOf(parent));

/** how far a scrollable tab row is shifted left so the selected tab is in view with half of the
 *  next one peeking in; the drawing and the preview's hit areas share it, so a tap lands on the tab that is shown */
export function tabScrollOffset(it: Item, width: number): number {
  if (!isScrollableTabs(it)) return 0;
  const n = it.tabs?.length ?? 0;
  const sel = Math.min(it.selected ?? 0, Math.max(0, n - 1));
  const max = Math.max(0, n * SCROLL_TAB_W - width);
  return Math.max(0, Math.min(max, (sel + 1.5) * SCROLL_TAB_W - width));
}
export const FAB_MENU_GAP = 8;
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
      return (it.tabs ?? []).map((t, i) => ({
        key: `tab:${i}`,
        label: `${i + 1}`,
        value: t.icon || null,
      }));
    case "fabMenu":
      return [
        { key: "icon", label: t("icon"), value: it.icon },
        ...(it.tabs ?? []).map((t, i) => ({ key: `tab:${i}`, label: `${i + 1}`, value: t.icon || null })),
      ];
    default:
      return specOf(it).hasIcon
        ? [{ key: "icon", label: t("icon"), value: it.icon }]
        : [];
  }
}

export function setIconSlot(it: Item, key: string, v: string | null): Partial<Item> {
  if (key === "icon") return { icon: v };
  if (key === "icon2") return { icon2: v };
  if (key === "toggle") return { toggle: { ...(it.toggle ?? {}), icon: v } };
  if (key.startsWith("tab:")) {
    const i = Number(key.slice(4));
    const tabs = (it.tabs ?? []).map((t, j) => (j === i ? { ...t, icon: v ?? "" } : t));
    return { tabs };
  }
  return {};
}
