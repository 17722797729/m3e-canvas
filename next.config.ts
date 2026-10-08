import type { NextConfig } from "next";

// Set NEXT_PUBLIC_BASE_PATH=/<repo> when deploying to a GitHub Pages project site.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
  turbopack: {
    resolveAlias: {
      /**
       * ali-oss 只在市场缩略图直传时按需加载（lib/ossUpload.ts）。它的 `browser` 字段把
       * `lib/client.js` 换成了 `dist/aliyun-oss-sdk.js`，但那只在浏览器目标上生效：
       * 客户端组件的 SSR 那一趟仍然会解析 `lib/client.js`，那条路上有 `urllib` →
       * `optionalDependencies` 里的 `proxy-agent`（Node 专用，装不到），构建直接报
       * `Module not found: Can't resolve 'proxy-agent'`。
       *
       * 这里干脆把包名指到它自己的浏览器产物上：两条路都用同一份文件，而这段代码本来
       * 也只在浏览器里跑（SSR 那趟不会执行到这个动态 import）。条件别名（`{ browser: ... }`）
       * 不够用 —— 报错的那一趟是 SSR，拿不到 browser 条件。
       */
      "ali-oss": "ali-oss/dist/aliyun-oss-sdk.js",
    },
  },
};

export default nextConfig;
