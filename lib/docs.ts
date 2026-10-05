import { KIND_TEXT, t, type Lang } from "./i18n";
import { CATEGORIES, KIND_SPEC, type Doc, type Kind } from "./tokens";
import { buildGamePlan, type GamePlan } from "./gameplan";
import { SKILL_SECTIONS, skillHeading, type Skill, type SkillSectionKey } from "./skills";

/**
 * 使用文档 / 策划文档
 * ---------------------------------------------------------------------------
 * 内容全部来自**这份画布**（`buildGamePlan` 从文档里读出来的），加上一张组件规格表
 * （`KIND_SPEC`）。所以界面改了、格子加了一行，文档跟着变，不需要谁记得回来改文字。
 *
 * 一个 skill 决定这份文档按哪几节、以什么标题输出（见 `lib/skills.ts`）。skill 只影响
 * **选取与命名**，不改内容 —— 于是同一份画布可以出成策划案，也可以出成给开发的交互规格。
 */

export type DocBlock =
  | { kind: "p"; text: string }
  /** 编号大纲：1. / 1.1 / 1.1.1，策划案的写法 */
  | { kind: "outline"; nodes: { title: string; lines: string[]; depth: number }[] }
  | { kind: "facts"; rows: { label: string; value: string }[] }
  | { kind: "cards"; cards: { title: string; subtitle?: string; lines: string[]; bullets?: string[] }[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export type DocSection = { key: SkillSectionKey; title: string; blocks: DocBlock[] };
/**
 * 大纲每一项的编号
 *
 * **最外层是功能名，不编号**（`仓库：` 而不是 `1 仓库：`）；
 * 计数从功能下面那一层才开始：depth 1 → `1`，depth 2 → `1.1`，各分支独立计数。
 *
 * 抽出来是因为**页面渲染和 Markdown 导出是两条路**：编号规则写两遍，
 * 就一定会有一边忘了改（"页面上还是 1 仓库"就是这么来的）。两边都调这一个。
 */
export function outlineNumbers(nodes: { depth: number }[]): string[] {
  const counters: number[] = [];
  return nodes.map((n) => {
    if (n.depth === 0) {
      /* 换了一条功能：它下面的编号重新从 1 数起 */
      counters.length = 0;
    } else {
      counters[n.depth - 1] = (counters[n.depth - 1] ?? 0) + 1;
      counters.length = n.depth;
    }
    return counters.join(".");
  });
}

export type BuiltDocs = { title: string; sections: DocSection[]; markdown: string };

export function buildDocs(doc: Doc | null, lang: Lang, skill: Skill | null = null, widths: Record<string, number> = {}): BuiltDocs {
  const plan = buildGamePlan(doc, lang, widths);
  /* 整份文档就是"按功能划分"这一棵树。作者明确不要其它信息（尺寸、数量、
     逐屏明细、交互总表…），也不要有开场白 —— skill 只决定怎么写（instructions）。 */
  const use = SKILL_SECTIONS;
  /* 文档标题带上项目名：`QQ农场 游戏 UI 原型文档`；原型没写名字时用通名 */
  const project = (doc?.title ?? "").trim();
  const title = project ? t("docTitleNamed", lang).replace("{name}", project) : t("docTitle", lang);
  const H = (key: SkillSectionKey, fallback: string) => skillHeading(skill, key, lang, fallback);

  const stats: DocSection = {
    key: "stats",
    title: H("stats", t("planStats", lang)),
    blocks: [
      {
        kind: "facts",
        rows: [
          { label: t("planScreensN", lang), value: String(plan.stats.screens) },
          { label: t("planOverlaysN", lang), value: String(plan.stats.overlays) },
          { label: t("planControlsN", lang), value: String(plan.stats.controls) },
          { label: t("planInteractionsN", lang), value: String(plan.stats.interactions) },
          { label: t("planGridsN", lang), value: String(plan.stats.grids) },
          { label: t("planSlotsN", lang), value: String(plan.stats.slots) },
          { label: t("docDocTitle", lang), value: doc?.title?.trim() || t("canvasUntitled", lang) },
        ],
      },
    ],
  };

  /* 功能一览 + 各功能的操作说明：这份文档的主干 */
  const hasGrid = (f: (typeof plan.features)[number]) => f.details.some((x) => x.includes(t("planRowsCols", lang).split("{")[0]));
  const overview: DocSection = {
    key: "features",
    title: H("features", t("featOverview", lang)),
    blocks: [
      { kind: "p", text: t("featOverviewIntro", lang) },
      /* 主界面上每一个入口都算一条"功能"。有对应界面的标"已建"；
         入口指向的那一屏还没做（或只是切个面板）的标"仅有入口"。 */
      {
        kind: "table",
        head: [t("planControls", lang), t("featState", lang), t("featEntry", lang), t("featScreens", lang)],
        rows: (() => {
          const nameOf = (id: string | undefined) => plan.screens.find((s) => s.id === id)?.name;
          const out: { label: string; built: boolean; entry: string; screens: string }[] = plan.features.map((f) => ({
            label: f.name,
            built: true,
            entry: f.entry.join(" / ") || f.name,
            screens: f.screens.join(" / "),
          }));
          const seen = new Set(out.map((r) => r.label));
          for (const n of plan.nav) {
            /* 只有图标没有文字的导航项略过：它的"名字"其实是图标名，列出来是噪音 */
            if (!n.label || n.label === n.icon || seen.has(n.label)) continue;
            seen.add(n.label);
            const asFeature = plan.features.find((f) => f.name === n.label);
            out.push({
              label: n.label,
              built: !!asFeature,
              entry: n.to ? `${n.from} →` : n.from,
              screens: asFeature ? asFeature.screens.join(" / ") : nameOf(n.to) ?? t("featNoScreen", lang),
            });
          }
          return out.map((r) => [r.label, r.built ? t("featBuilt", lang) : t("featPlanned", lang), r.entry, r.screens]);
        })(),
      },
    ],
  };

  const ops: DocSection = {
    key: "operations",
    title: H("operations", t("featOps", lang)),
    blocks: [
      ...plan.features.map((f) => {
        /* 把树摊平成带层级的行，编号由渲染方给 */
        const rows: { title: string; lines: string[]; depth: number }[] = [];
        const walk = (nodes: typeof f.outline, depth: number) => {
          for (const n of nodes) {
            if (n.title || n.lines.length) rows.push({ title: n.title, lines: n.lines, depth });
            walk(n.children, depth + 1);
          }
        };
        walk(f.outline, 0);
        return { kind: "outline" as const, nodes: rows };
      }),
    ],
  };

  const systems: DocSection = {
    key: "systems",
    title: H("systems", t("planSystems", lang)),
    blocks: [
      { kind: "p", text: t("planSystemsIntro", lang) },
      {
        kind: "cards",
        cards: plan.systems.map((sys) => ({
          title: sys.name,
          /* 不写"几个界面/几个弹层"这类统计 */
          lines: sys.screens.map((s) => {
            const where = s.kind === "overlay" ? `${t("planOverlay", lang)}${s.level ? `·${s.level}` : ""}` : t("planInterface", lang);
            const from = s.openedFrom.length ? `${t("planOpenedFrom", lang)}: ${s.openedFrom.join(" / ")}` : t("planNoOpener", lang);
            return `${s.name} — ${where} · ${from}`;
          }),
          /* 不再列"某控件 × 几个"这类统计；只留布局事实（几行几列、滑不滑） */
          bullets: sys.screens.flatMap((s) => s.layout.map((l) => `${s.name}｜${l.what}：${l.detail}`)).slice(0, 10),
        })),
      },
    ],
  };

  const screens: DocSection = {
    key: "screens",
    title: H("screens", t("planScreens", lang)),
    blocks: [
      { kind: "p", text: t("planScreensIntro", lang) },
      {
        kind: "cards",
        cards: plan.screens.map((s) => ({
          title: s.name,
          subtitle: `${s.kind === "overlay" ? `${t("planOverlay", lang)}${s.level ? ` · ${s.level}` : ""}` : t("planInterface", lang)}${
            s.openedFrom.length ? ` · ${t("planOpenedFrom", lang)}: ${s.openedFrom.join(" / ")}` : ""
          }`,
          lines: [
            /* 作者给这一屏写的说明（可能是设计意图，也可能是一句吐槽） */
            ...(s.text.length ? s.text.map((x) => `${t("docNote", lang)}: ${x}`) : []),
            /* 只写"这一屏上有哪些能操作的东西"，不写数量与尺寸 */
            ...s.controls
              .filter((c) => c.interactive.length > 0 || c.label)
              .map((c) => {
                const bits = [c.label ? `「${c.label}」` : c.kindName, c.interactive.length ? `（${c.interactive.join("、")}）` : ""].filter(Boolean);
                return `${t("planControls", lang)}｜${bits.join("")}`;
              }),
            ...s.layout.map((l) => `${t("planLayout", lang)}｜${l.what}：${l.detail}`),
            ...s.actions.map((a) => `${t("planActions", lang)}｜${a.what} → ${a.when} → ${a.then}（${a.transition ?? ""}）`),
          ],
        })),
      },
    ],
  };

  const flows: DocSection = {
    key: "flows",
    title: H("flows", t("planFlows", lang)),
    blocks: [
      { kind: "p", text: t("planFlowsIntro", lang) },
      {
        kind: "table",
        head: [t("planControls", lang), t("planWhenTap", lang), t("planActions", lang), t("docTransition", lang)],
        rows: plan.flows.map((f) => [f.what, f.when, f.then, f.transition ?? ""]),
      },
    ],
  };

  const parts: DocSection = {
    key: "parts",
    title: H("parts", t("docSectionParts", lang)),
    blocks: [
      { kind: "p", text: t("docPartsIntro", lang) },
      {
        kind: "cards",
        cards: (Object.keys(KIND_SPEC) as Kind[]).map((k) => {
          const spec = KIND_SPEC[k];
          const used = plan.screens.some((s) => s.controls.some((c) => c.kind === k));
          return {
            title: `${KIND_TEXT[lang][k]?.noun ?? k}  (${k})`,
            subtitle: used ? t("docInUse", lang) : "",
            lines: [
              `${t("docDefaultSize", lang)}: ${spec.w} × ${spec.h}`,
              `${t("docCategory", lang)}: ${CATEGORIES.find((c) => c.key === spec.category)?.label ?? spec.category}`,
              `${t("docVariant", lang)}: ${spec.hasVariant ? t("docYes", lang) : t("docNo", lang)}`,
              `${t("docRadiusDefault", lang)}: ${spec.radius}`,
              spec.hasLabel ? `${t("docText", lang)}: ${t("docYes", lang)}` : "",
              spec.hasIcon ? `${t("docIcon", lang)}: ${t("docYes", lang)}` : "",
              spec.hasTabs ? `${t("docTabs", lang)}: ${t("docYes", lang)}` : "",
              spec.hasValue ? `${t("propValue", lang)}: ${t("docYes", lang)}` : "",
              spec.hasChecked ? `${t("propChecked", lang)}: ${t("docYes", lang)}` : "",
              spec.hasScroll ? `${t("docScroll", lang)}: ${t("docYes", lang)}` : "",
              spec.hasPrizes ? `${t("prizes", lang)}: ${t("docYes", lang)}` : "",
              spec.hasRewards ? `${t("rewards", lang)}: ${t("docYes", lang)}` : "",
              k === "invGrid" ? `${t("docGrid", lang)}: ${t("docGridHint", lang)}` : "",
              spec.size2 ? `${t("docSize2", lang)}: ${spec.size2.min}–${spec.size2.max} (${t("docStep", lang)} ${spec.size2.step})` : "",
            ].filter(Boolean),
          };
        }),
      },
    ],
  };

  const all: Record<SkillSectionKey, DocSection> = { stats, features: overview, operations: ops, systems, screens, flows, parts };
  const sections = use.map((k) => all[k]);
  return { title, sections, markdown: renderMarkdown(title, undefined, sections) };
}

/** DOM 与 Markdown 共用同一批数据，各自渲染一遍 */
export function renderMarkdown(title: string, intro: string | undefined, sections: DocSection[]): string {
  const out: string[] = [`# ${title}`, ""];
  if (intro) out.push(intro, "");
  for (const s of sections) {
    out.push(`## ${s.title}`, "");
    for (const b of s.blocks) {
      if (b.kind === "p") out.push(b.text, "");
      if (b.kind === "outline") {
        /*
         * 编号保持层级：1 / 1.1 / 1.1.1
         *
         * `编号 名称：` 单独占一行，**下面每一条事实各占一行**。
         *
         * 不用「；」把几条事实挤成一行 —— 作者明确要求换行：
         * 挤在一起读起来是一大坨，而且看不出有几件事。
         * 也不用 `-` 列表符号（规范里禁止 Markdown 列表）。
         * 没有内容的项就只写「名称：」。
         */
        const numbers = outlineNumbers(b.nodes);
        b.nodes.forEach((n, ni) => {
          const number = numbers[ni];
          const indent = "\t".repeat(n.depth);
          /* 每条事实一行；顺手去掉行尾多余的句号/分号 */
          const facts = n.lines.map((l) => l.replace(/[。；]$/u, ""));
          /*
           * 最外层是**功能名**，不编号 —— 作者要的是 `仓库：`，不是 `1 仓库：`。
           * 编号从功能下面那一层才开始：`1.果实`、`1.1 出售`。
           */
          if (n.title) out.push(n.depth === 0 ? `${n.title}：` : `${indent}${number} **${n.title}**：`);
          else if (!facts.length) return;
          const factIndent = n.depth === 0 ? "\t" : `${indent}\t`;
          for (const f of facts) out.push(`${factIndent}${f}`);
        });
        out.push("");
      }
      if (b.kind === "facts") {
        for (const r of b.rows) out.push(`- **${r.label}**: ${r.value}`);
        out.push("");
      }
      if (b.kind === "cards") {
        for (const c of b.cards) {
          out.push(`### ${c.title}`, "");
          if (c.subtitle) out.push(`*${c.subtitle}*`, "");
          for (const l of c.lines) out.push(`- ${l}`);
          for (const b2 of c.bullets ?? []) out.push(`- ${b2}`);
          out.push("");
        }
      }
      if (b.kind === "table") {
        out.push(`| ${b.head.join(" | ")} |`, `| ${b.head.map(() => "---").join(" | ")} |`);
        for (const r of b.rows) out.push(`| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`);
        out.push("");
      }
    }
  }
  return out.join("\n");
}

export type { GamePlan };
