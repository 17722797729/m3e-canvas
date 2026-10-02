"use client";

import { useMemo, useState } from "react";
import { Palette, Theme } from "@/lib/tokens";
import { Lang, t, useLang } from "@/lib/i18n";
import { DEFAULT_THEME } from "@/lib/tokens";
import { Template, TemplateScreens, screenCount } from "@/lib/templates";
import { Icon } from "./M3Node";
import { StaticFrame } from "./StaticFrame";

/**
 * 模板面板
 * ---------------------------------------------------------------------------
 * 一个模板就是一整套屏幕：点它，画布换成它的那一套。
 *
 * 「新增模板」把**当前画布**存成一条新模板（名字由你起），存完画布就是一个全新的空白屏幕 ——
 * 新模板从零开始，而不是接着农场的五个页面往下画。
 *
 * 缩略图用和画布同一套渲染（StaticFrame 那一支），所以面板上看到的就是画布上的样子：
 * 一排屏幕，按它自己的比例缩进来。
 */
export function TemplatesPanel({
  p,
  theme,
  templates,
  onApply,
  onDelete,
  onNew,
  onSave,
}: {
  p: Palette;
  theme?: Theme;
  /** 内置的排在最前，自己建的接在后面 */
  templates: Template[];
  /** 用这个模板铺满画布 */
  onApply: (t: Template) => void;
  /** 删掉自己建的模板；内置的不会走到这里 */
  onDelete: (t: Template) => void;
  /** 新建：把当前画布存成模板 */
  onNew: () => void;
  /** 保存：把当前画布写回这一条模板，快捷更新它的内容 */
  onSave: (t: Template) => void;
}) {
  const lang = useLang();
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = templates.find((t) => t.id === openId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "12px 12px 8px" }}>
        <button
          onClick={onNew}
          title={t("templateNewHint", lang)}
          className="m3-press"
          style={{
            width: "100%",
            height: 44,
            borderRadius: 22,
            border: "none",
            background: p.primary,
            color: p.onPrimary,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Icon name="add" size={20} />
          {t("templateNew", lang)}
        </button>
        <p style={{ margin: "10px 4px 0", fontSize: 12, lineHeight: 1.6, color: p.onSurfaceVariant }}>{t("templateHint", lang)}</p>
      </div>

      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        {templates.map((tpl) => {
          const on = opened?.id === tpl.id;
          return (
            <div
              key={tpl.id}
              style={{
                display: "grid",
                gap: 8,
                padding: 10,
                borderRadius: 18,
                background: on ? p.secondaryContainer : p.surfaceContainerLow,
                color: on ? p.onSecondaryContainer : p.onSurface,
                border: `1px solid ${on ? p.primary : "transparent"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.name}</span>
                  <span style={{ fontSize: 11, color: on ? p.onSecondaryContainer : p.onSurfaceVariant }}>
                    {t("templateScreens", lang).replace("{n}", String(screenCount(tpl)))}
                    {tpl.builtin ? ` · ${t("templateBuiltin", lang)}` : ""}
                  </span>
                </span>
                {tpl.builtin ? (
                  <Icon name="lock" size={16} />
                ) : (
                  <button
                    onClick={() => onDelete(tpl)}
                    title={t("templateDelete", lang)}
                    aria-label={t("templateDelete", lang)}
                    className="m3-press"
                    style={{
                      width: 28,
                      height: 28,
                      flex: "0 0 auto",
                      borderRadius: 14,
                      border: "none",
                      background: p.errorContainer,
                      color: p.onErrorContainer,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon name="delete" size={15} />
                  </button>
                )}
              </div>

              {/* 缩略图：一排屏幕，按比例缩进这块格子 */}
              <button
                onClick={() => setOpenId(on ? null : tpl.id)}
                title={on ? t("templateCollapse", lang) : t("templatePreview", lang)}
                className="m3-press"
                style={{
                  padding: 0,
                  height: 96,
                  borderRadius: 14,
                  border: `1px solid ${p.outlineVariant}`,
                  background: p.surface,
                  cursor: "pointer",
                  overflow: "hidden",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <TemplateThumb p={p} theme={theme} screens={tpl.screens} height={94} />
              </button>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => onApply(tpl)}
                  className="m3-press"
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 18,
                    border: "none",
                    background: p.primary,
                    color: p.onPrimary,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Icon name="auto_awesome_mosaic" size={16} />
                  {t("templateApply", lang)}
                </button>
                {/* 保存：把**当前画布**写回这一条模板 —— 想更新模板不必删了重建 */}
                <button
                  onClick={() => onSave(tpl)}
                  title={t("templateSave", lang)}
                  aria-label={t("templateSave", lang)}
                  className="m3-press"
                  style={{
                    width: 36,
                    height: 36,
                    flex: "0 0 auto",
                    borderRadius: 18,
                    border: "none",
                    background: p.secondaryContainer,
                    color: p.onSecondaryContainer,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon name="save" size={18} />
                </button>
                <button
                  onClick={() => setOpenId(on ? null : tpl.id)}
                  className="m3-press"
                  title={t("templatePreview", lang)}
                  aria-label={t("templatePreview", lang)}
                  style={{
                    width: 36,
                    height: 36,
                    flex: "0 0 auto",
                    borderRadius: 18,
                    border: "none",
                    background: p.surfaceContainerHighest,
                    color: p.onSurfaceVariant,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon name={on ? "expand_less" : "expand_more"} size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 一排屏幕的缩略图：每屏各画各的
 *
 * 不把五屏拼成一份文档再缩 —— 那样缩完每一屏只有几十像素，什么也看不出来。
 * 这里让每一屏单独适配这块格子：屏少的时候大、屏多的时候小，但都看得见轮廓。
 * 一屏里的组靠 `frameId` 认领（认不出的按几何落在哪一屏算），和画布上同一套规矩。
 */
function TemplateThumb({ p, theme, screens, height }: { p: Palette; theme?: Theme; screens: TemplateScreens; height: number }) {
  const lang = useLang();
  const widths = useMemo(() => {
    const out: Record<string, number> = {};
    for (const g of screens.groups) for (const it of g.items) out[it.id] = 412;
    return out;
  }, [screens]);
  const perFrame = screens.frames.map((f) => ({
    frame: f,
    groups: screens.groups.filter((g) => (g.frameId ? g.frameId === f.id : withinFrame(g, f))),
  }));
  const count = Math.max(1, perFrame.length);
  /* 一屏占多宽由"格子能放下几屏"决定；高度那边各屏自己再缩一次 */
  const cellW = Math.max(18, Math.floor((WIDTH - (count - 1) * 4) / count));
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center", width: WIDTH, height }}>
      {perFrame.map(({ frame, groups }) => {
        const w = frame.w ?? 412;
        const h = frame.h ?? 892;
        const scale = Math.min(1, cellW / w, (height - 4) / h);
        return (
          <div
            key={frame.id}
            title={frame.name}
            style={{
              width: Math.max(1, Math.round(w * scale)),
              height: Math.max(1, Math.round(h * scale)),
              borderRadius: Math.max(2, 4 * scale),
              border: `1px solid ${p.outlineVariant}`,
              background: p.surface,
              overflow: "hidden",
              flex: "0 0 auto",
            }}
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <StaticFrame
                groups={groups}
                widths={widths}
                palette={p}
                theme={theme ?? DEFAULT_THEME}
                lang={lang as Lang}
                w={w}
                h={h}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 缩略图那块格子的宽度，和面板的宽度一起变 */
const WIDTH = 240;

/** 认不出归属时的兜底：组的中心落在哪一屏就算哪一屏 */
function withinFrame(g: { x: number; y: number }, f: { x: number; y: number; w?: number; h?: number }) {
  const w = f.w ?? 412;
  const h = f.h ?? 892;
  return g.x >= f.x - 8 && g.x <= f.x + w + 8 && g.y >= f.y - 8 && g.y <= f.y + h + 8;
}
