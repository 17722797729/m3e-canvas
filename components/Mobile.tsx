"use client";

import { useEffect, useState } from "react";
import { motion, useDragControls } from "motion/react";
import { BUTTON_SHAPES, ButtonShape, CONTRASTS, Contrast, FONTS, H, Item, KIND_SPEC, NavTab, PALETTES, Palette, ROUND_SHAPES, SHAPES, ShapeScale, Theme, TIMER_UNITS, TIMER_VALUE_MAX, badge2On, badge2TextOf, badgeColorOf, badgeOn, badgeTextOf, defaultTabsFor, hasTimer, iconSlotsOf, isTabRow, layerOf, roundByNature, setIconSlot, SHAPED, timerOn, timerUnitOf, timerValueOf, variantsOf, type TimerUnit } from "@/lib/tokens";
import { ensureFontLoaded } from "@/lib/theme";
import { KIND_TEXT, LANGS, Lang, UIKey, t, useLang } from "@/lib/i18n";
import { IconPicker } from "./IconPicker";
import { Icon } from "./M3Node";
import { FN_UNIT_TEXT, VariantSwatch } from "./Inspector";
import { Field, IconBtn, ItemColorChips, Segmented, Slider, Toggle } from "./ui";

/** Sheet that slides up from the bottom edge; the canvas above stays usable.
 *  Dragging the handle moves the sheet with the finger; a flick or a long pull closes it. */
export function BottomSheet({ p, onClose, children }: { p: Palette; onClose: () => void; children: React.ReactNode }) {
  const lang = useLang();
  const controls = useDragControls();
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0 }}
      dragElastic={{ top: 0, bottom: 1 }}
      dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 90 || info.velocity.y > 600) onClose();
      }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: "72%",
        display: "flex",
        flexDirection: "column",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        background: p.surfaceContainerLow,
        boxShadow: "0 -6px 24px rgba(0,0,0,0.16)",
        zIndex: 60,
        paddingBottom: "calc(var(--bottom-ui, 0px) + env(safe-area-inset-bottom))",
      }}
    >
      <button
        onClick={onClose}
        onPointerDown={(e) => controls.start(e)}
        aria-label={t("close", lang)}
        style={{
          height: 30,
          border: "none",
          background: "transparent",
          display: "grid",
          placeItems: "center",
          cursor: "grab",
          flex: "0 0 auto",
          touchAction: "none",
        }}
      >
        <span style={{ width: 32, height: 4, borderRadius: 2, background: p.outlineVariant }} />
      </button>
      <div className="no-scrollbar" style={{ overflowY: "auto", padding: "0 14px 16px", minHeight: 0 }}>
        {children}
      </div>
    </motion.div>
  );
}

function Row({ icon, label, p, children }: { icon: string; label: string; p: Palette; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
          color: p.onSurfaceVariant,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.4,
        }}
      >
        <Icon name={icon} size={16} />
        {label}
      </div>
      {children}
    </div>
  );
}

/** The compact phone editor: text, icon, style, state and a one-line note. */
export function MobileInspector({
  item,
  palette: p,
  onChange,
  onDelete,
  onDuplicate,
  onClose,
}: {
  item: Item;
  palette: Palette;
  onChange: (patch: Partial<Item>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const lang = useLang();
  const spec = KIND_SPEC[item.kind];
  const slots = iconSlotsOf(item).filter((s) => !s.key.startsWith("tab:"));
  const [slotKey, setSlotKey] = useState(slots[0]?.key ?? "icon");
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    setSlotKey(iconSlotsOf(item)[0]?.key ?? "icon");
    setPickerOpen(false);
    setTabSlot(null);
  }, [item.id, item.kind, item.tabs?.length]);
  const activeSlot = slots.find((s) => s.key === slotKey) ?? slots[0];
  const variants = spec.hasVariant ? variantsOf(item.kind) : [];
  const tabs: NavTab[] = item.tabs ?? [];
  const [tabSlot, setTabSlot] = useState<number | null>(null);
  const setTabCount = (n: number) => {
    const defaults = defaultTabsFor(item.kind);
    const next: NavTab[] = [];
    for (let i = 0; i < n; i++) next.push(tabs[i] ? { ...tabs[i] } : { ...defaults[i % defaults.length] });
    onChange({ tabs: next, selected: item.selected !== undefined && item.selected >= n ? undefined : item.selected });
  };
  /* a dropdown's rows are options: no icons, and one of them may be the initial value */
  const isSelect = item.kind === "select";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: p.secondaryContainer,
            color: p.onSecondaryContainer,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name={spec.paletteIcon} size={22} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: p.onSurface, flex: 1 }}>{KIND_TEXT[lang][item.kind]?.noun ?? spec.label}</span>
        <IconBtn icon="content_copy" p={p} onClick={onDuplicate} title={t("duplicate", lang)} size={44} />
        <IconBtn icon="delete" p={p} danger onClick={onDelete} title={t("delete", lang)} size={44} />
        <IconBtn icon="check" p={p} on onClick={onClose} title={t("done", lang)} size={44} />
      </div>

      {(spec.hasLabel || spec.hasSupporting) && (
        /* 任务信息条上这个字段是那条任务的标题，所以名和占位都按它来（和桌面检查器同一句话） */
        <Row icon="title" label={t(item.kind === "taskBar" ? "barTitle" : "text", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {spec.hasLabel && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Field value={item.label} onChange={(label) => onChange({ label })} placeholder={item.kind === "assetPill" ? t("quantity", lang) : item.kind === "taskBar" ? t("barTitle", lang) : t("label", lang)} p={p} icon="short_text" height={48} />
                {item.kind === "text" && (
                  <IconBtn icon="format_bold" p={p} size={48} on={!!item.bold} onClick={() => onChange({ bold: !item.bold })} title={t("bold", lang)} />
                )}
              </div>
            )}
            {spec.hasSupporting && (
              <Field
                value={item.supporting ?? ""}
                onChange={(supporting) => onChange({ supporting })}
                placeholder={item.kind === "snackbar" ? t("action", lang) : t("supporting", lang)}
                p={p}
                icon="notes"
                height={48}
              />
            )}
          </div>
        </Row>
      )}

      {spec.hasTabs && (
        <Row icon={isSelect ? "list" : "view_column"} label={t(isSelect ? "options" : "tabs", lang)} p={p}>
          {!isSelect && !isTabRow(item) && (
            <Segmented
              options={(item.kind === "toolbar" ? [2, 3, 4, 5, 6] : [2, 3, 4, 5]).map((n) => ({ key: String(n), label: String(n) }))}
              value={String(tabs.length)}
              onChange={(k) => setTabCount(Number(k))}
              p={p}
              height={44}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {tabs.map((tab, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {isSelect && (
                  <IconBtn
                    icon={item.selected === i ? "radio_button_checked" : "radio_button_unchecked"}
                    p={p}
                    size={48}
                    on={item.selected === i}
                    onClick={() => onChange({ selected: item.selected === i ? undefined : i })}
                    title={t("selectedOption", lang)}
                  />
                )}
                {!isTabRow(item) && !isSelect && (
                  <IconBtn icon={tab.icon || "add"} p={p} size={48} on={tabSlot === i} onClick={() => { setTabSlot(tabSlot === i ? null : i); setPickerOpen(false); }} title={t("changeIcon", lang)} />
                )}
                {item.kind !== "toolbar" && (
                  <Field value={tab.label} onChange={(label) => onChange({ tabs: tabs.map((x, j) => (j === i ? { ...x, label } : x)) })} placeholder={t("label", lang)} p={p} height={48} />
                )}
                {isSelect && tabs.length > 1 && (
                  <IconBtn
                    icon="close"
                    p={p}
                    size={48}
                    onClick={() => onChange({ tabs: tabs.filter((_, j) => j !== i), selected: item.selected === undefined ? undefined : item.selected === i ? undefined : item.selected > i ? item.selected - 1 : item.selected })}
                    title={t("removeOption", lang)}
                  />
                )}
              </div>
            ))}
          </div>
          {isSelect && (
            <button
              onClick={() => onChange({ tabs: [...tabs, { ...defaultTabsFor(item.kind)[tabs.length % defaultTabsFor(item.kind).length] }] })}
              className="m3-press"
              style={{ marginTop: 8, height: 48, width: "100%", borderRadius: 24, border: `1px solid ${p.outline}`, background: "transparent", color: p.primary, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <Icon name="add" size={20} />
              {t("addOption", lang)}
            </button>
          )}
          {tabSlot !== null && tabs[tabSlot] && (
            <div style={{ marginTop: 8 }}>
              <IconPicker value={tabs[tabSlot].icon || null} onChange={(icon) => onChange(setIconSlot(item, `tab:${tabSlot}`, icon))} onClose={() => setTabSlot(null)} palette={p} />
            </div>
          )}
        </Row>
      )}

      {slots.length > 0 && activeSlot && (
        /* 任务信息条这一节是两个图标槽（奖励图标 + 按钮徽标里的图标），所以标题用总名「图标」 */
        <Row icon="emoji_symbols" label={t(item.kind === "assetPill" ? "leftIcon" : item.kind === "taskBar" ? "barBadgeIcon" : "icon", lang)} p={p}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {slots.map((s) => {
              const on = s.key === activeSlot.key && pickerOpen;
              return (
                <button
                  key={s.key}
                  onClick={() => {
                    setTabSlot(null);
                    setSlotKey(s.key);
                    setPickerOpen(!(on && pickerOpen));
                  }}
                  title={s.label}
                  className="m3-press"
                  style={{
                    height: 48,
                    minWidth: 48,
                    padding: slots.length > 1 ? "0 14px 0 10px" : 0,
                    borderRadius: 24,
                    border: "none",
                    background: on ? p.primary : p.surfaceContainerHigh,
                    color: on ? p.onPrimary : s.value ? p.onSurface : p.outline,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Icon name={s.value ?? "block"} size={24} />
                  {slots.length > 1 && <span>{s.label}</span>}
                </button>
              );
            })}
            {activeSlot.value && (
              <button
                onClick={() => onChange(setIconSlot(item, activeSlot.key, null))}
                className="m3-press"
                style={{
                  height: 48,
                  padding: "0 14px 0 10px",
                  borderRadius: 24,
                  border: `1px solid ${p.outline}`,
                  background: "transparent",
                  color: p.onSurfaceVariant,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Icon name="close" size={20} />
                {t("noIcon", lang)}
              </button>
            )}
          </div>
          {pickerOpen && (
            <div style={{ marginTop: 8 }}>
              <IconPicker value={activeSlot.value} onChange={(icon) => onChange(setIconSlot(item, activeSlot.key, icon))} onClose={() => setPickerOpen(false)} palette={p} />
            </div>
          )}
        </Row>
      )}

      {variants.length > 0 && (
        <Row icon="palette" label={t("style", lang)} p={p}>
          <div className="no-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "3px 3px 6px" }}>
            {variants.map((v) => (
              <VariantSwatch key={v.key} v={v.key} label={v.label} p={p} on={item.variant === v.key} onClick={() => onChange({ variant: v.key })} />
            ))}
          </div>
        </Row>
      )}

      {hasTimer(item) && (
        <Row icon="timer" label={t("fnTimer", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Toggle on={timerOn(item)} onChange={(timer) => onChange({ timer })} p={p} icon="timer" label={t("fnTimerOn", lang)} />
            {timerOn(item) && (
              <>
                <Segmented<TimerUnit>
                  options={TIMER_UNITS.map((u) => ({ key: u, label: t(FN_UNIT_TEXT[u], lang) }))}
                  value={timerUnitOf(item)}
                  onChange={(timerUnit) => onChange({ timerUnit })}
                  p={p}
                  height={34}
                />
                <Slider
                  icon="hourglass_top"
                  title={t(FN_UNIT_TEXT[timerUnitOf(item)], lang)}
                  value={timerValueOf(item)}
                  min={0}
                  max={TIMER_VALUE_MAX}
                  step={1}
                  onChange={(timerValue) => onChange({ timerValue })}
                  p={p}
                />
              </>
            )}
          </div>
        </Row>
      )}

      {/* 功能按钮和物品格的角标共用这一行（同一套 badge / badgeText 字段），手机面板照桌面检查器一样
          镜像它：开关 + 文字。按钮没有这一项（作者：「去掉此属性」）。 */}
      {(item.kind === "fnButton" || item.kind === "itemCell") && (
        <Row icon="notifications_unread" label={t("fnBadge", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Toggle on={badgeOn(item)} onChange={(badge) => onChange({ badge: badge || undefined })} p={p} icon="notifications_unread" label={t("fnBadge", lang)} />
            {badgeOn(item) && (
              <Field value={badgeTextOf(item)} onChange={(text) => onChange({ badgeText: text || undefined })} placeholder={t("badge", lang)} p={p} icon="label" />
            )}
          </div>
        </Row>
      )}

      {/* 任务信息条：标题、奖励格和「领取」按钮都是这一个部件的属性（和桌面检查器同样那几节，手机面板
          只是把它们镜像成一行一行）。这几行按**属性分组**命名（按钮文字、按钮右上徽标），不按 kind
          自己的名字 —— 顶上已经写着这是任务信息条了。奖励数量那个属性去掉了：格子里画的永远是那个固定
          的 100（见 tokens 的 TASK_BAR_VALUE），所以这一条也不再有自己的行。 */}
      {item.kind === "taskBar" && (
        <Row icon="smart_button" label={t("barButton", lang)} p={p}>
          {/* 这一条自己的一句话（见桌面检查器同一处）：奖励数量那一行去掉之后它留在这里，一句话不占
              一行控件。 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("taskBarHint", lang)}</div>
            <Field value={item.label2 ?? ""} onChange={(label2) => onChange({ label2 })} placeholder={t("barButton", lang)} p={p} icon="smart_button" height={48} />
          </div>
        </Row>
      )}

      {item.kind === "taskBar" && (
        <Row icon="notifications_unread" label={t("barBadge", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Toggle on={!!item.buttonBadge} onChange={(buttonBadge) => onChange({ buttonBadge: buttonBadge || undefined })} p={p} icon="notifications_unread" label={t("barBadge", lang)} />
            {item.buttonBadge && (
              <>
                <Field value={item.buttonBadgeText ?? ""} onChange={(text) => onChange({ buttonBadgeText: text || undefined })} placeholder={t("badge", lang)} p={p} icon="label" height={48} />
                <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("barBadgeHint", lang)}</div>
              </>
            )}
          </div>
        </Row>
      )}

      {/* 两枚角标：①在格子左上（badge / badgeText / badgeColor），②在右上（物品格那三件套） */}
      {item.kind === "taskBar" && (
        <Row icon="sell" label={t("markLeft", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Toggle on={badgeOn(item)} onChange={(badge) => onChange({ badge: badge || undefined })} p={p} icon="sell" label={t("markLeft", lang)} />
            {badgeOn(item) && (
              <>
                <Field value={badgeTextOf(item)} onChange={(text) => onChange({ badgeText: text || undefined })} placeholder={t("badge", lang)} p={p} icon="label" height={48} />
                <ItemColorChips value={item.badgeColor} onChange={(badgeColor) => onChange({ badgeColor })} p={p} />
                <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("taskMarkHint", lang)}</div>
              </>
            )}
          </div>
        </Row>
      )}

      {item.kind === "taskBar" && (
        <Row icon="sell" label={t("markRight", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Toggle on={badge2On(item)} onChange={(badge2) => onChange({ badge2: badge2 || undefined })} p={p} icon="sell" label={t("markRight", lang)} />
            {badge2On(item) && (
              <>
                <Field value={badge2TextOf(item)} onChange={(text) => onChange({ badge2Text: text || undefined })} placeholder={t("badge", lang)} p={p} icon="label" height={48} />
                <ItemColorChips value={item.badge2Color} onChange={(badge2Color) => onChange({ badge2Color })} p={p} />
                <div style={{ fontSize: 11, lineHeight: 1.5, color: p.outline }}>{t("taskMarkHint", lang)}</div>
              </>
            )}
          </div>
        </Row>
      )}

      {SHAPED.includes(item.kind) && (
        <Row icon="category" label={t("buttonShape", lang)} p={p}>
          {(() => {
            /* the same switch the inspector shows, and the same shapes: a circle-by-nature part gets
               the circle and the rounded square, a button its own pill and rectangle */
            const round = roundByNature(item.kind);
            const shapes = round ? ROUND_SHAPES : BUTTON_SHAPES;
            const value: ButtonShape = round ? (item.shape === "square" ? "square" : "round") : item.shape ?? "default";
            return (
              <Segmented<ButtonShape>
                options={shapes.map((sh) => ({ key: sh.key, icon: sh.icon, label: t(`shape_${sh.key}` as UIKey, lang), title: t(`shape_${sh.key}` as UIKey, lang) }))}
                value={value}
                /* the inspector's own rule: a round button is drawn at the medium height, so the pill
                   it was becomes a true circle, and going back restores the width it had */
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
                height={34}
              />
            );
          })()}
        </Row>
      )}

      {item.kind === "itemCell" && (
        <Row icon="sell" label={t("markLeft", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Toggle on={badge2On(item)} onChange={(badge2) => onChange({ badge2: badge2 || undefined })} p={p} icon="sell" label={t("markLeft", lang)} />
            {badge2On(item) && (
              <>
                <Field value={badge2TextOf(item)} onChange={(text) => onChange({ badge2Text: text || undefined })} placeholder={t("badge", lang)} p={p} icon="label" />
                <ItemColorChips value={item.badge2Color} onChange={(badge2Color) => onChange({ badge2Color })} p={p} />
              </>
            )}
          </div>
        </Row>
      )}

      {spec.hasChecked && (
        <Row icon="tune" label={t("state", lang)} p={p}>
          <Toggle
            on={!!item.checked}
            onChange={(checked) => onChange({ checked })}
            p={p}
            icon={item.kind === "chip" ? "check_circle" : "toggle_on"}
            label={item.kind === "chip" ? t("selected", lang) : t("on", lang)}
          />
        </Row>
      )}

      <Row icon="format_paint" label={t("appearance", lang)} p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ItemColorChips value={item.color} onChange={(color) => onChange({ color })} p={p} />
          <Slider icon="layers" title={t("layer", lang)} value={layerOf(item)} min={0} max={99} step={1} onChange={(z) => onChange({ z })} p={p} />
        </div>
      </Row>

      <Row icon="bolt" label={t("behavior", lang)} p={p}>
        <Field value={item.note ?? ""} onChange={(note) => onChange({ note })} placeholder={["button", "fab", "iconButton", "extendedFab", "fnButton"].includes(item.kind) ? t("whenPressed", lang) : t("whatItDoes", lang)} p={p} icon="bolt" height={48} />
      </Row>
    </div>
  );
}

/** The language list, one row per language. */
export function MobileLang({ palette: p, lang, onLang }: { palette: Palette; lang: Lang; onLang: (l: Lang) => void }) {
  return (
    <Row icon="translate" label={t("language", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {LANGS.map((l) => {
          const on = l.key === lang;
          return (
            <button
              key={l.key}
              onClick={() => onLang(l.key)}
              aria-pressed={on}
              className="m3-press"
              style={{
                height: 52,
                padding: "0 16px 0 12px",
                borderRadius: 16,
                border: "none",
                background: on ? p.secondaryContainer : p.surfaceContainerHigh,
                color: on ? p.onSecondaryContainer : p.onSurface,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                textAlign: "left",
              }}
            >
              <span style={{ width: 22, display: "inline-flex" }}>{on && <Icon name="check" size={22} />}</span>
              {l.label}
            </button>
          );
        })}
      </div>
    </Row>
  );
}

/** The theme sheet: palette, light / dark, shape, type and motion, sized for thumbs. */
export function MobileSettings({
  palette: p,
  paletteKey,
  onPalette,
  theme,
  onTheme,
}: {
  palette: Palette;
  paletteKey: string;
  onPalette: (key: string) => void;
  theme: Theme;
  onTheme: (patch: Partial<Theme>) => void;
}) {
  const lang = useLang();
  const shapeLabel = (k: ShapeScale) => (k === "square" ? t("shapeSquare", lang) : k === "full" ? t("shapeFull", lang) : t("shapeRounded", lang));
  return (
    <div>
      <Row icon="brightness_6" label={t("brightness", lang)} p={p}>
        <Segmented<"light" | "dark">
          options={[
            { key: "light", icon: "light_mode", label: t("light", lang) },
            { key: "dark", icon: "dark_mode", label: t("dark", lang) },
          ]}
          value={theme.dark ? "dark" : "light"}
          onChange={(k) => onTheme({ dark: k === "dark" })}
          p={p}
          height={44}
        />
        <div style={{ marginTop: 8 }}>
          <Toggle on={theme.bothModes} onChange={(bothModes) => onTheme({ bothModes })} p={p} icon="routine" label={t("bothModes", lang)} grow />
        </div>
      </Row>
      <Row icon="contrast" label={t("contrast", lang)} p={p}>
        <Segmented<Contrast>
          options={CONTRASTS.map((c) => ({ key: c.key, label: c.key === "high" ? t("contrastHigh", lang) : c.key === "medium" ? t("contrastMedium", lang) : t("contrastStandard", lang) }))}
          value={theme.contrast}
          onChange={(contrast) => onTheme({ contrast })}
          p={p}
          height={44}
        />
      </Row>
      <Row icon="palette" label={t("theme", lang)} p={p}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "2px 0" }}>
          {PALETTES.map((pal) => {
            const on = pal.key === paletteKey;
            return (
              <button
                key={pal.key}
                onClick={() => onPalette(pal.key)}
                title={pal.label}
                aria-label={pal.label}
                aria-pressed={on}
                className="m3-press"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  border: "none",
                  background: pal.primary,
                  color: pal.onPrimary,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  outline: on ? `3px solid ${p.onSurface}` : "3px solid transparent",
                  outlineOffset: 3,
                }}
              >
                {on && <Icon name="check" size={24} />}
              </button>
            );
          })}
        </div>
      </Row>
      <Row icon="rounded_corner" label={t("shape", lang)} p={p}>
        <Segmented<ShapeScale>
          options={SHAPES.map((s) => ({ key: s.key, icon: s.icon, label: shapeLabel(s.key) }))}
          value={theme.shape}
          onChange={(shape) => onTheme({ shape })}
          p={p}
          height={44}
        />
      </Row>
      <Row icon="text_fields" label={t("typography", lang)} p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {FONTS.map((f) => {
            const on = theme.font === f.key;
            ensureFontLoaded(f.key);
            return (
              <button
                key={f.key}
                onClick={() => onTheme({ font: f.key })}
                aria-pressed={on}
                className="m3-press"
                style={{
                  height: 48,
                  padding: "0 16px 0 12px",
                  borderRadius: 16,
                  border: "none",
                  background: on ? p.secondaryContainer : p.surfaceContainerHigh,
                  color: on ? p.onSecondaryContainer : p.onSurface,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  fontFamily: f.family,
                }}
              >
                <span style={{ width: 22, display: "inline-flex" }}>{on && <Icon name="check" size={22} />}</span>
                {f.label}
              </button>
            );
          })}
          <div style={{ marginTop: 4 }}>
            <Toggle on={theme.emphasized} onChange={(emphasized) => onTheme({ emphasized })} p={p} icon="format_bold" label={t("emphasized", lang)} />
          </div>
        </div>
      </Row>
      <Row icon="animation" label={t("motion", lang)} p={p}>
        <Segmented<"standard" | "expressive">
          options={[
            { key: "standard", label: t("motionStandard", lang) },
            { key: "expressive", label: t("motionExpressive", lang) },
          ]}
          value={theme.motion}
          onChange={(motion) => onTheme({ motion })}
          p={p}
          height={44}
        />
      </Row>
    </div>
  );
}

/** Edit / duplicate / delete for the selected part, sized for thumbs. */
export function MobileActionBar({
  p,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  p: Palette;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const lang = useLang();
  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        bottom: "calc(16px + var(--bottom-ui, 0px) + env(safe-area-inset-bottom))",
        display: "flex",
        gap: 4,
        padding: 6,
        borderRadius: 32,
        background: p.surface,
        boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
        zIndex: 46,
      }}
    >
      <button
        onClick={onEdit}
        className="m3-press"
        style={{
          height: 52,
          padding: "0 20px 0 16px",
          borderRadius: 26,
          border: "none",
          background: p.primary,
          color: p.onPrimary,
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="tune" size={22} />
        {t("edit", lang)}
      </button>
      <IconBtn icon="content_copy" p={p} size={52} title={t("duplicate", lang)} onClick={onDuplicate} />
      <IconBtn icon="delete" p={p} size={52} danger title={t("delete", lang)} onClick={onDelete} />
    </div>
  );
}
