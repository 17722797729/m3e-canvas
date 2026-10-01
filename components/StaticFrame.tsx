"use client";

import {
  GAP,
  Group,
  Item,
  MEASURED,
  Palette,
  Theme,
  childDrawn,
  byLayer,
  fillColor,
  foldMargins,
  type Frame,
  foldPlace,
  fontFamilyOf,
  freeRadii,
  layoutOf,
  radiiOfRuns,
  sizeOf,
} from "@/lib/tokens";
import type { Lang } from "@/lib/i18n";
import { modalRailOf } from "@/lib/rail";
import { M3Static } from "./M3Node";

const PLACED: React.CSSProperties = { position: "absolute" };

/**
 * 一帧内容画成静态的一帧
 * ---------------------------------------------------------------------------
 * 编辑器画布、导出 PNG、市场里的预览与缩略图，走的是同一套几何：
 * 自由组用 freeRadii，连排组用 runRadii，折叠的导航部件按 foldPlace 挪到角落，
 * 字体取自文档主题。区别只在于这里不画屏幕背景、也没有选中框和动画 ——
 * 这一段正是「市场里看到的和画布上不一样」最容易出错的地方，所以只留一份实现。
 */
export function StaticFrame({
  groups,
  widths,
  palette,
  theme,
  lang,
  w,
  h,
  offset,
  showModalScrim,
  clip,
  className,
}: {
  groups: Group[];
  widths: Record<string, number>;
  palette: Palette;
  theme: Theme;
  lang: Lang;
  /** 画布尺寸：组件是紧凑包围盒，屏幕上的一帧就是屏幕大小 */
  w: number;
  h: number;
  /** 画的是「某个屏幕里的内容」时，把世界坐标挪到屏幕的左上角 */
  offset?: { x: number; y: number };
  /** 这一帧里有以模态方式展开的导航栏时，压一层遮罩（与画布、导出一致） */
  showModalScrim?: boolean;
  /** 屏幕自己负责圆角时，把内容裁在盒子里 */
  clip?: number;
  className?: string;
}) {
  const dx = offset?.x ?? 0;
  const dy = offset?.y ?? 0;
  const children = (parent: Item): React.ReactNode =>
    (parent.children ?? [])
      .filter((c, i) => childDrawn(parent, c, i))
      .sort(byLayer)
      .map((c) => {
        const place = foldPlace(c, widths);
        return (
          <div key={c.id} style={{ ...PLACED, left: c.x + place.dx, top: c.y + place.dy }}>
            <M3Static item={c} palette={palette} overlay={children(c)} />
          </div>
        );
      });

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: w,
        height: h,
        overflow: "hidden",
        fontFamily: fontFamilyOf(theme.font, lang),
      }}
    >
      {groups.map((g, gi) =>
        g.free ? (
          ((corners) =>
            layoutOf(g, widths).map((pl, i) => (
              <div key={`${g.id ?? gi}-${pl.item.id}-${i}`} style={{ ...PLACED, left: pl.x - dx, top: pl.y - dy, zIndex: showModalScrim && modalRailOf(g) ? 2 : undefined }}>
                <M3Static
                  item={pl.item}
                  palette={palette}
                  radii={corners.get(pl.item.id)}
                  style={MEASURED.includes(pl.item.kind) ? undefined : { width: pl.w, height: pl.h }}
                  overlay={children(pl.item)}
                />
              </div>
            )))(freeRadii(g, widths))
        ) : (
          ((radii) => (
            <div
              key={`run-${g.id ?? gi}`}
              style={{
                position: "absolute",
                left: g.x - dx,
                top: g.y - dy,
                zIndex: showModalScrim && modalRailOf(g) ? 2 : undefined,
                display: "flex",
                flexDirection: g.axis === "x" ? "row" : "column",
                alignItems: g.axis === "x" ? "center" : "stretch",
                gap: GAP,
              }}
            >
              {g.items.map((it) => (
                <M3Static
                  key={it.id}
                  item={it}
                  palette={palette}
                  radii={radii.get(it.id)}
                  style={{ width: sizeOf(it, widths).w, height: sizeOf(it, widths).h, ...foldMargins(it, widths) }}
                  overlay={children(it)}
                />
              ))}
            </div>
          ))(radiiOfRuns([g]))
        ),
      )}
      {showModalScrim && groups.some((g) => modalRailOf(g)) && (
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", pointerEvents: "none", zIndex: 1 }} />
      )}
    </div>
  );
}

/**
 * 一个屏幕的静态一帧：屏幕底色 + 屏幕里的组
 *
 * 编辑器导出 PNG、市场里「上传前的那一屏长什么样」，用的都是它 ——
 * 屏幕上有什么（背景色、部件、折叠的导航栏、遮罩）这里就画什么。
 * 需要点击交互时用 Preview（预览）画同一份文档，不是这一份。
 */
export function StaticScreen({
  groups,
  widths,
  palette,
  theme,
  lang,
  w,
  h,
  bg,
  clip,
  className,
}: {
  groups: Group[];
  widths: Record<string, number>;
  palette: Palette;
  theme: Theme;
  lang: Lang;
  w: number;
  h: number;
  /** 屏幕底色：取文档里那一屏的 bg */
  bg?: Frame["bg"];
  /** 屏幕自己的圆角，内容裁在里面 */
  clip?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: w,
        height: h,
        background: fillColor(bg, palette, "surface"),
        overflow: "hidden",
        ...(clip ? { borderRadius: clip } : undefined),
      }}
    >
      <StaticFrame
        groups={groups}
        widths={widths}
        palette={palette}
        theme={theme}
        lang={lang}
        w={w}
        h={h}
        offset={{ x: 0, y: 0 }}
        showModalScrim
      />
    </div>
  );
}
