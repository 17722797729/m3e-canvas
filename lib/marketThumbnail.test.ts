import { describe, expect, it } from "vitest";
import { BLANK_INK, blankStill, captureBox, captureOptions, inkShare } from "./marketThumbnail";

/* 缩略图导出必须带 `skipFonts`，理由见 lib/marketThumbnail.ts：不带就会去读跨域样式表的
 * `cssRules`，抛 SecurityError，本地开发时被 Next.js 弹成红色错误浮层，看着像上传失败。 */
describe("the thumbnail capture options", () => {
  it("skips the automatic font walk, so a cross-origin stylesheet is never read", () => {
    expect(captureOptions(412, 892)).toMatchObject({ skipFonts: true });
  });

  /* 图标是用连字画的：字体不嵌进去，缩略图里就是 "menu" 这样的字面文字 */
  it("carries the icon font when one was prepared", () => {
    expect(captureOptions(412, 892, "@font-face{font-family:\"Material Symbols Rounded\"}")).toMatchObject({
      fontEmbedCSS: expect.stringContaining("Material Symbols Rounded"),
    });
  });

  it("leaves the font out when it could not be prepared", () => {
    expect(captureOptions(412, 892, "")).not.toHaveProperty("fontEmbedCSS");
    expect(captureOptions(412, 892)).not.toHaveProperty("fontEmbedCSS");
  });

  it("captures at twice the size, so the stored thumbnail stays sharp", () => {
    expect(captureOptions(412, 892)).toMatchObject({ pixelRatio: 2, width: 412, height: 892 });
  });

  it("asks for the size the component was authored at, not the preview's", () => {
    const options = captureOptions(1280, 800);
    expect(options.width).toBe(1280);
    expect(options.height).toBe(800);
  });
});

/* 截图按**排版**盒子画，不按 getBoundingClientRect() —— 后者带着祖先的 transform。
   真实发生过的一次裁切：上传对话框自己的入场弹簧（scale 0.94 → 1）还在跑时，屏幕外那个截图
   节点被测成 538×155 的 0.94 倍（506×146），这个数会被 captureOptions 写进克隆的 width/height，
   克隆的视口跟着变小 —— 截出来的图右边、下边各被裁掉一截。任务信息条那枚故意探出按钮的徽标
   正好在最右边，第一个被裁掉的就是它。 */
describe("the box a capture is drawn at", () => {
  const node = (offsetWidth: number, offsetHeight: number, width: number, height: number) => ({
    offsetWidth,
    offsetHeight,
    getBoundingClientRect: () => ({ width, height }),
  });

  it("uses the laid-out box, not the rect a running transform scaled", () => {
    expect(captureBox(node(538, 155, 506, 146), 388, 112)).toEqual({ w: 538, h: 155 });
  });

  it("ignores a rect a transform made larger, too", () => {
    expect(captureBox(node(538, 155, 570, 164), 388, 112)).toEqual({ w: 538, h: 155 });
  });

  it("falls back to the rect when the node has no layout box yet", () => {
    expect(captureBox(node(0, 0, 506.4, 146.2), 388, 112)).toEqual({ w: 506, h: 146 });
  });

  it("falls back to the size the component was authored at", () => {
    expect(captureBox(node(0, 0, 0, 0), 388, 112)).toEqual({ w: 388, h: 112 });
  });

  it("never asks for a zero-sized capture", () => {
    expect(captureBox(node(0, 0, 0, 0))).toEqual({ w: 1, h: 1 });
  });
});

/* 空白缩略图：底是白的，所以"画出来是白的"和"根本没画出来"在卡片里长得一样 —— 而数据 URL
   照旧非空、也没有任何报错（「上传后缩略图看不见」却看不到错误，就是这么来的）。 */
describe("how much of a still is actually drawn", () => {
  const still = (width: number, height: number) => ({
    width,
    height,
    data: new Array(width * height * 4).fill(255) as number[],
  });
  const paint = (s: ReturnType<typeof still>, at: number, rgb: [number, number, number], alpha = 255) => {
    s.data[at * 4] = rgb[0];
    s.data[at * 4 + 1] = rgb[1];
    s.data[at * 4 + 2] = rgb[2];
    s.data[at * 4 + 3] = alpha;
  };

  it("calls an untouched white still blank", () => {
    const s = still(640, 640);
    expect(inkShare(s)).toBe(0);
    expect(blankStill(s)).toBe(true);
  });

  it("calls a transparent still blank", () => {
    const s = still(640, 640);
    s.data.fill(0);
    expect(blankStill(s)).toBe(true);
  });

  it("calls a still with only a speck of dust blank", () => {
    const s = still(640, 640);
    paint(s, 0, [0, 0, 0]);
    expect(inkShare(s)).toBeLessThan(BLANK_INK);
    expect(blankStill(s)).toBe(true);
  });

  it("counts a component drawn only in a light surface colour as content", () => {
    /* surfaceContainerLow 那一类浅色底（247）也在数里：只画了一块浅色底的组件不是空白 */
    const s = still(100, 100);
    for (let i = 0; i < 100; i++) paint(s, i, [247, 242, 250]);
    expect(inkShare(s)).toBeCloseTo(0.01, 5);
    expect(blankStill(s)).toBe(false);
  });

  it("sees a real component, however little of the square it fills", () => {
    /* 又扁又宽的组件：640 宽的一条，只占 640×640 里的一条 */
    const s = still(640, 640);
    for (let y = 0; y < 184; y++) for (let x = 0; x < 640; x++) paint(s, y * 640 + x, [29, 27, 32]);
    expect(inkShare(s)).toBeCloseTo(184 / 640, 3);
    expect(blankStill(s)).toBe(false);
  });

  it("treats a too-short pixel buffer as nothing drawn, rather than throwing", () => {
    expect(inkShare({ width: 10, height: 10, data: [0, 0, 0] })).toBe(0);
    expect(inkShare({ width: 0, height: 0, data: [] })).toBe(0);
  });
});
