"use client";

import { createContext, useContext } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  badgeSurface,
  buttonScale,
  FAB_MENU_GAP,
  R_INNER,
  FAB_MENU_ITEM_H,
  H,
  Item,
  Kind,
  MEASURED,
  AUTHOR_WIDTHS,
  Palette,
  Radii,
  STATUS_BAR_H,
  baseRadii,
  CARD_MEDIA_GAP,
  CARD_PADDING,
  CARD_TEXT_GAP,
  cardContentAlignOf,
  cardFillOf,
  cardImagePosOf,
  cardImageSizeOf,
  cardBodyColorOf,
  cardScrimOf,
  cardTextColorOf,
  colorOverrideOf,
  layerOf,
  onToken,
  paletteForItem,
  connectedButton,
  runCorners,
  scaleR,
  sizeOf,
  strokeOf,
  variantShadow,
  variantStyle,
  SETTLE_MS,
  progressThickness,
  progressTrack,
  scrollOffset,
  scrollRange,
  progressValue,
  BAR_FOLDED_W,
  isWideRail,
  NAV_ICON,
  NAV_INDICATOR,
  NAV_INDICATOR_R,
  NAV_LABEL_FONT,
  navLabelInk,
  navPerLine,
  navRows,
  railCell,
  railMetrics,
  isScrollableTabs,
  tabIndexOf,
  tabStyleOf,
  TAB_ROW_H,
  GRID_WHEEL_SIZE,
  WHEEL_SIZE,
  wheelSlice,
  gridRingCells,
  gridEdgeCells,
  GACHA_W,
  GACHA_H,
  CALENDAR_DAYS,
  CALENDAR_W,
  CALENDAR_COLS,
  calendarRows,
  secondLabel,
  gridRing,
  defaultPrizes,
  prizeLabel,
  joystickKnob,
  joystickTravel,
  JOYSTICK_SIZE,
  tabScrollOffset,
  SCROLL_TAB_W,
  fillColor,
  fillInk,
  slotGrid,
  CELL_DEF,
  gridCheckZ,
  cellRadius,
  panelRadius,
  unitOf,
  sideRailW,
  rotOf,
  rotStyle,
  labelSideOf,
  tabShowsIcon,
  tabBadge,
  type NavTab,
  maxOf,
  clampValue,
} from "@/lib/tokens";
import { CircularProgress, LinearProgress, LoadingIndicator } from "./Loading";
import { t, useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { railSelectedLabelColor } from "@/lib/color";

/** weight of a heading or label: heavier under the emphasized type setting */
const useWeight = () => {
  const emphasized = useTheme().emphasized;
  return (normal: number, strong: number) => (emphasized ? strong : normal);
};

export function Icon({
  name,
  size = 24,
  color,
  fill,
  weight,
}: {
  name: string;
  size?: number;
  color?: string;
  fill?: boolean;
  weight?: number;
}) {
  return (
    <span
      className="msr"
      data-fill={fill ? "1" : "0"}
      style={{
        fontSize: size,
        color,
        fontVariationSettings: weight
          ? `"FILL" ${fill ? 1 : 0}, "wght" ${weight}, "GRAD" 0, "opsz" 24`
          : undefined,
      }}
    >
      {name}
    </span>
  );
}

const ellipsis = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const NO_BOX: Kind[] = [
  "circularProgress",
  "linearProgress",
  "progressBar",
  "loadingIndicator",
  "switch",
  "checkbox",
  "radio",
  "slider",
  "text",
  "divider",
  "splitButton",
  "fabMenu",
  "badge",
];

/** Padding follows M3: icon+label is tighter than label alone. */
export function ButtonContent({ item }: { item: Item }) {
  const w = useWeight();
  const hasIcon = !!item.icon;
  const hasLabel = item.label.trim().length > 0;
  /* A button the author made taller or shorter keeps its proportions: the words, the icon and the
     padding are the medium button's, scaled with its own height — M3's small / medium / large. */
  const scale = buttonScale(item);
  const padX = (hasLabel ? (hasIcon ? 22 : 26) : 16) * scale;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: item.size ? "100%" : undefined,
        boxSizing: "border-box",
        gap: hasIcon && hasLabel ? Math.round(8 * scale) : 0,
        paddingLeft: Math.round(padX),
        paddingRight: Math.round(padX),
        /* the box's own height, which the author can set */
        height: "100%",
        fontSize: Math.round(16 * scale),
        fontWeight: w(500, 700),
        letterSpacing: 0.1,
        whiteSpace: "nowrap",
      }}
    >
      {hasIcon && <Icon name={item.icon!} size={Math.round(24 * scale)} fill={item.variant === "filled"} />}
      {hasLabel && <span>{item.label}</span>}
    </span>
  );
}

function ExtendedFabContent({ item }: { item: Item }) {
  const w = useWeight();
  const hasIcon = !!item.icon;
  const hasLabel = item.label.trim().length > 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: hasIcon && hasLabel ? 12 : 0,
        padding: "0 20px",
        height: 56,
        fontSize: 14,
        fontWeight: w(500, 700),
        whiteSpace: "nowrap",
      }}
    >
      {hasIcon && <Icon name={item.icon!} size={24} />}
      {hasLabel && <span>{item.label}</span>}
    </span>
  );
}

function ChipContent({ item, p }: { item: Item; p: Palette }) {
  const on = !!item.checked;
  const lead = on ? "check" : item.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        paddingLeft: lead ? 8 : 16,
        paddingRight: 16,
        height: 32,
        fontSize: 14,
        fontWeight: 500,
        whiteSpace: "nowrap",
        color: on ? p.onSecondaryContainer : undefined,
      }}
    >
      {lead && <Icon name={lead} size={18} />}
      <span>{item.label}</span>
    </span>
  );
}

function SwitchContent({ item, p }: { item: Item; p: Palette }) {
  const hasLabel = item.label.trim().length > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14, height: H - 8, whiteSpace: "nowrap", width: item.size ? "100%" : undefined, justifyContent: item.size ? "space-between" : undefined }}>
      {hasLabel && <span style={{ fontSize: 16, color: p.onSurface, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>}
      <SwitchControl on={!!item.checked} noCheck={!!item.noCheck} p={p} />
    </span>
  );
}

/** the M3 switch track and handle, 52 × 32 */
function SwitchControl({ on, noCheck, p }: { on: boolean; noCheck?: boolean; p: Palette }) {
  return (
    <span
        style={{
          position: "relative",
          width: 52,
          height: 32,
          borderRadius: 16,
          background: on ? p.primary : p.surfaceContainerHighest,
          border: on ? "2px solid transparent" : `2px solid ${p.outline}`,
          boxSizing: "border-box",
          flex: "0 0 auto",
          transition: "background 160ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: on ? 22 : 4,
            width: on ? 24 : 16,
            height: on ? 24 : 16,
            marginTop: on ? -12 : -8,
            borderRadius: 12,
            background: on ? p.onPrimary : p.outline,
            display: "grid",
            placeItems: "center",
            color: p.onPrimaryContainer,
            transition: "left 160ms, width 160ms, height 160ms",
          }}
        >
          {on && !noCheck && <Icon name="check" size={16} weight={600} />}
        </span>
      </span>
  );
}

function CheckboxContent({ item, p }: { item: Item; p: Palette }) {
  const on = !!item.checked;
  const hasLabel = item.label.trim().length > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 40, whiteSpace: "nowrap" }}>
      <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            boxSizing: "border-box",
            border: on ? "none" : `2px solid ${p.onSurfaceVariant}`,
            background: on ? p.primary : "transparent",
            color: p.onPrimary,
            display: "grid",
            placeItems: "center",
          }}
        >
          {on && <Icon name="check" size={16} weight={700} />}
        </span>
      </span>
      {hasLabel && <span style={{ fontSize: 16, color: p.onSurface, paddingRight: 8 }}>{item.label}</span>}
    </span>
  );
}

function TextContent({ item, p }: { item: Item; p: Palette }) {
  const w = useWeight();
  const fs = item.size ?? 28;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: fs,
        lineHeight: 1.3,
        fontWeight: item.bold ? w(700, 800) : w(400, fs >= 22 ? 600 : 500),
        letterSpacing: fs >= 28 ? -0.25 : 0,
        color: p.onSurface,
        whiteSpace: "nowrap",
        padding: "0 2px",
      }}
    >
      {item.label || " "}
    </span>
  );
}

/** A split button: the labeled action and, after a hairline gap, a menu trigger.
 *  The two halves keep their own corners, so the box around them stays plain. */
function SplitButtonContent({ item, p }: { item: Item; p: Palette }) {
  const w = useWeight();
  const st = variantStyle(item.variant, p);
  const outer = scaleR(28);
  const inner = scaleR(8);
  const hasLabel = item.label.trim().length > 0;
  const shadow = variantShadow(item.variant);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, height: H }}>
      <span
        style={{
          ...st,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: H,
          padding: hasLabel ? "0 20px 0 22px" : "0 16px",
          borderTopLeftRadius: outer,
          borderBottomLeftRadius: outer,
          borderTopRightRadius: inner,
          borderBottomRightRadius: inner,
          fontSize: 16,
          fontWeight: w(500, 700),
          whiteSpace: "nowrap",
          boxSizing: "border-box",
          boxShadow: shadow,
        }}
      >
        {item.icon && <Icon name={item.icon} size={22} fill={item.variant === "filled"} />}
        {hasLabel && <span>{item.label}</span>}
      </span>
      <span
        style={{
          ...st,
          display: "inline-grid",
          placeItems: "center",
          width: 52,
          height: H,
          borderTopLeftRadius: inner,
          borderBottomLeftRadius: inner,
          borderTopRightRadius: outer,
          borderBottomRightRadius: outer,
          boxSizing: "border-box",
          boxShadow: shadow,
        }}
      >
        <Icon name="keyboard_arrow_down" size={24} />
      </span>
    </span>
  );
}

function RadioContent({ item, p }: { item: Item; p: Palette }) {
  const on = !!item.checked;
  const hasLabel = item.label.trim().length > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 40, whiteSpace: "nowrap" }}>
      <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            boxSizing: "border-box",
            border: `2px solid ${on ? p.primary : p.onSurfaceVariant}`,
            display: "grid",
            placeItems: "center",
          }}
        >
          {on && <span style={{ width: 10, height: 10, borderRadius: 5, background: p.primary }} />}
        </span>
      </span>
      {hasLabel && <span style={{ fontSize: 16, color: p.onSurface, paddingRight: 8 }}>{item.label}</span>}
    </span>
  );
}

/** A badge: a 6dp dot when it has no text, a 16dp pill with the count otherwise. */
export function BadgeContent({ item, p }: { item: Item; p: Palette }) {
  const text = item.label.trim();
  /* a badge the author sized fills the box it was given; otherwise it hugs its number
     (a dot when it is empty) */
  const own = item.size !== undefined;
  const h = item.size2 ?? (text ? 16 : 6);
  const w = own ? "100%" : text ? undefined : 6;
  /* the number shrinks and grows with the badge, so a short one is not spilling out of its pill */
  const pad = Math.max(2, Math.round(h / 4));
  return (
    /* Centred in the box, whichever way the author sized it: the pill is drawn as tall as they
       asked, from the middle out — a top-anchored pill looked like the badge was shrinking from
       the bottom only. */
    <div style={{ display: "grid", placeItems: "center", height: "100%", boxSizing: "border-box" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: w,
          minWidth: own || !text ? undefined : Math.max(6, h),
          height: h,
          padding: text && !own ? `0 ${pad}px` : 0,
          borderRadius: h / 2,
          boxSizing: "border-box",
          /* the pill is the badge: its colour and its border live here (see badgeSurface) */
          ...badgeSurface(item, p),
          fontSize: Math.max(8, Math.min(20, Math.round(h * 0.7))),
          fontWeight: 500,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** Content for kinds that size to their text; rendered again offscreen to measure. */
export function MeasuredContent({ item, p }: { item: Item; p: Palette }) {
  switch (item.kind) {
    case "button":
      return <ButtonContent item={item} />;
    case "extendedFab":
      return <ExtendedFabContent item={item} />;
    case "chip":
      return <ChipContent item={item} p={p} />;
    case "switch":
      return <SwitchContent item={item} p={p} />;
    case "checkbox":
      return <CheckboxContent item={item} p={p} />;
    case "text":
      return <TextContent item={item} p={p} />;
    case "splitButton":
      return <SplitButtonContent item={item} p={p} />;
    case "radio":
      return <RadioContent item={item} p={p} />;
    case "badge":
      return <BadgeContent item={item} p={p} />;
    default:
      return null;
  }
}

/** How thick a scroll bar is drawn, and how short its thumb may get. */
const SCROLL_BAR = 4;
const SCROLL_THUMB_MIN = 24;

/**
 * A container's children where the container scrolls: moved by the offset its content is at, with a
 * slim bar on the axis that has room to move so the design itself says the content goes on. The box
 * around it clips, so what has been scrolled past is simply not drawn — in the canvas, in the export
 * and in the preview alike, which is what keeps the three showing the same thing.
 */
function ScrollLayer({
  item,
  p,
  widths,
  scroll,
  children,
}: {
  item: Item;
  p: Palette;
  widths: Record<string, number>;
  /** what the visitor has moved the content to; the offset the author designed when absent */
  scroll?: { x?: number; y?: number };
  children?: React.ReactNode;
}) {
  /* a slot grid draws its child frame itself; its cells are ordinary children and sit on top */
  const inside = item.kind === "invGrid" ? <><GridPanel item={item} p={p} widths={widths} />{children}</> : children;
  if (!inside) return null;
  if (!item.scroll) return <>{inside}</>;
  const size = sizeOf(item, widths);
  const range = scrollRange(item, widths);
  const at = scrollOffset(item, widths, scroll);
  const bar = (axis: "x" | "y") => {
    const max = axis === "y" ? range.y : range.x;
    if (max <= 0) return null;
    const view = axis === "y" ? size.h : size.w;
    const track = view;
    const thumb = Math.max(SCROLL_THUMB_MIN, Math.round((view / (view + max)) * track));
    const pos = Math.round(((axis === "y" ? at.y : at.x) / max) * (track - thumb));
    return (
      <div
        key={axis}
        data-scrollbar={axis}
        style={{
          position: "absolute",
          pointerEvents: "none",
          borderRadius: SCROLL_BAR / 2,
          background: p.outline,
          opacity: 0.6,
          ...(axis === "y" ? { right: 3, top: pos, width: SCROLL_BAR, height: thumb } : { bottom: 3, left: pos, height: SCROLL_BAR, width: thumb }),
        }}
      />
    );
  };
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${-at.x}px, ${-at.y}px)` }}>{inside}</div>
      {bar("y")}
      {bar("x")}
    </>
  );
}

/**
 * A slot grid's child frame: the inset panel its cells sit on. It is drawn in the part's own
 * coordinates, and the frame scrolls over it together with the cells — so a board with more rows
 * than the frame fits slides whole, the child frame included, which is what the author drew.
 */
function GridPanel({ item, p, widths }: { item: Item; p: Palette; widths: Record<string, number> }) {
  const g = slotGrid(item, widths);
  return (
    <div
      data-grid="panel"
      style={{
        position: "absolute",
        left: g.panel.x,
        top: g.panel.y,
        width: g.panel.w,
        height: g.panel.h,
        borderRadius: panelRadius(),
        background: p.surfaceContainerHighest,
      }}
    />
  );
}

/**
 * What a board adds to one of its cells: the checkbox the visitor ticks when the author turned the
 * boxes on, and — while a cell is still empty — the placeholder icon the board carries. Both are
 * drawn over the cell rather than inside it, so a cell stays a plain container the author can put
 * anything in.
 *
 * The box is only drawn over a cell that holds something: a tick marks an item, and an empty slot
 * has nothing to mark. It also rides above the cell's contents, so filling a cell never buries it.
 */
export function GridCellMarks({
  grid,
  cell,
  checked,
  onToggle,
  p,
  z,
}: {
  grid: Item;
  cell: Item;
  checked: boolean;
  /** given only where ticking a cell is an edit: the canvas, with the board in hand */
  onToggle?: () => void;
  p: Palette;
  /** where the box rides; the preview lifts it over the part the visitor touched last */
  z?: number;
}) {
  const size = Math.max(14, Math.round((cell.size ?? CELL_DEF) * 0.34));
  return (
    <>
      {!cell.children?.length && grid.icon && (
        <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: p.onSurfaceVariant, pointerEvents: "none" }}>
          <Icon name={grid.icon} size={Math.round((cell.size ?? CELL_DEF) * 0.5)} />
        </span>
      )}
      {grid.checkboxes && !!cell.children?.length && (
        <span
          data-cell-check={checked ? "on" : "off"}
          role={onToggle ? "checkbox" : undefined}
          aria-checked={onToggle ? checked : undefined}
          onPointerDown={onToggle ? (e) => e.stopPropagation() : undefined}
          onClick={
            onToggle
              ? (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggle();
                }
              : undefined
          }
          style={{
            position: "absolute",
            left: Math.max(3, Math.round(size * 0.2)),
            top: Math.max(3, Math.round(size * 0.2)),
            width: size,
            height: size,
            boxSizing: "border-box",
            borderRadius: Math.max(3, Math.round(size * 0.24)),
            background: checked ? p.primary : "transparent",
            border: checked ? "none" : `1.5px solid ${p.outline}`,
            color: p.onPrimary,
            display: "grid",
            placeItems: "center",
            cursor: onToggle ? "pointer" : undefined,
            /* above whatever the author dropped into the cell, at layer 20 to begin with */
            zIndex: z ?? gridCheckZ(cell),
          }}
        >
          {checked && <Icon name="check" size={Math.round(size * 0.76)} />}
        </span>
      )}
    </>
  );
}

/**
 * What a control inside a part needs to know about the value it carries: where a change goes. It is
 * absent on the canvas and in an export, where a part is drawn but not live — the number is then
 * read-only, which is exactly what the canvas shows.
 */
export type WheelRun = { angle: number; lit: number; ms: number };
export const ValueContext = createContext<{
  onSet?: (v: number) => void;
  /** the three symbols a slot machine is showing */
  reels?: (id: string) => number[] | undefined;
  /** what a prize wheel is doing right now: how far its disc has turned, which prize is lit, and how
   *  long the turn takes. Absent on the canvas, where a wheel is drawn at rest. */
  wheel?: (id: string) => WheelRun | undefined;
}>({});
const useValueControls = () => useContext(ValueContext);
/** What a prize wheel is doing, if it is spinning at all. */
const useWheelRun = () => useContext(ValueContext).wheel;
const useReels = () => useContext(ValueContext).reels;

/** The value a slider, a slider field or a stepper stands at: what the author set, 0 when unset —
 *  clamped to the part's own range, so a slider that runs to ten thousand is read on its own scale. */
const shownValue = (it: Item) => clampValue(it.value ?? 40, maxOf(it));

/**
 * The badge a destination carries, at its top trailing corner: a game's count of what waits behind a
 * tab ("3"), or a word like "new". It rides over the label rather than taking room in it, so a
 * destination with a badge and one without line up the same way.
 */
function NavBadge({ tab, p, size = 16, inset = 0 }: { tab: NavTab; p: Palette; size?: number; inset?: number }) {
  const text = tabBadge(tab);
  if (!text) return null;
  return (
    <span
      data-nav-badge={text}
      style={{
        position: "absolute",
        top: inset,
        right: inset,
        minWidth: size,
        height: size,
        padding: text.length > 2 ? `0 ${Math.round(size * 0.28)}px` : 0,
        borderRadius: size / 2,
        background: p.error,
        color: p.onError,
        fontSize: Math.round(size * 0.62),
        fontWeight: 700,
        lineHeight: `${size}px`,
        textAlign: "center",
        boxSizing: "border-box",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

/** The track, the thumb and the tick of a slider — drawn to the width the part is given, so the
 *  thumb lands under the finger whether it stands on a screen or inside a dialog panel. */
function SliderTrack({ item, p, showValue }: { item: Item; p: Palette; showValue?: boolean }) {
  const value = shownValue(item);
  const v = value / maxOf(item);
  const w = item.size ?? 280;
  const handleX = 2 + (w - 4) * v;
  const top = showValue ? 34 : 14;
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={{ position: "absolute", left: 0, width: Math.max(0, handleX - 8), top, height: 16, borderRadius: "8px 2px 2px 8px", background: p.primary }} />
      <div style={{ position: "absolute", left: handleX + 8, right: 0, top, height: 16, borderRadius: "2px 8px 8px 2px", background: p.secondaryContainer }} />
      <div style={{ position: "absolute", right: 6, top: top + 6, width: 4, height: 4, borderRadius: 2, background: p.onSecondaryContainer }} />
      <div style={{ position: "absolute", left: handleX - 2, top: top - 14, width: 4, height: 44, borderRadius: 2, background: p.primary }} />
      {showValue && (
        /* the number sits over the handle and stays inside the part at either end */
        <span
          data-value={value}
          style={{
            position: "absolute",
            left: Math.max(0, Math.min(w - 52, handleX - 26)),
            top: 0,
            width: 52,
            height: 24,
            borderRadius: 8,
            background: p.primary,
            color: p.onPrimary,
            fontSize: 13,
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            boxSizing: "border-box",
          }}
        >
          {/* the percent sign is the author's to keep or drop: a slider standing for a count of
              something is the same control without it — and one text node, because the pill lays
              its children out in a grid */}
          {`${value}${unitOf(item) ? "%" : ""}`}
        </span>
      )}
    </div>
  );
}

/**
 * The number a stepper and a slider field carry, with the two buttons that walk it by one: the box
 * can be typed into where the part is live, and the buttons answer a tap. Everything inside the row
 * takes its own press, so the part's own drag never starts from a button or from the box.
 */
function ValueRow({ item, p }: { item: Item; p: Palette }) {
  const cbs = useValueControls();
  const v = shownValue(item);
  const round = Math.max(28, Math.round((item.size2 ?? 56) * 0.62));
  const box: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: round,
    height: round,
    borderRadius: round / 2,
    border: "none",
    background: "transparent",
    color: p.onSurface,
    cursor: cbs.onSet ? "pointer" : "default",
    flex: "0 0 auto",
    padding: 0,
  };
  const step = (by: number) => (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    cbs.onSet?.(clampValue(v + by, maxOf(item)));
  };
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ display: "flex", alignItems: "center", gap: 2, width: "100%", height: "100%", padding: "0 6px", boxSizing: "border-box" }}
    >
      {item.label.trim().length > 0 && (
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, color: p.onSurface }}>
          {item.label}
        </span>
      )}
      <button type="button" aria-label="-" style={box} onClick={step(-1)}>
        <Icon name="remove" size={Math.round(round * 0.5)} />
      </button>
      {/* the number itself: an author types a value into it, and the slider follows */}
      <input
        type="text"
        inputMode="numeric"
        value={String(v)}
        readOnly={!cbs.onSet}
        aria-label={item.label.trim() || String(v)}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9]/g, ""));
          if (Number.isFinite(n)) cbs.onSet?.(clampValue(n, maxOf(item)));
        }}
        style={{
          width: 56,
          height: Math.max(32, round),
          border: "none",
          outline: "none",
          background: "transparent",
          color: p.onSurface,
          font: "inherit",
          fontSize: 18,
          fontWeight: 700,
          textAlign: "center",
          padding: 0,
        }}
      />
      <button type="button" aria-label="+" style={box} onClick={step(1)}>
        <Icon name="add" size={Math.round(round * 0.5)} />
      </button>
    </div>
  );
}

function Body({ item, p, tabScroll }: { item: Item; p: Palette; tabScroll?: number }) {
  const lang = useLang();
  const w = useWeight();
  const hasLabel = item.label.trim().length > 0;
  const hasSupporting = !!item.supporting?.trim();

  if (MEASURED.includes(item.kind)) return <MeasuredContent item={item} p={p} />;

  switch (item.kind) {
    case "iconButton": {
      /* one shape, one icon in it: no words under it, whatever the document still carries */
      const s = item.size ?? 48;
      return (
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          {item.icon && <Icon name={item.icon} size={Math.round(s / 2)} fill={item.variant === "filled"} />}
        </div>
      );
    }

    case "fab": {
      const s = item.size ?? 56;
      return (
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          {item.icon && <Icon name={item.icon} size={Math.round(s * 0.42)} />}
        </div>
      );
    }

    case "topAppBar":
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            /* the inset the bar has, if any (see sizeOf) */
            padding: `${sizeOf(item, {}).h - 64}px 4px 0`,
            height: "100%",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          <div style={{ width: 48, height: 48, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            {item.icon && <Icon name={item.icon} size={24} color={p.onSurface} />}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: w(400, 600), color: p.onSurface, ...ellipsis }}>
            {item.label}
          </div>
          <div style={{ width: 48, height: 48, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            {item.icon2 && <Icon name={item.icon2} size={24} color={p.onSurfaceVariant} />}
          </div>
        </div>
      );

    case "searchBar":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: "100%" }}>
          {item.icon && <Icon name={item.icon} size={24} color={p.onSurface} />}
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, color: p.onSurfaceVariant, ...ellipsis }}>
            {item.label}
          </div>
          {item.icon2 && <Icon name={item.icon2} size={24} color={p.onSurfaceVariant} />}
        </div>
      );

    case "card": {
      const pos = cardImagePosOf(item);
      const hasImage = !item.noImage;
      const padding = CARD_PADDING;
      const align = cardContentAlignOf(item);
      const justifyContent = { start: "flex-start", center: "center", end: "flex-end" }[align] as React.CSSProperties["justifyContent"];
      const ink = cardTextColorOf(item, p);
      const body = cardBodyColorOf(item, p);
      const picture = item.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        item.icon && <Icon name={item.icon} size={34} />
      );
      const media = (style: React.CSSProperties) => (
        <div
          style={{
            borderRadius: scaleR(14),
            background: p.primaryContainer,
            color: p.onPrimaryContainer,
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
            overflow: "hidden",
            ...style,
          }}
        >
          {picture}
        </div>
      );
      const text = (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: CARD_TEXT_GAP, justifyContent }}>
          {hasLabel && (
            <div style={{ fontSize: 16, fontWeight: w(600, 700), color: ink, ...ellipsis }}>{item.label}</div>
          )}
          {hasSupporting && (
            <div style={{ fontSize: 13, lineHeight: 1.5, color: body.color, opacity: body.opacity, overflow: "hidden" }}>
              {item.supporting}
            </div>
          )}
        </div>
      );
      if (hasImage && pos === "background") {
        /* Full-bleed media behind the text. A photo, or a chosen text color that the placeholder's
         * container may not carry, gets a scrim on the text's side: dark under light text, light under dark. */
        const scrim = item.src || item.textColor ? cardScrimOf(ink, align) : undefined;
        return (
          <div style={{ position: "relative", height: "100%", boxSizing: "border-box" }}>
            <div style={{ position: "absolute", inset: 0, background: p.primaryContainer, color: p.onPrimaryContainer, display: "grid", placeItems: "center" }}>
              {picture}
            </div>
            {scrim && <div style={{ position: "absolute", inset: 0, background: scrim }} />}
            <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding, display: "flex", flexDirection: "column" }}>{text}</div>
          </div>
        );
      }
      /* top: the image band above the text; leading / trailing: a full-height column beside it */
      const side = hasImage && (pos === "leading" || pos === "trailing");
      return (
        <div
          style={{
            padding,
            height: "100%",
            display: "flex",
            flexDirection: side ? "row" : "column",
            gap: CARD_MEDIA_GAP,
            boxSizing: "border-box",
          }}
        >
          {hasImage && pos !== "trailing" && media(side ? { width: cardImageSizeOf(item), alignSelf: "stretch" } : { height: cardImageSizeOf(item) })}
          {text}
          {hasImage && pos === "trailing" && media({ width: cardImageSizeOf(item), alignSelf: "stretch" })}
        </div>
      );
    }

    case "listItem": {
      const iconBg = item.iconFill === "none" ? null : (item.iconFill ?? "primaryContainer");
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 16px", height: "100%" }}>
          {item.icon && (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: iconBg ? fillColor(iconBg, p, "primaryContainer") : "transparent",
                color: iconBg ? fillInk(iconBg, p, "primaryContainer") : fillInk(item.fill, p, "surfaceContainerLow"),
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
              }}
            >
              <Icon name={item.icon} size={22} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {hasLabel && <div style={{ fontSize: 16, color: p.onSurface, ...ellipsis }}>{item.label}</div>}
            {hasSupporting && (
              <div style={{ fontSize: 13, color: p.onSurfaceVariant, ...ellipsis }}>{item.supporting}</div>
            )}
          </div>
          {item.switch ? <SwitchControl on={!!item.checked} noCheck={!!item.noCheck} p={p} /> : item.icon2 && <Icon name={item.icon2} size={22} color={p.onSurfaceVariant} />}
        </div>
      );
    }

    case "dialog":
      return (
        <div
          style={{
            padding: 24,
            height: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {item.icon && (
            <div style={{ textAlign: "center", color: p.primary }}>
              <Icon name={item.icon} size={24} />
            </div>
          )}
          {hasLabel && (
            <div
              style={{
                fontSize: 24,
                fontWeight: w(400, 600),
                color: p.onSurface,
                textAlign: item.icon ? "center" : "left",
                ...ellipsis,
              }}
            >
              {item.label}
            </div>
          )}
          {hasSupporting && (
            <div style={{ fontSize: 14, lineHeight: 1.5, color: p.onSurfaceVariant, flex: 1, overflow: "hidden" }}>
              {item.supporting}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {[t("cancel", lang), t("ok", lang)].map((t) => (
              <span
                key={t}
                style={{
                  padding: "0 12px",
                  height: 40,
                  display: "inline-flex",
                  alignItems: "center",
                  color: p.primary,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      );

    case "snackbar":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 0 16px", height: "100%" }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: p.inverseOnSurface, ...ellipsis }}>
            {item.label}
          </div>
          {hasSupporting && (
            <span
              style={{
                padding: "0 12px",
                height: 36,
                display: "inline-flex",
                alignItems: "center",
                color: p.inversePrimary,
                fontSize: 14,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {item.supporting}
            </span>
          )}
        </div>
      );

    case "textField": {
      const filled = item.variant === "filled";
      return (
        <div style={{ position: "relative", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: "100%" }}>
            {item.icon && <Icon name={item.icon} size={24} color={p.onSurfaceVariant} />}
            <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: p.onSurfaceVariant, ...ellipsis }}>
              {filled ? "" : ""}
            </span>
          </div>
          {hasLabel && (
            <span
              style={{
                position: "absolute",
                left: item.icon ? 52 : 16,
                top: filled ? 8 : -8,
                fontSize: 12,
                lineHeight: "16px",
                color: p.primary,
                background: filled ? "transparent" : p.surface,
                padding: filled ? 0 : "0 4px",
                marginLeft: filled ? 0 : -4,
              }}
            >
              {item.label}
            </span>
          )}
          {filled && (
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 2,
                background: p.primary,
              }}
            />
          )}
          {hasSupporting && (
            <span
              style={{
                position: "absolute",
                left: 16,
                top: "100%",
                marginTop: 4,
                fontSize: 12,
                color: p.onSurfaceVariant,
                whiteSpace: "nowrap",
              }}
            >
              {item.supporting}
            </span>
          )}
        </div>
      );
    }

    case "select": {
      /* a closed dropdown: the chosen option is the value and the label floats; with
       * nothing chosen the label sits in the field */
      const filled = item.variant === "filled";
      const value = item.selected === undefined ? undefined : item.tabs?.[item.selected]?.label;
      return (
        <div style={{ position: "relative", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 12px 0 16px", height: "100%" }}>
            {item.icon && <Icon name={item.icon} size={24} color={p.onSurfaceVariant} />}
            <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: value ? p.onSurface : p.onSurfaceVariant, paddingTop: value && filled ? 16 : 0, ...ellipsis }}>
              {value ?? item.label}
            </span>
            <Icon name="arrow_drop_down" size={24} color={p.onSurfaceVariant} />
          </div>
          {value && hasLabel && (
            <span
              style={{
                position: "absolute",
                left: item.icon ? 52 : 16,
                top: filled ? 8 : -8,
                fontSize: 12,
                lineHeight: "16px",
                color: p.onSurfaceVariant,
                background: filled ? "transparent" : p.surface,
                padding: filled ? 0 : "0 4px",
                marginLeft: filled ? 0 : -4,
              }}
            >
              {item.label}
            </span>
          )}
          {filled && <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: p.onSurfaceVariant }} />}
          {hasSupporting && (
            <span style={{ position: "absolute", left: 16, top: "100%", marginTop: 4, fontSize: 12, color: p.onSurfaceVariant, whiteSpace: "nowrap" }}>
              {item.supporting}
            </span>
          )}
        </div>
      );
    }

    case "slider":
      /* with `showValue` the number rides above the track, on the handle, the way M3's own value
         indicator does: the track keeps the whole width, so dragging still reads across the part */
      return <SliderTrack item={item} p={p} showValue={!!item.showValue} />;

    case "stepper":
      return <ValueRow item={item} p={p} />;

    case "image":
      if (item.src) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.src}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        );
      }
      return (
        <div style={{ display: "grid", placeItems: "center", height: "100%", color: p.outline }}>
          {item.icon && <Icon name={item.icon} size={Math.min(48, Math.round((item.size ?? 200) * 0.3))} />}
        </div>
      );

    case "camera":
      /* a viewfinder: the live feed is dark, with focus brackets and a shutter row */
      return (
        <div style={{ position: "relative", height: "100%", color: p.inverseOnSurface }}>
          {(["left", "right"] as const).map((side) =>
            (["top", "bottom"] as const).map((edge) => (
              <div
                key={`${side}-${edge}`}
                style={{
                  position: "absolute",
                  [side]: 24,
                  [edge]: 24,
                  width: 28,
                  height: 28,
                  opacity: 0.7,
                  [`border${side === "left" ? "Left" : "Right"}`]: `3px solid ${p.inverseOnSurface}`,
                  [`border${edge === "top" ? "Top" : "Bottom"}`]: `3px solid ${p.inverseOnSurface}`,
                  [`border${edge === "top" ? "Top" : "Bottom"}${side === "left" ? "Left" : "Right"}Radius`]: 6,
                }}
              />
            )),
          )}
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0.5 }}>
            {item.icon && <Icon name={item.icon} size={40} />}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, display: "grid", placeItems: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, border: `4px solid ${p.inverseOnSurface}`, display: "grid", placeItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: p.inverseOnSurface }} />
            </div>
          </div>
        </div>
      );

    case "map":
      /* a stylised city: blocks on a light ground, two main roads and a river, one pin */
      return (
        <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
          <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }} aria-hidden>
            <rect width="400" height="300" fill={p.surfaceContainerLow} />
            <path d="M-20 210 C 80 170, 140 260, 240 220 S 380 150, 430 190 L 430 240 C 380 200, 300 260, 240 250 S 120 230, -20 250 Z" fill={p.primaryContainer} opacity={0.6} />
            {[
              [20, 20, 90, 60], [130, 20, 110, 60], [260, 20, 120, 60],
              [20, 100, 90, 70], [130, 100, 60, 70], [210, 100, 170, 70],
              [20, 190, 60, 40], [300, 200, 80, 30],
            ].map(([x, y, w, h], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} rx={6} fill={p.surfaceContainerHighest} />
            ))}
            <path d="M0 90 H400 M110 0 V300 M250 0 V300" stroke={p.surface} strokeWidth={10} fill="none" />
            <path d="M0 90 H400 M110 0 V300 M250 0 V300" stroke={p.outlineVariant} strokeWidth={1} fill="none" opacity={0.6} />
            <g transform="translate(200 150)">
              <path d="M0 24 C -14 6, -20 -2, -20 -12 A 20 20 0 0 1 20 -12 C 20 -2, 14 6, 0 24 Z" fill={p.primary} />
              <circle cx="0" cy="-12" r="7" fill={p.onPrimary} />
            </g>
          </svg>
        </div>
      );

    case "divider":
      return (
        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
          <div style={{ width: "100%", height: 1, background: p.outlineVariant }} />
        </div>
      );

    case "navRail": {
      const tabs = item.tabs ?? [];
      const wide = isWideRail(item);
      const expanded = !!item.railExpanded;
      const rail = railMetrics(item);
      if (wide) return (
        <div style={{ position: "relative", height: "100%" }}>
          {/* the rail folds up and down: "V" folds everything away, the turned-around "V" opens it */}
          <div className="m3-rail-geometry" style={{ position: "absolute", left: Math.round(rail.headerLeft), top: rail.headerTop, width: 48, height: 48, display: "grid", placeItems: "center", color: p.onSurfaceVariant }}>
            <Icon name={item.railFolded || !expanded ? "expand_less" : "expand_more"} size={24} />
          </div>
          {!item.railFolded &&
            tabs.map((tab, i) => {
              const on = i === Math.min(item.selected ?? 0, Math.max(0, tabs.length - 1));
              /* every position is read off the rail's own width, and the icon always sits above
                 its label; past the author's per-line limit the destinations start another column.
                 The cell comes from the same helper the preview's hit areas use, so what answers a
                 tap is what is drawn. */
              const cell = railCell(item, tabs.length, i);
              const pillW = expanded ? cell.width : Math.min(cell.width, 56);
              /* a rail squeezed for height keeps its icons: the pill shrinks to the cell and the
                 words go, rather than the column running out of the bottom */
              const tight = cell.height < rail.itemHeight;
              return (
                <div
                  key={i}
                  className="m3-rail-geometry"
                  style={{
                    position: "absolute",
                    left: cell.left,
                    top: cell.top,
                    width: cell.width,
                    height: cell.height,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                  }}
                >
                  <div
                    className="m3-rail-geometry"
                    style={{
                      width: Math.min(NAV_INDICATOR, pillW, cell.height),
                      height: Math.min(NAV_INDICATOR, cell.height),
                      borderRadius: scaleR(NAV_INDICATOR_R),
                      display: "grid",
                      placeItems: "center",
                      background: on ? p.secondaryContainer : "transparent",
                      color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
                      transition: "background 160ms, color 160ms",
                      filter: tab.disabled ? "grayscale(1)" : undefined,
                      opacity: tab.disabled ? 0.45 : 1,
                      transform: tab.grown ? "scale(1.15)" : undefined,
                    }}
                  >
                    {tabShowsIcon(tab) && <Icon name={tab.icon} size={NAV_ICON} fill={on} />}
                    <NavBadge tab={tab} p={p} size={16} inset={-2} />
                  </div>
                  {tab.label.trim() && !tight && (
                    <span
                      className="m3-rail-geometry"
                      /* The label sits on the rail itself, below the pill, so it takes the ink the
                         rail's own background reads in — the pill's ink belongs to the icon inside
                         it, and using it here painted white words on a white rail. */
                      style={{ width: cell.width, textAlign: "center", fontSize: expanded ? NAV_LABEL_FONT + 1 : NAV_LABEL_FONT, lineHeight: "16px", fontWeight: on ? w(600, 700) : w(400, 500), color: p[navLabelInk(on)], ...ellipsis }}
                    >
                      {tab.label}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      );
      return (
        /* the 80dp rail lays its columns out from the same cells the preview's hit areas use */
        <div style={{ position: "relative", height: "100%" }}>
          {tabs.map((t, i) => {
            const on = i === Math.min(item.selected ?? 0, Math.max(0, tabs.length - 1));
            const withLabel = t.label.trim().length > 0;
            const cell = railCell(item, tabs.length, i);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: cell.left,
                  top: cell.top,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  width: cell.width,
                  height: cell.height,
                }}
              >
                <div
                  style={{
                    width: Math.min(NAV_INDICATOR, cell.width),
                    height: Math.min(NAV_INDICATOR, cell.height),
                    borderRadius: scaleR(NAV_INDICATOR_R),
                    display: "grid",
                    placeItems: "center",
                    background: on ? p.secondaryContainer : "transparent",
                    color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
                    /* a destination its own rule has greyed out, or grown, shows it */
                    transition: "background 160ms, color 160ms, transform 160ms",
                    filter: t.disabled ? "grayscale(1)" : undefined,
                    opacity: t.disabled ? 0.45 : 1,
                    transform: t.grown ? "scale(1.15)" : undefined,
                  }}
                >
                  {tabShowsIcon(t) && <Icon name={t.icon} size={NAV_ICON} fill={on} />}
                  <NavBadge tab={t} p={p} size={16} inset={-2} />
                </div>
                {withLabel && (
                  <span
                    style={{
                      fontSize: NAV_LABEL_FONT,
                      fontWeight: on ? w(600, 700) : w(400, 500),
                      color: p[navLabelInk(on)],
                      maxWidth: "100%",
                      ...ellipsis,
                    }}
                  >
                    {t.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case "bottomNav": {
      const tabs = item.tabs ?? [];
      /* the bar's own collapse button: "<" folds every label away, ">" brings them back */
      const folded = item.barFolded === true;
      const hasToggle = item.barFolded !== undefined;
      return (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            alignContent: "center",
            /* Folded, the one thing left is its button, at the trailing edge. On one line the
             * destinations spread out; once they wrap, a short last row is pushed right so its
             * columns line up with the full rows above it. */
            justifyContent: folded || navRows(tabs.length, item.navPerRow) > 1 ? "flex-end" : "space-around",
            height: "100%",
            /* The collapse button owns the trailing strip, so no destination sits under it.
             * The destinations centre in the whole bar rather than in the 80dp above the
             * gesture strip (see sizeOf): centring them higher left a hem at the bottom that
             * read as a mistake. They are short enough to stay clear of the strip anyway. */
            padding: `0 ${hasToggle ? 44 : 4}px 0 4px`,
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* folded, the bar keeps nothing but its own ">" button; more tabs than one row
              holds flow onto the next row, which is why the bar grows taller */}
          {!folded && tabs.map((t, i) => {
            const on = i === Math.min(item.selected ?? 0, Math.max(0, tabs.length - 1));
            const withLabel = t.label.trim().length > 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  flex: `0 0 ${100 / navPerLine(tabs.length, item.navPerRow)}%`,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: NAV_INDICATOR,
                    height: NAV_INDICATOR,
                    borderRadius: scaleR(NAV_INDICATOR_R),
                    display: "grid",
                    placeItems: "center",
                    background: on ? p.secondaryContainer : "transparent",
                    color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
                    transition: "background 160ms, color 160ms",
                  }}
                >
                  {tabShowsIcon(t) && <Icon name={t.icon} size={NAV_ICON} fill={on} />}
                  <NavBadge tab={t} p={p} size={16} inset={-2} />
                </div>
                {withLabel && !folded && (
                  <span
                    style={{
                      fontSize: NAV_LABEL_FONT,
                      fontWeight: on ? w(600, 700) : w(400, 500),
                      color: p[navLabelInk(on)],
                      maxWidth: "100%",
                      ...ellipsis,
                    }}
                  >
                    {t.label}
                  </span>
                )}
              </div>
            );
          })}
          {hasToggle && (
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, display: "grid", placeItems: "center", color: p.onSurfaceVariant }}>
              {/* The bar's own fold button. Its chevrons point along the bar — the way its
                  destinations run — the same way the rail's point along the rail: "◀" says the
                  destinations are out to the left, "▶" that they are folded away and come back. */}
              <Icon name={folded ? "chevron_right" : "chevron_left"} size={20} />
            </div>
          )}
        </div>
      );
    }

    case "circularProgress":
      return (
        <CircularProgress
          size={item.size ?? 48}
          color={p.primary}
          trackColor={p.secondaryContainer}
          wavy={item.wavy}
          trackThickness={progressThickness(item)}
          value={item.value === undefined ? undefined : item.value / 100}
        />
      );

    case "linearProgress":
      return (
        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
          <LinearProgress
            width={item.size ?? 320}
            color={p.primary}
            trackColor={p.secondaryContainer}
            wavy={item.wavy}
            trackThickness={progressThickness(item)}
            value={item.value === undefined ? undefined : item.value / 100}
          />
        </div>
      );

    case "progressBar": {
      const h = sizeOf(item, {}).h;
      const value = progressValue(item);
      const track = progressTrack(item, p);
      const words = item.label.trim();
      const font = Math.max(9, Math.min(28, Math.round(h * 0.58)));
      /* A bar can be as slim as 4dp, so its words cannot simply sit inside it: they are centred on
         the bar, and the copy over the filled part is clipped to it. The two halves are inked
         against the colour each one lies on, so the words read wherever the fill's edge lands. */
      const line = (color: string) => (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: "0 6px", boxSizing: "border-box", fontSize: font, fontWeight: 700, lineHeight: 1.1, ...ellipsis }}>{words}</span>
      );
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: Math.round(h / 2), background: track.color }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${value}%`, background: p.primary }} />
          {words && <span style={{ color: track.ink }}>{line(track.ink)}</span>}
          {/* the same words again, clipped to the fill: the inner line is as wide as the whole bar,
              so the two copies sit on exactly the same letters */}
          {words && value > 0 && (
            <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${value}%`, overflow: "hidden", color: p.onPrimary }}>
              <span style={{ position: "absolute", left: 0, top: 0, width: `${10000 / value}%`, height: "100%" }}>{line(p.onPrimary)}</span>
            </span>
          )}
        </div>
      );
    }

    case "fabMenu": {
      const tabs = item.tabs ?? [];
      const filled = item.variant === "filled";
      const fabStyle = variantStyle(item.variant, p);
      const itemStyle = filled
        ? { background: p.primaryContainer, color: p.onPrimaryContainer }
        : { background: p.secondaryContainer, color: p.onSecondaryContainer };
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: FAB_MENU_GAP, height: "100%" }}>
          {tabs.map((tab, i) => (
            <span
              key={i}
              style={{
                ...itemStyle,
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                height: FAB_MENU_ITEM_H,
                padding: "0 24px 0 20px",
                borderRadius: scaleR(28),
                fontSize: 16,
                fontWeight: w(500, 700),
                whiteSpace: "nowrap",
                maxWidth: "100%",
                boxSizing: "border-box",
                boxShadow: "0 1px 3px rgba(0,0,0,0.16)",
              }}
            >
              {tabShowsIcon(tab) && <Icon name={tab.icon} size={22} />}
              <span style={ellipsis}>{tab.label}</span>
              <NavBadge tab={tab} p={p} size={16} inset={2} />
            </span>
          ))}
          <span
            style={{
              ...fabStyle,
              width: 56,
              height: 56,
              borderRadius: scaleR(16),
              display: "grid",
              placeItems: "center",
              boxShadow: "0 3px 8px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.12)",
              flex: "0 0 auto",
            }}
          >
            {item.icon && <Icon name={item.icon} size={24} />}
          </span>
        </div>
      );
    }

    case "toolbar": {
      const tabs = item.tabs ?? [];
      const vibrant = item.variant === "filled";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px", height: "100%", boxSizing: "border-box" }}>
          {tabs.map((tab, i) => (
            <span
              key={i}
              style={{
                width: 48,
                height: 48,
                borderRadius: scaleR(24),
                display: "grid",
                placeItems: "center",
                color: vibrant ? p.onPrimaryContainer : p.onSurfaceVariant,
                flex: "0 0 auto",
              }}
            >
              {tabShowsIcon(tab) && <Icon name={tab.icon} size={24} />}
              <NavBadge tab={tab} p={p} size={16} inset={-2} />
            </span>
          ))}
        </div>
      );
    }

    case "tabs": {
      const tabs = item.tabs ?? [];
      const scroll = isScrollableTabs(item);
      const offset = tabScroll ?? tabScrollOffset(item, sizeOf(item, {}).w);
      const sel = tabIndexOf(item);
      /* Buttons, the way most games switch a page: the tab in front is a filled chip and the rest are
         outlined. The row is the same height either way, so the panels under it start in the same place. */
      /* where the strip sits: the top edge, or the foot of the box with the page above it */
      const atBottom = labelSideOf(item) === "bottom";
      const strip: React.CSSProperties = { position: "absolute", left: 0, right: 0, height: TAB_ROW_H, ...(atBottom ? { bottom: 0 } : { top: 0 }) };
      if (tabStyleOf(item) === "buttons") {
        const outer = scaleR((TAB_ROW_H - 16) / 2);
        return (
          <div style={{ ...strip, display: "flex", alignItems: "center", padding: "0 8px", overflow: "hidden", boxSizing: "border-box" }}>
            {tabs.map((tab, i) => {
              const on = i === sel;
              /* The buttons sit flush against one another, the way a connected group does: only the
                 two ends of the row are rounded off, neighbours share one 1px edge, and the tab in
                 front keeps its place in the row rather than floating in a gap. */
              const c = connectedButton(i, tabs.length, outer, scaleR(R_INNER));
              return (
                <div
                  key={i}
                  style={{
                    flex: scroll ? "none" : 1,
                    width: scroll ? SCROLL_TAB_W : undefined,
                    marginLeft: scroll && i === 0 ? -offset : c.margin || undefined,
                    minWidth: 0,
                    height: TAB_ROW_H - 16,
                    borderRadius: `${c.radii.tl}px ${c.radii.tr}px ${c.radii.br}px ${c.radii.bl}px`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "0 12px",
                    boxSizing: "border-box",
                    background: on ? p.secondaryContainer : "transparent",
                    color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
                    border: on ? "none" : `1px solid ${p.outlineVariant}`,
                  }}
                >
                  {tabShowsIcon(tab) && <Icon name={tab.icon} size={18} fill={on} />}
                  <span style={{ fontSize: 14, fontWeight: on ? w(600, 700) : w(400, 500), maxWidth: "100%", ...ellipsis }}>{tab.label}</span>
                  <NavBadge tab={tab} p={p} size={16} inset={4} />
                </div>
              );
            })}
          </div>
        );
      }
      /* the underline row keeps one edge of the box; the rest of the box is the page */
      return (
        <div style={{ ...strip, display: "flex", alignItems: "stretch", overflow: "hidden" }}>
          {tabs.map((tab, i) => {
            const on = i === sel;
            return (
              <div
                key={i}
                style={{
                  flex: scroll ? "none" : 1,
                  width: scroll ? SCROLL_TAB_W : undefined,
                  marginLeft: scroll && i === 0 ? -offset : undefined,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  position: "relative",
                  padding: "0 8px",
                }}
              >
                {/* the icon rides beside the words here — the strip is one line tall — and the badge
                    sits at the corner of the destination, over both */}
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: w(500, 700),
                    color: on ? p.primary : p.onSurfaceVariant,
                    padding: "0 4px 14px",
                    maxWidth: "100%",
                  }}
                >
                  {tabShowsIcon(tab) && <Icon name={tab.icon} size={18} fill={on} />}
                  <span style={ellipsis}>{tab.label}</span>
                </span>
                <NavBadge tab={tab} p={p} size={16} inset={2} />
                {on && (
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      ...(atBottom ? { top: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 } : { bottom: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3 }),
                      transform: "translateX(-50%)",
                      width: `calc(100% - 24px)`,
                      height: 3,
                      background: p.primary,
                    }}
                  />
                )}
              </div>
            );
          })}
          <span style={{ position: "absolute", left: 0, right: 0, ...(atBottom ? { top: 0 } : { bottom: 0 }), height: 1, background: p.outlineVariant }} />
        </div>
      );
    }

    /**
     * The same row of tabs stood on its side: the destinations run down the left in a column, each a
     * label with its icon, and the page of the tab in front is what is left of the box — the panels
     * are the row's children, laid out beside this column by `panelBox`.
     */
    case "sideTabs": {
      const tabs = item.tabs ?? [];
      const sel = tabIndexOf(item);
      const rail = sideRailW(item);
      const atRight = labelSideOf(item) === "right";
      const buttons = tabStyleOf(item) === "buttons";
      const outer = scaleR((TAB_ROW_H - 16) / 2);
      return (
        <div style={{ display: "flex", alignItems: "stretch", width: rail, height: "100%", marginLeft: atRight ? "auto" : undefined, flexDirection: "column", padding: "8px 0", boxSizing: "border-box", overflow: "hidden" }}>
          {tabs.map((tab, i) => {
            const on = i === sel;
            /* Buttons, the way the horizontal row offers them: the destination in front is a filled
               pill and the rest are outlined; the underline style marks the one in front with a bar
               down its leading edge instead */
            const c = buttons ? connectedButton(i, tabs.length, outer, scaleR(R_INNER)) : null;
            return (
              <div
                key={i}
                style={{
                  height: TAB_ROW_H,
                  flex: "0 0 auto",
                  margin: buttons ? "2px 8px" : undefined,
                  padding: buttons ? "0 12px" : "0 12px 0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  position: "relative",
                  minWidth: 0,
                  boxSizing: "border-box",
                  ...(c
                    ? { borderRadius: `${c.radii.tl}px ${c.radii.tr}px ${c.radii.br}px ${c.radii.bl}px`, background: on ? p.secondaryContainer : "transparent", border: on ? "none" : `1px solid ${p.outlineVariant}`, color: on ? p.onSecondaryContainer : p.onSurfaceVariant }
                    : {}),
                }}
              >
                {tabShowsIcon(tab) && <Icon name={tab.icon} size={20} fill={on} color={buttons ? undefined : on ? p.primary : p.onSurfaceVariant} />}
                <span style={{ fontSize: 14, fontWeight: on ? w(600, 700) : w(400, 500), maxWidth: "100%", ...ellipsis, color: buttons ? undefined : on ? p.primary : p.onSurfaceVariant }}>{tab.label}</span>
                <NavBadge tab={tab} p={p} size={16} inset={4} />
                {on && !buttons && (
                  <span style={{ position: "absolute", [atRight ? "right" : "left"]: 0, top: 10, bottom: 10, width: 3, borderRadius: 3, background: p.primary } as React.CSSProperties} />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case "joystick": {
      /* A movement pad: four faint arrows, a knob the visitor drags, and the angle it stands for.
         The knob is placed from the part's own value, so the canvas, the preview and an export all
         show the same angle. */
      const size = Math.min(item.size ?? JOYSTICK_SIZE, item.size2 ?? item.size ?? JOYSTICK_SIZE);
      const travel = joystickTravel(size);
      const angle = clampValue(item.value ?? 0, maxOf(item));
      const knob = joystickKnob(angle, size, angle > 0);
      const arrow = (name: string, deg: number) => (
        <span
          key={name}
          style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${Math.round(size * 0.36)}px)`, color: p.outline, display: "inline-flex" }}
        >
          <Icon name={name} size={Math.max(14, Math.round(size * 0.15))} />
        </span>
      );
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {arrow("keyboard_arrow_up", 0)}
          {arrow("keyboard_arrow_right", 90)}
          {arrow("keyboard_arrow_down", 180)}
          {arrow("keyboard_arrow_left", 270)}
          <span
            data-joystick-knob=""
            style={{
              position: "absolute",
              left: `calc(50% + ${knob.dx}px)`,
              top: `calc(50% + ${knob.dy}px)`,
              width: Math.max(24, Math.round(size * 0.34)),
              height: Math.max(24, Math.round(size * 0.34)),
              marginLeft: -Math.round(Math.max(24, size * 0.34) / 2),
              marginTop: -Math.round(Math.max(24, size * 0.34) / 2),
              borderRadius: "50%",
              background: angle > 0 ? p.primary : p.primaryContainer,
              color: angle > 0 ? p.onPrimary : p.onPrimaryContainer,
              boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {angle > 0 ? `${angle}°` : ""}
          </span>
          <span style={{ position: "absolute", left: "50%", top: "50%", width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: 3, background: p.outlineVariant }} />
          <span style={{ position: "absolute", left: travel > 0 ? "50%" : 0, top: 0, display: "none" }} />
        </div>
      );
    }

    case "wheel": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      /* The pool drawn as wedges, a pointer at the top that never moves, and the button in the
         middle. The wedges are a conic gradient, so the wheel is one element however many prizes it
         holds; the disc turns under the pointer while the preview spins it. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const n = prizes.length;
      const sweep = 360 / n;
      const run = wheelOf?.(item.id);
      const lit = run?.lit ?? -1;
      const disc = prizes
        .map((_: unknown, i: number) => {
          const fill = i === lit ? p.primaryContainer : i % 2 ? p.surfaceContainerHigh : p.surfaceContainerLow;
          return `${fill} ${i * sweep}deg ${(i + 1) * sweep}deg`;
        })
        .join(", ");
      const size = Math.min(item.size ?? WHEEL_SIZE, item.size2 ?? item.size ?? WHEEL_SIZE);
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <div
            data-wheel-disc=""
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: `conic-gradient(${disc})`,
              transform: `rotate(${run?.angle ?? 0}deg)`,
              transition: run && run.ms > 0 ? `transform ${run.ms}ms cubic-bezier(0.15, 0.85, 0.2, 1)` : undefined,
            }}
          >
            {prizes.map((pr, i) => (
              <span
                key={i}
                data-prize={i}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  /* The label lies along its own spoke: turned so its first character is the one
                     nearest the middle and its words run out towards the rim, and placed far enough
                     out to sit in the wedge rather than across the button. */
                  transform: `translate(-50%, -50%) rotate(${wheelSlice(i, n).start + sweep / 2 - 90}deg) translateX(${Math.round(size * 0.28)}px)`,
                  color: i === lit ? p.onPrimaryContainer : p.onSurfaceVariant,
                  fontSize: Math.max(9, Math.round(size * 0.055)),
                  fontWeight: i === lit ? 700 : 500,
                  whiteSpace: "nowrap",
                  maxWidth: Math.round(size * 0.52),
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                {pr.icon && <Icon name={pr.icon} size={Math.max(10, Math.round(size * 0.06))} />}
                {prizeLabel(pr)}
              </span>
            ))}
          </div>
          {/* the pointer, the rim and the button: none of them turn with the wheel */}
          <span style={{ position: "absolute", left: "50%", top: -2, marginLeft: -8, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: `14px solid ${p.error}` }} />
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${p.outlineVariant}` }} />
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: Math.max(48, Math.round(size * 0.3)),
              height: Math.max(48, Math.round(size * 0.3)),
              marginLeft: -Math.round(Math.max(48, size * 0.3) / 2),
              marginTop: -Math.round(Math.max(48, size * 0.3) / 2),
              borderRadius: "50%",
              background: p.primary,
              color: p.onPrimary,
              display: "grid",
              placeItems: "center",
              fontSize: Math.max(10, Math.round(size * 0.065)),
              fontWeight: 700,
              textAlign: "center",
              padding: 4,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {item.label.trim() || "抽奖"}
          </span>
        </div>
      );
    }

    case "gridWheel": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      /* The same pool laid round the edge of a grid, with the button in the middle: the highlight
         runs from cell to cell and stops on the prize, which is the shape a nine-cell draw is drawn
         in. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const { rows, cols } = gridRing(prizes.length);
      /* every cell of the edge is drawn; the ones the pool does not reach show the blank prize, so a
         ring is a ring rather than a few cards and a gap */
      const cells = gridEdgeCells(prizes.length);
      const placed = gridRingCells(prizes.length);
      const run = wheelOf?.(item.id);
      const lit = run?.lit ?? -1;
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "grid", gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, boxSizing: "border-box", padding: 4 }}>
          {cells.map((cell, i) => {
            const at = placed.findIndex((c) => c.row === cell.row && c.col === cell.col);
            const pr = at >= 0 ? prizes[at] : undefined;
            const empty = !pr;
            return (
              <div
                key={i}
                data-prize={i}
                data-prize-at={at >= 0 ? at : undefined}
                data-prize-empty={empty ? "" : undefined}
                style={{
                  gridRow: cell.row + 1,
                  gridColumn: cell.col + 1,
                  borderRadius: 10,
                  background: at === lit ? p.primaryContainer : i % 2 ? p.surfaceContainerHigh : p.surfaceContainerLow,
                  color: at === lit ? p.onPrimaryContainer : p.onSurfaceVariant,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  minWidth: 0,
                  overflow: "hidden",
                  padding: 2,
                  boxSizing: "border-box",
                  fontWeight: at === lit ? 700 : 500,
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                {(pr?.icon ?? (empty ? "sentiment_dissatisfied" : undefined)) && <Icon name={pr?.icon ?? "sentiment_dissatisfied"} size={16} />}
                <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prizeLabel(pr)}</span>
              </div>
            );
          })}
          {rows >= 3 && cols >= 3 && (
            <div
              style={{
                gridRow: `2 / span ${rows - 2}`,
                gridColumn: `2 / span ${cols - 2}`,
                borderRadius: 10,
                background: p.primary,
                color: p.onPrimary,
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 12,
                textAlign: "center",
                padding: 4,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              {item.label.trim() || "抽奖"}
            </div>
          )}
        </div>
      );
    }

    case "gacha": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      /* A capsule machine: a glass dome of capsules, a knob that turns, and the prize named when it
         stops. The knob's turn is the run the preview sends, and the lit capsule is the prize it is
         passing. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const run = wheelOf?.(item.id);
      const lit = run?.lit ?? -1;
      const w = item.size ?? GACHA_W;
      const h = item.size2 ?? GACHA_H;
      const dome = Math.round(Math.min(w * 0.74, h * 0.5));
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: 8, boxSizing: "border-box", gap: 6 }}>
          <div
            style={{
              position: "relative",
              width: dome,
              height: dome,
              borderRadius: "50%",
              background: p.surfaceContainerLow,
              border: `3px solid ${p.outlineVariant}`,
              overflow: "hidden",
            }}
          >
            {Array.from({ length: Math.min(12, Math.max(6, prizes.length * 2)) }, (_, i) => {
              const on = i % Math.max(1, prizes.length) === lit;
              const a = (i / 12) * Math.PI * 2 + (run ? Math.sin((run.lit + i) * 1.7) * 0.9 : 0);
              const rad = dome / 2;
              return (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: `calc(50% + ${Math.round(Math.cos(a) * rad * (run ? 0.36 + (i % 3) * 0.06 : 0.45))}px)`,
                    top: `calc(50% + ${Math.round(Math.sin(a) * rad * (run ? 0.36 + (i % 3) * 0.06 : 0.45))}px)`,
                    width: Math.max(10, Math.round(dome * 0.16)),
                    height: Math.max(10, Math.round(dome * 0.16)),
                    marginLeft: -Math.round(Math.max(10, dome * 0.16) / 2),
                    marginTop: -Math.round(Math.max(10, dome * 0.16) / 2),
                    borderRadius: "50%",
                    background: on ? p.primaryContainer : i % 2 ? p.tertiaryContainer : p.secondaryContainer,
                  }}
                />
              );
            })}
          </div>
          <div style={{ width: "100%", flex: 1, minHeight: 0, borderRadius: 12, background: p.surfaceContainerHigh, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 6, boxSizing: "border-box", position: "relative", overflow: "hidden" }}>
            <span
              data-gacha-knob=""
              style={{
                width: Math.max(28, Math.round(w * 0.22)),
                height: Math.max(28, Math.round(w * 0.22)),
                borderRadius: "50%",
                background: p.primary,
                color: p.onPrimary,
                display: "grid",
                placeItems: "center",
                transform: `rotate(${run ? (run.lit + 1) * 40 : 0}deg)`,
                transition: run ? "transform 120ms linear" : undefined,
              }}
            >
              <Icon name="rotate_right" size={Math.max(16, Math.round(w * 0.1))} />
            </span>
            <div style={{ display: "flex", gap: 6, width: "100%" }}>
              {[{ text: item.label.trim(), many: false }, { text: secondLabel(item), many: true }].map((b, i) => (
                <span
                  key={i}
                  data-gacha-button={b.many ? "ten" : "one"}
                  style={{ flex: 1, minWidth: 0, height: Math.max(24, Math.round(h * 0.14)), borderRadius: 12, background: i === 0 ? p.primary : p.secondaryContainer, color: i === 0 ? p.onPrimary : p.onSecondaryContainer, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap" }}
                >
                  {b.text}
                </span>
              ))}
            </div>
            {lit >= 0 && prizes[lit] && (
              <span data-gacha-prize={prizes[lit].label} style={{ position: "absolute", right: 8, bottom: 6, fontSize: 11, fontWeight: 700, color: p.primary }}>{prizeLabel(prizes[lit])}</span>
            )}
          </div>
        </div>
      );
    }

    case "eggSmash": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      /* A row of golden eggs under a hammer: a tap swings the hammer down, the egg it lands on
         cracks, and the prize it held comes up in the dialog. The cracked eggs are the part's own
         value, so the canvas shows what the author left and the preview adds to it. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const run = wheelOf?.(item.id);
      const n = Math.min(6, Math.max(3, prizes.length));
      const smashed = clampValue(item.value ?? 0, n);
      const w = item.size ?? 260;
      const h = item.size2 ?? 200;
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 8, boxSizing: "border-box", gap: 6 }}>
          <span
            data-egg-hammer=""
            style={{
              position: "absolute",
              left: "50%",
              top: 4,
              marginLeft: -Math.round(w * 0.06),
              width: Math.round(w * 0.12),
              height: Math.round(h * 0.42),
              transformOrigin: "50% 90%",
              transform: `rotate(${run ? 62 : 0}deg)`,
              transition: run ? "transform 900ms cubic-bezier(0.4, 0, 0.2, 1)" : undefined,
              display: "grid",
              placeItems: "center",
              color: p.onSurfaceVariant,
            }}
          >
            <Icon name="hardware" size={Math.max(18, Math.round(w * 0.09))} />
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", justifyContent: "center" }}>
            {Array.from({ length: n }, (_, i) => {
              const broken = i < smashed;
              return (
                <span
                  key={i}
                  data-egg={i}
                  data-egg-broken={broken ? "" : undefined}
                  style={{
                    position: "relative",
                    width: Math.round(w / n) - 8,
                    height: Math.round(h * 0.4),
                    borderRadius: "50% 50% 45% 45% / 60% 60% 40% 40%",
                    background: broken ? p.surfaceContainerHigh : "#ffd54f",
                    border: `2px solid ${p.outlineVariant}`,
                    display: "grid",
                    placeItems: "center",
                    color: "#7a5c00",
                    fontSize: Math.max(10, Math.round(w / n * 0.22)),
                    fontWeight: 700,
                    overflow: "hidden",
                  }}
                >
                  {broken ? (
                    <span style={{ display: "grid", placeItems: "center", color: p.outline }}>
                      <Icon name="egg_alt" size={Math.round(w / n * 0.4)} />
                    </span>
                  ) : (
                    "?"
                  )}
                </span>
              );
            })}
          </div>
          <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: p.onSurfaceVariant, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label.trim()}</div>
        </div>
      );
    }

    case "moneyTree": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      /* A tree of coins: it shakes while a draw runs — every coin shifted by the run the preview
         sends — and the two buttons along its foot draw one or ten. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const run = wheelOf?.(item.id);
      const lit = run?.lit ?? -1;
      const w = item.size ?? 190;
      const h = item.size2 ?? 220;
      const coins = Math.min(14, Math.max(6, prizes.length + 3));
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 8, boxSizing: "border-box", gap: 6 }}>
          <div
            data-tree-canopy=""
            style={{
              position: "relative",
              flex: 1,
              minHeight: 0,
              /* shaken, not turned: the whole crown swings while a draw runs */
              transform: run ? `translateX(${(Math.sin(run.lit * 2.4) * w * 0.035).toFixed(1)}px) rotate(${(Math.sin(run.lit * 2.4) * 1.6).toFixed(1)}deg)` : undefined,
              transition: run ? "transform 90ms linear" : undefined,
              transformOrigin: "50% 90%",
            }}
          >
            <span style={{ position: "absolute", left: "50%", bottom: 0, width: Math.max(10, Math.round(w * 0.1)), height: "38%", marginLeft: -Math.round(Math.max(10, w * 0.1) / 2), borderRadius: 6, background: "#8d6e63" }} />
            {Array.from({ length: coins }, (_, i) => {
              const a = (i / coins) * Math.PI * 2;
              const jiggle = run ? Math.sin((run.lit + i) * 1.9) * 0.08 : 0;
              const r = 0.3 + jiggle + (i % 3) * 0.07;
              const s = Math.max(12, Math.round(Math.min(w, h) * 0.13));
              return (
                <span
                  key={i}
                  data-tree-coin={i}
                  style={{
                    position: "absolute",
                    left: `calc(50% + ${Math.round(Math.cos(a) * w * r * 0.5)}px)`,
                    top: `calc(38% + ${Math.round(Math.sin(a) * w * r * 0.5)}px)`,
                    width: s,
                    height: s,
                    marginLeft: -Math.round(s / 2),
                    marginTop: -Math.round(s / 2),
                    borderRadius: "50%",
                    background: i % Math.max(1, prizes.length) === lit ? p.primaryContainer : "#ffd54f",
                    border: `2px solid ${p.outlineVariant}`,
                    display: "grid",
                    placeItems: "center",
                    color: "#7a5c00",
                    fontSize: Math.round(s * 0.5),
                    fontWeight: 700,
                  }}
                >
                  ¥
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ text: item.label.trim(), many: false }, { text: secondLabel(item), many: true }].map((b, i) => (
              <span
                key={i}
                data-gacha-button={b.many ? "ten" : "one"}
                style={{ flex: 1, minWidth: 0, height: Math.max(24, Math.round(h * 0.14)), borderRadius: 12, background: i === 0 ? p.primary : p.secondaryContainer, color: i === 0 ? p.onPrimary : p.onSecondaryContainer, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap" }}
              >
                {b.text}
              </span>
            ))}
          </div>
        </div>
      );
    }

    case "slot": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const reelsOf = useReels();
      /* Three reels and a lever: the reels flick through the pool while the draw runs and stop on the
         prize it landed on, all three showing it. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const run = wheelOf?.(item.id);
      const win = run?.lit ?? -1;
      const reels = reelsOf?.(item.id);
      const shownAt = (i: number) => {
        const at = reels ? reels[i] : run ? run.lit + i : 0;
        return prizes[((at % prizes.length) + prizes.length) % prizes.length];
      };
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 6, padding: 8, boxSizing: "border-box" }}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} data-slot-reel={i} style={{ flex: 1, minWidth: 0, borderRadius: 10, background: p.surfaceContainerLow, border: `2px solid ${p.outlineVariant}`, display: "grid", placeItems: "center", color: p.onSurface, overflow: "hidden", fontSize: 20 }}>
                {(() => {
                  const pr = shownAt(i);
                  return (
                    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, maxWidth: "100%", overflow: "hidden" }}>
                      {pr?.icon && <Icon name={pr.icon} size={22} />}
                      <span style={{ fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{prizeLabel(pr)}</span>
                    </span>
                  );
                })()}
              </div>
            ))}
          </div>
          <div style={{ height: 24, borderRadius: 12, background: p.primary, color: p.onPrimary, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, overflow: "hidden" }}>
            {item.label.trim()}
          </div>
        </div>
      );
    }

    case "calendar": {
      /* A month of days with the ones already signed in the primary colour: the visitor's own count
         is the part's value, so the canvas shows what the author left and the preview counts on. */
      const days = CALENDAR_DAYS;
      const signed = clampValue(item.value ?? 0, days);
      const rows = calendarRows(days);
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 6, padding: 8, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: p.onSurface }}>
            <span>{item.label.trim()}</span>
            <span data-calendar-count={signed} style={{ color: p.primary }}>{`${signed}/${days}`}</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: `repeat(${CALENDAR_COLS}, 1fr)`, gap: 3 }}>
            {Array.from({ length: rows * CALENDAR_COLS }, (_, i) => {
              const day = i + 1;
              /* the day's number scales with the calendar, so the tick on it can too */
              const fontSize = Math.max(10, Math.round((item.size ?? CALENDAR_W) / 26));
              const on = day <= signed;
              const today = day === signed + 1 && signed < days;
              return (
                <div
                  key={i}
                  data-calendar-day={day <= days ? day : undefined}
                  data-calendar-signed={on ? "" : undefined}
                  style={{
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 8,
                    fontSize,
                    fontWeight: on || today ? 700 : 500,
                    background: on ? p.primary : today ? p.primaryContainer : i % 2 ? p.surfaceContainerLow : p.surfaceContainerHigh,
                    color: on ? p.onPrimary : today ? p.onPrimaryContainer : day <= days ? p.onSurfaceVariant : "transparent",
                    outline: today ? `2px solid ${p.primary}` : undefined,
                  }}
                >
                  {day <= days && (
                    /* a signed day keeps its number and wears the tick across it, the way a wall
                       calendar is crossed off */
                    <span style={{ position: "relative", display: "grid", placeItems: "center", width: "100%", height: "100%" }}>
                      <span style={{ opacity: on ? 0.45 : 1 }}>{day}</span>
                      {on && (
                        <span data-calendar-tick="" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: p.onPrimary }}>
                          <Icon name="check" size={Math.max(14, Math.round(fontSize * 1.6))} />
                        </span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case "loadingIndicator": {
      const s = item.size ?? 48;
      return (
        <LoadingIndicator
          size={s}
          color={item.contained ? p.onPrimaryContainer : p.primary}
          contained={item.contained}
          containerColor={p.primaryContainer}
        />
      );
    }
  }
  return null;
}

function boxStyle(item: Item, p: Palette): React.CSSProperties {
  if (NO_BOX.includes(item.kind)) return { background: "transparent", border: "none" };
  /* a part given a colour of its own paints its surface with it, drawing its own
   * readable ink; an outlined part keeps an outline in the same colour */
  const own = colorOverrideOf(item, p);
  if (own) {
    const outlined = item.variant === "outlined" || item.kind === "textField" || item.kind === "select";
    return { background: own.main, color: own.on, border: outlined ? `1px solid ${own.main}` : "none" };
  }
  switch (item.kind) {
    case "joystick":
      return { background: p.surfaceContainerHighest, color: p.onSurfaceVariant, border: `1px solid ${p.outlineVariant}` };
    case "wheel":
      return { background: p.surfaceContainerHighest, color: p.onSurface, border: `1px solid ${p.outlineVariant}` };
    case "gridWheel":
      return { background: p.surfaceContainerLow, color: p.onSurface, border: `1px solid ${p.outlineVariant}` };
    case "box": {
      const t = item.fill ?? "surfaceContainerLow";
      return { background: fillColor(t, p, "surfaceContainerLow"), color: fillInk(t, p, "surfaceContainerLow"), border: "none" };
    }
    case "invGrid": {
      /* the frame paints a surface the way a box does; the child frame and the cells on it are
         painted by the grid itself, against roles of their own */
      const t = item.fill ?? "surfaceContainer";
      return { background: fillColor(t, p, "surfaceContainer"), color: fillInk(t, p, "surfaceContainer"), border: "none" };
    }
    case "stepper":
      /* a filled field: the row the two buttons and the number sit in */
      return { background: p.surfaceContainerHighest, color: p.onSurface, border: "none" };
    case "button":
    case "iconButton":
    case "fab":
    case "extendedFab": {
      /* a picture of its own sits behind the words and the icon */
      const look = variantStyle(item.variant, p);
      return item.src ? { ...look, backgroundImage: `url("${item.src}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : look;
    }
    case "chip":
      if (item.checked) return { background: p.secondaryContainer, color: p.onSecondaryContainer, border: "none" };
      return item.variant === "outlined"
        ? { background: "transparent", color: p.onSurfaceVariant, border: `1px solid ${p.outlineVariant}` }
        : { background: p.surfaceContainerLow, color: p.onSurfaceVariant, border: "none" };
    case "card":
      return { background: fillColor(cardFillOf(item), p, "surfaceContainerHighest"), border: item.variant === "outlined" ? `1px solid ${p.outlineVariant}` : "none" };
    case "textField":
    case "select":
      return item.variant === "filled"
        ? { background: p.surfaceContainerHighest, border: "none", color: p.onSurface }
        : { background: p.surface, border: `1px solid ${p.outline}`, color: p.onSurface };
    case "topAppBar":
    case "bottomNav":
    case "navRail":
      return { background: p.surfaceContainer, border: "none", color: p.onSurface };
    case "toolbar":
      return item.variant === "filled"
        ? { background: p.primaryContainer, border: "none", color: p.onPrimaryContainer }
        : { background: p.surfaceContainer, border: "none", color: p.onSurfaceVariant };
    case "tabs":
    case "sideTabs":
      return { background: p.surface, border: "none", color: p.onSurface };
    case "searchBar":
      return { background: p.surfaceContainerHigh, border: "none", color: p.onSurface };
    case "dialog":
      return { background: p.surfaceContainerHigh, border: "none", color: p.onSurface };
    case "snackbar":
      return { background: p.inverseSurface, border: "none", color: p.inverseOnSurface };
    case "image":
    case "map":
      return { background: p.surfaceContainerHighest, border: "none" };
    case "camera":
      return { background: p.inverseSurface, border: "none", color: p.inverseOnSurface };
    case "listItem": {
      const t = item.fill ?? "surfaceContainerLow";
      return { background: fillColor(t, p, "surfaceContainerLow"), border: "none", color: fillInk(t, p, "surfaceContainerLow") };
    }
    default:
      return { background: p.surfaceContainerHigh, border: "none", color: p.onSurface };
  }
}

function shadowOf(item: Item): string {
  if (NO_BOX.includes(item.kind)) return "none";
  switch (item.kind) {
    case "navRail":
      return item.railModal && item.railExpanded ? "0 2px 6px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.10)" : "none";
    case "button":
    case "iconButton":
    case "extendedFab":
      return variantShadow(item.variant);
    case "fab":
      return "0 3px 8px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.12)";
    case "card":
      return item.variant === "elevated" ? "0 1px 3px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.10)" : "none";
    case "dialog":
      return "0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)";
    case "snackbar":
      return "0 3px 8px rgba(0,0,0,0.18)";
    case "toolbar":
      return "0 2px 6px rgba(0,0,0,0.14), 0 1px 2px rgba(0,0,0,0.10)";
    default:
      return "none";
  }
}

export type { Radii };

/** Corner radii are driven continuously by the magnet; a stiff spring keeps them on the pointer. */
const RADIUS_TWEEN = { type: "spring" as const, stiffness: 900, damping: 48, mass: 0.4 };

export function M3Node({
  item,
  palette,
  radii,
  widths,
  pressed,
  dragging,
  selected,
  inRun = false,
  interactive = true,
  onPointerDown,
  tabScroll,
  overlay,
  style,
  scroll,
  onWheel,
  onClickCapture,
}: {
  item: Item;
  palette: Palette;
  radii?: Radii;
  widths: Record<string, number>;
  pressed?: boolean;
  dragging?: boolean;
  selected?: boolean;
  /** the part sits in a connected run (non-free group, or a hidden run inside a free group) */
  inRun?: boolean;
  interactive?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  /** how far a scrollable tab row is scrolled in the preview; the canvas uses the resting position */
  tabScroll?: number;
  /** a container's children, drawn inside its box (their offsets are the container's own) */
  overlay?: React.ReactNode;
  /** what the editor adds to the wrapper: an invisible run member still takes its space */
  style?: React.CSSProperties;
  /** a scrolling container's live offset in the preview; the authored one is drawn when absent */
  scroll?: { x?: number; y?: number };
  /** the preview turns a wheel over a scrolling container into movement */
  onWheel?: React.WheelEventHandler<HTMLDivElement>;
  /** the preview swallows the click that ends a scroll drag, so it does not also tap a child */
  onClickCapture?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const reducedMotion = useReducedMotion();
  const instantRail = reducedMotion && item.kind === "navRail" && isWideRail(item);
  const radiusTransition = instantRail ? { duration: 0 } : RADIUS_TWEEN;
  const r = radii ?? baseRadii(item);
  const size = sizeOf(item, widths);
  const measured = MEASURED.includes(item.kind) && !(AUTHOR_WIDTHS.includes(item.kind) && item.size);
  const clips = !NO_BOX.includes(item.kind) && item.kind !== "textField" && item.kind !== "select";
  /* a part with a colour of its own draws from a scheme whose primary role is that colour */
  const ep = paletteForItem(item, palette);

  return (
    <motion.div
      data-node={item.id}
      data-kind={item.kind}
      data-wide-rail={item.kind === "navRail" && isWideRail(item) ? "true" : undefined}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      onClickCapture={onClickCapture}
      initial={false}
      animate={{
        borderTopLeftRadius: r.tl,
        borderBottomLeftRadius: r.bl,
        borderTopRightRadius: r.tr,
        borderBottomRightRadius: r.br,
        scale: pressed ? 0.97 : 1,
        /* motion owns the transform: the turn is animated here rather than written into `style`, so a
           part that is turned still presses and grows the way an upright one does */
        rotate: rotOf(item),
      }}
      transition={{
        borderTopLeftRadius: radiusTransition,
        borderBottomLeftRadius: radiusTransition,
        borderTopRightRadius: radiusTransition,
        borderBottomRightRadius: radiusTransition,
        scale: instantRail ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 30, mass: 0.5 },
      }}
      style={{
        ...boxStyle(item, ep),
        width: measured ? undefined : size.w,
        height: size.h,
        display: measured ? "inline-flex" : "block",
        alignItems: "center",
        overflow: clips ? "hidden" : "visible",
        /* the selection ring sticks out 5px (3px offset + 2px ring); in a run the next
           sibling sits 3px away and would overpaint that edge — lift the selected part.
           Runs never overlap, so the lift only beats the sibling that hides the ring.
           Lone parts in free groups may overlap by design: keep their layer order. */
        position: "relative",
        /* the author's own level decides what draws over what; parts at the same level
           keep the order they are listed in */
        zIndex: selected && inRun ? 1_000_000 : layerOf(item),
        cursor: !interactive ? "default" : dragging ? "grabbing" : "grab",
        userSelect: "none",
        touchAction: "none",
        boxSizing: "border-box",
        /* a badge rings its own pill, so the box behind it draws no ring of its own */
        boxShadow: [item.kind === "badge" ? null : strokeOf(item, ep), shadowOf(item)].filter((v) => v && v !== "none").join(", ") || "none",
        outline: selected ? `2px solid ${palette.primary}` : "2px solid transparent",
        outlineOffset: 3,
        /* a part turns about its own middle: the place it takes in the layout does not move */
        transformOrigin: "center",
        /* a part that changes width with its screen eases the way the screen does */
        transition: measured ? "outline-color 120ms" : `outline-color 120ms, width ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`,
        flex: "0 0 auto",
        /* what the editor adds to the wrapper: the place a folded navigation part sits in, say */
        ...style,
      }}
    >
      <Body item={item} p={ep} tabScroll={tabScroll} />
      <ScrollLayer item={item} p={ep} widths={widths} scroll={scroll}>
        {overlay}
      </ScrollLayer>
    </motion.div>
  );
}

/** Plain (non-animated) rendering of a part; used where frames must be deterministic. */
export function M3Static({
  item,
  palette,
  radii,
  style,
  overlay,
}: {
  item: Item;
  palette: Palette;
  radii?: Radii;
  style?: React.CSSProperties;
  /** a container's children, drawn inside its box */
  overlay?: React.ReactNode;
}) {
  const r = radii ?? baseRadii(item);
  const size = sizeOf(item, {});
  const measured = MEASURED.includes(item.kind) && !(AUTHOR_WIDTHS.includes(item.kind) && item.size);
  const clips = !NO_BOX.includes(item.kind) && item.kind !== "textField" && item.kind !== "select";
  const ep = paletteForItem(item, palette);
  return (
    <div
      style={{
        ...boxStyle(item, ep),
        width: measured ? undefined : size.w,
        height: size.h,
        display: measured ? "inline-flex" : "block",
        alignItems: "center",
        overflow: clips ? "hidden" : "visible",
        position: "relative",
        zIndex: layerOf(item),
        boxSizing: "border-box",
        /* a badge rings its own pill, so the box behind it draws no ring of its own */
        boxShadow: [item.kind === "badge" ? null : strokeOf(item, ep), shadowOf(item)].filter((v) => v && v !== "none").join(", ") || "none",
        borderTopLeftRadius: r.tl,
        borderTopRightRadius: r.tr,
        borderBottomLeftRadius: r.bl,
        borderBottomRightRadius: r.br,
        flex: "0 0 auto",
        transformOrigin: "center",
        transform: rotStyle(item),
        ...style,
      }}
    >
      <Body item={item} p={ep} />
      <ScrollLayer item={item} p={ep} widths={{}}>
        {overlay}
      </ScrollLayer>
    </div>
  );
}
