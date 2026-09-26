"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/tokens";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, useReducedMotion, useIsPresent } from "motion/react";
import type { TargetAndTransition, Variants } from "motion/react";
import {
  manyOf,
  slotWin,
  prizeLabel,
  CALENDAR_DAYS,
  JOYSTICK_TRAVEL,
  joystickAngle,
  defaultPrizes,
  pickPrize,
  wheelStopAngle,
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
  layerEntryOffset,
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
  hasAutoClose,
  AUTO_HIDE_STEP,
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
  sideRailW,
  labelSideOf,
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
  isOverlayItem,
  overlayRuleOf,
  popLayer,
  pushLayer,
  scrollOffset,
  rulePatch,
  START_LOOK,
  readoutOf,
  readText,
  maxOf,
  clampValue,
  valueAfter,
  PROGRESS_DEFAULT,
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
import { GridCellMarks, Icon, M3Node, ValueContext, type WheelRun } from "./M3Node";
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
  const tr = { duration: 0, ...zi };
  return {
    initial: { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 2 },
    animate: { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 2, transition: tr },
    exit: { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 1, transition: tr },
  };
}

/** How an overlay's page comes in. A screen is the whole stage, so a share of it is a share of the
 *  screen; a dialog is its own small box, and the same share of that would only nudge it — a page
 *  set to slide up from the bottom would move barely at all while the dim behind it appeared, which
 *  reads as the dialog standing still and the background moving. The page's offsets are therefore
 *  measured from the screen's own edge, wherever the page itself sits on it. */
function layerEntry(t: Transition, w: number, h: number, stageW: number, stageH: number, spring: boolean, still: boolean) {
  const spec = SLIDE_SPEC[t];
  const zi = { zIndex: { duration: 0 } };
  if (spec) {
    const from = layerEntryOffset(t, w, h, stageW, stageH);
    const tr = still ? { duration: 0, ...zi } : spring ? { ...SPRING, ...zi } : { duration: SLIDE_MS, ease: EASE, ...zi };
    return { initial: { ...from, opacity: 1, scale: 1 }, animate: { x: 0, y: 0, opacity: 1, scale: 1, transition: tr } };
  }
  if (t === "fade") {
    const tr = { duration: still ? 0 : 0.3, ease: EASE, ...zi };
    return { initial: { x: 0, y: 0, opacity: 0, scale: 1 }, animate: { x: 0, y: 0, opacity: 1, scale: 1, transition: tr } };
  }
  const tr = { duration: 0, ...zi };
  return { initial: { x: 0, y: 0, opacity: 1, scale: 1 }, animate: { x: 0, y: 0, opacity: 1, scale: 1, transition: tr } };
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

/** The parts whose taps are destinations rather than one target: a bar, a rail, a toolbar or a row
 *  of tabs. Their choice belongs to the screen, and the same destinations on two screens are one
 *  choice to the visitor — which is what the key below is built from. */
const isNavKind = (it: Item) => it.kind === "bottomNav" || it.kind === "navRail" || it.kind === "tabs" || it.kind === "sideTabs";
const navKeyOf = (it: Item) => `nav:${it.kind}:${(it.tabs ?? []).map((t) => t.label).join("|")}`;

/** The kinds whose value a visitor changes: a slider to scrub, a stepper to walk, a slider field to
 *  do both. One list, because a part of one of these kinds has to answer the same way wherever it
 *  stands — on the screen, inside a container, or inside a dialog panel. */
const VALUE_KINDS: Kind[] = ["slider", "stepper", "progressBar", "linearProgress", "circularProgress", "joystick", "calendar"];
const SCRUBS: Kind[] = ["slider"];
const STEPS: Kind[] = ["stepper"];
/** the pad, whose knob is dragged anywhere inside it, and the two draws, which are tapped */
const PADS: Kind[] = ["joystick"];
const DRAWS: Kind[] = ["wheel", "gridWheel", "gacha", "slot", "moneyTree", "eggSmash"];
/** the two parts whose second button draws ten at once */
const TENS: Kind[] = ["gacha", "moneyTree"];
/** the check-in calendar, whose tap signs the next day in */
const SIGNS: Kind[] = ["calendar"];
/** How long a draw takes, and how many whole turns the round wheel makes on the way. */
const SPIN_MS = 2600;
/** how many days a check-in calendar holds */
const SPIN_TURNS = 5;
/** The highlight steps round the pool about this often at the start, slowing towards the end. */
const SPIN_STEPS = 26;

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
  /** Takes the step a tap calls for. "none" leaves the tap to the plain action; "look" changed how
   *  the part is drawn and the tap still does whatever else it was meant to; "moved" landed the
   *  visitor somewhere, and one tap must not do that twice. `owner` is the part an untargeted look
   *  action changes. */
  onStep: (key: string, flow: PartFlow | undefined, owner: string | null) => "none" | "look" | "moved";
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
  wheelOf,
  reelsOf,
  onSpin,
  onSet,
  setValue,
  readout,
  marks,
  childView,
  childSlot,
  childMenu,
  menuOpenId,
}: {
  item: Item;
  p: Palette;
  radii: ReturnType<typeof baseRadii>;
  widths: Record<string, number>;
  /** Whether a board cell's checkbox is ticked right now: how the author left it, flipped by taps */
  checkOf?: (it: Item) => boolean;
  /** The live value the visitor has moved a slider to, by part */
  liveValue?: (it: Item) => number | undefined;
  /** what a prize wheel is showing while it spins */
  wheelOf?: (id: string) => WheelRun | undefined;
  /** the three symbols a slot machine shows */
  reelsOf?: (id: string) => number[] | undefined;
  /** starts a prize wheel's draw */
  onSpin?: (it: Item) => void;
  /** A control inside the part asking for a value of its own: the box and the buttons of a stepper */
  onSet?: (v: number) => void;
  /** The screen's own setter, for a control inside a part the container holds */
  setValue?: (id: string, v: number) => void;
  /* `text` also takes the text doing the reading: whether it keeps its own words (`mix`) is a fact
     about the reader, not about the part it reads */
  readout?: { find: (id: string) => Item | null; live: (id: string) => number | undefined; text: (it: Item, live?: number, reader?: Item) => string };
  /** what the part's own container draws over it, a board's cell checkbox included */
  marks?: React.ReactNode;
  /* What the screen makes of a part this container holds: the value the visitor moved it to, the
     words a text reads, the destination a row of tabs was switched to — and what a tap on one of
     those destinations does. A container passes them straight down, so nesting changes nothing. */
  childView?: (it: Item) => Item;
  childSlot?: (it: Item, slot: string, animate?: boolean) => void;
  /** the dropdown a held part opens: one menu at a time on the screen, whoever opened it, so the
   *  part that opened it is named along with the fact */
  childMenu?: (id: string, open: boolean) => void;
  /** which part's dropdown menu is the open one: a menu inside a container opens like any other */
  menuOpenId?: string | null;
  onTap?: (e?: React.MouseEvent) => void;
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

  /* Where the finger is along the track, as the part's own number: a slider that runs to ten thousand
     is scrubbed across the same width and lands on its own scale. */
  const dragValue = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !onValue) return;
    const share = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onValue(clampValue(share * maxOf(item), maxOf(item)));
  };

  /* The pad is dragged anywhere inside it: the knob follows the finger and the direction it points
     at is the part's value, so a movement wheel reads the same way a slider does. The middle is not a
     direction, so a finger there is worth nothing rather than a random angle. */
  const dragPad = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !onValue) return;
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const travel = Math.max(1, Math.min(r.width, r.height) * JOYSTICK_TRAVEL);
    onValue(Math.hypot(dx, dy) < travel * 0.22 ? 0 : clampValue(joystickAngle(dx, dy), maxOf(item)));
  };
  const isPad = item.kind === "joystick";
  const dragPart = (e: React.PointerEvent) => (isPad ? dragPad(e) : dragValue(e));

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
  if (onSlot && item.kind === "sideTabs") {
    const n = item.tabs?.length ?? 0;
    /* A side row's destinations are rows down one edge — the left, or the right when the author put
       them there — so their hit areas are too; the page beside them belongs to whatever it holds. */
    const rail = sideRailW(item);
    const atRight = labelSideOf(item) === "right";
    for (let i = 0; i < n; i++)
      slots.push({ key: `tab:${i}`, style: { ...(atRight ? { right: 0 } : { left: 0 }), width: rail, top: 8 + i * TAB_ROW_H, height: TAB_ROW_H, borderRadius: 12 } });
  }
  if (onSlot && item.kind === "tabs" && !scrollTabs) {
    const n = item.tabs?.length ?? 0;
    /* A tab row is only its strip: the rest of the box is the page of the tab in front, and a tap
       there belongs to whatever the page holds, not to the labels — which sit on the edge the author
       chose, the top or the foot of the box. A row wide enough to scroll has its own areas, measured
       inside the scrolling layer, so they are not added here. */
    const atBottom = labelSideOf(item) === "bottom";
    for (let i = 0; i < n; i++)
      slots.push({ key: `tab:${i}`, style: { left: `${(i / n) * 100}%`, width: `${100 / n}%`, ...(atBottom ? { bottom: 0 } : { top: 0 }), height: TAB_ROW_H, borderRadius: 16 } });
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
    const read = c.shows && readout ? (() => { const t = readout.find(c.shows!); return t ? readout.text(t, readout.live(t.id), c) : null; })() : null;
    /* the screen's own reading of the part, which is what carries a switch the visitor flipped, a
       row of tabs they switched and the words a text reads beside them */
    const shownChild = childView
      ? { ...childView(c), ...(live !== undefined ? { value: live } : {}) }
      : { ...c, ...(live !== undefined ? { value: live } : {}), ...(read !== null ? { label: read } : {}) };
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
                  /* the machine runs once, in the tap itself: see the note on the group's own tap */
                  if (c.action) onAction?.(c.action);
                }
              : undefined
        }
        onAction={onAction}
        onFlip={onFlip}
        scrollRt={scrollRt}
        looks={looks}
        /* a bar, a rail or a row of tabs the container holds keeps its destinations tappable, and a
           dropdown it holds opens the screen's one menu */
        onSlot={childSlot && (c.actions || c.slotFlows || isNavKind(c)) ? (slot, animate) => childSlot(c, slot, animate) : undefined}
        childView={childView}
        childSlot={childSlot}
        childMenu={childMenu}
        onPick={c.kind === "select" && setValue ? (i) => setValue(c.id, i) : undefined}
        menuOpen={menuOpenId === c.id}
        onMenu={c.kind === "select" && childMenu ? (open) => childMenu(c.id, open) : undefined}
        menuOpenId={menuOpenId}
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
          dragPart(e);
          setPressed(true);
          return;
        }
        if (live) setPressed(true);
      }}
      onPointerMove={(e) => {
        if (onValue && pressed) dragPart(e);
      }}
      onPointerUp={() => {
        /* a movement stick springs back to the middle unless the author said it stays put */
        if (isPad && item.joystickReturn !== false) onValue?.(0);
        setPressed(false);
      }}
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
              /* The part's own machine goes first. A step that only changes how the part is drawn
                 still leaves the tap its own effect — grey out and go, as both cards promise — but a
                 step that lands the visitor somewhere is the whole of the tap: running the plain
                 action as well pushed a page and opened a dialog from one tap, which is how a screen
                 came to slide while the dialog it was meant to open only appeared. */
              const took = states?.onStep(view.id, view.flow, view.id) ?? "none";
              if (SHAPED.includes(view.kind)) states?.onActivate(view.id);
              if (took !== "moved") onTap?.(e);
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
      <ValueContext.Provider value={{ onSet, wheel: wheelOf, reels: reelsOf }}>
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
  wheelOf,
  reelsOf,
  onSpin,
  onDraw,
  onSignIn,
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
  /** what a prize wheel is showing while it spins, and how a draw is started */
  wheelOf?: (id: string) => WheelRun | undefined;
  onSpin?: (it: Item) => void;
  /** starts a draw of one or of ten, from whichever button was tapped */
  onDraw?: (it: Item, many: boolean) => void;
  /** the three symbols a slot machine shows */
  reelsOf?: (id: string) => number[] | undefined;
  /** signs the next day of a check-in calendar */
  onSignIn?: (it: Item) => void;
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
  /* What a part's value is right now: where the visitor moved it to, else what the author set. A step
     that adds one starts from this, which is what makes a plus button a stepper. */
  const valueNow = (id: string): number => values[id] ?? itemsOf(shownGroups).find((x) => x.id === id)?.value ?? PROGRESS_DEFAULT;
  /* A text bound to another part reads it through this: the live value where the visitor has moved
     it, the part's own where they have not. It reads the bare number — the percent sign belongs to
     the slider's own display, and the words around the number are the author's — and a text that
     asked for both keeps its own words with the number dropped into them. */
  const readBound = (reader: Item): string | null => {
    const target = itemsOf(shownGroups).find((x) => x.id === reader.shows);
    return target ? readText(reader, readoutOf(target, values[target.id], lang, false)) : null;
  };
  /* A container is not a different world: a part the visitor can move, flip or choose answers the
     same way in a dialog panel as it does standing on the screen. This is the one place the
     visitor's own changes are read back onto a part, and a container hands it to its children. */
  const sample = (it: Item): Item => {
    let next = flipped.has(it.id) ? flippedLook(it) : it;
    if (VALUE_KINDS.includes(it.kind) && values[it.id] !== undefined) next = { ...next, value: values[it.id] };
    /* a text bound to a part reads it, live: dragging a slider moves the number beside it */
    if (it.shows) next = { ...next, label: readBound(it) ?? next.label };
    if (it.kind === "select" && values[it.id] !== undefined) next = { ...next, selected: values[it.id] };
    if (it.kind === "bottomNav" && it.barFolded !== undefined) {
      const folded = values[`fold:${it.id}`];
      next = { ...next, barFolded: folded === undefined ? it.barFolded : folded === 1 };
    }
    if (isNavKind(it)) {
      /* bars and rows with the same destinations are one part to the visitor: the choice follows
         them from screen to screen, and a row inside a dialog shows it too */
      const key = navKeyOf(it);
      if (values[key] !== undefined && values[key] >= 0) next = { ...next, selected: values[key] };
      /* a row whose selection the author never set shows the destination the visitor tapped to
         open this screen */
      else if (it.selected === undefined && values[`${key}:opened:${frame.id}`] !== undefined) next = { ...next, selected: values[`${key}:opened:${frame.id}`] };
    }
    return next;
  };
  /* One destination of a bar, a rail, a toolbar or a row of tabs — wherever that part stands. The
     choice lives on the screen rather than on the part (the same row of tabs on two screens shows
     one choice), so the screen is what answers the tap. */
  const pickSlot = (it: Item, slot: string, animate = true) => {
    const a = it.actions?.[slot];
    if (slot === "barToggle") {
      const folded = values[`fold:${it.id}`] === undefined ? !!it.barFolded : values[`fold:${it.id}`] === 1;
      onValue(`fold:${it.id}`, folded ? 0 : 1);
      return;
    }
    /* a destination's own machine: the tab that changes what it says when tapped */
    const flow = it.slotFlows?.[slot];
    if (flow && runtime.onStep(`${it.id}:${slot}`, flow, null) !== "none") return;
    if (isNavKind(it) && slot.startsWith("tab:")) {
      const key = navKeyOf(it);
      onValue(key, a ? -1 : Number(slot.slice(4)));
      if (a) onValue(`${key}:opened:${a.to}`, Number(slot.slice(4)));
    }
    if (modalIds.has(it.id)) closeRails(animate);
    if (a) runAction(a);
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
  /* ---------- the parts that put themselves away ---------- */
  /* A part with `autoClose` counts down once the visitor can see it — the activity entry that closes
     after three days, the bubble that dismisses itself. The count starts when the part appears: an
     in-page bubble from the moment it is opened (not from the screen behind it being drawn, which
     would already have spent the bubble's life before the visitor ever opened it), everything else
     from this screen being shown. A bubble that is opened again gets its whole life again. */
  const autoDone = useRef(new Set<string>());
  const autoSince = useRef<Record<string, number>>({});
  useEffect(() => {
    for (const it of itemsOf(shownGroups)) {
      const secs = it.autoClose ?? 0;
      if (secs <= 0) continue;
      const bubble = isOverlayItem(it);
      if (bubble && dialog.openId !== it.id) {
        /* not up: a bubble that is opened again starts over */
        delete autoSince.current[it.id];
        autoDone.current.delete(it.id);
        continue;
      }
      autoSince.current[it.id] ??= bubble ? runtime.now : shownAt.current;
      if (autoDone.current.has(it.id)) continue;
      if ((runtime.now - autoSince.current[it.id]) / 1000 < secs) continue;
      autoDone.current.add(it.id);
      if (bubble) dialog.onOpen(null);
      else runtime.take(it.id, it.id, AUTO_HIDE_STEP);
    }
  }, [seconds, shownGroups, runtime, dialog]);
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
            /* what the visitor has made of this part — dragged, flipped, switched, read: the same
               function a container hands its own children, so a part inside a dialog panel answers
               exactly like the same part standing on the screen */
            let shown = sample(it);
            const navKind = isNavKind(it);
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
              TENS.includes(it.kind)
                ? (e?: React.MouseEvent) => {
                    /* the two buttons sit along the foot of the machine: the right-hand one draws ten */
                    const el = e?.currentTarget as HTMLElement | undefined;
                    const r = el?.getBoundingClientRect();
                    const many = !!r && !!e && e.clientY - r.top > r.height * 0.6 && e.clientX - r.left > r.width / 2;
                    onDraw?.(it, many);
                  }
                : DRAWS.includes(it.kind)
                ? () => onSpin?.(it)
                : SIGNS.includes(it.kind)
                ? () => onSignIn?.(it)
                : act || flips(it) || it.flow
                ? () => {
                    if (flips(it)) onFlip(it.id);
                    /* The machine is not run here: the tap itself takes the step, before this
                       closure is reached, and running it a second time would take the same step
                       twice — two overlays closed by one tap, a screen pushed twice, a value
                       walked twice. What is left here is the tap's own effect. */
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
                onSlot={slotActions || navKind ? (slot, animate) => pickSlot(it, slot, animate) : undefined}
                /* a container hands these to its own children, so a bar, a row of tabs or a
                   dropdown inside a dialog panel answers exactly as one on the screen does */
                childView={sample}
                childSlot={pickSlot}
                childMenu={(id, open) => setMenuId(open ? id : null)}
                menuOpenId={menuId}
                onValue={SCRUBS.includes(it.kind) || PADS.includes(it.kind) ? (v) => onValue(it.id, v) : undefined}
                wheelOf={wheelOf}
                onSpin={onSpin}
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
                  /* a text reading a part gets the bare number: the % is the slider's own switch */
                  text: (target, live, reader) => (reader ? readText(reader, readoutOf(target, live, lang, false)) : readoutOf(target, live, lang, false)),
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
  /* whether anything in the document is waiting on a clock, so the ticker knows to run at all: a step
     that waits, a part that puts itself away, an overlay page that closes itself */
  const timed = useMemo(
    () => hasTimedSteps(itemsOf(doc.groups)) || hasAutoClose(itemsOf(doc.groups)) || frames.some((f) => !!f.autoClose),
    [doc.groups, frames],
  );
  const timedRef = useRef(timed);
  timedRef.current = timed;
  /* the button the visitor touched last: it reads as the screen's current choice */
  const [activeId, setActiveId] = useState<string | null>(null);
  /* the in-page overlay each screen has open, keyed by the screen that owns it: two screens can
     each hold a dialog of their own, and stepping away and back finds each one as it was left */
  const [dialogs, setDialogs] = useState<Record<string, string | null>>({});
  /** what each prize wheel is showing while a draw runs, and the prize a finished draw won */
  const [runs, setRuns] = useState<Record<string, WheelRun>>({});
  const [won, setWon] = useState<{ id: string; label: string; icon?: string | null; list?: { label: string; icon?: string | null }[] } | null>(null);
  /** the three symbols a slot machine is showing, while a draw runs */
  const [reels, setReels] = useState<Record<string, number[]>>({});
  const runRef = useRef<Record<string, number>>({});
  /** Spins a wheel: the disc turns to the winning wedge, the highlight runs round the pool, and the
   *  prize is named when it stops. Which prize comes up is drawn on the weights the author set. */
  const signIn = useCallback((it: Item) => {
    const day = Math.min(CALENDAR_DAYS, (values[it.id] ?? it.value ?? 0) + 1);
    setValues((v) => ({ ...v, [it.id]: day }));
    setWon({ id: it.id, label: String(day), icon: "calendar_month" });
  }, [values]);

  const spin = useCallback((it: Item) => {
    const prizes = it.prizes && it.prizes.length ? it.prizes : defaultPrizes();
    if (runRef.current[it.id] !== undefined) return;
    const n = prizes.length;
    /* A slot machine rolls each of its three reels on its own and pays out when two or three agree;
       everything else draws a single prize. A capsule machine's second button draws ten at once. */
    const rolls = it.kind === "slot" ? [pickPrize(prizes, Math.random()), pickPrize(prizes, Math.random()), pickPrize(prizes, Math.random())] : [];
    const many = TENS.includes(it.kind) && ten.current.has(it.id);
    const drawn = many ? Array.from({ length: manyOf(it) }, () => pickPrize(prizes, Math.random())) : [];
    const wonIndex = it.kind === "slot" ? slotWin(rolls) : many ? -1 : pickPrize(prizes, Math.random());
    const blank = -1;
    const index = it.kind === "slot" ? (wonIndex >= 0 ? wonIndex : blank) : many ? blank : wonIndex;
    const angle = it.kind === "wheel" ? wheelStopAngle(pickPrize(prizes, Math.random()), n, SPIN_TURNS) : it.kind === "eggSmash" ? 62 : 0;
    if (it.kind === "slot") setReels((r) => ({ ...r, [it.id]: rolls }));
    setRuns((r) => ({ ...r, [it.id]: { angle: 0, lit: index, ms: 0 } }));
    const started = performance.now();
    /* the first frame lays the wheel down where it starts, the next one sends it on its way, so the
       turn is a transition and not a jump */
    const go = () => {
      setRuns((r) => ({ ...r, [it.id]: { angle, lit: index, ms: SPIN_MS } }));
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / SPIN_MS);
        /* the highlight runs faster than the wheel itself and eases off with it */
        const stepped = Math.min(SPIN_STEPS, Math.floor(Math.pow(t, 0.55) * SPIN_STEPS));
        setRuns((r) => ({ ...r, [it.id]: { angle, lit: ((stepped % n) + n) % n, ms: SPIN_MS } }));
        if (t < 1) {
          runRef.current[it.id] = requestAnimationFrame(tick);
          return;
        }
        delete runRef.current[it.id];
        ten.current.delete(it.id);
        setRuns((r) => ({ ...r, [it.id]: { angle, lit: index, ms: SPIN_MS } }));
        if (it.kind === "slot") {
          /* the three symbols stay on the reels, and the dialog names what they paid out */
          setReels((r) => ({ ...r, [it.id]: rolls }));
          const win = wonIndex >= 0 ? prizes[wonIndex] : undefined;
          setWon({ id: it.id, label: prizeLabel(win), icon: win?.icon ?? "sentiment_dissatisfied" });
          return;
        }
        if (it.kind === "eggSmash") {
          setValues((v) => ({ ...v, [it.id]: Math.min(n, (v[it.id] ?? it.value ?? 0) + 1) }));
        }
        if (many) {
          /* ten draws of the same prize are one line with a count: "first prize ×2" */
          const folded: { label: string; icon?: string | null; n: number }[] = [];
          for (const at of drawn) {
            const label = prizeLabel(prizes[at]);
            const seen = folded.find((f) => f.label === label);
            if (seen) seen.n += 1;
            else folded.push({ label, icon: prizes[at]?.icon ?? null, n: 1 });
          }
          setWon({ id: it.id, label: "", icon: "toys", list: folded.map((f) => ({ label: f.n > 1 ? `${f.label} ×${f.n}` : f.label, icon: f.icon })) });
          return;
        }
        setWon({ id: it.id, label: prizes[index]?.label ?? "", icon: prizes[index]?.icon ?? null });
      };
      runRef.current[it.id] = requestAnimationFrame(tick);
    };
    requestAnimationFrame(go);
  }, []);
  useEffect(
    () => () => {
      for (const frame of Object.values(runRef.current)) cancelAnimationFrame(frame);
      runRef.current = {};
    },
    [],
  );
  /** whether the rule action just run landed the visitor somewhere: one tap must not land twice */
  const landedRef = useRef(false);
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

  /* ---------- overlay pages that close themselves ---------- */
  /* An overlay page may carry its own `autoClose`: the bubble that is up for eight seconds and then
     is gone, the notice nobody has to tap away. It counts from the page coming up, and closing it
     drops whatever was opened on top of it, exactly as its own close button does. */
  const layerDone = useRef(new Set<string>());
  const layerSince = useRef<Record<string, number>>({});
  useEffect(() => {
    const up = new Set(layers.map((l) => l.frameId));
    for (const id of Object.keys(layerSince.current)) {
      if (!up.has(id)) {
        /* down again: the next time it comes up it gets its whole life */
        delete layerSince.current[id];
        layerDone.current.delete(id);
      }
    }
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      const secs = frames.find((f) => f.id === l.frameId)?.autoClose ?? 0;
      if (secs <= 0) continue;
      layerSince.current[l.frameId] ??= now;
      if (layerDone.current.has(l.frameId)) continue;
      if ((now - layerSince.current[l.frameId]) / 1000 < secs) continue;
      layerDone.current.add(l.frameId);
      setLayers((ls) => ls.slice(0, i));
      break;
    }
  }, [now, layers, frames, setLayers]);

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
  /** Where a step's number goes: the same store the visitor's own slider writes to, so a rule and a
   *  drag share one value and a drag afterwards still has the last word. */
  const writeValue = useCallback((id: string, v: number) => setValues((m) => ({ ...m, [id]: v })), []);
  /** What a part's value is right now: the live one, else the one the author set. */
  const currentValue = useCallback(
    (id: string) => values[id] ?? itemsOf(doc.groups).find((x) => x.id === id)?.value ?? PROGRESS_DEFAULT,
    [values, doc.groups],
  );

  const runRuleAction = useCallback(
    (a: RuleAction, latched = false, owner: string | null = null) => {
      if (a.kind === "goto") {
        landedRef.current = true;
        go({ to: a.to, transition: a.transition });
        return;
      }
      if (a.kind === "back") {
        landedRef.current = true;
        back();
        return;
      }
      if (a.kind === "close") {
        landedRef.current = true;
        if (layerRef.current.length) closeLayer();
        else {
          const here = stackRef.current[stackRef.current.length - 1]?.id;
          if (here) setDialogs((m) => (m[here] ? { ...m, [here]: null } : m));
        }
        return;
      }
      /* every overlay this screen has open goes at once — the in-page one too, and whatever the
         visitor had stacked: a "finish" button that puts the whole flow of dialogs away */
      if (a.kind === "closeAll") {
        landedRef.current = true;
        setLayers([]);
        const here = stackRef.current[stackRef.current.length - 1]?.id;
        if (here) setDialogs((m) => ({ ...m, [here]: null }));
        return;
      }
      if (a.kind === "look") {
        /* a rule's look is already on screen while its conditions hold: only a step latches one */
        const target = a.target ?? owner;
        if (!latched || !target) return;
        /* Every property the action names is latched onto the part, and the ones it says nothing
           about keep their place: a step that shows a board's boxes leaves its colour alone. */
        const patch = rulePatch(a);
        /* A number is the exception: it goes through the store the visitor's own slider writes to, so
           "value + 1" really walks the value and a drag afterwards still has the last word. The step
           stops at the target's own ceiling, which is why "add 500" is a real move on a slider that
           runs to ten thousand and a jump to the top on one that stops at a hundred. */
        if (a.value !== undefined) {
          delete patch.value;
          const found = itemsOf(doc.groups).find((x) => x.id === target);
          const top = maxOf(found ?? {});
          writeValue(target, valueAfter(a.valueOp, currentValue(target), a.value, top));
        }
        setPinned((m) => ({ ...m, [target]: { ...m[target], ...patch } }));
        return;
      }
    },
    [go, back, closeLayer, writeValue, currentValue],
  );

  /** Takes one step of a part's machine: the part lands in the look the step names, and whatever
   *  else the step asks for happens on the way — a jump, a value written, another part's look. */
  const take = useCallback(
    (key: string, owner: string | null, step: PartStep) => {
      /* a step with no destination leaves the part in the look it is in: only what it does happens,
         so the same tap keeps firing — which is how a button drives a slider up and down */
      setAt((m) => ({ ...m, [key]: { look: step.to ?? m[key]?.look ?? START_LOOK, since: nowRef.current } }));
      for (const a of step.do ?? []) runRuleAction(a, true, owner);
    },
    [runRuleAction],
  );
  /** Takes the step a tap calls for, when the machine has one for the look the part is in. */
  /** the parts whose next draw is the ten-at-once one, and the two buttons that start one */
  const ten = useRef(new Set<string>());
  const draw = useCallback(
    (it: Item, many: boolean) => {
      if (many) ten.current.add(it.id);
      else ten.current.delete(it.id);
      spin(it);
    },
    [spin],
  );

  const stepOnTap = useCallback(
    (key: string, flow: PartFlow | undefined, owner: string | null): "none" | "look" | "moved" => {
      const step = firstTapStep(flow, lookAt(at, key));
      if (!step) return "none";
      landedRef.current = false;
      take(key, owner, step);
      return landedRef.current ? "moved" : "look";
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
    onValue: writeValue,
    runtime: { at, pinned, now, onStep: stepOnTap, take, activeId, onActivate: setActiveId },
    wheelOf: (id: string) => runs[id],
    reelsOf: (id: string) => reels[id],
    onSpin: spin,
    onDraw: draw,
    onSignIn: signIn,
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
            {won && (
              <>
                <div
                  data-prize-scrim=""
                  onClick={() => setWon(null)}
                  style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", zIndex: 40 }}
                />
                <div
                  data-prize-dialog=""
                  role="dialog"
                  aria-label={t("wonPrize", lang)}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    minWidth: 260,
                    maxWidth: "94%",
                    padding: "22px 18px 14px",
                    borderRadius: 28,
                    background: p.surfaceContainerHigh,
                    color: p.onSurface,
                    boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                    zIndex: 41,
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: p.onSurfaceVariant }}>{t("wonPrize", lang)}</span>
                  {won.icon && <Icon name={won.icon} size={40} color={p.primary} />}
                  {won.list ? (
                    <div data-won-list={won.list.length} style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6, width: "100%" }}>
                      {won.list.map((pr, i) => (
                        <span key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 3, padding: "6px 4px", borderRadius: 12, background: p.surfaceContainerHighest, fontSize: 11, fontWeight: 600, minWidth: 0, lineHeight: 1.15, wordBreak: "break-word" }}>
                          {pr.icon && <Icon name={pr.icon} size={20} />}
                          <span style={{ maxWidth: "100%", whiteSpace: "normal", textAlign: "center" }}>{pr.label}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span data-won-label={won.label} style={{ fontSize: 20, fontWeight: 700, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {won.label}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setWon(null)}
                    className="m3-press"
                    style={{ marginTop: 4, height: 40, padding: "0 24px", borderRadius: 20, border: "none", background: p.primary, color: p.onPrimary, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    {t("ok", lang)}
                  </button>
                </div>
              </>
            )}
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
                /* The page itself enters the way the author asked for: every layer used to fade
                   whatever its rule said, so "slide up from the bottom" on a dialog did nothing.
                   The dim stays a fade of its own, and no animation means no animation. */
                const entry = layerEntry(l.t, w, h, frameW, frameH, spring, !!still);
                return (
                  <motion.div
                    key={l.frameId}
                    data-overlay={l.frameId}
                    data-overlay-level={l.level}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: still || l.t === "none" ? 0 : 0.18, ease: EASE }}
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
                    <motion.div
                      ref={isTop && rule.focusTrap ? layerFocus : undefined}
                      tabIndex={isTop && rule.focusTrap ? -1 : undefined}
                      inert={!isTop || undefined}
                      role={rule.inertBehind ? "dialog" : undefined}
                      aria-modal={rule.inertBehind || undefined}
                      aria-label={lf.name || t("roleOverlay", lang)}
                      initial={entry.initial}
                      animate={entry.animate}
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
                    </motion.div>
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
