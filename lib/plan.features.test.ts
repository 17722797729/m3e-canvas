import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDocs } from "./docs";
import { buildGamePlan } from "./gameplan";
import type { Doc } from "./tokens";

/** 真实原型：11 屏、24 组、12 个自定义组件 */
const real = (): Doc => JSON.parse(readFileSync("/Users/yin/Downloads/m3e-canvas.json", "utf8")) as Doc;

describe("功能清单要覆盖原型上真实的入口", () => {
  const plan = buildGamePlan(real(), "zh");
  const names = plan.features.map((f) => f.name);

  it("导航栏上的每一项都在", () => {
    for (const n of ["仓库", "商店", "宠物", "图鉴", "装扮", "好友", "商城", "萌宠日记"]) {
      expect(names, `少了 ${n}`).toContain(n);
    }
  });

  /* 上一版就漏了这几个：它们不在导航栏上，而是主界面上作者命名过的部件 / 自建组件 */
  it("主界面上作者命名过的入口也在（分享、音乐）", () => {
    expect(names).toContain("分享");
    expect(names).toContain("音乐");
  });

  it("作者自建组件里像界面的那几个也在（角色信息）", () => {
    expect(names).toContain("角色信息");
  });

  it("有界面的功能带着内容，没界面的留空而不是消失", () => {
    const bag = plan.features.find((f) => f.name === "仓库")!;
    expect(bag.outline[0].lines.length).toBeGreaterThan(0);
    expect(bag.outline[0].children.length).toBeGreaterThan(2);
    const pet = plan.features.find((f) => f.name === "宠物")!;
    expect(pet.outline[0].lines).toHaveLength(0);
    expect(pet.outline[0].children).toHaveLength(0);
  });

  /**
   * 用户点名的那条：只在"果实"页才有的按钮，必须写在那一页下面，
   * 不能提到弹框那一层 —— 否则读者会以为四个标签页都有这些按钮。
   */
  it("标签页专属的控件写在那一页下面，不在弹框那一层", () => {
    const bag = plan.features.find((f) => f.name === "仓库")!;
    const root = bag.outline[0];
    const rootText = root.lines.join(" ");
    expect(rootText).not.toContain("出售");
    expect(rootText).not.toContain("批量锁定");
    /* 至少有一页带着这些按钮（原型里"出售"确实只在某些页上） */
    const pages = root.children.map((c) => c.lines.join(" "));
    expect(pages.some((t) => t.includes("出售")), "没有任何一页带上出售").toBe(true);
    /* 各页内容并不相同 —— 说明归属是按页算的，不是把整屏复制四遍 */
    expect(new Set(pages).size).toBeGreaterThan(1);
  });

  /* 显示件不该被当入口 */
  it("数值/零件名不会被误当成功能", () => {
    for (const bad of ["6万/12 万", "徽标", "图标按钮", "格子框", "血条", "资产框", "导航栏·底部", "侧边导航栏·左"]) {
      expect(names, `误入了 ${bad}`).not.toContain(bad);
    }
  });
});

describe("本地文档的形态（对着真实原型）", () => {
  const md = () => buildDocs(real(), "zh").markdown;

  it("最外层功能名不编号：`仓库：` 而不是 `1 仓库：`", () => {
    expect(md()).toMatch(/^仓库：$/m);
    expect(md()).not.toMatch(/^\d+\s*\*\*仓库\*\*/m);
  });

  /* 出售弹框、出售气泡浮层、批量出售弹框曾经跟标签页平级排在后面，像是第四、五、六个标签页 */
  it("从某一项打开的层，缩在打开它的那一项里面", () => {
    const lines = md().split("\n");
    const sell = lines.findIndex((l) => l.includes("出售弹框"));
    const bubble = lines.findIndex((l) => l.includes("出售气泡浮层"));
    expect(sell).toBeGreaterThan(-1);
    expect(bubble).toBeGreaterThan(-1);
    /* 弹框比"果实"页更深 */
    const page = lines.findIndex((l) => l.includes("仓库·弹框·果实"));
    const indent = (i: number) => (lines[i].match(/^\t*/) ?? [""])[0].length;
    expect(indent(sell)).toBeGreaterThan(indent(page));
    /* 气泡浮层由弹框里的按钮弹出，所以更深一层 */
    expect(indent(bubble)).toBeGreaterThan(indent(sell));
    /* 层不再与标签页平级 */
    expect(indent(sell)).not.toBe(indent(page));
  });

  it("编号从功能下面那一层开始，各分支独立计数", () => {
    const lines = md().split("\n");
    /* 第一层是 `1 ...`、`2 ...`，第二层 `1.1` */
    expect(lines.some((l) => /^\t1 \*\*/.test(l))).toBe(true);
    expect(lines.some((l) => /^\t2 \*\*/.test(l))).toBe(true);
    expect(lines.some((l) => /^\t\t1\.1 \*\*/.test(l))).toBe(true);
  });
});
