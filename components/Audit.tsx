"use client";

import { useMemo } from "react";
import { itemsOf, type Doc, type Item, type Palette } from "@/lib/tokens";
import { auditCounts, AUDIT_ICONS, AUDIT_KIND_ICONS, AUDIT_TEXT, type AuditIssue, type AuditSeverity } from "@/lib/audit";
import { itemNameOf } from "@/lib/flow";
import { Icon } from "./M3Node";
import { t, useLang } from "@/lib/i18n";

/* The walkthrough report: the checks in lib/audit run over the document on every render, and
 * each row is a shortcut to the thing that needs fixing. It is a to-do list, not a verdict —
 * a prototype is allowed to be half-finished, so nothing here is shown on the canvas. */

const SEVERITIES: AuditSeverity[] = ["error", "warning", "info"];

/** the wash a severity's chip and icon take */
const toneOf = (p: Palette, severity: AuditSeverity) =>
  severity === "error"
    ? { bg: p.errorContainer, fg: p.onErrorContainer, accent: p.error }
    : severity === "warning"
      ? { bg: p.tertiaryContainer, fg: p.onTertiaryContainer, accent: p.tertiaryContainer }
      : { bg: p.surfaceContainerHigh, fg: p.onSurfaceVariant, accent: p.outline };

export function AuditPanel({
  p,
  doc,
  issues,
  onLocate,
}: {
  p: Palette;
  doc: Doc;
  /** the report itself: the editor keeps it, because the rail badge counts the same list */
  issues: AuditIssue[];
  onLocate: (issue: AuditIssue) => void;
}) {
  const lang = useLang();
  const text = AUDIT_TEXT[lang];
  const counts = useMemo(() => auditCounts(issues), [issues]);
  /* names the rows point with, resolved once for the whole list */
  const names = useMemo(() => {
    const frameById = new Map(doc.frames.map((f) => [f.id, f.name]));
    const itemById = new Map<string, Item>(itemsOf(doc.groups).map((it) => [it.id, it]));
    return { frameById, itemById };
  }, [doc.frames, doc.groups]);

  const partName = (id: string | null) => {
    if (!id) return null;
    const item = names.itemById.get(id);
    return item ? itemNameOf(item, lang) : text.untitledPart;
  };

  return (
    <div className="no-scrollbar" style={{ height: "100%", overflowY: "auto", padding: "12px 12px 20px" }}>
      {issues.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "40px 16px", textAlign: "center", color: p.onSurfaceVariant }}>
          <Icon name="task_alt" size={40} color={p.primary} />
          <div style={{ fontSize: 13, fontWeight: 600, color: p.onSurface }}>{text.empty}</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>{text.emptyHint}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant }}>{text.summary(counts.error, counts.warning, counts.info)}</div>
          {SEVERITIES.map((severity) => {
            const rows = issues.filter((i) => i.severity === severity);
            if (rows.length === 0) return null;
            const tone = toneOf(p, severity);
            return (
              <div key={severity} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name={AUDIT_ICONS[severity]} size={16} color={tone.accent} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: tone.accent }}>{text.severity[severity]}</span>
                  <span style={{ fontSize: 11, color: p.outline }}>{rows.length}</span>
                </div>
                {rows.map((issue, i) => (
                  <button
                    key={`${issue.kind}-${issue.frameId ?? ""}-${issue.itemId ?? ""}-${i}`}
                    onClick={() => onLocate(issue)}
                    title={text.locate}
                    className="m3-press"
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "none",
                      background: p.surfaceContainerLow,
                      color: p.onSurface,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "inline-flex", flex: "0 0 auto", marginTop: 1, color: tone.accent }}>
                      <Icon name={AUDIT_KIND_ICONS[issue.kind]} size={18} />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{text.label[issue.kind]}</span>
                      <span style={{ fontSize: 11, lineHeight: 1.5, color: p.onSurfaceVariant }}>{text.hint[issue.kind]}</span>
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                        {issue.frameId && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: p.surfaceContainerHigh, color: p.onSurfaceVariant }}>
                            {names.frameById.get(issue.frameId) || t("screen", lang)}
                          </span>
                        )}
                        {partName(issue.itemId) && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: p.secondaryContainer, color: p.onSecondaryContainer }}>
                            {partName(issue.itemId)}
                          </span>
                        )}
                        {/* a broken link names the id it still points at: the author can search
                            for it or recognise the page it used to be */}
                        {issue.targetId && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: p.errorContainer, color: p.onErrorContainer }}>
                            {text.missing}: {names.frameById.get(issue.targetId) ?? issue.targetId}
                          </span>
                        )}
                      </span>
                    </span>
                    <span style={{ display: "inline-flex", flex: "0 0 auto", marginTop: 2, color: p.outline }}>
                      <Icon name="my_location" size={16} />
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
