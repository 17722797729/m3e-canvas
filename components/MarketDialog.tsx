"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CustomPart, Doc, Frame, Palette, Theme } from "@/lib/tokens";
import { t, useLang } from "@/lib/i18n";
import {
  ComponentTypeCode,
  MarketComponent,
  addToMyComponents,
  marketComponentDetail,
} from "@/lib/syai";
import { CODE_OF_CATEGORY, CATEGORY_NAMES, categoryIcon, categoryOf, downloadText, parseMarketData, partOf } from "@/lib/market";
import { useSession } from "@/lib/session";
import { Icon } from "./M3Node";
import { MarketPreview } from "./MarketPreview";
import { UserAvatar } from "./UserAvatar";
import { LoginDialog } from "./LoginDialog";
import { Preview } from "./Preview";

/** 详情里那一屏的 id：Preview 从它开始 */
const SCREEN_ID = "market-screen";

/** 组件「屏幕」里画布的高度：预览按 1:1 画，装不下就整体缩放，不裁组件 */
const STAGE_H = 460;
const STAGE_W = 640;

/**
 * 市场组件详情：一块新的「屏幕」
 * ---------------------------------------------------------------------------
 * 左边是一块屏幕，里面装着这位作者上传的组件；右边是组件信息与作者信息，
 * 底下是「加入我的组件」——点开选组件类型，选完就落到自己的组件面板里。
 */
export function MarketDialog({
  p,
  component,
  onClose,
  onAdd,
  onToast,
  theme,
  allowAdd = true,
}: {
  p: Palette;
  /** 列表里那一行；详情数据在这里补拉 */
  component: MarketComponent | null;
  onClose: () => void;
  /** 文档主题：屏幕里的字体要和画布一致 */
  theme?: Theme;
  /** 加入成功后把组件交给调用方（存进自己的组件列表） */
  onAdd?: (part: CustomPart, type: ComponentTypeCode, name: string) => void;
  /** 与编辑器自己的 showToast 同形：提示、时长、图标 */
  onToast?: (text: string, ms?: number, icon?: string) => void;
  /** 「我的组件」预览时为 false：已经在自己名下，不必再加一次 */
  allowAdd?: boolean;
}) {
  const lang = useLang();
  const { loggedIn } = useSession();
  const [detail, setDetail] = useState<MarketComponent | null>(component);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);

  /* 详情带组件数据，列表那一行没有；打开的瞬间补拉一次 */
  useEffect(() => {
    setDetail(component);
    setFailed(false);
    setPicking(false);
    if (!component) return;
    if (component.data) return;
    let alive = true;
    setLoading(true);
    void marketComponentDetail(component.id)
      .then((full) => {
        if (alive) setDetail({ ...component, ...full });
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [component]);

  useEffect(() => {
    if (!component) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (picking) setPicking(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [component, picking, onClose]);

  const parsed = useMemo(() => parseMarketData(detail?.data), [detail?.data]);
  /* 同一份数据解一次就够：预览要形状，落画布要 CustomPart */
  const customPart = useMemo(
    () => (detail ? partOf(detail.data, `market-${detail.id}`, detail.name) : null),
    [detail],
  );
  /* 退回静态图时才需要缩放：有原屏幕的时候交给 Preview 自己适配 */
  const scale = parsed ? Math.min(1, STAGE_W / Math.max(1, parsed.w), STAGE_H / Math.max(1, parsed.h)) : 1;

  const add = async (type: ComponentTypeCode) => {
    if (!detail) return;
    setBusy(true);
    try {
      await addToMyComponents(detail.id, type, detail.name);
      const part = partOf(detail.data, `market-${detail.id}`, detail.name);
      if (part && onAdd) onAdd(part, type, detail.name);
      onToast?.(t("marketAdded", lang), 2000, "library_add");
      setPicking(false);
      onClose();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : t("marketFailed", lang), 2400, "error");
    } finally {
      setBusy(false);
    }
  };

  const info = (
    label: string,
    value: React.ReactNode,
    icon?: string,
  ) => (
    <div style={{ display: "grid", gap: 3 }}>
      <span style={{ fontSize: 11, color: p.onSurfaceVariant }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {icon && <Icon name={icon} size={15} />}
        {value}
      </span>
    </div>
  );

  /* 上传前那一屏：详情里照着它画，并且是可点、可滑的预览 */
  const screenDoc: Doc | null = useMemo(() => {
    const screen = parsed?.screen;
    if (!screen || screen.groups.length === 0) return null;
    return {
      frames: [{ id: SCREEN_ID, name: screen.name || (detail?.name ?? ""), x: 0, y: 0, w: screen.w, h: screen.h, ...(screen.bg ? { bg: screen.bg as Frame["bg"] } : undefined) }],
      groups: screen.groups.map((g, i) => ({ id: `market-screen-${i}`, x: g.x, y: g.y, axis: g.axis, ...(g.free ? { free: true as const } : undefined), ...(g.pos ? { pos: g.pos } : undefined), items: g.items })),
      /* 预览只读 frames / groups / theme / 配色，其余字段给上默认值就是一份合法文档 */
      frame: "phone",
      paletteKey: "purple",
      title: detail?.name ?? "",
      brief: "",
      ...(theme ? { theme } : undefined),
    } as Doc;
  }, [parsed?.screen, detail?.name, theme]);

  return (
    <AnimatePresence>
      {component && (
        <motion.div
          key="market-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 640,
            background: "rgba(0,0,0,0.36)",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          {/* 有原屏幕就整屏预览（和编辑器里的预览一样能点），没有才退回照片式的静态图 */}
          {screenDoc && (
            <Preview doc={screenDoc} widths={parsed?.widths ?? {}} palette={p} startId={SCREEN_ID} onClose={onClose} />
          )}

          <motion.div
            role="dialog"
            aria-modal
            aria-label={component.name}
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 34, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            style={
              screenDoc
                ? {
                    /* 屏幕已经铺满：信息收成右侧一张浮起来的卡，屏幕因此完整可点 */
                    position: "fixed",
                    top: 16,
                    bottom: 16,
                    right: 16,
                    width: 320,
                    zIndex: 660,
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 28,
                    overflow: "hidden",
                    background: p.surfaceContainerHigh,
                    color: p.onSurface,
                    boxShadow: "0 12px 32px rgba(0,0,0,0.24)",
                  }
                : {
                    width: "min(100%, 980px)",
                    maxHeight: "min(92dvh, 760px)",
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 300px",
                    gap: 0,
                    borderRadius: 28,
                    overflow: "hidden",
                    background: p.surfaceContainerHigh,
                    color: p.onSurface,
                    boxShadow: "0 12px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
                  }
            }
            className="m3-market-dialog"
          >
            {/* 左：一块屏幕。有原屏幕时由上面的 Preview 铺满，这里就只剩信息 */}
            {!screenDoc && (
            <div
              style={{
                position: "relative",
                minHeight: 320,
                display: "grid",
                placeItems: "center",
                padding: 20,
                background: p.surfaceContainerHighest,
                borderInlineEnd: `1px solid ${p.outlineVariant}`,
                overflow: "auto",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: Math.max(1, Math.round((parsed?.w ?? 1) * scale)),
                  height: Math.max(1, Math.round((parsed?.h ?? 1) * scale)),
                  borderRadius: 20,
                  background: p.surface,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.05)",
                  overflow: "hidden",
                  flex: "0 0 auto",
                }}
              >
                {parsed ? (
                  <MarketPreview part={parsed} palette={p} theme={theme} widths={parsed.widths} scale={scale} />
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      gap: 8,
                      padding: 20,
                      color: p.onSurfaceVariant,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    <Icon name={loading ? "hourglass_top" : "broken_image"} size={28} />
                    <span>{loading ? t("marketLoading", lang) : failed ? t("marketFailed", lang) : t("marketNoData", lang)}</span>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* 右：组件信息 + 作者 + 加入我的组件 */}
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, padding: 20, gap: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>
                  {detail?.name ?? component.name}
                </span>
                <button
                  onClick={onClose}
                  title={t("closeBtn", lang)}
                  aria-label={t("closeBtn", lang)}
                  className="m3-press"
                  style={{
                    width: 32,
                    height: 32,
                    flex: "0 0 auto",
                    borderRadius: 16,
                    border: "none",
                    background: "transparent",
                    color: p.onSurfaceVariant,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>

              <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {info(
                    t("marketType", lang),
                    detail?.typeName ?? CATEGORY_NAMES[categoryOf(detail?.type ?? 5)],
                    categoryIcon(categoryOf(detail?.type ?? 5)),
                  )}
                  {info(t("marketDownloads", lang), downloadText(detail?.downloadCount), "download")}
                </div>
                {info(
                  t("marketAuthor", lang),
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <UserAvatar p={p} src={detail?.userAvatar} name={detail?.userName} seed={detail?.userId} size={24} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail?.userName || "-"}</span>
                  </span>,
                )}
                {detail?.screenName ? info(t("marketFrom", lang), detail.screenName, "screenshot_monitor") : null}
                {detail?.description ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 11, color: p.onSurfaceVariant }}>{t("marketInfo", lang)}</span>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: p.onSurface }}>{detail.description}</p>
                  </div>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {allowAdd && (
                  <button
                    onClick={() => (loggedIn ? setPicking(true) : setLogin(true))}
                    disabled={!parsed || busy}
                    className="m3-press"
                    style={{
                      height: 44,
                      borderRadius: 22,
                      border: "none",
                      background: parsed && !busy ? p.primary : p.surfaceContainerHighest,
                      color: parsed && !busy ? p.onPrimary : p.onSurfaceVariant,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: parsed && !busy ? "pointer" : "default",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {busy ? <Icon name="hourglass_top" size={18} /> : <Icon name="library_add" size={18} />}
                    {t("marketAddMine", lang)}
                  </button>
                )}
                {!loggedIn && allowAdd && (
                  <span style={{ fontSize: 11, color: p.onSurfaceVariant, textAlign: "center" }}>
                    {t("signInToUse", lang)}
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* 组件类型：市场组件按类型归到自己的组件面板里 */}
          <AnimatePresence>
            {picking && (
              <motion.div
                key="pick-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPicking(false);
                }}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 660,
                  background: "rgba(0,0,0,0.28)",
                  display: "grid",
                  placeItems: "center",
                  padding: 24,
                }}
              >
                <motion.div
                  role="dialog"
                  aria-modal
                  aria-label={t("marketAddTitle", lang)}
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "min(100%, 420px)",
                    padding: 20,
                    borderRadius: 24,
                    background: p.surfaceContainerHigh,
                    color: p.onSurface,
                    boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 17, fontWeight: 600 }}>{t("marketAddTitle", lang)}</span>
                    <span style={{ fontSize: 12, lineHeight: 1.55, color: p.onSurfaceVariant }}>
                      {t("marketAddHint", lang)}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {(Object.keys(CATEGORY_NAMES) as (keyof typeof CATEGORY_NAMES)[]).map((category) => (
                      <button
                        key={category}
                        onClick={() => void add(CODE_OF_CATEGORY[category])}
                        disabled={busy}
                        className="m3-press"
                        style={{
                          height: 44,
                          padding: "0 14px",
                          borderRadius: 14,
                          border: "none",
                          background:
                            detail?.type === CODE_OF_CATEGORY[category] ? p.secondaryContainer : p.surfaceContainerHighest,
                          color:
                            detail?.type === CODE_OF_CATEGORY[category] ? p.onSecondaryContainer : p.onSurface,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: busy ? "default" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        <Icon name={categoryIcon(category)} size={18} />
                        {CATEGORY_NAMES[category]}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <LoginDialog p={p} open={login} onClose={() => setLogin(false)} />
    </AnimatePresence>
  );
}
