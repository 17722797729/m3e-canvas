"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { buildFlow, flowMarkdown, overlayLevelName, FLOW_TEXT, type Flow, type FlowNode } from "@/lib/flow";
import { FlowBoard, boardFromFlow, loadBoard, mergeBoard, saveBoard } from "@/lib/flowchart";
import { FlowCanvas } from "@/components/FlowCanvas";
import { Icon } from "@/components/M3Node";
import { readDoc as readStoredDoc } from "@/lib/project";
import { paletteOf, type Doc, type Palette } from "@/lib/tokens";
import { LangContext, isLang, setGlobalLang, t, type Lang } from "@/lib/i18n";
import { goToEditor } from "@/lib/appPath";

/* The flow page: the screens of the saved document as a layered diagram. It reads
 * the same autosave the editor writes, draws the graph buildFlow returns, and can
 * hand the picture or the description to the author. */

/** the page is exported under a basePath, so links stay relative and the
 *  export-only paths (agent.md and friends) are built from the same env var */

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
    /* 读回来的文档先过归一化：超范围的倒计时收进 120，而不是把整份文档丢掉 */
    return readStoredDoc(value);
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



export default function FlowPage() {
  const [lang, setLang] = useState<Lang | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 能改的那张图；null 表示"还没建，按屏幕推导" */
  const [board, setBoard] = useState<FlowBoard | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    /* 语言只有一处来源：编辑器存在 `m3e:ui` 里的那个。
       流程图原来只在读不到时才看浏览器语言，于是中文界面的机器上
       可能整页日语文案（图形面板、常用部件全是日文）。这里改成：
       读到就用它，并且把浏览器语言作为最后兜底。 */
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

  /* 图从哪来：按屏幕现算一张，再把本机存下的改动（位置、形状、自己加的节点）贴上去。
     这样图上的文字永远跟着界面语言，而拖过的位置、换过的形状仍然留着。 */
  useEffect(() => {
    if (board || !flow || !layout) return;
    const fresh = boardFromFlow(flow, layout.at);
    const saved = loadBoard(window.localStorage);
    setBoard(saved ? mergeBoard(fresh, saved) : fresh);
  }, [board, flow, layout]);

  /* 改了就存：流程图是"你在图上做的改动"，不跟着屏幕文档一起走 */
  const changeBoard = useCallback((next: FlowBoard) => {
    setBoard(next);
    saveBoard(window.localStorage, next);
  }, []);

  const selected = board?.boxes.find((b) => b.id === selectedId) ?? null;
  const selectedNode = flow?.nodes.find((n) => n.id === selectedId) ?? null;

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
  /* 从编辑器来的就退回去，不然跳编辑器首页；两种都不会丢掉离开前的面板状态 */
  const link = (label: string, primary = false) => (
    <button
      type="button"
      className="m3-press"
      onClick={() => goToEditor()}
      style={{ ...look(primary), border: "none", cursor: "pointer", font: "500 14px Roboto, system-ui, sans-serif" }}
    >
      {label}
    </button>
  );

  /* the language is read after mount, so the first paint has nothing to draw yet */
  if (lang === null) {
    return <div style={{ minHeight: "100vh", background: p.surface }} />;
  }

  /* 页面里的组件（图形面板、常用部件…）走 useLang()，它读的是 context。
     只 setGlobalLang 是不够的：context 会落在默认值（日语）上，于是中日混排。 */
  return (
    <LangContext.Provider value={ui}>
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
            {board ? (
              <FlowCanvas p={p} board={board} selectedId={selectedId} onBoard={changeBoard} onSelect={setSelectedId} />
            ) : null}
          </div>

          <aside style={{ width: 320, flex: "0 0 320px", padding: 20, borderRadius: 24, background: p.surfaceContainerLow, border: `1px solid ${p.outlineVariant}` }}>
            {selected ? (
              <>
                <div style={{ font: "500 18px Roboto, system-ui, sans-serif" }}>{selected.label}</div>
                <div style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, margin: "2px 0 12px" }}>
                  {selectedNode
                    ? `${selectedNode.overlay ? overlayLevelName(selectedNode.overlay, ui) : selectedNode.kind === "popup" ? text.popup : text.screen} · depth ${selectedNode.depth}`
                    : t("flowPartStep", ui)}
                </div>
                {!selectedNode ? (
                  <p style={{ font: "400 13px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, margin: "0 0 16px" }}>{t("flowDragHint", ui)}</p>
                ) : (
                  <>
                    <p style={{ font: "400 13px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, margin: "0 0 16px" }}>{selectedNode.description}</p>
                {selectedNode.rules.length === 0 ? (
                  <div style={{ font: "400 13px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>{text.noRules}</div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                    {selectedNode.rules.map((r, i) => (
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
                )}
              </>
            ) : (
              <div style={{ font: "400 13px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>
                {text.note}
                <div style={{ marginTop: 12 }}>
                  {(board?.boxes.length ?? 0)} {text.boxes} · {(board?.links.length ?? 0)} {text.transitions}
                </div>
                {/* 图可以随便改；改乱了就从屏幕重新推导一张 */}
                <button
                  onClick={() => {
                    if (!flow || !layout) return;
                    if (!window.confirm(t("flowResetAsk", ui))) return;
                    changeBoard(boardFromFlow(flow, layout.at));
                    setSelectedId(null);
                  }}
                  className="m3-press"
                  style={{
                    marginTop: 16,
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 19,
                    border: `1px solid ${p.outline}`,
                    background: "transparent",
                    color: p.primary,
                    font: "500 13px Roboto, system-ui, sans-serif",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon name="restart_alt" size={16} />
                  {t("flowReset", ui)}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
    </LangContext.Provider>
  );
}
