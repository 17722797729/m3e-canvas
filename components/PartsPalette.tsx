"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, CustomPart, KIND_ORDER, KIND_SPEC, Category, Kind, Palette } from "@/lib/tokens";
import { Icon } from "./M3Node";
import { KIND_TEXT, t, useLang } from "@/lib/i18n";
import { Field, Section, Tile } from "./ui";

const CATEGORY_TEXT = {
  ja: { actions: "操作", navigation: "ナビゲーション", containment: "コンテナ", inputs: "入力", content: "コンテンツ", progress: "進捗", features: "機能" },
  zh: { actions: "操作", navigation: "导航", containment: "容器", inputs: "输入", content: "内容", progress: "进度", features: "功能" },
  ko: { actions: "동작", navigation: "내비게이션", containment: "컨테이너", inputs: "입력", content: "콘텐츠", progress: "진행 상태", features: "기능" },
} satisfies Record<string, Record<Category, string>>;

export function PartsPalette({
  palette: p,
  favorites,
  customParts = [],
  onToggleFavorite,
  onPartPointerDown,
  onCompositePointerDown,
  onNewComposite,
  onEditComposite,
  onDeleteComposite,
}: {
  palette: Palette;
  favorites: Kind[];
  /** the author's own composite parts, ready to drop onto a screen */
  customParts?: CustomPart[];
  onToggleFavorite: (k: Kind) => void;
  onPartPointerDown: (e: React.PointerEvent, kind: Kind) => void;
  /** starts dragging one saved composite onto the canvas */
  onCompositePointerDown?: (e: React.PointerEvent, part: CustomPart) => void;
  /** opens the dialog that composes a new one */
  onNewComposite?: () => void;
  /** opens the dialog on a saved composite, to change it */
  onEditComposite?: (part: CustomPart) => void;
  /** drops a saved composite from the palette */
  onDeleteComposite?: (part: CustomPart) => void;
}) {
  const lang = useLang();
  const [q, setQ] = useState("");
  const labelOf = (k: Kind) => lang === "en" ? KIND_SPEC[k].label : KIND_TEXT[lang][k]?.noun ?? KIND_SPEC[k].label;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return KIND_ORDER;
    return KIND_ORDER.filter((k) => {
      const sp = KIND_SPEC[k];
      return labelOf(k).toLowerCase().includes(s) || sp.label.toLowerCase().includes(s) || sp.noun.includes(s) || k.toLowerCase().includes(s);
    });
  }, [q, lang]);

  const tile = (k: Kind) => {
    const s = KIND_SPEC[k];
    return (
      <Tile
        key={k}
        icon={s.paletteIcon}
        label={labelOf(k)}
        p={p}
        onPointerDown={(e) => onPartPointerDown(e, k)}
        starred={favorites.includes(k)}
        onStar={() => onToggleFavorite(k)}
      />
    );
  };

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))",
    gap: 6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <div style={{ padding: "12px 12px 8px" }}>
        <Field value={q} onChange={setQ} placeholder={t("search", lang)} p={p} icon="search" height={40} />
      </div>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 8px" }}>
        {!q && favorites.length > 0 && (
          <Section id="fav" icon="star" title={t("favorites", lang)} p={p}>
            <div style={grid}>{favorites.filter((k) => KIND_SPEC[k]).map(tile)}</div>
          </Section>
        )}
        {!q && (
          /* the author's own sets of parts: compose one, then drop it as often as you like */
          <Section id="composite" icon="widgets" title={t("composites", lang)} p={p}>
            <div style={grid}>
              {onNewComposite && (
                <Tile
                  key="__new"
                  icon="add_box"
                  label={t("composeNew", lang)}
                  p={p}
                  onClick={onNewComposite}
                />
              )}
              {customParts.map((part) => (
                /* a saved composite: drag the body to use it, the corner buttons change it */
                <div key={part.id} style={{ position: "relative" }}>
                  <Tile
                    icon="dashboard_customize"
                    label={part.name || t("composite", lang)}
                    p={p}
                    onPointerDown={onCompositePointerDown ? (e) => onCompositePointerDown(e, part) : undefined}
                  />
                  <span style={{ position: "absolute", top: 2, right: 2, display: "flex", gap: 2 }}>
                    {onEditComposite && (
                      <button
                        onClick={() => onEditComposite(part)}
                        title={t("editComposite", lang)}
                        aria-label={t("editComposite", lang)}
                        className="m3-press"
                        style={{ width: 22, height: 22, borderRadius: 11, border: "none", padding: 0, background: p.surfaceContainerHighest, color: p.onSurfaceVariant, cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                    )}
                    {onDeleteComposite && (
                      <button
                        onClick={() => onDeleteComposite(part)}
                        title={t("deleteComposite", lang)}
                        aria-label={t("deleteComposite", lang)}
                        className="m3-press"
                        style={{ width: 22, height: 22, borderRadius: 11, border: "none", padding: 0, background: p.errorContainer, color: p.onErrorContainer, cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <Icon name="delete" size={14} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
        {q ? (
          <div style={{ ...grid, padding: "4px 4px 12px" }}>
            {filtered.map(tile)}
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", color: p.outline, fontSize: 13, padding: 12, textAlign: "center" }}>
                <Icon name="search_off" size={28} />
              </div>
            )}
          </div>
        ) : (
          CATEGORIES.map((c) => (
            <Section key={c.key} id={`cat:${c.key}`} icon={c.icon} title={lang === "en" ? c.label : CATEGORY_TEXT[lang][c.key]} p={p}>
              <div style={grid}>{KIND_ORDER.filter((k) => KIND_SPEC[k].category === c.key).map(tile)}</div>
            </Section>
          ))
        )}
      </div>

    </div>
  );
}
