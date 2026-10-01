"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toPng } from "html-to-image";
import { Frame, Group, PlacedItem, Theme, Palette, foldPlace, frameOfGroup } from "@/lib/tokens";
import { Lang, t, useLang } from "@/lib/i18n";
import { ComponentTypeCode, uploadMarketComponent } from "@/lib/syai";
import { CATEGORY_NAMES, CODE_OF_CATEGORY, categoryIcon, packData, tightenGroups } from "@/lib/market";
import { captureOptions, iconFontEmbedCss, squareThumbnail, thumbScale, warmIconFont } from "@/lib/marketThumbnail";
import { useSession } from "@/lib/session";
import { Icon } from "./M3Node";
import { LoginDialog } from "./LoginDialog";
import { StaticFrame } from "./StaticFrame";
import { inputBox } from "./ui";

/**
 * 截图：按节点在页面上的真实盒子取尺寸
 *
 * 节点本身已经按 `thumbScale` 缩到最终尺寸画好了，所以这里的像素就是缩略图的像素 ——
 * 没有"先画大再缩小"的那一次重采样，字和图标才清楚。
 */
async function renderThumbnail(node: HTMLElement, w: number, h: number): Promise<HTMLImageElement> {
  const rect = node.getBoundingClientRect();
  const box = {
    w: Math.max(1, Math.round(rect.width || node.scrollWidth || node.offsetWidth || w)),
    h: Math.max(1, Math.round(rect.height || node.scrollHeight || node.offsetHeight || h)),
  };
  /* 图标字体单独内联：`skipFonts` 挡掉了跨域样式表的报错，也顺带挡掉了图标 */
  const url = await toPng(node, captureOptions(box.w, box.h, await iconFontEmbedCss()));
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("thumbnail decode failed"));
    img.src = url;
  });
  return img;
}

/**
 * 一帧画成缩略图：屏幕外 1:1 画好，再用 canvas 缩到 400px 以内，转成 data URL。
 * 缩略图终究只是列表页的门面：真画不出来就返回 undefined，上传照常进行。
 */
async function toThumbnail(node: HTMLElement, w: number, h: number): Promise<string | undefined> {
  let img: HTMLImageElement;
  try {
    img = await renderThumbnail(node, w, h);
  } catch (first) {
    /* 表头、首屏图片这类元素在被转换的一瞬间还可能没画好，等两帧再试一次就稳了 */
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      img = await renderThumbnail(node, w, h);
    } catch {
      /* 缩略图是列表页的门面，画不出来就不带它，不该把上传拦下来，
         也不该在控制台喷一条让作者以为上传失败的错误 */
      return undefined;
    }
  }
  try {
    /* 统一成正方形：又高又窄的组件（导航栏）和又扁又宽的（按钮行）在卡片里都完整 */
    return squareThumbnail(img);
  } catch {
    return undefined;
  }
}

/**
 * 上传到市场组件
 * ---------------------------------------------------------------------------
 * 从屏幕复制按钮旁边进来，上传的是当前屏幕上的组件。
 * 组件类型、组件名称由作者填；用户信息、来源屏幕、缩略图在这里补上。
 */
export function UploadMarketDialog({
  p,
  open,
  onClose,
  doc,
  frame,
  theme,
  onToast,
}: {
  p: Palette;
  open: boolean;
  onClose: () => void;
  /** 文档主题：缩略图里的字体要跟画布一致 */
  theme: Theme;
  /** 当前文档，用来取那一屏的内容 */
  doc: { groups: Group[]; frames: Frame[]; widths: Record<string, number> };
  /** 要上传的屏幕；没有就是还没选中屏幕 */
  frame: Frame | null;
  /** 与编辑器自己的 showToast 同形：提示、时长、图标 */
  onToast?: (text: string, ms?: number, icon?: string) => void;
}) {
  const lang = useLang();
  const { loggedIn } = useSession();
  const [name, setName] = useState("");
  const [type, setType] = useState<ComponentTypeCode>(5);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const [msg, setMsg] = useState("");
  const shotRef = useRef<HTMLDivElement>(null);

  const w = Math.max(1, Math.round(frame?.w ?? 412));
  const h = Math.max(1, Math.round(frame?.h ?? 892));

  /* 这一屏上的组，偏移归一化到屏幕左上角：组件自己的坐标系就是这个 */
  const groups = useMemo(() => {
    if (!frame) return [];
    return doc.groups
      .filter((g) => frameOfGroup(g, doc.frames, doc.widths)?.id === frame.id)
      .map((g) => ({ ...g, x: g.x - frame.x, y: g.y - frame.y }));
  }, [doc.groups, doc.frames, doc.widths, frame]);

  const empty = groups.length === 0;
  /* 上传的是组件自己的紧凑包围盒（屏幕上的一小块，不是整块屏幕）：
     预览、缩略图、数据三处都按它来 */
  const tight = useMemo(() => tightenGroups(groups, doc.widths), [groups, doc.widths]);
  /** 卡片里那一份的缩放（只是看看） */
  const previewScale = Math.min(1, 132 / Math.max(1, tight.w, tight.h));
  /** 缩略图那一份的缩放：直接按最终尺寸画，少一次重采样 */
  const shotScale = thumbScale(tight.w, tight.h);

  useEffect(() => {
    if (!open) return;
    /* 先把图标字体取回来：不然第一次点「上传」要等它下载 + 编码 */
    warmIconFont();
    setMsg("");
    setBusy(false);
    setDescription("");
    /* 名称默认取屏幕名，作者改一下就能用 */
    setName(frame?.name ?? "");
  }, [open, frame]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const submit = async () => {
    if (!frame || empty) return;
    if (!name.trim()) {
      setMsg(t("uploadNeedName", lang));
      return;
    }
    if (!loggedIn) {
      setLogin(true);
      return;
    }

    setBusy(true);
    setMsg("");
    try {
      if (tight.groups.length === 0) {
        setMsg(t("uploadEmpty", lang));
        setBusy(false);
        return;
      }
      const thumbnail = shotRef.current ? await toThumbnail(shotRef.current, tight.w, tight.h) : undefined;

      await uploadMarketComponent({
        name: name.trim(),
        type,
        /* 实测宽度一起上传：市场里再画出来时，按钮这类部件才是原来的宽度。
           screen 是「上传前的那一屏」：详情页照着它画，看到的就是自己交出去的样子。 */
        data: packData(tight.groups, { w: tight.w, h: tight.h }, doc.widths, {
          name: frame.name,
          w,
          h,
          bg: frame.bg,
          groups: groups.map((g) => ({
            x: g.x,
            y: g.y,
            axis: g.axis,
            ...(g.free ? { free: true as const } : undefined),
            ...(g.pos ? { pos: g.pos } : undefined),
            items: (g.items as PlacedItem[]).map((it) => {
              const place = foldPlace(it, doc.widths);
              return { ...it, x: it.x + place.dx, y: it.y + place.dy };
            }),
          })),
        }),
        thumbnail,
        description: description.trim() || undefined,
        screenName: frame.name,
      });
      onToast?.(t("uploadDone", lang), 2200, "cloud_upload");
      onClose();
    } catch (err) {
      /* 后端把拒绝的原因写在 msg 里（没登录、类型不对、数据不合法…），照原样说出来，
         不然作者只看到「上传失败」无从下手 */
      const detail = err instanceof Error ? err.message : t("uploadFail", lang);
      setMsg(t("uploadFailedWith", lang).replace("{msg}", detail));
    } finally {
      setBusy(false);
    }
  };

  const textInput: React.CSSProperties = {
    width: "100%",
    height: 44,
    padding: "0 14px",
    color: p.onSurface,
    font: "inherit",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    ...inputBox(p, 14),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="upload-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 620,
            background: "rgba(0,0,0,0.34)",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label={t("uploadTitle", lang)}
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 34, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 620px)",
              maxHeight: "min(92dvh, 740px)",
              padding: 22,
              borderRadius: 28,
              background: p.surfaceContainerHigh,
              color: p.onSurface,
              boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 600 }}>{t("uploadTitle", lang)}</span>
                <span style={{ fontSize: 12, lineHeight: 1.55, color: p.onSurfaceVariant }}>{t("uploadHint", lang)}</span>
              </div>
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

            {/* 要上传的内容，一眼可见 */}
            <div
              style={{
                display: "grid",
                placeItems: "center",
                minHeight: 160,
                padding: 12,
                borderRadius: 18,
                background: p.surfaceContainerHighest,
                overflow: "hidden",
              }}
            >
              {frame && !empty ? (
                <>
                  {/* 真正拿去生成缩略图的那一份：紧凑包围盒，按缩略图比例画好放在屏幕外 */}
                  <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }} aria-hidden>
                    <div
                      ref={shotRef}
                      style={{
                        width: Math.max(1, Math.round(tight.w * shotScale)),
                        height: Math.max(1, Math.round(tight.h * shotScale)),
                        background: "#ffffff",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: tight.w,
                          height: tight.h,
                          transform: `scale(${shotScale})`,
                          transformOrigin: "top left",
                        }}
                      >
                        <StaticFrame groups={tight.groups as unknown as Group[]} widths={doc.widths} palette={p} theme={theme} lang={lang} w={tight.w} h={tight.h} />
                      </div>
                    </div>
                  </div>
                  {/* 面板里的这一份只是看看，按比例缩到卡片里 */}
                  <div
                    style={{
                      position: "relative",
                      width: Math.max(1, Math.round(tight.w * previewScale)),
                      height: Math.max(1, Math.round(tight.h * previewScale)),
                      borderRadius: 14,
                      background: p.surface,
                      boxShadow: "0 2px 10px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.05)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${previewScale})`, transformOrigin: "top left", width: tight.w, height: tight.h }}>
                      <StaticFrame groups={tight.groups as unknown as Group[]} widths={doc.widths} palette={p} theme={theme} lang={lang} w={tight.w} h={tight.h} />
                    </div>
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 12, color: p.onSurfaceVariant, display: "inline-flex", gap: 8, alignItems: "center" }}>
                  <Icon name="hide_image" size={20} />
                  {empty ? t("uploadEmpty", lang) : t("uploadPickScreen", lang)}
                </span>
              )}
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: p.onSurfaceVariant }}>{t("uploadName", lang)}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 64))}
                placeholder={t("uploadNameHint", lang)}
                style={textInput}
              />
            </label>

            <div style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: p.onSurfaceVariant }}>{t("uploadType", lang)}</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8 }}>
                {(Object.keys(CATEGORY_NAMES) as (keyof typeof CATEGORY_NAMES)[]).map((category) => {
                  const code = CODE_OF_CATEGORY[category];
                  const on = type === code;
                  return (
                    <button
                      key={category}
                      onClick={() => setType(code)}
                      aria-pressed={on}
                      className="m3-press"
                      style={{
                        height: 42,
                        padding: "0 12px",
                        borderRadius: 14,
                        border: "none",
                        background: on ? p.secondaryContainer : p.surfaceContainerHighest,
                        color: on ? p.onSecondaryContainer : p.onSurface,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Icon name={categoryIcon(category)} size={18} />
                      {CATEGORY_NAMES[category]}
                    </button>
                  );
                })}
              </div>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: p.onSurfaceVariant }}>{t("uploadDesc", lang)}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 255))}
                placeholder={t("uploadDescHint", lang)}
                rows={2}
                spellCheck={false}
                style={{ ...textInput, height: "auto", padding: "10px 14px", lineHeight: 1.5, resize: "none" }}
              />
            </label>

            {msg && (
              <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 12, color: p.error }}>
                {msg}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={onClose}
                className="m3-press"
                style={{
                  height: 44,
                  padding: "0 18px",
                  borderRadius: 22,
                  border: "none",
                  background: "transparent",
                  color: p.primary,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("cancel", lang)}
              </button>
              <button
                onClick={() => void submit()}
                disabled={busy || empty || !frame}
                className="m3-press"
                style={{
                  height: 44,
                  padding: "0 22px",
                  borderRadius: 22,
                  border: "none",
                  background: busy || empty || !frame ? p.surfaceContainerHighest : p.primary,
                  color: busy || empty || !frame ? p.onSurfaceVariant : p.onPrimary,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: busy || empty || !frame ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {busy && <Icon name="hourglass_top" size={18} />}
                {busy ? t("uploadBusy", lang) : t("uploadSubmit", lang)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <LoginDialog p={p} open={login} onClose={() => setLogin(false)} />
    </AnimatePresence>
  );
}
