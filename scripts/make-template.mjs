/**
 * 把一个真实画布（.json）转成内置模板
 *
 *   node scripts/make-template.mjs ~/Downloads/m3e-canvas.json \
 *        --id qq-farm --name "QQ 农场" --replace
 *
 * 为什么要有这个脚本：内置模板是**代码**（lib/templates.ts 里的常量），
 * 而你画布上的东西只有浏览器知道。与其手抄一遍，不如把你导出的 .json 读进来，
 * 机械地转成同样形状的常量，写回那个文件。
 *
 * 它做的换算（和「新增模板」在应用里做的事完全一样，见 lib/templates.ts）：
 *   · 连排组里的部件坐标在画布上是相对组原点的，模板里统一成全局坐标；
 *   · id 换成固定的、能看懂的名字（qq-farm-1、qq-farm-1-2 …），重复导入结果一致，
 *     diff 里也就只看得见真正变了的东西。
 *
 * --replace 会替换掉同 id 的内置模板；不加就是新增一条。
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FILE = path.resolve(process.cwd(), "lib/templates.ts");
/** 模板常量放在这对标记之间，脚本只改这一段 */
const BEGIN = "/* ==== 内置模板：由 scripts/make-template.mjs 生成，请勿手改 ==== */";
const END = "/* ==== 内置模板结束 ==== */";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const replace = args.includes("--replace");

if (!input) {
  console.error("用法：node scripts/make-template.mjs <画布.json> --id <id> --name <名称> [--replace]");
  process.exit(1);
}

const raw = JSON.parse(await readFile(path.resolve(process.cwd(), input), "utf8"));
const frames = Array.isArray(raw.frames) ? raw.frames : [];
const groups = Array.isArray(raw.groups) ? raw.groups : [];
if (frames.length === 0) {
  console.error("这份文件里没有屏幕（frames 为空），不像是一份画布");
  process.exit(1);
}

const slug = flag("id", "template").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
const name = flag("name", "未命名模板");

/** 一个组是不是手摆的（部件各带偏移），只有手摆组不需要坐标换算 */
const isFree = (g) => g.free === true;

/**
 * 屏幕该带走的字段
 *
 * 屏幕不只是"一块尺寸"：弹框是 `role: overlay` 加 `level`，会自己关掉的浮层还有 `autoClose`，
 * 滑动去下一屏靠 `swipe`。这些漏掉的话，模板摆出来是一堆死的画。
 * `locked` 不带 —— 那个字段早就没用了（见 lib/tokens.ts）。
 */
const FRAME_FIELDS = ["bg", "note", "noteHistory", "role", "level", "autoClose", "swipe", "place"];
const pickFrame = (f) => Object.fromEntries(FRAME_FIELDS.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]));

const outFrames = frames.map((f, i) => ({
  id: `${slug}-f${i + 1}`,
  name: String(f.name ?? `屏幕 ${i + 1}`),
  x: Math.round(f.x ?? 0),
  y: Math.round(f.y ?? 0),
  w: Math.round(f.w ?? 412),
  h: Math.round(f.h ?? 892),
  ...pickFrame(f),
}));

/* 屏幕 id 要跟着换，组上的归属才对得上 */
const frameMap = new Map(frames.map((f, i) => [f.id, outFrames[i].id]));

/**
 * 组属于哪一屏
 *
 * 画布上不是每个组都记得自己的屏幕：老一点的文档只写了坐标，归属是打开时按几何算出来的
 * （见 lib/tokens.ts 的 frameOfGroup）。导入时就把这件事做掉，模板里因此每一组都认领得明明白白。
 * 算不出落点的大件（比如跨屏的浮层）就留空，套用时再按同一套几何兜底。
 */
const frameOf = (g) => {
  /* 记着归属的，把旧 id 换成新的 */
  if (g.frameId && frameMap.has(g.frameId)) return frameMap.get(g.frameId);
  /* 按几何算：取组包围盒的中心落在哪一屏 —— 和编辑器 frameOfGroup 同一套兜底。
     包围盒只看位置与尺寸，不去算字体，够用来分辨"这一组属于哪一屏"。 */
  const gx = Number(g.x) || 0;
  const gy = Number(g.y) || 0;
  let l = gx;
  let t = gy;
  let r = gx;
  let b = gy;
  for (const it of g.items ?? []) {
    const free = g.free && g.pos && typeof g.pos === "object";
    const at = free ? g.pos[it.id] : undefined;
    const ix = gx + (free ? Number(at?.x) || 0 : Number(it.x) || 0);
    const iy = gy + (free ? Number(at?.y) || 0 : Number(it.y) || 0);
    l = Math.min(l, ix);
    t = Math.min(t, iy);
    r = Math.max(r, ix + (Number(it.size) || 0));
    b = Math.max(b, iy + (Number(it.size2) || 0));
  }
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;
  const hit = frames.find((f) => cx >= f.x && cx <= f.x + (f.w ?? 412) && cy >= f.y && cy <= f.y + (f.h ?? 892));
  return hit ? frameMap.get(hit.id) : undefined;
};

const outGroups = groups.map((g, gi) => ({
  ...g,
  /* 锁是旧版本画布上的东西，读进来就会被丢掉，索性不带进模板 */
  locked: undefined,
  id: `${slug}-g${gi + 1}`,
  ...(frameOf(g) ? { frameId: frameOf(g) } : undefined),
  x: Math.round(g.x ?? 0),
  y: Math.round(g.y ?? 0),
  items: (g.items ?? []).map((it, ii) => ({
    ...it,
    id: `${slug}-g${gi + 1}-i${ii + 1}`,
    ...(isFree(g) ? undefined : { x: Math.round((it.x ?? 0) + (g.x ?? 0)), y: Math.round((it.y ?? 0) + (g.y ?? 0)) }),
  })),
}));

/** 一个模板常量的名字：qq-farm → QQ_FARM */
const constName = (id) => id.replace(/[^a-z0-9]+/gi, "_").toUpperCase();

/* 模板是数据，一行一个部件太占地方：紧凑 JSON 让这个文件还能用眼睛翻 */
const indent = (json, pad) => JSON.stringify(json).replace(/\n/g, `\n${pad}`);

const body = `export const ${constName(slug)}: Template = {
  id: ${JSON.stringify(slug)},
  name: ${JSON.stringify(name)},
  builtin: true,
  screens: {
    frames: ${indent(outFrames, "    ")},
    groups: ${indent(outGroups, "    ")},
  },
};`;

let src = await readFile(FILE, "utf8");
if (!src.includes(BEGIN) || !src.includes(END)) {
  console.error(`lib/templates.ts 里找不到生成标记，先把常量放进 ${BEGIN} 与 ${END} 之间`);
  process.exit(1);
}

const [head, rest] = src.split(BEGIN);
const [block, tail] = rest.split(END);
const blockBody = block.trim();
/** 从生成段里挑出没被这次的 id 覆盖掉的那些模板；每一条是「export const X: Template = {...};」 */
const kept = [];
for (const chunk of blockBody.split(/\n(?=export const )/)) {
  const id = /^\s*id: "([^"]+)"/m.exec(chunk)?.[1];
  if (!id) continue;
  if (id === slug) {
    if (!replace) {
      console.error(`已经有一个内置模板叫 ${slug}；要替换请加 --replace`);
      process.exit(1);
    }
    continue;
  }
  kept.push(chunk.trimEnd());
}

/** 内置模板的清单也由脚本维护，免得添了一条忘了登记 */
const order = [slug, ...kept.map((c) => /^export const (\w+)/m.exec(c)?.[1]).filter(Boolean)];
const list = `/** 内置模板：排在最前面，删不掉 */\nexport const BUILTIN_TEMPLATES: Template[] = [${order.map((n) => (n === slug ? constName(slug) : n)).join(", ")}];`;
const next = [body, ...kept, list].join("\n\n");
await writeFile(FILE, `${head}${BEGIN}\n${next}\n${END}${tail}`);

const kinds = outGroups.reduce((n, g) => n + g.items.length, 0);
console.log(`已写入 ${slug}：${outFrames.length} 个屏幕、${outGroups.length} 个组、${kinds} 个部件`);
console.log(`屏幕：${outFrames.map((f) => f.name).join(" · ")}`);
