"use client";

import { useEffect, useRef, useState } from "react";
import {
  Action,
  BACK_TARGET,
  CONTENT_W,
  Frame,
  FramePreset,
  HALF_W,
  Item,
  KIND_SPEC,
  PHONE_H,
  PHONE_W,
  Kind,
  NavTab,
  Palette,
  SWIPE_DIRS,
  SwipeDir,
  BUTTON_SHAPES,
  roundByNature,
  ButtonShape,
  SHAPED,
  TAPPABLE,
  TRANSITIONS,
  Transition,
  VARIANTS,
  Variant,
  ROUND_SHAPES,
  actionSlotsOf,
  isVariant,
  uid,
  TRACK_DEFAULT,
  TRACK_MAX,
  TRACK_MIN,
  maxRingThickness,
  progressThickness,
  contentWidth,
  defaultTabsFor,
  framePresetOf,
  CardAlign,
  H,
  cardContentAlignOf,
  cardDefaultFillOf,
  cardFillOf,
  cardImageMaxOf,
  cardImagePosOf,
  cardImageSizeOf,
  cardLayoutOf,
  cardLayoutPatch,
  cardTextColorOf,
  CARD_IMAGE_MIN,
  frameSizeOf,
  scrollRange,
  sizeOf,
  type ScrollAxis,
  halfWidth,
  isPhoneFrame,
  isWideRail,
  layerOf,
  railWidth,
  onToken,
  toggleIcon,
  iconSlotsOf,
  setIconSlot,
  removeTabPatch,
  tabCountPatch,
  variantStyle,
  scaleR,
  Place,
  AlignKind,
  CustomPart,
  FRAME_ROLES,
  OVERLAY_LEVELS,
  OVERLAY_LEVEL_ICONS,
  DEFAULT_OVERLAY_LEVEL,
  FrameRole,
  OverlayLevel,
  isOverlayFrame,
  isOverlayItem,
  overlayLevelOf,
  overlayLevelOfFrame,
  /* variables and the conditional taps that read them */
  TAB_STYLES,
  tabPanelsPatch,
  needsTabPanels,
  tabStyleOf,
  type TabStyle,
  overlayRuleOf,
  RULE_ACTIONS,
  /* the state machine a part runs, and the flow the inspector draws it as */
  START_LOOK,
  lookItem,
  stepsFrom,
  type PartFlow,
  type PartLook,
  type PartStep,
  type RuleAction,
} from "@/lib/tokens";
import { IconPicker } from "./IconPicker";
import { Popover } from "./Menus";
import { Icon, M3Static } from "./M3Node";
import { ButtonRun, CardLayoutPicker, CornerIcon, CustomColorDisc, Field, IconBtn, ItemColorChips, Pick, Section, Segmented, SizePresets, Slider, TextTokenChips, Toggle, TokenChips } from "./ui";
import { AiWriteBtn } from "./AiPanel";
import { popHistory } from "@/lib/ai";
import { KIND_TEXT, Lang, SWIPE_TEXT, TRANSITION_TEXT, UIKey, overlayLevelText, t, useLang } from "@/lib/i18n";
import type { DialogRef } from "@/lib/pages";

/** A text field for a web address: what is typed stays in the box, and only a complete
 *  http(s) address (or an emptied box) reaches the part. */
function UrlField({ value, onChange, placeholder, p }: { value: string; onChange: (src: string | undefined) => void; placeholder: string; p: Palette }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div onBlurCapture={() => setText(value)}>
      <Field
        value={text}
        onChange={(v) => {
          setText(v);
          const s = v.trim();
          /* an emptied box removes a URL; a picked file (which shows as an empty box) is left alone */
          if (!s && value) onChange(undefined);
          else if (/^https?:\/\/\S+$/.test(s)) onChange(s);
        }}
        placeholder={placeholder}
        p={p}
        icon="link"
      />
    </div>
  );
}

export function variantsOf(kind: Kind): { key: Variant; label: string }[] {
  const variants = VARIANTS.map((v) => ({ ...v, label: t(v.key) }));
  switch (kind) {
    case "card":
      return [
        { key: "tonal", label: t("filled") },
        { key: "elevated", label: t("elevated") },
        { key: "outlined", label: t("outlined") },
      ];
    case "textField":
    case "select":
      return [
        { key: "outlined", label: t("outlined") },
        { key: "filled", label: t("filled") },
      ];
    case "chip":
      return [
        { key: "outlined", label: t("outlined") },
        { key: "tonal", label: t("elevated") },
      ];
    case "fab":
    case "extendedFab":
    case "fabMenu":
      return variants.filter((v) => v.key !== "text" && v.key !== "elevated" && v.key !== "outlined");
    case "splitButton":
      return variants.filter((v) => v.key !== "text");
    case "toolbar":
      return [
        { key: "tonal", label: t("standard") },
        { key: "filled", label: t("vibrant") },
      ];
    case "iconButton":
      return variants.filter((v) => v.key !== "elevated" && v.key !== "text").concat({
        key: "text",
        label: t("standard"),
      });
    default:
      return variants;
  }
}

export function VariantSwatch({
  v,
  label,
  p,
  on,
  onClick,
  small,
}: {
  v: Variant;
  label: string;
  p: Palette;
  on: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  const st = variantStyle(v, p);
  const h = small ? 32 : 40;
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className="m3-press"
      style={{
        height: h,
        borderRadius: h / 2,
        cursor: "pointer",
        fontSize: small ? 11 : 12,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: small ? "0 10px" : "0 12px",
        ...st,
        boxShadow: v === "elevated" ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
        outline: on ? `2px solid ${p.primary}` : "2px solid transparent",
        outlineOffset: 2,
      }}
    >
      {on && <Icon name="check" size={small ? 14 : 16} />}
      {label}
    </button>
  );
}

const MAX_IMAGE_PX = 1200;

/** hover text for a width preset derived from the selected frame */
export const widthPresetLabel = (v: number, frameWidth = PHONE_W): string | undefined =>
  v === frameWidth
    ? t("screenWidth")
    : v === contentWidth(frameWidth)
      ? t("contentWidth")
      : v === halfWidth(frameWidth)
        ? t("halfWidth")
        : frameWidth !== PHONE_W && v === CONTENT_W
          ? t("columnWidth")
          : undefined;

const heightPresetLabel = (v: number, frameHeight = PHONE_H): string | undefined =>
  v === frameHeight ? t("screenHeight") : v === frameHeight / 2 ? t("halfHeight") : undefined;

export function FrameSizePicker({
  frame,
  palette: p,
  onChange,
  compact,
}: {
  frame: Frame;
  palette: Palette;
  onChange: (preset: FramePreset) => void;
  compact?: boolean;
}) {
  const lang = useLang();
  return (
    <Segmented<FramePreset>
      options={[
        { key: "phone", icon: "smartphone", label: compact ? undefined : t("phoneFrame", lang), title: t("phoneFrame", lang) },
        { key: "landscape", icon: "crop_landscape", label: compact ? undefined : t("landscapeFrame", lang), title: t("landscapeFrame", lang) },
        { key: "desktop", icon: "desktop_windows", label: compact ? undefined : t("desktopFrame", lang), title: t("desktopFrame", lang) },
      ]}
      value={framePresetOf(frame)}
      onChange={onChange}
      p={p}
      height={compact ? 36 : 40}
      grow={!compact}
    />
  );
}

/** Downscale a picked file so the document stays small enough for localStorage. */
function readImage(file: File): Promise<string> {
  /* an SVG is kept as it is: it stays sharp at any zoom, and it may have no intrinsic
     size for a canvas to draw */
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("image"));
      reader.readAsDataURL(file);
    });
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, MAX_IMAGE_PX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/webp", 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

/** The screen a tap opens: a button that names the choice, opening a searchable menu. */
function FrameSelect({
  frames,
  value,
  onChange,
  p,
}: {
  frames: Frame[];
  value: string | null;
  onChange: (id: string | null) => void;
  p: Palette;
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = frames.find((f) => f.id === value);
  const label = value === BACK_TARGET ? t("back", lang) : current?.name || t("chooseScreen", lang);
  const s2 = q.trim().toLowerCase();
  const list = s2 ? frames.filter((f) => (f.name || "").toLowerCase().includes(s2)) : frames;
  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQ("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="m3-press"
        style={{ height: 40, borderRadius: 20, border: `1px solid ${p.outline}`, background: "transparent", color: value ? p.onSurface : p.onSurfaceVariant, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}
      >
        <span style={{ flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : "none", transition: "transform 160ms", color: p.onSurfaceVariant }}>
          <Icon name="chevron_right" size={18} />
        </span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, borderRadius: 14, background: p.surfaceContainer }}>
          <Field value={q} onChange={setQ} placeholder={t("search", lang)} p={p} icon="search" height={40} />
          <div className="no-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
            <button type="button" onClick={() => pick(BACK_TARGET)} className="m3-press" style={{ height: 40, borderRadius: 12, border: "none", textAlign: "left", padding: "0 12px", background: value === BACK_TARGET ? p.secondaryContainer : "transparent", color: value === BACK_TARGET ? p.onSecondaryContainer : p.onSurface, fontSize: 13, cursor: "pointer" }}>
              {t("back", lang)}
            </button>
            {list.map((f) => (
              <button key={f.id} type="button" onClick={() => pick(f.id)} className="m3-press" style={{ height: 40, borderRadius: 12, border: "none", textAlign: "left", padding: "0 12px", background: f.id === value ? p.secondaryContainer : "transparent", color: f.id === value ? p.onSecondaryContainer : p.onSurface, fontSize: 13, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.name || t("screen", lang)}
              </button>
            ))}
            {list.length === 0 && <div style={{ padding: 12, fontSize: 12, color: p.outline, textAlign: "center" }}>{t("searchOff", lang)}</div>}
          </div>
          {value && (
            <button type="button" onClick={() => pick(null)} className="m3-press" style={{ height: 36, borderRadius: 12, border: "none", background: "transparent", color: p.onSurfaceVariant, fontSize: 12, cursor: "pointer" }}>
              {t("clear", lang)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FrameChips({
  frames,
  value,
  onChange,
  p,
  back,
  small,
}: {
  frames: Frame[];
  value: string | null;
  onChange: (id: string | null) => void;
  p: Palette;
  /** offer "go back" as a target */
  back?: boolean;
  small?: boolean;
}) {
  const lang = useLang();
  const h = small ? 32 : 36;
  const chip = (id: string | null, label: string, icon: string) => {
    const on = value === id;
    return (
      <button
        key={id ?? "none"}
        onClick={() => onChange(id)}
        className="m3-press"
        style={{
          height: h,
          padding: "0 12px 0 8px",
          borderRadius: h / 2,
          border: "none",
          background: on ? p.primary : p.surfaceContainerHigh,
          color: on ? p.onPrimary : p.onSurfaceVariant,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          maxWidth: "100%",
        }}
      >
        <Icon name={icon} size={18} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </button>
    );
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chip(null, t("none", lang), "block")}
      {back && chip(BACK_TARGET, t("goBack", lang), "arrow_back")}
      {frames.map((f) => chip(f.id, f.name || t("screen", lang), isPhoneFrame(f) ? "smartphone" : "desktop_windows"))}
    </div>
  );
}

function TransitionPicker({ value, onChange, p }: { value: Transition; onChange: (t: Transition) => void; p: Palette }) {
  const lang = useLang();
  return (
    <Segmented<Transition>
      options={TRANSITIONS.map((tr) => ({ key: tr.key, icon: tr.icon, title: TRANSITION_TEXT[lang][tr.key] }))}
      value={value}
      onChange={onChange}
      p={p}
      height={34}
    />
  );
}

/** target frame (or back) plus the transition, for one tap target */
function ActionEditor({
  frames,
  action,
  onChange,
  p,
}: {
  frames: Frame[];
  action: Action | undefined;
  onChange: (a: Action | undefined) => void;
  p: Palette;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <FrameChips
        frames={frames}
        value={action?.to ?? null}
        onChange={(to) => onChange(to ? { to, transition: action?.transition ?? "slide" } : undefined)}
        p={p}
        back
      />
      {action && action.to !== BACK_TARGET && (
        <TransitionPicker value={action.transition} onChange={(transition) => onChange({ ...action, transition })} p={p} />
      )}
    </div>
  );
}

/** what a field's AI button needs from the page; `reason` explains a disabled button */
export type AiHooks = { ready: boolean; reason?: string; busy: boolean; onRun: () => void; onCancel: () => void };

/** a multiline field with the AI button under it, fused with a button that swaps the AI text and the original once the AI has written it */
function AiField({ ai, history, onRestore, p, value, onChange, placeholder }: { ai: AiHooks; history?: string[]; onRestore: () => void; p: Palette; value: string; onChange: (v: string) => void; placeholder: string }) {
  const lang = useLang();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Field value={value} onChange={onChange} placeholder={placeholder} p={p} multiline rows={3} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ButtonRun>
          <AiWriteBtn p={p} busy={ai.busy} disabled={!ai.ready} onClick={ai.onRun} onCancel={ai.onCancel} label={t("aiWriteShort", lang)} title={ai.ready ? t("aiWrite", lang) : (ai.reason ?? t("aiNoKey", lang))} />
          {!!history?.length && <IconBtn icon="undo" p={p} size={40} on onClick={onRestore} title={t("aiRestore", lang)} />}
        </ButtonRun>
      </div>
    </div>
  );
}

export function FrameInspector({
  frame,
  palette: p,
  onChange,
  onDelete,
  onDuplicate,
  onPreview,
  prompt,
  onSaveImage,
  frames,
  ai,
  onSize,
}: {
  frame: Frame;
  palette: Palette;
  onChange: (patch: Partial<Frame>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
  prompt: string;
  onSaveImage: () => Promise<void>;
  frames: Frame[];
  ai: AiHooks;
  onSize: (preset: FramePreset) => void;
}) {
  const lang = useLang();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swipeDir, setSwipeDir] = useState<SwipeDir>("left");
  /* an overlay page: its level rules only show once it is one */
  const overlay = isOverlayFrame(frame);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);
  const actionBtn = (icon: string, label: string, onClick: () => void, busy?: boolean) => (
    <button
      onClick={onClick}
      disabled={busy}
      className="m3-press"
      style={{
        flex: 1,
        height: 44,
        borderRadius: 22,
        border: "none",
        background: p.secondaryContainer,
        color: p.onSecondaryContainer,
        fontSize: 13,
        fontWeight: 600,
        cursor: busy ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <Icon name={icon} size={20} />
      {label}
    </button>
  );
  return (
    <div className="no-scrollbar" style={{ padding: "12px 12px 20px", overflowY: "auto", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          padding: "6px 6px 6px 14px",
          borderRadius: 20,
          background: p.secondaryContainer,
          color: p.onSecondaryContainer,
        }}
      >
        <Icon name={isPhoneFrame(frame) ? "smartphone" : "desktop_windows"} size={20} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{t("screen", lang)}</span>
        {/* the play and copy icons read white on the screen's own bar */}
        <button
          onClick={onPreview}
          title={t("previewFrom", lang)}
          aria-label={t("previewFrom", lang)}
          className="m3-press"
          style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "transparent", color: "#ffffff", cursor: "pointer", display: "grid", placeItems: "center" }}
        >
          <Icon name="play_arrow" size={22} fill />
        </button>
        <button
          onClick={onDuplicate}
          title={t("duplicate", lang)}
          aria-label={t("duplicate", lang)}
          className="m3-press"
          style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "transparent", color: "#ffffff", cursor: "pointer", display: "grid", placeItems: "center" }}
        >
          <Icon name="content_copy" size={20} />
        </button>
        <IconBtn icon="delete" p={p} danger onClick={onDelete} title={t("delete", lang)} size={32} />
      </div>
      <Section id="frame-size" icon="aspect_ratio" title={t("frameSize", lang)} p={p}>
        <FrameSizePicker frame={frame} palette={p} onChange={onSize} />
      </Section>
      <Section id="frame-name" icon="label" title={t("name", lang)} p={p}>
        <Field value={frame.name} onChange={(name) => onChange({ name })} placeholder={t("screenName", lang)} p={p} icon={isPhoneFrame(frame) ? "smartphone" : "desktop_windows"} />
      </Section>
      {/* what this page is: somewhere the visitor goes, or something popped over a screen */}
      <Section id="frame-role" icon="picture_in_picture_alt" title={t("pageRole", lang)} p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Segmented<FrameRole>
            options={FRAME_ROLES.map((r2) => ({ key: r2.key, icon: r2.icon, title: r2.key === "overlay" ? t("roleOverlay", lang) : t("roleScreen", lang) }))}
            value={frame.role ?? "screen"}
            onChange={(role) => onChange({ role: role === "screen" ? undefined : role })}
            p={p}
            height={36}
          />
          {overlay && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("overlayLevel", lang)}</div>
              <Segmented<OverlayLevel>
                options={OVERLAY_LEVELS.map((l) => ({ key: l, icon: OVERLAY_LEVEL_ICONS[l], title: overlayLevelText(l, lang) }))}
                value={overlayLevelOfFrame(frame)}
                onChange={(level) => onChange({ level })}
                p={p}
                height={36}
              />
              <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("overlayHint", lang)}</div>
            </>
          )}
        </div>
      </Section>
      <Section id="frame-note" icon="notes" title={t("description", lang)} p={p}>
        <AiField ai={ai} history={frame.noteHistory} onRestore={() => onChange(popHistory(frame.note, frame.noteHistory, "note", "noteHistory"))} p={p} value={frame.note ?? ""} onChange={(note) => onChange({ note: note || undefined })} placeholder={t("screenDescription", lang)} />
      </Section>
      <Section id="frame-bg" icon="format_color_fill" title={t("background", lang)} p={p}>
        {overlay && overlayRuleOf(overlayLevelOfFrame(frame)).float ? (
          <div style={{ fontSize: 11, lineHeight: 1.6, color: p.outline }}>{t("overlayNoBg", lang)}</div>
        ) : (
          <TokenChips value={frame.bg ?? "surface"} onChange={(bg) => onChange({ bg })} p={p} />
        )}
      </Section>
      {frames.length > 1 && (
        <Section id="frame-swipe" icon="swipe" title={t("swipeTo", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Segmented<SwipeDir>
              options={SWIPE_DIRS.map((d) => ({ key: d.key, icon: d.icon, title: SWIPE_TEXT[lang][d.key], dot: !!frame.swipe?.[d.key] }))}
              value={swipeDir}
              onChange={setSwipeDir}
              p={p}
              height={36}
            />
            <FrameChips
              frames={frames.filter((f) => f.id !== frame.id)}
              value={frame.swipe?.[swipeDir] ?? null}
              onChange={(to) => {
                const swipe = { ...(frame.swipe ?? {}) };
                if (to) swipe[swipeDir] = to;
                else delete swipe[swipeDir];
                onChange({ swipe: Object.keys(swipe).length ? swipe : undefined });
              }}
              p={p}
              small
            />
          </div>
        </Section>
      )}
      <Section id="frame-export" icon="ios_share" title={t("export", lang)} p={p}>
        <ButtonRun>
          {actionBtn(
            copied ? "check" : "content_copy",
            copied ? t("copied", lang) : t("prompt", lang),
            async () => {
              try {
                await navigator.clipboard.writeText(prompt);
                setCopied(true);
              } catch {}
            },
          )}
          {actionBtn(
            "image",
            saving ? t("saving", lang) : t("saveImage", lang),
            async () => {
              setSaving(true);
              try {
                await onSaveImage();
              } finally {
                setSaving(false);
              }
            },
            saving,
          )}
        </ButtonRun>
        <div
          className="no-scrollbar"
          style={{
            marginTop: 10,
            maxHeight: 260,
            overflowY: "auto",
            borderRadius: 16,
            background: p.surfaceContainerLow,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.7,
            color: p.onSurfaceVariant,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {prompt}
        </div>
      </Section>
    </div>
  );
}

/** A small picture of what an alignment does: a dashed box for the reference (the screen's
 *  body for one part, the selection for several) and two bars placed the way the parts will be;
 *  spacing evenly shows three bars with equal gaps. */
function AlignGlyph({ kind, color, faint }: { kind: AlignKind; color: string; faint: string }) {
  const bars: [number, number, number, number][] =
    kind === "left" ? [[4, 7, 16, 6], [4, 15, 10, 6]]
    : kind === "centerH" ? [[12, 7, 16, 6], [15, 15, 10, 6]]
    : kind === "right" ? [[20, 7, 16, 6], [26, 15, 10, 6]]
    : kind === "distributeH" ? [[4, 8, 6, 12], [17, 8, 6, 12], [30, 8, 6, 12]]
    : kind === "top" ? [[12, 4, 6, 14], [22, 4, 6, 8]]
    : kind === "centerV" ? [[12, 7, 6, 14], [22, 10, 6, 8]]
    : kind === "bottom" ? [[12, 10, 6, 14], [22, 16, 6, 8]]
    : [[14, 4, 12, 4], [14, 12, 12, 4], [14, 20, 12, 4]];
  return (
    <svg width={40} height={28} viewBox="0 0 40 28" aria-hidden>
      <rect x={1} y={1} width={38} height={26} rx={3} fill="none" stroke={faint} strokeWidth={1} strokeDasharray="3 2" />
      {bars.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx={1.5} fill={color} />
      ))}
    </svg>
  );
}

/** The alignment controls: one row for left / centre / right, one for top / middle / bottom,
 *  each ending in "space evenly", which needs at least two parts. One part lines up with its
 *  screen's body; several line up with each other. Each button draws its result. */
function AlignSection({ single, onAlign, p }: { single: boolean; onAlign: (kind: AlignKind) => void; p: Palette }) {
  const lang = useLang();
  const rows: [AlignKind, UIKey][][] = [
    [["left", "alignLeft"], ["centerH", "alignCenterH"], ["right", "alignRight"], ["distributeH", "distributeH"]],
    [["top", "alignTop"], ["centerV", "alignCenterV"], ["bottom", "alignBottom"], ["distributeV", "distributeV"]],
  ];
  return (
    <Section id="align" icon="align_horizontal_left" title={t("align", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row, i) => (
          <ButtonRun key={i}>
            {row.map(([kind, key], j) => {
              const off = single && kind.startsWith("distribute");
              const outer = 22;
              const inner = 8;
              return (
                <button
                  key={kind}
                  onClick={() => onAlign(kind)}
                  disabled={off}
                  title={t(key, lang)}
                  aria-label={t(key, lang)}
                  className="m3-press"
                  style={{
                    flex: 1,
                    height: 44,
                    border: "none",
                    borderRadius: `${j === 0 ? outer : inner}px ${j === row.length - 1 ? outer : inner}px ${j === row.length - 1 ? outer : inner}px ${j === 0 ? outer : inner}px`,
                    background: p.surfaceContainerHigh,
                    cursor: off ? "default" : "pointer",
                    display: "grid",
                    placeItems: "center",
                    opacity: off ? 0.38 : 1,
                  }}
                >
                  <AlignGlyph kind={kind} color={off ? p.onSurfaceVariant : p.primary} faint={p.outline} />
                </button>
              );
            })}
          </ButtonRun>
        ))}
        <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant, padding: "2px 6px 0" }}>{t(single ? "alignHintOne" : "alignHintMany", lang)}</div>
      </div>
    </Section>
  );
}

export function Inspector({
  ai,
  item,
  palette: p,
  frames,
  frame,
  onChange,
  onDelete,
  onDuplicate,
  multi,
  grouped,
  railStandalone = false,
  onGroup,
  onUngroup,
  onAlign,
  onContainerize,
  onUnlink,
  dialog,
  onSaveComposite,
  childCount = 0,
  inContainer = false,
  widths = {},
  lookTargets = [],
}: {
  /** the AI button beside the behavior field */
  ai: AiHooks;
  item: Item | null;
  palette: Palette;
  frames: Frame[];
  /** frame containing the selected part; its dimensions bound size controls */
  frame?: Frame | null;
  onChange: (patch: Partial<Item>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  multi: number;
  /** the selection is exactly one hand-made group */
  grouped?: boolean;
  /** Modal expansion is available only when this rail owns its group. */
  railStandalone?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  /** lines the selected parts up with each other, or spaces them evenly */
  onAlign?: (kind: AlignKind) => void;
  /** wraps the selection in a new container box */
  onContainerize?: () => void;
  /** puts the selection inside the one box it holds (set only when that makes sense) */
  onAdopt?: () => void;
  /** takes the selection back out of the container that holds it */
  onUnlink?: () => void;
  /** what a tap can open as a dialog, and what it can be made of */
  dialog?: DialogChoices;
  /** keeps this part and everything it holds as a composite part */
  onSaveComposite?: () => void;
  /** how many parts the selected container holds */
  childCount?: number;
  /** the selected part sits inside a container */
  inContainer?: boolean;
  /** measured widths, so a scrolling container's content measures the way the canvas measures it */
  widths?: Record<string, number>;
  /** the other parts on this page, so a rule can aim a look at one of them */
  lookTargets?: { id: string; name: string }[];
}) {
  const lang = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const slots = item ? iconSlotsOf(item) : [];
  const [slotKey, setSlotKey] = useState("icon");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionSlot, setActionSlot] = useState("");
  /** editing the "on" look of a toggle button instead of its normal look */
  const [onTab, setOnTab] = useState(false);

  useEffect(() => {
    setSlotKey(item ? (iconSlotsOf(item)[0]?.key ?? "icon") : "icon");
    setPickerOpen(false);
    setActionSlot("");
    setOnTab(false);
  }, [item?.id, item?.kind, item?.tabs?.length]);

  if (!item) {
    if (multi > 1) {
      const bigBtn = (icon: string, label: string, onClick?: () => void) => (
        <button
          onClick={onClick}
          className="m3-press"
          style={{
            height: 48,
            borderRadius: 24,
            border: "none",
            background: p.primary,
            color: p.onPrimary,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
          }}
        >
          <Icon name={icon} size={22} />
          {label}
        </button>
      );
      return (
        <div className="no-scrollbar" style={{ padding: "12px 12px 20px", overflowY: "auto", height: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              padding: "6px 6px 6px 14px",
              borderRadius: 20,
              background: p.secondaryContainer,
              color: p.onSecondaryContainer,
            }}
          >
            <Icon name={grouped ? "group_work" : "select_all"} size={20} />
            <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>
              {grouped ? t("group", lang) : lang === "en" ? `${multi} ${t("selectedParts", lang)}` : `${multi}${t("selectedParts", lang)}`}
            </span>
            <IconBtn icon="delete" p={p} danger onClick={onDelete} title={t("deleteSelection", lang)} size={32} />
          </div>
          {onAlign && <AlignSection single={false} onAlign={onAlign} p={p} />}
          {grouped ? bigBtn("ungroup", t("ungroup", lang), onUngroup) : bigBtn("group_work", t("makeGroup", lang), onGroup)}
          {onContainerize && bigBtn("select_all", t("createContainer", lang), onContainerize)}
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant, padding: "0 6px" }}>
            {grouped ? t("groupEditNote", lang) : `${t("groupHint", lang)} (Ctrl+G)`}
          </div>
        </div>
      );
    }
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: p.outlineVariant,
          padding: 24,
          textAlign: "center",
        }}
      >
        <Icon name="ads_click" size={44} />
      </div>
    );
  }

  const spec = KIND_SPEC[item.kind];
  const frameSize = frame ? frameSizeOf(frame) : { w: PHONE_W, h: PHONE_H };
  /* how much room a scrolling container has to move in: its content, and its own viewport */
  const scroll = item.scroll ? scrollRange(item, widths) : { x: 0, y: 0 };
  const scrollView = sizeOf(item, widths);
  const mapWidthPreset = (v: number) =>
    v === PHONE_W ? frameSize.w : v === CONTENT_W ? contentWidth(frameSize.w) : v === HALF_W ? halfWidth(frameSize.w) : v;
  const mapHeightPreset = (v: number) => (v === PHONE_H ? frameSize.h : v === PHONE_H / 2 ? frameSize.h / 2 : v);
  const widthMax = (max: number) =>
    max === PHONE_W ? frameSize.w : max === CONTENT_W ? contentWidth(frameSize.w) : max;
  const heightMax = (max: number) => (max === PHONE_H ? frameSize.h : max);
  const editOn = !!item.toggle && onTab;
  /* the on-state is edited through the same text / icon / style controls:
   * `shown` is what they display, `change` routes their patches into `toggle` */
  const shown: Item = editOn
    ? {
        ...item,
        label: item.toggle?.label ?? item.label,
        icon: toggleIcon(item),
        variant: item.toggle?.variant ?? item.variant,
      }
    : item;
  const change = (patch: Partial<Item>) => {
    if (!editOn) {
      onChange(patch);
      return;
    }
    const next = { ...(item.toggle ?? {}) };
    if ("label" in patch) next.label = patch.label;
    if ("icon" in patch) next.icon = patch.icon;
    if ("variant" in patch) next.variant = patch.variant;
    onChange({ toggle: next });
  };
  const activeSlot: { key: string; value: string | null } | undefined = (() => {
    const s = slots.find((x) => x.key === slotKey) ?? slots[0];
    return s && editOn && s.key === "icon" ? { ...s, value: shown.icon } : s;
  })();
  const actionSlots = actionSlotsOf(item);
  const slotBtn = (key: string, label: string | undefined, icon: string | null, on: boolean, onClick: () => void, dim?: boolean) => (
    <button
      key={key}
      onClick={onClick}
      title={label}
      className="m3-press"
      style={{
        height: 44,
        minWidth: 44,
        padding: label ? "0 14px 0 10px" : 0,
        borderRadius: 22,
        border: "none",
        background: on ? p.primary : p.surfaceContainerHigh,
        color: on ? p.onPrimary : dim ? p.outline : p.onSurface,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <Icon name={icon ?? "block"} size={22} />
      {label && <span>{label}</span>}
    </button>
  );
  const tabs: NavTab[] = item.tabs ?? [];
  const variants = spec.hasVariant ? variantsOf(item.kind) : [];

  const setTabCount = (n: number, select?: number) => {
    const patch = tabCountPatch(item, n, defaultTabsFor(item.kind));
    /* a tab row carries one panel per tab, so every change to the list of tabs syncs them:
     * a row that still has no panels gets its whole set here, and a new tab brings its
     * own panel along instead of leaving the row short of one */
    const withPanels = item.kind === "tabs" ? tabPanelsPatch({ ...item, ...patch }) : null;
    const merged = withPanels ? { ...patch, ...withPanels } : patch;
    /* a tab that has just been added comes forward, so the panel that arrived with it is
     * the one on the canvas rather than one the author has to go looking for */
    onChange(select === undefined ? merged : { ...merged, selected: select });
  };
  /** entries of a tab row have no icon; toolbar buttons have no label */
  const tabIcons = item.kind !== "tabs" && item.kind !== "select";
  const tabLabels = item.kind !== "toolbar";
  const mainSlots = slots.filter((s) => !s.key.startsWith("tab:"));

  const setTabLabel = (i: number, label: string) =>
    onChange({ tabs: tabs.map((t, j) => (j === i ? { ...t, label } : t)) });
  /** bars, rails and tab rows show one destination as selected */
  const isSelect = item.kind === "select";
  /** options and tab rows grow one row at a time; bars, rails and menus keep the fixed counts M3 allows */
  const growsFreely = isSelect || item.kind === "tabs";
  const hasSelected = item.kind === "bottomNav" || item.kind === "navRail" || item.kind === "tabs" || isSelect;
  /** drops one row; the selection and the per-tab tap targets follow their rows */
  const removeOption = (i: number) => onChange(removeTabPatch(item, i));
  /* a dropdown may start with nothing chosen; bars always show one destination */
  const selectedTab = isSelect && item.selected === undefined ? -1 : Math.min(item.selected ?? 0, Math.max(0, tabs.length - 1));

  const hasRadius =
    item.kind === "bottomNav" ||
    item.kind === "navRail" ||
    item.kind === "topAppBar" ||
    item.kind === "card" ||
    item.kind === "image" ||
    item.kind === "camera" ||
    item.kind === "map" ||
    item.kind === "box";

  return (
    <div className="no-scrollbar" style={{ padding: "12px 12px 20px", overflowY: "auto", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          padding: "6px 6px 6px 14px",
          borderRadius: 20,
          background: p.secondaryContainer,
          color: p.onSecondaryContainer,
        }}
      >
        <Icon name={spec.paletteIcon} size={20} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{KIND_TEXT[lang][item.kind]?.noun ?? spec.label}</span>
        {onSaveComposite && (
          <button
            onClick={onSaveComposite}
            title={t("addToComposites", lang)}
            aria-label={t("addToComposites", lang)}
            className="m3-press"
            style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "transparent", color: "#ffffff", cursor: "pointer", display: "grid", placeItems: "center" }}
          >
            <Icon name="library_add" size={20} />
          </button>
        )}
        <button
          onClick={onDuplicate}
          title={t("duplicateKey", lang)}
          aria-label={t("duplicateKey", lang)}
          className="m3-press"
          style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "transparent", color: "#ffffff", cursor: "pointer", display: "grid", placeItems: "center" }}
        >
          <Icon name="content_copy" size={20} />
        </button>
        <IconBtn icon="delete" p={p} danger onClick={onDelete} title={t("delete", lang)} size={32} />
      </div>

      {onAlign && !editOn && <AlignSection single onAlign={onAlign} p={p} />}

      {(spec.hasLabel || spec.hasSupporting) && (
        <Section id="text" icon="title" title={t("text", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {spec.hasLabel && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Field
                  value={shown.label}
                  onChange={(label) => change({ label })}
                  placeholder={t("label", lang)}
                  p={p}
                  icon="short_text"
                />
                {item.kind === "text" && (
                  <IconBtn
                    icon="format_bold"
                    p={p}
                    size={44}
                    on={!!item.bold}
                    onClick={() => onChange({ bold: !item.bold })}
                    title={t("bold", lang)}
                  />
                )}
              </div>
            )}
            {spec.hasSupporting && !editOn && (
              /* a card's body is a paragraph: the field wraps and grows with it, and the canvas wraps the text itself */
              <Field
                value={item.supporting ?? ""}
                onChange={(supporting) => onChange({ supporting })}
                placeholder={item.kind === "snackbar" ? t("action", lang) : t("supporting", lang)}
                p={p}
                icon="notes"
                multiline={item.kind === "card"}
                rows={1}
                grow={item.kind === "card"}
              />
            )}
            {item.kind === "card" && !editOn && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("textPosition", lang)}</span>
                  <Segmented<CardAlign>
                    options={[
                      { key: "start", icon: "vertical_align_top", title: t("textTop", lang) },
                      { key: "center", icon: "vertical_align_center", title: t("textMiddle", lang) },
                      { key: "end", icon: "vertical_align_bottom", title: t("textBottom", lang) },
                    ]}
                    value={cardContentAlignOf(item)}
                    onChange={(contentAlign) => onChange({ contentAlign })}
                    p={p}
                    height={32}
                    grow={false}
                  />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("textColor", lang)}</div>
                <TextTokenChips value={item.textColor} auto={cardTextColorOf(item, p)} onChange={(textColor) => onChange({ textColor })} p={p} />
              </>
            )}
          </div>
        </Section>
      )}

      {spec.hasTabs && !editOn && (
        <Section id="tabs" icon={isSelect ? "list" : "view_column"} title={t(isSelect ? "options" : "tabs", lang)} p={p} onToggle={(open) => { if (!open && activeSlot?.key.startsWith("tab:")) setPickerOpen(false); }}>
          {/* how the row reads, and the panels it switches between */}
          {item.kind === "tabs" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("tabStyle", lang)}</div>
              <Segmented<TabStyle>
                options={TAB_STYLES.map((o) => ({ key: o.key, icon: o.icon, title: t(o.key === "buttons" ? "tabStyleButtons" : "tabStyleUnderline", lang) }))}
                value={tabStyleOf(item)}
                onChange={(tabStyle) => onChange({ tabStyle })}
                p={p}
                height={36}
              />
              {/* panels are made with the tabs themselves: there is nothing extra to press, so the
                  section only explains how the panels work — and, while a row is still short of
                  them, that adding a tab is what brings the missing ones in */}
              <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t(needsTabPanels(item) ? "tabPanelsAuto" : "tabPanelsHint", lang)}</div>
            </div>
          )}
          {!growsFreely && (item.kind === "bottomNav" || item.kind === "navRail") ? (
            /* a navigation bar or rail takes exactly as many destinations as it is asked for */
            <Slider
              icon="view_column"
              title={t("tabs", lang)}
              value={tabs.length}
              min={1}
              max={12}
              step={1}
              onChange={setTabCount}
              p={p}
            />
          ) : !growsFreely ? (
            <Segmented
              options={(item.kind === "toolbar" ? [2, 3, 4, 5, 6] : [2, 3, 4, 5]).map((n) => ({ key: String(n), label: String(n) }))}
              value={String(tabs.length)}
              onChange={(k) => setTabCount(Number(k))}
              p={p}
              height={36}
            />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {tabs.map((tab, i) => {
              const on = slotKey === `tab:${i}` && pickerOpen;
              return (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {hasSelected && (
                    <IconBtn
                      icon={selectedTab === i ? "radio_button_checked" : "radio_button_unchecked"}
                      p={p}
                      size={40}
                      on={selectedTab === i}
                      onClick={() => onChange({ selected: isSelect && selectedTab === i ? undefined : i })}
                      title={t(isSelect ? "selectedOption" : "selectedTab", lang)}
                    />
                  )}
                  {tabIcons && (
                  <button
                    onClick={() => {
                      setSlotKey(`tab:${i}`);
                      setPickerOpen(!on);
                    }}
                    title={t("changeIcon", lang)}
                    aria-label={t("changeIcon", lang)}
                    aria-expanded={on}
                    className="m3-press"
                    style={{
                      width: 40,
                      height: 40,
                      flex: "0 0 auto",
                      borderRadius: 20,
                      border: "none",
                      background: on ? p.primary : p.surfaceContainerHigh,
                      color: on ? p.onPrimary : p.onSurfaceVariant,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon name={tab.icon || "add"} size={20} />
                  </button>
                  )}
                  {tabLabels && <Field value={tab.label} onChange={(v) => setTabLabel(i, v)} placeholder={t("label", lang)} p={p} height={40} />}
                  {tabIcons && tab.icon && (
                    <IconBtn icon="close" p={p} size={40} onClick={() => onChange(setIconSlot(item, `tab:${i}`, null))} title={t("noIcon", lang)} />
                  )}
                  {growsFreely && tabs.length > 1 && (
                    <IconBtn icon="close" p={p} size={40} onClick={() => removeOption(i)} title={t(isSelect ? "removeOption" : "removeTab", lang)} />
                  )}
                </div>
              );
            })}
          </div>
          {growsFreely && (
            <button
              onClick={() => setTabCount(tabs.length + 1, item.kind === "tabs" ? tabs.length : undefined)}
              className="m3-press"
              style={{ marginTop: 8, height: 40, width: "100%", borderRadius: 20, border: `1px solid ${p.outline}`, background: "transparent", color: p.primary, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <Icon name="add" size={18} />
              {t(isSelect ? "addOption" : "addTab", lang)}
            </button>
          )}
          {hasSelected && !isSelect && (
            <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant, padding: "8px 6px 0" }}>{t("selectedHint", lang)}</div>
          )}
        </Section>
      )}

      {(item.kind === "image" || item.kind === "card") && !editOn && (
        <Section id="image" icon="image" title={t("image", lang)} p={p}>
          {item.kind === "card" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              <CardLayoutPicker value={cardLayoutOf(item)} onChange={(layout) => onChange(cardLayoutPatch(layout))} p={p} />
              {!item.noImage && cardImagePosOf(item) !== "background" && cardImageMaxOf(item) > CARD_IMAGE_MIN && (
                /* the image area's one free dimension: its height on top, its width at a side; a card too small to leave room hides it */
                <Slider
                  icon={cardImagePosOf(item) === "top" ? "height" : "width"}
                  title={t(cardImagePosOf(item) === "top" ? "height" : "width", lang)}
                  value={cardImageSizeOf(item)}
                  min={CARD_IMAGE_MIN}
                  max={cardImageMaxOf(item)}
                  step={4}
                  onChange={(imageSize) => onChange({ imageSize })}
                  p={p}
                />
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.svg"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                onChange({ src: await readImage(f) });
              } catch {}
            }}
          />
          {(!item.noImage || item.src) && (<>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={() => fileRef.current?.click()}
              className="m3-press"
              style={{
                flex: 1,
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
              <Icon name="upload" size={20} />
              {t("pickImage", lang)}
            </button>
            {item.src && (
              <IconBtn icon="close" p={p} size={44} onClick={() => onChange({ src: undefined })} title={t("removeImage", lang)} />
            )}
          </div>
          {/* a picture on the web by its address; a picked file shows as data and is not editable here */}
          <div style={{ marginTop: 8 }}>
            <UrlField key={item.id} value={item.src && /^https?:\/\//.test(item.src) ? item.src : ""} onChange={(src) => onChange({ src })} placeholder={t("imageUrl", lang)} p={p} />
          </div>
          </>)}
        </Section>
      )}

      {mainSlots.length > 0 && activeSlot && !item.src && (
        <Section id="icon" icon="emoji_symbols" title={t("icon", lang)} p={p} onToggle={(open) => { if (!open && !activeSlot.key.startsWith("tab:")) setPickerOpen(false); }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {mainSlots.map((s) =>
              slotBtn(
                s.key,
                mainSlots.length > 1 ? s.label : undefined,
                editOn && s.key === "icon" ? shown.icon : s.value,
                s.key === activeSlot.key && pickerOpen,
                () => {
                  const on = s.key === activeSlot.key && pickerOpen;
                  setSlotKey(s.key);
                  setPickerOpen(!on);
                },
                !s.value,
              ),
            )}
            {activeSlot.value && !activeSlot.key.startsWith("tab:") && (
              <IconBtn
                icon="close"
                p={p}
                size={44}
                onClick={() => {
                  // a slot without an icon cannot be tapped, so its action goes too
                  const patch: Partial<Item> = setIconSlot(item, activeSlot.key, null);
                  if (!editOn && item.actions?.[activeSlot.key]) {
                    const actions = { ...item.actions };
                    delete actions[activeSlot.key];
                    patch.actions = Object.keys(actions).length ? actions : undefined;
                  }
                  change(patch);
                }}
                title={t("noIcon", lang)}
              />
            )}
          </div>
        </Section>
      )}

      {pickerOpen && activeSlot && (
        <div style={{ margin: "-4px 4px 12px" }}>
          <IconPicker
            value={activeSlot.value}
            onChange={(icon) => change(setIconSlot(item, activeSlot.key, icon))}
            onClose={() => setPickerOpen(false)}
            palette={p}
          />
        </div>
      )}

      {variants.length > 0 && item.kind !== "card" && (
        <Section id="style" icon="palette" title={t("style", lang)} p={p}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {variants.map((v) => (
              <VariantSwatch
                key={v.key}
                v={v.key}
                label={v.label}
                p={p}
                on={shown.variant === v.key}
                onClick={() => change({ variant: v.key })}
              />
            ))}
          </div>
        </Section>
      )}

      {item.kind === "bottomNav" && !editOn && (
        <Section id="bar-fold" icon="unfold_more" title={t("navToggle", lang)} p={p}>
          <Toggle
            on={item.barFolded !== undefined}
            onChange={(on) => onChange({ barFolded: on ? false : undefined })}
            p={p}
            icon="chevron_left"
            label={t("navToggleLabel", lang)}
          />
        </Section>
      )}

      {(item.kind === "bottomNav" || item.kind === "navRail") && !editOn && (
        <Section id="nav-lines" icon="view_column" title={t("navPerRow", lang)} p={p}>
          <Slider
            icon="view_column"
            title={t("navPerRow", lang)}
            value={item.navPerRow ?? Math.max(1, (item.tabs ?? []).length)}
            min={1}
            max={12}
            step={1}
            onChange={(navPerRow) => onChange({ navPerRow })}
            p={p}
          />
        </Section>
      )}

      {SHAPED.includes(item.kind) && !editOn && (() => {
        /* An icon button and a FAB are circles by nature, so the shapes they can take are the circle
         * and the rounded square — the pill is a button's own. The switch also *shows* which one the
         * part wears, so the round one never looks like it did nothing. */
        const round = roundByNature(item.kind);
        const shapes = round ? ROUND_SHAPES : BUTTON_SHAPES;
        const value: ButtonShape = round ? (item.shape === "square" ? "square" : "round") : item.shape ?? "default";
        return (
          <Section id="button-shape" icon="category" title={t("buttonShape", lang)} p={p}>
            <Segmented<ButtonShape>
              options={shapes.map((sh) => ({ key: sh.key, icon: sh.icon, title: t(`shape_${sh.key}` as UIKey, lang) }))}
              value={value}
              onChange={(shape) =>
                onChange(
                  shape === "round"
                    ? { shape, ...(round ? undefined : { size: H }) }
                    : shape === "square"
                      ? { shape }
                      : { shape: undefined, ...(round ? undefined : { size: undefined }) },
                )
              }
              p={p}
            />
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant }}>{t("buttonShapeHint", lang)}</div>
          </Section>
        );
      })()}

      {/* a container's colour comes from its own colour control, so its fill row is gone */}
      {spec.hasFill && item.kind !== "box" && !editOn && (
        <Section id="fill" icon="format_color_fill" title={t("background", lang)} p={p}>
          <TokenChips
            value={item.kind === "card" ? cardFillOf(item) : (item.fill ?? "surfaceContainerLow")}
            onChange={(fill) => onChange({ fill })}
            p={p}
            /* a card's fallback is its own tonal colour; a progress bar's track is simply not there */
            none={item.kind === "card" || item.kind === "progressBar"}
            noneOn={(item.kind === "card" || item.kind === "progressBar") && !item.fill}
            onNone={() => onChange({ fill: undefined })}
            noneColor={item.kind === "card" ? p[cardDefaultFillOf(item.variant)] : undefined}
            noneTextColor={item.kind === "card" ? onToken(cardDefaultFillOf(item.variant), p) : undefined}
            noneIcon={item.kind === "card" ? "restart_alt" : undefined}
            noneLabel={item.kind === "card" ? t("defaultColor", lang) : undefined}
          />
          {item.kind === "listItem" && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant, margin: "10px 0 6px" }}>{t("iconBackground", lang)}</div>
              <TokenChips
                value={item.iconFill && item.iconFill !== "none" ? item.iconFill : "primaryContainer"}
                onChange={(iconFill) => onChange({ iconFill })}
                p={p}
                none
                noneOn={item.iconFill === "none"}
                onNone={() => onChange({ iconFill: "none" })}
              />
            </>
          )}
        </Section>
      )}

      {/* every part can wear a border of its own, of any thickness and colour */}
      {!editOn && (
        <Section id="stroke" icon="border_style" title={t("stroke", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Slider
              icon="line_weight"
              title={t("stroke", lang)}
              value={item.strokeWidth ?? 0}
              min={0}
              max={5}
              step={1}
              onChange={(strokeWidth) => onChange({ strokeWidth })}
              p={p}
            />
            <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("strokeColorLabel", lang)}</div>
            <ItemColorChips value={item.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} p={p} />
            <div style={{ fontSize: 11, lineHeight: 1.4, color: p.outline }}>{t("strokeHint", lang)}</div>
          </div>
        </Section>
      )}

      {/* every part carries a colour and a level of its own, whatever its kind */}
      {!editOn && (
        <Section id="appearance" icon="format_paint" title={t("appearance", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("bgColor", lang)}</div>
            <ItemColorChips value={item.color} onChange={(color) => onChange({ color })} p={p} />
            <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant, marginTop: 4 }}>{t("layer", lang)}</div>
            <Slider
              icon="layers"
              title={t("layer", lang)}
              value={layerOf(item)}
              min={0}
              max={99}
              step={1}
              onChange={(z) => onChange({ z })}
              p={p}
            />
            <div style={{ fontSize: 11, lineHeight: 1.4, color: p.outline }}>{t("layerHint", lang)}</div>
          </div>
        </Section>
      )}

      {/* an in-page overlay is graded the same way an overlay page is: the level decides the
          scrim, whether the screen behind stays live, and what the back key closes */}
      {isOverlayItem(item) && !editOn && (
        <Section id="overlay" icon="picture_in_picture_alt" title={t("roleOverlay", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Segmented<OverlayLevel>
              options={OVERLAY_LEVELS.map((l) => ({ key: l, icon: OVERLAY_LEVEL_ICONS[l], title: overlayLevelText(l, lang) }))}
              value={overlayLevelOf(item) ?? DEFAULT_OVERLAY_LEVEL}
              onChange={(overlay) => onChange({ overlay })}
              p={p}
              height={36}
            />
            <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("overlayHint", lang)}</div>
          </div>
        </Section>
      )}

      {(spec.hasChecked || spec.hasValue || spec.hasWavy || spec.hasContained || spec.hasScroll || item.kind === "listItem") && !editOn && (
        <Section id="state" icon="tune" title={t("state", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "2px 0" }}>
            {item.kind === "listItem" && (
              /* a switch at the trailing end takes the place of the trailing icon */
              <Toggle on={!!item.switch} onChange={(on) => onChange({ switch: on || undefined })} p={p} icon="toggle_on" label={t("listSwitch", lang)} grow />
            )}
            {item.kind === "listItem" && item.switch && (
              <Toggle on={!!item.checked} onChange={(checked) => onChange({ checked })} p={p} icon="toggle_on" label={t("on", lang)} grow />
            )}
            {spec.hasChecked && (
              <Toggle
                on={!!item.checked}
                onChange={(checked) => onChange({ checked })}
                p={p}
                icon={item.kind === "chip" ? "check_circle" : "toggle_on"}
                label={item.kind === "chip" ? t("selected", lang) : t("on", lang)}
                grow
              />
            )}
            {item.kind === "switch" && (
              <Toggle on={!item.noCheck} onChange={(on) => onChange({ noCheck: on ? undefined : true })} p={p} icon="check" label={t("thumbCheck", lang)} grow />
            )}
            {spec.hasContained && (
              <Toggle
                on={!!item.contained}
                onChange={(contained) => onChange({ contained })}
                p={p}
                icon="circle"
                label={t("container", lang)}
                grow
              />
            )}
            {spec.hasWavy && (
              <Toggle on={!!item.wavy} onChange={(wavy) => onChange({ wavy })} p={p} icon="airwave" label={t("wavy", lang)} grow />
            )}
            {spec.hasScroll && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("scroll", lang)}</div>
                <Segmented<string>
                  options={[
                    { key: "none", icon: "block", label: t("scrollNone", lang), title: t("scrollNone", lang) },
                    { key: "y", icon: "swap_vert", label: t("scrollY", lang), title: t("scrollY", lang) },
                    { key: "x", icon: "swap_horiz", label: t("scrollX", lang), title: t("scrollX", lang) },
                    { key: "both", icon: "open_with", label: t("scrollBoth", lang), title: t("scrollBoth", lang) },
                  ]}
                  value={item.scroll ?? "none"}
                  /* what the visitor can move along; nothing to move when it is turned off */
                  onChange={(k) => onChange({ scroll: k === "none" ? undefined : (k as ScrollAxis), scrollPos: undefined })}
                  p={p}
                  height={36}
                />
                {item.scroll &&
                  (["y", "x"] as const)
                    /* only an axis with room to move gets a slider: a slider that cannot move is a
                       slider the author drags and watches snap back */
                    .filter((axis) => item.scroll === axis || item.scroll === "both")
                    .filter((axis) => (axis === "y" ? scroll.y : scroll.x) > 0)
                    .map((axis) => (
                      <Slider
                        key={axis}
                        icon={axis === "y" ? "swap_vert" : "swap_horiz"}
                        title={t(axis === "y" ? "scrollY" : "scrollX", lang)}
                        /* where the content starts: the state the author designs, and where the
                           visitor finds it */
                        value={(axis === "y" ? item.scrollPos?.y : item.scrollPos?.x) ?? 0}
                        min={0}
                        max={axis === "y" ? scroll.y : scroll.x}
                        step={4}
                        onChange={(v) => onChange({ scrollPos: { ...item.scrollPos, [axis]: v || undefined } })}
                        p={p}
                        unit="dp"
                      />
                    ))}
                {item.scroll && (
                  <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>
                    {(() => {
                      const content = Math.round(item.scroll === "x" ? scrollView.w + scroll.x : scrollView.h + scroll.y);
                      const view = Math.round(item.scroll === "x" ? scrollView.w : scrollView.h);
                      /* an empty container and one whose content fits both leave the slider with
                         nothing to move, and each says which of the two it is */
                      if (!(item.children?.length ?? 0)) return t("scrollEmpty", lang);
                      const room = (item.scroll === "x" ? scroll.x : scroll.y) > 0;
                      return t(room ? "scrollHint" : "scrollFits", lang).replace("{c}", String(content)).replace("{v}", String(view));
                    })()}
                  </div>
                )}
              </div>
            )}
            {spec.hasValue && item.kind !== "slider" && item.kind !== "progressBar" && (
              <Toggle
                on={item.value !== undefined}
                onChange={(on) => onChange({ value: on ? 60 : undefined })}
                p={p}
                icon="percent"
                label={t("determinate", lang)}
                grow
              />
            )}
            {/* a progress bar always shows a share of its track: it has no looping state to be in */}
            {spec.hasValue && (item.kind === "slider" || item.kind === "progressBar" || item.value !== undefined) && (
              <Slider
                icon="percent"
                value={item.value ?? 40}
                min={0}
                max={100}
                step={1}
                onChange={(value) => onChange({ value })}
                p={p}
                unit="%"
              />
            )}
          </div>
        </Section>
      )}

      {item.kind === "navRail" && !editOn && (
        <Section id="rail" icon="side_navigation" title={t("railState", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* one switch: on gives the rail its "V" / turned-around "V" button */}
            <Toggle
              on={isWideRail(item)}
              onChange={(on) => onChange(on ? { railExpanded: true, railFolded: false } : { railExpanded: undefined, railFolded: undefined, railModal: undefined })}
              p={p}
              icon="unfold_more"
              label={t("navToggleLabel", lang)}
            />
          </div>
        </Section>
      )}

      {(spec.size || hasRadius) && !editOn && (
        <Section id="size" icon="straighten" title={t("size", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {spec.hasWavy && (
              <Slider
                icon="line_weight"
                title={t("trackThickness", lang)}
                value={progressThickness(item)}
                min={TRACK_MIN}
                max={item.kind === "circularProgress" ? maxRingThickness(item.size ?? spec.w) : TRACK_MAX}
                step={1}
                onChange={(trackThickness) => onChange({ trackThickness: trackThickness === TRACK_DEFAULT ? undefined : trackThickness })}
                p={p}
              />
            )}
            {spec.size && (
              <>
                <Slider
                  icon={spec.size.icon}
                  title={
                    item.kind === "text"
                      ? t("fontSize", lang)
                      : spec.size.icon === "width"
                        ? t("width", lang)
                        : t("size", lang)
                  }
                  /* a rail's width comes from its own makeup until the author sets one */
                  value={item.kind === "navRail" ? railWidth(item) : item.size ?? spec.defSize ?? spec.w}
                  min={spec.size.min}
                  max={widthMax(spec.size.max)}
                  step={spec.size.step}
                  onChange={(size) => onChange({ size })}
                  p={p}
                  unit={item.kind === "text" ? "sp" : ""}
                />
                {spec.size.presets && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {(item.kind === "button" || item.kind === "switch" || item.kind === "badge") && (
                      /* these are as wide as their text unless a width was set; this chip goes back to that */
                      <button
                        onClick={() => onChange({ size: undefined })}
                        aria-pressed={item.size === undefined}
                        className="m3-press"
                        style={{
                          height: 28,
                          padding: "0 12px",
                          borderRadius: 14,
                          border: "none",
                          background: item.size === undefined ? p.secondaryContainer : p.surfaceContainerHigh,
                          color: item.size === undefined ? p.onSecondaryContainer : p.onSurfaceVariant,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {t("autoWidth", lang)}
                      </button>
                    )}
                    <SizePresets
                      values={[...new Set([...(frameSize.w !== PHONE_W && spec.size.icon === "width" && spec.size.presets.includes(CONTENT_W) ? [CONTENT_W] : []), ...spec.size.presets.map(mapWidthPreset)])].sort((a, b) => a - b)}
                      value={item.kind === "navRail" ? railWidth(item) : item.size ?? spec.defSize ?? spec.w}
                      min={spec.size.min}
                      max={widthMax(spec.size.max)}
                      onChange={(size) => onChange({ size })}
                      p={p}
                      labelOf={item.kind === "text" ? undefined : (v) => widthPresetLabel(v, frameSize.w)}
                    />
                  </div>
                )}
              </>
            )}
            {spec.size2 && (
              <>
                <Slider
                  icon={spec.size2.icon}
                  title={t("height", lang)}
                  /* the height it draws when the author has set none: a badge with no number is the
                     small dot, not the numbered pill */
                  value={item.size2 ?? (item.kind === "badge" && !item.label.trim() ? 6 : spec.h)}
                  min={spec.size2.min}
                  max={heightMax(spec.size2.max)}
                  step={spec.size2.step}
                  onChange={(size2) => onChange({ size2 })}
                  p={p}
                />
                {spec.size2.presets && (
                  <SizePresets
                    values={[...new Set(spec.size2.presets.map(mapHeightPreset))]}
                    value={item.size2 ?? spec.h}
                    min={spec.size2.min}
                    max={heightMax(spec.size2.max)}
                    onChange={(size2) => onChange({ size2 })}
                    p={p}
                    labelOf={(v) => heightPresetLabel(v, frameSize.h)}
                  />
                )}
              </>
            )}
            {hasRadius && item.kind === "image" && (
              <Slider
                icon="rounded_corner"
                title={t("cornerRadius", lang)}
                value={item.radiusTop ?? spec.radius}
                min={0}
                max={48}
                step={1}
                onChange={(radiusTop) => onChange({ radiusTop })}
                p={p}
              />
            )}
            {hasRadius && (item.kind === "card" || item.kind === "box") && (() => {
              /* One radius for every corner until the author asks for each. The seeds match what the
               * canvas draws: a box's unset side is 0, a card's unset radius is the scaled kind default.
               * A box saved with different top and bottom radii opens straight in per-corner mode. */
              const isBox = item.kind === "box";
              const top = item.radiusTop ?? (isBox ? 0 : scaleR(spec.radius));
              const bottom = isBox ? (item.radiusBottom ?? 0) : top;
              const corners = item.corners ?? (isBox && top !== bottom ? { tl: top, tr: top, bl: bottom, br: bottom } : undefined);
              return (
                <>
                  {!corners && (
                    <Slider
                      icon="rounded_corner"
                      title={t("cornerRadius", lang)}
                      value={top}
                      min={0}
                      max={48}
                      step={1}
                      onChange={(r) => onChange(isBox ? { radiusTop: r, radiusBottom: r } : { radiusTop: r })}
                      p={p}
                    />
                  )}
                  <Toggle
                    on={!!corners}
                    onChange={(each) =>
                      onChange(
                        each
                          ? { corners: { tl: top, tr: top, bl: bottom, br: bottom } }
                          : { corners: undefined, radiusTop: corners?.tl ?? top, radiusBottom: isBox ? (corners?.tl ?? top) : undefined },
                      )
                    }
                    p={p}
                    icon="crop_free"
                    label={t("cornersEach", lang)}
                    grow
                  />
                  {corners &&
                    (["tl", "tr", "bl", "br"] as const).map((k) => (
                      <Slider
                        key={k}
                        iconNode={<CornerIcon side={k} />}
                        title={t(k === "tl" ? "cornerTl" : k === "tr" ? "cornerTr" : k === "bl" ? "cornerBl" : "cornerBr", lang)}
                        value={corners[k]}
                        min={0}
                        max={48}
                        step={1}
                        onChange={(v) => onChange({ corners: { ...corners, [k]: v } })}
                        p={p}
                      />
                    ))}
                </>
              );
            })()}
            {hasRadius && (item.kind === "bottomNav" || item.kind === "navRail" || item.kind === "topAppBar") && (
              <>
                {/* a rail's two sliders are its left and right sides; the fields are shared with the bars */}
                <Slider
                  iconNode={<CornerIcon side={item.kind === "navRail" ? "left" : "top"} />}
                  title={t(item.kind === "navRail" ? "cornerLeft" : "cornerTop", lang)}
                  value={item.radiusTop ?? 0}
                  min={0}
                  max={40}
                  step={1}
                  onChange={(radiusTop) => onChange({ radiusTop })}
                  p={p}
                />
                <Slider
                  iconNode={<CornerIcon side={item.kind === "navRail" ? "right" : "bottom"} />}
                  title={t(item.kind === "navRail" ? "cornerRight" : "cornerBottom", lang)}
                  value={item.radiusBottom ?? 0}
                  min={0}
                  max={40}
                  step={1}
                  onChange={(radiusBottom) => onChange({ radiusBottom })}
                  p={p}
                />
              </>
            )}
          </div>
        </Section>
      )}

      {!editOn && (
      <Section id="note" icon="bolt" title={t("behavior", lang)} p={p}>
        <AiField
          ai={ai}
          history={item.noteHistory}
          onRestore={() => onChange(popHistory(item.note, item.noteHistory, "note", "noteHistory"))}
          p={p}
          value={item.note ?? ""}
          onChange={(note) => onChange({ note })}
          placeholder={item.kind === "button" || item.kind === "fab" || item.kind === "iconButton" || item.kind === "extendedFab" ? t("whenPressed", lang) : t("whatItDoes", lang)}
        />
      </Section>
      )}

      {/* what the part does after it has been tapped: grey out, cool down, change or go */}
      {!editOn && (
        <Section id="transitions" icon="change_circle" title={t("transitions", lang)} p={p}>
          <StateRules
            item={item}
            p={p}
            lang={lang}
            onChange={onChange}
            frames={frames}
            dialog={dialog}
            slots={actionSlots}
            lookTargets={lookTargets}
            slot={actionSlot}
            onSlot={setActionSlot}
          />
        </Section>
      )}
    </div>
  );
}

/** the i18n key each rule action's label lives under */
const RULE_LABEL: Record<RuleAction["kind"], UIKey> = {
  goto: "ruleGoto",
  back: "ruleBack",
  close: "ruleClose",
  look: "ruleLook",
};

/** The two things a tap can do about a dialog: make one, or open one that is already there. */
export type DialogChoice = { kind: "new" } | { kind: "existing"; id: string };
export type DialogChoices = {
  /** every dialog already in the document */
  dialogs: DialogRef[];
  /** Binds the chosen dialog to one tap: `target` is the destination of a bar the tap belongs to,
   *  and null when the tap is the part's own. */
  choose: (choice: DialogChoice, target: string | null) => void;
};

/**
 * What a tap opens as a dialog: a new one, or one the document already has. Two choices, and that is
 * all — the author asked for exactly that, and anything more turned a one-tap decision into a menu.
 */
function DialogBody({
  dialog,
  boundId,
  onChoose,
  p,
}: {
  /** every dialog the document already has, and what a new one is made of */
  dialog: DialogChoices;
  /** the dialog this tap opens now, if any */
  boundId: string | null;
  /** binds the chosen dialog to the tap the author is working on */
  onChoose: (choice: DialogChoice) => void;
  p: Palette;
}) {
  const lang = useLang();
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState("");
  const s2 = q.trim().toLowerCase();
  const name = (d: DialogRef) => d.label.trim() || t("dialog", lang);
  const list = s2 ? dialog.dialogs.filter((d) => name(d).toLowerCase().includes(s2)) : dialog.dialogs;
  const row: React.CSSProperties = {
    height: 40,
    borderRadius: 12,
    border: "none",
    textAlign: "left",
    padding: "0 12px",
    background: "transparent",
    color: p.onSurface,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    whiteSpace: "nowrap",
  };
  if (!pick) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button type="button" onClick={() => onChoose({ kind: "new" })} className="m3-press" style={{ ...row, background: p.secondaryContainer, color: p.onSecondaryContainer }}>
          <Icon name="add" size={20} />
          {t("dialogNew", lang)}
        </button>
        <button
          type="button"
          onClick={() => setPick(true)}
          disabled={dialog.dialogs.length === 0}
          className="m3-press"
          style={{ ...row, border: `1px solid ${p.outlineVariant}`, opacity: dialog.dialogs.length ? 1 : 0.5, cursor: dialog.dialogs.length ? "pointer" : "default" }}
        >
          <Icon name="layers" size={18} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{t("dialogExisting", lang)}</span>
          <Icon name="chevron_right" size={16} />
        </button>
        {dialog.dialogs.length === 0 && <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("dialogNone", lang)}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <IconBtn
          icon="arrow_back"
          p={p}
          size={30}
          title={t("back", lang)}
          onClick={() => {
            setPick(false);
            setQ("");
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant, flex: 1, minWidth: 0 }}>{t("dialogExisting", lang)}</span>
      </div>
      <Field value={q} onChange={setQ} placeholder={t("search", lang)} p={p} icon="search" height={40} />
      <div className="no-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 240, overflowY: "auto" }}>
        {list.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onChoose({ kind: "existing", id: d.id })}
            className="m3-press"
            style={{ ...row, background: d.id === boundId ? p.secondaryContainer : "transparent", color: d.id === boundId ? p.onSecondaryContainer : p.onSurface }}
          >
            <Icon name={d.page ? "picture_in_picture_alt" : "chat_bubble"} size={18} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 400 }}>{name(d)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: p.onSurfaceVariant }}>{overlayLevelText(d.level, lang)}</span>
          </button>
        ))}
        {list.length === 0 && <div style={{ padding: 12, fontSize: 12, color: p.outline, textAlign: "center" }}>{t("searchOff", lang)}</div>}
      </div>
    </div>
  );
}

/** the "add one more" button these panels share: a dashed line that reads as an empty slot */
const dashedStyle = (p: Palette): React.CSSProperties => ({
  minHeight: 32,
  padding: "0 10px",
  borderRadius: 16,
  border: `1px dashed ${p.outline}`,
  background: "transparent",
  color: p.onSurfaceVariant,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
});

/** the card one node or one step of a flow is drawn in */
const cardStyle = (p: Palette): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  borderRadius: 14,
  background: p.surfaceContainerLow,
});

/** The action a picker asks for, keeping what still applies: switching to a jump keeps the page it
 *  went to, and switching to a look starts from the part as it is drawn now. */
function seededAction(kind: RuleAction["kind"], from: RuleAction, item: Item, frames: Frame[]): RuleAction {
  if (kind === "goto") return { kind, to: from.kind === "goto" ? from.to : frames[0]?.id ?? "", transition: "slide" };
  if (kind === "look") return { kind, icon: item.icon ?? undefined };
  return { kind: kind as "back" | "close" };
}

/** The fields one rule action needs, under the picker that chose it. */
function ActionFields({
  action,
  onChange,
  frames,
  item,
  lookTargets = [],
  p,
}: {
  action: RuleAction;
  onChange: (a: RuleAction) => void;
  frames: Frame[];
  /** the part the action belongs to: a look starts from what it shows now */
  item: Item;
  /** the other parts on the page, for a look aimed at one of them */
  lookTargets?: { id: string; name: string }[];
  p: Palette;
}) {
  const lang = useLang();
  const a = action;
  return (
    <>
      {a.kind === "goto" && (
        <>
          <FrameSelect frames={frames} value={a.to || null} onChange={(to) => to && onChange({ ...a, to })} p={p} />
          {a.to !== BACK_TARGET && <TransitionPicker value={a.transition} onChange={(transition) => onChange({ ...a, transition })} p={p} />}
        </>
      )}
      {a.kind === "look" && (
        <>
          {/* what the part looks like: the same choices a look elsewhere offers, and it can be aimed
              at another part of the same page — the gift a claim button marks as claimed */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant, flex: "0 0 auto" }}>{t("lookTarget", lang)}</span>
            <Pick
              options={[{ key: "", label: t("lookSelf", lang) }, ...lookTargets.map((x) => ({ key: x.id, label: x.name }))]}
              value={a.target ?? ""}
              onChange={(target) => onChange({ ...a, target: target || undefined })}
              p={p}
              title={t("lookTarget", lang)}
            />
          </div>
          <IconPicker value={a.icon ?? null} onChange={(icon) => onChange({ ...a, icon: icon ?? "" })} onClose={() => {}} palette={p} />
          {/* each field says what it is: a look changes one thing, and a title is cheaper than
              guessing which row the text field is */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("lookText", lang)}</div>
            {/* the words a look puts on the part: a text box that wraps and grows, since the line
                may be a whole sentence and the canvas wraps it itself */}
            <Field value={a.label ?? ""} onChange={(label) => onChange({ ...a, label })} p={p} placeholder={t("label", lang)} icon="edit" multiline rows={1} grow />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("lookColor", lang)}</div>
            {/* the one colour, not a palette to choose from alongside it: a look recolours a part,
                it does not restyle the scheme */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CustomColorDisc value={a.color} onChange={(color) => onChange({ ...a, color })} p={p} />
              {a.color !== undefined && (
                <button
                  type="button"
                  onClick={() => onChange({ ...a, color: undefined })}
                  className="m3-press"
                  style={{ height: 30, padding: "0 12px", borderRadius: 15, border: `1px solid ${p.outlineVariant}`, background: "transparent", color: p.onSurfaceVariant, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  {t("autoColor", lang)}
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("ruleLookHint", lang)}</div>
        </>
      )}
    </>
  );
}

/* ---------- the state machine, drawn as a flow ---------- */

/** The fields a look may change about the part. Everything else follows the part itself, so an
 *  author editing the button still moves every node that never overrode that field. */
const LOOK_FIELDS: { key: "label" | "icon" | "color" | "variant" | "disabled" | "grow" | "hidden"; icon: string; title: UIKey }[] = [
  { key: "label", icon: "edit", title: "state_label" },
  { key: "icon", icon: "emoji_symbols", title: "state_icon" },
  { key: "color", icon: "format_color_fill", title: "state_color" },
  { key: "variant", icon: "category", title: "state_variant" },
  { key: "disabled", icon: "block", title: "state_disable" },
  { key: "grow", icon: "open_in_full", title: "state_grow" },
  { key: "hidden", icon: "visibility_off", title: "state_hide" },
];

/** The value a field starts with when an author turns it on: the part's own, so switching a field on
 *  never changes what the node looks like until the author edits it. */
const lookSeed = (key: (typeof LOOK_FIELDS)[number]["key"], item: Item): PartLook[keyof PartLook] =>
  key === "label" ? item.label : key === "icon" ? item.icon : key === "color" ? item.color ?? "primary" : key === "variant" ? item.variant : true;

/** A living preview of the part as one of its looks draws it: a node shows the thing itself rather
 *  than describing it. */
function LookPreview({ item, look, p }: { item: Item; look?: PartLook; p: Palette }) {
  const drawn = lookItem(item, look);
  const size = sizeOf(drawn, {});
  const k = Math.min(1, 132 / Math.max(1, size.w), 44 / Math.max(1, size.h));
  return (
    <div style={{ width: 132, height: 44, borderRadius: 10, background: p.surfaceContainerHigh, display: "grid", placeItems: "center", overflow: "hidden", flex: "0 0 auto" }}>
      <div style={{ transform: `scale(${k})`, pointerEvents: "none" }}>
        <M3Static item={drawn} palette={p} />
      </div>
    </div>
  );
}

/** One step of the machine: what sets it off, where it lands, what it tests, and what else it does. */
function StepRow({
  step,
  targets,
  onChange,
  onRemove,
  item,
  frames,
  lookTargets,
  extra,
  p,
}: {
  step: PartStep;
  /** the looks a step can land in, the drawn one included */
  targets: { key: string; label: string }[];
  onChange: (next: Partial<PartStep>) => void;
  onRemove: () => void;
  item: Item;
  frames: Frame[];
  lookTargets: { id: string; name: string }[];
  /** the action a new line of the list starts from, or null when there is nothing to seed it with */
  extra: RuleAction | null;
  p: Palette;
}) {
  const lang = useLang();
  const timed = step.trigger.kind === "after";
  const seconds = step.trigger.kind === "after" ? step.trigger.seconds : 3;
  const do2 = step.do ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, borderRadius: 12, border: `1px solid ${p.outlineVariant}`, background: p.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={timed ? "timer" : "touch_app"} size={16} color={p.onSurfaceVariant} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Pick
            options={[
              { key: "tap", icon: "touch_app", label: t("onTap", lang) },
              { key: "after", icon: "timer", label: t("ruleAfterShort", lang) },
            ]}
            value={step.trigger.kind}
            onChange={(kind) => onChange({ trigger: kind === "after" ? { kind: "after", seconds } : { kind: "tap" } })}
            p={p}
            title={t("ruleWhen", lang)}
          />
        </div>
        <IconBtn icon="delete" p={p} danger title={t("removeRule", lang)} size={28} onClick={onRemove} />
      </div>
      {timed && <Slider icon="timer" title={t("ruleAfter", lang)} value={seconds} min={1} max={3600} step={1} onChange={(s) => onChange({ trigger: { kind: "after", seconds: s } })} p={p} unit="s" />}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant, flex: "0 0 auto" }}>{t("flowTo", lang)}</span>
        <Pick options={targets} value={step.to} onChange={(to) => onChange({ to })} p={p} title={t("flowTo", lang)} />
      </div>
      {do2.map((a, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, borderRadius: 12, background: p.surfaceContainerHigh }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Pick
              options={RULE_ACTIONS.map((r2) => ({ key: r2.key, icon: r2.icon, label: t(RULE_LABEL[r2.key], lang) }))}
              value={a.kind}
              onChange={(kind) => onChange({ do: do2.map((x, j) => (j === i ? seededAction(kind, a, item, frames) : x)) })}
              p={p}
              title={t("ruleThen", lang)}
            />
            <IconBtn icon="close" p={p} title={t("removeRule", lang)} size={28} onClick={() => onChange({ do: do2.filter((_, j) => j !== i) })} />
          </div>
          <ActionFields action={a} onChange={(next) => onChange({ do: do2.map((x, j) => (j === i ? next : x)) })} frames={frames} item={item} lookTargets={lookTargets} p={p} />
        </div>
      ))}
      {extra && (
        <button onClick={() => onChange({ do: [...do2, extra] })} className="m3-press" style={dashedStyle(p)}>
          <Icon name="add" size={16} />
          {t("flowAddDo", lang)}
        </button>
      )}
    </div>
  );
}

/**
 * The state machine a part runs, drawn as the flow its author thinks in: every look the part can be
 * in, one under the other, with the steps that leave each of them drawn between. A tap that moves it
 * on is one line, a loop back is a line to a node above, and a step that waits says how long. Two
 * steps leaving the same look are read in order, so that is the only order an author thinks about —
 * and it is local to one node instead of to the whole part.
 */
function FlowEditor({
  item,
  flow,
  onFlow,
  frames,
  lookTargets = [],
  p,
}: {
  item: Item;
  /** the machine as it stands; undefined for a part that never moves */
  flow: PartFlow | undefined;
  onFlow: (flow: PartFlow | undefined) => void;
  frames: Frame[];
  lookTargets?: { id: string; name: string }[];
  p: Palette;
}) {
  const lang = useLang();
  const [openId, setOpenId] = useState<string | null>(null);
  const looks = flow?.looks ?? [];
  const steps = flow?.steps ?? [];
  const put = (nextLooks: PartLook[], nextSteps: PartStep[]) => onFlow(nextLooks.length || nextSteps.length ? { looks: nextLooks, steps: nextSteps } : undefined);
  const patchLook = (id: string, next: Partial<PartLook>) => put(looks.map((l) => (l.id === id ? { ...l, ...next } : l)), steps);
  const dropLook = (id: string) => put(looks.filter((l) => l.id !== id), steps.filter((s) => s.from !== id && s.to !== id));
  const patchStep = (id: string, next: Partial<PartStep>) => put(looks, steps.map((s) => (s.id === id ? { ...s, ...next } : s)));
  const dropStep = (id: string) => put(looks, steps.filter((s) => s.id !== id));
  /** the name a node reads as: what its author called it, or the words it shows while in it */
  const nodeName = (l: PartLook) => l.name?.trim() || lookItem(item, l).label.trim() || t("flowNewState", lang);
  const targets = [{ key: START_LOOK, label: t("flowStart", lang) }, ...looks.map((l) => ({ key: l.id, label: nodeName(l) }))];
  /* a new state lands with a step into it: a node nothing reaches is a node nobody meant to draw */
  const addState = (from: string) => {
    const made: PartLook = { id: uid() };
    put([...looks, made], [...steps, { id: uid(), from, to: made.id, trigger: { kind: "tap" } }]);
    setOpenId(made.id);
  };
  const link = (from: string, to: string) => put(looks, [...steps, { id: uid(), from, to, trigger: { kind: "tap" } }]);
  /* the action a new line of a step's list starts from: a jump when there are pages to jump to,
     and no button at all when the document has none */
  const extra: RuleAction | null = frames.length ? { kind: "goto", to: frames[0].id, transition: "slide" } : null;
  const nodes: { id: string; look?: PartLook }[] = [{ id: START_LOOK }, ...looks.map((l) => ({ id: l.id, look: l }))];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, lineHeight: 1.6, color: p.onSurfaceVariant }}>{t("flowHint", lang)}</div>
      {nodes.map((node) => {
        const mine = steps.filter((s) => s.from === node.id);
        const changed = node.look ? LOOK_FIELDS.filter((f) => node.look?.[f.key] !== undefined) : [];
        const title = node.look ? nodeName(node.look) : t("flowStart", lang);
        return (
          <div key={node.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ ...cardStyle(p), flexDirection: "row", alignItems: "center" }}>
              <LookPreview item={item} look={node.look} p={p} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {node.look ? (
                  <Field value={node.look.name ?? ""} onChange={(name) => patchLook(node.id, { name })} placeholder={title} p={p} icon="label" height={34} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: p.onSurface }}>{title}</span>
                )}
                <div style={{ fontSize: 11, lineHeight: 1.4, color: p.outline }}>
                  {changed.length > 0 ? changed.map((f) => t(f.title, lang)).join(" · ") : t(node.look ? "flowNoChange" : "flowStartHint", lang)}
                </div>
              </div>
              {node.look && (
                <>
                  <IconBtn icon="tune" p={p} on={openId === node.id} title={t("flowChange", lang)} size={30} onClick={() => setOpenId(openId === node.id ? null : node.id)} />
                  <IconBtn icon="delete" p={p} danger title={t("delete", lang)} size={30} onClick={() => dropLook(node.id)} />
                </>
              )}
            </div>
            {node.look && openId === node.id && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, borderRadius: 12, border: `1px solid ${p.outlineVariant}` }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {LOOK_FIELDS.map((f) => {
                    const on = node.look?.[f.key] !== undefined;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        className="m3-press"
                        onClick={() => patchLook(node.id, { [f.key]: on ? undefined : lookSeed(f.key, item) } as Partial<PartLook>)}
                        style={{
                          height: 28,
                          padding: "0 8px",
                          borderRadius: 14,
                          border: "none",
                          background: on ? p.secondaryContainer : p.surfaceContainerHigh,
                          color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Icon name={on ? "check" : "add"} size={14} />
                        {t(f.title, lang)}
                      </button>
                    );
                  })}
                </div>
                {node.look.label !== undefined && <Field value={node.look.label} onChange={(label) => patchLook(node.id, { label })} p={p} placeholder={t("lookText", lang)} icon="edit" height={36} />}
                {node.look.icon !== undefined && <IconPicker value={node.look.icon} onChange={(icon) => patchLook(node.id, { icon })} onClose={() => {}} palette={p} />}
                {node.look.color !== undefined && <ItemColorChips value={node.look.color} onChange={(color) => patchLook(node.id, { color })} p={p} />}
                {node.look.variant !== undefined && (
                  <Segmented<Variant>
                    options={VARIANTS.map((v) => ({ key: v.key, title: t(v.key, lang) }))}
                    value={node.look.variant}
                    onChange={(variant) => patchLook(node.id, { variant })}
                    p={p}
                    height={36}
                  />
                )}
              </div>
            )}
            {mine.map((s) => (
              <StepRow
                key={s.id}
                step={s}
                targets={targets}
                onChange={(next) => patchStep(s.id, next)}
                onRemove={() => dropStep(s.id)}
                item={item}
                frames={frames}
                lookTargets={lookTargets}
                extra={extra}
                p={p}
              />
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" onClick={() => addState(node.id)} className="m3-press" style={dashedStyle(p)}>
                <Icon name="add" size={16} />
                {t("flowAddState", lang)}
              </button>
              {looks.length > 0 && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Pick options={[{ key: "", label: t("flowLink", lang) }, ...targets]} value="" onChange={(to) => to && link(node.id, to)} p={p} title={t("flowLink", lang)} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The state rules hung on one part: each says what a tap changes about the part itself. */

function StateRules({
  item,
  p,
  lang,
  onChange,
  frames,
  dialog,
  slots = [],
  slot = "",
  onSlot,
  lookTargets = [],
}: {
  item: Item;
  p: Palette;
  lang: Lang;
  onChange: (patch: Partial<Item>) => void;
  frames: Frame[];
  /** makes, or finds, the dialog screen this part pops over the page */
  /** what a tap can open as a dialog, and what it can be made of */
  dialog?: DialogChoices;
  /** the destinations a bar offers; empty for a plain part */
  slots?: { key: string; label: string; value: string | null }[];
  /** the destination the rules below belong to */
  slot?: string;
  onSlot?: (key: string) => void;
  /** the other parts on the page, for a look that changes one of them */
  lookTargets?: { id: string; name: string }[];
}) {
  /* a bar's rules belong to one destination; a plain part keeps them on itself */
  const target = slots.length > 0 ? slot || slots[0].key : "";
  const perSlot = slots.length > 0;
  /* the machine this part — or this destination of a bar — runs */
  const flow = perSlot ? item.slotFlows?.[target] : item.flow;
  const writeFlow = (next: PartFlow | undefined) => {
    if (!perSlot) {
      onChange({ flow: next });
      return;
    }
    const slots = { ...(item.slotFlows ?? {}) };
    if (next) slots[target] = next;
    else delete slots[target];
    onChange({ slotFlows: Object.keys(slots).length ? slots : undefined });
  };
  const action = perSlot ? item.actions?.[target] : item.action;
  /* the dialog a tap opens belongs to the destination that tap is on, so the choice above is made
     for `target` rather than for the bar as a whole */
  const chooseDialog = (choice: DialogChoice) => dialog?.choose(choice, perSlot ? target : null);
  const writeAction = (a: Action | undefined) =>
    perSlot
      ? onChange({ actions: { ...(item.actions ?? {}), [target]: a as Action } })
      : onChange({ action: a });
  const card: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 14, background: p.surfaceContainerLow };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* a bar's destinations are buttons of their own: pick the one the rules below belong to */}
      {slots.length > 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("tapTarget", lang)}</div>
          <Segmented<string>
            options={slots.map((s2) => ({ key: s2.key, icon: s2.value ?? undefined, label: s2.label, title: s2.label }))}
            value={target}
            onChange={(k) => onSlot?.(k)}
            p={p}
            height={36}
          />
        </div>
      )}

      {frames.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant, flex: 1, minWidth: 0 }}>{t("ruleJump", lang)}</span>
            {action && <IconBtn icon="delete" p={p} danger title={t("removeRule", lang)} size={30} onClick={() => writeAction(undefined)} />}
          </div>
          <FrameSelect
            frames={frames}
            value={action?.to ?? null}
            onChange={(to) => writeAction(to ? { to, transition: action?.transition ?? "slide" } : undefined)}
            p={p}
          />
          {action && action.to !== BACK_TARGET && (
            <TransitionPicker value={action.transition} onChange={(transition) => writeAction({ ...action, transition })} p={p} />
          )}
        </div>
      )}

      {/* A tap can pop a dialog of its own. Which component that dialog is made of is the author's
          choice: a fresh one, one of their own composites, or something already on the page. */}
      {dialog && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="picture_in_picture_alt" size={18} color={p.onSurfaceVariant} />
            <span style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant, flex: 1, minWidth: 0 }}>{t("ruleDialog", lang)}</span>
            {action?.dialog && <IconBtn icon="delete" p={p} danger title={t("removeRule", lang)} size={30} onClick={() => writeAction(undefined)} />}
          </div>
          <DialogBody dialog={dialog} boundId={action?.dialog ? action.to : null} onChoose={chooseDialog} p={p} />
          {action?.dialog ? (
            /* what it opens now, and a way to go and edit it: the choice above is the tap, this is
               the dialog itself */
            <button
              type="button"
              onClick={() => chooseDialog({ kind: "existing", id: action.to })}
              className="m3-press"
              style={{ height: 32, borderRadius: 16, border: "none", background: "transparent", color: p.onSurfaceVariant, fontSize: 11, lineHeight: 1.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "0 8px", textAlign: "left" }}
            >
              <Icon name="open_in_new" size={16} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t("dialogBound", lang)}
                {dialog.dialogs.find((d) => d.id === action.to)?.label.trim() || t("dialog", lang)}
              </span>
            </button>
          ) : (
            <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("dialogHint", lang)}</div>
          )}
        </div>
      )}

      {(flow?.looks.length ?? 0) === 0 && <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant }}>{t("transitionsHint", lang)}</div>}
      {/* the state machine itself: the looks the part can be in, and what moves it between them */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="change_circle" size={18} color={p.onSurfaceVariant} />
          <span style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant, flex: 1, minWidth: 0 }}>{t("onTap", lang)}</span>
        </div>
        <FlowEditor item={item} flow={flow} onFlow={writeFlow} frames={frames} lookTargets={lookTargets} p={p} />
      </div>
    </div>
  );
}
