/**
 * 把屏幕外的组件画成图片时的选项与素材。
 *
 * ---------------------------------------------------------------------------
 * 为什么要 `skipFonts`
 *
 * html-to-image 在导出前会遍历 `document.styleSheets`，把每一份样式表里的字体读出来、
 * 内联进克隆出来的那棵树。这份应用有两种字体来源：
 *
 *   · 图标字体 Material Symbols Rounded：本站自托管，`@font-face` 写在 layout 的 `<style>` 里；
 *   · 正文与 CJK：Google Fonts 的两行 `<link>` —— 跨域，`sheet.cssRules` 会抛
 *
 *       Failed to read the 'cssRules' property from 'CSSStyleSheet': Cannot access rules
 *
 * 所以整条内联流程一律关掉（`skipFonts: true`）。
 *
 * 但关掉之后图标也一起没了 —— 图标是用连字（`<span class="msr">menu</span>`）画的，
 * 没有字体就退化成 "menu" 这样的字面文字，缩略图里就是一堆字母。
 *
 * 于是这里只把**图标字体**自己嵌一份：它同源、能 fetch，转成 data URL 写进一段
 * `@font-face` 交给 `fontEmbedCSS`。跨域的 Google 字体不碰，正文回落系统字体 ——
 * 缩略图本来就只有 400px，正文用什么字体肉眼分不出来，图标却是必须的。
 *
 * 代价：图标字体 1.4MB，转 base64 后约 1.9MB，会随上传请求走一次。图片本身很小，
 * 但请求体不小 —— 这是「缩略图必须能看见图标」与「请求体要小」之间的取舍。
 */

/** 图标字体在项目里的位置；带上 basePath，GitHub Pages 那类子路径部署也能取到 */
const ICON_FONT_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/material-symbols-rounded.woff2`;
/** 同一份字体只取一次：一次会话里连续上传几个组件不必重复下载与编码 */
let iconFontCss: Promise<string> | null = null;
/** 太大的字体不值得塞进请求体：超过这个大小就放弃嵌入，图标退化为文字 */
const MAX_EMBED_BYTES = 3 * 1024 * 1024;

/** 把字体文件读成 data URL 形式的 @font-face；取不到就返回空串 */
async function loadIconFontCss(): Promise<string> {
  try {
    const res = await fetch(ICON_FONT_URL);
    if (!res.ok) return "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_EMBED_BYTES) return "";
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `@font-face{font-family:"Material Symbols Rounded";src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2-variations");font-weight:100 700;font-style:normal;font-display:block;}`;
  } catch {
    /* 取不到就退化成没有图标：缩略图仍然能画，上传不该被它拦住 */
    return "";
  }
}

/** 图标字体的内联 CSS，取一次缓存一次 */
export function iconFontEmbedCss(): Promise<string> {
  if (!iconFontCss) iconFontCss = loadIconFontCss();
  return iconFontCss;
}

/** 提前把字体准备好，第一次点上传时就不必等它 */
export const warmIconFont = () => void iconFontEmbedCss();

/**
 * 一帧画成图片时的选项
 *
 * `skipFonts` 是必须的，理由见文件开头。图标字体由 `iconFontEmbedCss()` 单独提供。
 */
export const captureOptions = (w: number, h: number, fontEmbedCSS?: string) => ({
  /** 两倍像素比，缩小后存下来的缩略图才不糊 */
  pixelRatio: 2,
  width: w,
  height: h,
  skipFonts: true as const,
  ...(fontEmbedCSS ? { fontEmbedCSS } : undefined),
});

/** 缩略图一律是正方形，边长这么多像素。卡片最大显示到 ~168px，两倍屏也就 336px，640 足够清晰 */
export const THUMB_SIDE = 640;

/** 组件四周留一点白，别贴着卡片边 */
const THUMB_PAD = 0.08;

/** 组件四周留白之外，内容能占的像素 */
const THUMB_INNER = THUMB_SIDE * (1 - THUMB_PAD * 2);

/**
 * 缩略图里组件该被缩放多少
 *
 * 截图**按这个比例画出来**，而不是先画 1:1 再缩 —— 后者是一次重采样，
 * 又高又窄的组件缩完只剩百来像素，字和图标就糊了。
 */
export function thumbScale(cssW: number, cssH: number): number {
  const w = Math.max(1, cssW);
  const h = Math.max(1, cssH);
  return Math.min(THUMB_INNER / w, THUMB_INNER / h);
}

/**
 * 把一个组件的位图放进正方形画布
 * ---------------------------------------------------------------------------
 * 缩略图以前是「最长边压到 400」，于是一个 546×892 的组件出来就是 245×400 的长条：
 * 塞进方形卡片位里只剩一半，而且内容被压得很小、看着像图标坏了。
 *
 * 现在统一成正方形、按比例居中、四周补白 —— 又高又窄的导航栏和又扁又宽的按钮行，
 * 在卡片里都是完整的一张，而且因为截图就是按最终比例画的，字与图标都清楚。
 */
export function squareThumbnail(
  img: CanvasImageSource & { width: number; height: number },
): string | undefined {
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_SIDE;
  canvas.height = THUMB_SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  /* 组件原来是透明的地方给一块白底：PNG 的透明在卡片里会糊成一片 */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const srcW = Math.max(1, img.width);
  const srcH = Math.max(1, img.height);
  /* 截图已经是按 thumbScale 画好的，这里只做居中摆放 */
  const k = Math.min(THUMB_SIDE / srcW, THUMB_SIDE / srcH);
  const w = Math.max(1, Math.round(srcW * k));
  const h = Math.max(1, Math.round(srcH * k));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, Math.round((THUMB_SIDE - w) / 2), Math.round((THUMB_SIDE - h) / 2), w, h);
  return canvas.toDataURL("image/png");
}
