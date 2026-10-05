import { describe, expect, it } from "vitest";
import { BUILTIN_SKILLS, SKILL_SECTIONS, isBuiltinSkill, isEdited, loadSkills, readSkill, resetSkill, saveSkill, summaryPrompt } from "./skills";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) } as unknown as Storage;
};

describe("只剩一条 skill：策划案模板", () => {
  it("自带的只有一条，而且默认就是它", () => {
    expect(BUILTIN_SKILLS).toHaveLength(1);
    const only = BUILTIN_SKILLS[0];
    expect(only.builtin).toBe(true);
    expect(only.name).toBe("策划案模板");
    /* 文档只有"功能与操作"这一节 */
    expect(SKILL_SECTIONS).toEqual(["operations"]);
    /* 它要求模型按模板重写 */
    expect(only.rewrite).toBe(true);
  });

  it("写作规范：形态与编号 + 内容只来自材料", () => {
    const text = BUILTIN_SKILLS[0].instructions ?? "";
    /* 形态：编号与缩进 */
    expect(text).toContain("1.1.1");
    expect(text).toContain("Tab 缩进");
    /* 作者给的规范骨架 */
    expect(text).toContain("角色定位");
    expect(text).toContain("句式（按信息类型选用）");
    expect(text).toContain("术语表");
    expect(text).toContain("自检");
    /* 内容纪律 —— 这几条是上一版漏掉"分享/角色信息"、凭空多出"菜篮"的对策 */
    expect(text).toContain("内容只来自材料");
    expect(text).toContain("一条不少、不合并不改名");
    expect(text).toContain("一个字都不要新增");
    expect(text).toContain("不要编造数值");
    /* 明令不许写尺寸与数量统计 */
    expect(text).toContain("不写界面尺寸");
    expect(text).toContain("不写控件数量统计");
    /* 空功能也要列出来 */
    expect(text).toContain("只有名字、没有内容");
    /* 标签页专属控件要写在那一页下面 —— 这是用户点名的那条 */
    expect(text).toContain("必须写在那一页的编号下");
    /* 要按组件拆解推理功能用途 —— 也是用户点名的那条 */
    expect(text).toContain("推理每个功能的真实用途");
    expect(text).toContain("拆到底");
    /* 不要待确认清单：只允许出现"不要列待确认清单"这条禁令 */
    expect(text).toContain("也不要文末列待确认清单");
  });

  it("装了别的也只多出那一条，自带的不会被覆盖", () => {
    const store = memory();
    const extra = readSkill({ id: "x", name: "别人的规范", sections: ["flows"] })!;
    store.setItem("m3e:skills", JSON.stringify([extra]));
    const all = loadSkills(store);
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(BUILTIN_SKILLS[0].id);
  });
});

describe("AI 总结的提示词", () => {
  const skill = BUILTIN_SKILLS[0];

  it("system 是写作规范，user 是机器读出来的素材", () => {
    const { system, user } = summaryPrompt(skill, "1 仓库\n  点击「仓库」打开。", "zh", "QQ农场");
    expect(system).toContain("内容只来自材料");
    expect(system).toContain("简体中文");
    expect(user).toContain("QQ农场");
    expect(user).toContain("点击「仓库」打开。");
  });

  it("没有 skill 时也给出可用的 system（不会发空指令）", () => {
    const { system, user } = summaryPrompt(null, "素材", "zh", "游戏");
    expect(system.length).toBeGreaterThan(10);
    expect(user).toContain("素材");
  });

  it("四种语言都能生成", () => {
    for (const lang of ["ja", "en", "zh", "ko"] as const) {
      const { system } = summaryPrompt(skill, "s", lang, "G");
      expect(system.length).toBeGreaterThan(20);
    }
  });
});

describe("编辑与保存", () => {
  it("改内置那条：存下来的是一份覆盖，原件还在，可以恢复默认", () => {
    const store = memory();
    const builtin = BUILTIN_SKILLS[0];
    const edited = { ...builtin, name: "我的策划案规范", instructions: "只写功能。" };
    const after = saveSkill(store, edited);
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe("我的策划案规范");
    /* 读回来还是改过的那份 */
    const back = loadSkills(store);
    expect(back[0].name).toBe("我的策划案规范");
    expect(back[0].instructions).toBe("只写功能。");
    /* 恢复默认 → 回到代码里的原件 */
    const reset = resetSkill(store, builtin.id);
    expect(reset[0].name).toBe(builtin.name);
    expect(reset[0].instructions).toBe(builtin.instructions);
  });

  it("自己建的那条：直接替换，不需要覆盖机制", () => {
    const store = memory();
    const mine = readSkill({ id: "mine", name: "甲", sections: ["operations"] })!;
    saveSkill(store, mine);
    saveSkill(store, { ...mine, name: "乙" });
    const all = loadSkills(store);
    expect(all.filter((s) => s.id === "mine")).toHaveLength(1);
    expect(all.find((s) => s.id === "mine")!.name).toBe("乙");
    expect(all).toHaveLength(BUILTIN_SKILLS.length + 1);
  });

  it("改过的内置那条会被认出来（可以提示「恢复默认」）", () => {
    const store = memory();
    const builtin = BUILTIN_SKILLS[0];
    expect(isEdited(loadSkills(store)[0])).toBe(false);
    saveSkill(store, { ...builtin, name: "改过的" });
    const back = loadSkills(store)[0];
    expect(isEdited(back)).toBe(true);
    expect(isBuiltinSkill(back)).toBe(true);   /* 仍然是内置那条，删不掉 */
  });

  it("内置的只修改不新增：列表长度不变", () => {
    const store = memory();
    saveSkill(store, { ...BUILTIN_SKILLS[0], description: "改一下说明" });
    expect(loadSkills(store)).toHaveLength(BUILTIN_SKILLS.length);
  });
});
