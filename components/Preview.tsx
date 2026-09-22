"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/tokens";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, useReducedMotion, useIsPresent } from "motion/react";
import type { TargetAndTransition, Variants } from "motion/react";
import {
  fillColor,
  fillInk,
  Action,
  BACK_TARGET,
  BEZEL,
  Doc,
  Frame,
  GAP,
  Group,
  PHONE_H,
  PHONE_R,
  PHONE_W,
  Palette,
  SLIDE_SPEC,
  STATUS_BAR_H,
  SWIPE_DIRS,
  SwipeDir,
  TAPPABLE,
  TAB_ROW_H,
  Transition,
  baseRadii,
  byLayer,
  childShown,
  childDrawn,
  fontFamilyOf,
  freeRadii,
  frameRadius,
  frameSizeOf,
  groupsInFrame,
  isPhoneFrame,
  normalizeTheme,
  resolveStates,
  firstTapStep,
  firstDueStep,
  hasTimedSteps,
  lookAt,
  NAV_INDICATOR_R,
  runPartRadii,
  scaleR,
  SHAPED,
  toggleIcon,
  RAIL_TOP,
  isWideRail,
  navCell,
  railCell,
  railMetrics,
  type NavTab,
  sizeOf,
  isScrollableTabs,
  tabScrollOffset,
  SCROLL_TAB_W,
  /* overlays: a level is a bundle of runtime rules, and the stack is the order they were
     opened in — the one thing the layer tree cannot tell us */
  OVERLAY_RULES,
  backTarget,
  foldPlace,
  foldShift,
  forgetScreens,
  itemsOf,
  layersIn,
  NO_FOLD,
  isOverlayFrame,
  overlayLevelOf,
  overlayLevelOfFrame,
  overlayRuleOf,
  popLayer,
  pushLayer,
  scrollOffset,
  rulePatch,
  readoutOf,
  type RulePatch,
  withLayers,
  type MachineAt,
  type PartFlow,
  type PartStep,
  type Layer as OverlayLayer,
  type LayerTrail,
  type RuleAction,
  type OverlayLevel,
  type Kind,
} from "@/lib/tokens";
import { GridCellMarks, Icon, M3Node, ValueContext } from "./M3Node";
import { IconBtn } from "./ui";
import { t, useLang } from "@/lib/i18n";
import { constrainModalRails, modalRailOf, updateRail } from "@/lib/rail";
import { railMotionTargets } from "@/lib/railView";

const EASE = [0.2, 0, 0, 1] as const;
const SLIDE_MS = 0.42;
/** room reserved for the wide preview controls: panel, right margin and breathing space */
const WIDE_CONTROL_SPACE = 220;

type Anim = { t: Transition; back: boolean; /** the expressive motion scheme: springs instead of eased tweens */ spring?: boolean };

/** M3 Expressive spatial spring, with a visible overshoot */
const SPRING = { type: "spring" as const, stiffness: 360, damping: 26, mass: 1 };
/** how the current screen was reached, so "back" can play it in reverse */
type Entry = { id: string; t: Transition };

const pct = (v: number) => `${v * 100}%`;

/** offset along one axis, as a percentage of the screen */
const off = (axis: "x" | "y", v: number) => (axis === "x" ? { x: pct(v), y: 0 } : { x: 0, y: pct(v) });

type Pose = TargetAndTransition;

/** enter / leave poses for one screen change; the same spec drives forward and back */
function poses(c: Anim): { initial: Pose; animate: Pose; exit: Pose } {
  const zi = { zIndex: { duration: 0 } };
  const s = SLIDE_SPEC[c.t];
  if (s) {
    const tr = c.spring ? { ...SPRING, ...zi } : { duration: SLIDE_MS, ease: EASE, ...zi };
    return c.back
      ? {
          initial: { ...off(s.axis, s.exit), opacity: 0.6, scale: 1, zIndex: 1 },
          animate: { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 1, transition: tr },
          exit: { ...off(s.axis, s.enter), opacity: 1, scale: 1, zIndex: 2, transition: tr },
        }
      : {
          initial: { ...off(s.axis, s.enter), opacity: 1, scale: 1, zIndex: 2 },
          animate: { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 2, transition: tr },
          exit: { ...off(s.axis, s.exit), opacity: 0.6, scale: 1, zIndex: 1, transition: tr },
        };
  }
  if (c.t === "fade") {
    const tr = { duration: 0.3, ease: EASE, ...zi };
    return {
      initial: { x: 0, y: 0, opacity: 0, scale: 1, zIndex: 2 },
      animate: { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 2, transition: tr },
      exit: { x: 0, y: 0, opacity: 0, scale: 1, zIndex: 1, transition: tr },
    };
  }
  if (c.t === "expand") {
    const tr = c.spring ? { ...SPRING, ...zi } : { duration: 0.36, ease: EASE, ...zi };
    return c.back
      ? {
          initial: { x: 0, y: 0, scale: 0.92, opacity: 0, zIndex: 1 },
          animate: { x: 0, y: 0, scale: 1, opacity: 1, zIndex: 1, transition: tr },
          exit: { x: 0, y: 0, scale: 1.06, opacity: 0, zIndex: 2, transition: tr },
        }
      : {
          initial: { x: 0, y: 0, scale: 0.92, opacity: 0, zIndex: 2 },
          animate: { x: 0, y: 0, scale: 1, opacity: 1, zIndex: 2, transition: tr },
          exit: { x: 0, y: 0, scale: 1.06, opacity: 0, zIndex: 1, transition: tr },
        };
  }
  const tr = { duration: 0, ...zi };
  return {
    initial: { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 2 },
    animate: { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 2, transition: tr },
    exit: { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 1, transition: tr },
  };
}

const screenVariants: Variants = {
  initial: (c: Anim) => poses(c).initial,
  animate: (c: Anim) => poses(c).animate,
  exit: (c: Anim) => poses(c).exit,
};

/** kinds whose on/off state flips when tapped in the preview */
const TOGGLES = ["switch", "checkbox", "chip"] as const;
/** A tap no longer swaps a button for a second look: the toggle feature is gone. */
const flips = (_it: Item) => false;

/** The kinds whose value a visitor changes: a slider to scrub, a stepper to walk, a slider field to
 *  do both. One list, because a part of one of these kinds has to answer the same way wherever it
 *  stands — on the screen, inside a container, or inside a dialog panel. */
const VALUE_KINDS: Kind[] = ["slider", "sliderInput", "stepper"];
const SCRUBS: Kind[] = ["slider", "sliderInput"];
const STEPS: Kind[] = ["stepper", "sliderInput"];

/** Whether a board's cell is ticked right now: how the author left it, flipped by every tap since
 *  the preview opened — the same rule the visitor's own taps follow everywhere else. */
const cellChecked = (flipped: Set<string>) => (c: Item) => (flipped.has(c.id) ? !c.checked : !!c.checked);

/** Where every part's own machine is, shared down the screen */
type StateRuntime = {
  /** the look each part is in and when it got there, keyed the way taps are: `id`, or `id:slot` */
  at: MachineAt;
  /** the look a step latched onto a part, by part: a change the machine makes once, on the way past */
  pinned: Record<string, RulePatch>;
  now: number;
  /** Takes the step a tap calls for; false leaves the tap to the plain action and the rules below.
   *  `owner` is the part an untargeted look action changes. */
  onStep: (key: string, flow: PartFlow | undefined, owner: string | null) => boolean;
  /** Takes one step, whoever asked for it: a tap, or its wait coming round. */
  take: (key: string, owner: string | null, step: PartStep) => void;
  /** the button the visitor touched last: it stays a size up and highlighted */
  activeId: string | null;
  onActivate: (id: string) => void;
};

/** The press scrim, a bar's slot hit areas and a cooldown readout ride over the part, and
 *  a part carries its own layer, so those overlays sit far above any authored level. */
const OVERLAY_Z = 1_000_000;

/** the look of a part after the visitor tapped it */
function flippedLook(it: Item): Item {
  if ((TOGGLES as readonly string[]).includes(it.kind)) return { ...it, checked: !it.checked };
  if (it.toggle) {
    return {
      ...it,
      label: it.toggle.label ?? it.label,
      icon: toggleIcon(it),
      variant: it.toggle.variant ?? it.variant,
    };
  }
  return it;
}

/** The speeds the preview's clock can run at: ×1 is real time, and ×300 watches an hour in twelve
 *  seconds — the author's own cheat for a prototype that waits. */
const TIME_SPEEDS = [1, 10, 60, 300];

/** How far a finger must travel before a drag belongs to the container rather than to a tap. */
const SCROLL_SLOP = 6;

/**
 * A scrolling container's live offset in the preview, keyed by the part. The offset lives with the
 * other runtime values, so a screen that comes back to finds its containers where they were left.
 */
type ScrollRuntime = {
  /** what the visitor has moved this container to, if anything */
  at: (id: string) => { x?: number; y?: number };
  /** moves it, in dp */
  move: (id: string, axis: "x" | "y", value: number) => void;
  /** takes the drag away from the screen's own swipe, for a drag the container has claimed */
  claim: () => void;
  /** Whether this container may take the press: the one nearest the finger wins, so a container
   *  inside another scrolls without moving the one around it. */
  arm: (id: string, pointerId: number) => boolean;
  /** lets the press go again, so the next one can be judged afresh */
  release: (id: string) => void;
};

/** A part in the preview: presses down and shows a state layer while the
 *  pointer is on it, then fires its action on release, like a real widget. */
function Tappable({
  item,
  p,
  radii,
  widths,
  onTap,
  onSlot,
  onValue,
  onPick,
  menuOpen,
  onMenu,
  onRailToggle,
  railAnimating,
  onAction,
  onFlip,
  states,
  navToggle,
  onNavToggle,
  scrollRt,
  looks,
  checkOf,
  liveValue,
  onSet,
  setValue,
  readout,
  marks,
}: {
  item: Item;
  p: Palette;
  radii: ReturnType<typeof baseRadii>;
  widths: Record<string, number>;
  /** Whether a board cell's checkbox is ticked right now: how the author left it, flipped by taps */
  checkOf?: (it: Item) => boolean;
  /** The live value the visitor has moved a slider to, by part */
  liveValue?: (it: Item) => number | undefined;
  /** A control inside the part asking for a value of its own: the box and the buttons of a stepper */
  onSet?: (v: number) => void;
  /** The screen's own setter, for a control inside a part the container holds */
  setValue?: (id: string, v: number) => void;
  /** How a text bound to another part reads it: where to find the part, and its live value */
  readout?: { find: (id: string) => Item | null; live: (id: string) => number | undefined; text: (it: Item, live?: number) => string };
  /** what the part's own container draws over it, a board's cell checkbox included */
  marks?: React.ReactNode;
  onTap?: () => void;
  /** passed down so a part inside a container can open a screen of its own */
  onAction?: (a: Action) => void;
  /** and flip itself like any other toggle */
  onFlip?: (id: string) => void;
  /** the live effect of the part's own state rules */
  states?: StateRuntime;
  /** where this part's own collapse button sits, when it carries one */
  navToggle?: React.CSSProperties;
  onNavToggle?: () => void;
  /** per-slot targets on bars */
  onSlot?: (slot: string, animate?: boolean) => void;
  /** live value for sliders */
  onValue?: (v: number) => void;
  /** an option chosen from a dropdown's menu */
  onPick?: (index: number) => void;
  /** whether this dropdown's menu is the open one; the screen keeps at most one open */
  menuOpen?: boolean;
  onMenu?: (open: boolean) => void;
  onRailToggle?: (animate: boolean) => void;
  railAnimating?: boolean;
  /** the live scroll of the containers on screen, for the ones that scroll */
  scrollRt?: ScrollRuntime;
  /** the looks the machine latched onto parts of this screen, by part */
  looks?: Record<string, RulePatch>;
}) {
  const lang = useLang();
  const [pressed, setPressed] = useState(false);
  const [hot, setHot] = useState<string | null>(null);
  /* What the variables make of this part: "when the reward is ready, show the claim button" is a
     look the rules ask for — its own, or another part's rule that names it — so it is the part as
     drawn, and the tap's own effect is resolved on top of it. */
  const pin = states?.pinned[item.id];
  const asked = pin ? { ...item, ...pin } : item;
  /* the machine's own look sits on top: the part as drawn, then whatever a step latched onto it,
     then the look its own flow has moved it to */
  const own = states ? resolveStates(asked, states.at, states.now) : null;
  const view0 = own ? own.item : asked;
  const current = !!states && states.activeId === item.id && SHAPED.includes(item.kind) && !own?.disabled && !own?.hidden;
  const view = current && !view0.color ? { ...view0, color: "primaryContainer" } : view0;
  const frozen = !!own?.disabled || !!pin?.disabled;
  const grown = !!own?.grown || !!pin?.grow;
  const menu = !!menuOpen;
  /* a tab row with more tabs than fit scrolls: by wheel, touch, or dragging the row; a chosen tab is brought into view */
  const scrollTabs = isScrollableTabs(item);
  const rowW = sizeOf(item, widths).w;
  const [tabScroll, setTabScroll] = useState(() => tabScrollOffset(item, rowW));
  const scrollRef = useRef<HTMLDivElement>(null);
  /** the click that ends a drag of the row must not pick a tab */
  const swallowClick = useRef(false);
  const settled = useRef(false);
  const tabCount = item.tabs?.length ?? 0;
  const restOffset = tabScrollOffset(item, rowW);
  /* the row is brought to the chosen tab only when the choice or the row itself changes, not on every
     render of the screen, so a position the visitor scrolled to by hand stays */
  useEffect(() => {
    const el = scrollRef.current;
    if (!scrollTabs || !el) return;
    el.scrollTo({ left: restOffset, behavior: settled.current ? "smooth" : "auto" });
    settled.current = true;
  }, [scrollTabs, item.id, item.selected, tabCount, restOffset]);
  /** a mouse or pen drags the row; touch pans it natively, so it is left to the browser */
  const dragRow = (e: React.PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    if (e.pointerType === "touch" || e.button !== 0) return;
    const el = e.currentTarget;
    const x0 = e.clientX;
    const left0 = el.scrollLeft;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (Math.abs(dx) > 4) moved = true;
      if (moved) el.scrollLeft = left0 - dx;
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      swallowClick.current = moved;
      if (moved) setHot(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  /* A container scrolls: a drag inside it moves its content, and the screen's own swipe steps aside
     for a drag the container claims — the one that runs along an axis it can move. The tap that ends
     such a drag is swallowed, so scrolling never presses a child by accident. */
  const axes = item.scroll;
  const at = axes && scrollRt ? scrollOffset(item, widths, scrollRt.at(item.id)) : null;
  const swallowScrollTap = useRef(false);
  const scrollDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swallowScrollTap.current = false;
    if (!axes || !scrollRt || frozen || e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    /* the phone is drawn to scale: a finger's travel in pixels is divided by that scale to stay dp */
    const world = sizeOf(item, widths);
    const r = el.getBoundingClientRect();
    const k = world.h > 0 && r.height > 0 ? r.height / world.h : 1;
    if (!scrollRt.arm(item.id, e.pointerId)) return;
    const from = { ...scrollOffset(item, widths, scrollRt.at(item.id)) };
    const x0 = e.clientX;
    const y0 = e.clientY;
    let mine = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / k;
      const dy = (ev.clientY - y0) / k;
      if (!mine) {
        if (Math.hypot(dx, dy) < SCROLL_SLOP) return;
        const vertical = Math.abs(dy) > Math.abs(dx);
        const moves = vertical ? axes === "y" || axes === "both" : axes === "x" || axes === "both";
        /* the axis the container cannot move belongs to the screen: its swipe keeps the gesture */
        if (!moves) return;
        mine = true;
        swallowScrollTap.current = true;
        scrollRt.claim();
      }
      scrollRt.move(item.id, "x", from.x - dx);
      scrollRt.move(item.id, "y", from.y - dy);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      scrollRt.release(item.id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const live = !frozen && (!!onTap || !!onPick || !!view.flow || (TAPPABLE.includes(view.kind) && view.kind !== "text"));
  const ref = useRef<HTMLDivElement>(null);

  /* the open menu closes on a tap anywhere else or on Escape */
  useEffect(() => {
    if (!menu || !onMenu) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onMenu(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMenu(false);
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [menu, onMenu]);

  /* A part its own machine hides, or one a step latched "hidden" onto — which is how a button outside
     it puts a panel or a reward away — draws nothing at all. The check sits below every hook on
     purpose: a part that goes away on a later render still has to run the same hooks it ran before,
     or React tears the whole screen down instead of drawing the parts that are left. */
  if (own?.hidden || pin?.hidden) return null;

  const dragValue = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !onValue) return;
    onValue(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100));
  };

  /** hit areas for the icons on a top app bar and the destinations on a navigation bar */
  const slots: { key: string; style: React.CSSProperties }[] = [];
  if (onSlot && item.kind === "topAppBar") {
    /* the icons sit below the status-bar inset only where the bar has one (see sizeOf) */
    const inset = sizeOf(item, {}).h - 64;
    if (item.icon) slots.push({ key: "icon", style: { left: 4, top: inset + 8, width: 48, height: 48, borderRadius: 24 } });
    if (item.icon2) slots.push({ key: "icon2", style: { right: 4, top: inset + 8, width: 48, height: 48, borderRadius: 24 } });
  }
  if (onSlot && scrollTabs) {
    /* hit areas sit inside the scrolling layer, one per tab, so they move with the row */
    const n = item.tabs?.length ?? 0;
    for (let i = 0; i < n; i++) slots.push({ key: `tab:${i}`, style: { left: i * SCROLL_TAB_W, width: SCROLL_TAB_W, top: 0, bottom: 0, borderRadius: 16 } });
  }
  if (onSlot && item.kind === "bottomNav") {
    /* folded, the bar holds nothing but its own button: there is no destination left to tap */
    const size = sizeOf(item, widths);
    const n = item.barFolded ? 0 : item.tabs?.length ?? 0;
    /* The fold button owns a strip at the trailing edge, so the destinations are laid out in the
       padded row and the hit areas take the same insets. A bar wraps onto further lines exactly as
       it is drawn: a line of areas per line of destinations, and a short line packed to the
       trailing edge. One row of full-width areas put a tap on the second line onto the first
       line's destinations, which is the whole reason a line is worked out here at all. */
    const padL = 4;
    const padR = item.barFolded !== undefined ? 44 : 4;
    const inner = Math.max(0, size.w - padL - padR);
    for (let i = 0; i < n; i++) {
      const cell = navCell(n, item.navPerRow, i);
      const colW = inner / cell.perLine;
      const lineH = size.h / cell.lines;
      slots.push({
        key: `tab:${i}`,
        style: {
          left: padL + (cell.perLine - cell.inLine + cell.at) * colW,
          width: colW,
          top: cell.line * lineH,
          height: lineH,
          borderRadius: scaleR(NAV_INDICATOR_R),
        },
      });
    }
  }
  if (onSlot && item.kind === "tabs" && !scrollTabs) {
    const n = item.tabs?.length ?? 0;
    /* A tab row is only its row: the rest of the box is the panel of the tab in front, and a tap
       there belongs to whatever the panel holds, not to the row above it. A row wide enough to
       scroll has its own areas, measured inside the scrolling layer, so they are not added here. */
    for (let i = 0; i < n; i++)
      slots.push({ key: `tab:${i}`, style: { left: `${(i / n) * 100}%`, width: `${100 / n}%`, top: 0, height: TAB_ROW_H, borderRadius: 16 } });
  }
  if (onSlot && item.kind === "navRail") {
    /* folded, the rail holds nothing but its own button: there is no destination left to tap */
    const n = item.railFolded ? 0 : item.tabs?.length ?? 0;
    for (let i = 0; i < n; i++) {
      const cell = railCell(item, n, i);
      slots.push({
        key: `tab:${i}`,
        style: { left: cell.left, width: cell.width, top: cell.top, height: cell.height, borderRadius: scaleR(NAV_INDICATOR_R) },
      });
    }
  }
  if (onSlot && item.kind === "toolbar") {
    const n = item.tabs?.length ?? 0;
    for (let i = 0; i < n; i++) slots.push({ key: `tab:${i}`, style: { left: 8 + i * 52, width: 48, top: 8, height: 48, borderRadius: 24 } });
  }
  if (onSlot && item.kind === "fabMenu") {
    /* the pills hug their text on the right; the hit area covers the right part of the row */
    const n = item.tabs?.length ?? 0;
    for (let i = 0; i < n; i++) slots.push({ key: `tab:${i}`, style: { right: 0, width: "70%", top: i * 64, height: 56, borderRadius: 28 } });
  }


  /* A board's cells are its children: each is a container the author put parts in, and the
     checkbox over it belongs to the board — the visitor's tap ticks it. */
  /* a board's cell is tappable to tick when the board shows boxes and the cell holds something:
     an empty slot has no box, so a tap on it has nothing to do either */
  /* what decides whether the boxes are on is the part *as drawn*: a step that latched a look onto
     this board is what a button outside it uses to switch the bulk-tick mode on and off */
  const board = view.kind === "invGrid" && !!view.checkboxes;
  const grid = view.kind === "invGrid" ? view : null;

  /* A container's children are tappable in their own right: the one with a target opens
   * that screen, and a toggle inside a container flips just like one on the screen. */
  const childNodes = (item.children ?? []).filter((c, i) => childDrawn(item, c, i)).sort(byLayer).map((c) => {
    const ticks = board && !!c.children?.length;
    /* A slider inside a container is still a slider: the value the visitor moved it to has to reach
       it exactly as it reaches one standing on the screen, or the controls of a dialog panel would
       be dead while the same part works on the page behind it. */
    const live = VALUE_KINDS.includes(c.kind) ? liveValue?.(c) : undefined;
    const read = c.shows && readout ? (() => { const t = readout.find(c.shows!); return t ? readout.text(t, readout.live(t.id)) : null; })() : null;
    const shownChild = { ...c, ...(live !== undefined ? { value: live } : {}), ...(read !== null ? { label: read } : {}) };
    return (
    /* a navigation part inside a container folds the same way it does on a screen */
    <div key={c.id} style={{ position: "absolute", left: c.x + foldPlace(c, widths).dx, top: c.y + foldPlace(c, widths).dy }}>
      <Tappable
        item={shownChild}
        p={p}
        radii={baseRadii(c)}
        widths={widths}
        states={states}
        checkOf={checkOf}
        liveValue={liveValue}
        setValue={setValue}
        readout={readout}
        /* the parts whose value is the visitor's to change answer inside a container too */
        onValue={setValue && SCRUBS.includes(c.kind) ? (v) => setValue(c.id, v) : undefined}
        onSet={setValue && STEPS.includes(c.kind) ? (v) => setValue(c.id, v) : undefined}
        marks={
          grid ? (
            /* the box belongs to the board, so it rides over even the part the visitor touched
               last — which the preview lifts above everything else to show it standing a size up */
            <GridCellMarks grid={grid} cell={c} checked={checkOf ? checkOf(c) : !!c.checked} p={p} z={OVERLAY_Z + 3} />
          ) : undefined
        }
        onTap={
          ticks
            ? () => onFlip?.(c.id)
            : c.action || flips(c) || c.flow
              ? () => {
                  if (flips(c)) onFlip?.(c.id);
                  /* the machine takes the tap when it has a step for the look it is in */
                  if (states?.onStep(c.id, c.flow, c.id)) return;
                  if (c.action) onAction?.(c.action);
                }
              : undefined
        }
        onAction={onAction}
        onFlip={onFlip}
        scrollRt={scrollRt}
        looks={looks}
      />
    </div>
    );
  });

  return (
    <div
      ref={ref}
      data-rail-animate={railAnimating ? "item" : undefined}
      onPointerDown={(e) => {
        scrollDown(e);
        if (onValue) {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragValue(e);
          setPressed(true);
          return;
        }
        if (live) setPressed(true);
      }}
      onPointerMove={(e) => {
        if (onValue && pressed) dragValue(e);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => !onValue && setPressed(false)}
      onClick={
        onPick
          ? (e) => {
              e.stopPropagation();
              onMenu?.(!menu);
            }
          : (e) => {
              /* The innermost part under the finger takes the tap. Without this a container
                 answers the click as well as what it holds: a board's cell would tick under every
                 button dropped into it, and a box with an action would fire under its own child. */
              e.stopPropagation();
              /* a click that only finished a scroll is not a tap */
              if (swallowScrollTap.current) {
                swallowScrollTap.current = false;
                return;
              }
              /* the part's own machine goes first, then whatever the tap was meant to do */
              states?.onStep(view.id, view.flow, view.id);
              if (SHAPED.includes(view.kind)) states?.onActivate(view.id);
              onTap?.();
            }
      }
      style={{
        cursor: live || onValue ? "pointer" : "default",
        display: "flex",
        position: "relative",
        touchAction: scrollTabs ? "pan-x" : "none",
        /* a part its own rule has greyed out still shows, but answers nothing */
        filter: frozen ? "grayscale(1)" : undefined,
        opacity: frozen ? 0.55 : 1,
        pointerEvents: frozen ? "none" : undefined,
        /* the current button stands a size up, above its neighbours */
        transform: current ? "scale(1.08)" : grown ? "scale(1.15)" : undefined,
        transformOrigin: "center",
        transition: "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
        zIndex: current ? OVERLAY_Z + 2 : undefined,
      }}
    >
      {/* the controls inside a part — a stepper's buttons, a slider field's number — reach the value
          through this, so a part works the same on a screen and inside a dialog panel */}
      <ValueContext.Provider value={{ onSet }}>
      <M3Node
        item={view}
        palette={p}
        widths={widths}
        radii={radii}
        interactive={false}
        pressed={pressed && !onValue}
        tabScroll={scrollTabs ? tabScroll : undefined}
        overlay={<>{marks}{childNodes}</>}
        scroll={at ?? undefined}
        onWheel={
          axes && scrollRt
            ? (e) => {
                /* A wheel over a container moves it the way it would in a browser: `deltaY` is
                 * positive scrolling towards the end, which is the content sliding up, so it adds
                 * to the offset the container has been moved to — the same direction a drag of the
                 * content takes it. */
                e.stopPropagation();
                const now = { ...scrollOffset(item, widths, scrollRt.at(item.id)) };
                scrollRt.move(item.id, "x", now.x + e.deltaX);
                scrollRt.move(item.id, "y", now.y + e.deltaY);
              }
            : undefined
        }
        onClickCapture={(e) => {
          if (!swallowScrollTap.current) return;
          swallowScrollTap.current = false;
          e.stopPropagation();
          e.preventDefault();
        }}
      />
      </ValueContext.Provider>
      {/* the navigation's own collapse button: a button of its own, so nothing can cover it */}
      {navToggle && (
        <button
          type="button"
          data-nav-toggle={view.id}
          aria-label={t(view.kind === "navRail" ? (view.railFolded ? "expandNavigation" : "collapseNavigation") : view.barFolded ? "expandNavigation" : "collapseNavigation", lang)}
          onClick={(e) => {
            e.stopPropagation();
            onNavToggle?.();
          }}
          style={{ ...navToggle, position: "absolute", border: "none", padding: 0, background: "transparent", cursor: "pointer", zIndex: OVERLAY_Z + 3 }}
        />
      )}
      {own && own.cooldown > 0 && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, zIndex: OVERLAY_Z + 1, display: "grid", placeItems: "center", fontSize: 22, fontWeight: 700, color: p.onSurface, pointerEvents: "none" }}
        >
          {own.cooldown}
        </div>
      )}
      {live && (
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: pressed ? 1 : 0, scale: pressed ? 0.97 : 1 }}
          transition={{ duration: pressed ? 0.08 : 0.24, ease: EASE }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: OVERLAY_Z,
            pointerEvents: "none",
            background: `color-mix(in srgb, ${p.onSurface} 12%, transparent)`,
            borderTopLeftRadius: radii.tl,
            borderTopRightRadius: radii.tr,
            borderBottomLeftRadius: radii.bl,
            borderBottomRightRadius: radii.br,
          }}
        />
      )}
      {(() => {
      const slotNodes = slots.map((s) => {
        const Slot = onRailToggle ? "button" : "div";
        return <Slot
          key={s.key}
          type={onRailToggle ? "button" : undefined}
          className={onRailToggle ? "m3-rail-hit" : undefined}
          data-rail-toggle={s.key === "railToggle" ? item.id : undefined}
          aria-label={onRailToggle ? (s.key === "railToggle" ? t(item.railExpanded ? "collapseNavigation" : "expandNavigation", lang) : item.tabs?.[Number(s.key.slice(4))]?.label) : undefined}
          aria-expanded={s.key === "railToggle" ? !!item.railExpanded : undefined}
          aria-current={onRailToggle && s.key === `tab:${item.selected ?? 0}` ? "page" : undefined}
          onPointerDown={(e) => {
            e.stopPropagation();
            setHot(s.key);
          }}
          onPointerUp={() => setHot(null)}
          onPointerCancel={() => setHot(null)}
          onPointerLeave={() => setHot(null)}
          onClick={(e) => {
            e.stopPropagation();
            if (s.key === "railToggle") onRailToggle?.(e.detail !== 0);
            else onSlot!(s.key, e.detail !== 0);
          }}
          style={{
            position: "absolute",
            zIndex: OVERLAY_Z,
            border: "none",
            padding: 0,
            color: p.primary,
            cursor: "pointer",
            background: hot === s.key ? `color-mix(in srgb, ${p.onSurface} 12%, transparent)` : "transparent",
            transition: "background 120ms",
            ...s.style,
          }}
        />;
      });
      if (!scrollTabs) return slotNodes;
      const n = item.tabs?.length ?? 0;
      return (
        <div
          ref={scrollRef}
          className="m3-hidden-scrollbar"
          onScroll={(e) => setTabScroll(e.currentTarget.scrollLeft)}
          onPointerDownCapture={dragRow}
          onClickCapture={(e) => {
            if (swallowClick.current) {
              e.stopPropagation();
              e.preventDefault();
            }
            swallowClick.current = false;
          }}
          style={{ position: "absolute", inset: 0, overflowX: "auto", overflowY: "hidden", touchAction: "pan-x", cursor: "grab" }}
        >
          <div style={{ position: "relative", width: n * SCROLL_TAB_W, height: "100%" }}>{slotNodes}</div>
        </div>
      );
      })()}
      {onPick && menu && (
        /* the dropdown's menu, under the field: surfaceContainer, 48dp items, the chosen one tinted */
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 4,
            padding: "8px 0",
            maxHeight: 48 * 6 + 16,
            overflowY: "auto",
            borderRadius: 4,
            background: p.surfaceContainer,
            color: p.onSurface,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 2,
          }}
        >
          {(item.tabs ?? []).map((opt, i) => (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onPick(i);
                onMenu?.(false);
              }}
              style={{
                height: 48,
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                fontSize: 16,
                cursor: "pointer",
                background: item.selected === i ? `color-mix(in srgb, ${p.onSurface} 12%, transparent)` : "transparent",
                ...ellipsisText,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ellipsisText: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

function Screen({
  active = true,
  bare = false,
  frame,
  groups,
  widths,
  p,
  onAction,
  flipped,
  onFlip,
  values,
  onValue,
  runtime,
  dialog,
  scrollRt,
  onRule,
}: {
  active?: boolean;
  /** A floating layer's page is only the stage its parts were laid out on: the screen behind it
   *  shows through, so the page must not paint a background of its own. */
  bare?: boolean;
  frame: Frame;
  groups: Group[];
  widths: Record<string, number>;
  p: Palette;
  onAction: (a: Action) => void;
  /** ids of toggles the visitor has flipped since the preview opened */
  flipped: Set<string>;
  onFlip: (id: string) => void;
  values: Record<string, number>;
  onValue: (id: string, v: number) => void;
  /** the live effect of the parts' own state rules */
  runtime: StateRuntime;
  /** the dialog this screen has open, if any: an in-page overlay, not another screen */
  dialog: { openId: string | null; onOpen: (id: string | null) => void };
  /** the live scroll of the containers on this screen */
  scrollRt?: ScrollRuntime;
  /** runs one rule action: what a timed rule does when its wait is over */
  onRule?: (a: RuleAction) => void;
}) {
  /* the dropdown whose menu is open, if any; its group is lifted above the rest */
  const [menuId, setMenuId] = useState<string | null>(null);
  const [railStates, setRailStates] = useState<Record<string, boolean>>({});
  const [railMotion, setRailMotion] = useState<(ReturnType<typeof railMotionTargets> & { animate: boolean }) | null>(null);
  const lang = useLang();
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const interactive = active && isPresent;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const screenRef = useRef<HTMLDivElement>(null);
  /* A text bound to another part reads it through this: the live value where the visitor has moved
     it, the part's own where they have not. */
  const readBound = (id: string): string | null => {
    const target = itemsOf(shownGroups).find((x) => x.id === id);
    return target ? readoutOf(target, values[target.id], lang) : null;
  };
  const shownGroups = useMemo(() => Object.entries(railStates).reduce((current, [id, railExpanded]) => {
    const patch = { railExpanded, railFolded: !railExpanded };
    return current.some((g) => g.items.some((it) => it.id === id))
      ? updateRail(current, [frame], widths, id, patch)
      : current.map((g) => ({ ...g, items: patchTree(g.items, id, patch) }));
  }, constrainModalRails(groups)), [groups, frame, widths, railStates]);
  /* How long this screen has been on show, on the preview's own (speeded-up) clock: rules that wait
     count from here, and a screen visited again starts its wait over. */
  const shownAt = useRef(runtime.now);
  const seconds = Math.max(0, (runtime.now - shownAt.current) / 1000);
  const timedFired = useRef(new Set<string>());
  /* the looks the variables ask for across this screen: a rule can aim at the part it sits on or at
     another one, so they are worked out for the screen as a whole and then handed to each part */
  /* A step that waits runs by itself: the part that heals in thirty seconds,
     the button that goes back to what it said. It counts from the moment the part entered the look
     it is in — or from this screen being shown, for the look it was drawn in — and each step runs
     once per visit, so a loop cannot spin on its own clock. */
  useEffect(() => {
    for (const it of itemsOf(shownGroups)) {
      const machines: { key: string; owner: string | null; flow: PartFlow | undefined }[] = [{ key: it.id, owner: it.id, flow: it.flow }];
      for (const [slot, flow] of Object.entries(it.slotFlows ?? {})) machines.push({ key: `${it.id}:${slot}`, owner: null, flow });
      for (const { key, owner, flow } of machines) {
        const entry = runtime.at[key];
        const elapsed = Math.max(0, (runtime.now - (entry?.since ?? shownAt.current)) / 1000);
        const step = firstDueStep(flow, lookAt(runtime.at, key), elapsed);
        if (!step || timedFired.current.has(`step:${key}:${step.id}`)) continue;
        timedFired.current.add(`step:${key}:${step.id}`);
        runtime.take(key, owner, step);
      }
    }
  }, [seconds, shownGroups, runtime]);
  const modalIds = new Set(shownGroups.flatMap((g) => { const rail = modalRailOf(g); return rail ? [rail.id] : []; }));
  /* an in-page overlay is a group on this very screen: it stays out of the way until a tap
     opens it, and the level it was authored with decides how it takes the screen over */
  const dialogItemIds = new Set(shownGroups.flatMap((g) => g.items.filter((it) => overlayLevelOf(it) !== null).map((it) => it.id)));
  const runAction = (a: Action) => (dialogItemIds.has(a.to) ? dialog.onOpen(a.to) : onAction(a));
  const hasModal = modalIds.size > 0;
  /* the overlay this screen has open, and the rules its level carries */
  const openOverlay = dialog.openId ? shownGroups.flatMap((g) => g.items).find((it) => it.id === dialog.openId) : undefined;
  const openLevel: OverlayLevel | null = openOverlay ? overlayLevelOf(openOverlay) : null;
  const openRule = openLevel ? overlayRuleOf(openLevel) : null;
  /** an in-page overlay with an inert background switches the other groups off too */
  const groupInert = (g: Group) =>
    (hasModal && !g.items.some((it) => modalIds.has(it.id))) ||
    (!!openRule?.inertBehind && !g.items.some((it) => it.id === dialog.openId));
  const modalActive = interactive && hasModal;
  /** The rail's own button: it folds every destination away and back, and the width it
   *  takes while open is the expanded one. A rail nested inside a container is patched in
   *  the tree, since `updateRail` only knows the parts that sit on the screen. */
  const changeRail = (id: string, railExpanded: boolean, animate: boolean) => {
    const patch = { railExpanded, railFolded: !railExpanded };
    const next = shownGroups.some((g) => g.items.some((it) => it.id === id))
      ? updateRail(shownGroups, [frame], widths, id, patch)
      : shownGroups.map((g) => ({ ...g, items: patchTree(g.items, id, patch) }));
    setRailMotion({ ...railMotionTargets(shownGroups, next, widths, id), animate: animate && !reducedMotion });
    setRailStates((prev) => ({ ...prev, [id]: railExpanded }));
  };
  const closeRails = (animate = false) => {
    if (!hasModal) return;
    const next = [...modalIds].reduce((current, id) => updateRail(current, [frame], widths, id, { railExpanded: false }), shownGroups);
    setRailMotion({ ...railMotionTargets(shownGroups, next, widths, [...modalIds][0]), animate: animate && !reducedMotion });
    setRailStates((prev) => ({ ...prev, ...Object.fromEntries([...modalIds].map((id) => [id, false])) }));
  };
  useEffect(() => {
    if (!railMotion) return;
    if (!railMotion.animate) {
      // Keep transition suppression through the immediate geometry paint only.
      // Removing it in the same render would restore M3Node's inline transition.
      let nextFrame = 0;
      const firstFrame = requestAnimationFrame(() => {
        nextFrame = requestAnimationFrame(() => setRailMotion(null));
      });
      return () => {
        cancelAnimationFrame(firstFrame);
        cancelAnimationFrame(nextFrame);
      };
    }
    const timer = window.setTimeout(() => setRailMotion(null), 260);
    return () => window.clearTimeout(timer);
  }, [railMotion]);
  useEffect(() => { setRailMotion(null); }, [groups, frame, widths]);
  /* The editor behind the preview is inert while it is up, so focus has nowhere else to
   * go: a screen that becomes the one on show takes it when nothing inside the preview
   * holds it, and a modal screen giving way to a plain one leaves the keyboard on the new
   * screen rather than on the body. */
  useEffect(() => {
    if (!interactive) return;
    const focused = document.activeElement;
    if (!focused || focused === document.body || focused.closest("[inert]")) screenRef.current?.focus();
  }, [interactive]);
  useEffect(() => {
    if (!modalActive) return;
    const previous = document.activeElement as HTMLElement | null;
    screenRef.current?.querySelector<HTMLButtonElement>(`[data-rail-modal] [data-rail-toggle]`)?.focus();
    return () => {
      // An exiting screen must not take focus back from its replacement. On unmount the
      // ref is already detached, so both branches stand down and the preview's own
      // restore to its opener is the one that runs.
      if (!interactiveRef.current) return;
      /* only a control of this screen is worth returning to: anything else is the page
       * behind the preview or a screen that has since left */
      if (previous?.isConnected && screenRef.current?.contains(previous) && !previous.closest("[inert]")) previous.focus();
      else screenRef.current?.focus();
    };
  }, [modalActive]);
  useEffect(() => {
    /* focus outside this screen, or inside it but off the modal, both belong on the toggle */
    if (modalActive && (!screenRef.current?.contains(document.activeElement) || !document.activeElement?.closest("[data-rail-modal]"))) {
      screenRef.current?.querySelector<HTMLButtonElement>("[data-rail-modal] [data-rail-toggle]")?.focus();
    }
  }, [shownGroups, modalActive]);
  /* Registered on every render, in the capture phase: the preview's own Escape and
   * Backspace handler listens in the bubble phase, so registration order never matters. */
  useEffect(() => {
    if (!modalActive) return;
    const onKey = (e: KeyboardEvent) => {
      /* the preview's own controls, such as an open screen menu, keep their keys */
      if (!screenRef.current?.contains(document.activeElement)) return;
      if (e.key === "Tab") {
        e.stopImmediatePropagation();
        const buttons = Array.from(screenRef.current?.querySelectorAll<HTMLButtonElement>("[data-rail-modal] button") ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (index < 0 || (!e.shiftKey && index === buttons.length - 1) || (e.shiftKey && index === 0)) {
          e.preventDefault();
          buttons[e.shiftKey ? buttons.length - 1 : 0]?.focus();
        }
        return;
      }
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeRails();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return (
    <div
      ref={screenRef}
      inert={!interactive}
      aria-hidden={!interactive || undefined}
      data-rail-motion={railMotion?.animate ? "true" : undefined}
      role={modalActive ? "dialog" : "group"}
      aria-modal={modalActive ? true : undefined}
      aria-label={modalActive ? t("railState", lang) : frame.name || t("screen", lang)}
      tabIndex={-1}
      /* the scrim and the pointer guard follow the rail itself, so a peek shows the modal
       * state as authored; the root's inert keeps a non-interactive screen from acting on it */
      onPointerDown={(e) => { if (hasModal) e.stopPropagation(); }}
      style={{
        position: "absolute",
        inset: 0,
        background: bare ? "transparent" : fillColor(frame.bg, p, "surface"),
        overflow: "hidden",
        outline: "none",
        /* A floating layer's page is a stage, not a screen: a tap on its empty part belongs to the
           screen behind, which is what puts a popover or a dimmed dialog away. What the page draws
           takes its taps back below. */
        pointerEvents: bare ? "none" : undefined,
      }}
    >
      <AnimatePresence>
        {hasModal && <motion.button
          key="rail-scrim"
          data-rail-scrim
          aria-label={t("collapseNavigation", lang)}
          tabIndex={-1}
          onClick={(e) => closeRails(e.detail !== 0)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
          style={{ position: "absolute", inset: 0, border: 0, padding: 0, background: "rgba(0,0,0,0.32)", zIndex: 3, pointerEvents: "auto" }}
        />}
      </AnimatePresence>
      {/* an open overlay sits over the screen. A scrim dims the screen behind and takes the
       *  tap that closes it; a popover has no dim, so it uses a bare catcher instead — the
       *  tap still only puts the bubble away, while the screen behind keeps its looks and
       *  stays readable to assistive tech. */}
      {openRule && (openRule.scrim > 0 || openRule.dismissOnOutside) && (
        <button
          key="overlay-scrim"
          data-dialog-scrim
          data-overlay-scrim={openLevel ?? undefined}
          aria-label={t("closeOverlay", lang)}
          tabIndex={-1}
          onClick={() => dialog.onOpen(null)}
          style={{
            position: "absolute",
            inset: 0,
            border: 0,
            padding: 0,
            background: openRule.scrim > 0 ? `rgba(0,0,0,${openRule.scrim})` : "transparent",
            zIndex: 5,
            pointerEvents: "auto",
          }}
        />
      )}
      {shownGroups.map((g) => {
        const isDialog = g.items.some((it) => overlayLevelOf(it) !== null);
        if (isDialog && !g.items.some((it) => it.id === dialog.openId)) return null;
        /* A navigation part's fold shrinks it to its own button: the group is drawn where layoutOf
           would draw the part, so the button stays put (the bar's fold lives in the runtime values,
           the rail's in the group itself). */
        const only = g.items.length === 1 ? g.items[0] : null;
        const raw = only ? values[`fold:${only.id}`] : undefined;
        const folded = !!only && (only.kind === "bottomNav" ? (raw === undefined ? !!only.barFolded : raw === 1) : !!only.railFolded);
        const fold = only && folded ? foldShift(only, widths) : NO_FOLD;
        return (
        <div
          key={g.id}
          className="m3-preview-group"
          data-preview-group={g.id}
          data-rail-animate={railMotion?.groups.has(g.id) ? "group" : undefined}
          data-rail-modal={g.items.some((it) => modalIds.has(it.id)) ? "true" : undefined}
          inert={groupInert(g)}
          style={
            g.free
              ? { position: "absolute", left: g.x - frame.x + fold.dx, top: g.y - frame.y + fold.dy, zIndex: isDialog ? 6 : g.items.some((it) => modalIds.has(it.id)) ? 4 : g.items.some((it) => it.id === menuId) ? 2 : undefined, pointerEvents: "auto" }
              : {
                  position: "absolute",
                  left: g.x - frame.x + fold.dx,
                  top: g.y - frame.y + fold.dy,
                  zIndex: isDialog ? 6 : g.items.some((it) => modalIds.has(it.id)) ? 4 : g.items.some((it) => it.id === menuId) ? 2 : undefined,
                  display: "flex",
                  flexDirection: g.axis === "x" ? "row" : "column",
                  alignItems: g.axis === "x" ? "center" : "stretch",
                  gap: GAP,
                  pointerEvents: "auto",
                }
          }
        >
          {((corners) => g.items.map((it, i) => {
            const n = g.free ? 1 : g.items.length;
            /* the same rule the canvas uses, so a circle is a circle in both */
            const radii = g.free ? (corners?.get(it.id) ?? baseRadii(it)) : runPartRadii(it, i === 0, i === n - 1, g.axis);
            const act = it.action;
            let shown = flipped.has(it.id) ? flippedLook(it) : it;
            if (VALUE_KINDS.includes(it.kind) && values[it.id] !== undefined) shown = { ...shown, value: values[it.id] };
            /* a text bound to a part reads it, live: dragging a slider moves the number beside it */
            if (it.shows) shown = { ...shown, label: readBound(it.shows) ?? shown.label };
            if (it.kind === "select" && values[it.id] !== undefined) shown = { ...shown, selected: values[it.id] };
            const navKind = it.kind === "bottomNav" || it.kind === "navRail" || it.kind === "tabs";
            /* bars with the same destinations are one bar to the visitor: the choice follows them across screens */
            const navKey = navKind ? `nav:${it.kind}:${(it.tabs ?? []).map((t) => t.label).join("|")}` : "";
            if (it.kind === "bottomNav" && it.barFolded !== undefined) {
              const foldKey = `fold:${it.id}`;
              shown = { ...shown, barFolded: values[foldKey] === undefined ? it.barFolded : values[foldKey] === 1 };
            }
            if (navKind && values[navKey] !== undefined && values[navKey] >= 0) shown = { ...shown, selected: values[navKey] };
            /* a row whose selection the author never set shows the destination the visitor tapped to open this screen */
            else if (navKind && it.selected === undefined && values[`${navKey}:opened:${frame.id}`] !== undefined) shown = { ...shown, selected: values[`${navKey}:opened:${frame.id}`] };
            /* a destination's own rules: fired by its tap, read back as its look */
            const flowOf = (key: string) => it.slotFlows?.[key];
            const tabLook = (t: NavTab, i: number) => {
              const flow = flowOf(`tab:${i}`);
              if (!flow) return t;
              const st = resolveStates({ ...it, id: `${it.id}:tab:${i}`, flow, label: t.label }, runtime.at, runtime.now);
              return { ...t, label: st.item.label, disabled: st.disabled, grown: st.grown };
            };
            if (it.slotFlows && it.tabs?.length) shown = { ...shown, tabs: it.tabs.map(tabLook) };
            const tap =
              act || flips(it) || it.flow
                ? () => {
                    if (flips(it)) onFlip(it.id);
                    /* the machine takes the tap when it has a step for the look it is in */
                    if (runtime.onStep(it.id, it.flow, it.id)) return;
                    if (act) runAction(act);
                  }
                : undefined;
            const slotActions = it.actions;
            const node = (
              <Tappable
                key={it.id}
                item={shown}
                p={p}
                radii={radii}
                widths={widths}
                railAnimating={railMotion?.items.has(it.id)}
                onTap={tap}
                /* runAction, not go: a part inside a container opens an overlay on this page
                   exactly as a part on the screen does */
                onAction={runAction}
                onFlip={onFlip}
                states={runtime}
                scrollRt={scrollRt}
                looks={runtime.pinned}
                onSlot={
                  slotActions || navKind
                    ? (slot, animate) => {
                        /* a tapped destination lights up where it opens nothing; where it opens a
                           screen, that screen's bar shows the destination its author chose, or the
                           tapped one when the author chose none */
                        const a = slotActions?.[slot];
                        if (slot === "barToggle") {
                          onValue(`fold:${it.id}`, shown.barFolded ? 0 : 1);
                          return;
                        }
                        /* a destination's own machine: the tab that changes what it says when tapped */
                        if (flowOf(slot) && runtime.onStep(`${it.id}:${slot}`, flowOf(slot), null)) return;
                        if (navKind && slot.startsWith("tab:")) {
                          onValue(navKey, a ? -1 : Number(slot.slice(4)));
                          if (a) onValue(`${navKey}:opened:${a.to}`, Number(slot.slice(4)));
                        }
                        if (modalIds.has(it.id)) closeRails(animate);
                        if (a) runAction(a);
                      }
                    : undefined
                }
                onValue={SCRUBS.includes(it.kind) ? (v) => onValue(it.id, v) : undefined}
                onSet={STEPS.includes(it.kind) ? (v) => onValue(it.id, v) : undefined}
                navToggle={
                  it.kind === "bottomNav" && it.barFolded !== undefined
                    ? { right: 0, top: 0, bottom: 0, width: 44 }
                    : it.kind === "navRail" && isWideRail(it)
                      ? { left: railMetrics(it).headerLeft, top: railMetrics(it).headerTop, width: 48, height: 48, borderRadius: 24 }
                      : undefined
                }
                onNavToggle={
                  it.kind === "bottomNav" && it.barFolded !== undefined
                    ? () => onValue(`fold:${it.id}`, shown.barFolded ? 0 : 1)
                    : it.kind === "navRail" && isWideRail(it)
                      ? () => changeRail(it.id, !!shown.railFolded, true)
                      : undefined
                }
                onPick={it.kind === "select" ? (i) => onValue(it.id, i) : undefined}
                menuOpen={menuId === it.id}
                onMenu={it.kind === "select" ? (open) => setMenuId(open ? it.id : null) : undefined}
                onRailToggle={it.kind === "navRail" && isWideRail(it) ? (animate) => changeRail(it.id, !it.railExpanded, animate) : undefined}
                /* Every part is handed the live tick state, whether or not it is a board itself:
                   a board may sit inside a container, and the box over its cells has to read the
                   same set wherever it is nested. A tick lands in that set, the way the visitor's
                   other taps do, so it survives the screen being looked at again. */
                checkOf={cellChecked(flipped)}
                /* a slider's value is the visitor's: every part is handed the live one, because a
                   slider may sit inside a container as easily as on the screen itself */
                liveValue={(it) => values[it.id]}
                setValue={onValue}
                readout={{
                  find: (id) => itemsOf(shownGroups).find((x) => x.id === id) ?? null,
                  live: (id) => values[id],
                  text: (target, live) => readoutOf(target, live, lang),
                }}
              />
            );
            if (!g.free) return node;
            const o = g.pos?.[it.id] ?? { x: 0, y: 0 };
            return (
              <div key={it.id} style={{ position: "absolute", left: o.x, top: o.y }}>
                {node}
              </div>
            );
          }))(g.free ? freeRadii(g, widths) : null)}
        </div>
        );
      })}
    </div>
  );
}

/** one part rewritten wherever it sits in a group's tree */
function patchTree(items: Item[], id: string, patch: Partial<Item>): Item[] {
  return items.map((it) =>
    it.id === id
      ? { ...it, ...patch }
      : it.children
        ? { ...it, children: patchTree(it.children, id, patch) as typeof it.children }
        : it,
  );
}

/** the screen being pulled in by a swipe, and the slide it arrives with */
type Peek = { frameId: string; t: Transition };

export function Preview({
  doc,
  widths,
  palette: p,
  startId,
  onClose,
}: {
  doc: Doc;
  widths: Record<string, number>;
  palette: Palette;
  startId: string | null;
  onClose: () => void;
}) {
  const lang = useLang();
  const frames = doc.frames;
  const [stack, setStack] = useState<Entry[]>(() => [{ id: startId ?? frames[0]?.id ?? "", t: "none" }]);
  const [anim, setAnim] = useState<Anim>({ t: "none", back: false });
  const theme = normalizeTheme(doc.theme);
  const spring = theme.motion === "expressive";
  const still = useReducedMotion();
  const [scale, setScale] = useState(1);
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const [values, setValues] = useState<Record<string, number>>({});
  /* when each part's own state rules were set off, and a clock that runs while any
     cooldown is counting down */
  const [at, setAt] = useState<MachineAt>({});
  /** the look a step latched onto a part, which stays until another step changes it */
  const [pinned, setPinned] = useState<Record<string, RulePatch>>({});
  const [now, setNow] = useState(() => Date.now());
  /* how much faster than real time the preview runs: 1 is ordinary, and the control in the bar
     raises it so a ten-minute wait can be watched in seconds */
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  speedRef.current = speed;
  const nowRef = useRef(now);
  nowRef.current = now;
  const lastTick = useRef(Date.now());
  /* whether any part in the document is waiting on a clock, so the ticker knows to run at all */
  const timed = useMemo(() => hasTimedSteps(itemsOf(doc.groups)), [doc.groups]);
  const timedRef = useRef(timed);
  timedRef.current = timed;
  /* the button the visitor touched last: it reads as the screen's current choice */
  const [activeId, setActiveId] = useState<string | null>(null);
  /* the in-page overlay each screen has open, keyed by the screen that owns it: two screens can
     each hold a dialog of their own, and stepping away and back finds each one as it was left */
  const [dialogs, setDialogs] = useState<Record<string, string | null>>({});
  /* the overlays each screen has open, keyed the same way: a dialog belongs to the screen that
     popped it, so it is still open when the visitor comes back to that screen */
  const [trail, setTrail] = useState<LayerTrail>({});
  const screenId = stack[stack.length - 1]?.id ?? frames[0]?.id ?? "";
  /* the screen the layer setters write to, kept in a ref so the callbacks around them stay stable */
  const hereRef = useRef(screenId);
  hereRef.current = screenId;
  /* the overlays of the screen on show, oldest first */
  const layers = layersIn(trail, screenId);
  const setLayers = useCallback((next: OverlayLayer[] | ((cur: OverlayLayer[]) => OverlayLayer[])) => {
    setTrail((t) => {
      const cur = layersIn(t, hereRef.current);
      return withLayers(t, hereRef.current, typeof next === "function" ? next(cur) : next);
    });
  }, []);
  const [peek, setPeek] = useState<Peek | null>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const peekRef = useRef(peek);
  peekRef.current = peek;
  const layerRef = useRef(layers);
  layerRef.current = layers;
  /* the box of the top overlay: it takes the keyboard while it is up */
  const layerFocus = useRef<HTMLDivElement | null>(null);
  const swiped = useRef(false);
  /* the scrolling container the finger went down on, until it lets go */
  const scrollArmed = useRef<{ id: string; pointer: number } | null>(null);

  useEffect(() => {
    if (!layers.length) return;
    const el = layerFocus.current;
    if (!el || el.contains(document.activeElement)) return;
    el.focus();
  }, [layers]);

  const flip = (id: string) =>
    setFlipped((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /* The preview's own clock: the wall clock, speeded up by the cheat control. Every countdown —
     a tap's cooldown, and a rule that waits ten minutes — reads this one, so "skip the wait" is a
     single number rather than something every document has to wire up for itself. */
  useEffect(() => {
    if (Object.keys(at).length === 0 && !timedRef.current) return;
    lastTick.current = Date.now();
    const timer = window.setInterval(() => {
      const real = Date.now();
      const step = real - lastTick.current;
      lastTick.current = real;
      setNow((prev) => prev + step * speedRef.current);
    }, 250);
    return () => window.clearInterval(timer);
  }, [at, timed]);

  const top = stack[stack.length - 1];
  const current = frames.find((f) => f.id === top?.id) ?? frames[0];
  /* A screen the document no longer holds takes the overlays it left behind with it. Everything
     else is remembered: leaving a screen is a step aside, not a reason to forget what was open. */
  const aliveFrames = frames.map((f) => f.id).join("|");
  useEffect(() => {
    const alive = new Set(aliveFrames.split("|"));
    setDialogs((m) => forgetScreens(m, alive));
    setTrail((t) => forgetScreens(t, alive));
  }, [aliveFrames]);
  /* What the tester watches here: the variables of the pages in play — this screen and whatever is
     popped over it — plus the shared ones. Another page's variables are not on screen, and a long
     list of them is noise; a page with none of its own falls back to the whole list, so nothing is
     ever out of reach. */
  const peekFrame = peek ? frames.find((f) => f.id === peek.frameId) : undefined;
  const { w: frameW, h: frameH } = current ? frameSizeOf(current) : { w: PHONE_W, h: PHONE_H };
  const phone = current ? isPhoneFrame(current) : true;
  /* every screen sits in the same bezel; only the corners tell a phone from a window */
  const radius = current ? frameRadius(current) : PHONE_R;
  const outerW = frameW + BEZEL * 2;
  const outerH = frameH + BEZEL * 2;
  const targetFrame = peekFrame ?? current;
  const { w: targetFrameW, h: targetFrameH } = targetFrame ? frameSizeOf(targetFrame) : { w: frameW, h: frameH };
  const targetRadius = targetFrame ? frameRadius(targetFrame) : radius;
  const targetOuterW = targetFrameW + BEZEL * 2;
  const targetOuterH = targetFrameH + BEZEL * 2;

  /* The shell is the size of the screen on show. When the screen changes it eases to
   * the new size in step with the slide; a tracked swipe steers it toward the target
   * with the finger, so a phone and a desktop screen hand over without a snap. */
  const prog = useMotionValue(0);
  const shellW = useMotionValue(outerW);
  const shellH = useMotionValue(outerH);
  const screenRadius = useMotionValue(radius);
  useEffect(() => {
    const opts = { duration: SLIDE_MS, ease: EASE };
    const runs = [animate(shellW, outerW, opts), animate(shellH, outerH, opts), animate(screenRadius, radius, opts)];
    return () => runs.forEach((r) => r.stop());
  }, [outerW, outerH, radius, shellW, shellH, screenRadius]);
  useEffect(
    () =>
      prog.on("change", (v) => {
        if (!peekRef.current) return;
        shellW.set(outerW + (targetOuterW - outerW) * v);
        shellH.set(outerH + (targetOuterH - outerH) * v);
        screenRadius.set(radius + (targetRadius - radius) * v);
      }),
    [prog, outerW, outerH, radius, targetOuterW, targetOuterH, targetRadius, shellW, shellH, screenRadius],
  );
  const screenW = useTransform(shellW, (v) => v - BEZEL * 2);
  const screenH = useTransform(shellH, (v) => v - BEZEL * 2);
  const shellRadius = useTransform(screenRadius, (v) => v + BEZEL);
  /* the stage is sized for the largest screen in the document, so the scale never
   * changes while a swipe crosses sizes or a screen is opened from the picker */
  const maxOuterW = Math.max(outerW, ...frames.map((f) => frameSizeOf(f).w + BEZEL * 2));
  const maxOuterH = Math.max(outerH, ...frames.map((f) => frameSizeOf(f).h + BEZEL * 2));
  const shellLeft = useTransform(shellW, (v) => ((maxOuterW - v) * scale) / 2);
  const shellTop = useTransform(shellH, (v) => ((maxOuterH - v) * scale) / 2);

  /* on a wide window the controls stand in a column at the right edge, clear of the phone;
   * on a phone they stay along the bottom, where the frame fills the width anyway */
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const fit = () => {
      const isWide = window.innerWidth >= 720;
      setWide(isWide);
      setScale(
        Math.min(1.4, (window.innerHeight - 32) / maxOuterH, (window.innerWidth - (isWide ? WIDE_CONTROL_SPACE + 16 : 16)) / maxOuterW),
      );
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [maxOuterH, maxOuterW]);

  /* a slide between a phone and a desktop screen would drag one shape through the
   * other; screens of different sizes cross-fade while the shell changes size */
  const sameSize = useCallback(
    (fromId: string, toId: string) => {
      const a = frames.find((f) => f.id === fromId);
      const b = frames.find((f) => f.id === toId);
      if (!a || !b) return true;
      const sa = frameSizeOf(a);
      const sb = frameSizeOf(b);
      return sa.w === sb.w && sa.h === sb.h;
    },
    [frames],
  );

  /** closes the top overlay, if the level it was opened with allows it */
  const closeLayer = useCallback(() => {
    setLayers((ls) => {
      const next = popLayer(ls);
      /* the top layer refused the back key: a system layer has to be dealt with */
      if (next.length === ls.length) return ls;
      const top = ls[ls.length - 1];
      if (top) setAnim({ t: top.t, back: true, spring });
      return next;
    });
  }, [spring, setLayers]);

  const back = useCallback(() => {
    if (peekRef.current) return;
    /* an overlay is in front of the screen stack: the back key closes it first */
    const where = backTarget(layerRef.current);
    if (where === "blocked") return;
    if (where === "layer") {
      closeLayer();
      return;
    }
    const s = stackRef.current;
    if (s.length < 2) return;
    const from = s[s.length - 1];
    const to = s[s.length - 2];
    setAnim({ t: sameSize(from.id, to.id) ? from.t : "fade", back: true, spring });
    setStack(s.slice(0, -1));
  }, [spring, sameSize, closeLayer]);

  const go = useCallback(
    (a: Action) => {
      if (swiped.current) return;
      if (a.to === BACK_TARGET) {
        back();
        return;
      }
      const target = frames.find((f) => f.id === a.to);
      if (!target) return;
      /* An overlay page opens over the screen that tapped it rather than replacing it, and
         the level it carries decides what happens to the layers already open. */
      if (isOverlayFrame(target)) {
        const level = overlayLevelOfFrame(target);
        /* an in-page overlay on this screen steps aside when the level clears popovers: two
           overlays at once would leave the back key with no single answer */
        if (overlayRuleOf(level).clears !== "none") {
          const here = stackRef.current[stackRef.current.length - 1]?.id;
          if (here) setDialogs((m) => (m[here] ? { ...m, [here]: null } : m));
        }
        setLayers((ls) => pushLayer(ls, { frameId: target.id, level, t: a.transition }));
        return;
      }
      const s = stackRef.current;
      const t = sameSize(s[s.length - 1].id, a.to) ? a.transition : "fade";
      setAnim({ t, back: false, spring });
      setStack((cur) => [...cur, { id: a.to, t }]);
    },
    [frames, back, spring, sameSize, setLayers],
  );

  /**
   * A part's conditional rules: the first one whose conditions hold takes the tap. Runs of
   * `goto`, `back` and `close` reuse the very paths a plain tap uses, so an overlay page
   * opened by a rule behaves exactly like one opened by a button.
   */
  /** Runs one rule action, down the very paths a tap takes, so a rule that waits lands exactly
   *  where the same rule would land if the visitor had tapped. `latched` marks the actions a step
   *  carries out: a look one of them asks for is a change the machine makes once, not a look that
   *  holds while a condition does, so it is recorded on the part rather than read off the rules. */
  const runRuleAction = useCallback(
    (a: RuleAction, latched = false, owner: string | null = null) => {
      if (a.kind === "goto") {
        go({ to: a.to, transition: a.transition });
        return;
      }
      if (a.kind === "back") {
        back();
        return;
      }
      if (a.kind === "close") {
        if (layerRef.current.length) closeLayer();
        else {
          const here = stackRef.current[stackRef.current.length - 1]?.id;
          if (here) setDialogs((m) => (m[here] ? { ...m, [here]: null } : m));
        }
        return;
      }
      if (a.kind === "look") {
        /* a rule's look is already on screen while its conditions hold: only a step latches one */
        const target = a.target ?? owner;
        if (!latched || !target) return;
        /* every property the action names is latched onto the part, and the ones it says nothing
           about keep their place: a step that shows a board's boxes leaves its colour alone */
        const patch = rulePatch(a);
        setPinned((m) => ({ ...m, [target]: { ...m[target], ...patch } }));
        return;
      }
    },
    [go, back, closeLayer],
  );

  /** Takes one step of a part's machine: the part lands in the look the step names, and whatever
   *  else the step asks for happens on the way — a jump, a value written, another part's look. */
  const take = useCallback(
    (key: string, owner: string | null, step: PartStep) => {
      setAt((m) => ({ ...m, [key]: { look: step.to, since: nowRef.current } }));
      for (const a of step.do ?? []) runRuleAction(a, true, owner);
    },
    [runRuleAction],
  );
  /** Takes the step a tap calls for, when the machine has one for the look the part is in. */
  const stepOnTap = useCallback(
    (key: string, flow: PartFlow | undefined, owner: string | null) => {
      const step = firstTapStep(flow, lookAt(at, key));
      if (!step) return false;
      take(key, owner, step);
      return true;
    },
    [at, take],
  );

  const [picker, setPicker] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        /* an open menu is the thing Escape dismisses, then the top overlay, then the preview */
        if (picker) setPicker(false);
        else if (speedOpen) setSpeedOpen(false);
        else if (backTarget(layerRef.current) === "layer") closeLayer();
        else onClose();
      }
      if (e.key === "Backspace" || e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, onClose, picker, speedOpen, closeLayer]);
  /* The control that opened the preview gets the keyboard back when it closes, whichever
   * screens were shown in between; a screen's own restore only covers its modal rail. Read
   * during the first render, before a screen's effect moves focus onto its rail. */
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));
  useEffect(() => () => { if (opener?.isConnected && !opener.closest("[inert]")) opener.focus(); }, [opener]);

  const groupsFor = useCallback((f: Frame) => groupsInFrame(doc.groups, f, frames, widths), [doc.groups, frames, widths]);
  const groups = useMemo(() => (current ? groupsFor(current) : []), [current, groupsFor]);
  const peekGroups = useMemo(() => (peekFrame ? groupsFor(peekFrame) : []), [peekFrame, groupsFor]);

  /* ---- finger-tracked swipes: only the swipes the author set on the frame ---- */
  const axisMV = useMotionValue(0); // 0 = x, 1 = y
  const enterMV = useMotionValue(0);
  const exitMV = useMotionValue(0);
  const curX = useTransform([prog, axisMV, exitMV], ([p, a, ex]: number[]) => (a === 0 ? pct(ex * p) : "0%"));
  const curY = useTransform([prog, axisMV, exitMV], ([p, a, ex]: number[]) => (a === 1 ? pct(ex * p) : "0%"));
  const curOp = useTransform(prog, (p: number) => 1 - 0.4 * p);
  const peekX = useTransform([prog, axisMV, enterMV], ([p, a, en]: number[]) => (a === 0 ? pct(en * (1 - p)) : "0%"));
  const peekY = useTransform([prog, axisMV, enterMV], ([p, a, en]: number[]) => (a === 1 ? pct(en * (1 - p)) : "0%"));

  const gesture = useRef<{
    id: number;
    x0: number;
    y0: number;
    phase: "idle" | "drag" | "none";
    dir?: SwipeDir;
    size: number;
    last: number;
    lastT: number;
    vel: number;
  } | null>(null);

  const onScreenPointerDown = (e: React.PointerEvent) => {
    /* swiping a screen away while an overlay is up would take the overlay with it */
    if (peekRef.current || layerRef.current.length > 0 || e.button !== 0) return;
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, phase: "idle", size: frameW, last: 0, lastT: e.timeStamp, vel: 0 };
    swiped.current = false;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = (e.clientX - g.x0) / scale;
      const dy = (e.clientY - g.y0) / scale;
      if (g.phase === "none") return;
      if (g.phase === "idle") {
        if (Math.hypot(dx, dy) < 8) return;
        const dir: SwipeDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        const s = stackRef.current;
        const cur = frames.find((f) => f.id === s[s.length - 1]?.id);
        if (!cur) return;
        const to = cur.swipe?.[dir];
        const spec = SWIPE_DIRS.find((d) => d.key === dir)!;
        /* only swipes the author set up move screens; nothing is inferred */
        let pk: Peek | null = null;
        if (to && frames.some((f) => f.id === to)) pk = { frameId: to, t: spec.transition };
        if (!pk) {
          g.phase = "none";
          return;
        }
        const sl = SLIDE_SPEC[pk.t]!;
        g.phase = "drag";
        g.dir = dir;
        const { w, h } = frameSizeOf(cur);
        g.size = sl.axis === "x" ? w : h;
        swiped.current = true;
        axisMV.set(sl.axis === "x" ? 0 : 1);
        enterMV.set(sl.enter);
        exitMV.set(sl.exit);
        prog.set(0);
        peekRef.current = pk;
        setPeek(pk);
      }
      const along = g.dir === "left" ? -dx : g.dir === "right" ? dx : g.dir === "up" ? -dy : dy;
      const pr = Math.max(0, Math.min(1, along / g.size));
      const dt = Math.max(1, e.timeStamp - g.lastT);
      g.vel = (pr - g.last) / dt;
      g.last = pr;
      g.lastT = e.timeStamp;
      prog.set(pr);
    };
    const up = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      gesture.current = null;
      if (g.phase !== "drag") return;
      const pk = peekRef.current;
      if (!pk) return;
      const commit = prog.get() > 0.25 || g.vel > 0.0012;
      animate(prog, commit ? 1 : 0, { duration: 0.26, ease: EASE }).then(() => {
        if (commit) {
          setAnim({ t: "none", back: false, spring });
          setStack((s) => [...s, { id: pk.frameId, t: pk.t }]);
        }
        peekRef.current = null;
        setPeek(null);
        enterMV.set(0);
        exitMV.set(0);
        prog.set(0);
        window.setTimeout(() => {
          swiped.current = false;
        }, 50);
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [frames, scale, prog, axisMV, enterMV, exitMV]);

  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerButton = useRef<HTMLButtonElement>(null);
  /* A menu hands focus back to its button when it closes; a chosen screen is then one Tab
   * away. The chosen item is still in the tree here because the menu animates out. */
  useEffect(() => {
    const focused = document.activeElement;
    if (!picker && focused !== pickerButton.current && pickerRef.current?.contains(focused)) pickerButton.current?.focus();
  }, [picker]);
  useEffect(() => {
    if (!picker) return;
    const onDown = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPicker(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [picker]);

  if (!current) {
    return null;
  }

  /* A screen's own state, so the current screen and every overlay page each get their own
     in-page overlay slot instead of sharing one. */
  const screenPropsFor = (f: Frame) => ({
    widths,
    p,
    onAction: go,
    flipped,
    onFlip: flip,
    values,
    onValue: (id: string, v: number) => setValues((m) => ({ ...m, [id]: v })),
    runtime: { at, pinned, now, onStep: stepOnTap, take, activeId, onActivate: setActiveId },
    onRule: runRuleAction,
    /* a container's scroll is a runtime value like a slider's position: what the visitor moved it
       to is remembered per part, and the screen's own swipe gives way to a drag a container claims */
    scrollRt: {
      at: (id: string) => ({ x: values[`scroll:x:${id}`], y: values[`scroll:y:${id}`] }),
      move: (id: string, axis: "x" | "y", value: number) => setValues((m) => ({ ...m, [`scroll:${axis}:${id}`]: value })),
      claim: () => {
        gesture.current = null;
      },
      /* the innermost scrolling container under the finger takes the press; the ones around it
         leave it alone, so a list inside a list does not move both at once */
      arm: (id: string, pointerId: number) => {
        const cur = scrollArmed.current;
        if (cur && cur.pointer === pointerId) return cur.id === id;
        scrollArmed.current = { id, pointer: pointerId };
        return true;
      },
      release: (id: string) => {
        if (scrollArmed.current?.id === id) scrollArmed.current = null;
      },
    },
    dialog: {
      openId: dialogs[f.id] ?? null,
      onOpen: (id: string | null) => setDialogs((m) => ({ ...m, [f.id]: id })),
    },
  });
  /* the top layer's rules decide whether the screen under it is still live */
  const topLayer = layers[layers.length - 1];
  const behind = topLayer ? overlayRuleOf(topLayer.level) : null;

  const barBtn: React.CSSProperties = {
    height: 40,
    padding: "0 14px 0 10px",
    borderRadius: 20,
    border: "none",
    background: "transparent",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    /* the column has a fixed width, so labels are cut with an ellipsis instead of widening it */
    width: wide ? "100%" : undefined,
    minWidth: 0,
  };
  /* the back key closes the top overlay first, so the button is live for that too */
  const canBack = stack.length >= 2 || backTarget(layers) === "layer";
  const label: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: EASE }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: p.surfaceContainer,
        display: "grid",
        placeItems: "center",
        boxSizing: "border-box",
        paddingRight: wide ? WIDE_CONTROL_SPACE : 0,
      }}
    >
      <div
        style={{
          width: maxOuterW * scale,
          height: maxOuterH * scale,
          position: "relative",
          marginBottom: wide ? 0 : 56,
        }}
      >
        <motion.div
          onPointerDown={onScreenPointerDown}
          style={{
            position: "absolute",
            left: shellLeft,
            top: shellTop,
            width: shellW,
            height: shellH,
            transform: `scale(${scale})`,
            touchAction: "none",
            transformOrigin: "0 0",
            borderRadius: shellRadius,
            background: p.inverseSurface,
            boxShadow: "0 30px 80px rgba(0,0,0,0.22)",
          }}
        >
          <motion.div
            onClickCapture={(e) => {
              if (swiped.current) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            style={{
              position: "absolute",
              left: BEZEL,
              top: BEZEL,
              width: screenW,
              height: screenH,
              borderRadius: screenRadius,
              overflow: "hidden",
              background: fillColor(current.bg, p, "surface"),
              fontFamily: fontFamilyOf(theme.font, lang),
              touchAction: "none",
            }}
          >
            <motion.div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                x: curX,
                y: curY,
                opacity: curOp,
              }}
            >
              <AnimatePresence initial={false} mode="popLayout" custom={anim}>
                <motion.div
                  key={current.id}
                  custom={anim}
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{ position: "absolute", inset: 0 }}
                >
                  <Screen frame={current} groups={groups} {...screenPropsFor(current)} active={!behind?.inertBehind} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
            {peek && peekFrame && (
              <motion.div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  x: peekX,
                  y: peekY,
                  pointerEvents: "none",
                }}
              >
                <Screen {...screenPropsFor(peekFrame)} active={false} frame={peekFrame} groups={peekGroups} />
              </motion.div>
            )}
            {/* The overlays opened over this screen, oldest at the bottom. Each one is a page
              * of its own, so the same bag opens from any screen without being copied, and it
              * keeps its own size: a dialog floats at its own box, a full-screen layer covers
              * the phone on its own. */}
            <AnimatePresence initial={false}>
              {layers.map((l, i) => {
                const lf = frames.find((f) => f.id === l.frameId);
                if (!lf) return null;
                const rule = overlayRuleOf(l.level);
                const { w, h } = frameSizeOf(lf);
                const isTop = i === layers.length - 1;
                /* closing a layer also drops anything opened on top of it */
                const close = () => setLayers((ls) => ls.slice(0, i));
                return (
                  <motion.div
                    key={l.frameId}
                    data-overlay={l.frameId}
                    data-overlay-level={l.level}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: still ? 0 : 0.18, ease: EASE }}
                    style={{ position: "absolute", inset: 0, zIndex: 10 + i }}
                  >
                    {(rule.scrim > 0 || rule.dismissOnOutside) && (
                      <button
                        data-overlay-scrim={l.level}
                        aria-label={t("closeOverlay", lang)}
                        tabIndex={-1}
                        onClick={close}
                        style={{
                          position: "absolute",
                          inset: 0,
                          border: 0,
                          padding: 0,
                          /* a popover has no dim, so its catcher is invisible: the tap it
                             swallows only puts the bubble away */
                          background: rule.scrim > 0 ? `rgba(0,0,0,${rule.scrim})` : "transparent",
                        }}
                      />
                    )}
                    <div
                      ref={isTop && rule.focusTrap ? layerFocus : undefined}
                      tabIndex={isTop && rule.focusTrap ? -1 : undefined}
                      inert={!isTop || undefined}
                      role={rule.inertBehind ? "dialog" : undefined}
                      aria-modal={rule.inertBehind || undefined}
                      aria-label={lf.name || t("roleOverlay", lang)}
                      style={{
                        position: "absolute",
                        left: (frameW - w) / 2,
                        top: (frameH - h) / 2,
                        width: w,
                        height: h,
                        /* A floating layer draws its parts and nothing else: its page is the stage the
                           dialog was laid out on, so a background or a rounded corner there would be a
                           second screen over the first one. What fills the screen is the screen. */
                        borderRadius: rule.float ? undefined : frameRadius(lf),
                        overflow: "hidden",
                        background: rule.float ? "transparent" : fillColor(lf.bg, p, "surface"),
                        boxShadow: !rule.float && rule.inertBehind ? "0 20px 60px rgba(0,0,0,0.28)" : undefined,
                        outline: "none",
                      }}
                    >
                      {/* The stage's own empty area is the dimmed screen the visitor sees, so a tap
                          there puts the layer away exactly as a tap on the scrim does. Without this a
                          page-sized dialog would cover the scrim and stop answering taps. */}
                      {rule.float && (rule.scrim > 0 || rule.dismissOnOutside) && (
                        <button
                          data-overlay-outside={l.level}
                          aria-label={t("closeOverlay", lang)}
                          tabIndex={-1}
                          onClick={close}
                          style={{ position: "absolute", inset: 0, border: 0, padding: 0, background: "transparent" }}
                        />
                      )}
                      {/* a floating layer shows the screen behind it: its page paints nothing */}
                      <Screen frame={lf} groups={groupsFor(lf)} {...screenPropsFor(lf)} active={isTop} bare={rule.float} />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>

      <div
        style={
          wide
            ? { position: "absolute", right: 20, bottom: 20, display: "flex", alignItems: "flex-end", pointerEvents: "none" }
            : { position: "absolute", left: 0, right: 0, bottom: 14, display: "flex", justifyContent: "center", pointerEvents: "none" }
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: wide ? "column" : "row",
            alignItems: wide ? "stretch" : "center",
            gap: 4,
            padding: 6,
            borderRadius: 28,
            background: p.surface,
            boxShadow: "0 4px 18px rgba(0,0,0,0.14)",
            pointerEvents: "auto",
            width: wide ? 172 : undefined,
            maxWidth: "calc(100vw - 24px)",
          }}
        >
          <button
            onClick={back}
            disabled={!canBack}
            title={t("back", lang)}
            className="m3-press"
            style={{
              ...barBtn,
              color: canBack ? p.onSurfaceVariant : p.outlineVariant,
              cursor: canBack ? "pointer" : "default",
            }}
          >
            <Icon name="arrow_back" size={20} />
            <span style={label}>{t("back", lang)}</span>
          </button>
          <div ref={pickerRef} style={{ position: "relative", minWidth: 0 }}>
            <button
              ref={pickerButton}
              onClick={() => setPicker((v) => !v)}
              title={t("screens", lang)}
              aria-expanded={picker}
              className="m3-press"
              style={{
                ...barBtn,
                background: p.secondaryContainer,
                color: p.onSecondaryContainer,
                maxWidth: wide ? undefined : 200,
              }}
            >
              <Icon name={phone ? "smartphone" : "desktop_windows"} size={20} />
              <span style={{ ...label, flex: wide ? 1 : undefined, textAlign: "left" }}>{current.name || t("screen", lang)}</span>
              <Icon name={wide ? (picker ? "chevron_right" : "chevron_left") : picker ? "expand_more" : "expand_less"} size={18} />
            </button>
            <AnimatePresence>
              {picker && (
                <motion.div
                  role="menu"
                  initial={wide ? { opacity: 0, x: 6, scale: 0.96 } : { opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, x: wide ? 0 : "-50%", y: 0, scale: 1 }}
                  exit={wide ? { opacity: 0, x: 6, scale: 0.96 } : { opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  style={{
                    position: "absolute",
                    ...(wide ? { right: "calc(100% + 14px)", bottom: 0 } : { bottom: 48, left: "50%" }),
                    minWidth: 160,
                    maxHeight: "50vh",
                    overflowY: "auto",
                    padding: 6,
                    borderRadius: 18,
                    background: p.surfaceContainerLow,
                    boxShadow: "0 6px 20px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    transformOrigin: wide ? "bottom right" : "bottom center",
                  }}
                >
                  {frames.map((f) => {
                    const on = f.id === current.id;
                    return (
                      <button
                        key={f.id}
                        role="menuitemradio"
                        aria-checked={on}
                        onClick={() => {
                          setPicker(false);
                          if (on) return;
                          setAnim({ t: "fade", back: false, spring });
                          setStack([{ id: f.id, t: "fade" }]);
                        }}
                        className="m3-press"
                        style={{
                          height: 40,
                          padding: "0 14px 0 10px",
                          borderRadius: 12,
                          border: "none",
                          background: on ? p.secondaryContainer : "transparent",
                          color: on ? p.onSecondaryContainer : p.onSurface,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          whiteSpace: "nowrap",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ width: 18, display: "inline-flex" }}>
                          {on ? <Icon name="check" size={18} /> : <Icon name={isPhoneFrame(f) ? "smartphone" : "desktop_windows"} size={18} />}
                        </span>
                        {f.name || t("screen", lang)}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* The cheat: the preview's own clock, speeded up. Every countdown reads it — a tap's
              cooldown and a rule that waits ten minutes alike — so a long wait can be watched in
              seconds without the document carrying a skip button of its own. */}
          <div style={{ position: "relative", minWidth: 0 }}>
            <button
              onClick={() => {
                setSpeedOpen((v) => !v);
                setPicker(false);
              }}
              title={t("timeSpeedHint", lang)}
              aria-expanded={speedOpen}
              className="m3-press"
              style={{ ...barBtn, color: speed > 1 ? p.primary : p.onSurfaceVariant }}
            >
              <Icon name="speed" size={20} />
              <span style={label}>{speed > 1 ? `×${speed}` : t("timeSpeed", lang)}</span>
            </button>
            <AnimatePresence>
              {speedOpen && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  style={{
                    position: "absolute",
                    ...(wide ? { right: "calc(100% + 14px)", bottom: 0 } : { bottom: 48, left: 0 }),
                    padding: 6,
                    borderRadius: 18,
                    background: p.surfaceContainerLow,
                    boxShadow: "0 6px 20px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    transformOrigin: wide ? "bottom right" : "bottom left",
                  }}
                >
                  {TIME_SPEEDS.map((v) => (
                    <button
                      key={v}
                      role="menuitemradio"
                      aria-checked={speed === v}
                      onClick={() => {
                        setSpeed(v);
                        setSpeedOpen(false);
                      }}
                      className="m3-press"
                      style={{ height: 40, padding: "0 14px 0 10px", borderRadius: 12, border: "none", background: speed === v ? p.secondaryContainer : "transparent", color: speed === v ? p.onSecondaryContainer : p.onSurface, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", textAlign: "left" }}
                    >
                      <span style={{ width: 18, display: "inline-flex" }}>{speed === v ? <Icon name="check" size={18} /> : null}</span>
                      ×{v}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={onClose} title={t("close", lang)} className="m3-press" style={{ ...barBtn, color: p.onSurfaceVariant }}>
            <Icon name="close" size={20} />
            <span style={label}>{t("closeBtn", lang)}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
