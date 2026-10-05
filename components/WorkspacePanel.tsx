"use client";

import { Palette, Theme } from "@/lib/tokens";
import { t, useLang } from "@/lib/i18n";
import { CanvasState, canvasLabel, isBuiltinCanvas } from "@/lib/canvases";
import { Icon } from "./M3Node";

/**
 * 工作区
 * ---------------------------------------------------------------------------
 * 「工作区」就是**当前画布**本身：正在画的那一份文档。
 *
 * 它不列屏幕清单（那是一份画布内部的事，归画布上的屏幕标签与图层面板管），
 * 管的是"我在哪一份画布上、还能去哪一份"：
 *   · 当前画布是哪一份；
 *   · 新建一个空白画布；
 *   · 去模板页签拿一整套；
 *   · 切到已经开着的另一份画布。
 */
export function WorkspacePanel({
  p,
  theme,
  canvases,
  currentName,
  onNewCanvas,
  onParts,
  onFlow,
  onSwitch,
  onRename,
  onDelete,
}: {
  p: Palette;
  theme?: Theme;
  /** 打开的几份画布 */
  canvases: CanvasState;
  /** 当前这一份的名字（文档标题） */
  currentName: string;
  onNewCanvas: () => void;
  onParts: () => void;
  onFlow?: () => void;
  onSwitch: (id: string) => void;
  /** 给这一份画布改名 / 删掉它 */
  onRename: () => void;
  onDelete: () => void;
}) {
  const lang = useLang();
  const current = canvases.list.find((c) => c.id === canvases.activeId);
  const shown = canvasLabel(current ?? { id: "", name: "", kind: "own", at: 0 }, currentName) || t("canvasUntitled", lang);

  const big = (icon: string, label: string, onClick: () => void, primary = false) => (
    <button
      onClick={onClick}
      title={label}
      className="m3-press"
      style={{
        height: 42,
        padding: "0 14px",
        borderRadius: 21,
        border: "none",
        background: primary ? p.primary : p.surfaceContainerHighest,
        color: primary ? p.onPrimary : p.onSurfaceVariant,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        flex: 1,
        minWidth: 0,
      }}
    >
      <Icon name={icon} size={18} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );

  return (
    <div className="no-scrollbar" style={{ height: "100%", overflowY: "auto", padding: "12px 12px 20px", display: "grid", gap: 12, alignContent: "start" }}>
      <div style={{ padding: 12, borderRadius: 18, background: p.surfaceContainerLow, display: "grid", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: p.onSurfaceVariant }}>{t("workspaceCurrent", lang)}</span>
        <span style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shown}</span>
        <span style={{ fontSize: 11, color: p.onSurfaceVariant }}>
          {current?.kind === "builtin" ? t("canvasBuiltin", lang) : t("workspaceBlank", lang)}
        </span>
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <button
            onClick={onRename}
            title={t("canvasRename", lang)}
            aria-label={t("canvasRename", lang)}
            className="m3-press"
            style={{ height: 30, padding: "0 10px", borderRadius: 15, border: "none", background: "transparent", color: p.primary, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Icon name="edit" size={15} />
            {t("canvasRename", lang)}
          </button>
          {!isBuiltinCanvas(current) && (
          <button
            onClick={onDelete}
            title={t("canvasDelete", lang)}
            aria-label={t("canvasDelete", lang)}
            className="m3-press"
            style={{ height: 30, padding: "0 10px", borderRadius: 15, border: "none", background: "transparent", color: p.error, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Icon name="delete" size={15} />
            {t("delete", lang)}
          </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {big("add", t("canvasNew", lang), onNewCanvas, true)}
      </div>

      {/* 已经开着的几份画布：在这儿也能切 */}
      {canvases.list.length > 1 && (
        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ padding: "4px 4px 2px", fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: p.onSurfaceVariant }}>{t("canvasTabs", lang)}</span>
          {canvases.list.map((c) => {
            const on = c.id === canvases.activeId;
            return (
              <button
                key={c.id}
                onClick={() => onSwitch(c.id)}
                title={c.name}
                className="m3-press"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 10px",
                  borderRadius: 14,
                  border: "none",
                  background: on ? p.secondaryContainer : "transparent",
                  color: on ? p.onSecondaryContainer : p.onSurface,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon name={c.kind === "builtin" ? "verified" : "space_dashboard"} size={18} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: on ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {canvasLabel(c, currentName) || t("canvasUntitled", lang)}
                </span>
                {on && <Icon name="check" size={16} />}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {big("add_box", t("parts"), onParts)}
        {onFlow && big("account_tree", t("viewFlow"), onFlow)}
      </div>
      <p style={{ margin: "0 4px", fontSize: 11, lineHeight: 1.6, color: p.onSurfaceVariant }}>
        {t("workspaceHint", lang)}
      </p>
    </div>
  );
}
