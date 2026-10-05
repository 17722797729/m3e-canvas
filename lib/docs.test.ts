import { describe, expect, it } from "vitest";
import { buildDocs, outlineNumbers, renderMarkdown } from "./docs";
import { buildGamePlan } from "./gameplan";
import { BUILTIN_SKILLS, SKILL_SECTIONS, readSkill } from "./skills";
import { KIND_SPEC, type Doc, type Item, type Kind, type PlacedItem } from "./tokens";

const part = (kind: Kind, extra: Partial<Item> = {}): PlacedItem =>
  ({ id: `i-${kind}`, kind, label: kind, icon: null, variant: "filled", x: 0, y: 0, ...extra }) as unknown as PlacedItem;

/** 一份小画布：主界面 → 点战斗按钮弹出"物品详情"弹层（里面有格子框与批量勾选） */
const doc = (): Doc =>
  ({
    title: "农场", brief: "", paletteKey: "purple", frame: "phone",
    frames: [
      { id: "f1", name: "主界面", x: 0, y: 0, w: 412, h: 892 },
      { id: "f2", name: "背包弹框", x: 500, y: 0, w: 412, h: 892, role: "overlay", level: "modal" },
      { id: "f3", name: "商店弹框", x: 1000, y: 0, w: 412, h: 892, role: "overlay", level: "modal" },
    ],
    groups: [
      {
        id: "g1", frameId: "f1", x: 0, y: 0, axis: "x",
        items: [
          part("bottomNav", {
            tabs: [{ icon: "inventory_2", label: "背包" }, { icon: "store", label: "商店" }, { icon: "group", label: "好友" }],
            actions: { "tab:0": { to: "f2", transition: "slideUp", dialog: true }, "tab:1": { to: "f3", transition: "fade", dialog: true } },
          } as Partial<Item>),
        ],
      },
      {
        id: "g2", frameId: "f2", x: 500, y: 0, axis: "x",
        items: [
          /* 标签行：让"标签页各占一层"这条路径也被测到 */
          part("tabs", {
            label: "标签页",
            tabs: [{ label: "全部" }, { label: "材料" }],
            children: [part("box", { children: [part("text", { label: "容量 0/210" })] }), part("box")],
          } as Partial<Item>),
          part("invGrid", { gridCols: 5, gridRows: 4, cell: 56, scroll: "y", cellNames: true, children: [part("box"), part("box")] }),
          part("checkbox", { label: "批量勾选", action: { to: "f2", transition: "slide", dialog: true } }),
          part("button", { label: "使用", action: { to: "back", transition: "none" } }),
        ],
      },
      { id: "g3", frameId: "f3", x: 1000, y: 0, axis: "x", items: [part("text"), part("button", { label: "购买", action: { to: "back", transition: "none" } })] },
    ],
  }) as unknown as Doc;

const texts = (d: ReturnType<typeof buildDocs>) =>
  d.sections
    .flatMap((s) =>
      s.blocks.flatMap((b) =>
        b.kind === "p"
          ? [b.text]
          : b.kind === "facts"
            ? b.rows.map((r) => `${r.label} ${r.value}`)
            : b.kind === "cards"
              ? b.cards.flatMap((c) => [c.title, ...c.lines])
              : b.kind === "outline"
                ? b.nodes.flatMap((n) => [n.title, ...n.lines])
                : b.rows.flat(),
      ),
    )
    .join(" | ");

describe("策划视角的说明", () => {
  it("从画布里认出功能系统：主界面 + 从它打开的层", () => {
    const plan = buildGamePlan(doc(), "zh");
    expect(plan.systems).toHaveLength(1);
    expect(plan.systems[0].name).toBe("主界面");
    expect(plan.systems[0].screens.map((s) => s.name).sort()).toEqual(["主界面", "商店弹框", "背包弹框"]);
    expect(plan.stats.screens).toBe(1);
    expect(plan.stats.overlays).toBe(2);
  });

  /* 用户点名要的：格子几行几列、往哪滑 */
  it("格子框写出几行几列、格子大小、格子数、滑动方向、是否显示物品名", () => {
    const plan = buildGamePlan(doc(), "zh");
    const layouts = plan.screens.find((s) => s.name === "背包弹框")!.layout.map((l) => `${l.what}: ${l.detail}`).join(" | ");
    expect(layouts).toContain("4 行 5 列");
    expect(layouts).toContain("56");
    expect(layouts).toContain("纵向");
    expect(layouts).toContain("显示物品名");
  });

  it("控件写出它能不能点、能不能滑、能不能勾", () => {
    const plan = buildGamePlan(doc(), "zh");
    const bag = plan.screens.find((s) => s.name === "背包弹框")!;
    const grid = bag.controls.find((c) => c.kind === "invGrid");
    expect(grid?.interactive).toContain("可滚动");
    const nav = plan.screens.find((s) => s.name === "主界面")!.controls.find((c) => c.kind === "bottomNav");
    expect(nav?.interactive.join()).toContain("可选");
  });

  it("交互写出「点了什么 → 发生什么 → 去哪」，含入场方式", () => {
    const plan = buildGamePlan(doc(), "zh");
    const flows = plan.flows.map((f) => `${f.what} ${f.when} ${f.then} ${f.transition}`).join(" | ");
    expect(flows).toContain("弹出弹框");
    expect(flows).toContain("从底部");
    expect(flows).toMatch(/主界面/);
    expect(plan.flows.some((f) => f.then.includes("上一屏"))).toBe(true);
  });

  it("没人指到的弹层不会被算进别的系统", () => {
    const plan = buildGamePlan(doc(), "zh");
    for (const sys of plan.systems) {
      for (const s of sys.screens) {
        if (s.kind === "overlay") expect(sys.screens.some((x) => x.id === s.id)).toBe(true);
      }
    }
  });
});

describe("文档：四种语言都出得来，Markdown 可下载", () => {
  it("每种语言都有标题、章节、可用的 Markdown", () => {
    for (const lang of ["ja", "en", "zh", "ko"] as const) {
      const d = buildDocs(doc(), lang);
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.sections.length).toBeGreaterThan(0);
      expect(d.markdown.startsWith("# ")).toBe(true);
      for (const s of d.sections) expect(s.title.length).toBeGreaterThan(0);
    }
  });

  it("没有文档时也不炸", () => {
    const d = buildDocs(null, "zh");
    expect(d.sections.length).toBeGreaterThan(0);
  });

  it("内容里带着画布的事实，不是模板套话", () => {
    const d = buildDocs(doc(), "zh");
    const all = texts(d);
    expect(all).toContain("背包弹框");
    /* 界面尺寸（412 × 892）与控件数量（× 192）都不再出现 */
    expect(all).not.toMatch(/\d+\s*×\s*\d+/);
    expect(all).not.toMatch(/×\s*\d+/);
  });
});

describe("skill 决定输出哪几节", () => {
  it("整份文档只有「按功能划分」这一节", () => {
    const keys = buildDocs(doc(), "zh", null).sections.map((s) => s.key);
    expect(keys).toEqual(["operations"]);
  });

  it("按 skill 的 sections 与顺序输出，标题也能改", () => {
    const skill = readSkill({ id: "x", name: "评审清单", headings: { operations: "待核对交互" } });
    expect(skill).toBeTruthy();
    const d = buildDocs(doc(), "zh", skill!);
    /* 只有一节，但标题与开场白仍由 skill 决定 */
    expect(d.sections).toHaveLength(1);
    /* 文档不再有开场白那一节 */
    expect(d.sections.map((x) => x.key)).toEqual(SKILL_SECTIONS);
  });

  it("自带的每条都读得动，而且都能出文档", () => {
    for (const s of BUILTIN_SKILLS) {
      const d = buildDocs(doc(), "zh", s);
      expect(d.sections.length).toBeGreaterThan(0);
      expect(d.markdown.length).toBeGreaterThan(50);
    }
  });

  it("读不动的 skill 返回 null；章节与开场白已经不再是 skill 的字段", () => {
    expect(readSkill(null)).toBeNull();
    expect(readSkill({ name: "" })).toBeNull();
    /* 老文件里的 sections / intro 读进来会被丢掉，不会带上 */
    const s = readSkill({ id: "a", name: "A", sections: ["flows"], intro: "开场白" })!;
    expect(s).not.toHaveProperty("sections");
    expect(s).not.toHaveProperty("intro");
  });
});

describe("功能一览与操作说明", () => {
  const plan = () => buildGamePlan(doc(), "zh");

  it("导航栏上的每一项都各占一条功能，没界面的留空", () => {
    const plan = buildGamePlan(doc(), "zh");
    const names = plan.features.map((f) => f.name);
    /* 底栏三格各占一条：背包、商店有界面，好友只有入口 */
    expect(names).toContain("背包");
    expect(names).toContain("商店");
    expect(names).toContain("好友");
    const friend = plan.features.find((f) => f.name === "好友")!;
    expect(friend.outline[0].lines).toHaveLength(0);
    const bag = plan.features.find((f) => f.name === "背包")!;
    expect(bag.outline[0].lines.length).toBeGreaterThan(0);
  });

  it("每个功能都有一份编号大纲，而且是玩家语言", () => {
    const d = buildDocs(doc(), "zh");
    const blocks = d.sections.find((s) => s.key === "operations")!.blocks.filter((b) => b.kind === "outline");
    expect(blocks.length).toBeGreaterThan(0);
    const all = blocks.flatMap((b) => (b.kind === "outline" ? b.nodes.flatMap((n) => [n.title, ...n.lines]) : [])).join(" | ");
    /* 用户点名要的那些：从哪打开、可滑动、批量勾选可以批量出售 */
    expect(all).toContain("点击");
    expect(all).toContain("打开");
    expect(all).toMatch(/上下滑动|滑动/);
    expect(all).toContain("批量");
  });

  /* 用户点名要去掉的两样东西 */
  it("不出现界面尺寸（412 × 892）与控件数量（容器框 × 192）", () => {
    const d = buildDocs(doc(), "zh");
    const all = texts(d);
    expect(all).not.toMatch(/\d+\s*×\s*\d+/);
    expect(all).not.toMatch(/×\s*\d+/);
    expect(d.markdown).not.toMatch(/\d+\s*×\s*\d+/);
  });

  it("不再输出组件设置那一节", () => {
    const keys = buildDocs(doc(), "zh").sections.map((s) => s.key);
    expect(keys).not.toContain("parts");
  });
});

describe("移除尺寸与数量统计", () => {
  it("画布事实里不再有界面尺寸", () => {
    const plan = buildGamePlan(doc(), "zh");
    const all = plan.screens.flatMap((s) => s.layout.map((l) => l.detail)).join(" | ");
    expect(all).not.toMatch(/\d+\s*×\s*\d+/);
  });

  it("Markdown 里也没有尺寸与「控件 × 数量」", () => {
    const md = buildDocs(doc(), "zh").markdown;
    expect(md).not.toMatch(/\d+\s*×\s*\d+/);
    expect(md).not.toMatch(/×\s*\d+/);
  });
});

describe("编号大纲", () => {
  it("功能 → 界面/标签页 → 操作，逐层编号", () => {
    const d = buildDocs(doc(), "zh");
    const b = d.sections.find((s) => s.key === "operations")!.blocks.find((x) => x.kind === "outline");
    expect(b).toBeTruthy();
    const nodes = (b as { nodes: { title: string; lines: string[]; depth: number }[] }).nodes;
    /* 第一层是功能名，下面至少有一层（界面/标签页） */
    expect(nodes[0].depth).toBe(0);
    expect(nodes[0].title).toBeTruthy();
    expect(nodes.some((n) => n.depth >= 1)).toBe(true);
    /* 这一条功能要有"点击…打开"这句 */
    const all = nodes.flatMap((n) => n.lines).join(" ");
    expect(all).toContain("点击");
  });

  it("Markdown 里带上编号", () => {
    const md = buildDocs(doc(), "zh").markdown;
    expect(md).toMatch(/\n\s*1 \*\*/);
  });
});

describe("一行一件事", () => {
  it("最外层功能名不编号，直接 `名称：`", () => {
    const md = buildDocs(doc(), "zh").markdown;
    /* 顶层是 `背包：` 这种，不带 `1 ` 前缀 */
    expect(md).toMatch(/^[^\d\t#\-\s].*：$/m);
    expect(md).not.toMatch(/^\d+ \*\*/m);
  });

  it("事实写在标题行下面，不与标题挤在同一行", () => {
    const md = buildDocs(doc(), "zh").markdown;
    const lines = md.split("\n");
    const at = lines.findIndex((l) => /^.+：$/.test(l));
    expect(at).toBeGreaterThan(-1);
    /* 标题行只到冒号为止 */
    expect(lines[at].endsWith("：")).toBe(true);
    /* 下一条事实是缩进过的 */
    expect(lines[at + 1].startsWith("\t")).toBe(true);
  });
});

describe("编号规则只有一份（页面与导出共用）", () => {
  /* 之前页面和 Markdown 各写一遍编号，结果页面改了导出没改，页面上一直是「1 仓库」 */
  it("最外层不编号，功能下面那一层才从 1 开始，各分支独立计数", () => {
    const nums = outlineNumbers([
      { depth: 0 }, // 仓库
      { depth: 1 }, // 果实
      { depth: 2 }, // 出售
      { depth: 3 }, // 气泡浮层
      { depth: 2 }, // 批量出售
      { depth: 1 }, // 超变果实
      { depth: 0 }, // 商店
      { depth: 1 }, // 种子
    ]);
    expect(nums).toEqual(["", "1", "1.1", "1.1.1", "1.2", "2", "", "1"]);
  });

  it("同样的输入，Markdown 里的编号与页面一致", () => {
    const nodes = [
      { depth: 0, title: "仓库", lines: [] },
      { depth: 1, title: "果实", lines: ["打开默认「果实」标签页"] },
    ];
    const md = renderMarkdown("T", undefined, [{ key: "operations", title: "S", blocks: [{ kind: "outline", nodes }] }]);
    for (const num of outlineNumbers(nodes)) {
      if (!num) continue;
      expect(md).toContain(`${num} **`);
    }
    /* 顶层只有 `仓库：`，不带编号 */
    expect(md).toContain("\n仓库：\n");
  });
});
