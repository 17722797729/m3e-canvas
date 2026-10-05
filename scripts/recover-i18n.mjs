/**
 * 补回 lib/i18n.ts 缺的文案
 *
 * 事故：写文件时把 Editor 的内容写进了 lib/i18n.ts，四语表被覆盖。
 * 处理：① git 取回本次会话之前那一版；② 会话新增的键从**上次构建的产物**里抄回来
 * （键与四语值都还在，不必凭记忆重打）；③ 产物之后才加的键用 LATE 表明写。
 *
 * 插入位置按**表头**定位，不按"找 `};`"——上次就是那样插进了另一张表。
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const root = process.cwd();
const i18nPath = `${root}/lib/i18n.ts`;
const dry = process.argv.includes("--dry");

/** 最后一次构建之后才加的键：产物里没有 */
const LATE = {
  canvasTabs: { ja: "キャンバス", en: "Canvases", zh: "画布标签页", ko: "캔버스" },
  canvasUntitled: { ja: "無題のキャンバス", en: "Untitled canvas", zh: "未命名画布", ko: "제목 없는 캔버스" },
  canvasClose: { ja: "このキャンバスを閉じる", en: "Close this canvas", zh: "关闭这个画布", ko: "이 캔버스 닫기" },
  canvasSwitched: { ja: "「{name}」に切り替えました", en: "Switched to “{name}”", zh: "已切换到「{name}」", ko: "「{name}」로 전환했습니다" },
  canvasAdded: { ja: "新しいキャンバスを追加しました", en: "New canvas added", zh: "已新建一个空白画布", ko: "새 캔버스를 추가했습니다" },
  canvasNew: { ja: "キャンバスを追加", en: "New canvas", zh: "新建画布", ko: "캔버스 추가" },
  canvasOpened: { ja: "開いています", en: "Open", zh: "已打开", ko: "열림" },
};

const chunksDir = `${root}/out/_next/static/chunks`;
const MULTI = /([A-Za-z_$][\w$]*):\{ja:("(?:[^"\\]|\\.)*"),en:("(?:[^"\\]|\\.)*"),zh:("(?:[^"\\]|\\.)*")\}/;
const chunkFile = readdirSync(chunksDir)
  .filter((f) => f.endsWith(".js"))
  .map((f) => `${chunksDir}/${f}`)
  .find((f) => MULTI.test(readFileSync(f, "utf8")));
if (!chunkFile) {
  console.error("找不到含多语表的 chunk");
  process.exit(1);
}
const code = readFileSync(chunkFile, "utf8");

const artifactLangs = new Map();
const artifactKo = new Map();
for (const m of code.matchAll(/([A-Za-z_$][\w$]*):\{ja:("(?:[^"\\]|\\.)*"),en:("(?:[^"\\]|\\.)*"),zh:("(?:[^"\\]|\\.)*")\}/g)) {
  artifactLangs.set(m[1], { ja: JSON.parse(m[2]), en: JSON.parse(m[3]), zh: JSON.parse(m[4]) });
}
for (const m of code.matchAll(/([A-Za-z_$][\w$]*):("(?:[^"\\]|\\.)*")/g)) {
  if (!["ja", "en", "zh"].includes(m[1])) artifactKo.set(m[1], JSON.parse(m[2]));
}

let src = readFileSync(i18nPath, "utf8");
const uiHead = "export const UI = {";
const koHead = "export const KO: Record<UIKey, string> = {";
const uiBody = src.slice(src.indexOf(uiHead), src.indexOf(koHead));
const koBody = src.slice(src.indexOf(koHead));
const has = (body, key) => new RegExp(`^  ${key}:`, "m").test(body);

const wantUi = { ...Object.fromEntries(artifactLangs), ...LATE };
const wantKo = {
  ...Object.fromEntries(artifactKo),
  ...Object.fromEntries(Object.entries(LATE).map(([k, v]) => [k, v.ko])),
};
const missingUi = Object.keys(wantUi).filter((k) => !has(uiBody, k));
const missingKo = Object.keys(wantKo).filter((k) => wantKo[k] && !has(koBody, k));

console.log(`产物多语键 ${artifactLangs.size}，韩语键 ${artifactKo.size}`);
console.log(`UI 缺 ${missingUi.length}：${missingUi.join(", ") || "（无）"}`);
console.log(`KO 缺 ${missingKo.length}：${missingKo.join(", ") || "（无）"}`);
if (dry || (missingUi.length === 0 && missingKo.length === 0)) process.exit(0);

/** 表头之后配平的那个 `}` 的下标 */
const closeBrace = (text, head) => {
  const brace = text.indexOf("{", text.indexOf(head));
  let depth = 0;
  for (let i = brace; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
};

if (missingUi.length) {
  const block = missingUi
    .map((k) => {
      const { ja, en, zh } = wantUi[k];
      return `  ${k}: { ja: ${JSON.stringify(ja)}, en: ${JSON.stringify(en)}, zh: ${JSON.stringify(zh)} },`;
    })
    .join("\n");
  const at = closeBrace(src, uiHead);
  src = `${src.slice(0, at)}${block}\n${src.slice(at)}`;
}
if (missingKo.length) {
  const block = missingKo.map((k) => `  ${k}: ${JSON.stringify(wantKo[k])},`).join("\n");
  const at = closeBrace(src, koHead);
  src = `${src.slice(0, at)}${block}\n${src.slice(at)}`;
}
writeFileSync(i18nPath, src);
console.log("已补齐");
