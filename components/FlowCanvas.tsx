"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Palette } from "@/lib/tokens";
import { t, useLang, type UIKey } from "@/lib/i18n";
import { Icon } from "./M3Node";
import {
  FLOW_SHAPES,
  shapePath,
  FlowBoard,
  FlowBox,
  FlowShape,
  NODE_H,
  NODE_W,
  addBox,
  boardBounds,
  boxById,
  connect,
  moveBox,
  removeBox,
  renameBox,
  restyleBox,
} from "@/lib/flowchart";

/**
 * 流程图画布
 * ---------------------------------------------------------------------------
 * 一张能改的图：节点按住就拖、右边能把长方形换成菱形、下面能加常用流程组件。
 *
 * 画在 SVG 里（线在同一层，节点是它的上面一层），所以拖动时线跟着走；
 * 形状按流程图惯例给：长方形=步骤、菱形=判断、圆头=起止、平行四边形=输入输出…
 */
export function FlowCanvas({
  p,
  board,
  selectedId,
  onBoard,
  onSelect,
}: {
  p: Palette;
  board: FlowBoard;
  selectedId: string | null;
  onBoard: (b: FlowBoard) => void;
  onSelect: (id: string | null) => void;
}) {
  const lang = useLang();
  const ref = useRef<HTMLDivElement>(null);
  /** 外面那个定高的框：可见区域以它为准 */
  const frameRef = useRef<HTMLDivElement>(null);
  /* 拖动中的那一个：pointermove 里用 ref 读，免得每次移动都重挂监听 */
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  /**
   * 可见区域有多大
   *
   * 量的是**外面那个定高的框**（`frameRef`），不是滚动容器自己：
   * 滚动容器的高度由它的内容决定，拿它当 `minH` 会形成回路 ——
   * 内容撑高容器、容器又要求更大的内容，实测能涨到两万像素。
   */
  const [view, setView] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setView((cur) => (cur.w === w && cur.h === h ? cur : { w, h }));
    };
    if (typeof ResizeObserver === "undefined") {
      measure();
      return;
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  const bounds = boardBounds(board, 60, view.w, view.h);
  const width = bounds.w;
  const height = bounds.h;
  /* 节点按平移量挪：最左最上都因此留得住净空 */
  const shift = (box: { x: number; y: number }) => ({ x: box.x - bounds.ox, y: box.y - bounds.oy });
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const pointerPos = useCallback((e: PointerEvent | React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, []);

  /* 拖动：按下时记住"手指相对节点左上角"的偏移，之后每次都按它算，节点不会跳 */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const at = pointerPos(e);
      d.moved = true;
      /* 指针位置要加回画布的平移量，才是节点自己的坐标 */
      onBoard(moveBox(board, d.id, at.x + boundsRef.current.ox - d.dx, at.y + boundsRef.current.oy - d.dy));
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [board, onBoard, pointerPos]);

  const startDrag = (e: React.PointerEvent, box: FlowBox) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(box.id);
    const at = pointerPos(e);
    const shown = shift(box);
    drag.current = { id: box.id, dx: at.x - shown.x, dy: at.y - shown.y, moved: false };
    /* 连线的第二下：点两个节点就把它们连起来 */
    if (linking && linking !== box.id) {
      onBoard(connect(board, linking, box.id));
      setLinking(null);
      drag.current = null;
    }
  };

  /** 在空白处按一下：取消选中、取消连线 */
  const onBlank = () => {
    setLinking(null);
    onSelect(null);
  };

  /** 自己加一个步骤：放在视野中间偏左上，摆两次不会完全重叠 */
  const add = (shape: FlowShape, label: string) => {
    const n = board.boxes.length;
    const at = { x: 120 + (n % 3) * 40, y: 80 + n * 24 };
    const next = addBox(board, label, at.x, at.y);
    const added = next.boxes[next.boxes.length - 1];
    onBoard(restyleBox(next, added.id, shape));
    onSelect(added.id);
  };

  const selected = boxById(board, selectedId);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* 画布 */}
      <div
        ref={frameRef}
        style={{
          position: "relative",
          /* 图表区域定高：图比它大就在里面滚，而不是把整页撑长 */
          height: "min(68vh, 620px)",
          overflow: "auto",
          borderRadius: 24,
          border: `1px solid ${p.outlineVariant}`,
          background: p.surfaceContainerLow,
        }}
      >
        <div ref={ref} style={{ position: "relative", width, height }}>
          {/* 线在节点下面：拖动时线跟着走，不会被节点挡住 */}
          <svg width={width} height={height} style={{ position: "absolute", inset: 0 }} onPointerDown={onBlank}>
            <defs>
              <marker
                id="m3e-flow-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="11"
                markerHeight="11"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={p.primary} />
              </marker>
            </defs>
            {board.links.map((l, i) => {
              const a = boxById(board, l.from);
              const b = boxById(board, l.to);
              if (!a || !b) return null;
              const path = linkPath(shift(a), shift(b));
              const w = Math.max(36, l.label.length * 7 + 12);
              /* 标签放在线的中段，并且沿着路径往上错开一点：
                 放在正中会正好压住箭头，几条线还会挤成一摞 —— 那看起来就是"没有箭头"。 */
              const ly = path.my - 16 - (i % 3) * 13;
              const lx = path.mx + ((i % 3) - 1) * 12;
              return (
                <g key={l.id}>
                  <path d={path.d} fill="none" stroke={p.outline} strokeWidth={2} markerEnd="url(#m3e-flow-arrow)" />
                  {l.label && (
                    <>
                      <rect x={lx - w / 2} y={ly - 10} width={w} height={20} rx={10} fill={p.surfaceContainerHighest} opacity={0.94} />
                      <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" style={{ font: "500 11px Roboto, system-ui, sans-serif", fill: p.onSurfaceVariant }}>
                        {l.label}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* 节点：用 SVG 画形状，文字叠在上面 */}
          {board.boxes.map((box) => {
            const on = box.id === selectedId;
            const linkingHere = linking === box.id;
            return (
              <button
                key={box.id}
                className="m3-press"
                onPointerDown={(e) => startDrag(e, box)}
                title={box.label}
                style={{
                  position: "absolute",
                  left: shift(box).x,
                  top: shift(box).y,
                  width: NODE_W,
                  height: NODE_H,
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "grab",
                  touchAction: "none",
                }}
              >
                {/* 形状画在一块**比节点大一圈**的画布上：
                    路径正好落在节点边缘（圆头、菱形都如此），
                    贴着边画的话描边会被视口切掉，看上去就是"上下被削平"。 */}
                <svg
                  width={NODE_W + SHAPE_PAD * 2}
                  height={NODE_H + SHAPE_PAD * 2}
                  style={{ position: "absolute", left: -SHAPE_PAD, top: -SHAPE_PAD }}
                >
                  <g transform={`translate(${SHAPE_PAD} ${SHAPE_PAD})`}>
                    <path
                      d={shapePath(box.shape, NODE_W, NODE_H)}
                      fill={on ? p.secondaryContainer : p.surface}
                      stroke={on || linkingHere ? p.primary : p.outlineVariant}
                      strokeWidth={on || linkingHere ? 2.5 : 1.5}
                    />
                  </g>
                </svg>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    alignContent: "center",
                    gap: 2,
                    padding: box.shape === "decision" ? "0 22px" : "0 14px",
                    textAlign: "center",
                    color: on ? p.onSecondaryContainer : p.onSurface,
                    pointerEvents: "none",
                  }}
                >
                  <span style={{ font: "500 13px Roboto, system-ui, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{box.label}</span>
                  {box.note && (
                    <span style={{ font: "400 10px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {box.note}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 形状：换了它，节点的叫法/连线都不动，只是画法变了 */}
      {selected && (
        <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 20, background: p.surfaceContainerLow, border: `1px solid ${p.outlineVariant}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="category" size={18} />
            <span style={{ font: "500 13px Roboto, system-ui, sans-serif" }}>{t("flowShape", lang)}</span>
            <span style={{ flex: 1 }} />
            <span style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>{selected.label}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FLOW_SHAPES.map((sh) => (
              <button
                key={sh.key}
                onClick={() => onBoard(restyleBox(board, selected.id, sh.key))}
                title={t(shapeLabel(sh.key), lang)}
                className="m3-press"
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 17,
                  border: `1px solid ${selected.shape === sh.key ? p.primary : p.outlineVariant}`,
                  background: selected.shape === sh.key ? p.secondaryContainer : "transparent",
                  color: selected.shape === sh.key ? p.onSecondaryContainer : p.onSurfaceVariant,
                  font: "500 12px Roboto, system-ui, sans-serif",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width={22} height={16}>
                  <g transform="translate(2 2)">
                    <path d={shapePath(sh.key, 18, 12)} fill="none" stroke="currentColor" strokeWidth={1.4} />
                  </g>
                </svg>
                {t(shapeLabel(sh.key), lang)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setLinking(linking ? null : selected.id)}
              className="m3-press"
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 17,
                border: "none",
                background: linking ? p.primary : p.surfaceContainerHighest,
                color: linking ? p.onPrimary : p.onSurfaceVariant,
                font: "500 12px Roboto, system-ui, sans-serif",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="conversion_path" size={16} />
              {linking ? t("flowLinking", lang) : t("flowConnect", lang)}
            </button>
            <button
              onClick={() => {
                const name = window.prompt(t("flowRename", lang), selected.label);
                if (name !== null) onBoard(renameBox(board, selected.id, name));
              }}
              className="m3-press"
              style={{ height: 34, padding: "0 14px", borderRadius: 17, border: "none", background: p.surfaceContainerHighest, color: p.onSurfaceVariant, font: "500 12px Roboto, system-ui, sans-serif", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="edit" size={16} />
              {t("flowRename", lang)}
            </button>
            <button
              onClick={() => {
                onBoard(removeBox(board, selected.id));
                onSelect(null);
              }}
              className="m3-press"
              style={{ height: 34, padding: "0 14px", borderRadius: 17, border: "none", background: p.errorContainer, color: p.onErrorContainer, font: "500 12px Roboto, system-ui, sans-serif", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="delete" size={16} />
              {t("delete", lang)}
            </button>
          </div>
          {linking && <div style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.primary }}>{t("flowLinkHint", lang)}</div>}
        </div>
      )}

      {/* 常用流程组件：加的是"通用步骤"，不属于任何一屏 */}
      <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 20, background: p.surfaceContainerLow, border: `1px solid ${p.outlineVariant}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="widgets" size={18} />
          <span style={{ font: "500 13px Roboto, system-ui, sans-serif" }}>{t("flowParts", lang)}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {COMMON_PARTS.map((part) => (
            <button
              key={part.key}
              onClick={() => add(part.shape, t(part.label, lang))}
              title={t(part.label, lang)}
              className="m3-press"
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 17,
                border: `1px solid ${p.outlineVariant}`,
                background: "transparent",
                color: p.onSurface,
                font: "500 12px Roboto, system-ui, sans-serif",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width={22} height={16}>
                <g transform="translate(2 2)">
                  <path d={shapePath(part.shape, 18, 12)} fill="none" stroke="currentColor" strokeWidth={1.4} />
                </g>
              </svg>
              {t(part.label, lang)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 形状画布比节点大出来的那一圈：给描边留地方 */
const SHAPE_PAD = 4;

/** 常用组件：流程图里反复出现的那几个，按惯例配形状 */
const COMMON_PARTS: { key: string; shape: FlowShape; label: UIKey }[] = [
  { key: "start", shape: "terminator", label: "flowPartStart" },
  { key: "end", shape: "terminator", label: "flowPartEnd" },
  { key: "step", shape: "process", label: "flowPartStep" },
  { key: "branch", shape: "decision", label: "flowPartBranch" },
  { key: "input", shape: "data", label: "flowPartInput" },
  { key: "output", shape: "data", label: "flowPartOutput" },
  { key: "store", shape: "database", label: "flowPartStore" },
  { key: "doc", shape: "document", label: "flowPartDoc" },
  { key: "manual", shape: "manual", label: "flowPartManual" },
  { key: "prepare", shape: "preparation", label: "flowPartPrepare" },
];

/** 形状的可见名字（点选那一排用） */
const shapeLabel = (s: FlowShape): UIKey =>
  ({ process: "flowShapeProcess", decision: "flowShapeDecision", terminator: "flowShapeTerminator", data: "flowShapeData", document: "flowShapeDocument", database: "flowShapeDatabase", manual: "flowShapeManual", preparation: "flowShapePreparation", connector: "flowShapeConnector" })[s] as UIKey;

/** 两个节点之间的一条弧线：右边出、左边进；同列或回头时绕一下 */
export function linkPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  if (x2 > x1 + 20) {
    const c = Math.max(40, (x2 - x1) / 2);
    return { d: `M ${x1} ${y1} C ${x1 + c} ${y1} ${x2 - c} ${y2} ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
  }
  /* 回头/同列：从右边绕出去 */
  const side = Math.max(x1, b.x + NODE_W) + 56;
  return { d: `M ${x1} ${y1} C ${side} ${y1} ${side} ${y2} ${x2} ${y2}`, mx: side, my: (y1 + y2) / 2 };
}
