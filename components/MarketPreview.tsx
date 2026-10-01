"use client";

import { useMemo } from "react";
import { DEFAULT_THEME, Group, Item, Palette, PlacedItem, Theme } from "@/lib/tokens";
import type { Lang } from "@/lib/i18n";
import { MarketPart } from "@/lib/market";
import { StaticFrame } from "./StaticFrame";

/**
 * 市场组件的一张静态图
 * ---------------------------------------------------------------------------
 * 与编辑器画布、导出 PNG 走同一套几何（见 StaticFrame）：组还是组、连排还是连排、
 * 字体取自文档主题、测量的部件用它自己的宽度。所以「上传后和原来不一样」这种事
 * 只可能来自数据本身，不再来自渲染。
 *
 * 旧版本上传的扁平数据没有组结构，这里把它折成一组「自由摆放」，一样能画。
 */
export function MarketPreview({
  part,
  palette,
  theme,
  lang,
  widths: authored,
  scale = 1,
}: {
  /** 组件数据解出来的本地形态，见 lib/market.ts */
  part: MarketPart;
  palette: Palette;
  /** 文档主题：正文用哪一款字体由它决定 */
  theme?: Theme;
  lang?: Lang;
  /** 这份组件在源屏幕上的实测宽度表；市场里的组件也带着它一起走 */
  widths?: Record<string, number>;
  /** 缩放：1:1 画出来，再由外层缩放，缩略图才不会糊 */
  scale?: number;
}) {
  const { w, h, groups, items } = part;

  /* 没有实测宽度表时的兜底：让测量的部件以组件盒子为宽，至少不会按内容撑开 */
  const widths = useMemo(() => {
    if (authored && Object.keys(authored).length > 0) return authored;
    const out: Record<string, number> = {};
    const walk = (list: Item[]) => {
      for (const it of list) {
        out[it.id] = w;
        if (it.children) walk(it.children as Item[]);
      }
    };
    groups.forEach((g) => walk(g.items));
    walk(items);
    return out;
  }, [authored, groups, items, w]);

  /* 旧数据的每个组件都是一个「自由摆放」的组，偏移就是它自己的绝对位置 */
  const drawn: Group[] = useMemo(() => {
    if (groups.length > 0) return groups;
    return items.map((it, i) => ({
      id: `flat-${it.id}-${i}`,
      x: 0,
      y: 0,
      axis: "x",
      free: true,
      pos: { [it.id]: { x: it.x, y: it.y } },
      items: [it],
    }));
  }, [groups, items]);

  return (
    <div
      style={{
        width: scale === 1 ? undefined : Math.max(1, Math.round(w * scale)),
        height: scale === 1 ? undefined : Math.max(1, Math.round(h * scale)),
        overflow: "hidden",
        flex: "0 0 auto",
      }}
    >
      <div style={{ transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: "top left", width: w, height: h }}>
        <StaticFrame
          groups={drawn}
          widths={widths}
          palette={palette}
          theme={theme ?? DEFAULT_THEME}
          lang={lang ?? "en"}
          w={w}
          h={h}
        />
      </div>
    </div>
  );
}

export type { PlacedItem };
