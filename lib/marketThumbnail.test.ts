import { describe, expect, it } from "vitest";
import { captureOptions } from "./marketThumbnail";

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
