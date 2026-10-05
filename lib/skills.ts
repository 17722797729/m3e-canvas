import type { Lang } from "./i18n";

/**
 * Skill（技能包）
 * ---------------------------------------------------------------------------
 * 一个 skill 就是一份**说明书的写作规范**：它决定这份文档按什么顺序、以什么口吻、
 * 分哪几节写出来。文件本身是一个小的 JSON（或 Markdown），可以从网址安装。
 *
 * 为什么不把 skill 做成"能跑任意代码的插件"：那样一来装一个陌生网站的 skill 就等于
 * 把本机交出去。这里的能力面刻意只有三件事 —— 选节、改写指令、附加开场白 ——
 * 全部是**声明式**的，最坏情况也只是文档写得难看。
 */

export type SkillSectionKey = "systems" | "screens" | "flows" | "parts" | "stats" | "features" | "operations";

/**
 * 文档只有这一节
 *
 * skill 不再挑章节：整份文档就是“按功能/系统划分”这一棵树，作者明确说过其它信息不要。
 * skill 只决定**怎么写**（instructions）与章节叫什么。
 */
export const SKILL_SECTIONS: SkillSectionKey[] = ["operations"];

/** 章节键的合法取值（其余几个留给以后，用来校验外部 skill 文件里的 headings） */
export const SKILL_SECTION_KEYS: SkillSectionKey[] = ["stats", "features", "operations", "systems", "screens", "flows"];

export type Skill = {
  id: string;
  name: string;
  version?: string;
  /** 来源网址，留下以便显示与更新 */
  url?: string;
  /** 作者 */
  author?: string;
  /** 一句话说明它是给谁用的 */
  description?: string;
  /** 每一节想叫什么；不给就用默认名 */
  headings?: Partial<Record<SkillSectionKey, string>>;
  /** 写作指令：勾了"用模型重写"时发给模型 */
  instructions?: string;
  /** 这一条 skill 是否要求用模型把文档重写成叙述式的 */
  rewrite?: boolean;
  /** 内置的不能删 */
  builtin?: boolean;
  /** 内置的那条被本机改过（有一份同 id 的覆盖） */
  edited?: boolean;
  /**
   * 这份覆盖是照着内置的哪一版改的
   *
   * 内置升版后旧覆盖就作废 —— 否则产品把规范改好了，
   * 界面上却还在拿几个月前存下来的那份跑（"怎么还有待确认清单"就是这么来的）。
   */
  editedFrom?: string;
  installedAt?: number;
};

export const SKILLS_KEY = "m3e:skills";
export const ACTIVE_SKILL_KEY = "m3e:skill:active";

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/**
 * 安装自带的几条
 *
 * 它们不依赖网络，装完就能用；也是"skill 长什么样"的现成例子，
 * 想写自己的照着改就行。
 */
/**
 * 唯一的一条 skill：**策划案模板**
 *
 * 它就是把作者给的模板固化成写作规范：整份文档只按"游戏 → 功能 → 子项"编号展开，
 * 不要尺寸、不要控件数量、不要逐屏明细。默认启用，AI 总结也默认按它来写。
 *
 * `instructions` 是写给模型的：AI 总结时把已经生成好的大纲交给模型，
 * 让模型只做"把已有事实写成人话、缺的留空"，不许编。
 */
const PLAN_SKILL: Skill = {
  id: "builtin:plan-template",
  name: "策划案模板",
  version: "2.0.0",
  builtin: true,
  description: "按「游戏 → 功能 → 子项」编号展开，只写功能与操作，不写尺寸与数量。",
  headings: { operations: "功能与操作" },
  rewrite: true,
  instructions: [
    "# Skill：游戏原型交互文档生成器",
    "",
    "## 角色定位",
    "你是游戏交互策划。机器已经把原型解析成一份**事实清单**交给你，",
    "你的任务是把这些事实整理成标准《游戏功能交互文档》。",
    "读者：程序、UI、QA。**文档必须让读者不看原型也能还原全部交互。**",
    "",
    "## 第一条：内容只来自材料",
    "- 材料里的**每一条功能都要保留**：一条不少、不合并不改名、不调换顺序。",
    "- 材料里**只有名字、没有内容**的功能，也要原样列出，冒号后留空，如 `2.超变果实：`。",
    "- **材料里没有的，一个字都不要新增。** 结构图里的名字只是形态示例，不是内容来源。",
    "- 材料里没写的行为，**留空不写**；不要编造数值、不要臆测流程。",
    "- 不写界面尺寸、不写控件数量统计 —— 只写功能与交互。",
    "",
    "## 第二条：推理每个功能的真实用途（重点）",
    "材料会给出一条功能**由哪些组件、以及组件下的子组件**拼成。你要据此**还原这个功能是干什么的**，",
    "把它写出来，而不是留着空标题。",
    "",
    "做法：",
    "1. **拆到底**：功能 → 组件 → 子组件逐层看。子组件的类型说明了它在界面上是什么",
    "   （`图标按钮` 是图片/头像位，`文本` 是文案，`进度条` 是经验/血量/进度，`徽标` 是角标，",
    "   `勾选框` 是开关，`滑块` 是数值调节，`格子框` 是背包/列表）。",
    "2. **按上下文给部件起名字**：不要照抄类型名。同一个 `图标按钮`，",
    "   在「角色信息」里是**头像**，在「任务」里是任务图标，在底部栏里是导航项。",
    "   判据是**它周围有什么**：旁边写着「角色名XXXX」、下面跟着一条「6万/12 万」的进度条，",
    "   那么这个没写说明的图标按钮**就是头像**，那条进度条**就是经验**。",
    "   例：`图标按钮` + `文本：角色名XXXX` + `进度条：6万/12 万`",
    "   → 写「显示角色头像、角色名（角色名XXXX）与经验进度（6万/12 万）」，",
    "   **不要**写成「图标按钮可点击；角色名：角色名XXXX；进度条：6万/12 万」这种照抄。",
    "3. **有把握才推定**：区域名或兄弟组件的文字已经点明了用途时才推定；",
    "   拿不准就照实写类型名，别硬安一个说法。",
    "4. **有数据的写数据**：文本里的数值、进度条的比值、格子的行列数与上限、秒数，都要抄进描述里。",
    "5. **别用「待确认」凑数**：不要写「原型未读到，待确认」这类话，也不要文末列待确认清单。",
    "   推得出来的就说出来；推不出来的**留空**，不要写一句空话占位。",
    "",
    "## 输出格式（硬性要求）",
    "",
    "### 1. 结构",
    "```",
    "游戏名:",
    "\t功能入口名：这个功能是什么、怎么进入",
    "\t\t1.子模块/页签：",
    "\t\t\t这一页里的第一件事",
    "\t\t\t这一页里的第二件事",
    "\t\t\t1.1 控件名：",
    "\t\t\t\t这条控件的第一件事",
    "\t\t\t\t1.1.1 弹框名：",
    "\t\t\t\t\t弹框里的第一件事",
    "```",
    "",
    "**一行只说一件事。** 不要把几件事用「；」挤在同一行 ——",
    "那样读起来是一大坨，也看不出到底有几件事。编号标题行后面用冒号结尾，",
    "它下面每一条事实**各占一行**，各自缩进一级。",
    "- 用 Tab 缩进表达层级，**禁止用 Markdown 列表符号（-、*、1)）**",
    "- 入口下第一层用 `1.` `2.`；每往下一层加一位（`1.1`、`1.1.1`）",
    "- 编号跟随父级，**各分支独立计数**（1.3 的子项是 1.3.1，不是 2.1）",
    "- 编号标题行写成 `编号 名称：`，**冒号结尾后换行**，下面逐条列事实；不要出现「待确认」字样",
    "- **禁止用「；」把多条事实连成一行**；一条事实一行",
    "",
    "### 2. 句式（按信息类型选用）",
    "| 信息类型 | 句式 |",
    "|---|---|",
    "| 进入功能 | 点击“X”，弹出/打开 + 结果 |",
    "| 页签切换 | 点击“X”，切换到“X”标签页 |",
    "| 默认态 | 打开默认“X”标签页 / 按钮文本默认“X” |",
    "| 状态流转 | 触发条件 + 状态变为“X” + 后续动作 |",
    "| 二级弹框 | 以弹框名为子节点，写它内部的操作 |",
    "| 数值/容量 | 写清数值、上限与可见的规则 |",
    "| 勾选/批量 | 勾选框出现条件 + 勾选后能做什么 |",
    "| 浮层/轻提示 | 弹出“X气泡浮层”显示 + 内容 |",
    "| 刷新 | 显示剩余刷新时间与周期 |",
    "| 关闭 | 点击空白处/关闭按钮关闭此弹框 |",
    "",
    "### 3. 归属：控件写在哪一层，取决于它长在哪一页",
    "只属于某个标签页的按钮/格子框，**必须写在那一页的编号下**，不能提到弹框那一层。",
    "例：“出售”“批量出售”“批量锁定”只在“果实”页有，就写在 `1.果实` 下面 ——",
    "否则读者会以为四个标签页都有这些按钮。材料里已经把控件挂在页签下面了，**照它的层级写**。",
    "",
    "### 4. 交互链路完整性",
    "- 每个状态流转写到终点，不留断头：按钮“前往”→“领取”→点击领取→弹出奖励弹框→“已领取”",
    "- 一个弹框内部若有可操作控件，**必须为它建子节点**（如 1.3.1）",
    "- 操作的反馈（弹框/浮层/状态变化）必须写明，禁止只写动作不写结果",
    "",
    "### 5. 术语表（统一用词）",
    "| 术语 | 场景 |",
    "|---|---|",
    "| 弹框 | 模态弹窗，遮挡底层 |",
    "| 气泡浮层 | 轻提示，自动消失或弱遮挡 |",
    "| 标签页 | Tab 切换 |",
    "| 勾选框 | Checkbox 多选 |",
    "| 下拉框 | Select 选择 |",
    "",
    "### 6. 排序",
    "- 条目按原型界面从左到右、从上到下",
    "- 同一控件的子节点按操作流程：先默认态，再交互，再结果。",
    "  材料的行序已经按界面位置排好了，**照抄它的顺序**，不要自己重排。",
    "",
    "## 工作流程",
    "1. **解析材料**：识别 游戏名 → 功能 → 页签/子模块 → 控件 → 弹框 的层级。",
    "2. **补用途**：对每个功能，按「第二条」拆组件、还原它的真实用途，写成一句话。",
    "3. **补链路**：每个控件补齐「触发 → 过程 → 反馈」。",
    "4. **套格式**：输出纯文本层级文档。",
    "5. **自检**：",
    "   □ 每个功能是否都写出了它**是什么**，而不是只有一个空标题？",
    "   □ 标签页专属的控件，是否写在了那一页下面？",
    "   □ 每个弹框都写明了打开方式与关闭方式？",
    "   □ 每个状态流转都写到终点（无断头链）？",
    "   □ 默认态（默认标签页/默认按钮文本）标明了？",
    "   □ 材料里的功能一条不少？没有多出材料里没有的？",
    "   □ 层级编号是否连续且跟随父级？",
  ].join("\n"),
};

export const BUILTIN_SKILLS: Skill[] = [PLAN_SKILL];

/** 把任意来源的对象读成一条 skill；读不动就返回 null */
export function readSkill(value: unknown): Skill | null {
  if (!isRecord(value)) return null;
  const id = str(value.id) ?? str(value.name);
  const name = str(value.name);
  if (!id || !name) return null;
  const headings = isRecord(value.headings)
    ? (Object.fromEntries(
        Object.entries(value.headings)
          .filter(([k, v]) => typeof v === "string" && v.trim() && SKILL_SECTION_KEYS.includes(k as SkillSectionKey))
          .map(([k, v]) => [k, (v as string).trim()]),
      ) as Skill["headings"])
    : undefined;
  return {
    id,
    name,
    version: str(value.version),
    url: str(value.url),
    author: str(value.author),
    description: str(value.description),
    ...(headings && Object.keys(headings).length ? { headings } : {}),
    ...(str(value.editedFrom) ? { editedFrom: str(value.editedFrom) } : {}),
    instructions: str(value.instructions),
    rewrite: value.rewrite === true,
    builtin: value.builtin === true,
  };
}

/** 网址上的 skill：JSON 直接读，其它当作一段说明（只有 instructions 与名字） */
export function parseSkillSource(text: string, from: string): Skill | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = readSkill(JSON.parse(trimmed));
      return parsed ? { ...parsed, url: parsed.url ?? from } : null;
    } catch {
      return null;
    }
  }
  /* 不是 JSON：把整篇当作写作规范，标题取网址最后一段 */
  if (!trimmed) return null;
  const guess = from.split("/").filter(Boolean).pop()?.replace(/\.(md|txt)$/i, "") ?? "skill";
  return { id: `url:${from}`, name: guess, url: from, instructions: trimmed };
}

export async function fetchSkill(url: string): Promise<Skill | { error: string }> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json, text/plain, */*" } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const skill = await parseSkillSource(await res.text(), url);
    return skill ?? { error: "content" };
  } catch (err) {
    /* 绝大多数是对方没开 CORS：说清楚，并给出"直接粘贴"这条退路 */
    return { error: err instanceof Error ? err.message : "network" };
  }
}

/**
 * 读回 skill 列表
 *
 * 三层叠起来，同 id 时后一层盖前一层：
 *  1. 内置的那条（随代码走，作者更新规范大家都拿到新的）；
 *  2. 本机存下的**覆盖**（把内置的改过之后存的那份，`edited: true`）；
 *  3. 自己装/建的。
 *
 * 于是"内置的不能删、但可以改"这件事成立：改的是覆盖，`恢复默认`就是删掉覆盖。
 */
export function loadSkills(storage: Storage | undefined): Skill[] {
  try {
    const raw = storage?.getItem(SKILLS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const mine = Array.isArray(parsed) ? parsed.map(readSkill).filter((s): s is Skill => !!s) : [];
    const byId = new Map<string, Skill>();
    for (const b of BUILTIN_SKILLS) byId.set(b.id, b);
    for (const m of mine) {
      const base = BUILTIN_SKILLS.find((b) => b.id === m.id);
      if (!base) {
        byId.set(m.id, m);
        continue;
      }
      /* 照着**当前这一版**改的才认；旧版存下来的覆盖丢掉，用回内置 */
      if (m.editedFrom !== base.version) continue;
      byId.set(m.id, { ...m, builtin: true, edited: true });
    }
    return [...byId.values()];
  } catch {
    return BUILTIN_SKILLS;
  }
}

export function saveSkills(storage: Storage | undefined, skills: Skill[]) {
  try {
    storage?.setItem(SKILLS_KEY, JSON.stringify(skills.filter((s) => !s.builtin)));
  } catch {}
}

/**
 * 改动之后写回一条
 *
 * 内置的那条**不写进它自己**，而是写一份同 id 的覆盖 —— 原件仍在代码里，
 * 所以随时能"恢复默认"。自己建的直接替换。
 */
export function saveSkill(storage: Storage | undefined, skill: Skill): Skill[] {
  /* 内置的写成"一份覆盖"：落盘时不带 builtin 标记（读回来会按 id 重新认成内置那条），
     这样就既能改、又能恢复默认。 */
  const base = BUILTIN_SKILLS.find((b) => b.id === skill.id);
  const stored: Skill = base
    ? { ...skill, builtin: false, edited: true, editedFrom: base.version }
    : { ...skill, builtin: false };
  const all = loadSkills(storage);
  const has = all.some((s) => s.id === skill.id);
  const next = has ? all.map((s) => (s.id === skill.id ? stored : s)) : [...all, stored];
  try {
    storage?.setItem(SKILLS_KEY, JSON.stringify(next.filter((s) => !BUILTIN_SKILLS.some((b) => b.id === s.id) || s.edited).map((s) => ({ ...s, builtin: false }))));
  } catch {}
  return loadSkills(storage);
}

/** 恢复默认：删掉内置那条的本机覆盖 */
export function resetSkill(storage: Storage | undefined, id: string): Skill[] {
  /* 恢复默认 = 把同 id 的那份覆盖删掉，代码里的原件自然露出来 */
  try {
    const raw = storage?.getItem(SKILLS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const kept = (Array.isArray(parsed) ? parsed : []).filter((v) => {
      const s = readSkill(v);
      return !!s && s.id !== id;
    });
    storage?.setItem(SKILLS_KEY, JSON.stringify(kept));
  } catch {}
  return loadSkills(storage);
}

/** 这一条是不是被改过（本机有覆盖） */
export const isEdited = (s: Skill): boolean =>
  s.edited === true || (!s.builtin && BUILTIN_SKILLS.some((b) => b.id === s.id));

/** 这一条是不是内置的（内置的删不掉，只能恢复默认） */
export const isBuiltinSkill = (s: Skill): boolean => s.builtin === true || BUILTIN_SKILLS.some((b) => b.id === s.id);

export const loadActiveSkillId = (storage: Storage | undefined): string | null => {
  try {
    return storage?.getItem(ACTIVE_SKILL_KEY) ?? null;
  } catch {
    return null;
  }
};

export const saveActiveSkillId = (storage: Storage | undefined, id: string | null) => {
  try {
    if (id) storage?.setItem(ACTIVE_SKILL_KEY, id);
    else storage?.removeItem(ACTIVE_SKILL_KEY);
  } catch {}
};

export const skillHeading = (skill: Skill | null, key: SkillSectionKey, lang: Lang, fallback: string) =>
  skill?.headings?.[key] ?? fallback;

/**
 * "AI 总结"要发给模型的两段话
 *
 * `system` 是 skill 的写作规范（模板形态、编号、禁令）；`user` 是机器已经从那份
 * 原型里读出来的事实（见 `lib/gameplan.ts`）。分开是为了让模型分清
 * "规矩"与"素材"——素材里没有的，它就该留空。
 */
export function summaryPrompt(skill: Skill | null, source: string, lang: Lang, projectName: string): { system: string; user: string } {
  const langName = lang === "zh" ? "简体中文" : lang === "ja" ? "日本語" : lang === "ko" ? "한국어" : "English";
  const system = [
    skill?.instructions?.trim() || "You write a game UI prototype design document.",
    "",
    `写作语言：${langName}。`,
    "只输出文档正文（Markdown），不要寒暄、不要解释你做了什么、不要在开头重复我的指令。",
    "原型里没有的事实一律留空，绝不编造。",
  ].join("\n");
  const user = [
    `游戏/项目名：${projectName}`,
    "",
    "下面是机器从这份 UI 原型里读出来的事实（功能清单、每屏的控件与操作、以及已读到的数值）。",
    "请按写作规范，把它们整理成文档：",
    "",
    source,
  ].join("\n");
  return { system, user };
}

/**
 * 让模型按 skill 把文档重写成叙述式
 *
 * 只有 skill 自己声明 `rewrite: true` 时才会走到这里 —— 那时它的 `instructions`
 * 就是写给模型的规范，原文（我们已经生成好的 Markdown）原样带上，不额外加工。
 */
export function skillPrompt(skill: Skill, source: string, lang: Lang): string {
  const langName = lang === "zh" ? "中文" : lang === "ja" ? "日本語" : lang === "ko" ? "한국어" : "English";
  return [
    skill.instructions?.trim() || skill.description?.trim() || "Rewrite the document so it reads as a design document.",
    "",
    `写作用语：${langName}。只输出改写后的 Markdown 正文，不要寒暄、不要解释你做了什么。`,
    "不要编造原文里没有的界面、控件或数值；原文没有的就说没有。",
    "",
    "—— 原文（Markdown）——",
    source,
  ].join("\n");
}
