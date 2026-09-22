"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { buildFlow, flowMarkdown, overlayLevelName, FLOW_TEXT, type Flow, type FlowNode } from "@/lib/flow";
import { isProject } from "@/lib/project";
import { paletteOf, type Doc, type Palette } from "@/lib/tokens";
import { isLang, setGlobalLang, t, type Lang } from "@/lib/i18n";

/* The flow page: the screens of the saved document as a layered diagram. It reads
 * the same autosave the editor writes, draws the graph buildFlow returns, and can
 * hand the picture or the description to the author. */

/** the page is exported under a basePath, so links stay relative and the
 *  export-only paths (agent.md and friends) are built from the same env var */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/* layout: a column per BFS depth, rows inside a column, in frame order */
const NODE_W = 200;
const NODE_H = 68;
const COL_GAP = 140;
const ROW_GAP = 26;
const PAD = 40;
const EDGE_BEND = 60;

type Placed = { node: FlowNode; x: number; y: number };

/** A deterministic layered layout: columns by depth, rows by the node order, every
 *  column vertically centred against the tallest one. No measurement, no randomness. */
function layoutFlow(flow: Flow): { placed: Placed[]; width: number; height: number; at: Map<string, Placed> } {
  const columns = new Map<number, FlowNode[]>();
  for (const n of flow.nodes) {
    const col = columns.get(n.depth) ?? [];
    col.push(n);
    columns.set(n.depth, col);
  }
  const depths = [...columns.keys()].sort((a, b) => a - b);
  const tallest = Math.max(0, ...depths.map((d) => (columns.get(d) ?? []).length * NODE_H + ((columns.get(d) ?? []).length - 1) * ROW_GAP));
  const placed: Placed[] = [];
  depths.forEach((depth, i) => {
    const col = columns.get(depth) ?? [];
    const span = col.length * NODE_H + Math.max(0, col.length - 1) * ROW_GAP;
    const top = PAD + (tallest - span) / 2;
    col.forEach((node, j) => placed.push({ node, x: PAD + i * (NODE_W + COL_GAP), y: top + j * (NODE_H + ROW_GAP) }));
  });
  const at = new Map(placed.map((p) => [p.node.id, p]));
  /* an edge that leaves a screen and comes back loops out to the right of its
   * column; the last column needs room for that loop and its label */
  const loops = flow.edges.some((e) => at.get(e.from)?.x === at.get(e.to)?.x);
  const width = PAD * 2 + Math.max(0, depths.length) * NODE_W + Math.max(0, depths.length - 1) * COL_GAP + (loops ? EDGE_BEND + 80 : 0);
  return { placed, width, height: PAD * 2 + tallest, at };
}

/** the four control points of one edge: a flat S from the right edge of the source
 *  to the left edge of the target, a loop out to the right when both sit in the
 *  same column, and a backwards S when the target sits to the left. */
function edgePath(a: Placed, b: Placed) {
  const forward = b.x > a.x + NODE_W;
  const backwards = b.x + NODE_W < a.x;
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  if (forward) {
    const c = Math.max(EDGE_BEND, (x2 - x1) / 2);
    return { d: `M ${x1} ${y1} C ${x1 + c} ${y1} ${x2 - c} ${y2} ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
  }
  if (backwards) {
    const x4 = b.x + NODE_W;
    const c = Math.max(EDGE_BEND, (x1 - x4) / 2);
    return { d: `M ${x1} ${y1} C ${x1 + c} ${y1} ${x4 - c} ${y2} ${x4} ${y2}`, mx: (x1 + x4) / 2, my: (y1 + y2) / 2 };
  }
  const side = Math.max(a.x, b.x) + NODE_W + EDGE_BEND;
  return { d: `M ${x1} ${y1} C ${side} ${y1} ${side} ${y2} ${x2} ${y2}`, mx: side, my: (y1 + y2) / 2 };
}

/** the stored language, exactly as app/page.tsx's initialLanguage() reads it */
function initialLanguage(): Lang {
  try {
    const ui = JSON.parse(localStorage.getItem("m3e:ui") ?? "null");
    if (isLang(ui?.lang)) return ui.lang;
  } catch {}
  const language = (navigator.language ?? "").toLowerCase();
  return language.startsWith("zh") ? "zh" : language.startsWith("ko") ? "ko" : language.startsWith("ja") ? "ja" : "en";
}

function readDoc(): Doc | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("m3e:doc") ?? "null");
    return isProject(value) ? value : null;
  } catch {
    return null;
  }
}

function downloadUrl(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

/** a link that stays inside the export, whatever basePath the app is served from */
const editorHref = () => `${BASE_PATH || "."}/`;

export default function FlowPage() {
  const [lang, setLang] = useState<Lang | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const initial = initialLanguage();
    document.documentElement.lang = initial;
    setGlobalLang(initial);
    setLang(initial);
    setDoc(readDoc());
  }, []);

  const ui: Lang = lang ?? "ja";
  const text = FLOW_TEXT[ui];
  const p: Palette = useMemo(
    /* the diagram wears the document's own colours, not a fixed scheme */
    () => paletteOf(doc?.paletteKey ?? "purple", doc?.customPalette ?? null, doc?.theme),
    [doc?.paletteKey, doc?.customPalette, doc?.theme],
  );
  const flow = useMemo(() => (doc ? buildFlow(doc, ui) : null), [doc, ui]);
  const layout = useMemo(() => (flow ? layoutFlow(flow) : null), [flow]);
  const selected = flow?.nodes.find((n) => n.id === selectedId) ?? null;

  const savePng = useCallback(async () => {
    const el = canvasRef.current;
    if (!el) return;
    setBusy(true);
    try {
      await document.fonts?.ready;
      const url = await toPng(el, { pixelRatio: 2, cacheBust: true, backgroundColor: p.surface, width: el.offsetWidth, height: el.offsetHeight });
      downloadUrl(url, "m3e-flow.png");
    } finally {
      setBusy(false);
    }
  }, [p.surface]);

  const saveDescription = useCallback(() => {
    if (!flow) return;
    const url = URL.createObjectURL(new Blob([flowMarkdown(flow, ui)], { type: "text/markdown" }));
    downloadUrl(url, "m3e-flow.md");
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [flow, ui]);

  const look = (primary: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    padding: "0 18px",
    borderRadius: 20,
    border: primary ? "none" : `1px solid ${p.outline}`,
    background: primary ? p.primary : "transparent",
    color: primary ? p.onPrimary : p.primary,
    textAlign: "center",
    textDecoration: "none",
    cursor: busy ? "default" : "pointer",
  });
  const button = (label: string, onClick: () => void, primary = false) => (
    <button className="m3-press" onClick={onClick} disabled={busy} style={{ ...look(primary), font: "500 14px Roboto, system-ui, sans-serif" }}>
      {label}
    </button>
  );
  const link = (label: string, primary = false) => (
    <a className="m3-press" href={editorHref()} style={{ ...look(primary), font: "500 14px Roboto, system-ui, sans-serif" }}>
      {label}
    </a>
  );

  /* the language is read after mount, so the first paint has nothing to draw yet */
  if (lang === null) {
    return <div style={{ minHeight: "100vh", background: p.surface }} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: p.surface, color: p.onSurface, fontFamily: "Roboto, system-ui, sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          background: p.surfaceContainerLow,
          borderBottom: `1px solid ${p.outlineVariant}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "500 20px Roboto, system-ui, sans-serif" }}>{text.title}</div>
          {doc && <div style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title || t("home", ui)}</div>}
        </div>
        {link(text.backToEditor)}
        {button(text.exportPng, savePng, true)}
        {button(text.exportMd, saveDescription, false)}
      </header>

      {!doc ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 20px" }}>
          <div style={{ maxWidth: 480, padding: 32, borderRadius: 28, background: p.surfaceContainer, textAlign: "center" }}>
            <div style={{ font: "500 18px Roboto, system-ui, sans-serif", marginBottom: 8 }}>{text.empty}</div>
            <div style={{ font: "400 14px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, marginBottom: 24 }}>{text.emptyHint}</div>
            {link(text.backToEditor, true)}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 320 }}>
            {flow && layout && (
              <div style={{ position: "relative", overflow: "auto", borderRadius: 24, border: `1px solid ${p.outlineVariant}`, background: p.surfaceContainerLow }}>
                <div
                  ref={canvasRef}
                  style={{
                    position: "relative",
                    width: layout.width,
                    height: Math.max(layout.height, 320),
                    background: p.surfaceContainerLow,
                  }}
                >
                  <svg width={layout.width} height={Math.max(layout.height, 320)} style={{ position: "absolute", inset: 0 }}>
                    <defs>
                      <marker id="m3e-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill={p.primary} />
                      </marker>
                    </defs>
                    {flow.edges.map((e) => {
                      const a = layout.at.get(e.from);
                      const b = layout.at.get(e.to);
                      if (!a || !b) return null;
                      const path = edgePath(a, b);
                      const i = flow.edges.filter((o) => o.from === e.from && o.to === e.to).indexOf(e);
                      const lx = path.mx + (i - 0.5) * 10;
                      const ly = path.my + (i - 0.5) * 18;
                      const w = Math.max(40, e.label.length * 7 + 12);
                      return (
                        <g key={e.id}>
                          <path d={path.d} fill="none" stroke={p.outline} strokeWidth={2} markerEnd="url(#m3e-flow-arrow)" />
                          <rect x={lx - w / 2} y={ly - 9} width={w} height={18} rx={9} fill={p.surfaceContainerHighest} opacity={0.92} />
                          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" style={{ font: "500 11px Roboto, system-ui, sans-serif", fill: p.onSurfaceVariant }}>
                            {e.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  {layout.placed.map(({ node, x, y }) => {
                    const on = node.id === selectedId;
                    return (
                      <button
                        key={node.id}
                        className="m3-press"
                        onClick={() => setSelectedId(node.id)}
                        style={{
                          position: "absolute",
                          left: x,
                          top: y,
                          width: NODE_W,
                          height: NODE_H,
                          textAlign: "start",
                          padding: "10px 14px",
                          borderRadius: 18,
                          border: `2px solid ${on ? p.primary : p.outlineVariant}`,
                          background: on ? p.secondaryContainer : p.surface,
                          color: on ? p.onSecondaryContainer : p.onSurface,
                          cursor: "pointer",
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ font: "500 14px Roboto, system-ui, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}</div>
                        <div style={{ font: "400 11px Roboto, system-ui, sans-serif", color: on ? p.onSecondaryContainer : p.onSurfaceVariant, marginTop: 2 }}>
                          {node.overlay ? overlayLevelName(node.overlay, ui) : node.kind === "popup" ? text.popup : text.screen} · {text.itemCount(node.rules.length)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside style={{ width: 320, flex: "0 0 320px", padding: 20, borderRadius: 24, background: p.surfaceContainerLow, border: `1px solid ${p.outlineVariant}` }}>
            {selected ? (
              <>
                <div style={{ font: "500 18px Roboto, system-ui, sans-serif" }}>{selected.label}</div>
                <div style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, margin: "2px 0 12px" }}>
                  {selected.overlay ? overlayLevelName(selected.overlay, ui) : selected.kind === "popup" ? text.popup : text.screen} · depth {selected.depth}
                </div>
                <p style={{ font: "400 13px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, margin: "0 0 16px" }}>{selected.description}</p>
                {selected.rules.length === 0 ? (
                  <div style={{ font: "400 13px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>{text.noRules}</div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                    {selected.rules.map((r, i) => (
                      <li key={`${r.itemId}-${i}`} style={{ padding: 12, borderRadius: 14, background: p.surfaceContainer, font: "400 13px Roboto, system-ui, sans-serif" }}>
                        <div style={{ font: "500 12px Roboto, system-ui, sans-serif", color: p.primary, marginBottom: 4 }}>
                          {r.kind === "jump" ? `${r.itemLabel} → ${flow?.nodes.find((n) => n.id === r.toFrameId)?.label ?? r.toFrameId}` : `${text.tap} · ${r.itemLabel}`}
                        </div>
                        {r.description}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div style={{ font: "400 13px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>
                {text.note}
                <div style={{ marginTop: 12 }}>
                  {flow?.nodes.length ?? 0} {text.screen} · {flow?.edges.length ?? 0} {text.transitions}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
