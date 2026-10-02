/**
 * 产物加固脚本
 *
 *   node scripts/harden-out.mjs            # 只做安全且无损的那部分（去掉 sourcemap + 体检）
 *   node scripts/harden-out.mjs --deter    # 额外注入运行时的“劝退”层（右键 / F12 / 反调试）
 *
 * 两件事分开，是因为它们的性质完全不同：
 *
 * 1. 去掉 sourcemap —— 这是唯一真正“泄密”的一项。带上 .map 等于把源码按原样放在
 *    服务器上（DevTools 里能直接看到原始文件）。Next 的生产构建本来不生成，
 *    但换配置、换工具链后可能会冒出来，所以每次都检查一遍。
 *
 * 2. 劝退层（--deter）—— 注入一段脚本，拦右键与开发者工具快捷键，检测到 DevTools 打开时
 *    暂停执行。它**拦不住任何人**：禁掉 JS 就没了，DevTools 也能从菜单打开。
 *    它的价值只有一个：让“随手看看”变麻烦。所以它是可选的、可整段删掉的，
 *    而且绝不用它保护任何真实机密。
 *
 * 关于代码混淆：本仓库**不做**。实测（javascript-obfuscator 5.8.1）无论是只改标识符名、
 * 还是改字符串数组，都会打断 Turbopack 跨 chunk 的模块表 —— 产物能画出界面但立刻抛
 * `Array[...] is not a function`，功能是坏的。代码混淆在 Next.js 这种多 chunk 产物上
 * 属于“要么没用、要么跑不起来”，具体替代方案见 README 的「安全加固」一节。
 */
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "out");
/** 部署到子路径时（NEXT_PUBLIC_BASE_PATH）注入的引用也要带上前缀 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const deter = process.argv.includes("--deter");

/** 劝退层：单独一个文件，随时可以整段删掉，不影响别的产物 */
const DETER_JS = `/*! 劝退层：只提高随手翻看的成本，不构成任何安全边界。可以删除本文件与页面里对它的引用。 */
(function () {
  "use strict";
  try {
    /* 右键菜单与常见快捷键 */
    document.addEventListener("contextmenu", function (e) { e.preventDefault(); }, { capture: true });
    document.addEventListener(
      "keydown",
      function (e) {
        var k = (e.key || "").toLowerCase();
        var combo = e.ctrlKey || e.metaKey;
        var hit =
          k === "f12" ||
          (combo && e.shiftKey && (k === "i" || k === "j" || k === "c")) ||
          (combo && k === "u");
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      { capture: true },
    );
    /* DevTools 打开时暂停主线程：靠的是 debugger 语句，一旦关闭调试就无效 */
    setInterval(function () {
      var t0 = performance.now();
      /* eslint-disable-next-line no-debugger */
      debugger;
      if (performance.now() - t0 > 120) {
        /* 检测到了也不做别的：拖慢一点就够 */
      }
    }, 1500);
  } catch (e) {
    /* 劝退层绝不能影响正常使用：任何异常都安静地放过 */
  }
})();
`;

const dropSourceMaps = async (dir) => {
  let removed = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) removed += await dropSourceMaps(full);
    else if (entry.name.endsWith(".map")) {
      await unlink(full);
      removed += 1;
    }
  }
  return removed;
};

const injectDeterrent = async () => {
  await writeFile(path.join(OUT, "deter.js"), DETER_JS);
  let pages = 0;
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith(".html")) continue;
      let html = await readFile(full, "utf8");
      if (html.includes("deter.js")) continue;
      /* 放在 head 最前面：拦截要在页面自己的脚本之前装上 */
      html = html.replace("<head>", `<head><script src="${BASE}/deter.js" defer></script>`);
      await writeFile(full, html);
      pages += 1;
    }
  };
  await walk(OUT);
  console.log(`劝退层已注入 ${pages} 个页面（out/deter.js）`);
};

const main = async () => {
  if (!existsSync(OUT)) {
    console.error("找不到 out/：先跑 npm run build");
    process.exit(1);
  }

  const maps = await dropSourceMaps(OUT);
  console.log(maps > 0 ? `删掉 ${maps} 个 sourcemap` : "没有 sourcemap（生产构建本来就不生成）");

  if (deter) await injectDeterrent();
  else console.log("未注入劝退层（要的话加 --deter）");
};

await main();
