"use client";

import { useRef } from "react";
import { VARS_ALL, VAR_KINDS, isOverlayFrame, varInitial, varsForScope, type Frame, type Palette, type Var, type VarKind } from "@/lib/tokens";
import { Field, IconBtn, Pick, Segmented, Toggle } from "./ui";
import { Icon } from "./M3Node";
import { t, useLang } from "@/lib/i18n";

/* The values the prototype carries between taps. A variable is only worth declaring if a part
 * reads it (`{name}` in its text) or a rule tests it, so the panel keeps the explanation of the
 * syntax right next to the list rather than hiding it in a help page. Variables belong to the page
 * they are for — a screen or a dialog — so a document with twenty of them still reads as a few per
 * page, and the panel shows one page's at a time. */

export function VarsPanel({
  p,
  vars,
  frames = [],
  scope = VARS_ALL,
  onScope,
  onChange,
}: {
  p: Palette;
  vars: Var[];
  /** the screens and dialogs a variable can belong to */
  frames?: Frame[];
  /** what the panel is showing: every variable, the shared ones, or one page's own */
  scope?: string;
  onScope?: (scope: string) => void;
  onChange: (vars: Var[]) => void;
}) {
  const lang = useLang();
  const patch = (id: string, next: Partial<Var>) => onChange(vars.map((v) => (v.id === id ? { ...v, ...next } : v)));
  const shown = varsForScope(vars, scope);
  const pageName = (id: string) => {
    const f = frames.find((x) => x.id === id);
    return f ? f.name.trim() || t(isOverlayFrame(f) ? "dialog" : "screen", lang) : id;
  };
  /* 全部 first, because a variable that has just been given a page must not look like it vanished;
     then the shared ones, then one entry per page */
  const pageOptions = [
    { key: VARS_ALL, label: t("varsAll", lang), icon: "select_all" },
    { key: "", label: t("varsAllPages", lang), icon: "public" },
    ...frames.map((f) => ({ key: f.id, label: pageName(f.id), icon: isOverlayFrame(f) ? "picture_in_picture_alt" : "smartphone" })),
  ];
  const elsewhere = scope === VARS_ALL ? 0 : vars.length - shown.length;
  /* 全部 shows everything, so it says which page each variable belongs to instead of leaving the
     reader to work it out: one heading per page, the shared ones first. */
  const groups =
    scope === VARS_ALL
      ? [
          { key: ":", label: t("varsAllPages", lang), icon: "public", list: vars.filter((v) => !v.pageId) },
          ...frames.map((f) => ({ key: f.id, label: pageName(f.id), icon: isOverlayFrame(f) ? "picture_in_picture_alt" : "smartphone", list: vars.filter((v) => v.pageId === f.id) })),
          /* a variable left pointing at a page that has gone stays reachable rather than invisible */
          { key: ":orphan", label: t("varsOrphan", lang), icon: "link_off", list: vars.filter((v) => v.pageId && !frames.some((f) => f.id === v.pageId)) },
        ].filter((g) => g.list.length > 0)
      : [{ key: scope, label: "", icon: "public", list: shown }];
  /* the name of a variable just added: the panel waits for it, scrolls to it and opens its name for
     typing, so "did that work?" never has to be asked */
  const fresh = useRef<string | null>(null);
  /* a new variable lands with a name an author can read and a starting value of zero */
  const add = () => {
    const taken = new Set(vars.map((v) => v.name));
    let n = vars.length + 1;
    while (taken.has(`value${n}`)) n += 1;
    const id = `v${Date.now().toString(36)}${n}`;
    fresh.current = id;
    /* A variable added while one page is on show lands on that page; added from 全部 or 共享 it is
       shared, and the row's own page picker moves it wherever it belongs. */
    const onPage = scope !== VARS_ALL && scope !== "" ? scope : undefined;
    onChange([...vars, { id, name: `value${n}`, kind: "number", initial: 0, ...(onPage ? { pageId: onPage } : undefined) }]);
  };
  /* the card that was just added: scrolled into view, and its name opened for typing */
  const cardRef = (id: string, el: HTMLDivElement | null) => {
    if (!el || fresh.current !== id) return;
    fresh.current = null;
    el.scrollIntoView({ block: "nearest" });
    el.querySelector("input")?.focus();
  };

  return (
    <div className="no-scrollbar" style={{ height: "100%", overflowY: "auto", padding: "12px 12px 20px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, lineHeight: 1.6, color: p.onSurfaceVariant }}>{t("varsHint", lang)}</div>
        {/* which page's variables are on show: a document with many of them is read one page at a time */}
        {frames.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("varsOnPage", lang)}</div>
            <Pick options={pageOptions} value={scope} onChange={(id) => onScope?.(id)} p={p} title={t("varsOnPage", lang)} />
          </div>
        )}
        {shown.length === 0 && <div style={{ fontSize: 11, lineHeight: 1.6, color: p.outline }}>{t(vars.length === 0 ? "varsNone" : "varsEmpty", lang)}</div>}
        {groups.map((g) => (
          <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.label && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: p.onSurfaceVariant }}>
                <Icon name={g.icon} size={14} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
                <span style={{ color: p.outline, fontWeight: 500 }}>{g.list.length}</span>
              </div>
            )}
            {g.list.map((v) => (
              <div key={v.id} ref={(el) => cardRef(v.id, el)} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 14, background: p.surfaceContainerLow }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-flex", color: p.primary }}>
                    <Icon name="data_object" size={18} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Field value={v.name} onChange={(name) => patch(v.id, { name })} placeholder={t("varName", lang)} p={p} icon="edit" height={40} />
                  </div>
                  <IconBtn icon="delete" p={p} danger title={t("delete", lang)} size={32} onClick={() => onChange(vars.filter((x) => x.id !== v.id))} />
                </div>
                {/* the page it belongs to, changeable here: a variable made on the wrong page is a
                    two-click fix rather than a rewrite */}
                <Pick
                  options={pageOptions.filter((o) => o.key !== VARS_ALL)}
                  value={v.pageId ?? ""}
                  /* the panel follows the variable to its new page, so moving one never looks like
                     losing it */
                  onChange={(id) => {
                    patch(v.id, { pageId: id || undefined });
                    onScope?.(id);
                  }}
                  p={p}
                  title={t("varsOnPage", lang)}
                />
                <Segmented<VarKind>
                  options={VAR_KINDS.map((k) => ({ key: k.key, icon: k.icon, title: t(k.key === "number" ? "varNumber" : k.key === "boolean" ? "varBoolean" : "varText", lang) }))}
                  /* switching the kind keeps the value readable in the new kind instead of dropping it */
                  onChange={(kind) => patch(v.id, { kind, initial: varInitial({ ...v, kind }) })}
                  value={v.kind}
                  p={p}
                  height={36}
                />
                {v.kind === "boolean" ? (
                  <Toggle on={varInitial(v) === true} onChange={(on) => patch(v.id, { initial: on })} p={p} icon="toggle_on" label={t("varInitial", lang)} grow />
                ) : (
                  <Field
                    value={String(varInitial(v))}
                    onChange={(raw) => patch(v.id, { initial: v.kind === "number" ? Number(raw.replace(/[^0-9.-]/g, "")) || 0 : raw })}
                    placeholder={t("varInitial", lang)}
                    p={p}
                    icon={v.kind === "number" ? "tag" : "text_fields"}
                    height={40}
                  />
                )}
                  <div style={{ fontSize: 11, color: p.outline }}>{`{${v.name}}`}</div>
                </div>
                ))}
          </div>
        ))}
        {elsewhere > 0 && (
          <button
            type="button"
            onClick={() => onScope?.(VARS_ALL)}
            className="m3-press"
            style={{ height: 34, borderRadius: 12, border: `1px dashed ${p.outline}`, background: "transparent", color: p.onSurfaceVariant, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          >
            {t("varsOtherPages", lang).replace("{n}", String(elsewhere))}
          </button>
        )}
        <button
          onClick={add}
          className="m3-press"
          style={{
            height: 44,
            borderRadius: 22,
            border: "none",
            background: p.secondaryContainer,
            color: p.onSecondaryContainer,
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
          {t("addVar", lang)}
        </button>
      </div>
    </div>
  );
}
