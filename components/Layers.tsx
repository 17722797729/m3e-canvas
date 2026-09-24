"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Frame, Group, Item, KIND_SPEC, Palette, byLayer, explodeGroup, findItemIn, isOverlayFrame, isPhoneFrame, isTabRow, layerOf, overlayLevelOfFrame, pageTintOf, parentOf, subtreeOf, tabIndexOf, takesText } from "@/lib/tokens";
import { contrastRatio } from "@/lib/color";
import { splitByPage } from "@/lib/pages";
import { Icon } from "./M3Node";
import { inputBox } from "./ui";
import { Lang, KIND_TEXT, overlayLevelText, t, useLang } from "@/lib/i18n";
import { LayerHit, layerName, searchLayers } from "@/lib/search";

/* Rows never animate their size: opening a row only adds rows under it, so
 * nothing stretches. Only the drag itself moves.
 *
 * The panel is a tree with three kinds of level. The page level lists the screens;
 * one of them is open at a time and shows its layers. A z level lists what is drawn
 * on top of what, front first: the runs of a screen, and the runs hidden inside a
 * free group. A run level lists the parts of one connected run in reading order
 * (left to right, top to bottom), and a container opens to the parts it holds.
 * Every reorderable level is reordered by dragging the handle; the page turns the
 * new order back into a group. */

function nameOf(it: Item, lang: Lang) {
  const spec = KIND_SPEC[it.kind] ?? KIND_SPEC.box;
  const noun = KIND_TEXT[lang][it.kind]?.noun ?? spec.label;
  /* The name an author gave the row wins, then the part's own text, then its kind. A part renamed
     in this list keeps its words: the row reads as the author named it, and the canvas keeps
     showing what the part says. The kind's noun is in the author's language — an icon is a material
     symbol name, which would read as stray English in the middle of a Japanese or Chinese list —
     and the row draws the glyph itself, so nothing is lost. */
  return it.name?.trim() || it.label.trim() || noun;
}

function runLabel(g: Group, lang: Lang) {
  /* a group the editor made for itself says so by name */
  if (g.name) return g.name;
  const first = g.items[0];
  const noun = KIND_TEXT[lang][first.kind]?.noun ?? (KIND_SPEC[first.kind] ?? KIND_SPEC.box).label;
  return g.free ? `${t("group", lang)} × ${g.items.length}` : g.items.length > 1 ? `${noun} × ${g.items.length}` : nameOf(first, lang);
}

/** One level's order and the way it wants a new one, plus the running drag. */
type LevelInfo = { values: string[]; onReorder: (next: string[]) => void };
type Dnd = {
  levels: Map<string, LevelInfo>;
  level: string;
  dragging: string | null;
  /** the kind of the part being dragged: a text is taken by anything that shows text */
  carrying: string | null;
  begin: (e: React.PointerEvent, value: string, part: string, holds: boolean) => void;
};
const DndCtx = createContext<Dnd>({ levels: new Map(), level: "", dragging: null, carrying: null, begin: () => {} });

function Row({
  id,
  p,
  depth,
  icon,
  label,
  on,
  onSelect,
  open,
  onToggle,
  onDragging,
  badge,
  badgeTitle,
  tint,
  plain,
  movable,
  onNest,
  onRename,
  onMagnify,
  magnified,
  holds,
  takesText,
  hover,
  onFree,
  inContainer,
  onTabSelect,
  children,
}: {
  id: string;
  p: Palette;
  depth: number;
  icon: ReactNode;
  label: string;
  on: boolean;
  onSelect: (add: boolean) => void;
  /** set when the row can open to show what it holds */
  open?: boolean;
  onToggle?: () => void;
  onDragging: (dragging: boolean, id?: string) => void;
  /** the part's own layer, when it is not the default */
  badge?: string;
  /** what the badge says on hover: a level badge is not a layer number */
  badgeTitle?: string;
  /** a page that stands apart from the screens is tinted, the same way it is on the canvas */
  tint?: { bg: string; ink: string } | null;
  /** a row that is not reorderable (a page, or a part inside a container) */
  plain?: boolean;
  /** a row with no level of its own that can still be picked up and dropped on a container */
  movable?: boolean;
  /** asks to put this row's part inside a container on the same screen */
  onNest?: () => void;
  /** writes the name the author typed over this row's own */
  onRename?: (name: string) => void;
  /** takes the canvas up close to this row's part, and back again */
  onMagnify?: () => void;
  /** this row's part is the one the canvas is up close to */
  magnified?: boolean;
  /** takes this row's part out of its container */
  onFree?: () => void;
  /** this row is a container's own child */
  inContainer?: boolean;
  /** this row's part can hold others (a container, or a bar with buttons) */
  holds?: boolean;
  /** this row's part writes text of its own, so a dragged text belongs inside it */
  takesText?: boolean;
  /** a drag is hovering this row: it lights up, and a holder opens to receive */
  hover?: boolean;
  /** switches a tab row to one of its destinations */
  onTabSelect?: (itemId: string, index: number) => void;
  children?: ReactNode;
}) {
  const lang = useLang();
  /* the row's own background decides what its icons and label can be seen in: a custom
     scheme can put a dark surface under a light one, and icons must still read */
  const dnd = useContext(DndCtx);
  const lang0 = useLang();
  /* the name being typed over this row's own, when the author double-clicked it */
  const [typing, setTyping] = useState<string | null>(null);
  /* A row can take a part two ways: as a container takes anything, or — only while a text is being
     dragged — as a part that writes text, which takes the text into itself. */
  const canTake = holds || (dnd.carrying === "text" && !!takesText);
  const resting = tint ? tint.bg : depth === 0 ? p.surfaceContainerLow : p.surface;
  const bg = hover ? (canTake ? p.tertiaryContainer : p.surfaceContainerHigh) : on ? p.secondaryContainer : resting;
  const ink = (want: string) => (contrastRatio(want, bg) >= 3 ? want : contrastRatio(p.onSurface, bg) >= contrastRatio(p.onSurfaceVariant, bg) ? p.onSurface : p.onSurfaceVariant);
  const draggable = !plain || !!movable;
  /* A movable row stands in no level of its own: dropping it anywhere but on a container does
     nothing, rather than sliding a part of a run that is not on screen. */
  const levelKey = movable && plain ? "" : dnd.level;
  const h = depth === 0 ? 40 : 36;
  const body = (
    <div
      {...(draggable ? { "data-value": id, "data-level": levelKey, "data-part": id, "data-holds": holds ? "1" : undefined, "data-takes-text": takesText ? "1" : undefined } : { "data-part": id, "data-holds": holds ? "1" : undefined, "data-takes-text": takesText ? "1" : undefined })}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: h,
        padding: "0 6px 0 2px",
        marginLeft: depth * 14,
        borderRadius: depth === 0 ? 14 : 12,
        background: hover ? (canTake ? p.tertiaryContainer : p.surfaceContainerHigh) : on ? p.secondaryContainer : depth === 0 ? p.surfaceContainerLow : p.surface,
        color: hover ? (canTake ? p.onTertiaryContainer : p.onSurface) : on ? p.onSecondaryContainer : tint ? tint.ink : ink(p.onSurface),
        outline: hover && canTake ? `2px solid ${p.primary}` : undefined,
        outlineOffset: hover && canTake ? 1 : undefined,
        opacity: dnd.dragging === id ? 0.45 : 1,
        userSelect: "none",
        touchAction: draggable ? "none" : undefined,
      }}
    >
      {draggable ? (
        <span
          onPointerDown={(e) => {
            dnd.begin(e, id, id, !!holds);
          }}
          style={{ cursor: "grab", color: ink(p.outline), display: "grid", placeItems: "center", width: depth === 0 ? 24 : 20, height: h, touchAction: "none", flex: "0 0 auto" }}
        >
          <Icon name="drag_indicator" size={18} />
        </span>
      ) : (
        <span style={{ width: depth === 0 ? 24 : 20, height: h, flex: "0 0 auto" }} />
      )}
      {typing !== null ? (
        <input
          autoFocus
          value={typing}
          onChange={(e) => setTyping(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={() => {
            onRename?.(typing.trim());
            setTyping(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            else if (e.key === "Escape") setTyping(null);
          }}
          aria-label={t("rename", lang0)}
          style={{ flex: 1, minWidth: 0, height: 26, marginLeft: -4, padding: "0 6px", borderRadius: 8, border: `1px solid ${p.primary}`, background: p.surface, color: p.onSurface, fontSize: 12, fontWeight: 500, outline: "none" }}
        />
      ) : (
      <button
        onPointerDown={draggable ? (e) => dnd.begin(e, id, id, !!holds) : undefined}
        onClick={(e) => onSelect(e.shiftKey)}
        onDoubleClick={onRename ? () => setTyping(label) : undefined}
        title={onRename ? t("renameHint", lang0) : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          height: h,
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
        }}
      >
        <span style={{ display: "inline-flex", gap: 2, color: on ? p.onSecondaryContainer : ink(p.primary) }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: depth === 0 ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {badge && (
          <span
            title={badgeTitle ?? t("layer", lang)}
            style={{ marginLeft: "auto", flex: "0 0 auto", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: on ? p.onSecondaryContainer : p.surfaceContainerHigh, color: on ? p.secondaryContainer : p.onSurfaceVariant }}
          >
            {badge}
          </span>
        )}
      </button>
      )}
      {inContainer && onFree && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFree();
          }}
          title={t("takeOut", lang)}
          aria-label={t("takeOut", lang)}
          className="m3-press"
          style={{ width: 28, height: 28, borderRadius: 14, border: "none", background: "transparent", color: "#ffffff", cursor: "pointer", padding: 0, display: "grid", placeItems: "center", flex: "0 0 auto" }}
        >
          <Icon name="move_up" size={18} />
        </button>
      )}
      {onMagnify && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMagnify();
          }}
          title={t(magnified ? "magnifyOff" : "magnify", lang)}
          aria-label={t(magnified ? "magnifyOff" : "magnify", lang)}
          aria-pressed={!!magnified}
          className="m3-press"
          style={{ width: 28, height: 28, borderRadius: 14, border: "none", background: "transparent", color: magnified ? (on ? p.onSecondaryContainer : ink(p.primary)) : ink(p.outline), cursor: "pointer", padding: 0, display: "grid", placeItems: "center", flex: "0 0 auto" }}
        >
          <Icon name={magnified ? "zoom_out" : "zoom_in"} size={18} />
        </button>
      )}
      {onToggle && (
        <button
          onClick={onToggle}
          title={t(open ? "hideParts" : "showParts", lang)}
          aria-expanded={open}
          className="m3-press"
          style={{ width: 28, height: 28, borderRadius: 14, border: "none", background: "transparent", color: on ? p.onSecondaryContainer : ink(p.onSurfaceVariant), cursor: "pointer", padding: 0, display: "grid", placeItems: "center", flex: "0 0 auto" }}
        >
          <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : "none", transition: "transform 160ms" }}>
            <Icon name="chevron_right" size={20} />
          </span>
        </button>
      )}
    </div>
  );
  return (
    <div style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 4, position: "relative" }}>
      {body}
      {open && children}
    </div>
  );
}

/** One level of the tree: it records the order it shows and the way it takes a new one. */
function Level({ levelKey, values, onReorder, children }: { levelKey: string; values: string[]; onReorder: (next: string[]) => void; children: ReactNode }) {
  const parent = useContext(DndCtx);
  parent.levels.set(levelKey, { values, onReorder });
  return (
    <DndCtx.Provider value={{ ...parent, level: levelKey }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 0, margin: 0 }}>{children}</div>
    </DndCtx.Provider>
  );
}

/** A part row, opening to the parts it holds when it is a container. Only a part that
 *  sits in a reorderable level gets a drag handle; a child inside a container does not,
 *  since its order there is its layer. */
function PartRow({
  it,
  p,
  depth,
  sel,
  onSelect,
  onDragging,
  openIds,
  toggle,
  reorderable = false,
  movable = false,
  onNest,
  onRename,
  onMagnify,
  magnifiedId,
  hoverId,
  onFree,
  inContainer,
  onTabSelect,
  onTabRename,
}: {
  it: Item;
  p: Palette;
  depth: number;
  sel: Set<string>;
  onSelect: (itemIds: string[], add: boolean) => void;
  onDragging: (dragging: boolean, id?: string) => void;
  openIds: Set<string>;
  toggle: (id: string) => void;
  reorderable?: boolean;
  /** A part a container holds can be picked up and dropped into another container: its row has no
   *  level to reorder in, so a drag means "put this somewhere else" and nothing else. Without it the
   *  author has to take the part out of its container first and then drag it in — two gestures for
   *  one move. */
  movable?: boolean;
  /** asks to put this part inside one of the screen's containers */
  onNest?: (it: Item) => void;
  /** writes a name the author typed over this part's own in the list */
  onRename?: (itemId: string, name: string) => void;
  /** takes the canvas up close to this part */
  onMagnify?: (itemId: string) => void;
  /** the part the canvas is up close to */
  magnifiedId?: string | null;
  /** takes this part out of its container */
  onFree?: (itemId: string) => void;
  /** the row a drag is hovering */
  hoverId?: string | null;
  /** this part is a container's own child, so it offers the way out */
  inContainer?: boolean;
  /** switches a tab row to one of its own rows, the way picking its panel does */
  onTabSelect?: (itemId: string, index: number) => void;
  /** writes the words an author typed over one of this part's destinations */
  onTabRename?: (itemId: string, index: number, name: string) => void;
}) {
  const lang = useLang();
  /* A tab row shows its panels as well: one per tab, in tab order, named after the tab they belong
     to, so a tab the author just added is visibly a tab *and* the panel under it. */
  const kids = [...(it.children ?? [])].sort(byLayer).reverse();
  /* a bar's destinations are buttons of their own: they belong under it in the tree */
  const slots = (it.tabs ?? []).map((t, i) => ({ key: `tab:${i}`, at: i, icon: t.icon, label: t.label, place: i + 1 }));
  /* a destination the author gave no words — a toolbar's icons, say — is named by its place in the
     bar, in the language they are working in: the key it is known by here would read as noise */
  const nounOf = KIND_TEXT[lang][it.kind]?.noun ?? (KIND_SPEC[it.kind] ?? KIND_SPEC.box).label;
  const slotName = (sl: { label: string; place: number }) => sl.label.trim() || `${nounOf} ${sl.place}`;
  /* What can take a dropped part: a container, and a tab row — which receives into the panel of the
     tab in front. A bar can *open* to its destinations, but those are its own buttons, not room for a
     part, so it must not light up as a place to drop one. */
  const holds = it.kind === "box" || isTabRow(it);
  const takesTextRow = !holds && takesText(it);
  const open = (kids.length > 0 || slots.length > 0) && openIds.has(it.id);
  return (
    <Row
      id={it.id}
      p={p}
      depth={depth}
      plain={!reorderable}
      movable={reorderable || movable}
      icon={<Icon name={(KIND_SPEC[it.kind] ?? KIND_SPEC.box).paletteIcon} size={16} />}
      label={nameOf(it, lang)}
      on={sel.has(it.id)}
      onSelect={(add) => onSelect([it.id], add)}
      open={kids.length || slots.length ? open : undefined}
      onToggle={kids.length || slots.length ? () => toggle(it.id) : undefined}
      onDragging={onDragging}
      onNest={onNest ? () => onNest(it) : undefined}
      onFree={onFree ? () => onFree(it.id) : undefined}
      inContainer={inContainer}
      holds={holds}
      takesText={takesTextRow}
      onRename={onRename ? (name) => onRename(it.id, name) : undefined}
      /* every part can be brought up close, the small ones most of all */
      onMagnify={onMagnify ? () => onMagnify(it.id) : undefined}
      magnified={magnifiedId === it.id}
      hover={hoverId === it.id}
      onTabSelect={onTabSelect}
    >
      {kids.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {kids.map((c) => (
            <PartRow key={c.id} it={c} p={p} depth={depth + 1} sel={sel} onSelect={onSelect} onDragging={onDragging} openIds={openIds} toggle={toggle} hoverId={hoverId} onFree={onFree} onRename={onRename} inContainer movable={reorderable || movable} onMagnify={onMagnify} magnifiedId={magnifiedId} onTabSelect={onTabSelect} onTabRename={onTabRename} />
          ))}
        </div>
      )}
      {/* the bar's own buttons, each with the icon and words it shows on the canvas */}
      {slots.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {slots.map((sl) => {
            /* a destination of a tab row is the tab itself: the row in front is marked, and picking
               another switches the row to it, exactly as picking its panel does */
            const isTabSlot = isTabRow(it) && sl.key.startsWith("tab:");
            const tabIndex = isTabSlot ? Number(sl.key.slice(4)) : -1;
            return (
            <Row
              key={sl.key}
              id={`${it.id}:${sl.key}`}
              p={p}
              depth={depth + 1}
              plain
              icon={<Icon name={sl.icon || "radio_button_unchecked"} size={16} />}
              label={slotName(sl)}
              /* a tab's own row switches to it: the row and the panel under it are the same choice */
              on={isTabSlot ? tabIndexOf(it) === tabIndex : false}
              onRename={onTabRename ? (name) => onTabRename(it.id, sl.at, name) : undefined}
              onSelect={() => {
                if (isTabSlot) onTabSelect?.(it.id, tabIndex);
                onSelect([it.id], false);
              }}
              onDragging={onDragging}
            />
            );
          })}
        </div>
      )}
    </Row>
  );
}

/** the parts of one connected run, in reading order */
function RunParts({
  run,
  p,
  depth,
  sel,
  onSelect,
  onReorder,
  onDragging,
  openIds,
  toggle,
  onNest,
  onRename,
  onMagnify,
  magnifiedId,
  hoverId,
  onFree,
  onTabRename,
}: {
  run: Group;
  p: Palette;
  depth: number;
  sel: Set<string>;
  onSelect: (itemIds: string[], add: boolean) => void;
  /** the run's parts in a new reading order */
  onReorder: (ids: string[]) => void;
  onDragging: (dragging: boolean, id?: string) => void;
  openIds: Set<string>;
  toggle: (id: string) => void;
  onNest?: (it: Item) => void;
  hoverId?: string | null;
  onFree?: (itemId: string) => void;
  /** writes a name the author typed over one of these parts' own */
  onRename?: (itemId: string, name: string) => void;
  /** takes the canvas up close to one of these parts */
  onMagnify?: (itemId: string) => void;
  /** the part the canvas is up close to */
  magnifiedId?: string | null;
  /** writes the words an author typed over one of these parts' destinations */
  onTabRename?: (itemId: string, index: number, name: string) => void;
}) {
  const ids = run.items.map((it) => it.id);
  return (
    <Level levelKey={`parts:${run.id}`} values={ids} onReorder={onReorder}>
      {run.items.map((it) => (
        <PartRow key={it.id} it={it} p={p} depth={depth} sel={sel} onSelect={onSelect} onDragging={onDragging} openIds={openIds} toggle={toggle} reorderable onNest={onNest} onRename={onRename} onMagnify={onMagnify} magnifiedId={magnifiedId} hoverId={hoverId} onFree={onFree} onTabRename={onTabRename} />
      ))}
    </Level>
  );
}

/** The pages of the document, and the layers of the open one. A page row opens to its
 *  groups, which open in turn to their runs, their parts and their containers. */
export function LayersPanel({
  p,
  frames,
  frameId,
  onFrame,
  groups,
  frameIdOf,
  widths,
  selectedIds,
  onSelect,
  onReorder,
  onReorderItems,
  onDragging,
  onNest,
  onDropPart,
  onFreePart,
  onRename,
  onGroupRename,
  onFrameRename,
  onTabRename,
  onMagnify,
  magnifiedId,
  onTabSelect,
}: {
  p: Palette;
  frames: Frame[];
  frameId: string | null;
  onFrame: (id: string) => void;
  /** every group in the document, in canvas order (bottom first) */
  groups: Group[];
  /** the page a group belongs to */
  frameIdOf: (groupId: string) => string | null;
  widths: Record<string, number>;
  selectedIds: string[];
  /** `add` is set when Shift was held, to extend the selection */
  onSelect: (itemIds: string[], add: boolean) => void;
  /** new order for the open page, top layer first */
  onReorder: (topFirst: string[]) => void;
  /** a group's parts in a new order: back to front for a free group, reading order for a run */
  onReorderItems: (groupId: string, ids: string[]) => void;
  /** a drag on any level starting or ending, so the page can record one undo step for the whole drag */
  onDragging: (dragging: boolean) => void;
  /** parts were dropped onto a container: make them its children when the drop asks for it */
  onDropPart?: (itemIds: string[], targetId: string) => void;
  /** asks to put one part inside a container on the same screen */
  onNest?: (it: Item) => void;
  /** takes one part out of the container that holds it */
  onFreePart?: (itemId: string) => void;
  /** writes a name the author typed over a part's own in the list */
  onRename?: (itemId: string, name: string) => void;
  /** writes the name an author typed over a whole group's row: the run or the hand-made group */
  onGroupRename?: (groupId: string, name: string) => void;
  /** writes the name an author typed over a screen's row */
  onFrameRename?: (frameId: string, name: string) => void;
  /** writes the words an author typed over one destination of a bar, rail or tab row */
  onTabRename?: (itemId: string, index: number, name: string) => void;
  /** takes the canvas up close to a part */
  onMagnify?: (itemId: string) => void;
  /** the part the canvas is up close to */
  magnifiedId?: string | null;
  /** switches a tab row to one of its own rows, the way picking its panel does */
  onTabSelect?: (itemId: string, index: number) => void;
  /** every variable in the document: the ones a page owns are listed under it */
  /** takes the author to a variable in the variables panel */
}) {
  const lang = useLang();
  const sel = new Set(selectedIds);
  /* What the author is looking for. A document with more pages than fit has no other way to a row:
     the query is matched against the name a row shows, the words the part says, its destinations and
     its kind, so "按钮" finds every button and "save" finds the one called Save. */
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchLayers(frames, groups, frameIdOf, q, lang), [frames, groups, frameIdOf, q, lang]);
  const searching = q.trim().length > 0;
  const openHit = (h: LayerHit) => {
    if (h.frameId) onFrame(h.frameId);
    if (h.itemId) onSelect([h.itemId], false);
  };
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [openFrames, setOpenFrames] = useState<Set<string>>(() => new Set(frameId ? [frameId] : []));
  /* the page in play is always open, so the panel shows where an edit lands */
  useEffect(() => {
    if (!frameId) return;
    setOpenFrames((cur) => (cur.has(frameId) ? cur : new Set(cur).add(frameId)));
  }, [frameId]);
  const toggle = (id: string) =>
    setOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleFrame = (id: string) =>
    setOpenFrames((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  /* The mirror of clicking a row: a part picked on the canvas has to be findable in the list,
     so its containers open and its row scrolls in — only as far as it must, and only for a
     single selection, since a multi-selection has no one row to show. */
  const lastRevealed = useRef<string | null>(null);
  useEffect(() => {
    const id = selectedIds.length === 1 ? selectedIds[0] : null;
    if (!id || id === lastRevealed.current) return;
    lastRevealed.current = id;
    const chain: string[] = [];
    for (let p = parentOf(groups, id); p; p = parentOf(groups, p.id)) chain.push(p.id);
    if (chain.length) setOpenIds((cur) => (chain.every((c) => cur.has(c)) ? cur : new Set([...cur, ...chain])));
    /* the row only exists once those containers have rendered */
    requestAnimationFrame(() => {
      const el = [...document.querySelectorAll<HTMLElement>("[data-part]")].find((x) => x.dataset.part === id);
      el?.scrollIntoView({ block: "nearest" });
    });
  }, [selectedIds, groups]);
  /* The drag is ours: rows never move while it runs, so a row you aim at stays put. The
   * places the rows stood when the drag began decide both the highlight and the drop. */
  const levels = useRef(new Map<string, LevelInfo>()).current;
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [draggingRow, setDraggingRow] = useState<string | null>(null);
  /* the kind of the part being carried: a text is taken by parts that write text of their own */
  const [carryingKind, setCarryingKind] = useState<string | null>(null);
  /** whether a drag is already running, so a double-click cannot start a second one */
  const dragOn = useRef(false);
  const openTimer = useRef<number | null>(null);
  /** What a dragged row stands for: the part itself, or every part of the run it stands for. */
  const droppedIds = (value: string): string[] => {
    const g = groups.find((x) => x.id === value);
    if (g) return g.items.map((it) => it.id);
    return findItemIn(groups.flatMap((x) => x.items), value) ? [value] : [];
  };
  const begin = (e: React.PointerEvent, value: string, part: string, holds: boolean) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    /* Every row is somewhere a drag can land — a panel inside a tab row is a container like any
       other — while only a reorderable row can be picked up. */
    const rows = [...document.querySelectorAll<HTMLElement>("[data-part]")].map((el) => ({
      value: el.dataset.value ?? "",
      part: el.dataset.part ?? "",
      level: el.dataset.level ?? "",
      holds: el.dataset.holds === "1",
      takesText: el.dataset.takesText === "1",
      top: el.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom,
    }));
    const mine = rows.find((r) => r.part === part);
    if (!mine) return;
    /* one drag at a time: a double-click on a row starts it twice, and the second pair of window
       listeners would fire a phantom reorder on some later click */
    if (dragOn.current) return;
    dragOn.current = true;
    const overAt = (y: number) => rows.find((r) => y >= r.top && y <= r.bottom && r.part !== part) ?? null;
    /* what the drag carries: a lone part, or every part of a run it stands for */
    const carried = droppedIds(part).map((id) => findItemIn(groups.flatMap((x) => x.items), id)).filter((it): it is Item => !!it);
    const text = carried.length > 0 && carried.every((it) => it.kind === "text");
    setDraggingRow(value);
    setCarryingKind(text ? "text" : (carried[0]?.kind ?? null));
    onDragging(true);
    const move = (ev: PointerEvent) => {
      const over = overAt(ev.clientY);
      setHoverId(over?.part ?? null);
      /* a holder the pointer rests on opens itself, so its parts can be aimed at */
      if (over?.holds) {
        if (openTimer.current) window.clearTimeout(openTimer.current);
        openTimer.current = window.setTimeout(() => setOpenIds((cur) => new Set(cur).add(over.part)), 420);
      } else if (openTimer.current) {
        window.clearTimeout(openTimer.current);
        openTimer.current = null;
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragOn.current = false;
      if (openTimer.current) window.clearTimeout(openTimer.current);
      openTimer.current = null;
      setHoverId(null);
      setDraggingRow(null);
      setCarryingKind(null);
      const over = overAt(ev.clientY);
      if (!over) return;
      /* Onto something that can hold it: that is the parent / child gesture. What is dropped is
         whatever the row stands for — a lone part, or every part of a run — so a container can be
         dropped into another one and take its own contents with it. */
      /* a part that writes text takes a dragged text into itself, the way a container takes anything */
      if ((over.holds || (text && over.takesText)) && over.part && over.part !== part) {
        const dropped = droppedIds(part);
        if (dropped.length) {
          onDropPart?.(dropped, over.part);
          return;
        }
      }
      /* anywhere else it is the ordinary reorder, inside the row's own level */
      const info = levels.get(mine.level);
      if (!info) return;
      const siblings = rows.filter((r) => r.level === mine.level && r.value !== value).sort((a, b) => a.top - b.top);
      const at = siblings.filter((r) => r.top < ev.clientY).length;
      const next = siblings.map((r) => r.value);
      next.splice(at, 0, value);
      if (next.join("|") !== info.values.join("|")) info.onReorder(next);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* the two lists: one per page, and the parts no page owns */
  const { byPage: groupsOf, loose } = useMemo(() => splitByPage(groups, frameIdOf), [groups, frameIdOf]);
  const [looseOpen, setLooseOpen] = useState(true);

  /** the runs hidden in a free group, front first, and the flat back-to-front list they make */
  const freeRuns = (g: Group) => [...explodeGroup(g, widths)].reverse();
  const flatten = (runsTopFirst: Group[]) => [...runsTopFirst].reverse().flatMap((r) => r.items.map((it) => it.id));

  const groupBody = (g: Group, depth: number) => {
    if (!g.free) {
      return <RunParts run={g} p={p} depth={depth} sel={sel} onSelect={onSelect} onReorder={(order) => onReorderItems(g.id, order)} onDragging={onDragging} openIds={openIds} toggle={toggle} onNest={onNest} onRename={onRename} onMagnify={onMagnify} magnifiedId={magnifiedId} hoverId={hoverId} onFree={onFreePart} onTabRename={onTabRename} />;
    }
    const runs = freeRuns(g);
    /* the key a run is known by in this level: a run of one is the part itself, so the
       drag values line up with the rows that are actually drawn */
    const keyOf = (r: Group) => (r.items.length > 1 ? r.id : r.items[0].id);
    const runIds = runs.map(keyOf);
    const byId = new Map(runs.map((r) => [keyOf(r), r]));
    const reorderRuns = (next: string[]) => onReorderItems(g.id, flatten(next.map((id) => byId.get(id)).filter((r): r is Group => !!r)));
    return (
      <Level levelKey={`runs:${g.id}`} values={runIds} onReorder={reorderRuns}>
        {runs.map((r) => {
          const many = r.items.length > 1;
          /* a run of one is the part itself: wrapping it in a second row would show the
             same name twice and hide what the part holds */
          if (!many) {
            return (
              <PartRow key={r.items[0].id} it={r.items[0]} p={p} depth={depth} sel={sel} onSelect={onSelect} onDragging={onDragging} openIds={openIds} toggle={toggle} reorderable onRename={onRename} onMagnify={onMagnify} magnifiedId={magnifiedId} onTabSelect={onTabSelect} onTabRename={onTabRename} />
            );
          }
          const open = openIds.has(r.id);
          return (
            <Row
              key={r.id}
              id={r.id}
              p={p}
              depth={depth}
              icon={r.items.slice(0, 3).map((it, k) => <Icon key={k} name={(KIND_SPEC[it.kind] ?? KIND_SPEC.box).paletteIcon} size={16} />)}
              label={runLabel(r, lang)}
              on={r.items.some((it) => sel.has(it.id))}
              onSelect={(add) => onSelect(r.items.map((it) => it.id), add)}
              open={open}
              onToggle={() => toggle(r.id)}
              onRename={onGroupRename ? (name) => onGroupRename(r.id, name) : undefined}
              onDragging={onDragging}
            >
              <RunParts
                run={r}
                p={p}
                depth={depth + 1}
                sel={sel}
                onSelect={onSelect}
                onDragging={onDragging}
                openIds={openIds}
                toggle={toggle}
                onRename={onRename}
                onMagnify={onMagnify}
                magnifiedId={magnifiedId}
                hoverId={hoverId}
                onReorder={(order) => {
                  /* the run's members take each other's places in the list; every other part keeps its own */
                  const members = new Set(r.items.map((it) => it.id));
                  let k = 0;
                  onReorderItems(
                    g.id,
                    g.items.map((it) => (members.has(it.id) ? order[k++] : it.id)),
                  );
                }}
              />
            </Row>
          );
        })}
      </Level>
    );
  };

  /**
   * One list of layers, top first. The canvas draws every group in the document, so the panel
   * has to list every group too: a row that is missing is a part the author cannot select,
   * rename or delete from here at all. Only the page in play is reorderable — another
   * page's rows, and the parts that belong to no page, are plain (a Reorder.Item without a
   * Reorder.Group around it is an error).
   */
  const groupRows = (list: Group[], levelKey: string | null) => {
    const topFirst = [...list].reverse();
    /* A group of one part is that part: showing both would repeat the same name twice
     * and make the author open a row to reach what it already says. The row the drag
     * sees is the part's own id in that case, so the level's values match the rows. */
    const single = (g: Group) => !g.free && g.items.length === 1;
    const keyOf = (g: Group) => (single(g) ? g.items[0].id : g.id);
    const byKey = new Map(topFirst.map((g) => [keyOf(g), g]));
    const reorderPage = (next: string[]) => onReorder(next.map((k) => byKey.get(k)?.id).filter((id): id is string => !!id));
    const rows = topFirst.map((g) => {
      if (single(g)) {
        const it = g.items[0];
        return (
          <PartRow
            key={g.id}
            it={it}
            p={p}
            depth={1}
            sel={sel}
            onSelect={onSelect}
            onDragging={onDragging}
            openIds={openIds}
            toggle={toggle}
            reorderable={!!levelKey}
            onNest={onNest}
            onRename={onRename}
            onMagnify={onMagnify}
            magnifiedId={magnifiedId}
            hoverId={hoverId}
            onFree={onFreePart}
            onTabSelect={onTabSelect}
            onTabRename={onTabRename}
          />
        );
      }
      const open = openIds.has(g.id);
      return (
        <Row
          key={g.id}
          id={g.id}
          p={p}
          depth={1}
          plain={!levelKey}
          icon={g.free ? <Icon name="group_work" size={18} /> : g.items.slice(0, 3).map((it, k) => <Icon key={k} name={(KIND_SPEC[it.kind] ?? KIND_SPEC.box).paletteIcon} size={18} />)}
          label={runLabel(g, lang)}
          on={g.items.some((it) => sel.has(it.id))}
          onSelect={(add) => onSelect(g.items.map((it) => it.id), add)}
          open={open}
          onToggle={() => toggle(g.id)}
          onRename={onGroupRename ? (name) => onGroupRename(g.id, name) : undefined}
          onDragging={onDragging}
        >
          {groupBody(g, 2)}
        </Row>
      );
    });
    if (!levelKey) return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{rows}</div>;
    return (
      <Level levelKey={levelKey} values={topFirst.map(keyOf)} onReorder={reorderPage}>
        {rows}
      </Level>
    );
  };

  /** the layers of one page, top first */
  const pageBody = (f: Frame) => {
    const list = groupsOf.get(f.id) ?? [];
    if (list.length === 0) {
      return (
        <>
          <div style={{ padding: "10px 12px 14px", color: p.outline, fontSize: 12 }}>
            <Icon name="layers_clear" size={24} />
            <div style={{ marginTop: 4 }}>{t("noLayers", lang)}</div>
          </div>
        </>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {groupRows(list, f.id === frameId ? `page:${f.id}` : null)}
      </div>
    );
  };

  return (
    <DndCtx.Provider value={{ levels, level: "", dragging: draggingRow, carrying: carryingKind, begin }}>
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* What the author types here looks through every page at once: a row's name, the words it
          says, its destinations and its kind. The list under it is the plain tree until they do. */}
      <div style={{ padding: "10px 10px 2px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ position: "relative", flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 12, display: "inline-flex", color: p.onSurfaceVariant, pointerEvents: "none" }}>
            <Icon name="search" size={18} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              /* Escape clears the field, Enter takes the first hit: the two things a search box
                 owes a keyboard, and the reason this is not the shared Field */
              if (e.key === "Escape") {
                e.stopPropagation();
                setQ("");
              }
              if (e.key === "Enter" && hits[0]) openHit(hits[0]);
            }}
            placeholder={t("searchLayers", lang)}
            aria-label={t("searchLayers", lang)}
            style={{ ...inputBox(p), width: "100%", height: 40, padding: `0 ${q ? 34 : 12}px 0 38px`, color: p.onSurface, fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              title={t("searchClear", lang)}
              className="m3-press"
              style={{ position: "absolute", right: 6, width: 26, height: 26, border: "none", borderRadius: 13, background: "transparent", color: p.onSurfaceVariant, cursor: "pointer", display: "grid", placeItems: "center" }}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </span>
      </div>
      <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "8px 10px 12px" }}>
        {searching ? (
          /* A search reaches across pages, so its rows are flat: the page a part lives on rides along
             as the badge, and picking a row opens that page and selects the part on it. */
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ padding: "2px 6px 4px", fontSize: 11, color: p.outline }}>{t("searchCount", lang).replace("{n}", String(hits.length))}</div>
            {hits.map((h) => (
              <Row
                key={h.itemId ?? `page:${h.frameId}`}
                id={h.itemId ? `hit:${h.itemId}` : `hitpage:${h.frameId}`}
                p={p}
                depth={0}
                plain
                icon={<Icon name={h.icon} size={18} />}
                label={h.label}
                badge={h.where || undefined}
                badgeTitle={h.where ? t("screen", lang) : undefined}
                tint={h.itemId === null && h.frameId ? pageTintOf(frames.find((f) => f.id === h.frameId)!, p) : undefined}
                on={h.itemId ? sel.has(h.itemId) : h.frameId === frameId}
                onSelect={() => openHit(h)}
                onDragging={onDragging}
              />
            ))}
            {hits.length === 0 && (
              <div style={{ padding: "18px 12px", textAlign: "center", color: p.outline, fontSize: 12 }}>
                <Icon name="search_off" size={28} />
                <div style={{ marginTop: 6 }}>{t("searchNoHit", lang).replace("{q}", q.trim())}</div>
              </div>
            )}
          </div>
        ) : frames.length === 0 && loose.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: p.outline, fontSize: 12 }}>
            <Icon name="layers_clear" size={32} />
            <div style={{ marginTop: 8 }}>{t("noLayers", lang)}</div>
          </div>
        ) : (
          /* the pages read as a list: open one to see the parts it holds */
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {frames.map((f) => {
              /* an overlay page shows its level where a part would show its layer, so the
                 page list says at a glance which pages pop over the others */
              const overlay = isOverlayFrame(f);
              return (
                <Row
                  key={f.id}
                  id={`page:${f.id}`}
                  p={p}
                  depth={0}
                  plain
                  icon={<Icon name={overlay ? "picture_in_picture_alt" : isPhoneFrame(f) ? "smartphone" : "desktop_windows"} size={18} />}
                  label={f.name || t("screen", lang)}
                  badge={overlay ? overlayLevelText(overlayLevelOfFrame(f), lang) : undefined}
                  badgeTitle={t("overlayLevel", lang)}
                  tint={pageTintOf(f, p)}
                  on={f.id === frameId}
                  /* picking a page makes it the page in play, so its layers open with it; the
                     chevron is what closes it again */
                  onSelect={() => {
                    setOpenFrames((cur) => new Set(cur).add(f.id));
                    onFrame(f.id);
                  }}
                  open={openFrames.has(f.id) ? true : undefined}
                  onToggle={() => toggleFrame(f.id)}
                  onRename={onFrameRename ? (name) => onFrameRename(f.id, name) : undefined}
                  onDragging={onDragging}
                >
                  {openFrames.has(f.id) && pageBody(f)}
                </Row>
              );
            })}
            {/* Parts the canvas draws but no page owns — dragged off a screen, or left behind by
                one that was resized. They are listed here because otherwise they would have no row
                at all, so there would be no way to select, move or delete them again. */}
            {loose.length > 0 && (
              <Row
                id="page:loose"
                p={p}
                depth={0}
                plain
                icon={<Icon name="open_with" size={18} />}
                label={t("offScreens", lang)}
                badge={String(loose.reduce((n, g) => n + g.items.length, 0))}
                badgeTitle={t("offScreens", lang)}
                on={loose.some((g) => g.items.some((it) => sel.has(it.id)))}
                onSelect={(add) => onSelect(loose.flatMap((g) => g.items.flatMap(subtreeOf).map((it) => it.id)), add)}
                open={looseOpen}
                onToggle={() => setLooseOpen((v) => !v)}
                onDragging={onDragging}
              >
                {looseOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ padding: "2px 12px 4px", fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("offScreensHint", lang)}</div>
                    {groupRows(loose, null)}
                  </div>
                )}
              </Row>
            )}
          </div>
        )}
      </div>
    </div>
    </DndCtx.Provider>
  );
}
