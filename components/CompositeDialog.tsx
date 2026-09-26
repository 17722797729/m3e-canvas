"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, CustomPart, Item, KIND_ORDER, KIND_SPEC, Kind, MEASURED, Palette, PlacedItem, byLayer, makeItem, sizeOf } from "@/lib/tokens";
import { KIND_TEXT, t, useLang } from "@/lib/i18n";
import { Icon, M3Node, MeasuredContent } from "./M3Node";
import { Field, IconBtn } from "./ui";

/* The compose dialog: a small canvas of its own, with every part kind a tap away.
 * Parts are added, dragged and resized in place; what is left when the author presses
 * "Done" becomes a composite part the palette offers beside the kinds. Opened on a
 * saved composite it changes that one instead of making a new one. */

const H = 260;
const PAD = 12;
/** where the next added part lands, stepping along so parts do not stack up */
const SPOT_STEP = 24;
const MIN_W = 24;
const MIN_H = 16;

const CATEGORY_TEXT = {
  ja: { actions: "操作", navigation: "ナビゲーション", containment: "コンテナ", inputs: "入力", content: "コンテンツ", progress: "進捗", features: "追加機能" },
  zh: { actions: "操作", navigation: "导航", containment: "容器", inputs: "输入", content: "内容", progress: "进度", features: "新增功能" },
  ko: { actions: "동작", navigation: "내비게이션", containment: "컨테이너", inputs: "입력", content: "콘텐츠", progress: "진행 상태", features: "추가 기능" },
} satisfies Record<string, Record<string, string>>;

/** which sides of a part actually move when its width or height is set: a button's
 *  height is fixed by its kind, while a box takes both */
function grows(it: Item, widths: Record<string, number>): { w: boolean; h: boolean } {
  const base = sizeOf(it, widths);
  return {
    w: sizeOf({ ...it, size: (it.size ?? base.w) + 10 }, widths).w > base.w,
    h: sizeOf({ ...it, size2: (it.size2 ?? base.h) + 10 }, widths).h > base.h,
  };
}

export function CompositeDialog({
  p,
  initial,
  editing = null,
  onCancel,
  onDone,
}: {
  p: Palette;
  /** the parts the author already had selected, offered as a starting point */
  initial: PlacedItem[] | null;
  /** the saved composite being changed, if any */
  editing?: CustomPart | null;
  onCancel: () => void;
  onDone: (part: Omit<CustomPart, "id">) => void;
}) {
  const lang = useLang();
  const [items, setItems] = useState<PlacedItem[]>(() => (editing ? editing.items.map((it) => ({ ...it })) : initial ?? []));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(editing?.name ?? "");
  const [query, setQuery] = useState("");
  const canvasRef = useRef<HTMLDivElement | null>(null);
  /* Text-sized kinds are measured from the real DOM here too, so a part composed here
   * looks on the canvas exactly as it looked while it was being put together. */
  const [widths, setWidths] = useState<Record<string, number>>({});
  const measureEls = useRef(new Map<string, HTMLDivElement>());
  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    measureEls.current.forEach((el, id) => {
      next[id] = Math.ceil(el.getBoundingClientRect().width);
    });
    const keys = Object.keys(next);
    const changed = keys.length !== Object.keys(widths).length || keys.some((k) => widths[k] !== next[k]);
    if (changed) setWidths(next);
  });

  const labelOf = (k: Kind) => (lang === "en" ? KIND_SPEC[k].label : KIND_TEXT[lang][k]?.noun ?? KIND_SPEC[k].label);

  /** The drawing area's live size. The dialog is as wide as the window allows, so the
   *  clamp has to come from the element itself — a constant here would leave a part
   *  unable to reach the right-hand side of the canvas. */
  const area = () => {
    const el = canvasRef.current;
    return { w: el?.clientWidth ?? 360, h: el?.clientHeight ?? H };
  };

  const kinds = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return KIND_ORDER;
    return KIND_ORDER.filter((k) => labelOf(k).toLowerCase().includes(s) || KIND_SPEC[k].label.toLowerCase().includes(s) || k.toLowerCase().includes(s));
  }, [query, lang]);

  /** one gesture: move events on the window until the pointer comes up */
  const follow = (onMove: (ev: PointerEvent) => void) => {
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  /** adds a fresh part, stepping each one along so it does not land on the last */
  const add = (kind: Kind) => {
    if (items.length >= 24) return;
    const it = makeItem(kind);
    const sz = sizeOf(it, widths);
    const box = area();
    const step = items.length % 6;
    const placed: PlacedItem = {
      ...it,
      x: Math.round(Math.max(PAD, Math.min(Math.max(PAD, box.w - PAD - sz.w), PAD + step * SPOT_STEP + (items.length % 3) * 8))),
      y: Math.round(Math.max(PAD, Math.min(Math.max(PAD, box.h - PAD - sz.h), PAD + step * SPOT_STEP))),
    };
    setItems((cur) => [...cur, placed]);
    setSelectedId(placed.id);
  };

  const beginDrag = (e: React.PointerEvent, it: PlacedItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(it.id);
    const sz = sizeOf(it, widths);
    const start = { sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y };
    follow((ev) => {
      const box = area();
      const nx = Math.round(Math.min(Math.max(0, box.w - sz.w), Math.max(0, start.ox + (ev.clientX - start.sx))));
      const ny = Math.round(Math.min(Math.max(0, box.h - sz.h), Math.max(0, start.oy + (ev.clientY - start.sy))));
      setItems((cur) => cur.map((c) => (c.id === it.id ? { ...c, x: nx, y: ny } : c)));
    });
  };

  /** the bottom-right grip: the part takes the width and height its kind allows */
  const beginResize = (e: React.PointerEvent, it: PlacedItem) => {
    e.preventDefault();
    e.stopPropagation();
    const axes = grows(it, widths);
    const base = sizeOf(it, widths);
    const start = { sx: e.clientX, sy: e.clientY, w: it.size ?? base.w, h: it.size2 ?? base.h };
    follow((ev) => {
      const dw = ev.clientX - start.sx;
      const dh = ev.clientY - start.sy;
      setItems((cur) =>
        cur.map((c) =>
          c.id === it.id
            ? {
                ...c,
                ...(axes.w ? { size: Math.max(MIN_W, Math.round(start.w + dw)) } : undefined),
                ...(axes.h ? { size2: Math.max(MIN_H, Math.round(start.h + dh)) } : undefined),
              }
            : c,
        ),
      );
    });
  };

  /** what the author made, normalized to its own bounding box and a margin */
  const finished = () => {
    if (items.length === 0) return;
    const l = Math.min(...items.map((it) => it.x));
    const top = Math.min(...items.map((it) => it.y));
    const r = Math.max(...items.map((it) => it.x + sizeOf(it, widths).w));
    const b = Math.max(...items.map((it) => it.y + sizeOf(it, widths).h));
    onDone({
      name: name.trim() || t("composite", lang),
      w: Math.round(r - l + PAD * 2),
      h: Math.round(b - top + PAD * 2),
      items: [...items].sort(byLayer).map((it) => ({ ...it, x: Math.round(it.x - l + PAD), y: Math.round(it.y - top + PAD) })),
    });
  };

  const selected = items.find((it) => it.id === selectedId) ?? null;

  return (
    <>
      {/* the hidden layer that measures text-sized parts, so the dialog and the canvas agree */}
      <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, visibility: "hidden", pointerEvents: "none" }}>
        {items
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
                border: it.variant === "outlined" && (it.kind === "button" || it.kind === "chip" || it.kind === "extendedFab") ? "1px solid transparent" : "none",
              }}
            >
              <MeasuredContent item={it} p={p} />
            </div>
          ))}
      </div>
    <div
      role="dialog"
      aria-label={editing ? t("editComposite", lang) : t("composeNew", lang)}
      style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.38)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={{ width: "min(620px, 94vw)", maxHeight: "94vh", display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 28, background: p.surfaceContainerHigh, color: p.onSurface, boxShadow: "0 8px 30px rgba(0,0,0,0.30)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="widgets" size={22} />
          <span style={{ fontSize: 16, fontWeight: 700, flex: 1, minWidth: 0 }}>{editing ? t("editComposite", lang) : t("composeNew", lang)}</span>
          <IconBtn icon="close" p={p} onClick={onCancel} title={t("cancel", lang)} size={40} />
        </div>

        <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant }}>{t("composeHint", lang)}</div>

        <Field value={name} onChange={setName} placeholder={t("compositeName", lang)} p={p} icon="label" height={44} />

        {/* the small canvas the author builds on */}
        <div
          ref={canvasRef}
          style={{ position: "relative", width: "100%", height: H, borderRadius: 20, background: p.surface, border: `1px solid ${p.outlineVariant}`, overflow: "hidden" }}
          onPointerDown={() => setSelectedId(null)}
        >
          {items.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: p.outline, fontSize: 12, textAlign: "center", padding: 20, pointerEvents: "none" }}>
              {t("composeEmpty", lang)}
            </div>
          )}
          {[...items].sort(byLayer).map((it) => {
            const axes = grows(it, widths);
            return (
              <div
                key={it.id}
                onPointerDown={(e) => beginDrag(e, it)}
                style={{
                  position: "absolute",
                  /* a flex box, like the canvas and the preview: a part that lays itself out inline
                     would otherwise be pushed down by the line box a block parent makes */
                  display: "flex",
                  left: it.x,
                  top: it.y,
                  cursor: "grab",
                  outline: selectedId === it.id ? `2px solid ${p.primary}` : "2px solid transparent",
                  outlineOffset: 2,
                  borderRadius: 8,
                }}
              >
                <M3Node item={it} palette={p} widths={widths} interactive={false} />
                {selectedId === it.id && (axes.w || axes.h) && (
                  <span
                    onPointerDown={(e) => beginResize(e, it)}
                    title={t("resizePart", lang)}
                    style={{
                      position: "absolute",
                      right: -1,
                      bottom: -1,
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: p.primary,
                      border: `2px solid ${p.surface}`,
                      cursor: axes.w && axes.h ? "nwse-resize" : axes.w ? "ew-resize" : "ns-resize",
                      touchAction: "none",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 10px", borderRadius: 16, background: p.surfaceContainerLow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.label.trim() || labelOf(selected.kind)} · {sizeOf(selected, widths).w}×{sizeOf(selected, widths).h}
            </span>
            <IconBtn
              icon="flip_to_front"
              p={p}
              size={36}
              title={t("bringForward", lang)}
              onClick={() => setItems((cur) => cur.map((it) => (it.id === selected.id ? { ...it, z: (it.z ?? 10) + 1 } : it)))}
            />
            <IconBtn
              icon="flip_to_back"
              p={p}
              size={36}
              title={t("sendBackward", lang)}
              onClick={() => setItems((cur) => cur.map((it) => (it.id === selected.id ? { ...it, z: Math.max(0, (it.z ?? 10) - 1) } : it)))}
            />
            <IconBtn icon="delete" p={p} size={36} danger title={t("delete", lang)} onClick={() => { setItems((cur) => cur.filter((it) => it.id !== selected.id)); setSelectedId(null); }} />
            </div>
            {/* the words the part shows are edited right here */}
            <Field
              value={selected.label}
              onChange={(label) => setItems((cur) => cur.map((it) => (it.id === selected.id ? { ...it, label } : it)))}
              placeholder={t("label", lang)}
              p={p}
              icon="title"
              height={40}
            />
          </div>
        )}

        {/* every kind, one tap from the canvas */}
        <Field value={query} onChange={setQuery} placeholder={t("search", lang)} p={p} icon="search" height={40} />
        <div className="no-scrollbar" style={{ maxHeight: 168, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {query
            ? [
                <div key="flat" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 6 }}>
                  {kinds.map((k) => addTile(k))}
                </div>,
              ]
            : CATEGORIES.map((c) => (
                <div key={c.key}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: p.onSurfaceVariant, margin: "2px 0 6px" }}>{lang === "en" ? c.label : CATEGORY_TEXT[lang][c.key]}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 6 }}>
                    {KIND_ORDER.filter((k) => KIND_SPEC[k].category === c.key).map((k) => addTile(k))}
                  </div>
                </div>
              ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} className="m3-press" style={{ height: 40, padding: "0 18px", borderRadius: 20, border: `1px solid ${p.outline}`, background: "transparent", color: p.primary, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {t("cancel", lang)}
          </button>
          <button
            onClick={finished}
            disabled={items.length === 0}
            className="m3-press"
            style={{ height: 40, padding: "0 18px", borderRadius: 20, border: "none", background: items.length ? p.primary : p.surfaceContainerHighest, color: items.length ? p.onPrimary : p.outline, fontSize: 14, fontWeight: 600, cursor: items.length ? "pointer" : "default" }}
          >
            {t("composeDone", lang)}
          </button>
        </div>
      </div>
    </div>
    </>
  );

  /** one kind in the picker: tapping it drops that part onto the small canvas */
  function addTile(k: Kind) {
    return (
      <button
        key={k}
        onClick={() => add(k)}
        className="m3-press"
        title={labelOf(k)}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", borderRadius: 14, border: "none", background: p.surfaceContainerLow, color: p.onSurface, cursor: "pointer" }}
      >
        <Icon name={KIND_SPEC[k].paletteIcon} size={20} />
        <span style={{ fontSize: 10, lineHeight: 1.2, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{labelOf(k)}</span>
      </button>
    );
  }
}
