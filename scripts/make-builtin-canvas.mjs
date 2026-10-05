/**
 * 重新生成内置画布「QQ 农场」的出厂内容
 *
 * 用法：node scripts/make-builtin-canvas.mjs <导出的画布.json>
 *
 * 三处**有意**不照抄原稿的地方，都是为了"内置那份要和新建画布长得一样"：
 *   · `paletteKey` 丢掉（**不写死任何一套配色**）。原稿是什么都不写：读文档的
 *     每一处都会用 `readDoc` 补上 `DEFAULT_PALETTE_KEY`（见 lib/project.ts），
 *     也就是出厂默认的那一套。写死一套配色会跟着默认值改而失配 —— 上一轮这里
 *     写的是 `purple`，默认改成 Mono 之后内置画布就成了唯一还紫着的一份。
 *   · `customPalette` 丢掉。原稿里它配的是 `paletteKey: "mono"`，
 *     而 `paletteOf` 只在 key 为 `"custom"` 时才用它 —— 留着是死数据，
 *     还会让人以为配色来自它。
 *   · `theme` 丢掉（**不写死 DEFAULT_THEME**）。原稿带的是当初那台机器上的
 *     `contrast: "high" / shape: "square" / font: "robotoSerif"`，所以内置画布
 *     看起来和新画布不一样（标题栏一个发灰一个发黑）。没有 theme 时，
 *     读文档的每一处都会用 `normalizeTheme` 补上 `DEFAULT_THEME`
 *     （见 readDoc / Editor / Preview / prompt），也就是新建画布那一套。
 *     写死一份默认值反而会跟着 tokens 改而失配，所以这里选择"不写"。
 *
 * 为什么要脚本而不是手写：这份内容是**一份真实画布**，字段多且会一起变
 * （配色、主题、自定义组件、每屏的背景…）。之前吃过亏 —— 手写转换只搬了
 * frames/groups，把 customPalette / theme / customParts 全丢了，
 * 于是内置画布在新机器上"长得和原稿不一样"。
 *
 * 所以这里的原则是"照抄"：除了 title、paletteKey、customPalette、theme 之外一个字段都不动，
 * 只做一件必要的清理 —— 去掉值为 null 的 locked（校验只接受 boolean 或缺失）。
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) {
  console.error("用法：node scripts/make-builtin-canvas.mjs <导出的画布.json>");
  process.exit(1);
}

const doc = JSON.parse(readFileSync(src, "utf8"));

/* 照抄，只把标题清掉（标题由画布名给，不写进内容） */
const out = { ...doc, title: "" };

/* 配色不写死：内置那份跟着应用默认（readDoc 补 DEFAULT_PALETTE_KEY），
   和"新建画布"同一套；默认改了它跟着改。 */
delete out.paletteKey;
delete out.customPalette;

/* 主题也统一到新建画布那套：干脆不写 theme，让 normalizeTheme 补 DEFAULT_THEME。
   写死 DEFAULT_THEME 会跟着 tokens 一起变，不写就不会失配。 */
delete out.theme;

/* locked: null 过不了 isProject 的校验；缺失才是"没锁" */
for (const g of out.groups ?? []) if (g.locked === null) delete g.locked;
for (const f of out.frames ?? []) if (f.locked === null) delete f.locked;

const kept = ["groups", "frames", "frame", "title", "brief", "dynamicColor", "customParts"];
const dropped = Object.keys(out).filter((k) => !kept.includes(k));

const body = JSON.stringify(out);
const file = `import { Doc } from "./tokens";

/** 内置画布的 id 与名字：它随代码走，不随存储走 */
export const BUILTIN_CANVAS_ID = "qq-farm";
export const BUILTIN_CANVAS_NAME = "QQ 农场";

/**
 * 内置画布「QQ 农场」的出厂内容
 *
 * 这就是那一套真实原型（${out.frames?.length ?? 0} 屏 / ${out.groups?.length ?? 0} 组 / ${(out.customParts ?? []).length} 个自定义组件）。
 * 它随产品一起来，永远在画布清单里、排第一、删不掉。
 *
 * 内容是数据，不是手写的常量：由 \`scripts/make-builtin-canvas.mjs\` 从真实画布导出后
 * **原样照抄**（自定义组件都在）。改内容请重新导出，不要手改这一行。
 *
 * 两处按"要和新建画布长得一样"有意改过：**不写 paletteKey**（读的时候 readDoc 补
 * DEFAULT_PALETTE_KEY，和新建画布同一个默认配色），并且**不写 theme** —— 读的时候
 * normalizeTheme 会补上 DEFAULT_THEME，和新建画布同一套。重新生成由脚本负责，
 * 别再让原稿的配色或主题漂回来。
 */
export const BUILTIN_CANVAS_DOC: Doc = JSON.parse(String.raw\`${body}\`) as Doc;
`;

writeFileSync("lib/builtinCanvas.ts", file);
console.log(
  `写出 lib/builtinCanvas.ts：${out.frames?.length ?? 0} 屏 · ${out.groups?.length ?? 0} 组 · ` +
    `${(out.customParts ?? []).length} 个自定义组件 · paletteKey=不写（读的时候补 DEFAULT_PALETTE_KEY）· ` +
    `theme=不写（读的时候补 DEFAULT_THEME，同新建画布）`,
);
if (dropped.length) console.log("未搬过来的键（应为空）：", dropped);
