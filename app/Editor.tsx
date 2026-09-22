"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring } from "motion/react";
import { toPng } from "html-to-image";
import { buildPrompt, effectivePrompt } from "@/lib/prompt";
import {
  Action,
  actionPatchFor,
  actionsOf,
  Axis,
  BACK_TARGET,
  baseRadii,
  explodeGroup,
  freeRadii,
  radiiOfRuns,
  BEZEL,
  canJoin,
  clamp,
  connectSpecOf,
  Doc,
  isPlatform,
  Platform,
  Frame,
  Place,
  AlignKind,
  FramePreset,
  FRAME_GAP,
  FRAME_LABEL_H,
  FrameMode,
  frameOfGroup,
  framePresetPatch,
  framePresetOf,
  frameRadius,
  frameRect,
  childAt,
  childDragFree,
  pruneParts,
  childDragRoom,
  findItemIn,
  foldMargins,
  selectedAncestor,
  foldPlace,
  keepPanelSlots,
  needsTabPanels,
  panelSlotFor,
  refillPanels,
  restorePanel,
  slotsOf,
  tabIndexOf,
  tabPanelId,
  takesText,
  tabPanelsPatch,
  liftAbove,
  frameSizeOf,
  DEFAULT_OVERLAY_LEVEL,
  isOverlayFrame,
  isOverlayItem,
  overlayLevelOf,
  overlayLevelOfFrame,
  carryItemSize,
  defaultPlatformOf,
  GAP,
  Group,
  groupBounds,
  Item,
  Kind,
  KIND_ORDER,
  KIND_SPEC,
  PlacedItem,
  CustomPart,
  Var,
  compositeInstance,
  resizedChildren,
  byLayer,
  copySubtree,
  itemsOf,
  layerOf,
  parentOf,
  subtreeOf,
  collapseFree,
  layoutOf,
  lerp,
  makeItem,
  DEFAULT_THEME,
  Theme,
  CONTENT_W,
  fontFamilyOf,
  uiFontFamily,
  normalizeTheme,
  setGlobalShape,
  MEASURED,
  NAV_BAR_H,
  Palette,
  paletteOf,
  pageTintOf,
  PHONE_H,
  PHONE_MARGIN,
  PHONE_W,
  PULL_EXP,
  Radii,
  SETTLE_MS,
  sizeOf,
  SNAP_CROSS,
  SNAP_MAIN,
  Transition,
  TRANSITIONS,
  uid,
  uniformRadii,
  FULL_WIDTH,
  fitHeight,
  railExpansionSide,
  isWideRail,
  LAYER_DEFAULT,
  childShown,
  childDrawn,
  railMetrics,
  RAIL_TOP,
  VARS_ALL,
  migrateFlows,
} from "@/lib/tokens";
import { Icon, M3Node, M3Static, MeasuredContent } from "@/components/M3Node";
import { LayersPanel } from "@/components/Layers";
import { AuditPanel } from "@/components/Audit";
import { VarsPanel } from "@/components/Vars";
import { FrameInspector, FrameSizePicker, Inspector, type DialogChoice } from "@/components/Inspector";
import { Preview } from "@/components/Preview";
import { Logo } from "@/components/Logo";
import { PartsPalette } from "@/components/PartsPalette";
import { CompositeDialog } from "@/components/CompositeDialog";
import { PromptPanel } from "@/components/PromptPanel";
import { Mode, Toolbar } from "@/components/Toolbar";
import { LangMenu } from "@/components/Menus";
import { AiActionKey, AiPanel, aiErrorText } from "@/components/AiPanel";
import { Field } from "@/components/ui";
import { AiSettings, DEFAULT_AI, hasKey, isSecureUrl, loadAiSettings, proposeBehavior, proposeDescription, pushHistory, saveAiSettings } from "@/lib/ai";
import { barSlotOf, bodyRect, carryFrame, pullInto, tidyFrame } from "@/lib/tidy";
import { constrainModalRails, modalRailOf, updateRail } from "@/lib/rail";
import { isProject, readableGroups, readProject, saveProject } from "@/lib/project";
import { audit, type AuditIssue } from "@/lib/audit";
import { magnifyView, revealPadding, revealView, type CanvasView } from "@/lib/view";
import { existingDialogs, holdersOf } from "@/lib/pages";
import { hasShareHash, readShareHash } from "@/lib/share";
import { LoadingIndicator } from "@/components/Loading";
import { draftDesign } from "@/lib/ai";
import { ShareDialog } from "@/components/ShareMenu";
import { ColorPanel } from "@/components/ColorPanel";
import { MotionPanel, ShapePanel, TypePanel } from "@/components/ThemePanel";
import { ThemeContext, ensureFontLoaded, ensureLangFontLoaded } from "@/lib/theme";
import { BottomSheet, MobileActionBar, MobileInspector, MobileLang, MobileSettings } from "@/components/Mobile";
import { ConfirmDialog, FoldButton, IconBtn, Segmented } from "@/components/ui";
import { KIND_TEXT, Lang, LangContext, SEED_TEXT, adoptDoc, getLang, overlayLevelText, setGlobalLang, t, translateDoc } from "@/lib/i18n";

/** the screens while a model drafts: primary, tertiary and primary container, drifting */
const DRAFT_GRADIENT = (p: Palette) => `linear-gradient(120deg, ${p.primaryContainer}, ${p.tertiaryContainer}, ${p.primary}, ${p.secondaryContainer}, ${p.primaryContainer})`;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** the dragged part's own travel: a little lag reads as weight */
const CARRY = {
  type: "spring" as const,
  stiffness: 620,
  damping: 38,
  mass: 0.7,
};
/** the gap opening and the run's counter-shift; identical configs so they cancel */
const OPEN = {
  type: "spring" as const,
  stiffness: 700,
  damping: 42,
  mass: 0.55,
};
const INSTANT = { duration: 0 };

/** the icon rail on the left edge of the parts / layers panel */
const RAIL_W = 52;
const MIN_Z = 0.25;
const MAX_Z = 3;
const HISTORY_MAX = 100;
const DOC_KEY = "m3e:doc";
/** the design a draft or a link replaced, until the author keeps or undoes it */
const BEFORE_KEY = "m3e:doc:before";
const DOC_LOCK = "m3e:doc:editor";
const UI_KEY = "m3e:ui";

type View = { x: number; y: number; z: number };
type Snap = { groupId: string; index: number; pull: number };

/** alignment guide: the snapped position plus the line to draw */
type Guide = { x?: number; y?: number; gx?: number; gy?: number };
const GUIDE_PX = 7;

/** Material's 4dp grid: a coordinate rounded to it, measured from the screen's corner */
const GRID = 4;
const onGrid = (v: number, origin: number) => origin + Math.round((v - origin) / GRID) * GRID;
const FRAME_MARGIN = PHONE_MARGIN;

type DragState = {
  item: Item;
  guide: Guide | null;
  offX: number;
  offY: number;
  startX: number;
  startY: number;
  px: number;
  py: number;
  active: boolean;
  fromPalette: boolean;
  overBin: boolean;
  snap: Snap | null;
  /** the container under the pointer: dropping there makes the part its child */
  over?: string | null;
  settling: boolean;
};

type Gesture =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | {
      kind: "marquee";
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      moved: boolean;
    }
  | {
      kind: "frame";
      id: string;
      sx: number;
      sy: number;
      fx: number;
      fy: number;
      groups: { id: string; x: number; y: number }[];
      moved: boolean;
    }
  | { kind: "group"; id: string; sx: number; sy: number; gx: number; gy: number; moved: boolean; overBin: boolean; guide?: Guide | null }
  /** a part being moved inside the container that holds it, in the container's own coordinates */
  | { kind: "child"; groupId: string; parentId: string; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; free?: boolean; over?: string | null };

/** everything in a document apart from its screens and parts */
type DocMeta = Omit<Doc, "groups" | "frames">;
/** an undo step: the screens and parts, plus the rest of the document for steps that replaced it all */
type Snapshot = { groups: Group[]; frames: Frame[]; meta?: DocMeta };

/** a screen changing size eases the way a settling part does */
const SIZE_TRANSITION = `width ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1), height ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1), border-radius ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`;

/** the breathing room a new container leaves around the parts it takes in */
const CONTAINER_PAD = 16;

/** A document, or one undo step of it, in the language the author is working in: the defaults it
 *  was drawn with are carried over, everything they typed is left alone. */
const translateSnapshot = (snap: Snapshot, lang: Lang): Snapshot => translateDoc(snap, lang);

/** How a set of parts is named in the nesting question: one part by its own name, several by count. */
function describeItems(items: Item[], lang: Lang): string {
  const one = (it: Item) => it.label.trim() || (KIND_SPEC[it.kind] ?? KIND_SPEC.box).label;
  return items.length === 1 ? one(items[0]) : t("nestMany", lang).replace("{n}", String(items.length));
}

const SEED_FRAMES: Frame[] = [{ id: "seedF1", name: "Home", x: 0, y: 0 }];

/** the tree with one part rewritten wherever it sits; a container's children also carry
 *  the offsets that place them inside it */
function patchItemIn(items: Item[], id: string, patch: Partial<Item> & { x?: number; y?: number }): Item[] {
  return items.map((it) =>
    it.id === id
      ? { ...it, ...patch }
      : it.children
        ? { ...it, children: patchItemIn(it.children, id, patch) as PlacedItem[] }
        : it,
  );
}

/** the tree without the parts `gone` names (see pruneParts) */
const pruneItems = (items: Item[], gone: Set<string>): Item[] => pruneParts(items, gone).items;

/** Documents saved before the bars grew their system insets have the navigation
 *  bar flush with the old 80dp bottom; keep it on the bottom edge. */
function migrateGroups(groups: Group[], frames: Frame[]): Group[] {
  const oldNavH = KIND_SPEC.bottomNav.h - NAV_BAR_H;
  return groups.map((g) => {
    if (g.items.length !== 1 || g.items[0].kind !== "bottomNav") return g;
    const f = frames.find((fr) => {
      const r = frameRect(fr);
      return g.x >= r.l - 1 && g.x <= r.r && g.y === r.b - oldNavH;
    });
    return f ? { ...g, y: frameRect(f).b - KIND_SPEC.bottomNav.h } : g;
  });
}

/** Seed ids are deterministic so server and client render the same markup. */
const seed = (lang: Lang = getLang()): Group[] => {
  const text = SEED_TEXT[lang];
  let n = 0;
  const sid = () => `seed${++n}`;
  const mk = (k: Kind) => ({ ...makeItem(k), id: sid() });
  const bar = mk("topAppBar");
  const a = mk("button");
  const b = mk("button");
  a.label = text.favorite;
  a.icon = "star";
  b.label = text.share;
  b.icon = "share";
  b.variant = "tonal";
  const rows = [text.inbox, text.starred, text.archive].map((t, i) => {
    const it = mk("listItem");
    it.label = t;
    it.icon = ["inbox", "star", "archive"][i];
    it.supporting = text.supporting;
    return it;
  });
  const nav = mk("bottomNav");
  const fab = mk("fab");
  return [
    { id: sid(), x: 0, y: 0, axis: "x", items: [bar] },
    { id: sid(), x: PHONE_MARGIN, y: 96, axis: "x", items: [a, b] },
    { id: sid(), x: PHONE_MARGIN, y: 184, axis: "y", items: rows },
    {
      id: sid(),
      x: PHONE_W - 56 - PHONE_MARGIN,
      y: PHONE_H - KIND_SPEC.bottomNav.h - 56 - PHONE_MARGIN,
      axis: "x",
      items: [fab],
    },
    { id: sid(), x: 0, y: PHONE_H - KIND_SPEC.bottomNav.h, axis: "x", items: [nav] },
  ];
};

/** The phone version starts with buttons only: that is all it edits. */
const mobileSeed = (lang: Lang = getLang()): Group[] => {
  const text = SEED_TEXT[lang];
  const mk = (k: Kind) => makeItem(k);
  const a = mk("button");
  const b = mk("button");
  const c = mk("button");
  a.label = text.favorite;
  a.icon = "star";
  b.label = text.share;
  b.icon = "share";
  b.variant = "tonal";
  c.label = text.start;
  c.icon = "arrow_forward";
  return [
    { id: uid(), x: PHONE_MARGIN, y: 120, axis: "x", items: [a, b] },
    { id: uid(), x: PHONE_MARGIN, y: 200, axis: "x", items: [c] },
  ];
};

/** While the model works on a screen, the scheme's colors drift through its bezel. */
function ThinkingRing({ p, frame }: { p: Palette; frame: Frame }) {
  const still = useReducedMotion();
  const { w: frameW, h: frameH } = frameSizeOf(frame);
  const w = frameW + BEZEL * 2;
  const h = frameH + BEZEL * 2;
  const d = Math.ceil(Math.hypot(w, h)) + 80;
  const stops = [p.primary, p.tertiaryContainer, p.inversePrimary, p.secondaryContainer, p.primaryContainer, p.primary];
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <motion.div
        animate={still ? undefined : { rotate: 360 }}
        transition={{ repeat: Infinity, duration: 3.2, ease: "linear" }}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: d,
          height: d,
          marginLeft: -d / 2,
          marginTop: -d / 2,
          background: `conic-gradient(from 0deg, ${stops.join(", ")})`,
          filter: "blur(22px)",
        }}
      />
    </motion.div>
  );
}

type LeftTab = "parts" | "layers" | "audit" | "vars" | "color" | "shape" | "type" | "motion" | "ai";
/** the left rail: what the document is made of, what is wrong with it, then its four theme axes */
const LEFT_TABS: { key: LeftTab; icon: string; title: "parts" | "layers" | "audit" | "variables" | "colors" | "shape" | "typography" | "motion" | "ai" }[] = [
  { key: "parts", icon: "add_box", title: "parts" },
  { key: "layers", icon: "layers", title: "layers" },
  { key: "audit", icon: "fact_check", title: "audit" },
  { key: "vars", icon: "data_object", title: "variables" },
  { key: "color", icon: "palette", title: "colors" },
  { key: "shape", icon: "rounded_corner", title: "shape" },
  { key: "type", icon: "text_fields", title: "typography" },
  { key: "motion", icon: "animation", title: "motion" },
  { key: "ai", icon: "auto_awesome", title: "ai" },
];

export default function Editor({ initialLang, onReady }: { initialLang: Lang; onReady?: () => void }) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  /* ---------- document ---------- */
  const [lang, setLang] = useState<Lang>(initialLang);
  const [editAccess, setEditAccess] = useState<"checking" | "editable" | "readonly">("checking");
  const [groups, setGroupState] = useState<Group[]>(() => seed(initialLang));
  /* Enforce the standalone-modal rule for imports, grouping, undo and all edits. */
  const setGroups = useCallback((next: Group[] | ((prev: Group[]) => Group[])) => {
    setGroupState((prev) => constrainModalRails(typeof next === "function" ? next(prev) : next));
  }, []);
  const [frames, setFrames] = useState<Frame[]>(() => [{ ...SEED_FRAMES[0], name: t("home", initialLang) }]);
  const [paletteKey, setPaletteKey] = useState("purple");
  const [customPalette, setCustomPalette] = useState<Palette | null>(null);
  const [dynamicColor, setDynamicColor] = useState(false);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const patchTheme = (patch: Partial<Theme>) => setTheme((t) => ({ ...t, ...patch }));
  const [frame, setFrame] = useState<FrameMode>("phone");
  const changeLanguage = (next: Lang) => {
    setGlobalLang(next);
    initialLangRef.current = next;
    setLang(next);
    const translated = translateSnapshot({ groups: groupsRef.current, frames: framesRef.current }, next);
    setGroups(translated.groups);
    setFrames(translated.frames);
    pastRef.current = pastRef.current.map((snap) => translateSnapshot(snap, next));
    futureRef.current = futureRef.current.map((snap) => translateSnapshot(snap, next));
  };
  const [isMobile, setIsMobile] = useState(false);
  const [sheet, setSheet] = useState<"edit" | "settings" | "lang" | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  /** frame being rendered offscreen for the PNG export */
  const [exportFrame, setExportFrame] = useState<Frame | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [promptEdit, setPromptEdit] = useState<string | undefined>(undefined);
  /** the author's explicit target; null follows the screens (web once a desktop screen exists) */
  const [platform, setPlatform] = useState<Platform | null>(null);
  /** a project file waiting for the author to confirm replacing the canvas */
  const [pendingImport, setPendingImport] = useState<Doc | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  /** the idea typed into the "ask an AI" dialog; kept here so a failed draft does not lose it */
  const [ideaText, setIdeaText] = useState("");
  /** a model is drafting a design right now */
  const [draftBusy, setDraftBusy] = useState(false);
  /** the design a draft replaced, kept until the author keeps or undoes the draft */
  const [draftBefore, setDraftBefore] = useState<Doc | null>(null);
  const draftBeforeRef = useRef<Doc | null>(null);
  draftBeforeRef.current = draftBefore;
  /** true for the moment after a design arrives, so its colours ease over */
  const [revealing, setRevealing] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);
  const guideRef = useRef<string | null>(null);

  /* ---------- editor ui ---------- */
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 });
  /** Keep the server-rendered world hidden until its first fit has completed. */
  const [viewReady, setViewReady] = useState(false);
  /** screens ease to their new place and size for a moment after one changes size */
  const [easing, setEasing] = useState(false);
  /** the canvas transform eases while the camera glides to or from a screen */
  const [cameraEasing, setCameraEasing] = useState(false);
  const [mode, setMode] = useState<Mode>("select");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftW, setLeftW] = useState(RAIL_W + 268);
  const [leftTab, setLeftTab] = useState<LeftTab>("parts");
  /* What the variables panel shows: everything to begin with, so a variable is never hidden
     behind a page filter the author has forgotten about. From there it can be narrowed to the
     shared ones or to a single page. */
  const [varsScope, setVarsScope] = useState<string>(VARS_ALL);
  /** pointer over the collapsed rail: the logo becomes the open button */
  const [railHover, setRailHover] = useState(false);
  /** the screen whose layers are listed when nothing on a screen is selected */
  const [layersFrameId, setLayersFrameId] = useState<string | null>(null);
  const [rightW, setRightW] = useState(320);
  const [rightTab, setRightTab] = useState<"edit" | "prompt">("edit");
  const [favorites, setFavorites] = useState<Kind[]>([]);
  /** the author's own composite parts, offered by the palette beside the kinds */
  const [customParts, setCustomParts] = useState<CustomPart[]>([]);
  /** the values the prototype carries between taps: coins, stamina, what has been claimed */
  const [vars, setVars] = useState<Var[]>([]);
  /** the dialog that composes a new composite part */
  const [composeOpen, setComposeOpen] = useState(false);
  /** the saved composite the dialog is changing, if any */
  const [composeEditing, setComposeEditing] = useState<CustomPart | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<"left" | "right" | null>(null);
  const [, bumpHistory] = useState(0);
  /* ---------- ai ---------- */
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI);
  const [aiBusy, setAiBusy] = useState(false);
  /** the screen the model is working on, which wears the animated ring meanwhile */
  const [aiFrameId, setAiFrameId] = useState<string | null>(null);
  /** a short confirmation under the header, e.g. that the model's words were applied */
  const [aiNote, setAiNote] = useState<{ text: string; icon: string } | null>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const aiNoteTimer = useRef<number | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const p = paletteOf(paletteKey, customPalette, theme);
  /* corner helpers read the shape scale outside React; keep it current before anything renders */
  setGlobalShape(theme.shape);

  const canvasRef = useRef<HTMLDivElement>(null);
  const measureEls = useRef<Map<string, HTMLElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const pendingRef = useRef<{ timer: number; commit: () => void } | null>(null);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const framesRef = useRef(frames);
  framesRef.current = frames;
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const viewRef = useRef(view);
  viewRef.current = view;
  const previewIdRef = useRef(previewId);
  previewIdRef.current = previewId;
  const leftOpenRef = useRef(leftOpen);
  leftOpenRef.current = leftOpen;
  const leftWRef = useRef(leftW);
  leftWRef.current = leftW;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const spaceRef = useRef(spaceHeld);
  spaceRef.current = spaceHeld;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const mobileRef = useRef(isMobile);
  mobileRef.current = isMobile;
  /** active touch points, for pinch zoom */
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    d0: number;
    z0: number;
    mx: number;
    my: number;
    vx: number;
    vy: number;
  } | null>(null);
  /** groups that must reposition without animating on the next render */
  const instantRef = useRef<Set<string>>(new Set());
  const loadedRef = useRef(false);
  const initialLangRef = useRef<Lang>(initialLang);
  /** A saved document or the first viewport initialization prevents later reseeding. */
  const hadDocRef = useRef(false);

  /* ---------- history ---------- */
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const lastPatchRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });

  const snapshot = useCallback((withMeta = false) => {
    setQuickUndo(false);
    pastRef.current.push(current(withMeta));
    if (pastRef.current.length > HISTORY_MAX) pastRef.current.shift();
    futureRef.current = [];
    bumpHistory((v) => v + 1);
  }, []);

  /** consecutive edits of the same field collapse into one undo step */
  const snapshotFor = useCallback(
    (key: string, withMeta = false) => {
      const now = Date.now();
      const last = lastPatchRef.current;
      if (last.key !== key || now - last.at > 800) snapshot(withMeta);
      lastPatchRef.current = { key, at: now };
    },
    [snapshot],
  );

  const restore = (snap: Snapshot) => {
    for (const g of snap.groups) instantRef.current.add(g.id);
    if (snap.meta) {
      applyDoc({ ...snap.meta, groups: snap.groups, frames: snap.frames }, true);
      if (!mobileRef.current) {
        const mode = snap.meta.frame === "blank" ? "blank" : "phone";
        setFrame(mode);
        frameRef.current = mode;
      }
    } else {
      setGroups(snap.groups);
      setFrames(snap.frames);
    }
    bumpHistory((v) => v + 1);
  };

  /** the current step as a snapshot; `withMeta` when the step being crossed replaced the whole document */
  const current = (withMeta: boolean): Snapshot => {
    const { groups: _g, frames: _f, ...meta } = docRef.current;
    return { groups: groupsRef.current, frames: framesRef.current, meta: withMeta ? meta : undefined };
  };

  const undo = useCallback(() => {
    setQuickUndo(false);
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(current(!!prev.meta));
    restore(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(current(!!next.meta));
    restore(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    instantRef.current.clear();
  });

  /* ---------- persistence ---------- */
  useEffect(() => {
    /* The first tab keeps this promise pending for its lifetime. Later tabs get
       `null` immediately and stay read-only until they are reloaded. Where the
       browser has no locks (an insecure origin, an old WebKit) the editor works
       as it always did, without the guard. */
    if (!navigator.locks) {
      setEditAccess("editable");
      return;
    }
    let active = true;
    let releaseLock: (() => void) | undefined;
    /* Wait until React has finished its development-only effect replay. This
       prevents the discarded setup from briefly competing with the real one. */
    queueMicrotask(() => {
      if (!active) return;
      void navigator.locks
        .request(DOC_LOCK, { ifAvailable: true }, async (lock) => {
          if (!active) return;
          if (!lock) {
            setEditAccess("readonly");
            return;
          }
          setEditAccess("editable");
          await new Promise<void>((resolve) => {
            releaseLock = resolve;
          });
        })
        .catch(() => {
          if (active) setEditAccess("editable");
        });
    });
    return () => {
      active = false;
      releaseLock?.();
    };
  }, []);

  /** Puts a stored or opened document into the editor. Fields a partial document
   *  leaves out keep their current value, or go back to the default when `reset`. */
  const applyDoc = (doc: Partial<Doc>, reset: boolean) => {
    // A document can arrive during the opening glide, before previewId is set. The
    // screen the glide was heading for belongs to the replaced document, so the pending
    // opening is dropped and the camera returns; an open preview simply closes.
    if (previewTimer.current !== null) abandonPreview();
    else {
      /* a return still on its way would drag the camera off the new document's fit */
      cancelReturn();
      if (previewIdRef.current !== null) {
        setPreviewId(null);
        viewBeforePreview.current = null;
      }
    }
    const raw = Array.isArray(doc.groups) ? doc.groups : null;
    const readable = raw ? readableGroups(raw) : null;
    /* A document whose parts this build cannot draw is not one of ours — an older save, or
     * another build on the same origin. Restoring half of it would leave one document's
     * screens holding another's parts, so it is left alone and the canvas keeps what it has;
     * a document with no parts at all is the author's own "clear all" and is restored. */
    const ours = !readable || readable.length > 0 || (raw?.length ?? 0) === 0;
    const frames = Array.isArray(doc.frames) ? doc.frames : framesRef.current;
    /* A document's default words — a bar's destinations, a button's label — were written in the
       language it was drawn in. Reading them back in the author's own keeps an older or shared file
       from showing stray English in the tree and on the canvas; a name the author typed is never one
       of the defaults, so it stays exactly as written. */
    if (ours && readable) {
      /* the state rules an older document was written with are read back as flows here, so the
         editor, the canvas and the preview only ever see machines */
      const owned = adoptDoc({ groups: migrateFlows(migrateGroups(readable, frames)), frames }, lang);
      setGroups(owned.groups);
      /* a screen's own name is a default too, but only the document's own frames are read back */
      if (Array.isArray(doc.frames)) setFrames(owned.frames);
    }
    if (typeof doc.paletteKey === "string" && doc.paletteKey) setPaletteKey(doc.paletteKey);
    else if (reset) setPaletteKey("purple");
    /* normalize once so a scheme saved before the secondary role gets it and keeps it on re-save */
    if (doc.customPalette && typeof doc.customPalette.primary === "string") setCustomPalette(paletteOf("custom", doc.customPalette));
    else if (reset) setCustomPalette(null);
    if (typeof doc.dynamicColor === "boolean") setDynamicColor(doc.dynamicColor);
    else if (reset) setDynamicColor(false);
    if (doc.theme && typeof doc.theme === "object") setTheme(normalizeTheme(doc.theme));
    else if (reset) setTheme(normalizeTheme(undefined));
    if (typeof doc.title === "string") setTitle(doc.title);
    else if (reset) setTitle("");
    if (typeof doc.brief === "string") setBrief(doc.brief);
    else if (reset) setBrief("");
    if (typeof doc.promptEdit === "string") setPromptEdit(doc.promptEdit);
    else if (reset) setPromptEdit(undefined);
    if (isPlatform(doc.platform)) setPlatform(doc.platform);
    else if (reset) setPlatform(null);
    if (Array.isArray(doc.customParts)) setCustomParts(doc.customParts);
    else if (reset) setCustomParts([]);
    if (Array.isArray(doc.vars)) setVars(doc.vars);
    else if (reset) setVars([]);
  };

  useEffect(() => {
    // React's development double-run would otherwise read back its own first save
    if (loadedRef.current) return;
    try {
      const d = localStorage.getItem(DOC_KEY);
      if (d) {
        hadDocRef.current = true;
        applyDoc(JSON.parse(d) as Partial<Doc>, false);
        // frame mode is decided by the device (media-query effect), not restored
      }
      const before = d ? localStorage.getItem(BEFORE_KEY) : null;
      if (!d) localStorage.removeItem(BEFORE_KEY);
      if (before) {
        const value: unknown = JSON.parse(before);
        if (isProject(value)) setDraftBefore(value);
        else localStorage.removeItem(BEFORE_KEY);
      }
      const u = localStorage.getItem(UI_KEY);
      if (u) {
        const ui = JSON.parse(u);
        if (ui.view) setView(ui.view);
        if (typeof ui.leftOpen === "boolean") setLeftOpen(ui.leftOpen);
        if (typeof ui.rightOpen === "boolean") setRightOpen(ui.rightOpen);
        if (ui.leftW) setLeftW(Math.max(RAIL_W + 244, ui.leftW));
        if (ui.rightW) setRightW(ui.rightW);
        if (Array.isArray(ui.favorites)) setFavorites(ui.favorites);
        if (ui.mode) setMode(ui.mode);
      } else {
        queueMicrotask(() => fitRef.current());
      }
      setGlobalLang(initialLang);
      initialLangRef.current = initialLang;
      if (!d) {
        setGroups(seed(initialLang));
        setFrames([{ ...SEED_FRAMES[0], name: t("home", initialLang) }]);
      }
    } catch {}
    setAiSettings(loadAiSettings());
    loadedRef.current = true;
    /* the document is in state; one frame later it is on screen and the boot overlay may go.
       Not cancelled on cleanup: the development double-run skips this effect the second time. */
    requestAnimationFrame(() => onReadyRef.current?.());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    /* the editor's own text and the parts both pick up the language's Noto face */
    document.body.style.fontFamily = uiFontFamily(lang);
    ensureLangFontLoaded(lang, () => setWidths({}));
  }, [lang]);

  useEffect(() => {
    /* an empty width map makes every measured part read its width again in the new face */
    ensureFontLoaded(theme.font, () => setWidths({}));
  }, [theme.font]);

  /* the page background outside the app root follows the scheme, so dark mode has no white edges */
  useEffect(() => {
    document.body.style.background = p.surface;
    document.body.style.color = p.onSurface;
  }, [p.surface, p.onSurface]);

  /* in-app browsers size the page behind their own toolbars and may ignore dvh,
     so the measured inner height wins over the CSS height (innerHeight, not the
     visual viewport, so pinch-zoom and the keyboard leave the layout alone) */
  useEffect(() => {
    const apply = () => {
      const h = Math.round(window.innerHeight);
      if (h > 0) document.documentElement.style.setProperty("--app-h", `${h}px`);
    };
    /* in-app browsers (X, Instagram, LINE...) keep their own action bar over the
       page bottom, so the controls sit one button higher there. App names in the
       user agent are unreliable; the embedded web view itself is not: iOS web
       views omit the Safari token and Android ones carry "wv" */
    const ua = navigator.userAgent;
    const iosWebView = /iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua);
    const androidWebView = /Android/.test(ua) && /(?:^|\W)wv(?:\W|$)/.test(ua);
    if (iosWebView || androidWebView || /Twitter|Instagram|FBAN|FBAV|Line\//i.test(ua)) {
      document.documentElement.style.setProperty("--bottom-ui", "64px");
    }
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  /* everyone works on phone screens; a phone gets one fixed screen and the select tool only */
  useEffect(() => {
    const mq = window.matchMedia(
      "(max-width: 840px), (pointer: coarse) and (max-width: 1024px)",
    );
    const apply = () => {
      const m = mq.matches;
      setIsMobile(m);
      mobileRef.current = m;
      if (m) {
        setMode("select");
        setSheet(null);
        if (!hadDocRef.current) {
          hadDocRef.current = true;
          setGroups(mobileSeed(initialLangRef.current));
          setFrames([{ id: uid(), name: t("home", initialLangRef.current), x: 0, y: 0 }]);
        }
      }
      hadDocRef.current = true;
      if (frameRef.current !== "phone") {
        setFrame("phone");
        frameRef.current = "phone";
      }
      ensureFrameRef.current();
      queueMicrotask(() => {
        fitRef.current();
        setViewReady(true);
      });
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!loadedRef.current || editAccess !== "editable") return;
    try {
      /* The very document the prompt and the export read, so a field added there — the variables,
         say — cannot be left out of the saved file by a second list that has to be kept in step. */
      localStorage.setItem(DOC_KEY, JSON.stringify(docRef.current));
    } catch {}
  }, [editAccess, groups, frames, paletteKey, frame, title, brief, promptEdit, platform, customPalette, dynamicColor, theme, customParts, vars]);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({
          view,
          leftOpen,
          rightOpen,
          leftW,
          rightW,
          favorites,
          mode,
          lang,
        }),
      );
    } catch {}
  }, [
    view,
    leftOpen,
    rightOpen,
    leftW,
    rightW,
    favorites,
    mode,
    lang,
  ]);

  /* ---------- measurement (text-sized kinds) ---------- */
  const allItems = useMemo(() => {
    const map = new Map<string, Item>();
    for (const it of itemsOf(groups)) map.set(it.id, it);
    if (drag) map.set(drag.item.id, drag.item);
    return [...map.values()];
  }, [groups, drag]);

  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    measureEls.current.forEach((el, id) => {
      next[id] = Math.ceil(el.getBoundingClientRect().width);
    });
    const keys = Object.keys(next);
    const changed =
      keys.length !== Object.keys(widthsRef.current).length ||
      keys.some((k) => widthsRef.current[k] !== next[k]);
    if (changed) setWidths(next);
  });

  useEffect(() => {
    const refreshWidths = () => setWidths({});
    document.fonts?.ready.then(refreshWidths);
    document.fonts?.addEventListener("loadingdone", refreshWidths);
    return () => document.fonts?.removeEventListener("loadingdone", refreshWidths);
  }, []);

  const sizeRef = useCallback((it: Item) => sizeOf(it, widthsRef.current), []);
  const alongRef = useCallback(
    (it: Item, axis: Axis) => (axis === "x" ? sizeRef(it).w : sizeRef(it).h),
    [sizeRef],
  );
  const prefixOf = useCallback(
    (g: Group, k: number) =>
      g.items.slice(0, k).reduce((s, it) => s + alongRef(it, g.axis) + GAP, 0),
    [alongRef],
  );

  /* ---------- coordinates ---------- */
  const canvasRect = () => canvasRef.current?.getBoundingClientRect();
  const toWorld = (clientX: number, clientY: number) => {
    const r = canvasRect();
    const v = viewRef.current;
    return {
      x: (clientX - (r?.left ?? 0) - v.x) / v.z,
      y: (clientY - (r?.top ?? 0) - v.y) / v.z,
    };
  };
  /* only the open left panel accepts a drop for deletion; the narrow rail never does */
  const inBin = (clientX: number) =>
    !mobileRef.current && leftOpenRef.current && clientX >= 0 && clientX <= leftWRef.current;

  const setZoomAt = useCallback((nz: number, cx?: number, cy?: number) => {
    const r = canvasRect();
    const v = viewRef.current;
    const z = clamp(nz, MIN_Z, MAX_Z);
    const px = cx === undefined ? (r?.width ?? 0) / 2 : cx - (r?.left ?? 0);
    const py = cy === undefined ? (r?.height ?? 0) / 2 : cy - (r?.top ?? 0);
    setView({
      x: px - ((px - v.x) * z) / v.z,
      y: py - ((py - v.y) * z) / v.z,
      z,
    });
  }, []);

  const fit = useCallback(() => {
    const r = canvasRect();
    if (!r) return;
    const gs = groupsRef.current;
    let x0 = -BEZEL;
    let y0 = -BEZEL - FRAME_LABEL_H;
    let x1 = PHONE_W + BEZEL;
    let y1 = PHONE_H + BEZEL;
    const fs = framesRef.current;
    if (frameRef.current === "phone" && fs.length > 0) {
      x0 = Math.min(...fs.map((f) => f.x)) - BEZEL;
      y0 = Math.min(...fs.map((f) => f.y)) - BEZEL - FRAME_LABEL_H;
      x1 = Math.max(...fs.map((f) => frameRect(f).r)) + BEZEL;
      y1 = Math.max(...fs.map((f) => frameRect(f).b)) + BEZEL;
    }
    if (frameRef.current === "blank") {
      if (gs.length === 0) {
        setView({ x: 48, y: 48, z: 1 });
        return;
      }
      x0 = Infinity;
      y0 = Infinity;
      x1 = -Infinity;
      y1 = -Infinity;
      for (const g of gs) {
        for (const pl of layoutOf(g, widthsRef.current)) {
          x0 = Math.min(x0, pl.x);
          y0 = Math.min(y0, pl.y);
          x1 = Math.max(x1, pl.x + pl.w);
          y1 = Math.max(y1, pl.y + pl.h);
        }
      }
    }
    const mobile = mobileRef.current;
    const pad = mobile ? 14 : 40;
    const top = mobile ? 96 : 84; // keep the floating toolbar clear of the frame
    const bottom = mobile ? 96 : pad;
    if (mobile) {
      // a phone zooms to the screen's width and starts at its top; the rest scrolls
      const z = clamp((r.width - pad * 2) / (x1 - x0), MIN_Z, MAX_Z);
      setView({ x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: top - y0 * z, z });
      return;
    }
    const z = clamp(
      Math.min(
        (r.width - pad * 2) / (x1 - x0),
        (r.height - top - bottom) / (y1 - y0),
        1,
      ),
      MIN_Z,
      MAX_Z,
    );
    setView({
      x: (r.width - (x1 - x0) * z) / 2 - x0 * z,
      y: top + (r.height - top - bottom - (y1 - y0) * z) / 2 - y0 * z,
      z,
    });
  }, []);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  /* touch: two fingers pinch-zoom and pan, cancelling whatever one finger started */
  const onTouchCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchesRef.current.size === 2) {
      const [a, b] = [...touchesRef.current.values()];
      const v = viewRef.current;
      pinchRef.current = {
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        z0: v.z,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        vx: v.x,
        vy: v.y,
      };
      dragRef.current = null;
      setDrag(null);
      setPressedId(null);
      gestureRef.current = null;
      setGesture(null);
    }
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !touchesRef.current.has(e.pointerId))
        return;
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = pinchRef.current;
      if (!pinch || touchesRef.current.size < 2) return;
      const [a, b] = [...touchesRef.current.values()];
      const r = canvasRef.current?.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = clamp((pinch.z0 * d) / Math.max(1, pinch.d0), MIN_Z, MAX_Z);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const px = pinch.mx - (r?.left ?? 0);
      const py = pinch.my - (r?.top ?? 0);
      setView({
        x: px - ((px - pinch.vx) * z) / pinch.z0 + (mx - pinch.mx),
        y: py - ((py - pinch.vy) * z) / pinch.z0 + (my - pinch.my),
        z,
      });
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touchesRef.current.delete(e.pointerId);
      if (touchesRef.current.size < 2) pinchRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /* wheel: pan, or zoom with ctrl / pinch */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        setZoomAt(
          viewRef.current.z * Math.exp(-e.deltaY * 0.0022),
          e.clientX,
          e.clientY,
        );
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoomAt]);

  /* ---------- rest positions and the magnet ---------- */
  const restPos = useCallback(
    (g: Group, k: number, sz: { w: number; h: number }) =>
      g.axis === "x"
        ? { left: k === 0 ? g.x - sz.w - GAP : g.x + prefixOf(g, k), top: g.y }
        : { left: g.x, top: k === 0 ? g.y - sz.h - GAP : g.y + prefixOf(g, k) },
    [prefixOf],
  );

  /** Nearest slot inside the magnetic field with an attraction that ramps
   *  from 0 at the edge to 1 on target. A part only fuses with its own kind. */
  const findSnap = useCallback(
    (item: Item, left: number, top: number): Snap | null => {
      const spec = connectSpecOf(item);
      if (!spec) return null;
      const sz = sizeRef(item);
      let best: Snap | null = null;
      let bestD = 1;
      for (const g of groupsRef.current) {
        if (g.free || g.axis !== spec.axis || !g.items[0] || !canJoin(g.items[0], item))
          continue;
        for (let k = 0; k <= g.items.length; k++) {
          const r = restPos(g, k, sz);
          const dx = left - r.left;
          const dy = top - r.top;
          const nMain = (spec.axis === "x" ? dx : dy) / SNAP_MAIN;
          const nCross = (spec.axis === "x" ? dy : dx) / SNAP_CROSS;
          if (Math.abs(nMain) >= 1 || Math.abs(nCross) >= 1) continue;
          const d = Math.hypot(nMain, nCross);
          if (d < bestD) {
            bestD = d;
            best = { groupId: g.id, index: k, pull: Math.pow(1 - d, PULL_EXP) };
          }
        }
      }
      return best;
    },
    [restPos, sizeRef],
  );

  const sx = useSpring(0, CARRY);
  const sy = useSpring(0, CARRY);

  /** Canva-style alignment: edges and centres of neighbours and of the frame
   *  pull the part gently into line and draw a guide while they do. */
  const guideFor = useCallback(
    (left: number, top: number, sz: { w: number; h: number }, skip: Set<string>): Guide | null => {
      const tol = GUIDE_PX / viewRef.current.z;
      const xs: number[] = [];
      const ys: number[] = [];
      for (const g of groupsRef.current) {
        for (const pl of layoutOf(g, widthsRef.current)) {
          if (skip.has(pl.item.id)) continue;
          xs.push(pl.x, pl.x + pl.w / 2, pl.x + pl.w);
          ys.push(pl.y, pl.y + pl.h / 2, pl.y + pl.h);
        }
      }
      if (frameRef.current === "phone") {
        for (const f of framesRef.current) {
          const { w, h } = frameSizeOf(f);
          xs.push(
            f.x,
            f.x + FRAME_MARGIN,
            f.x + w / 2,
            f.x + w - FRAME_MARGIN,
            f.x + w,
          );
          ys.push(
            f.y,
            f.y + FRAME_MARGIN,
            f.y + h / 2,
            f.y + h - FRAME_MARGIN,
            f.y + h,
          );
        }
      }
      const mine = (pos: number, len: number) => [
        pos,
        pos + len / 2,
        pos + len,
      ];
      let best: Guide = {};
      let bx = tol;
      for (const c of xs)
        for (const m of mine(left, sz.w)) {
          const d = Math.abs(c - m);
          if (d < bx) {
            bx = d;
            best = { ...best, x: left + (c - m), gx: c };
          }
        }
      let by = tol;
      for (const c of ys)
        for (const m of mine(top, sz.h)) {
          const d = Math.abs(c - m);
          if (d < by) {
            by = d;
            best = { ...best, y: top + (c - m), gy: c };
          }
        }
      return best.x === undefined && best.y === undefined ? null : best;
    },
    [],
  );
  const findGuide = useCallback(
    (item: Item, left: number, top: number): Guide | null => guideFor(left, top, sizeRef(item), new Set([item.id])),
    [guideFor, sizeRef],
  );

  /* ---------- pointer: parts ---------- */
  const flushPending = useCallback(() => {
    const pend = pendingRef.current;
    if (!pend) return;
    clearTimeout(pend.timer);
    pendingRef.current = null;
    pend.commit();
  }, []);
  useEffect(() => () => flushPending(), [flushPending]);

  const startPan = (clientX: number, clientY: number) => {
    const g: Gesture = {
      kind: "pan",
      sx: clientX,
      sy: clientY,
      vx: viewRef.current.x,
      vy: viewRef.current.y,
    };
    gestureRef.current = g;
    setGesture(g);
  };

  /**
   * Starts dragging one part of a group, from a point on the screen. The pointer handlers below and
   * a control sitting on the part (a navigation's fold button, which hands a press that travels
   * over) both come through here.
   */
  const dragItemFrom = (clientX: number, clientY: number, shift: boolean, g: Group, index: number, item: Item) => {
    flushPending();
    if (g.free) {
      setSelectedIds((cur) => (shift ? [...cur.filter((x) => !g.items.some((it) => it.id === x)), ...g.items.map((it) => it.id)] : g.items.map((it) => it.id)));
      setSelectedFrameId(null);
      setSelectedLinkId(null);
      setRightTab("edit");
      const gg: Gesture = { kind: "group", id: g.id, sx: clientX, sy: clientY, gx: g.x, gy: g.y, moved: false, overBin: false };
      gestureRef.current = gg;
      setGesture(gg);
      return;
    }
    const pt = toWorld(clientX, clientY);
    const off = prefixOf(g, index);
    const left = g.axis === "x" ? g.x + off : g.x;
    const top = g.axis === "x" ? g.y : g.y + off;
    sx.jump(left);
    sy.jump(top);
    setSelectedIds((cur) => (shift ? [...cur.filter((x) => x !== item.id), item.id] : [item.id]));
    setSelectedFrameId(null);
    setSelectedLinkId(null);
    setRightTab("edit");
    setPressedId(item.id);
    const d: DragState = {
      item,
      offX: pt.x - left,
      offY: pt.y - top,
      startX: pt.x,
      startY: pt.y,
      px: pt.x,
      py: pt.y,
      active: false,
      fromPalette: false,
      overBin: false,
      snap: null,
      settling: false,
      guide: null,
    };
    dragRef.current = d;
    setDrag({ ...d });
  };

  const onItemPointerDown = (
    e: React.PointerEvent,
    g: Group,
    index: number,
    item: Item,
  ) => {
    if (e.button === 1 || modeRef.current === "hand" || spaceRef.current) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragItemFrom(e.clientX, e.clientY, e.shiftKey, g, index, item);
  };

  /** starts carrying a fresh part from the palette (a kind, or a whole composite) */
  const startPartDrag = (e: React.PointerEvent, item: Item) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    flushPending();
    const pt = toWorld(e.clientX, e.clientY);
    const sz = sizeOf(item, widthsRef.current);
    const offX = Math.min(sz.w / 2, 90);
    const offY = Math.min(sz.h / 2, 40);
    sx.jump(pt.x - offX);
    sy.jump(pt.y - offY);
    setSelectedIds([item.id]);
    setRightTab("edit");
    const d: DragState = {
      item,
      offX,
      offY,
      startX: pt.x,
      startY: pt.y,
      px: pt.x,
      py: pt.y,
      active: true,
      fromPalette: true,
      overBin: false,
      snap: null,
      settling: false,
      guide: null,
    };
    dragRef.current = d;
    setDrag({ ...d });
  };

  /** A part as it arrives from the palette. A tab row brings its panels: one per tab, so switching
   *  tabs has somewhere to switch to without the author building them first. */
  const bornPart = (kind: Kind): Item => {
    const it = makeItem(kind);
    const patch = tabPanelsPatch(it);
    return patch ? { ...it, ...patch } : it;
  };
  const onPartPointerDown = (e: React.PointerEvent, kind: Kind) => startPartDrag(e, bornPart(kind));

  /** a composite drops as one container holding the parts it was composed of */
  const onCompositePointerDown = (e: React.PointerEvent, part: CustomPart) => startPartDrag(e, compositeInstance(part, uid));

  const isDragging = drag !== null;

  useEffect(() => {
    if (!isDragging) return;
    /* Ctrl overrides auto-snap for as long as it is held: no magnet slot, no
       alignment guide, no 4dp grid. A pointer move carries its own ctrlKey, and
       key events cover the moments in between when the pointer is still. */
    let ctrlHeld = false;

    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const pt = toWorld(e.clientX, e.clientY);
      d.px = pt.x;
      d.py = pt.y;
      ctrlHeld = e.ctrlKey || e.metaKey;

      if (!d.active) {
        if (
          Math.hypot(pt.x - d.startX, pt.y - d.startY) * viewRef.current.z <
          5
        ) {
          setDrag({ ...d });
          return;
        }
        d.active = true;
        d.snap = null;
        const id = d.item.id;
        /* The press may have been a while ago — a fold button's press waits to see whether it
           travels — so the part is picked up as it stands now, not as it was when pressed. */
        const fresh = groupsRef.current.map((g) => findItemIn(g.items, id)).find(Boolean);
        if (fresh) d.item = fresh;
        snapshot();
        setGroups((prev) => {
          const out: Group[] = [];
          for (const g of prev) {
            const idx = g.items.findIndex((it) => it.id === id);
            if (idx < 0) {
              out.push(g);
              continue;
            }
            const rest = g.items.filter((it) => it.id !== id);
            if (rest.length === 0) continue;
            const sz = sizeOf(g.items[idx], widthsRef.current);
            const back = idx === 0;
            // The anchor moves to the new first item; that jump must not animate,
            // otherwise the remaining run springs sideways for a frame.
            if (back) instantRef.current.add(g.id);
            out.push({
              ...g,
              x: back && g.axis === "x" ? g.x + sz.w + GAP : g.x,
              y: back && g.axis === "y" ? g.y + sz.h + GAP : g.y,
              items: rest,
            });
          }
          return out;
        });
        setPressedId(null);
        setDrag({ ...d });
        return;
      }

      /* a part being added from the palette has nothing to delete yet; dropping it back there just cancels */
      d.overBin = !d.fromPalette && inBin(e.clientX);
      /* the container the pointer is over: dropping there puts the part inside it, which is the one
         gesture that says "this belongs in that" */
      d.over = d.overBin || ctrlHeld ? null : holderAt(pt.x, pt.y, d.item);
      d.snap =
        d.over || d.overBin || ctrlHeld
          ? null
          : findSnap(d.item, pt.x - d.offX, pt.y - d.offY);
      d.guide =
        d.over || d.overBin || d.snap || ctrlHeld
          ? null
          : findGuide(d.item, pt.x - d.offX, pt.y - d.offY);
      setDrag({ ...d });
    };

    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setPressedId(null);
      if (!d) return;
      if (!d.active) {
        setDrag(null);
        return;
      }

      const loose = ctrlHeld || e.ctrlKey || e.metaKey;

      const item = d.item;
      const sz = sizeRef(item);

      if (d.overBin) {
        setSelectedIds((cur) => cur.filter((x) => x !== item.id));
        setDrag(null);
        return;
      }

      /* dropped onto a container: it becomes that container's child, landing where the finger left it */
      if (!loose && d.over) {
        const next = putIn(groupsRef.current, [{ item, at: { l: d.px - d.offX, t: d.py - d.offY } }], d.over);
        if (next) {
          /* a part dragged in from the palette has no step of its own yet */
          if (d.fromPalette) snapshot();
          setGroups(next);
          setSelectedIds([item.id]);
          setDrag(null);
          return;
        }
      }

      if (!loose && d.snap) {
        const t = d.snap;
        setDrag({ ...d, snap: { ...t, pull: 1 }, settling: true });
        const commit = () => {
          setGroups((prev) => {
            if (prev.some((g) => g.items.some((it) => it.id === item.id)))
              return prev;
            return prev.map((g) => {
              if (g.id !== t.groupId) return g;
              const front = t.index === 0;
              return {
                ...g,
                x: front && g.axis === "x" ? g.x - sz.w - GAP : g.x,
                y: front && g.axis === "y" ? g.y - sz.h - GAP : g.y,
                items: [
                  ...g.items.slice(0, t.index),
                  item,
                  ...g.items.slice(t.index),
                ],
              };
            });
          });
          setDrag(null);
        };
        const timer = window.setTimeout(() => {
          pendingRef.current = null;
          commit();
        }, SETTLE_MS);
        pendingRef.current = { timer, commit };
        return;
      }

      const rect = canvasRect();
      const v = viewRef.current;
      /* a Ctrl drop lands where the cursor is, untouched by any guide hold */
      const rawX = loose ? d.px - d.offX : d.guide?.x ?? d.px - d.offX;
      const rawY = loose ? d.py - d.offY : d.guide?.y ?? d.py - d.offY;
      const screenL = (rawX + sz.w) * v.z + v.x;
      const screenT = (rawY + sz.h) * v.z + v.y;
      const screenR = rawX * v.z + v.x;
      const screenB = rawY * v.z + v.y;
      const cw = rect?.width ?? 0;
      const ch = rect?.height ?? 0;
      if (
        d.fromPalette &&
        (screenL < 0 || screenT < 0 || screenR > cw || screenB > ch)
      ) {
        setSelectedIds((cur) => cur.filter((x) => x !== item.id));
        setDrag(null);
        return;
      }
      if (d.fromPalette) snapshot();
      const targetFrame =
        frameRef.current === "phone"
          ? framesRef.current.find((f) => {
              const r = frameRect(f);
              const cx = rawX + sz.w / 2;
              const cy = rawY + sz.h / 2;
              return cx >= r.l && cx <= r.r && cy >= r.t && cy <= r.b;
            })
          : undefined;
      /* a bar spans the screen it lands on, beside its rail; any other part keeps its phone-sized
       * default (a list or a field as wide as a desktop is rarely what the author means), but no
       * taller than the screen */
      const slot = targetFrame ? barSlotOf(groupsRef.current, targetFrame, framesRef.current, widthsRef.current) : null;
      const isBar = FULL_WIDTH.includes(item.kind);
      const placedItem = targetFrame && slot ? (isBar ? carryItemSize(item, { w: PHONE_W, h: PHONE_H }, { w: slot.w, h: frameSizeOf(targetFrame).h }) : fitHeight(item, frameSizeOf(targetFrame).h)) : item;
      /* off any guide, the part settles on the 4dp grid of the screen it lands on */
      const origin = targetFrame ?? { x: 0, y: 0 };
      /* Ctrl keeps the pixel the cursor chose; a guide holds its whole-pixel
         position; otherwise the axis settles on the 4dp grid as before.
         A bar dropped on a screen keeps its own spanning rule. */
      const settle = (onGuide: boolean, pos: number, grid: number) =>
        loose || onGuide ? Math.round(pos) : onGrid(pos, grid);
      const dropped: Group = {
        id: uid(),
        x: isBar && slot ? Math.round(slot.x) : settle(d.guide?.gx !== undefined, rawX, origin.x),
        y: settle(d.guide?.gy !== undefined, rawY, origin.y),
        axis: connectSpecOf(item)?.axis ?? "x",
        items: [placedItem],
      };
      /* a part that grew to the screen's width is kept inside it, then settles back on the grid */
      const pulled = targetFrame ? pullInto(dropped, targetFrame, widthsRef.current) : dropped;
      /* a Ctrl drop keeps whatever pullInto chose, whole pixels included;
         otherwise a part pulled back in settles on the grid again */
      const ng =
        pulled === dropped || loose
          ? pulled
          : { ...pulled, x: d.guide?.gx !== undefined ? pulled.x : onGrid(pulled.x, origin.x), y: d.guide?.gy !== undefined ? pulled.y : onGrid(pulled.y, origin.y) };
      setGroups((prev) =>
        prev.some((g) => g.items.some((it) => it.id === item.id))
          ? prev
          : [...prev, ng],
      );
      setDrag(null);
    };

    /* Ctrl (or Cmd on a Mac) pressed or released while the pointer is still: the drawn
       magnet and guide must leave (or be free to return) right away, not on the next move */
    const onCtrl = (e: KeyboardEvent, held: boolean) => {
      if ((e.key !== "Control" && e.key !== "Meta") || e.repeat) return;
      const d = dragRef.current;
      if (!d) return;
      ctrlHeld = held;
      if (held) {
        d.snap = null;
        d.guide = null;
      }
      setDrag({ ...d });
    };
    const onCtrlDown = (e: KeyboardEvent) => onCtrl(e, true);
    const onCtrlUp = (e: KeyboardEvent) => onCtrl(e, false);
    window.addEventListener("keydown", onCtrlDown);
    window.addEventListener("keyup", onCtrlUp);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", onCtrlDown);
      window.removeEventListener("keyup", onCtrlUp);
    };
    // handlers read live state through refs, so this binds once per drag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  /* the overlay sits between the cursor and the slot, weighted by attraction */
  useEffect(() => {
    if (!drag?.active) return;
    const cursorL = drag.px - drag.offX;
    const cursorT = drag.py - drag.offY;
    if (drag.snap) {
      const g = groupsRef.current.find((x) => x.id === drag.snap!.groupId);
      if (g) {
        const r = restPos(g, drag.snap.index, sizeRef(drag.item));
        sx.set(lerp(cursorL, r.left, drag.snap.pull));
        sy.set(lerp(cursorT, r.top, drag.snap.pull));
        return;
      }
    }
    sx.set(drag.guide?.x ?? cursorL);
    sy.set(drag.guide?.y ?? cursorT);
  }, [drag, restPos, sizeRef, sx, sy]);

  /* ---------- pointer: canvas (pan / marquee) ---------- */
  const itemRects = useCallback(() => {
    const out: { id: string; l: number; t: number; r: number; b: number }[] =
      [];
    /* a container's children sit inside it: their rects follow it, and are reported so
       marquee selection, duplication and overlap tests see them too */
    const push = (it: Item, x: number, y: number) => {
      const sz = sizeOf(it, widthsRef.current);
      out.push({ id: it.id, l: x, t: y, r: x + sz.w, b: y + sz.h });
      for (const c of it.children ?? []) push(c, x + c.x, y + c.y);
    };
    for (const g of groupsRef.current) {
      for (const pl of layoutOf(g, widthsRef.current)) push(pl.item, pl.x, pl.y);
    }
    return out;
  }, []);

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectedFrameId(null);
    setSelectedLinkId(null);
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (mobileRef.current && e.pointerType === "touch") {
      e.preventDefault();
      clearSelection();
      startPan(e.clientX, e.clientY);
      return;
    }
    if (e.button === 1 || modeRef.current === "hand" || spaceRef.current) {
      e.preventDefault();
      startPan(e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0) return;
    const pt = toWorld(e.clientX, e.clientY);
    const g: Gesture = {
      kind: "marquee",
      x0: pt.x,
      y0: pt.y,
      x1: pt.x,
      y1: pt.y,
      moved: false,
    };
    gestureRef.current = g;
    setGesture(g);
    if (!e.shiftKey) setSelectedIds([]);
    setSelectedFrameId(null);
    setSelectedLinkId(null);
  };

  /** grab a phone frame by its bezel or label: it carries everything on it;
   *  on a phone the screen stays put and a tap on it just clears the selection */
  const onFramePointerDown = (e: React.PointerEvent, f: Frame) => {
    if (mobileRef.current) {
      e.preventDefault();
      e.stopPropagation();
      clearSelection();
      startPan(e.clientX, e.clientY);
      return;
    }
    if (e.button === 1 || modeRef.current === "hand" || spaceRef.current) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedFrameId(f.id);
    setSelectedIds([]);
    setSelectedLinkId(null);
    setRightTab("edit");
    const carried = groupsRef.current
      .filter(
        (g) =>
          frameOfGroup(g, framesRef.current, widthsRef.current)?.id === f.id,
      )
      .map((g) => ({ id: g.id, x: g.x, y: g.y }));
    const g: Gesture = {
      kind: "frame",
      id: f.id,
      sx: e.clientX,
      sy: e.clientY,
      fx: f.x,
      fy: f.y,
      groups: carried,
      moved: false,
    };
    gestureRef.current = g;
    setGesture(g);
  };

  const isGesturing = gesture !== null;
  useEffect(() => {
    if (!isGesturing) return;
    const move = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      if (g.kind === "pan") {
        setView((v) => ({
          ...v,
          x: g.vx + (e.clientX - g.sx),
          y: g.vy + (e.clientY - g.sy),
        }));
        return;
      }
      if (g.kind === "group") {
        const z = viewRef.current.z;
        const dx = (e.clientX - g.sx) / z;
        const dy = (e.clientY - g.sy) / z;
        if (!g.moved) {
          if (Math.hypot(dx, dy) * z < 4) return;
          g.moved = true;
          snapshot();
        }
        instantRef.current.add(g.id);
        g.overBin = inBin(e.clientX);
        const gr = groupsRef.current.find((x) => x.id === g.id);
        if (!gr) return;
        /* a moved group lines up with its neighbours like a single part does, and off
           any guide settles on the 4dp grid of the screen it is over; Ctrl (or Cmd)
           skips both */
        const moved = { ...gr, x: g.gx + dx, y: g.gy + dy };
        const loose = e.ctrlKey || e.metaKey;
        const b = groupBounds(moved, widthsRef.current);
        const guide = loose || g.overBin ? null : guideFor(b.l, b.t, { w: b.r - b.l, h: b.b - b.t }, new Set(gr.items.map((it) => it.id)));
        g.guide = guide;
        setGesture({ ...g });
        const f = frameOfGroup(moved, framesRef.current, widthsRef.current);
        const placed = loose
          ? moved
          : {
              ...moved,
              x: guide?.x !== undefined ? Math.round(moved.x + guide.x - b.l) : onGrid(moved.x, f?.x ?? 0),
              y: guide?.y !== undefined ? Math.round(moved.y + guide.y - b.t) : onGrid(moved.y, f?.y ?? 0),
            };
        setGroups((gs) => gs.map((x) => (x.id === g.id ? placed : x)));
        return;
      }
      if (g.kind === "child") {
        const z = viewRef.current.z;
        const dx = (e.clientX - g.sx) / z;
        const dy = (e.clientY - g.sy) / z;
        if (!g.moved) {
          if (Math.hypot(dx, dy) * z < 3) return;
          g.moved = true;
          snapshot();
        }
        /* the part stays inside the container that holds it: long enough to stay on
           screen, and never past the box's own edges — a free child may sit past them */
        const gr = groupsRef.current.find((x) => x.id === g.groupId);
        if (!gr) return;
        const parent = findItemIn(gr.items, g.parentId);
        const kid = findItemIn(gr.items, g.id) as PlacedItem | null;
        if (!parent || !kid) return;
        /* Dragging is how an author says "this belongs in that": over another container the child is
           offered as its child, and follows the finger so the drop lands where they point. Over the
           container it already sits in it simply slides. */
        const pt = toWorld(e.clientX, e.clientY);
        const next = holderAt(pt.x, pt.y, kid);
        g.over = next && next !== g.parentId ? next : null;
        const room = childDragRoom(parent, kid, widthsRef.current, !!g.free || !!g.over);
        const f = foldPlace(kid, widthsRef.current);
        const nx = Math.round(Math.min(room.w, Math.max(0, g.ox + dx))) - f.dx;
        const ny = Math.round(Math.min(room.h, Math.max(0, g.oy + dy))) - f.dy;
        setGroups((gs) => gs.map((x) => (x.id === g.groupId ? { ...x, items: patchItemIn(x.items, g.id, { x: nx, y: ny }) } : x)));
        setGesture({ ...g });
        return;
      }
      if (g.kind === "frame") {
        const z = viewRef.current.z;
        const dx = (e.clientX - g.sx) / z;
        const dy = (e.clientY - g.sy) / z;
        if (!g.moved) {
          if (Math.hypot(dx, dy) * z < 4) return;
          g.moved = true;
          snapshot();
        }
        const ids = new Map(g.groups.map((o) => [o.id, o]));
        for (const o of g.groups) instantRef.current.add(o.id);
        setFrames((fs) =>
          fs.map((f) =>
            f.id === g.id
              ? { ...f, x: Math.round(g.fx + dx), y: Math.round(g.fy + dy) }
              : f,
          ),
        );
        setGroups((gs) =>
          gs.map((gr) => {
            const o = ids.get(gr.id);
            return o
              ? { ...gr, x: Math.round(o.x + dx), y: Math.round(o.y + dy) }
              : gr;
          }),
        );
        return;
      }
      const pt = toWorld(e.clientX, e.clientY);
      g.x1 = pt.x;
      g.y1 = pt.y;
      if (
        !g.moved &&
        Math.hypot(pt.x - g.x0, pt.y - g.y0) * viewRef.current.z > 4
      )
        g.moved = true;
      if (g.moved) {
        const l = Math.min(g.x0, g.x1);
        const r = Math.max(g.x0, g.x1);
        const t = Math.min(g.y0, g.y1);
        const b = Math.max(g.y0, g.y1);
        const hit = itemRects()
          .filter((it) => it.l < r && it.r > l && it.t < b && it.b > t)
          .map((it) => it.id);
        setSelectedIds(hit);
      }
      setGesture({ ...g });
    };
    const up = (e: PointerEvent) => {
      const g = gestureRef.current;
      gestureRef.current = null;
      setGesture(null);
      // a group dragged onto the parts panel is deleted, like a single part
      if (g?.kind === "group" && g.moved && inBin(e.clientX)) {
        setGroups((gs) => gs.filter((x) => x.id !== g.id));
        setSelectedIds([]);
      }
      /* a child let go over another container moves into it, wherever it sat before */
      if (g?.kind === "child" && g.moved && g.over) nestInto([g.id], g.over);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGesturing]);

  /* ---------- panel resize ---------- */
  useEffect(() => {
    if (!resizing) return;
    const move = (e: PointerEvent) => {
      if (resizing === "left") setLeftW(clamp(e.clientX, RAIL_W + 244, 480));
      else setRightW(clamp(window.innerWidth - e.clientX, 280, 480));
    };
    const up = () => setResizing(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [resizing]);

  /* ---------- editing ---------- */
  const primaryId = selectedIds[selectedIds.length - 1] ?? null;
  const selected = useMemo(() => {
    /* a part inside a container is selectable like any other */
    for (const it of itemsOf(groups)) if (it.id === primaryId) return it;
    return drag?.item.id === primaryId ? (drag?.item ?? null) : null;
  }, [groups, primaryId, drag]);

  useEffect(() => {
    if (!selected && sheet === "edit") setSheet(null);
  }, [selected, sheet]);

  /** Resizing a lone part keeps whatever it was lined up with on the frame:
   *  its centre on the centre line, or its far edge on the margin or screen edge.
   *  Otherwise the near (left / top) edge stays put, as the sliders always did. */
  const resizeShift = (g: Group, before: Item, after: Item) => {
    const none = { dx: 0, dy: 0 };
    if (g.items.length !== 1 || frameRef.current !== "phone") return none;
    const f = frameOfGroup(g, framesRef.current, widthsRef.current);
    if (!f) return none;
    const { w: frameW, h: frameH } = frameSizeOf(f);
    const a = sizeOf(before, widthsRef.current);
    const b = sizeOf(after, widthsRef.current);
    const shift = (pos: number, len: number, next: number, f0: number, fLen: number) => {
      const d = next - len;
      if (d === 0) return 0;
      const near = (v: number, target: number) => Math.abs(v - target) <= 1;
      if (near(pos + len / 2, f0 + fLen / 2)) return -Math.round(d / 2);
      if (near(pos + len, f0 + fLen - FRAME_MARGIN) || near(pos + len, f0 + fLen)) return -d;
      return 0;
    };
    return {
      dx: shift(g.x, a.w, b.w, f.x, frameW),
      dy: shift(g.y, a.h, b.h, f.y, frameH),
    };
  };

  const patchSelected = (patch: Partial<Item>) => {
    if (!primaryId) return;
    const id = primaryId;
    /* a rail state change resizes the part too, so its run has to make room for it */
    const resizes = "size" in patch || "size2" in patch || "railExpanded" in patch || "railModal" in patch;
    snapshotFor(id + ":" + Object.keys(patch).join(","));
    /* a container that changes size carries its contents with it, in proportion; a part
     * anywhere in the tree — a container's child included — takes the patch. A tab row's
     * panels, the ones the patch brings in included, take the room left under the row. */
    const owner = groupsRef.current.find((g) => !!findItemIn(g.items, id));
    const before = owner ? findItemIn(owner.items, id) : null;
    const kids = before ? resizedChildren(before, patch, widthsRef.current) : undefined;
    const shaped = kids ? { ...patch, children: kids } : patch;
    setGroups((prev) =>
      "railExpanded" in patch || "railModal" in patch ? updateRail(prev, framesRef.current, widthsRef.current, id, patch) : prev.map((g) => {
        const idx = g.items.findIndex((it) => it.id === id);
        /* a part inside a container is written where it sits; only a run member shifts its run */
        if (idx < 0) return findItemIn(g.items, id) ? { ...g, items: patchItemIn(g.items, id, shaped) } : g;
        const next = { ...g.items[idx], ...shaped };
        const { dx, dy } = resizes ? resizeShift(g, g.items[idx], next) : { dx: 0, dy: 0 };
        if (dx || dy) instantRef.current.add(g.id);
        return {
          ...g,
          x: g.x + dx,
          y: g.y + dy,
          items: g.items.map((it, i) => (i === idx ? next : it)),
        };
      }),
    );
    if (dragRef.current?.item.id === id) {
      dragRef.current.item = { ...dragRef.current.item, ...patch };
    }
  };

  /** writes one field of one part, wherever it sits: the canvas itself uses this for the
   *  controls a component carries (a navigation bar's collapse button, say). */
  const patchItemById = useCallback(
    (id: string, patch: Partial<Item>) => {
      if ("railExpanded" in patch || "railModal" in patch) {
        snapshotFor(id + ":" + Object.keys(patch).join(","));
        setGroups((prev) => updateRail(prev, framesRef.current, widthsRef.current, id, patch));
        return;
      }
      snapshotFor(id + ":" + Object.keys(patch).join(","));
      setGroups((prev) => prev.map((g) => (findItemIn(g.items, id) ? { ...g, items: patchItemIn(g.items, id, patch) } : g)));
    },
    [snapshotFor],
  );

  /** Writes the name an author typed over a run's or a hand-made group's row. A group with no name
   *  is named after its parts, so an emptied name falls back to that rather than reading blank. */
  const renameGroup = useCallback(
    (id: string, name: string) => {
      snapshotFor(`group:${id}:name`);
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name: name.trim() || undefined } : g)));
    },
    [snapshotFor],
  );

  /** Writes the name an author typed over a screen's row. */
  const renameFrame = useCallback(
    (id: string, name: string) => {
      snapshotFor(`frame:${id}:name`);
      setFrames((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    },
    [snapshotFor],
  );

  /** Writes the words an author typed over one destination of a bar, rail or tab row. The panels of
   *  a tab row keep their places, since a panel is known by the place its tab stands in. */
  const renameTab = useCallback(
    (id: string, index: number, name: string) => {
      const it = findItemIn(groupsRef.current.flatMap((g) => g.items), id);
      if (!it?.tabs?.[index]) return;
      patchItemById(id, { tabs: it.tabs.map((tab, i) => (i === index ? { ...tab, label: name } : tab)) });
    },
    [patchItemById],
  );

  /**
   * Folds or opens a navigation part's own button. Nothing moves in the document: a folded part is
   * *drawn* at the corner its button sits in (see layoutOf / foldShift), so the pill stays under the
   * button and opening it again puts the destinations back exactly where they were.
   */
  const setNavFold = useCallback(
    (it: Item, folded: boolean) => {
      patchItemById(it.id, it.kind === "bottomNav" ? { barFolded: folded } : { railFolded: folded, railExpanded: !folded });
    },
    [patchItemById],
  );

  /** Picking a panel in the layers brings its tab to the front: a panel that is not in front is not
   *  drawn, so selecting one has to show it, or the author would be editing something invisible. */
  /** Brings a tab row to one of its tabs. Undoable, but coalesced: switching tabs while working is
   *  one step, not one per click. */
  const switchTab = useCallback(
    (itemId: string, index: number) => {
      const it = findItemIn(groupsRef.current.flatMap((g) => g.items), itemId);
      if (!it || it.kind !== "tabs" || tabIndexOf(it) === index) return;
      snapshotFor("tabsel:" + itemId);
      setGroups((gs) => gs.map((g) => ({ ...g, items: patchItemIn(g.items, itemId, { selected: index }) })));
    },
    [snapshotFor],
  );

  const showPanelOf = useCallback(
    (ids: string[]) => {
      for (const id of ids) {
        const parent = parentOf(groupsRef.current, id);
        if (parent?.kind !== "tabs") continue;
        const index = (parent.children ?? []).findIndex((c) => c.id === id);
        if (index >= 0) switchTab(parent.id, index);
      }
    },
    [switchTab],
  );

  /** The innermost container the point is inside: a panel inside a tab row wins over the row itself.
   *  What is being dragged, and anything it carries, is never a target. */
  const holderAt = useCallback(
    (x: number, y: number, dragged: Item): string | null => {
      const skip = new Set(subtreeOf(dragged).map((it) => it.id));
      const items = groupsRef.current.flatMap((g) => g.items);
      const hits: { r: { l: number; t: number; r: number; b: number }; it: Item }[] = [];
      for (const r of itemRects()) {
        if (skip.has(r.id) || x < r.l || x > r.r || y < r.t || y > r.b) continue;
        const it = findItemIn(items, r.id);
        /* containers take anything; a part that writes text of its own takes a dragged text, so a
           caption can be dropped straight onto the button it belongs to */
        const takes = it && (it.kind === "box" || it.kind === "tabs" || (dragged.kind === "text" && takesText(it)));
        if (it && takes) hits.push({ r, it });
      }
      return hits.sort((a, b) => (a.r.r - a.r.l) * (a.r.b - a.r.t) - (b.r.r - b.r.l) * (b.r.b - b.r.t))[0]?.it.id ?? null;
    },
    [itemRects],
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const ids = new Set(selectedIds);
    /* deleting a container takes everything inside it along, however deep the container sits */
    for (const id of selectedIds) {
      const it = groupsRef.current.map((g) => findItemIn(g.items, id)).find(Boolean);
      if (it) for (const sub of subtreeOf(it)) ids.add(sub.id);
    }
    /* Which groups hold any of the parts asked for. A part inside a container is not one of its
       group's own items, so the tree is searched: a plain contains-check would call a nested part
       undeletable. */
    const holders = holdersOf(groupsRef.current, selectedIds);
    if (holders.length === 0) {
      /* Nothing to delete: the selection no longer names any part that is on the canvas. */
      setSelectedIds([]);
      return;
    }
    snapshot();
    /* A deleted panel leaves the empty panel of its tab behind, like one taken out of the row: the
       row's panels are known by their place, so its neighbours would slide back a tab without it. */
    const slots = new Map<string, { parent: Item; at: number }>();
    slotsOf(groupsRef.current.flatMap((g) => g.items), null, slots);
    const lost = new Map<string, number[]>();
    for (const id of ids) {
      const s = slots.get(id);
      /* a tab row deleted whole takes its panels with it: only its own children are put back */
      if (s && s.parent.kind === "tabs" && !ids.has(s.parent.id)) lost.set(s.parent.id, [...(lost.get(s.parent.id) ?? []), s.at]);
    }
    setGroups((prev) =>
      prev
        .map((g) => {
          if (g.free) return collapseFree({ ...g, items: refillPanels(pruneItems(g.items, ids), lost) }, widthsRef.current);
          let x = g.x;
          let y = g.y;
          let items = g.items;
          while (items.length && ids.has(items[0].id)) {
            const sz = sizeOf(items[0], widthsRef.current);
            if (g.axis === "x") x += sz.w + GAP;
            else y += sz.h + GAP;
            items = items.slice(1);
          }
          if (x !== g.x || y !== g.y) instantRef.current.add(g.id);
          return { ...g, x, y, items: refillPanels(pruneItems(items, ids), lost) };
        })
        .filter((g) => g.items.length > 0),
    );
    setSelectedIds([]);
  }, [selectedIds, snapshot]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    /* a selected hand-made group is copied whole, keeping its layout */
    const fg = groupsRef.current.find((g) => g.free && g.items.some((it) => it.id === selected.id));
    if (fg && fg.items.every((it) => selectedIds.includes(it.id))) {
      /* a container inside the group brings its own children along, each with a fresh id */
      const idMap = new Map<string, string>();
      const items = fg.items.map((it) => copySubtree(it, uid, idMap));
      const pos: Record<string, { x: number; y: number }> = {};
      for (const it of fg.items) pos[idMap.get(it.id)!] = fg.pos?.[it.id] ?? { x: 0, y: 0 };
      const copyG: Group = {
        ...fg,
        id: uid(),
        x: fg.x + 24,
        y: fg.y + 24,
        pos,
        items,
      };
      snapshot();
      setGroups((prev) => [...prev, copyG]);
      setSelectedIds(copyG.items.map((it) => it.id));
      return;
    }
    const isTop = groupsRef.current.some((g) => g.items.some((it) => it.id === selected.id));
    if (!isTop) {
      /* a part inside a container is copied right where it sits, a step over */
      const parent = parentOf(groupsRef.current, selected.id);
      const cur = parent?.children?.find((c) => c.id === selected.id);
      if (!parent || !cur) return;
      const born: PlacedItem = { ...(copySubtree(selected, uid, new Map()) as PlacedItem), x: cur.x + 16, y: cur.y + 16 };
      snapshot();
      setGroups((prev) =>
        prev.map((g) => (!!findItemIn(g.items, parent.id) ? { ...g, items: patchItemIn(g.items, parent.id, { children: [...(parent.children ?? []), born] as PlacedItem[] }) } : g)),
      );
      setSelectedIds([born.id]);
      return;
    }
    const rect = itemRects().find((r) => r.id === selected.id);
    if (!rect) return;
    /* a copied part brings its own container contents along, each with a fresh id */
    const copy: Item = copySubtree(selected, uid, new Map());
    /* a copied modal rail starts collapsed and standard: a screen shows one modal rail, and
       the copy sits inward of the edge the original remembered */
    if (copy.kind === "navRail" && copy.railModal) {
      copy.railModal = false;
      copy.railExpanded = false;
      delete copy[railExpansionSide];
    }
    snapshot();
    setGroups((prev) => [
      ...prev,
      {
        id: uid(),
        x: rect.l + 24,
        y: rect.t + 24,
        axis: connectSpecOf(copy)?.axis ?? "x",
        items: [copy],
      },
    ]);
    setSelectedIds([copy.id]);
  }, [selected, selectedIds, itemRects, snapshot]);

  /* The in-app clipboard: Ctrl+C keeps a copy of the selection (a whole group when
   * the selection covers one) with its offset inside its screen, so Ctrl+V can put it
   * at the same spot on another screen, or a step aside on the same one. */
  const clipboardRef = useRef<{ group: Group; dx: number; dy: number; frameId: string | null; parentId?: string } | null>(null);

  const copySelected = useCallback(() => {
    if (!selected) return;
    const ids = new Set(selectedIds);
    const g = groupsRef.current.find((x) => x.items.some((it) => it.id === selected.id));
    /* a part inside a container is kept on its own: pasting brings it back as its own layer */
    const home = g ?? groupsRef.current.find((x) => !!findItemIn(x.items, selected.id));
    if (!home) return;
    if (!g) {
      const rect = itemRects().find((r) => r.id === selected.id);
      if (!rect) return;
      const lone: Group = { id: home.id, x: rect.l, y: rect.t, axis: connectSpecOf(selected)?.axis ?? "x", items: [copySubtree(selected, uid, new Map())] };
      const f = frameOfGroup(home, framesRef.current, widthsRef.current);
      /* a part inside a container is pasted back beside itself, in that same container */
      clipboardRef.current = { group: lone, dx: f ? lone.x - f.x : 0, dy: f ? lone.y - f.y : 0, frameId: f?.id ?? null, parentId: parentOf(groupsRef.current, selected.id)?.id };
      return;
    }
    let group: Group;
    if (g.items.every((it) => ids.has(it.id))) {
      group = structuredClone(g);
    } else {
      const rect = itemRects().find((r) => r.id === selected.id);
      if (!rect) return;
      group = { id: g.id, x: rect.l, y: rect.t, axis: connectSpecOf(selected)?.axis ?? "x", items: [copySubtree(selected, uid, new Map())] };
    }
    /* a group on no screen keeps its canvas position; one on a screen keeps its offset there */
    const f = frameOfGroup(g, framesRef.current, widthsRef.current);
    clipboardRef.current = { group, dx: f ? group.x - f.x : 0, dy: f ? group.y - f.y : 0, frameId: f?.id ?? null };
  }, [selected, selectedIds, itemRects]);

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip) return;
    /* a part that came out of a container is pasted next to it, inside the same container */
    if (clip.parentId) {
      const parent = parentOf(groupsRef.current, clip.parentId) ?? findItemIn(groupsRef.current.flatMap((g) => g.items), clip.parentId);
      const kids = parent?.children ?? [];
      const source = clip.group.items[0];
      if (parent && source) {
        const copy = copySubtree(source, uid, new Map()) as PlacedItem;
        const at = kids.find((c) => c.id === source.id) ?? { x: 0, y: 0 };
        const born: PlacedItem = { ...copy, x: at.x + 16, y: at.y + 16 };
        snapshot();
        setGroups((gs) => gs.map((g) => (!!findItemIn(g.items, parent.id) ? { ...g, items: patchItemIn(g.items, parent.id, { children: [...(parent.children ?? []), born] as PlacedItem[] }) } : g)));
        setSelectedIds([born.id]);
        return;
      }
    }
    const fs = framesRef.current;
    /* the screen to paste into: the selected screen, else the selection's, else the source */
    let target = selectedFrameId ? fs.find((f) => f.id === selectedFrameId) : undefined;
    if (!target && selected) {
      const g = groupsRef.current.find((x) => x.items.some((it) => it.id === selected.id));
      if (g) target = frameOfGroup(g, fs, widthsRef.current) ?? undefined;
    }
    if (!target) target = fs.find((f) => f.id === clip.frameId);
    let x = target && clip.frameId ? target.x + clip.dx : clip.group.x;
    let y = target && clip.frameId ? target.y + clip.dy : clip.group.y;
    /* onto a spot already taken (the source, or an earlier paste) it steps aside like a duplicate */
    while (groupsRef.current.some((g) => g.x === x && g.y === y)) {
      x += 24;
      y += 24;
    }
    const idMap = new Map<string, string>();
    const items = clip.group.items.map((it) => copySubtree(it, uid, idMap));
    const pos: Record<string, { x: number; y: number }> | undefined = clip.group.pos ? {} : undefined;
    if (pos) for (const it of clip.group.items) pos[idMap.get(it.id)!] = clip.group.pos?.[it.id] ?? { x: 0, y: 0 };
    const copy: Group = { ...clip.group, id: uid(), x, y, pos, items };
    snapshot();
    setGroups((prev) => [...prev, copy]);
    setSelectedIds(copy.items.map((it) => it.id));
    setSelectedFrameId(null);
  }, [selected, selectedFrameId, snapshot]);

  /** the free group the whole selection belongs to, if it is exactly one */
  const selectedGroup = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const g = groups.find((x) => x.free && x.items.some((it) => it.id === selectedIds[0]));
    if (!g) return null;
    const ids = new Set(g.items.map((it) => it.id));
    return selectedIds.every((id) => ids.has(id)) && selectedIds.length === g.items.length ? g : null;
  }, [groups, selectedIds]);

  /** Pull the selected parts out of their runs into one free group that keeps
   *  their positions. It takes the layer slot of the topmost run involved. */
  /** Lines the selected parts up, or spaces them evenly. Whole groups move: a connected
   *  run or a hand-made group is one unit, like in Tidy. Several parts line up with each
   *  other's bounding box; a lone part lines up with the screen's body area, the box Tidy
   *  fills between the bars. A unit that would land on another part steps away from the
   *  edge it was aligned to until it is clear. */
  const alignSelected = useCallback(
    (kind: AlignKind) => {
      const ids = new Set(selectedIds);
      const all = groupsRef.current;
      const units = all.filter((g) => g.items.some((it) => ids.has(it.id)));
      if (units.length === 0) return;
      const unitIds = new Set(units.map((g) => g.id));
      const distributing = kind === "distributeH" || kind === "distributeV";
      const horizontal = kind === "left" || kind === "centerH" || kind === "right" || kind === "distributeH";
      const rects = new Map(all.map((g) => [g.id, groupBounds(g, widthsRef.current)]));
      let bb = units.map((g) => rects.get(g.id)!).reduce((a, r) => ({ l: Math.min(a.l, r.l), t: Math.min(a.t, r.t), r: Math.max(a.r, r.r), b: Math.max(a.b, r.b) }));
      let screenId: string | null = null;
      if (units.length === 1) {
        const f = frameOfGroup(units[0], framesRef.current, widthsRef.current);
        if (!f || distributing) return;
        screenId = f.id;
        bb = bodyRect(all, f, framesRef.current, widthsRef.current, new Set(units.map((g) => g.id)));
      }
      const shift = new Map<string, { dx: number; dy: number }>();
      if (distributing) {
        const sorted = [...units].sort((a, b) => (horizontal ? rects.get(a.id)!.l - rects.get(b.id)!.l : rects.get(a.id)!.t - rects.get(b.id)!.t));
        const sizes = sorted.map((g) => (horizontal ? rects.get(g.id)!.r - rects.get(g.id)!.l : rects.get(g.id)!.b - rects.get(g.id)!.t));
        const span = horizontal ? bb.r - bb.l : bb.b - bb.t;
        const gap = (span - sizes.reduce((s, v) => s + v, 0)) / (sorted.length - 1);
        let pos = horizontal ? bb.l : bb.t;
        sorted.forEach((g, i) => {
          const r = rects.get(g.id)!;
          shift.set(g.id, horizontal ? { dx: Math.round(pos) - r.l, dy: 0 } : { dx: 0, dy: Math.round(pos) - r.t });
          pos += sizes[i] + gap;
        });
      } else {
        /* parts that are not moving, on the same screen, that a moved unit must not land on */
        const others = all.filter((g) => !unitIds.has(g.id) && (!screenId || frameOfGroup(g, framesRef.current, widthsRef.current)?.id === screenId)).map((g) => rects.get(g.id)!);
        const hits = (r: { l: number; t: number; r: number; b: number }) => others.filter((o) => o.l < r.r && o.r > r.l && o.t < r.b && o.b > r.t);
        /* stepping away from the aligned edge: right of a left edge, up from a bottom edge; a centre tries both ways */
        const dir = kind === "left" || kind === "top" ? 1 : kind === "right" || kind === "bottom" ? -1 : 0;
        for (const g of units) {
          const r = rects.get(g.id)!;
          const w = r.r - r.l;
          const h = r.b - r.t;
          const ax = kind === "left" ? bb.l : kind === "centerH" ? Math.round((bb.l + bb.r) / 2 - w / 2) : kind === "right" ? bb.r - w : r.l;
          const ay = kind === "top" ? bb.t : kind === "centerV" ? Math.round((bb.t + bb.b) / 2 - h / 2) : kind === "bottom" ? bb.b - h : r.t;
          /* candidates stay inside the reference box; with no clear spot the plain alignment wins */
          let x = ax;
          let y = ay;
          let clear = false;
          for (let tries = 0, sign = dir || 1; tries < 12; tries++, sign = dir || -sign) {
            const blocking = hits({ l: x, t: y, r: x + w, b: y + h });
            if (!blocking.length) {
              clear = true;
              break;
            }
            const step = 8 + (horizontal ? Math.max(...blocking.map((o) => o.r - o.l)) : Math.max(...blocking.map((o) => o.b - o.t)));
            if (horizontal) x = clamp(x + sign * step * (dir ? 1 : tries + 1), bb.l, Math.max(bb.l, bb.r - w));
            else y = clamp(y + sign * step * (dir ? 1 : tries + 1), bb.t, Math.max(bb.t, bb.b - h));
          }
          if (!clear) {
            x = ax;
            y = ay;
          }
          shift.set(g.id, { dx: x - r.l, dy: y - r.t });
        }
      }
      if (![...shift.values()].some((s) => s.dx || s.dy)) return;
      snapshot();
      setGroups((gs) =>
        gs.map((g) => {
          const s = shift.get(g.id);
          return s && (s.dx || s.dy) ? { ...g, x: g.x + s.dx, y: g.y + s.dy } : g;
        }),
      );
    },
    [selectedIds, snapshot],
  );

  const groupSelected = useCallback(() => {
    const ids = new Set(selectedIds);
    if (ids.size < 2) return;
    const rects = new Map(itemRects().map((r) => [r.id, r]));
    const picked: Item[] = [];
    let top = -1;
    groupsRef.current.forEach((g, i) => {
      for (const it of g.items) if (ids.has(it.id)) {
        picked.push(it);
        top = i;
      }
    });
    if (picked.length < 2) return;
    const l = Math.min(...picked.map((it) => rects.get(it.id)!.l));
    const t = Math.min(...picked.map((it) => rects.get(it.id)!.t));
    const pos: Record<string, { x: number; y: number }> = {};
    for (const it of picked) pos[it.id] = { x: rects.get(it.id)!.l - l, y: rects.get(it.id)!.t - t };
    const ng: Group = { id: uid(), x: l, y: t, axis: "x", items: picked, free: true, pos };
    snapshot();
    setGroups((prev) => {
      const out: Group[] = [];
      prev.forEach((g, i) => {
        if (g.free) {
          const rest = g.items.filter((it) => !ids.has(it.id));
          if (rest.length) out.push(collapseFree({ ...g, items: rest }, widthsRef.current));
        } else {
          let x = g.x;
          let y = g.y;
          let items = g.items;
          while (items.length && ids.has(items[0].id)) {
            const sz = sizeOf(items[0], widthsRef.current);
            if (g.axis === "x") x += sz.w + GAP;
            else y += sz.h + GAP;
            items = items.slice(1);
          }
          items = items.filter((it) => !ids.has(it.id));
          if (items.length) {
            if (x !== g.x || y !== g.y) instantRef.current.add(g.id);
            out.push({ ...g, x, y, items });
          }
        }
        if (i === top) out.push(ng);
      });
      return out;
    });
    setSelectedIds(picked.map((it) => it.id));
  }, [selectedIds, itemRects, snapshot]);

  /* ---------- containers: parts that hold other parts ---------- */

  /** the parts of the selection that still sit on a screen (a child already inside
   *  another container is left where it is) */
  const pickedTop = useCallback((ids: Set<string>) => {
    const rects = new Map(itemRects().map((r) => [r.id, r]));
    const picked: Item[] = [];
    let top = -1;
    groupsRef.current.forEach((g, i) => {
      for (const it of g.items) if (ids.has(it.id)) {
        picked.push(it);
        top = i;
      }
    });
    return { picked, rects, top };
  }, [itemRects]);

  /** Wraps the selection in a new box: the container is the selection's bounding box with
   *  a margin, and every selected part becomes a child with its place inside it kept. */
  const containerizeSelected = useCallback(() => {
    const ids = new Set(selectedIds);
    if (ids.size === 0) return;
    const { picked, rects, top } = pickedTop(ids);
    if (picked.length === 0) return;
    const l = Math.min(...picked.map((it) => rects.get(it.id)!.l));
    const t = Math.min(...picked.map((it) => rects.get(it.id)!.t));
    const r = Math.max(...picked.map((it) => rects.get(it.id)!.r));
    const b = Math.max(...picked.map((it) => rects.get(it.id)!.b));
    const boxW = Math.min(PHONE_W, Math.round(r - l + CONTAINER_PAD * 2));
    const boxH = Math.round(b - t + CONTAINER_PAD * 2);
    const box = makeItem("box");
    box.id = uid();
    box.size = boxW;
    box.size2 = boxH;
    /* becoming a child means drawing above the parent, contents and all (see liftAbove) */
    box.children = picked.map((it) =>
      liftAbove({ ...it, x: Math.round(rects.get(it.id)!.l - l + CONTAINER_PAD), y: Math.round(rects.get(it.id)!.t - t + CONTAINER_PAD) }, layerOf(box) + 1),
    );
    const ng: Group = { id: uid(), x: Math.round(l - CONTAINER_PAD), y: Math.round(t - CONTAINER_PAD), axis: "x", items: [box], free: true };
    snapshot();
    setGroups((prev) => {
      const out: Group[] = [];
      prev.forEach((g, i) => {
        if (g.free) {
          const rest = g.items.filter((it) => !ids.has(it.id));
          if (rest.length) out.push(collapseFree({ ...g, items: rest }, widthsRef.current));
        } else {
          const items = g.items.filter((it) => !ids.has(it.id));
          if (items.length) out.push({ ...g, items });
        }
        if (i === top) out.push(ng);
      });
      return out.length ? out : [ng];
    });
    setSelectedIds([box.id]);
    setRightTab("edit");
  }, [selectedIds, pickedTop, snapshot]);

  /** Puts the rest of the selection inside the one box the selection holds. */
  const adoptSelected = useCallback(() => {
    const ids = new Set(selectedIds);
    const { picked, rects } = pickedTop(ids);
    const boxes = picked.filter((it) => it.kind === "box");
    if (boxes.length !== 1 || picked.length < 2) return;
    const box = boxes[0];
    const boxRect = rects.get(box.id)!;
    const kids = picked.filter((it) => it.id !== box.id);
    snapshot();
    setGroups((prev) => {
      const out: Group[] = [];
      for (const g of prev) {
        /* only the box stays where it was; the adopted parts leave their groups */
        const rest = g.items.filter((it) => !ids.has(it.id) || it.id === box.id);
        if (rest.length === 0) continue;
        out.push(g.free ? collapseFree({ ...g, items: rest }, widthsRef.current) : { ...g, items: rest });
      }
      return out.map((g) => ({
        ...g,
        items: g.items.map((it) =>
          it.id === box.id
            ? {
                ...it,
                children: [
                  ...(it.children ?? []),
                  ...kids.map((k) =>
                    liftAbove({ ...k, x: Math.round(rects.get(k.id)!.l - boxRect.l), y: Math.round(rects.get(k.id)!.t - boxRect.t) }, layerOf(it) + 1),
                  ),
                ] as PlacedItem[],
              }
            : it,
        ),
      }));
    });
    setSelectedIds([box.id]);
  }, [selectedIds, pickedTop, snapshot]);

  /** Takes the selection back out of its container, at the place it sits now. Naming a
   *  container lets all of its children go; naming a child lets that one go. */
  const unlinkSelected = useCallback(() => {
    const ids = new Set(selectedIds);
    if (ids.size === 0) return;
    const rects = new Map(itemRects().map((r) => [r.id, r]));
    snapshot();
    setGroups((prev) => {
      const freeing = new Set<string>();
      for (const g of prev) for (const it of g.items) {
        /* a container the author names lets all of its children go */
        if (ids.has(it.id)) for (const c of it.children ?? []) freeing.add(c.id);
        /* a child the author names is the one that leaves */
        for (const c of it.children ?? []) if (ids.has(c.id)) freeing.add(c.id);
      }
      const out: Group[] = [];
      for (const g of prev) {
        const freed: { child: PlacedItem; owner: Item }[] = [];
        /* the places a tab row has just lost, filled again below: a panel that leaves takes the
           empty panel of its tab's place, so the panels after it keep their own tabs */
        const lost = new Map<string, number[]>();
        const items = g.items.map((it) => {
          if (!it.children) return it;
          const keep = it.children.filter((c) => !freeing.has(c.id));
          for (const [at, c] of it.children.entries()) if (freeing.has(c.id)) {
            freed.push({ child: c, owner: it });
            if (it.kind === "tabs") lost.set(it.id, [...(lost.get(it.id) ?? []), at]);
          }
          return { ...it, children: keep.length ? keep : undefined };
        });
        out.push({ ...g, items: refillPanels(items, lost) });
        /* a freed part lands on the screen as its own layer, where it was drawn */
        for (const { child, owner } of freed) {
          const o = rects.get(owner.id);
          const { x: _x, y: _y, ...it } = child;
          out.push({ id: uid(), x: (o?.l ?? g.x) + child.x, y: (o?.t ?? g.y) + child.y, axis: "x", items: [it], free: true });
        }
      }
      return out.filter((g) => g.items.length > 0);
    });
    setSelectedIds([]);
  }, [selectedIds, snapshot]);

  /** Saves a part and everything inside it — the container included — as a composite. */
  const saveAsComposite = useCallback((id: string, name: string) => {
    const owner = groupsRef.current.find((g) => !!findItemIn(g.items, id));
    const it = owner ? findItemIn(owner.items, id) : null;
    if (!it) return;
    const size = sizeOf(it, widthsRef.current);
    /* the container itself is the template, at exactly the size it has on the canvas */
    const part: CustomPart = {
      id: uid(),
      name: name.trim() || it.label.trim() || t("composite", lang),
      w: Math.round(size.w),
      h: Math.round(size.h),
      items: [{ ...(it as PlacedItem), x: 0, y: 0 }],
    };
    const taken = customParts.find((c) => c.name.trim() === part.name);
    setCustomParts((cur) => (taken ? cur.map((c) => (c.id === taken.id ? { ...part, id: c.id } : c)) : [...cur, part]));
    setSaveAsk(null);
    setLeftTab("parts");
    setLeftOpen(true);
    showToast(t("addToComposites", lang), 1600, "library_add");
  }, [customParts, lang]);

  /** the composite being named before it is kept */
  const [saveAsk, setSaveAsk] = useState<{ itemId: string; name: string } | null>(null);

  /** Takes one part out of the container that holds it, right where it sits. */
  const freePart = useCallback((itemId: string) => {
    const parent = parentOf(groupsRef.current, itemId);
    const rect = itemRects().find((r) => r.id === itemId);
    if (!parent || !rect) return;
    const held = findItemIn(groupsRef.current.flatMap((g) => g.items), itemId) as PlacedItem | null;
    if (!held) return;
    snapshot();
    setGroups((prev) => {
      const out = prev.map((g) => {
        const owner = findItemIn(g.items, parent.id);
        if (!owner) return g;
        const at = (owner.children ?? []).findIndex((c) => c.id === itemId);
        const keep = (owner.children ?? []).filter((c) => c.id !== itemId);
        /* a panel that leaves a tab row leaves the empty panel of its tab behind: the row's
           panels are known by their place, so its neighbours would slide back a tab without it */
        const next = keepPanelSlots({ ...owner, children: keep }, at < 0 ? [] : [at]);
        return { ...g, items: patchItemIn(g.items, parent.id, { children: next.length ? next : undefined }) };
      });
      const { x: _x, y: _y, ...it } = held;
      /* they gather in one group of their own, named so the panel says what it is */
      const name = t("movedOut", lang);
      const bin = out.find((g) => g.name === name);
      const bornPos = { x: rect.l - (bin?.x ?? rect.l), y: rect.t - (bin?.y ?? rect.t) };
      if (bin) {
        return out.map((g) => (g.id === bin.id ? { ...g, items: [...g.items, it], pos: { ...(g.pos ?? {}), [it.id]: bornPos } } : g));
      }
      return [...out, { id: uid(), name, x: rect.l, y: rect.t, axis: "x", items: [it], free: true, pos: { [it.id]: { x: 0, y: 0 } } }];
    });
    setSelectedIds([itemId]);
  }, [itemRects, snapshot]);

  /** Asks, with both names, before moving a part into a container on its screen. */
  const [nestAsk, setNestAsk] = useState<{ itemIds: string[]; containerId: string; itemName: string; containerName: string } | null>(null);

  const askNest = useCallback((items: Item[], wants?: string) => {
    const rects = new Map(itemRects().map((r) => [r.id, r]));
    const picked = items.map((it) => rects.get(it.id)).filter((r): r is NonNullable<typeof r> => !!r);
    if (picked.length === 0 || picked.length !== items.length) return;
    /* what the drop is judged by: the box around everything being dropped, which is one part or
       every part of a run */
    const me = {
      l: Math.min(...picked.map((r) => r.l)),
      t: Math.min(...picked.map((r) => r.t)),
      r: Math.max(...picked.map((r) => r.r)),
      b: Math.max(...picked.map((r) => r.b)),
    };
    const ids = new Set(items.map((it) => it.id));
    /* a container cannot be dropped into itself or into anything it holds */
    const boxes = itemsOf(groupsRef.current).filter(
      (b) => b.kind === "box" && !ids.has(b.id) && !items.some((it) => subtreeOf(it).some((d) => d.id === b.id)),
    );
    const home = groupsRef.current.find((g) => !!findItemIn(g.items, items[0].id));
    const page = home ? frameOfGroup(home, framesRef.current, widthsRef.current) : null;
    const here = boxes.filter((b) => {
      const owner = groupsRef.current.find((g) => !!findItemIn(g.items, b.id));
      return !page || (owner ? frameOfGroup(owner, framesRef.current, widthsRef.current)?.id === page.id : false);
    });
    /* The row the author dropped onto decides, and only it: falling back to "the box that overlaps
       most" would move the part somewhere they did not point at. */
    if (wants) {
      /* a tab row receives into the panel of the tab in front, and says so in the question */
      const row = itemsOf(groupsRef.current).find((x) => x.id === wants);
      const outside = !!row && !items.some((it) => subtreeOf(it).some((d) => d.id === row.id));
      const isRow = row?.kind === "tabs" && outside;
      /* A row takes what is dropped on it; so does a part that writes text of its own, which a
         dragged text belongs inside. */
      const named = isRow ? row : (boxes.find((b) => b.id === wants) ?? (outside && row && items.every((it) => it.kind === "text") && takesText(row) ? row : undefined));
      if (!named) {
        showToast(t("nestSelf", lang), 2000, "info");
        return;
      }
      setNestAsk({
        itemIds: items.map((it) => it.id),
        containerId: named.id,
        itemName: describeItems(items, lang),
        /* a box that goes back into the panel of its own tab is named after that tab, not after the
           one in front */
        containerName:
          named.kind === "tabs"
            ? named.tabs?.[(items.length === 1 ? panelSlotFor(named, items[0]) : null) ?? tabIndexOf(named)]?.label.trim() || named.label.trim() || t("tabs", lang)
            : named.label.trim() || KIND_TEXT[lang][named.kind]?.noun || t("container", lang),
      });
      return;
    }
    const pool = here.length ? here : boxes;
    if (pool.length === 0) {
      showToast(t("nestNoContainer", lang), 1800, "info");
      return;
    }
    const mine = (b: Item) => {
      const r = rects.get(b.id);
      return r ? Math.max(0, Math.min(r.r, me.r) - Math.max(r.l, me.l)) * Math.max(0, Math.min(r.b, me.b) - Math.max(r.t, me.t)) : 0;
    };
    const box = [...pool].sort((a, b) => mine(b) - mine(a))[0];
    setNestAsk({
      itemIds: items.map((it) => it.id),
      containerId: box.id,
      /* the name the layers panel shows for it, so the question reads as the author sees it */
      itemName: describeItems(items, lang),
      containerName: box.label.trim() || t("container", lang),
    });
  }, [itemRects, lang]);

  /**
   * Puts parts inside a container: a container takes them directly, while a tab row takes a box
   * named after one of its empty panels back into that panel — the author is putting back a panel
   * they took out, and a panel is known by its place in the row — and anything else into the panel
   * of the tab in front, making the row's panels first when it has none, in the same step. Null
   * means the container is gone, so the caller can leave the drop alone rather than lose the parts.
   */
  const putIn = useCallback((groups: Group[], parts: { item: Item; at: { l: number; t: number } }[], containerId: string): Group[] | null => {
    const parts_ = parts;
    const target = groups.map((g) => findItemIn(g.items, containerId)).find(Boolean) as Item | null;
    if (!target) return null;
    if (target.kind === "tabs") {
      const patch = tabPanelsPatch(target);
      const row = patch ? { ...target, ...patch } : target;
      const out = patch ? groups.map((g) => (findItemIn(g.items, row.id) ? { ...g, items: patchItemIn(g.items, row.id, patch) } : g)) : groups;
      /* one box, named after a tab whose panel is empty: it goes back in that panel, where it was */
      const one = parts_.length === 1 ? (parts_[0].item as PlacedItem) : null;
      const back = one ? restorePanel(row, one, widthsRef.current) : null;
      if (back) return out.map((g) => (findItemIn(g.items, row.id) ? { ...g, items: patchItemIn(g.items, row.id, { children: back }) } : g));
      const panel = tabPanelId(row);
      return panel ? putIn(out, parts_, panel) : null;
    }
    /* The empty panel of a tab is scaffolding, not content: a box named for that tab goes back into
       the row's slot rather than inside the panel, which is what the author aimed at. */
    const dropped = parts_.length === 1 ? (parts_[0].item as PlacedItem) : null;
    const parentRow = dropped ? parentOf(groups, target.id) : null;
    if (dropped && parentRow?.kind === "tabs") {
      const panelAt = (parentRow.children ?? []).findIndex((c) => c.id === target.id);
      if (panelAt >= 0 && panelSlotFor(parentRow, dropped) === panelAt) {
        const back = restorePanel(parentRow, dropped, widthsRef.current);
        if (back) return groups.map((g) => (findItemIn(g.items, parentRow.id) ? { ...g, items: patchItemIn(g.items, parentRow.id, { children: back }) } : g));
      }
    }
    const rects = new Map(itemRects().map((r) => [r.id, r]));
    const at = rects.get(target.id);
    if (!at) return null;
    const borns = parts_.map((p) => childAt(target, p.item, p.at, at, widthsRef.current));
    return groups.map((g) => (findItemIn(g.items, target.id) ? { ...g, items: patchItemIn(g.items, target.id, { children: [...(findItemIn(g.items, target.id)?.children ?? []), ...borns] as PlacedItem[] }) } : g));
  }, [itemRects]);

  /** the confirmed move: the parts become children, keeping the place they had on screen */
  const nestInto = useCallback((itemIds: string[], containerId: string) => {
    const rects = new Map(itemRects().map((r) => [r.id, r]));
    const moving = itemIds.map((id) => {
      const it = findItemIn(groupsRef.current.flatMap((g) => g.items), id) as PlacedItem | null;
      const r = rects.get(id);
      return it && r ? { item: it, at: { l: r.l, t: r.t } } : null;
    });
    if (moving.some((m) => !m)) return;
    const gone = new Set(itemIds);
    snapshot();
    setGroups((prev) => {
      /* the parts leave their groups (and their runs) first */
      const out: Group[] = [];
      for (const g of prev) {
        /* A part being nested may sit inside a container rather than in the group's own run: the
           pruning has to be taken whenever anything went, however deep — keeping the group's own
           items on a length check would quietly leave the part where it was and add a second copy
           inside the container it was dropped on. */
        const { items: without, changed } = pruneParts(g.items, gone);
        if (!changed) {
          out.push(g);
          continue;
        }
        if (g.free) {
          if (without.length) out.push(collapseFree({ ...g, items: without }, widthsRef.current));
          continue;
        }
        let x = g.x;
        let y = g.y;
        let rest = g.items;
        while (rest.length && gone.has(rest[0].id)) {
          const sz = sizeOf(rest[0], widthsRef.current);
          if (g.axis === "x") x += sz.w + GAP;
          else y += sz.h + GAP;
          rest = rest.slice(1);
        }
        if (without.length) out.push({ ...g, x, y, items: without });
      }
      return putIn(out, moving as { item: Item; at: { l: number; t: number } }[], containerId) ?? out;
    });
    setSelectedIds(itemIds);
    setNestAsk(null);
  }, [itemRects, putIn, snapshot]);

  /** Binds a dialog to a part. The dialog lives on the part's own page, hidden until the
   *  tap: the first press adds it there (making a page first when the part has none), and
   *  every press after that finds the very same one again. */
  /** Split a free group back into single runs at their current positions, in the same layer slot. */
  const ungroupSelected = useCallback(() => {
    const g = selectedGroup;
    if (!g) return;
    snapshot();
    const singles: Group[] = explodeGroup(g, widthsRef.current).map((run) => ({ ...run, id: uid() }));
    for (const sg of singles) instantRef.current.add(sg.id);
    setGroups((prev) => prev.flatMap((x) => (x.id === g.id ? singles : [x])));
  }, [selectedGroup, snapshot]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0 && selectedFrameId) {
        const f = framesRef.current.find((x) => x.id === selectedFrameId);
        if (!f) return;
        snapshotFor("nudge:frame:" + f.id);
        const carried = new Set(
          groupsRef.current
            .filter(
              (g) =>
                frameOfGroup(g, framesRef.current, widthsRef.current)?.id ===
                f.id,
            )
            .map((g) => g.id),
        );
        for (const id of carried) instantRef.current.add(id);
        setFrames((fs) =>
          fs.map((x) =>
            x.id === f.id ? { ...x, x: x.x + dx, y: x.y + dy } : x,
          ),
        );
        setGroups((gs) =>
          gs.map((g) =>
            carried.has(g.id) ? { ...g, x: g.x + dx, y: g.y + dy } : g,
          ),
        );
        return;
      }
      if (selectedIds.length === 0) return;
      const ids = new Set(selectedIds);
      const moving = new Set(
        groupsRef.current
          .filter((g) => g.items.some((it) => ids.has(it.id)))
          .map((g) => g.id),
      );
      /* a part inside a container moves within it instead of moving the whole group */
      const inside = [...ids].filter(
        (id) => !groupsRef.current.some((g) => g.items.some((it) => it.id === id)) && groupsRef.current.some((g) => !!findItemIn(g.items, id)),
      );
      if (moving.size === 0 && inside.length === 0) return;
      snapshotFor("nudge:" + selectedIds.join(","));
      setGroups((prev) =>
        prev.map((g) => {
          const kids = inside.filter((id) => !!findItemIn(g.items, id));
          const moved = moving.has(g.id) ? { ...g, x: g.x + dx, y: g.y + dy } : g;
          if (kids.length === 0) return moved;
          let items = moved.items;
          for (const id of kids) {
            const it = findItemIn(items, id) as PlacedItem | null;
            if (it) items = patchItemIn(items, id, { x: it.x + dx, y: it.y + dy });
          }
          return { ...moved, items };
        }),
      );
    },
    [selectedIds, selectedFrameId, snapshotFor],
  );

  const clearAll = () => {
    setConfirmClear(false);
    if (groupsRef.current.length === 0 && framesRef.current.length === 0)
      return;
    setDraftBefore(null);
    setQuickUndo(false);
    try {
      localStorage.removeItem(BEFORE_KEY);
    } catch {}
    snapshot();
    setGroups([]);
    setFrames([]);
    setSelectedIds([]);
    setSelectedFrameId(null);
  };

  /** Opening a project file replaces the canvas with the same restore path the saved
   *  document goes through, then starts the editor fresh on it. */
  const importDoc = (next: Doc) => {
    hadDocRef.current = true;
    /* the whole document being replaced stays one undo away */
    snapshot(true);
    /* whatever was under review is over: a file, a clear or a new arrival replaces it */
    setDraftBefore(null);
    setQuickUndo(false);
    try {
      localStorage.removeItem(BEFORE_KEY);
    } catch {}
    applyDoc(next, true);
    if (!mobileRef.current) {
      const nextFrame = next.frame === "blank" ? "blank" : "phone";
      setFrame(nextFrame);
      frameRef.current = nextFrame;
    }
    setSelectedIds([]);
    setSelectedFrameId(null);
    setSelectedLinkId(null);
    setWidths({});
    lastPatchRef.current = { key: "", at: 0 };
    queueMicrotask(() => fitRef.current());
  };

  /* A link with a design in its hash offers it once the editor is ready to take it,
     whether the page opened on that link or the link was pasted into this tab. */
  useEffect(() => {
    if (editAccess !== "editable" || typeof window === "undefined") return;
    let active = true;
    const offer = () => {
      if (!hasShareHash(window.location.hash)) return;
      void readShareHash(window.location.hash).then((next) => {
        if (!active) return;
        if (next) {
          setShareOpen(false);
          arrive(next);
          clearShareHash();
        } else {
          clearShareHash();
          showToast(t("invalidProject", getLang()), 3000, "error");
        }
      });
    };
    offer();
    window.addEventListener("hashchange", offer);
    return () => {
      active = false;
      window.removeEventListener("hashchange", offer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editAccess]);

  /** Asks the author's own model for a design and puts it on the canvas. The guide it reads
   *  is the one a coding agent reads (public/agent.md). The replaced design waits in
   *  `draftBefore` until the author keeps or undoes the draft. */
  /** A design that arrived from a model or a link takes the canvas with its colours easing
   *  over; the design it replaced waits in `draftBefore` until the author keeps or undoes it. */
  const arrive = (next: Doc) => {
    /* the phone editor has no keep / undo buttons: a link simply opens there, undoable as usual */
    if (mobileRef.current) {
      importDoc(next);
      return;
    }
    const before = draftBeforeRef.current ?? docRef.current;
    setRevealing(true);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setRevealing(false), 900);
    importDoc(next);
    setDraftBefore(before);
    try {
      localStorage.setItem(BEFORE_KEY, JSON.stringify(before));
    } catch {}
  };

  const startDraft = async (idea: string) => {
    setShareOpen(false);
    setDraftBusy(true);
    try {
      if (guideRef.current === null) {
        const res = await fetch(`${BASE_PATH}/agent.md`);
        if (!res.ok) throw new Error("guide");
        guideRef.current = await res.text();
      }
      const next = await draftDesign(aiSettings, guideRef.current, idea, lang);
      arrive(next);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      showToast(m === "json" ? t("aiErrorJson", lang) : m === "refusal" ? t("aiErrorRefusal", lang) : m === "long" ? t("aiErrorLong", lang) : t("aiError", lang), 3200, "error");
    } finally {
      setDraftBusy(false);
    }
  };
  /** true after a kept draft until the author undoes something, so the header's undo also sits by the opener */
  const [quickUndo, setQuickUndo] = useState(false);
  const keepDraft = () => {
    setDraftBefore(null);
    setQuickUndo(true);
    try {
      localStorage.removeItem(BEFORE_KEY);
    } catch {}
  };
  const undoDraft = () => {
    if (draftBefore) {
      setRevealing(true);
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealing(false), 900);
      importDoc(draftBefore);
    }
    setDraftBefore(null);
  };

  /** drops the design from the URL once it has been taken or declined */
  const clearShareHash = () => {
    if (typeof window !== "undefined" && window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  };

  const selectedFrame = useMemo(
    () => frames.find((f) => f.id === selectedFrameId) ?? null,
    [frames, selectedFrameId],
  );
  const selectedPartFrame = useMemo(() => {
    if (!primaryId || frame !== "phone") return null;
    const g = groups.find((x) => !!findItemIn(x.items, primaryId));
    return g ? (frameOfGroup(g, frames, widths) ?? null) : null;
  }, [primaryId, frame, groups, frames, widths]);

  /** the screen in play: the selected one, or the one under the selected part. The AI reads it,
   *  and it is what the panel would work on */
  const screenInPlay = useMemo((): Frame | null => {
    if (frame !== "phone" || isMobile) return null;
    if (selectedFrame) return selectedFrame;
    if (!primaryId) return null;
    const g = groups.find((x) => !!findItemIn(x.items, primaryId));
    return g ? (frameOfGroup(g, frames, widths) ?? null) : null;
  }, [frame, isMobile, selectedFrame, primaryId, groups, frames, widths]);

  /** the document as it stood on a screen size the author has already worked on */
  const presetMemory = useRef(new Map<string, { frames: Frame[]; groups: Group[] }>());

  const nextFrameX = () =>
    framesRef.current.length
      ? Math.max(...framesRef.current.map((f) => frameRect(f).r)) + FRAME_GAP
      : 0;

  /** Entering phone mode with no frames wraps the existing parts in one. */
  const ensureFrame = () => {
    if (framesRef.current.length > 0) return;
    const gs = groupsRef.current;
    let x = 0;
    let y = 0;
    if (gs.length) {
      const bbs = gs.map((g) => groupBounds(g, widthsRef.current));
      const l = Math.min(...bbs.map((b) => b.l));
      const t = Math.min(...bbs.map((b) => b.t));
      const r = Math.max(...bbs.map((b) => b.r));
      x = Math.round(Math.max(l - 24, r - PHONE_W + 24 > l ? l : l - 24));
      y = Math.round(t - 72);
      x = Math.min(x, l);
      y = Math.min(y, t);
    }
    const f: Frame = { id: uid(), name: t("home"), x, y };
    setFrames([f]);
  };

  const ensureFrameRef = useRef(() => {});
  ensureFrameRef.current = ensureFrame;

  /** phone UI: the plus button drops a new button where the view is looking,
   *  kept inside the screen, and nudged down when that spot is already taken */
  const addButton = () => {
    const r = canvasRect();
    const v = viewRef.current;
    const item = makeItem("button");
    const sz = sizeOf(item, widthsRef.current);
    const f = framesRef.current[0];
    let x = ((r?.width ?? 0) / 2 - v.x) / v.z - sz.w / 2;
    let y = ((r?.height ?? 0) / 2 - v.y) / v.z - sz.h / 2;
    if (f) {
      const { w, h } = frameSizeOf(f);
      const lx = f.x + Math.min(FRAME_MARGIN, (w - sz.w) / 2);
      const ly = f.y + Math.min(FRAME_MARGIN, (h - sz.h) / 2);
      x = clamp(x, lx, Math.max(lx, f.x + w - FRAME_MARGIN - sz.w));
      y = clamp(y, ly, Math.max(ly, f.y + h - FRAME_MARGIN - sz.h));
      const taken = (yy: number) =>
        itemRects().some((o) => o.l < x + sz.w && o.r > x && o.t < yy + sz.h && o.b > yy);
      let tries = 0;
      while (taken(y) && y + sz.h * 2 < f.y + h && tries++ < 12) y += sz.h + 12;
    }
    snapshot();
    setGroups((gs) => [
      ...gs,
      {
        id: uid(),
        x: Math.round(x),
        y: Math.round(y),
        axis: "x",
        items: [item],
      },
    ]);
    setSelectedIds([item.id]);
    setSelectedFrameId(null);
    setSheet(null);
  };

  const changeFrame = (f: FrameMode) => {
    if (f === frame) return;
    snapshot();
    setFrame(f);
    frameRef.current = f;
    if (f === "phone") ensureFrame();
    setSelectedFrameId(null);
    setSelectedLinkId(null);
    queueMicrotask(() => fitRef.current());
  };

  const addFrame = () => {
    snapshot();
    const base = framesRef.current[0];
    const f: Frame = {
      id: uid(),
      name: `${t("screenN")} ${framesRef.current.length + 1}`,
      x: nextFrameX(),
      y: base?.y ?? 0,
    };
    setFrames((fs) => [...fs, f]);
    setSelectedFrameId(f.id);
    setSelectedIds([]);
    const r = canvasRect();
    if (r) {
      const z = viewRef.current.z;
      const { w, h } = frameSizeOf(f);
      setView({
        x: r.width / 2 - (f.x + w / 2) * z,
        y: r.height / 2 - (f.y + h / 2) * z,
        z,
      });
    }
  };

  /**
   * A page for a dialog. It is drawn like a screen — the same size, the same margins, the same tidy
   * — but a tap opens only what is drawn on it: the page is the stage the dialog was laid out on, so
   * its own background never appears. That is what keeps a dialog from covering the screen it opens
   * over, and it is why a dialog can be edited without hiding anything.
   */
  const addDialogFrame = useCallback(
    (bindTo?: string, target?: string | null) => {
    snapshot();
    const screens = framesRef.current.filter((f) => !isOverlayFrame(f));
    const base = screens[screens.length - 1] ?? framesRef.current[0];
    const f: Frame = {
      id: uid(),
      name: `${t("dialogN", lang)} ${framesRef.current.filter(isOverlayFrame).length + 1}`,
      x: nextFrameX(),
      y: base?.y ?? 0,
      /* the author can change the level from here; a dialog is what this button is for */
      role: "overlay",
      level: DEFAULT_OVERLAY_LEVEL,
      /* the shape of the screens it belongs to, so drawing in it feels like drawing in one */
      ...(base ? framePresetPatch(framePresetOf(base)) : {}),
    };
    setFrames((fs) => [...fs, f]);
    /* the tap that asked for it opens it: making a dialog and wiring it are one action */
    if (bindTo) {
      setGroups((gs) =>
        gs.map((g) => {
          const it = findItemIn(g.items, bindTo);
          return it ? { ...g, items: patchItemIn(g.items, bindTo, actionPatchFor(it, target ?? null, { to: f.id, transition: "expand", dialog: true })) } : g;
        }),
      );
    }
    setLayersFrameId(f.id);
    setSelectedFrameId(f.id);
    setSelectedIds([]);
    /* put it in the middle of the window, the way a new screen arrives */
    const r = canvasRect();
    if (r) {
      const z = viewRef.current.z;
      const { w, h } = frameSizeOf(f);
      setView({ x: r.width / 2 - (f.x + w / 2) * z, y: r.height / 2 - (f.y + h / 2) * z, z });
    }
    },
    [lang, snapshot],
  );

  const patchFrame = (id: string, patch: Partial<Frame>) => {
    snapshotFor("frame:" + id + ":" + Object.keys(patch).join(","));
    setFrames((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const setFramePreset = (id: string, preset: FramePreset) => {
    const current = framesRef.current.find((f) => f.id === id);
    if (!current) return;
    const next = { ...current, ...framePresetPatch(preset) };
    const before = frameSizeOf(current);
    const after = frameSizeOf(next);
    if (before.w === after.w && before.h === after.h) return;
    const frames = framesRef.current;
    /* the screens to the right move over, parts take the sizes the new screen calls for,
     * and the screen is laid out again by the tidy rules */
    /* A screen size is a round trip: the whole document as it stood on a size is kept, so
     *  coming back to that size puts every screen and every part exactly where it was —
     *  the screens beside it included, which is what stops them drifting away. */
    const key = (size: FramePreset) => `${id}:${size}`;
    /* Pin what stands on this screen first: the screen is about to get wider or taller, and
     * a part must not change hands because the new rectangle happens to reach over it. */
    const pinned = groupsRef.current.map((g) => (frameOfGroup(g, frames, widthsRef.current)?.id === id && g.frameId !== id ? { ...g, frameId: id } : g));
    if (pinned.some((g, i) => g !== groupsRef.current[i])) setGroups(pinned);
    presetMemory.current.set(key(framePresetOf(current)), { frames: framesRef.current, groups: pinned });
    const arriving = presetMemory.current.get(key(preset));
    const laid = arriving ?? carryFrame(pinned, current, next, frames, widthsRef.current);
    /* a target the author never picked follows the screens */
    if (platform === defaultPlatformOf(frames, frameRef.current)) setPlatform(null);
    snapshot();
    setEasing(true);
    window.setTimeout(() => setEasing(false), SETTLE_MS + 40);
    setFrames(laid.frames);
    setGroups(laid.groups);
  };

  const toastTimer = useRef<number | null>(null);
  /** the desktop's message pill under the header; the phone keeps its centered toast */
  const showAiNote = (text: string, icon = "check", ms = 2200) => {
    setAiNote({ text, icon });
    if (aiNoteTimer.current) window.clearTimeout(aiNoteTimer.current);
    aiNoteTimer.current = window.setTimeout(() => setAiNote(null), ms);
  };

  const showToast = (msg: string, ms = 2200, icon = "info") => {
    if (!mobileRef.current) {
      showAiNote(msg, icon, ms);
      return;
    }
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };

  const updateAiSettings = (s: AiSettings) => {
    setAiSettings(s);
    saveAiSettings(s);
  };

  const aiReady = hasKey(aiSettings) && aiSettings.model.trim().length > 0 && isSecureUrl(aiSettings.baseUrl);
  const aiReason = !aiReady ? t("aiNoKey", lang) : !screenInPlay ? t("aiSelectScreen", lang) : undefined;

  /** Writes one field with the model: a part's behavior note, or a screen's description.
   *  The result goes straight in; the field remembers what it said so the rewrite can be undone. */
  const runAi = async (action: AiActionKey, f: Frame, itemId?: string) => {
    if (!aiReady) {
      showToast(t("aiNoKey", lang));
      return;
    }
    const curDoc = doc;
    aiAbortRef.current?.abort();
    const ac = new AbortController();
    aiAbortRef.current = ac;
    setAiBusy(true);
    setAiFrameId(f.id);
    try {
      if (action === "describe") {
        const r = await proposeDescription(aiSettings, curDoc, widthsRef.current, f, lang, ac.signal);
        if (ac.signal.aborted) return;
        snapshot();
        setFrames((fs) => fs.map((x) => (x.id === f.id ? { ...x, note: r.note, noteHistory: pushHistory(x.noteHistory, x.note), name: r.name ?? x.name } : x)));
        showAiNote(t("aiApplied", lang));
        return;
      }
      if (!itemId) return;
      const note = await proposeBehavior(aiSettings, curDoc, widthsRef.current, f, lang, itemId, ac.signal);
      if (ac.signal.aborted) return;
      if (!note) {
        showToast(t("aiErrorJson", lang));
        return;
      }
      snapshot();
      setGroups((gs) => gs.map((g) => (g.items.some((it) => it.id === itemId) ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, note, noteHistory: pushHistory(it.noteHistory, it.note) } : it)) } : g)));
      showAiNote(t("aiApplied", lang));
    } catch (e) {
      if (!ac.signal.aborted) showToast(aiErrorText(e, lang), 4000, "error");
    } finally {
      if (aiAbortRef.current === ac) {
        aiAbortRef.current = null;
        setAiBusy(false);
        setAiFrameId(null);
      }
    }
  };

  const cancelAi = () => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiBusy(false);
    setAiFrameId(null);
  };

  useEffect(
    () => () => {
      aiAbortRef.current?.abort();
      if (aiNoteTimer.current) window.clearTimeout(aiNoteTimer.current);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  /** a screen takes everything on it along, and links into it are dropped */
  const deleteFrame = useCallback(
    (id: string) => {
      snapshot();
      const gone = new Set(
        groupsRef.current
          .filter((g) => frameOfGroup(g, framesRef.current, widthsRef.current)?.id === id)
          .map((g) => g.id),
      );
      setFrames((fs) =>
        fs
          .filter((f) => f.id !== id)
          .map((f) => {
            if (!f.swipe) return f;
            const swipe = Object.fromEntries(Object.entries(f.swipe).filter(([, to]) => to !== id));
            return { ...f, swipe: Object.keys(swipe).length ? swipe : undefined };
          }),
      );
      setGroups((gs) =>
        gs
          .filter((g) => !gone.has(g.id))
          .map((g) => ({
            ...g,
            items: g.items.map((it) => {
              const next = { ...it };
              if (next.action?.to === id) next.action = undefined;
              if (next.actions) {
                const actions = Object.fromEntries(Object.entries(next.actions).filter(([, a]) => a.to !== id));
                next.actions = Object.keys(actions).length ? actions : undefined;
              }
              return next;
            }),
          })),
      );
      /* the page's own variables go with it; a rule that referred to one simply stops matching */
      setVars((vs) => vs.filter((v) => v.pageId !== id));
      if (varsScope === id) setVarsScope(VARS_ALL);
      setSelectedFrameId(null);
      setSelectedIds((cur) => cur.filter((x) => !groupsRef.current.some((g) => gone.has(g.id) && g.items.some((it) => it.id === x))));
    },
    [snapshot, varsScope],
  );

  const duplicateFrame = (id: string) => {
    const f = framesRef.current.find((x) => x.id === id);
    if (!f) return;
    snapshot();
    const nf: Frame = {
      ...f,
      id: uid(),
      name: `${f.name}${t("copySuffix")}`,
      x: nextFrameX(),
    };
    const dx = nf.x - f.x;
    const copies = groupsRef.current
      .filter(
        (g) => frameOfGroup(g, framesRef.current, widthsRef.current)?.id === id,
      )
      .map((g) => {
        const idMap = new Map(g.items.map((it) => [it.id, uid()]));
        const pos = g.pos
          ? Object.fromEntries(Object.entries(g.pos).map(([id, o]) => [idMap.get(id) ?? id, o]))
          : undefined;
        return {
          ...g,
          id: uid(),
          x: g.x + dx,
          pos,
          items: g.items.map((it) => ({
            ...it,
            id: idMap.get(it.id)!,
            tabs: it.tabs?.map((t) => ({ ...t })),
          })),
        };
      });
    setFrames((fs) => [...fs, nf]);
    setGroups((gs) => [...gs, ...copies]);
    setSelectedFrameId(nf.id);
  };
  const duplicateFrameRef = useRef(duplicateFrame);
  duplicateFrameRef.current = duplicateFrame;

  /** The screen is re-rendered offscreen at 1:1 with static parts, so the
   *  canvas zoom, selection outlines and in-flight animations never leak into the PNG. */
  const saveFrameImage = async (f: Frame) => {
    setExportFrame(f);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    try {
      await document.fonts?.ready;
      const el = document.querySelector<HTMLElement>(`[data-export="${f.id}"]`);
      if (!el) return;
      const { w, h } = frameSizeOf(f);
      const url = await toPng(el, { pixelRatio: 2, cacheBust: true, width: w, height: h });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${f.name || "screen"}.png`;
      a.click();
    } finally {
      setExportFrame(null);
    }
  };

  /** the runs of one screen drawn with plain divs: the export layer */
  /** a container's children as the plain, deterministic renderer needs them */
  const staticChildren = (parent: Item): React.ReactNode =>
    (parent.children ?? []).filter((c, i) => childDrawn(parent, c, i)).sort(byLayer).map((c) => (
      <div key={c.id} style={{ position: "absolute", left: c.x + foldPlace(c, widths).dx, top: c.y + foldPlace(c, widths).dy }}>
        <M3Static item={c} palette={p} overlay={staticChildren(c)} />
      </div>
    ));

  const renderExport = (f: Frame) => {
    const gs = groups.filter((g) => frameOfGroup(g, frames, widths)?.id === f.id);
    const { w, h } = frameSizeOf(f);
    return (
      <div
        data-export={f.id}
        style={{
          position: "relative",
          width: w,
          height: h,
          background: p[f.bg ?? "surface"],
          overflow: "hidden",
        }}
      >
        {gs.map((g) =>
          g.free ? (
            ((corners) =>
            layoutOf(g, widths).map((pl) => (
              <div key={pl.item.id} style={{ position: "absolute", left: pl.x - f.x, top: pl.y - f.y, zIndex: modalRailOf(g) ? 2 : undefined }}>
                <M3Static
                  item={pl.item}
                  palette={p}
                  radii={corners.get(pl.item.id)}
                  style={MEASURED.includes(pl.item.kind) ? undefined : { width: pl.w, height: pl.h }}
                  overlay={staticChildren(pl.item)}
                />
              </div>
            )))(freeRadii(g, widths))
          ) : (
          <div
            key={g.id}
            style={{
              position: "absolute",
              left: g.x - f.x,
              top: g.y - f.y,
              zIndex: modalRailOf(g) ? 2 : undefined,
              display: "flex",
              flexDirection: g.axis === "x" ? "row" : "column",
              alignItems: g.axis === "x" ? "center" : "stretch",
              gap: GAP,
            }}
          >
            {g.items.map((it, i) => {
              const conn = connectSpecOf(it);
              const n = g.items.length;
              const radii =
                conn && n > 1
                  ? runRadii(g.axis, i === 0, i === n - 1, false, false, 0, conn.outer, conn.inner)
                  : conn
                    ? uniformRadii(conn.outer)
                    : baseRadii(it);
              return (
                <M3Static
                  key={it.id}
                  item={it}
                  palette={p}
                  radii={radii}
                  style={{ ...(MEASURED.includes(it.kind) ? {} : { width: sizeOf(it, widths).w, height: sizeOf(it, widths).h }), ...foldMargins(it, widths) }}
                  overlay={staticChildren(it)}
                />
              );
            })}
          </div>
          ),
        )}
        {gs.some((g) => modalRailOf(g)) && (
          <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", pointerEvents: "none", zIndex: 1 }} />
        )}
      </div>
    );
  };

  /** the view before the preview opened, restored when it closes */
  const viewBeforePreview = useRef<View | null>(null);
  /** the opening scheduled after the glide, while it is still pending */
  const previewTimer = useRef<number | null>(null);
  /** the camera's return scheduled after a close, with the view it is heading back to */
  const returnTimer = useRef<{ id: number; view: View } | null>(null);
  const cancelReturn = () => {
    if (returnTimer.current !== null) window.clearTimeout(returnTimer.current.id);
    returnTimer.current = null;
  };
  useEffect(() => () => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    if (returnTimer.current !== null) window.clearTimeout(returnTimer.current.id);
  }, []);
  /** the camera glides for a moment: a screen is brought to the center before the
   *  preview opens over it, and the view returns once the preview closes */
  const glide = (v: View) => {
    setCameraEasing(true);
    setView(v);
    window.setTimeout(() => setCameraEasing(false), SETTLE_MS + 40);
  };
  /** Opens the flow diagram: the page reads the same autosaved document, so the
   *  transitions drawn there are the ones on the canvas. */
  const openFlow = () => {
    window.location.href = `${BASE_PATH}/flow/`;
  };

  const openPreview = (startId?: string | null) => {
    if (frame !== "phone") {
      changeFrame("phone");
    }
    queueMicrotask(() => {
      const id = startId ?? selectedFrameId ?? framesRef.current[0]?.id ?? null;
      const f = framesRef.current.find((x) => x.id === id);
      const r = canvasRect();
      if (f && r) {
        /* the preview's own fit and center, in window coordinates: its stage is sized for the
         * largest screen and sits left of the control column, so the screen lands where the
         * preview will show it */
        const { w, h } = frameSizeOf(f);
        const wide = window.innerWidth >= 720;
        const maxW = Math.max(...framesRef.current.map((x) => frameSizeOf(x).w)) + BEZEL * 2;
        const maxH = Math.max(...framesRef.current.map((x) => frameSizeOf(x).h)) + BEZEL * 2;
        const z = clamp(Math.min(1.4, (window.innerHeight - 32) / maxH, (window.innerWidth - (wide ? 236 : 16)) / maxW), MIN_Z, MAX_Z);
        const cx = (window.innerWidth - (wide ? 220 : 0)) / 2 - r.left;
        const cy = window.innerHeight / 2 - (wide ? 0 : 28) - r.top;
        /* reopening while the camera is still returning keeps the view it was returning
         * to; reopening during the opening glide keeps the view already captured */
        if (returnTimer.current !== null) {
          viewBeforePreview.current = returnTimer.current.view;
          cancelReturn();
        } else if (previewTimer.current === null) {
          viewBeforePreview.current = viewRef.current;
        }
        glide({ x: cx - (f.x + w / 2) * z, y: cy - (f.y + h / 2) * z, z });
        if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
        previewTimer.current = window.setTimeout(() => {
          previewTimer.current = null;
          /* the screen may have gone while the camera moved: an undo can remove it */
          if (framesRef.current.some((x) => x.id === id)) setPreviewId(id);
          else abandonPreview();
        }, SETTLE_MS);
      } else {
        setPreviewId(id);
      }
    });
  };
  /** Gives up an opening that has not happened yet and brings the camera straight back. */
  const abandonPreview = () => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    previewTimer.current = null;
    cancelReturn();
    const back = viewBeforePreview.current;
    viewBeforePreview.current = null;
    if (back) glide(back);
  };
  const closePreview = () => {
    setPreviewId(null);
    const back = viewBeforePreview.current;
    viewBeforePreview.current = null;
    cancelReturn();
    if (back) returnTimer.current = { id: window.setTimeout(() => { returnTimer.current = null; glide(back); }, 220), view: back };
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editAccess !== "editable") return;
      const t = e.target as HTMLElement;
      const typing =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (typing) return;
      // dialogs and the preview own the keyboard while they are up
      if (confirmClear || pendingImport !== null || shareOpen || previewId !== null) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selectedIds.length === 0 && selectedFrameId) duplicateFrameRef.current(selectedFrameId);
        else duplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        /* with nothing selected, or text highlighted somewhere, the browser keeps its own copy */
        if (selectedIds.length === 0 || window.getSelection()?.toString()) return;
        e.preventDefault();
        copySelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        if (!clipboardRef.current) return;
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedIds.length === 0 && selectedFrameId)
          deleteFrame(selectedFrameId);
        else deleteSelected();
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds([]);
        setSelectedFrameId(null);
        setSelectedLinkId(null);
        return;
      }
      if (e.key === "p" || e.key === "P") {
        openPreviewRef.current();
        return;
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const s = e.shiftKey ? 8 : 1;
        nudge(
          e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0,
          e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0,
        );
        return;
      }
      if (mod) return;
      if (e.key === "v" || e.key === "V") setMode("select");
      if (e.key === "h" || e.key === "H") setMode("hand");
      if (e.key === "=" || e.key === "+") setZoomAt(viewRef.current.z * 1.2);
      if (e.key === "-" || e.key === "_") setZoomAt(viewRef.current.z / 1.2);
      if (e.key === "0") fitRef.current();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deleteSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard,
    groupSelected,
    ungroupSelected,
    nudge,
    redo,
    undo,
    setZoomAt,
    selectedIds,
    selectedFrameId,
    deleteFrame,
    confirmClear,
    pendingImport,
    shareOpen,
    previewId,
    editAccess,
  ]);
  const openPreviewRef = useRef(openPreview);
  openPreviewRef.current = openPreview;

  /* ---------- render ---------- */
  const dragSize = drag ? sizeOf(drag.item, widths) : { w: 0, h: 0 };
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  /** what the selected tap can open as a dialog, and what that dialog can be made of */
  /** The part the author asked to work on up close, and the view to go back to. */
  const [magnified, setMagnified] = useState<{ id: string; before: CanvasView } | null>(null);

  /**
   * "Edit this one up close": the canvas settles on the part — as large as it and the window allow —
   * so a container whose children are too small to aim at can be worked in. Pressing it again puts
   * the view back exactly where it was, whatever happened in between.
   */
  const toggleMagnify = useCallback(
    (id: string) => {
      if (magnified?.id === id) {
        setView(magnified.before);
        setMagnified(null);
        return;
      }
      const box = itemRects().find((r) => r.id === id);
      const el = canvasRect();
      if (!box || !el) return;
      const before = magnified?.before ?? viewRef.current;
      setView(
        magnifyView({
          width: el.width,
          height: el.height,
          view: viewRef.current,
          box: { l: box.l, t: box.t, r: box.r, b: box.b },
          pad: revealPadding(mobileRef.current, 48),
          minZ: MIN_Z,
          maxZ: MAX_Z,
        }),
      );
      setMagnified({ id, before });
      setSelectedIds([id]);
    },
    [itemRects, magnified],
  );

  const revealRect = useCallback((box: { l: number; t: number; r: number; b: number }, margin = 24) => {
    const r = canvasRect();
    if (!r) return;
    const next = revealView({
      width: r.width,
      height: r.height,
      view: viewRef.current,
      box,
      /* the floating toolbar and the control bar sit over the canvas on a phone, so the window
         that is really free there is smaller than the element */
      pad: revealPadding(mobileRef.current, margin),
      minZ: MIN_Z,
      maxZ: MAX_Z,
    });
    if (next) setView(next);
  }, []);

  /** brings a page into view, bezel and title included, so it arrives recognisable */
  const revealFrame = useCallback(
    (id: string) => {
      const f = framesRef.current.find((x) => x.id === id);
      if (!f) return;
      const box = frameRect(f);
      revealRect({ l: box.l - BEZEL, t: box.t - BEZEL - FRAME_LABEL_H, r: box.r + BEZEL, b: box.b + BEZEL }, 32);
    },
    [revealRect],
  );

  /** brings a set of parts into view: the box around all of them, so a multi-selection arrives whole */
  const revealItems = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const wanted = new Set(ids);
      const hit = itemRects().filter((x) => wanted.has(x.id));
      if (!hit.length) return;
      revealRect(
        {
          l: Math.min(...hit.map((x) => x.l)),
          t: Math.min(...hit.map((x) => x.t)),
          r: Math.max(...hit.map((x) => x.r)),
          b: Math.max(...hit.map((x) => x.b)),
        },
        80,
      );
    },
    [revealRect],
  );

  /** What the dialog card's two choices do: make a dialog for this tap, or open one that exists. */
  const chooseDialog = useCallback(
    (itemId: string, choice: DialogChoice, target: string | null) => {
      const item = groupsRef.current.map((g) => findItemIn(g.items, itemId)).find(Boolean);
      if (!item) return;
      /* the tap the author is binding: a destination of a bar carries its own action, a plain part
         the part's own — reading and writing the same one keeps "bound" and "saved" the same thing */
      const current = target ? item.actions?.[target] : item.action;
      if (choice.kind === "new") {
        addDialogFrame(itemId, target);
        return;
      }
      /* choosing the one this tap already opens just takes the author to it */
      if (choice.id === (current?.dialog ? current.to : null)) {
        setLayersFrameId(choice.id);
        if (framesRef.current.some((f) => f.id === choice.id)) {
          setSelectedIds([]);
          setSelectedFrameId(choice.id);
          revealFrame(choice.id);
        } else {
          setSelectedFrameId(null);
          setSelectedIds([choice.id]);
          revealItems([choice.id]);
        }
        return;
      }
      snapshot();
      setGroups((gs) =>
        gs.map((g) => {
          const it = findItemIn(g.items, itemId);
          return it ? { ...g, items: patchItemIn(g.items, itemId, actionPatchFor(it, target, { to: choice.id, transition: "expand", dialog: true })) } : g;
        }),
      );
    },
    [addDialogFrame, revealFrame, revealItems, snapshot],
  );

  const dialogChoices = useMemo(() => {
    if (!selected) return undefined;
    /* an overlay drawn on a page is only reachable from that page, so only its groups are read */
    const owner = groups.find((g) => !!findItemIn(g.items, selected.id));
    const page = owner ? frameOfGroup(owner, frames, widths) : undefined;
    const onPage = page ? groups.filter((g) => frameOfGroup(g, frames, widths)?.id === page.id) : groups;
    return { dialogs: existingDialogs(frames, onPage), choose: (choice: DialogChoice, target: string | null) => chooseDialog(selected.id, choice, target) };
  }, [selected, groups, frames, widths, chooseDialog]);

  /** The other parts on the selected part's page: what a rule's look can be aimed at. A claim button
   *  that marks the gift beside it as claimed names a part, and only the parts of its own page are in
   *  reach, because a look is drawn while that screen is on show. */
  const lookTargets = useMemo(() => {
    if (!selected) return [];
    const owner = groups.find((g) => !!findItemIn(g.items, selected.id));
    const page = owner ? frameOfGroup(owner, frames, widths) : undefined;
    const here = page ? groups.filter((g) => frameOfGroup(g, frames, widths)?.id === page.id) : groups;
    const named = (it: Item) => it.label.trim() || KIND_TEXT[lang][it.kind]?.noun || KIND_SPEC[it.kind].label;
    return itemsOf(here)
      .filter((it) => it.id !== selected.id)
      .map((it) => ({ id: it.id, name: named(it) }));
  }, [selected, groups, frames, widths, lang]);

  const doc: Doc = useMemo(
    () => ({ groups, frames, paletteKey, frame, title, brief, promptEdit, platform: platform ?? undefined, customPalette: customPalette ?? undefined, dynamicColor, theme, customParts: customParts.length ? customParts : undefined, vars: vars.length ? vars : undefined }),
    [groups, frames, paletteKey, frame, title, brief, promptEdit, platform, customPalette, dynamicColor, theme, customParts, vars],
  );
  /** the same document, for callbacks that were created on an earlier render */
  const docRef = useRef(doc);
  docRef.current = doc;

  /* The walkthrough report: the rail badge counts it and the panel lists it, so it is worked
     out once here rather than twice from the same inputs. */
  const auditReport = useMemo(() => audit(doc, widths), [doc, widths]);
  const auditErrors = auditReport.filter((i) => i.severity === "error").length;

  /**
   * Brings a piece of the canvas into view. A row in the Layers panel or the review report is an
   * instruction to *look* at something, so it must never leave the author staring at an unchanged
   * screen; but recentring on every click throws the view around while they work through a list,
   * so a target already on screen is left alone. The zoom is kept unless the target is bigger than
   * the window, which is the one case where it could not be shown at all.
   */
  /** takes the author from a report row to the page or the part it is about */
  const locateIssue = useCallback(
    (issue: AuditIssue) => {
      if (issue.frameId) setLayersFrameId(issue.frameId);
      /* a row that names a part wants that part's own panel: the frame panel would hide it */
      setSelectedIds(issue.itemId ? [issue.itemId] : []);
      setSelectedFrameId(issue.itemId ? null : issue.frameId);
      setSelectedLinkId(null);
      setRightTab("edit");
      /* the part itself when the row names one, its page otherwise */
      if (issue.itemId) revealItems([issue.itemId]);
      else if (issue.frameId) revealFrame(issue.frameId);
    },
    [revealFrame, revealItems],
  );

  /** arrows from tappable parts to the frames they open */
  const links = useMemo(() => {
    if (frame !== "phone") return [];
    const rects = itemRects();
    const out: {
      id: string;
      d: string;
      mx: number;
      my: number;
      tx: number;
      ty: number;
      ang: number;
      t: Transition;
    }[] = [];
    for (const g of groups) {
      for (const it of g.items) {
        for (const { slot, action } of actionsOf(it)) {
        if (action.to === BACK_TARGET) continue;
        const f = frames.find((x) => x.id === action.to);
        const r = rects.find((x) => x.id === it.id);
        if (!f || !r) continue;
        const fr = frameRect(f);
        const rightward = (fr.l + fr.r) / 2 >= (r.l + r.r) / 2;
        const sx = rightward ? r.r : r.l;
        const sy = (r.t + r.b) / 2;
        const tx = rightward ? fr.l - BEZEL : fr.r + BEZEL;
        const ty = clamp(sy, fr.t + 40, fr.b - 40);
        const dx = Math.max(60, Math.abs(tx - sx) * 0.5);
        const c1x = sx + (rightward ? dx : -dx);
        const c2x = tx + (rightward ? -dx : dx);
        const d = `M${sx} ${sy} C${c1x} ${sy} ${c2x} ${ty} ${tx} ${ty}`;
        // midpoint of the cubic at t = 0.5
        const mx = 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * tx;
        const my = 0.125 * sy + 0.375 * sy + 0.375 * ty + 0.125 * ty;
        out.push({
          id: `${it.id}|${slot}`,
          d,
          mx,
          my,
          tx,
          ty,
          ang: rightward ? 0 : 180,
          t: action.transition,
        });
        }
      }
    }
    return out;
  }, [groups, frames, frame, itemRects, widths]);

  /** apply a change to the action behind a link id ("itemId|slot") */
  const patchLink = (linkId: string, fn: (a: Action) => Action | undefined) => {
    const [itemId, slot] = linkId.split("|");
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        items: g.items.map((it) => {
          if (it.id !== itemId) return it;
          if (!slot) return { ...it, action: it.action ? fn(it.action) : undefined };
          const cur = it.actions?.[slot];
          if (!cur) return it;
          const next = fn(cur);
          const actions = { ...(it.actions ?? {}) };
          if (next) actions[slot] = next;
          else delete actions[slot];
          return { ...it, actions: Object.keys(actions).length ? actions : undefined };
        }),
      })),
    );
  };

  const setLinkTransition = (linkId: string, transition: Transition) => {
    snapshotFor("link:" + linkId);
    patchLink(linkId, (a) => ({ ...a, transition }));
  };
  const removeLink = (linkId: string) => {
    snapshot();
    patchLink(linkId, () => undefined);
    setSelectedLinkId(null);
  };

  const runRadii = (
    axis: Axis,
    first: boolean,
    last: boolean,
    prevPh: boolean,
    nextPh: boolean,
    pull: number,
    outer: number,
    inner: number,
  ): Radii => {
    const soft = lerp(outer, inner, pull);
    const s = first ? outer : prevPh ? soft : inner;
    const e = last ? outer : nextPh ? soft : inner;
    return axis === "x"
      ? { tl: s, bl: s, tr: e, br: e }
      : { tl: s, tr: s, bl: e, br: e };
  };

  /** which frame each run sits on (phone mode only) */
  const frameOf = useMemo(() => {
    const m = new Map<string, string>();
    if (frame !== "phone") return m;
    for (const g of groups) {
      const f = frameOfGroup(g, frames, widths);
      if (f) m.set(g.id, f.id);
    }
    return m;
  }, [groups, frames, frame, widths]);

  /** the screen whose layers the panel lists: the selection's, else the chosen one */
  const layersFrame = useMemo(() => {
    if (frame !== "phone") return null;
    if (primaryId) {
      /* the owner is searched through the whole tree: a nested child (a panel of a tabs
       * row, a part inside a container) must point at its own screen, not at whatever
       * screen happened to be listed before */
      const g = groups.find((x) => !!findItemIn(x.items, primaryId));
      const fid = g ? frameOf.get(g.id) : undefined;
      if (fid) return frames.find((f) => f.id === fid) ?? null;
    }
    if (selectedFrameId) return frames.find((f) => f.id === selectedFrameId) ?? null;
    return frames.find((f) => f.id === layersFrameId) ?? frames[0] ?? null;
  }, [frame, primaryId, groups, frameOf, frames, selectedFrameId, layersFrameId]);
  /** A drag in the layers panel is one undo step: the snapshot is taken when it starts,
   *  and the reorders it fires along the way record nothing more. */
  const layerDragRef = useRef(false);
  const onLayerDragging = (dragging: boolean) => {
    if (dragging && !layerDragRef.current) snapshot();
    layerDragRef.current = dragging;
  };
  const layerSnapshot = (key: string) => {
    if (!layerDragRef.current) snapshotFor(key);
  };

  const reorderLayers = (topFirst: string[]) => {
    const inFrame = new Set(topFirst);
    const byId = new Map(groupsRef.current.map((g) => [g.id, g]));
    const ordered = [...topFirst].reverse().map((id) => byId.get(id)).filter((g): g is Group => !!g);
    if (ordered.length !== inFrame.size) return;
    layerSnapshot("layers:" + (layersFrame?.id ?? ""));
    for (const id of inFrame) instantRef.current.add(id);
    setGroups((gs) => [...gs.filter((g) => !inFrame.has(g.id)), ...ordered]);
  };

  /** The parts of one group in a new order: reading order for a connected run, back to
   *  front for a free group. Inside a free group a hidden run keeps its slots, handed out
   *  again in the new order, so reordering a list really moves its rows. */
  const reorderGroupItems = (groupId: string, order: string[]) => {
    const g = groupsRef.current.find((x) => x.id === groupId);
    if (!g) return;
    const byId = new Map(g.items.map((it) => [it.id, it]));
    const items = order.map((id) => byId.get(id)).filter((it): it is Item => !!it);
    if (items.length !== g.items.length || new Set(order).size !== order.length) return;
    layerSnapshot("layers:items:" + groupId);
    instantRef.current.add(groupId);
    if (!g.free) {
      setGroups((gs) => gs.map((x) => (x.id === groupId ? { ...x, items } : x)));
      return;
    }
    const rank = new Map(items.map((it, i) => [it.id, i]));
    const pos = { ...(g.pos ?? {}) };
    for (const run of explodeGroup(g, widthsRef.current)) {
      if (run.items.length < 2) continue;
      const slots = run.items.map((it) => pos[it.id] ?? { x: 0, y: 0 });
      const members = [...run.items].sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
      members.forEach((it, i) => {
        pos[it.id] = slots[i];
      });
    }
    setGroups((gs) => gs.map((x) => (x.id === groupId ? { ...x, items, pos } : x)));
  };

  /** A part being moved inside its container: the pointer moves it in the container's own
   *  coordinates, so it stays inside the box it belongs to. */
  const dragChildFrom = (clientX: number, clientY: number, shift: boolean, g: Group, parent: Item, child: PlacedItem) => {
    flushPending();
    setSelectedIds((cur) => (shift ? [...cur.filter((x) => x !== child.id), child.id] : [child.id]));
    setSelectedFrameId(null);
    setSelectedLinkId(null);
    setRightTab("edit");
    /* A child that fills its container edge to edge has nowhere to go inside it — a bar or a rail
       laid in a box of its own size is the case this exists for. Dragging it moves the container,
       which is the only thing left that can happen; leaving it a child drag would make the whole
       thing look stuck. Two children are not in that position: one whose container scrolls (content
       is meant to sit outside the viewport) and one the author picked in the layers panel — they
       said which part they meant, so that part moves. */
    const free = childDragFree(parent, selectedIds.includes(child.id));
    const room = childDragRoom(parent, child, widthsRef.current, free);
    /* the press is recorded where the part is *drawn*: a folded navigation part is drawn at the
       corner its button sits in, not at the offsets it carries */
    const f = foldPlace(child, widthsRef.current);
    const ox = child.x + f.dx;
    const oy = child.y + f.dy;
    if (!free && room.w <= 0 && room.h <= 0) {
      const gg: Gesture = { kind: "group", id: g.id, sx: clientX, sy: clientY, gx: g.x, gy: g.y, moved: false, overBin: false };
      gestureRef.current = gg;
      setGesture(gg);
      return;
    }
    const gg: Gesture = { kind: "child", groupId: g.id, parentId: parent.id, id: child.id, sx: clientX, sy: clientY, ox, oy, moved: false, free };
    gestureRef.current = gg;
    setGesture(gg);
  };

  const onChildPointerDown = (e: React.PointerEvent, g: Group, parent: Item, child: PlacedItem) => {
    if (e.button === 1 || modeRef.current === "hand" || spaceRef.current) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    /* A part the author picked in the layers panel takes the drag, even when the press lands on a
       part drawn over it: they chose the container, not whatever covers it. */
    const picked = selectedAncestor(groupsRef.current, child.id, selectedIds);
    if (picked && picked.id !== child.id) {
      const up = parentOf(groupsRef.current, picked.id);
      if (up) dragChildFrom(e.clientX, e.clientY, e.shiftKey, g, up, picked as PlacedItem);
      else dragItemFrom(e.clientX, e.clientY, e.shiftKey, g, g.items.findIndex((it) => it.id === picked.id), picked);
      return;
    }
    dragChildFrom(e.clientX, e.clientY, e.shiftKey, g, parent, child);
  };

  /** A navigation part's own fold button, live on the canvas: clicking its icon folds the
   *  destinations away exactly as the preview will, so the author can try it while editing. */
  const navToggleNode = (it: Item, onDrag?: (e: React.PointerEvent) => void): React.ReactNode => {
    if (it.kind === "bottomNav" && it.barFolded !== undefined) {
      return (
        <FoldButton
          title={t(it.barFolded ? "expandNavigation" : "collapseNavigation", lang)}
          /* the same strip the icon is drawn in, folded or not (see the bar's own render) */
          at={{ right: 0, top: 0, bottom: 0, width: 44 }}
          onFold={() => setNavFold(it, !it.barFolded)}
          onDrag={onDrag}
        />
      );
    }
    if (it.kind === "navRail" && isWideRail(it)) {
      const rail = railMetrics(it);
      /* folded, the whole rail is the button's own pill, so it sits at its corner: the position
         comes from the rail's own geometry, the same one the drawing uses */
      const at = { left: rail.headerLeft, top: rail.headerTop };
      return (
        <FoldButton
          title={t(it.railFolded ? "expandNavigation" : "collapseNavigation", lang)}
          at={{ ...at, width: 48, height: 48, borderRadius: 24 }}
          onFold={() => setNavFold(it, !it.railFolded)}
          onDrag={onDrag}
        />
      );
    }
    return null;
  };

  /** the children of one part, drawn inside its box in the order their levels ask for */  /** the children of one part, drawn inside its box in the order their levels ask for */
  const childNodes = (parent: Item, g: Group): React.ReactNode =>
    (parent.children ?? []).filter((c, i) => childDrawn(parent, c, i)).sort(byLayer).map((c) => (
      /* a navigation part inside a container folds the same way it does on a screen */
      <div key={c.id} style={{ position: "absolute", left: c.x + foldPlace(c, widths).dx, top: c.y + foldPlace(c, widths).dy }}>
        <M3Node
          item={c}
          palette={p}
          widths={widths}
          pressed={pressedId === c.id}
          selected={selectedSet.has(c.id)}
          inRun={false}
          interactive={!handMode}
          onPointerDown={(e) => onChildPointerDown(e, g, parent, c)}
          overlay={
            <>
              {childNodes(c, g)}
              {navToggleNode(c, (e) => dragChildFrom(e.clientX, e.clientY, e.shiftKey, g, parent, c))}
            </>
          }
        />
      </div>
    ));

  const renderGroup = (g: Group, ox: number, oy: number) => {
    const modalRail = modalRailOf(g);
    if (g.free) {
      const instantG = instantRef.current.has(g.id);
      const allOn = g.items.every((it) => selectedSet.has(it.id));
      /* explode once: the runs feed both the corner radii and the lift gate below */
      const runs = explodeGroup(g, widths);
      const corners = radiiOfRuns(runs);
      /* hidden runs are connected too: only their members may lift above siblings when selected */
      const runIds = new Set(
        runs
          .filter((r) => r.items.length > 1)
          .flatMap((r) => r.items.map((it) => it.id)),
      );
      return (
        <motion.div
          key={g.id}
          initial={false}
          animate={{ x: g.x - ox, y: g.y - oy }}
          transition={instantG ? INSTANT : OPEN}
          /* keep any selection lift inside the group, so canvas-wide layer order is preserved */
          style={{ position: "absolute", left: 0, top: 0, zIndex: modalRail ? 2 : undefined, isolation: "isolate" }}
        >
          {layoutOf(g, widths).map((pl) => (
            <div key={pl.item.id} style={{ position: "absolute", left: pl.x - g.x, top: pl.y - g.y }}>
              <M3Node
                item={pl.item}
                palette={p}
                widths={widths}
                radii={corners.get(pl.item.id)}
                pressed={false}
                selected={selectedSet.has(pl.item.id)}
                inRun={runIds.has(pl.item.id)}
                interactive={!handMode}
                onPointerDown={(e) => onItemPointerDown(e, g, pl.index, pl.item)}
                overlay={
                  <>
                    {childNodes(pl.item, g)}
                    {navToggleNode(pl.item, (e) => dragItemFrom(e.clientX, e.clientY, e.shiftKey, g, pl.index, pl.item))}
                  </>
                }
              />
            </div>
          ))}
          {allOn && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: -6,
                top: -6,
                width: groupBounds(g, widths).r - g.x + 12,
                height: groupBounds(g, widths).b - g.y + 12,
                border: `${1.5 / view.z}px dashed ${p.primary}`,
                borderRadius: 10,
                pointerEvents: "none",
              }}
            />
          )}
        </motion.div>
      );
    }
    const snap = drag?.active && drag.snap?.groupId === g.id ? drag.snap : null;
    const pull = snap?.pull ?? 0;
    const phMain = snap ? (g.axis === "x" ? dragSize.w : dragSize.h) * pull : 0;
    const shift = snap && snap.index === 0 ? -(phMain + GAP) : 0;
    const conn = g.items[0] ? connectSpecOf(g.items[0]) : undefined;

    type Cell = { ph: true } | { ph: false; item: Item; index: number };
    const cells: Cell[] = [];
    for (let i = 0; i <= g.items.length; i++) {
      if (snap && snap.index === i) cells.push({ ph: true });
      if (i < g.items.length)
        cells.push({ ph: false, item: g.items[i], index: i });
    }
    const m = cells.length;
    const instant = instantRef.current.has(g.id);

    return (
      <motion.div
        key={g.id}
        initial={false}
        animate={{
          x: g.x - ox + (g.axis === "x" ? shift : 0),
          y: g.y - oy + (g.axis === "y" ? shift : 0),
        }}
        transition={instant ? INSTANT : OPEN}
        style={{
          zIndex: modalRail ? 2 : undefined,
          position: "absolute",
          left: 0,
          top: 0,
          display: "flex",
          flexDirection: g.axis === "x" ? "row" : "column",
          alignItems: g.axis === "x" ? "center" : "stretch",
          gap: GAP,
          /* keep any selection lift inside the run, so canvas-wide layer order is preserved */
          isolation: "isolate",
        }}
      >
        {cells.map((c, r) => {
          if (c.ph) {
            return (
              <motion.div
                key="__gap"
                initial={g.axis === "x" ? { width: 0 } : { height: 0 }}
                animate={
                  g.axis === "x" ? { width: phMain } : { height: phMain }
                }
                transition={OPEN}
                style={{
                  flex: "0 0 auto",
                  height: g.axis === "x" ? dragSize.h : undefined,
                  width: g.axis === "y" ? dragSize.w : undefined,
                }}
              />
            );
          }
          const ic = connectSpecOf(c.item);
          const radii =
            conn && ic && !c.item.shape
              ? runRadii(
                  g.axis,
                  r === 0,
                  r === m - 1,
                  r > 0 && cells[r - 1].ph,
                  r < m - 1 && cells[r + 1].ph,
                  pull,
                  ic.outer,
                  ic.inner,
                )
              : baseRadii(c.item);
          return (
            <M3Node
              key={c.item.id}
              item={c.item}
              palette={p}
              widths={widths}
              radii={radii}
              /* a run lays its parts out itself, so a folded navigation part takes its place as a margin */
              style={foldMargins(c.item, widths)}
              pressed={pressedId === c.item.id}
              selected={selectedSet.has(c.item.id)}
              inRun={g.items.length > 1}
              interactive={!handMode}
              onPointerDown={(e) => onItemPointerDown(e, g, c.index, c.item)}
              overlay={
                <>
                  {childNodes(c.item, g)}
                  {navToggleNode(c.item, (e) => dragItemFrom(e.clientX, e.clientY, e.shiftKey, g, c.index, c.item))}
                </>
              }
            />
          );
        })}
      </motion.div>
    );
  };

  const handMode = !isMobile && (mode === "hand" || spaceHeld);
  const panning = gesture?.kind === "pan";
  const marquee = gesture?.kind === "marquee" && gesture.moved ? gesture : null;
  const canvasBg = frame === "phone" ? p.surfaceContainerLow : "#ffffff";

  const panelStyle: React.CSSProperties = {
    background: p.surface,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
    flex: "0 0 auto",
  };

  const showRight = rightOpen && !isMobile;
  const overBin = (!!drag?.active && drag.overBin) || (gesture?.kind === "group" && gesture.overBin);
  const guide = drag?.active ? drag.guide : gesture?.kind === "group" && gesture.moved ? (gesture.guide ?? null) : null;
  const visibleWorld = (() => {
    const r = canvasRef.current?.getBoundingClientRect();
    return {
      l: -view.x / view.z,
      t: -view.y / view.z,
      w: (r?.width ?? 0) / view.z,
      h: (r?.height ?? 0) / view.z,
    };
  })();

  return (
    <LangContext.Provider value={lang}>
    <ThemeContext.Provider value={theme}>
      <div
        className={revealing ? "app-root m3e-reveal" : "app-root"}
        /* the preview sits outside this tree and owns the keyboard while it is up */
        inert={editAccess !== "editable" || previewId !== null}
        aria-hidden={editAccess !== "editable" || previewId !== null}
        style={{
          display: "flex",
          overflow: "hidden",
          background: p.surfaceContainer,
          cursor: resizing ? "col-resize" : undefined,
          userSelect: resizing ? "none" : undefined,
          ["--sb" as string]: p.outlineVariant,
        }}
      >
        {/* hidden measuring layer for text-sized kinds */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: -99999,
            top: 0,
            visibility: "hidden",
            pointerEvents: "none",
            fontFamily: fontFamilyOf(theme.font, lang),
          }}
        >
          {allItems
            .filter((it) => MEASURED.includes(it.kind))
            .map((it) => (
              <div
                key={it.id}
                ref={(el) => {
                  if (el) measureEls.current.set(it.id, el);
                  else measureEls.current.delete(it.id);
                }}
                style={{
                  display: "inline-flex",
                  boxSizing: "border-box",
                  border:
                    it.variant === "outlined" &&
                    (it.kind === "button" ||
                      it.kind === "chip" ||
                      it.kind === "extendedFab")
                      ? "1px solid transparent"
                      : "none",
                }}
              >
                <MeasuredContent item={it} p={p} />
              </div>
            ))}
        </div>

        {exportFrame && (
          <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", fontFamily: fontFamilyOf(theme.font, lang) }}>
            {renderExport(exportFrame)}
          </div>
        )}


        {/* the part in flight rides above every panel so it stays visible while crossing them */}
        {drag?.active && (() => {
          const r = canvasRect();
          return (
            <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  transform: `translate(${(r?.left ?? 0) + view.x}px, ${(r?.top ?? 0) + view.y}px) scale(${view.z})`,
                  transformOrigin: "0 0",
                  fontFamily: fontFamilyOf(theme.font, lang),
                }}
              >
      {/* the part in flight */}
      {drag?.active && (
        <motion.div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            x: sx,
            y: sy,
            pointerEvents: "none",
            zIndex: 50,
          }}
          animate={{
            opacity: drag.overBin ? 0.4 : 1,
            scale: drag.overBin ? 0.84 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 520,
            damping: 34,
            mass: 0.6,
          }}
        >
          <M3Node
            item={drag.item}
            palette={p}
            widths={widths}
            dragging
            radii={(() => {
              const conn = connectSpecOf(drag.item);
              if (!conn || !drag.snap) return baseRadii(drag.item);
              const g = groupsRef.current.find(
                (x) => x.id === drag.snap!.groupId,
              );
              const mm = (g?.items.length ?? 0) + 1;
              const k = drag.snap.index;
              return runRadii(
                conn.axis,
                k === 0,
                k === mm - 1,
                k > 0,
                k < mm - 1,
                drag.snap.pull,
                conn.outer,
                conn.inner,
              );
            })()}
          />
        </motion.div>
      )}
              </div>
            </div>
          );
        })()}

        {/* ---- left: rail + parts / layers ---- */}
        {!isMobile && (
          <aside style={{ ...panelStyle, width: leftOpen ? leftW : RAIL_W, flexDirection: "row", transition: "width 200ms cubic-bezier(0.2, 0, 0, 1)" }}>
            {/* dropping a canvas part anywhere on this side deletes it, whichever tab is open */}
            {overBin && (
              <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "rgba(179,38,30,0.10)", display: "grid", placeItems: "center", pointerEvents: "none", color: p.error }}>
                <div style={{ width: 72, height: 72, borderRadius: 36, background: p.errorContainer, color: p.onErrorContainer, display: "grid", placeItems: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.14)" }}>
                  <Icon name="delete" size={34} />
                </div>
              </div>
            )}
            <div
              onPointerEnter={() => setRailHover(true)}
              onPointerLeave={() => setRailHover(false)}
              onClick={(e) => {
                // a click on the rail's empty background opens the panel
                if (!leftOpen && e.target === e.currentTarget) setLeftOpen(true);
              }}
              style={{
                width: RAIL_W,
                flex: "0 0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "12px 0",
                background: p.surfaceContainerLow,
                cursor: leftOpen ? undefined : "pointer",
              }}
            >
              {!leftOpen && railHover ? (
                <IconBtn icon="left_panel_open" p={p} on onClick={() => setLeftOpen(true)} title={t("openPanel", lang)} size={40} />
              ) : (
                <div
                  onClick={() => !leftOpen && setLeftOpen(true)}
                  style={{ width: 40, height: 40, display: "grid", placeItems: "center", cursor: leftOpen ? "default" : "pointer" }}
                >
                  <Logo size={32} color={p.primary} glyph={p.onPrimary} />
                </div>
              )}
              <span aria-hidden style={{ width: 24, height: 1, background: p.outlineVariant }} />
              {LEFT_TABS.map((tab, i) => (
                <div key={tab.key} style={{ marginTop: i === 0 ? 2 : 0, position: "relative" }}>
                  <IconBtn
                    icon={tab.icon}
                    p={p}
                    on={leftOpen && leftTab === tab.key}
                    onClick={() => {
                      setLeftTab(tab.key);
                      setLeftOpen(true);
                    }}
                    title={t(tab.title, lang)}
                    size={44}
                  />
                  {/* the review tab carries the number of things that break the prototype:
                      the count is worth seeing before the panel is ever opened */}
                  {tab.key === "audit" && auditErrors > 0 && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        minWidth: 18,
                        height: 18,
                        padding: "0 4px",
                        borderRadius: 9,
                        background: p.error,
                        color: p.onError,
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: "18px",
                        textAlign: "center",
                        pointerEvents: "none",
                      }}
                    >
                      {auditErrors > 99 ? "99+" : auditErrors}
                    </span>
                  )}
                </div>
              ))}
              <div style={{ flex: 1 }} onClick={() => !leftOpen && setLeftOpen(true)} />
              <span aria-hidden style={{ width: 24, height: 1, background: p.outlineVariant }} />
              <LangMenu p={p} onLang={changeLanguage} side="right" size={44} />
            </div>
            {leftOpen && (
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 10px 0 14px",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: p.onSurface,
                    flex: 1,
                  }}
                >
                  {t(LEFT_TABS.find((x) => x.key === leftTab)?.title ?? "parts", lang)}
                </span>
                <IconBtn
                  icon="left_panel_close"
                  p={p}
                  onClick={() => setLeftOpen(false)}
                  title={t("closePanel", lang)}
                />
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {leftTab === "parts" ? (
                  <PartsPalette
                    palette={p}
                    favorites={favorites}
                    onToggleFavorite={(k) =>
                      setFavorites((f) =>
                        f.includes(k) ? f.filter((x) => x !== k) : [...f, k],
                      )
                    }
                    onPartPointerDown={onPartPointerDown}
                    customParts={customParts}
                    onCompositePointerDown={onCompositePointerDown}
                    onNewComposite={() => {
                      setComposeEditing(null);
                      setComposeOpen(true);
                    }}
                    onEditComposite={(part) => {
                      setComposeEditing(part);
                      setComposeOpen(true);
                    }}
                    onDeleteComposite={(part) => {
                      setCustomParts((cur) => cur.filter((x) => x.id !== part.id));
                      showToast(t("deleteComposite", lang), 1400, "delete");
                    }}
                  />
                ) : leftTab === "audit" ? (
                  <AuditPanel p={p} doc={doc} issues={auditReport} onLocate={locateIssue} />
                ) : leftTab === "vars" ? (
                  /* a variable is document-wide, so an undo step has to carry the whole document
                     with it: restoring only the parts would leave the two out of step */
                  <VarsPanel
                    p={p}
                    vars={vars}
                    frames={frames}
                    scope={varsScope}
                    onScope={setVarsScope}
                    onChange={(next) => {
                      snapshotFor("vars", true);
                      setVars(next);
                    }}
                  />
                ) : leftTab === "color" ? (
                  <ColorPanel
                    p={p}
                    paletteKey={paletteKey}
                    onPalette={setPaletteKey}
                    custom={customPalette}
                    onCustom={setCustomPalette}
                    dynamic={dynamicColor}
                    onDynamic={setDynamicColor}
                    theme={theme}
                    onTheme={patchTheme}
                  />
                ) : leftTab === "shape" ? (
                  <ShapePanel p={p} theme={theme} onChange={patchTheme} />
                ) : leftTab === "type" ? (
                  <TypePanel p={p} theme={theme} onChange={patchTheme} />
                ) : leftTab === "motion" ? (
                  <MotionPanel p={p} theme={theme} onChange={patchTheme} />
                ) : leftTab === "ai" ? (
                  <AiPanel p={p} settings={aiSettings} onSettings={updateAiSettings} />
                ) : (
                  <LayersPanel
                    p={p}
                    frames={frames}
                    frameId={layersFrame?.id ?? null}
                    onFrame={(id) => {
                      setLayersFrameId(id);
                      setSelectedIds([]);
                      setSelectedFrameId(id);
                      /* a page picked from the list is a page to look at: bring it into view */
                      revealFrame(id);
                    }}
                    groups={groups}
                    frameIdOf={(id) => frameOf.get(id) ?? null}
                    widths={widths}
                    selectedIds={selectedIds}
                    onSelect={(ids, add) => {
                      setSelectedIds((cur) => (add ? [...cur.filter((x) => !ids.includes(x)), ...ids] : ids));
                      setSelectedFrameId(null);
                      setSelectedLinkId(null);
                      setRightTab("edit");
                      /* and a part picked from the list is brought into view too, with the
                         whole selection when several rows were added */
                      revealItems(add ? [...selectedIds, ...ids] : ids);
                      /* a panel picked from the list brings its tab forward, so it is on screen */
                      showPanelOf(ids);
                    }}
                    onReorder={reorderLayers}
                    onReorderItems={reorderGroupItems}
                    vars={vars}
                    /* a variable row in the page list opens the panel showing that variable: on
                       its own page when it has one, and on 全部 for the shared ones */
                    onVar={(id) => {
                      const v = vars.find((x) => x.id === id);
                      setVarsScope(v?.pageId ?? VARS_ALL);
                      setLeftTab("vars");
                    }}
                    onDragging={onLayerDragging}
                    onTabSelect={switchTab}
                    onNest={(it) => askNest([it])}
                    onMagnify={toggleMagnify}
                    magnifiedId={magnified?.id ?? null}
                    onFreePart={freePart}
                    /* the name an author types over a row in the list is the part's, the run's or
                       the screen's own name */
                    onRename={(id, name) => patchItemById(id, { label: name })}
                    onGroupRename={renameGroup}
                    onFrameRename={renameFrame}
                    onTabRename={renameTab}
                    onDropPart={(ids, to) => {
                      const moved = ids.map((id) => findItemIn(groupsRef.current.flatMap((g) => g.items), id)).filter((it): it is Item => !!it);
                      if (moved.length !== ids.length) return;
                      askNest(moved, to);
                    }}
                  />
                )}
              </div>
            </div>
            )}
            {leftOpen && (
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setResizing("left");
              }}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                right: -3,
                width: 6,
                cursor: "col-resize",
                zIndex: 5,
              }}
            />
            )}
          </aside>
        )}

        {/* ---- canvas ---- */}
        <main
          style={{
            flex: 1,
            position: "relative",
            minWidth: 0,
            padding: isMobile ? 6 : 8,
          }}
        >
          <div
            ref={canvasRef}
            onPointerDown={onCanvasPointerDown}
            onPointerDownCapture={onTouchCapture}
            style={{
              position: "absolute",
              inset: isMobile ? 6 : 8,
              overflow: "hidden",
              borderRadius: 24,
              background: canvasBg,
              cursor: panning ? "grabbing" : handMode ? "grab" : "default",
              touchAction: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
                transformOrigin: "0 0",
                transition: cameraEasing ? `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)` : undefined,
                willChange: "transform",
                visibility: viewReady ? "visible" : "hidden",
                fontFamily: fontFamilyOf(theme.font, lang),
              }}
            >
              {frame === "phone" &&
                frames.map((f) => {
                  const on = f.id === selectedFrameId;
                  /* a dialog is marked by the frame drawn around it, not by its surface: what the
                     author sees inside stays the design, exactly as on a screen */
                  const tint = pageTintOf(f, p);
                  const bg = p[f.bg ?? "surface"];
                  const { w, h } = frameSizeOf(f);
                  const radius = frameRadius(f);
                  return (
                    <div
                      key={f.id}
                      data-frame={f.id}
                      style={{ position: "absolute", left: f.x, top: f.y, transition: easing ? `left ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)` : undefined }}
                    >
                      <div
                        onPointerDown={(e) => onFramePointerDown(e, f)}
                        style={{
                          position: "absolute",
                          left: -BEZEL,
                          top: -BEZEL - FRAME_LABEL_H,
                          height: FRAME_LABEL_H,
                          /* follows the zoom, softened: a little larger when zoomed out, a little smaller when zoomed in */
                          transform: `scale(${clamp(1 / view.z, 0.7, 1.4)})`,
                          transformOrigin: "left bottom",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "0 8px",
                          fontSize: 20,
                          fontWeight: 600,
                          color: on ? p.primary : p.onSurfaceVariant,
                          cursor: handMode ? "grab" : "move",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                          fontFamily: uiFontFamily(lang),
                        }}
                      >
                        <div onPointerDown={(e) => e.stopPropagation()}>
                          <FrameSizePicker frame={f} onChange={(preset) => setFramePreset(f.id, preset)} palette={p} compact />
                        </div>
                        {f.name || t("screen", lang)}
                        {/* an overlay page says so on the canvas: on the flow it is popped over
                            a screen rather than navigated to */}
                        {isOverlayFrame(f) && (
                          <span
                            title={t("overlayLevel", lang)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 10px",
                              borderRadius: 999,
                              background: tint?.bg ?? p.secondaryContainer,
                              color: tint?.ink ?? p.onSecondaryContainer,
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            <Icon name="picture_in_picture_alt" size={16} />
                            {overlayLevelText(overlayLevelOfFrame(f), lang)}
                          </span>
                        )}
                      </div>
                      <div
                        onPointerDown={(e) => onFramePointerDown(e, f)}
                        style={{
                          position: "absolute",
                          left: -BEZEL,
                          top: -BEZEL,
                          overflow: "hidden",
                          width: w + BEZEL * 2,
                          height: h + BEZEL * 2,
                          borderRadius: radius + BEZEL,
                          /* the bezel is the page's frame: a dialog wears its own colour there */
                          backgroundColor: tint?.bg ?? p.inverseSurface,
                          backgroundImage: draftBusy ? DRAFT_GRADIENT(p) : undefined,
                          backgroundSize: draftBusy ? "300% 300%" : undefined,
                          animation: draftBusy ? "m3e-drift 3s ease-in-out infinite" : undefined,
                          boxShadow: on
                            ? `0 0 0 3px ${p.primary}, 0 18px 50px rgba(0,0,0,0.16)`
                            : "0 18px 50px rgba(0,0,0,0.14)",
                          cursor: handMode ? "grab" : "move",
                          transition: `box-shadow 120ms, ${SIZE_TRANSITION}`,
                        }}
                      >
                        <AnimatePresence>{aiFrameId === f.id && <ThinkingRing key="ring" p={p} frame={f} />}</AnimatePresence>
                        <div
                          data-screen={f.id}
                          style={{
                            position: "absolute",
                            left: BEZEL,
                            top: BEZEL,
                            width: w,
                            height: h,
                            borderRadius: radius,
                            background: bg,
                            overflow: "hidden",
                            transition: SIZE_TRANSITION,
                          }}
                        >
                          {groups
                            .filter((g) => frameOf.get(g.id) === f.id)
                            .map((g) => renderGroup(g, f.x, f.y))}
                          {groups.some((g) => frameOf.get(g.id) === f.id && modalRailOf(g)) && (
                            <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", pointerEvents: "none", zIndex: 1 }} />
                          )}
                          {draftBusy && (
                            <div style={{ position: "absolute", inset: 0, zIndex: 90, background: canvasBg, display: "grid", placeItems: "center" }}>
                              <LoadingIndicator size={96} color="url(#m3e-drafting)" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {groups
                .filter((g) => !frameOf.has(g.id))
                .map((g) => renderGroup(g, 0, 0))}


              {links.length > 0 && (
                <svg
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    overflow: "visible",
                    pointerEvents: "none",
                  }}
                  width={1}
                  height={1}
                >
                  <defs>
                    <marker
                      id="m3e-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="8"
                      markerHeight="8"
                      orient="auto"
                    >
                      <path d="M0 0 L10 5 L0 10 z" fill={p.primary} />
                    </marker>
                  </defs>
                  {!draftBusy && links.map((l) => {
                    const on = l.id === selectedLinkId;
                    return (
                      <g key={l.id}>
                        <path
                          d={l.d}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={18 / view.z}
                          style={{ pointerEvents: "stroke", cursor: "pointer" }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setSelectedLinkId(l.id);
                            setSelectedIds([]);
                            setSelectedFrameId(null);
                          }}
                        />
                        <path
                          d={l.d}
                          fill="none"
                          stroke={p.primary}
                          strokeWidth={on ? 3 : 2}
                          strokeDasharray={on ? undefined : "6 6"}
                          strokeLinecap="round"
                          markerEnd="url(#m3e-arrow)"
                          opacity={on ? 1 : 0.7}
                        />
                      </g>
                    );
                  })}
                </svg>
              )}

              {links
                .filter((l) => l.id === selectedLinkId)
                .map((l) => (
                  <div
                    key={l.id}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      left: l.mx,
                      top: l.my,
                      transform: `translate(-50%, 14px) scale(${1 / view.z})`,
                      transformOrigin: "50% 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: 6,
                      borderRadius: 26,
                      background: p.surfaceContainerLow,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
                      zIndex: 60,
                    }}
                  >
                    <Segmented<Transition>
                      options={TRANSITIONS.map((t) => ({
                        key: t.key,
                        icon: t.icon,
                        title: t.label,
                      }))}
                      value={l.t}
                      onChange={(t) => setLinkTransition(l.id, t)}
                      p={p}
                      height={36}
                      grow={false}
                    />
                    <IconBtn
                      icon="link_off"
                      p={p}
                      danger
                      onClick={() => removeLink(l.id)}
                      title={t("removeLink", lang)}
                      size={36}
                    />
                  </div>
                ))}

              {guide?.gx !== undefined && (
                <div
                  style={{
                    position: "absolute",
                    left: guide.gx,
                    top: visibleWorld.t,
                    width: 1.5 / view.z,
                    height: visibleWorld.h,
                    background: p.primary,
                    pointerEvents: "none",
                  }}
                />
              )}
              {guide?.gy !== undefined && (
                <div
                  style={{
                    position: "absolute",
                    top: guide.gy,
                    left: visibleWorld.l,
                    height: 1.5 / view.z,
                    width: visibleWorld.w,
                    background: p.primary,
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* what a drop would land in: the container lights up under the part being dragged */}
              {(() => {
                const wanted = drag?.over ?? (gesture?.kind === "child" ? gesture.over ?? null : null);
                const over = wanted ? itemRects().find((r) => r.id === wanted) : undefined;
                if (!over) return null;
                return (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: over.l,
                      top: over.t,
                      width: over.r - over.l,
                      height: over.b - over.t,
                      border: `${2 / view.z}px dashed ${p.primary}`,
                      borderRadius: 8 / view.z,
                      background: `${p.primary}14`,
                      pointerEvents: "none",
                      zIndex: 30,
                    }}
                  />
                );
              })()}

              {marquee && (
                <div
                  style={{
                    position: "absolute",
                    left: Math.min(marquee.x0, marquee.x1),
                    top: Math.min(marquee.y0, marquee.y1),
                    width: Math.abs(marquee.x1 - marquee.x0),
                    height: Math.abs(marquee.y1 - marquee.y0),
                    border: `${1 / view.z}px solid ${p.primary}`,
                    background: `${p.primary}14`,
                    borderRadius: 4 / view.z,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>

          {draftBusy && (
            <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
              <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
                <defs>
                  <linearGradient id="m3e-drafting" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={p.primary} />
                    <stop offset="50%" stopColor={p.tertiaryContainer} />
                    <stop offset="100%" stopColor={p.primaryContainer} />
                    <animateTransform attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="3s" repeatCount="indefinite" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}
          <Toolbar
            p={p}
            mode={mode}
            onMode={setMode}
            frame={frame}
            onFrame={changeFrame}
            zoom={view.z}
            onZoom={(z) => setZoomAt(z)}
            onFit={fit}
            canUndo={pastRef.current.length > 0}
            canRedo={futureRef.current.length > 0}
            onUndo={undo}
            onRedo={redo}
            onClear={() => {
              if (groupsRef.current.length || framesRef.current.length) setConfirmClear(true);
            }}
            onAddFrame={addFrame}
            onPreview={() => openPreview()}
            note={aiNote}
            onSaveProject={() => saveProject(doc)}
            onOpenProject={() => projectFileRef.current?.click()}
            onFlow={() => openFlow()}
            onShare={!isMobile ? () => setShareOpen(true) : undefined}
            shareState={draftBusy ? "busy" : draftBefore ? "review" : "idle"}
            onDraftKeep={keepDraft}
            onDraftUndo={undoDraft}
            onDraftSave={() => saveProject(doc)}
            quickUndo={quickUndo}
            rightInset={showRight ? rightW : 0}
            mobile={isMobile}
            onSettings={() => setSheet(sheet === "settings" ? null : "settings")}
            onLangSheet={() => setSheet(sheet === "lang" ? null : "lang")}
            onPrompt={async () => {
              try {
                await navigator.clipboard.writeText(effectivePrompt(doc, widths, lang));
                showToast(t("copied", lang), 1400, "check");
              } catch {}
            }}
          />

          {isMobile && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 80,
                textAlign: "center",
                fontSize: 11,
                lineHeight: 1.4,
                color: p.onSurfaceVariant,
                pointerEvents: "none",
                zIndex: 40,
              }}
            >
              {t("mobileNote", lang)}
            </div>
          )}

          {isMobile && sheet === null && (
            <button
              onClick={addButton}
              title={t("addButton", lang)}
              aria-label={t("addButton", lang)}
              className="m3-press"
              style={{
                position: "absolute",
                right: 16,
                bottom: "calc(16px + var(--bottom-ui, 0px) + env(safe-area-inset-bottom))",
                width: 64,
                height: 64,
                borderRadius: 20,
                border: "none",
                background: p.primary,
                color: p.onPrimary,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                zIndex: 46,
                boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
              }}
            >
              <Icon name="add" size={32} />
            </button>
          )}

          {isMobile && selected && sheet === null && (
            <MobileActionBar
              p={p}
              onEdit={() => setSheet("edit")}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
            />
          )}

          <AnimatePresence>
            {isMobile && sheet === "edit" && selected && (
              <BottomSheet key="edit" p={p} onClose={() => setSheet(null)}>
                <MobileInspector
                  item={selected}
                  palette={p}
                  onChange={patchSelected}
                  onDelete={() => {
                    deleteSelected();
                    setSheet(null);
                  }}
                  onDuplicate={duplicateSelected}
                  onClose={() => setSheet(null)}
                />
              </BottomSheet>
            )}
            {isMobile && sheet === "settings" && (
              <BottomSheet key="settings" p={p} onClose={() => setSheet(null)}>
                <MobileSettings palette={p} paletteKey={paletteKey} onPalette={setPaletteKey} theme={theme} onTheme={patchTheme} />
              </BottomSheet>
            )}
            {isMobile && sheet === "lang" && (
              <BottomSheet key="lang" p={p} onClose={() => setSheet(null)}>
                <MobileLang
                  palette={p}
                  lang={lang}
                  onLang={(l) => {
                    changeLanguage(l);
                    setSheet(null);
                  }}
                />
              </BottomSheet>
            )}
          </AnimatePresence>

          {toast && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 96,
                transform: "translateX(-50%)",
                padding: "10px 18px",
                borderRadius: 20,
                background: p.inverseSurface,
                color: p.inverseOnSurface,
                fontSize: 13,
                fontWeight: 600,
                zIndex: 47,
                pointerEvents: "none",
              }}
            >
              {toast}
            </div>
          )}

          {!rightOpen && !isMobile && (
            <div
              style={{ position: "absolute", right: 20, top: 20, zIndex: 45 }}
            >
              <IconBtn
                icon="right_panel_open"
                p={p}
                on
                onClick={() => setRightOpen(true)}
                title={t("edit", lang)}
                size={44}
              />
            </div>
          )}
        </main>

        {/* ---- right: inspector / prompt ---- */}
        {showRight && (
          <aside style={{ ...panelStyle, width: rightW }}>
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setResizing("right");
              }}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: -3,
                width: 6,
                cursor: "col-resize",
                zIndex: 5,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 10px 6px 12px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Segmented<"edit" | "prompt">
                  options={[
                    { key: "edit", icon: "tune", title: t("edit", lang), grow: false, wide: true },
                    { key: "prompt", icon: "auto_awesome", label: t("prompt", lang), title: t("prompt", lang), grow: true },
                  ]}
                  value={rightTab}
                  onChange={setRightTab}
                  p={p}
                  height={40}
                />
              </div>
              <IconBtn
                icon="right_panel_close"
                p={p}
                onClick={() => setRightOpen(false)}
                title={t("closePanel", lang)}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {rightTab === "edit" && selectedFrame && !selected ? (
                <FrameInspector
                  frame={selectedFrame}
                  palette={p}
                  onSize={(preset) => setFramePreset(selectedFrame.id, preset)}
                  onChange={(patch) => patchFrame(selectedFrame.id, patch)}
                  onDelete={() => deleteFrame(selectedFrame.id)}
                  onDuplicate={() => duplicateFrame(selectedFrame.id)}
                  onPreview={() => openPreview(selectedFrame.id)}
                  prompt={buildPrompt(doc, widths, selectedFrame.id, lang)}
                  onSaveImage={() => saveFrameImage(selectedFrame)}
                  frames={frames}
                  ai={{ ready: aiReady, reason: aiReason, busy: aiBusy && aiFrameId === selectedFrame.id, onRun: () => runAi("describe", selectedFrame), onCancel: cancelAi }}
                />
              ) : rightTab === "edit" ? (
                <Inspector
                  ai={{
                    ready: aiReady && !!screenInPlay,
                    reason: aiReason,
                    busy: aiBusy,
                    onRun: () => {
                      if (screenInPlay && selected) runAi("behavior", screenInPlay, selected.id);
                    },
                    onCancel: cancelAi,
                  }}
                  item={selectedIds.length > 1 ? null : selected}
                  railStandalone={groups.some((g) => g.items.length === 1 && g.items[0].id === selected?.id)}
                  frame={selectedPartFrame}
                  palette={p}
                  frames={frame === "phone" ? frames : []}
                  onChange={patchSelected}
                  onDelete={deleteSelected}
                  onDuplicate={duplicateSelected}
                  onAlign={alignSelected}
                  multi={selectedIds.length}
                  grouped={!!selectedGroup}
                  onGroup={groupSelected}
                  onContainerize={selectedIds.length > 1 ? containerizeSelected : undefined}
                  onUnlink={selectedIds.length > 0 ? unlinkSelected : undefined}
                  dialog={dialogChoices}
                  onSaveComposite={selected ? () => setSaveAsk({ itemId: selected.id, name: "" }) : undefined}
                  childCount={selected?.children?.length ?? 0}
                  inContainer={!!selected && !!parentOf(groups, selected.id)}
                  widths={widths}
                  lookTargets={lookTargets}
                  onUngroup={ungroupSelected}
                  vars={vars}
                />
              ) : (
                <PromptPanel
                  doc={doc}
                  widths={widths}
                  palette={p}
                  onDoc={(patch) => {
                    if (patch.title !== undefined) setTitle(patch.title);
                    if (patch.brief !== undefined) setBrief(patch.brief);
                    if ("promptEdit" in patch) setPromptEdit(patch.promptEdit);
                    if ("platform" in patch) setPlatform(isPlatform(patch.platform) ? patch.platform : null);
                  }}
                />
              )}
            </div>
          </aside>
        )}

        <input
          ref={projectFileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readProject(file).then((next) => (next ? setPendingImport(next) : showToast(t("invalidProject", lang), 3000, "error")));
          }}
        />

        {saveAsk && (
          <div
            role="dialog"
            aria-label={t("addToComposites", lang)}
            style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.38)" }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSaveAsk(null);
            }}
          >
            <div style={{ width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 12, padding: 18, borderRadius: 28, background: p.surfaceContainerHigh, color: p.onSurface, boxShadow: "0 8px 30px rgba(0,0,0,0.30)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="library_add" size={22} />
                <span style={{ fontSize: 15, fontWeight: 700 }}>{t("addToComposites", lang)}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant }}>{t("compositeNameHint", lang)}</div>
              {/* the field wears a border of its own, so it reads as something to fill in */}
              <div style={{ border: `1px solid ${p.outline}`, borderRadius: 14, padding: 2 }}>
                <Field
                  value={saveAsk.name}
                  onChange={(name) => setSaveAsk({ ...saveAsk, name })}
                  placeholder={t("compositeNameHint", lang)}
                  p={p}
                  icon="label"
                  height={44}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => setSaveAsk(null)} className="m3-press" style={{ height: 40, padding: "0 18px", borderRadius: 20, border: `1px solid ${p.outline}`, background: "transparent", color: p.primary, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {t("cancel", lang)}
                </button>
                <button
                  onClick={() => {
                    const name = saveAsk.name.trim();
                    if (!name) return;
                    if (customParts.some((c) => c.name.trim() === name) && !window.confirm(t("overwriteName", lang))) return;
                    saveAsComposite(saveAsk.itemId, name);
                  }}
                  disabled={!saveAsk.name.trim()}
                  className="m3-press"
                  style={{ height: 40, padding: "0 18px", borderRadius: 20, border: "none", background: saveAsk.name.trim() ? p.primary : p.surfaceContainerHighest, color: saveAsk.name.trim() ? p.onPrimary : p.outline, fontSize: 14, fontWeight: 600, cursor: saveAsk.name.trim() ? "pointer" : "default" }}
                >
                  {t("ok", lang)}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={nestAsk !== null}
          icon="subdirectory_arrow_right"
          title={nestAsk ? t("nestTitle", lang).replace("{a}", nestAsk.itemName).replace("{b}", nestAsk.containerName) : ""}
          body={nestAsk ? t("nestBody", lang).replace("{a}", nestAsk.itemName).replace("{b}", nestAsk.containerName) : ""}
          p={p}
          onCancel={() => setNestAsk(null)}
          onConfirm={() => {
            if (nestAsk) nestInto(nestAsk.itemIds, nestAsk.containerId);
          }}
        />

        <ConfirmDialog
          open={pendingImport !== null}
          icon="file_open"
          title={t("replaceProjectTitle", lang)}
          body={t("replaceProject", lang)}
          p={p}
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            if (pendingImport) importDoc(pendingImport);
            setPendingImport(null);
          }}
        />

        {/* composing a set of parts to keep in the palette, or changing a saved one */}
        {composeOpen && (
          <CompositeDialog
            p={p}
            editing={composeEditing}
            initial={
              /* what the author already selected is offered as the starting point */
              selected?.children?.length
                ? selected.children.map((c) => ({ ...c }))
                : selected
                  ? [{ ...selected, x: 24, y: 24 } as PlacedItem]
                  : null
            }
            onCancel={() => {
              setComposeOpen(false);
              setComposeEditing(null);
            }}
            onDone={(part) => {
              /* the palette keeps it; it is part of the document, so sharing a link carries it too */
              setCustomParts((cur) => (composeEditing ? cur.map((x) => (x.id === composeEditing.id ? { ...part, id: x.id } : x)) : [...cur, { ...part, id: uid() }]));
              setComposeOpen(false);
              setComposeEditing(null);
              showToast(t(composeEditing ? "editComposite" : "composite", lang), 1400, "widgets");
            }}
          />
        )}

        <ShareDialog
          p={p}
          doc={doc}
          aiReady={aiReady}
          idea={ideaText}
          onIdea={setIdeaText}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onDraft={(idea) => void startDraft(idea)}
          onSetupAi={() => {
            setShareOpen(false);
            setLeftOpen(true);
            setLeftTab("ai");
          }}
        />


        <ConfirmDialog
          open={confirmClear}
          title={t("clearAllTitle", lang)}
          body={t("clearAllBody", lang)}
          p={p}
          onCancel={() => setConfirmClear(false)}
          onConfirm={clearAll}
        />
      </div>

      <AnimatePresence>
        {previewId !== null && frames.length > 0 && (
          <Preview
            key="preview"
            doc={doc}
            widths={widths}
            palette={p}
            startId={previewId}
            onClose={closePreview}
          />
        )}
      </AnimatePresence>

      {editAccess === "readonly" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-access-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "rgba(0,0,0,0.32)",
          }}
        >
            <div
              style={{
                width: "min(420px, 100%)",
                padding: 24,
                borderRadius: 28,
                background: p.surfaceContainerHigh,
                color: p.onSurface,
                boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
              }}
            >
              <Icon name="lock" size={28} />
              <h1 id="edit-access-title" style={{ margin: "16px 0 8px", fontSize: 22, lineHeight: 1.25 }}>
                {t("readOnlyTitle", lang)}
              </h1>
              <p style={{ margin: 0, color: p.onSurfaceVariant, fontSize: 14, lineHeight: 1.5 }}>
                {t("readOnlyBody", lang)}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  autoFocus
                  className="m3-press"
                  onClick={() => window.location.reload()}
                  style={{
                    minHeight: 40,
                    padding: "0 20px",
                    border: "none",
                    borderRadius: 20,
                    background: p.primary,
                    color: p.onPrimary,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("reload", lang)}
                </button>
              </div>
            </div>
        </div>
      )}
    </ThemeContext.Provider>
    </LangContext.Provider>
  );
}
