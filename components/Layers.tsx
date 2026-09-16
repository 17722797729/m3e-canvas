"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Frame, Group, Item, KIND_SPEC, LAYER_DEFAULT, Palette, byLayer, explodeGroup, isPhoneFrame, layerOf } from "@/lib/tokens";
import { contrastRatio } from "@/lib/color";
import { Icon } from "./M3Node";
import { Lang, KIND_TEXT, t, useLang } from "@/lib/i18n";

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
  return it.label.trim() || (it.kind === "iconButton" || it.kind === "fab" ? (it.icon ?? noun) : noun);
}

function runLabel(g: Group, lang: Lang) {
  /* a group the editor made for itself says so by name */
  if (g.name) return g.name;
  const first = g.items[0];
  const noun = KIND_TEXT[lang][first.kind]?.noun ?? (KIND_SPEC[first.kind] ?? KIND_SPEC.box).label;
  return g.free ? `${t("group", lang)} × ${g.items.length}` : g.items.length > 1 ? `${noun} × ${g.items.length}` : nameOf(first, lang);
}

/** the level a part draws at, shown only when the author moved it off the default */
const badgeOf = (it: Item) => {
  const z = layerOf(it);
  return z === LAYER_DEFAULT ? undefined : String(z);
};

/** One level's order and the way it wants a new one, plus the running drag. */
type LevelInfo = { values: string[]; onReorder: (next: string[]) => void };
type Dnd = {
  levels: Map<string, LevelInfo>;
  level: string;
  dragging: string | null;
  begin: (e: React.PointerEvent, value: string, part: string, holds: boolean) => void;
};
const DndCtx = createContext<Dnd>({ levels: new Map(), level: "", dragging: null, begin: () => {} });

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
  locked,
  onLock,
  onDragging,
  badge,
  plain,
  onNest,
  holds,
  hover,
  onFree,
  inContainer,
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
  /** the group's lock, so the row shows which state it is in */
  locked?: boolean;
  /** flips the group's lock; set only on a whole group's row */
  onLock?: () => void;
  onDragging: (dragging: boolean, id?: string) => void;
  /** the part's own layer, when it is not the default */
  badge?: string;
  /** a row that is not reorderable (a page, or a part inside a container) */
  plain?: boolean;
  /** asks to put this row's part inside a container on the same screen */
  onNest?: () => void;
  /** takes this row's part out of its container */
  onFree?: () => void;
  /** this row is a container's own child */
  inContainer?: boolean;
  /** this row's part can hold others (a container, or a bar with buttons) */
  holds?: boolean;
  /** a drag is hovering this row: it lights up, and a holder opens to receive */
  hover?: boolean;
  children?: ReactNode;
}) {
  const lang = useLang();
  /* the row's own background decides what its icons and label can be seen in: a custom
     scheme can put a dark surface under a light one, and icons must still read */
  const bg = hover ? (holds ? p.tertiaryContainer : p.surfaceContainerHigh) : on ? p.secondaryContainer : depth === 0 ? p.surfaceContainerLow : p.surface;
  const ink = (want: string) => (contrastRatio(want, bg) >= 3 ? want : contrastRatio(p.onSurface, bg) >= contrastRatio(p.onSurfaceVariant, bg) ? p.onSurface : p.onSurfaceVariant);
  const dnd = useContext(DndCtx);
  const draggable = !plain;
  const h = depth === 0 ? 40 : 36;
  const body = (
    <div
      {...(draggable ? { "data-value": id, "data-level": dnd.level, "data-part": id, "data-holds": holds ? "1" : undefined } : { "data-part": id, "data-holds": holds ? "1" : undefined })}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: h,
        padding: "0 6px 0 2px",
        marginLeft: depth * 14,
        borderRadius: depth === 0 ? 14 : 12,
        background: hover ? (holds ? p.tertiaryContainer : p.surfaceContainerHigh) : on ? p.secondaryContainer : depth === 0 ? p.surfaceContainerLow : p.surface,
        color: hover ? (holds ? p.onTertiaryContainer : p.onSurface) : on ? p.onSecondaryContainer : ink(p.onSurface),
        outline: hover && holds ? `2px solid ${p.primary}` : undefined,
        outlineOffset: hover && holds ? 1 : undefined,
        opacity: dnd.dragging === id ? 0.45 : 1,
        userSelect: "none",
        touchAction: draggable ? "none" : undefined,
      }}
    >
      {plain ? (
        <span style={{ width: depth === 0 ? 24 : 20, height: h, flex: "0 0 auto" }} />
      ) : (
        <span
          onPointerDown={(e) => {
            dnd.begin(e, id, id, !!holds);
          }}
          style={{ cursor: "grab", color: ink(p.outline), display: "grid", placeItems: "center", width: depth === 0 ? 24 : 20, height: h, touchAction: "none", flex: "0 0 auto" }}
        >
          <Icon name="drag_indicator" size={18} />
        </span>
      )}
      <button
        onPointerDown={draggable ? (e) => dnd.begin(e, id, id, !!holds) : undefined}
        onClick={(e) => onSelect(e.shiftKey)}
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
            title={t("layer", lang)}
            style={{ marginLeft: "auto", flex: "0 0 auto", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: on ? p.onSecondaryContainer : p.surfaceContainerHigh, color: on ? p.secondaryContainer : p.onSurfaceVariant }}
          >
            {badge}
          </span>
        )}
      </button>
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
      {onLock && (
        <button
          onClick={onLock}
          title={t(locked ? "unlock" : "lock", lang)}
          aria-label={t(locked ? "unlock" : "lock", lang)}
          aria-pressed={!!locked}
          className="m3-press"
          style={{ width: 28, height: 28, borderRadius: 14, border: "none", background: "transparent", color: locked ? (on ? p.onSecondaryContainer : ink(p.primary)) : ink(p.outline), cursor: "pointer", padding: 0, display: "grid", placeItems: "center", flex: "0 0 auto" }}
        >
          <Icon name={locked ? "lock" : "lock_open"} size={20} fill={locked} />
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
  locked,
  onLock,
  onNest,
  hoverId,
  onFree,
  inContainer,
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
  /** the lock of the group the part stands for, when it is shown in the group's place */
  locked?: boolean;
  onLock?: () => void;
  /** asks to put this part inside one of the screen's containers */
  onNest?: (it: Item) => void;
  /** takes this part out of its container */
  onFree?: (itemId: string) => void;
  /** the row a drag is hovering */
  hoverId?: string | null;
  /** this part is a container's own child, so it offers the way out */
  inContainer?: boolean;
}) {
  const lang = useLang();
  const kids = [...(it.children ?? [])].sort(byLayer).reverse();
  /* a bar's destinations are buttons of their own: they belong under it in the tree */
  const slots = (it.tabs ?? []).map((t, i) => ({ key: `tab:${i}`, icon: t.icon, label: t.label }));
  /* anything with room inside can take a dropped part */
  const holds = it.kind === "box" || slots.length > 0 || (it.children?.length ?? 0) > 0;
  const open = (kids.length > 0 || slots.length > 0) && openIds.has(it.id);
  return (
    <Row
      id={it.id}
      p={p}
      depth={depth}
      plain={!reorderable}
      icon={<Icon name={(KIND_SPEC[it.kind] ?? KIND_SPEC.box).paletteIcon} size={16} />}
      label={nameOf(it, lang)}
      badge={badgeOf(it)}
      on={sel.has(it.id)}
      onSelect={(add) => onSelect([it.id], add)}
      open={kids.length || slots.length ? open : undefined}
      onToggle={kids.length || slots.length ? () => toggle(it.id) : undefined}
      onDragging={onDragging}
      locked={locked}
      onLock={onLock}
      onNest={onNest ? () => onNest(it) : undefined}
      onFree={onFree ? () => onFree(it.id) : undefined}
      inContainer={inContainer}
      holds={holds}
      hover={hoverId === it.id}
    >
      {kids.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {kids.map((c) => (
            <PartRow key={c.id} it={c} p={p} depth={depth + 1} sel={sel} onSelect={onSelect} onDragging={onDragging} openIds={openIds} toggle={toggle} hoverId={hoverId} onFree={onFree} inContainer />
          ))}
        </div>
      )}
      {/* the bar's own buttons, each with the icon and words it shows on the canvas */}
      {slots.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {slots.map((sl) => (
            <Row
              key={sl.key}
              id={`${it.id}:${sl.key}`}
              p={p}
              depth={depth + 1}
              plain
              icon={<Icon name={sl.icon || "radio_button_unchecked"} size={16} />}
              label={sl.label.trim() || sl.key}
              on={false}
              onSelect={() => onSelect([it.id], false)}
              onDragging={onDragging}
            />
          ))}
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
  hoverId,
  onFree,
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
}) {
  const ids = run.items.map((it) => it.id);
  return (
    <Level levelKey={`parts:${run.id}`} values={ids} onReorder={onReorder}>
      {run.items.map((it) => (
        <PartRow key={it.id} it={it} p={p} depth={depth} sel={sel} onSelect={onSelect} onDragging={onDragging} openIds={openIds} toggle={toggle} reorderable onNest={onNest} hoverId={hoverId} onFree={onFree} />
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
  onToggleLock,
  onReorderItems,
  onDragging,
  onNest,
  onDropPart,
  onFreePart,
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
  /** flips a group's lock from its row's lock icon */
  onToggleLock: (groupId: string) => void;
  /** a group's parts in a new order: back to front for a free group, reading order for a run */
  onReorderItems: (groupId: string, ids: string[]) => void;
  /** a drag on any level starting or ending, so the page can record one undo step for the whole drag */
  onDragging: (dragging: boolean) => void;
  /** a part was dropped onto another one: make it a child when the drop asks for it */
  onDropPart?: (itemId: string, targetId: string) => void;
  /** asks to put one part inside a container on the same screen */
  onNest?: (it: Item) => void;
  /** takes one part out of the container that holds it */
  onFreePart?: (itemId: string) => void;
}) {
  const lang = useLang();
  const sel = new Set(selectedIds);
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
  /* The drag is ours: rows never move while it runs, so a row you aim at stays put. The
   * places the rows stood when the drag began decide both the highlight and the drop. */
  const levels = useRef(new Map<string, LevelInfo>()).current;
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [draggingRow, setDraggingRow] = useState<string | null>(null);
  const openTimer = useRef<number | null>(null);
  const begin = (e: React.PointerEvent, value: string, part: string, holds: boolean) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rows = [...document.querySelectorAll<HTMLElement>("[data-value]")].map((el) => ({
      value: el.dataset.value ?? "",
      part: el.dataset.part ?? "",
      level: el.dataset.level ?? "",
      holds: el.dataset.holds === "1",
      top: el.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom,
    }));
    const mine = rows.find((r) => r.value === value);
    if (!mine) return;
    const overAt = (y: number) => rows.find((r) => y >= r.top && y <= r.bottom && r.value !== value) ?? null;
    setDraggingRow(value);
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
      if (openTimer.current) window.clearTimeout(openTimer.current);
      openTimer.current = null;
      setHoverId(null);
      setDraggingRow(null);
      const over = overAt(ev.clientY);
      if (!over) return;
      /* onto something that can hold it: that is the parent / child gesture */
      if (over.holds && over.part && over.part !== part && !holds) {
        onDropPart?.(part, over.part);
        return;
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

  const groupsOf = useMemo(() => {
    const map = new Map<string, Group[]>();
    for (const g of groups) {
      const id = frameIdOf(g.id);
      if (!id) continue;
      const list = map.get(id);
      if (list) list.push(g);
      else map.set(id, [g]);
    }
    return map;
  }, [groups, frameIdOf]);

  /** the runs hidden in a free group, front first, and the flat back-to-front list they make */
  const freeRuns = (g: Group) => [...explodeGroup(g, widths)].reverse();
  const flatten = (runsTopFirst: Group[]) => [...runsTopFirst].reverse().flatMap((r) => r.items.map((it) => it.id));

  const groupBody = (g: Group, depth: number) => {
    if (!g.free) {
      return <RunParts run={g} p={p} depth={depth} sel={sel} onSelect={onSelect} onReorder={(order) => onReorderItems(g.id, order)} onDragging={onDragging} openIds={openIds} toggle={toggle} onNest={onNest} hoverId={hoverId} onFree={onFreePart} />;
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
              <PartRow key={r.items[0].id} it={r.items[0]} p={p} depth={depth} sel={sel} onSelect={onSelect} onDragging={onDragging} openIds={openIds} toggle={toggle} reorderable />
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

  /** the layers of one page, top first; only the page in play is reorderable */
  const pageBody = (f: Frame) => {
    const list = groupsOf.get(f.id) ?? [];
    if (list.length === 0) {
      return (
        <div style={{ padding: "10px 12px 14px", color: p.outline, fontSize: 12 }}>
          <Icon name="layers_clear" size={24} />
          <div style={{ marginTop: 4 }}>{t("noLayers", lang)}</div>
        </div>
      );
    }
    const topFirst = [...list].reverse();
    /* only the open page is reorderable: another page's rows are plain, since a
     * Reorder.Item without a Reorder.Group around it is an error */
    const reorderable = f.id === frameId;
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
            reorderable={reorderable}
            locked={g.locked}
            onLock={() => onToggleLock(g.id)}
            onNest={onNest}
            hoverId={hoverId}
            onFree={onFreePart}
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
          plain={!reorderable}
          icon={g.free ? <Icon name="group_work" size={18} /> : g.items.slice(0, 3).map((it, k) => <Icon key={k} name={(KIND_SPEC[it.kind] ?? KIND_SPEC.box).paletteIcon} size={18} />)}
          label={runLabel(g, lang)}
          on={g.items.some((it) => sel.has(it.id))}
          onSelect={(add) => onSelect(g.items.map((it) => it.id), add)}
          open={open}
          onToggle={() => toggle(g.id)}
          locked={g.locked}
          onLock={() => onToggleLock(g.id)}
          onDragging={onDragging}
        >
          {groupBody(g, 2)}
        </Row>
      );
    });
    if (!reorderable) return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{rows}</div>;
    return (
      <Level levelKey={`page:${f.id}`} values={topFirst.map(keyOf)} onReorder={reorderPage}>
        {rows}
      </Level>
    );
  };

  return (
    <DndCtx.Provider value={{ levels, level: "", dragging: draggingRow, begin }}>
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "8px 10px 12px" }}>
        {frames.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: p.outline, fontSize: 12 }}>
            <Icon name="layers_clear" size={32} />
            <div style={{ marginTop: 8 }}>{t("noLayers", lang)}</div>
          </div>
        ) : (
          /* the pages read as a list: open one to see the parts it holds */
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {frames.map((f) => (
              <Row
                key={f.id}
                id={`page:${f.id}`}
                p={p}
                depth={0}
                plain
                icon={<Icon name={isPhoneFrame(f) ? "smartphone" : "desktop_windows"} size={18} />}
                label={f.name || t("screen", lang)}
                on={f.id === frameId}
                onSelect={() => onFrame(f.id)}
                open={openFrames.has(f.id) ? true : undefined}
                onToggle={() => toggleFrame(f.id)}
                onDragging={onDragging}
              >
                {openFrames.has(f.id) && pageBody(f)}
              </Row>
            ))}
          </div>
        )}
      </div>
    </div>
    </DndCtx.Provider>
  );
}
