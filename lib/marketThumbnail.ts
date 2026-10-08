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

/** 图标字体的家族名：`@font-face` 里写的、`.msr` 用的、以及下面等它加载时查的，都是这一个 */
const ICON_FONT_FAMILY = "Material Symbols Rounded";
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
    return `@font-face{font-family:"${ICON_FONT_FAMILY}";src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2-variations");font-weight:100 700;font-style:normal;font-display:block;}`;
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
 * 图标字体真的可以画了
 *
 * `iconFontEmbedCss()` 只保证那段 `@font-face` 到位；连字（`<span class="msr">redeem</span>`）真的
 * 变成一个图标，还要等字体本身加载完。少了这一步，截图就可能赶在字体就绪之前，把一枚图标画成
 * 一个空框或一串字母 —— 那是"缩略图看着不对"里最说不清的一种。导出 PNG（见 app/Editor.tsx 的
 * `saveFrameImage`）同样是先等 `document.fonts`，这里对齐那一条路。
 */
export async function iconFontReady(): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch {
    /* 没有字体接口不是画不出来的理由：接着走，图标退化成文字也还是能画 */
  }
  try {
    await document.fonts?.load(`24px "${ICON_FONT_FAMILY}"`);
  } catch {
    /* 字体取不到由 iconFontEmbedCss 那条路兜底（返回空串 = 不嵌图标字体） */
  }
}

/**
 * 一个节点拿来截图时能量到的两样尺寸
 *
 * `offsetWidth/offsetHeight` 是**排版**盒子，`getBoundingClientRect()` 是**屏幕上**的矩形 ——
 * 后者带着所有祖先的 `transform`（缩放、位移都算）。
 */
export interface CaptureNode {
  offsetWidth: number;
  offsetHeight: number;
  getBoundingClientRect(): { width: number; height: number };
}

/**
 * 截图该按多大画
 * ---------------------------------------------------------------------------
 * 只认排版盒子。原因是一个真实发生过的裁切：对话框自己的入场弹簧（`scale` 0.94 → 1）还在跑的
 * 时候，那个屏幕外的截图节点被测成 0.94 倍（538×155 变成 506×146），而这个数会被
 * `captureOptions` 写进克隆的 `width/height` —— 克隆的视口跟着变小，截出来的图右边和下面各被
 * 裁掉一截。任务信息条那枚**故意探出按钮**的徽标正好在最右边，第一个被裁掉的就是它。
 *
 * 排版盒子（`offsetWidth`）不看 transform，所以量出来的永远是"画了多大"，也是"该画多大"。
 * 它是个整数，和调用方 `Math.round` 写进内联样式的那个数一致，所以弹簧停下来之后量到的和从前
 * 一模一样（这一条不改变任何已经画得出来的缩略图）。
 *
 * 节点没有排版盒子时（`display: none`、还没上屏）才退回矩形，再退回调用方给的尺寸（组件的
 * 作者尺寸）—— 一层层兜底，绝不给出一个 0。
 */
export function captureBox(node: CaptureNode, fallbackW = 1, fallbackH = 1): { w: number; h: number } {
  const rect = node.getBoundingClientRect();
  const side = (layout: number, onScreen: number, fallback: number) =>
    Math.max(1, Math.round(layout || onScreen || fallback || 1));
  return {
    w: side(node.offsetWidth, rect.width, fallbackW),
    h: side(node.offsetHeight, rect.height, fallbackH),
  };
}

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
 * 一张位图的像素：`ImageData` 的形状。写成这个鸭子类型是为了让纯逻辑（下面两个助手）不必碰 DOM
 * 就能测（vitest 里没有 canvas）。
 */
export interface Still {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/** 白底的门槛：截图那一块的底是纯白 `#ffffff`，所以 252 以上都算"这里没画东西" */
const WHITE_FLOOR = 252;

/**
 * 一张图上真的画了东西的比例
 *
 * 缩略图的底是白的（见 `squareThumbnail`），所以"画出来是白的"和"根本没画出来"在卡片里长得
 * 一模一样 —— 而这正是「上传后缩略图看不见」却看不到任何报错的那种失败：截图本身没抛错、数据
 * URL 也照旧非空，只是里面什么都没有。所以它得能被认出来，见下面的 `blankStill`。
 *
 * 只数"不白、也不全透明"的像素；白底和透明都不算内容。
 */
export function inkShare(still: Still, floor = WHITE_FLOOR): number {
  const total = still.width * still.height;
  if (total <= 0 || still.data.length < total * 4) return 0;
  let ink = 0;
  for (let i = 0; i < total * 4; i += 4) {
    if (still.data[i + 3] > 8 && (still.data[i] < floor || still.data[i + 1] < floor || still.data[i + 2] < floor)) ink++;
  }
  return ink / total;
}

/**
 * 千分之零点五：640×640 上连 205 个内容像素都不到，才算空白
 *
 * 门槛故意定得很低 —— 一块浅色的底（`surfaceContainerLow` 那类 247 左右）也在数里，所以只画了
 * 一块浅色底的组件不会被误判成空白。它拦的是**整张全白**（一个像素都没画）那一种。
 */
export const BLANK_INK = 0.0005;

/** 这一张是不是空白的：白方块在卡片里和"没有缩略图"分不出来 */
export const blankStill = (still: Still, floor = WHITE_FLOOR): boolean => inkShare(still, floor) < BLANK_INK;

/** 一张摆好的方图：数据 URL，以及它上面到底有没有内容 */
export interface SquaredStill {
  url: string;
  /** 空白（见 `blankStill`）：带着它上传，列表里就是一个白方块 */
  blank: boolean;
}

/**
 * 把一个组件的位图放进正方形画布
 * ---------------------------------------------------------------------------
 * 缩略图以前是「最长边压到 400」，于是一个 546×892 的组件出来就是 245×400 的长条：
 * 塞进方形卡片位里只剩一半，而且内容被压得很小、看着像图标坏了。
 *
 * 现在统一成正方形、按比例居中、四周补白 —— 又高又窄的导航栏和又扁又宽的按钮行，
 * 在卡片里都是完整的一张，而且因为截图就是按最终比例画的，字与图标都清楚。
 *
 * 顺带回报这一张是不是空白（见 `blankStill`）：白方块和"没有缩略图"在卡片里分不出来，
 * 调用方要能因此说一句话，而不是把它当成一张好图交出去。
 */
export function squareThumbnail(
  img: CanvasImageSource & { width: number; height: number },
): SquaredStill | undefined {
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
  let blank = false;
  try {
    blank = blankStill(ctx.getImageData(0, 0, canvas.width, canvas.height));
  } catch {
    /* 读不回来（画布被污染之类）不等于空白：图照给，别把一张好图丢掉 */
  }
  return { url: canvas.toDataURL("image/png"), blank };
}
