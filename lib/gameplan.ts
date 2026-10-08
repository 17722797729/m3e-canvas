import { KIND_TEXT, overlayLevelText, t, type Lang } from "./i18n";
import {
  KIND_SPEC,
  frameOfGroup,
  overlayLevelOfFrame,
  sizeOf,
  slotGrid,
  cellOf,
  type Doc,
  type Frame,
  type Group,
  type Item,
  type Kind,
  type PlacedItem,
} from "./tokens";

/**
 * 从画布推出一份"游戏系统策划"视角的说明
 * ---------------------------------------------------------------------------
 * 说明不是手写的，而是**从画布里读出来的**：这一屏属于哪个系统、上面有什么控件、
 * 点了会发生什么、格子框几行几列、往哪个方向滑……这些在文档里都有，只是原来没有
 * 按策划的读法整理出来。
 *
 * 分成三块：
 *   · `systems`  功能系统：一个系统 = 一屏主界面 + 它弹出来的那些层
 *   · `screens`  逐屏明细：控件清单、交互与去向、布局与滚动
 *   · `flows`    交互总表：从哪儿点、点了干什么、去了哪儿
 */

/** 格子里一个格位的信息（数量、徽标…）—— 从原型里读出来 */
export type SlotFact = { name: string; label?: string; badges: string[]; count?: string };

export type UiControl = {
  /** 控件在屏幕上的名字（作者起的，没起就用类型名） */
  name: string;
  kind: Kind;
  kindName: string;
  /** 界面上写着什么 */
  label?: string;
  /** 这一屏上摆了几个 */
  count: number;
  /** 它的交互：可点/可调/可勾 */
  interactive: string[];
  /** 尺寸 */
  size: { w: number; h: number };
  /** 它里面的控件（标签行的每一页、格子框里的格位…） */
  children: UiControl[];
  /** 这一项自己的细节：几行几列、滑动方向、定时关闭… */
  facts: string[];
  /**
   * **这一项自己的**交互（不含子项的）
   *
   * 有了它，"出售""批量出售"这些才知道自己长在哪一页标签上 ——
   * 之前把整屏的交互都算在屏上，于是只在"果实"页才有的按钮
   * 被写到了弹框那一层，看起来像是四个标签页都共用。
   */
  actions: UiAction[];
};

export type UiAction = {
  what: string;
  /** 触发的条件 */
  when: string;
  /** 之后发生什么 */
  then: string;
  /** 走到哪一屏 */
  to?: string;
  /** 怎么进去的（过渡） */
  transition?: string;
};

export type LayoutFact = {
  what: string;
  /** 几行几列这种可量化的描述 */
  detail: string;
  /** 这一项是个多项列表时（标签行、底栏…），逐项的名字 */
  items?: string[];
};

export type ScreenPlan = {
  frame: Frame;
  id: string;
  name: string;
  /** 页面还是弹层，弹层的话是哪一级 */
  kind: "screen" | "overlay";
  level?: string;
  /** 从哪一屏能到它 */
  openedFrom: string[];
  text: string[];
  controls: UiControl[];
  actions: UiAction[];
  layout: LayoutFact[];
};

export type SystemPlan = {
  name: string;
  /** 属于这个系统的屏 */
  screens: ScreenPlan[];
  /** 一句话：它给玩家干什么 */
  summary: string;
  /** 这个系统里有哪些控件类型 */
  controls: { kindName: string; count: number }[];
  /** 系统内的交互条数 */
  interactions: number;
};

/**
 * 一条功能（玩法系统）的操作说明
 *
 * 这是策划案里最常用的那一段："点背包按钮弹出背包界面；物品栏可上下滑动；
 * 点物品出现使用按钮，点使用消耗它；批量勾选后可以批量出售。"
 */
/**
 * 编号大纲的一节
 *
 * 这是策划案最常见的写法：一层层缩进的编号。
 * 顶层是功能，第二层是界面或标签页，第三层是里面的操作。
 */
export type PlanOutline = {
  title: string;
  /** 这一节自己的说明/操作 */
  lines: string[];
  children: PlanOutline[];
};

export type FeaturePlan = {
  id: string;
  name: string;
  /** 这是什么功能、给玩家干什么 */
  summary: string;
  /** 从哪儿进：主界面的入口，或哪一屏的哪个按钮 */
  entry: string[];
  /** 玩家在里面的操作，按顺序一步步写 */
  steps: string[];
  /** 编号大纲：功能 → 界面/标签页 → 操作，逐层缩进（策划案的常用写法） */
  outline: PlanOutline[];
  /** 布局事实（几行几列、滑动方向…） */
  details: string[];
  /** 涉及哪些界面 */
  screens: string[];
};

/** 玩家在屏幕上能看到的入口（导航栏、标签行上的按钮） */
export type NavEntry = { label: string; icon?: string; to?: string; from: string };

export type GamePlan = {
  /** 玩法一览：有哪些系统 */
  systems: SystemPlan[];
  /** 功能/系统：整个原型包括哪些功能，各自怎么操作 */
  features: FeaturePlan[];
  /** 主界面上能看到的入口，用来判断"这个原型有哪些功能" */
  nav: NavEntry[];
  /** 这份文档里出现的、没有归到已知功能里的按钮文字 */
  otherEntries: string[];
  screens: ScreenPlan[];
  /** 交互总表 */
  flows: UiAction[];
  stats: { screens: number; overlays: number; controls: number; interactions: number; grids: number; slots: number };
};

/* ---------- 小组件：把一条部件读成策划能用的几行 ---------- */

const isPlaced = (it: Item | PlacedItem): it is PlacedItem => typeof (it as PlacedItem).x === "number";

/** 这一屏（或这一组）上有哪些部件，含容器里的子部件 */
function flatten(items: (Item | PlacedItem)[]): (Item | PlacedItem)[] {
  const out: (Item | PlacedItem)[] = [];
  const walk = (list: (Item | PlacedItem)[]) => {
    for (const it of list) {
      out.push(it);
      if (it.children?.length) walk(it.children);
    }
  };
  walk(items);
  return out;
}

const label = (it: Item, lang: Lang, fallback = "") =>
  (it.label ?? "").trim() || (it.label2 ?? "").trim() || KIND_TEXT[lang][it.kind]?.noun || it.kind || fallback;

/** 一个部件"能不能操作" */
function interactiveOf(it: Item, lang: Lang): string[] {
  const out: string[] = [];
  const spec = KIND_SPEC[it.kind];
  if (!spec) return out;
  if (it.action?.to || it.actions) out.push(t("planTappable", lang));
  if (spec.hasValue && it.value !== undefined) out.push(t("planDraggable", lang));
  if (spec.hasValue) out.push(t("planAdjustable", lang));
  if (spec.hasChecked || it.checked !== undefined) out.push(t("planCheckable", lang));
  if (it.scroll) out.push(t("planScrollable", lang));
  if (it.tabs?.length) out.push(`${t("planPickable", lang)}(${it.tabs.length})`);
  if (it.prizes?.length) out.push(`${t("planPrizes", lang)}(${it.prizes.length})`);
  if (it.rewards?.length) out.push(`${t("planRewards", lang)}(${it.rewards.length})`);
  if (it.flow || it.slotFlows) out.push(t("planStateful", lang));
  return out;
}

const transitionName = (lang: Lang, tr: string | undefined): string => {
  if (!tr || tr === "none") return t("planNoAnim", lang);
  const map: Record<string, string> = {
    slide: t("planFromRight", lang),
    slideLeft: t("planFromLeft", lang),
    slideUp: t("planFromBottom", lang),
    slideDown: t("planFromTop", lang),
    fade: t("planFade", lang),
  };
  return map[tr] ?? tr;
};

/* ---------- 逐屏：控件、交互、布局 ---------- */

/**
 * 一屏上的控件，**按原型的嵌套关系**（不是平铺）
 *
 * 这一点很关键：标签行里的每一页、格子框里的格位，都是**子控件**。
 * 平铺开来就会丢掉"批量出售在果实那一页里"这种归属，而策划案正是要这层关系。
 */
function controlsOf(groups: Group[], frame: Frame, frames: Frame[], widths: Record<string, number>, lang: Lang): UiControl[] {
  const mine = groups.filter((g) => frameOfGroup(g, frames, widths)?.id === frame.id);
  const make = (it: Item): UiControl => ({
    name: (it.name ?? "").trim() || label(it, lang),
    kind: it.kind,
    kindName: KIND_TEXT[lang][it.kind]?.noun ?? it.kind,
    label: (it.label ?? "").trim() || undefined,
    count: 1,
    interactive: interactiveOf(it, lang),
    size: { w: 0, h: 0 },
    children: (it.children ?? []).map(make),
    facts: factsOf(it, lang, widths),
    actions: itemActions(it, lang, nameOfFrame(frames, lang)),
  });
  /** 只合并"同一种、没名字、没子项"的重复件（比如一堆同样的图标按钮） */
  const merge = (list: UiControl[]): UiControl[] => {
    const out: UiControl[] = [];
    for (const c of list) {
      const plain = c.children.length === 0 && !c.label;
      const at = plain ? out.find((x) => x.kind === c.kind && x.children.length === 0 && !x.label) : undefined;
      if (at) at.count += 1;
      else out.push({ ...c, children: merge(c.children) });
    }
    return out.sort((a, b) => b.count - a.count);
  };
  return merge(flatten(mine.flatMap((g) => g.items)).map(make));
}

/** 一个控件自己的可量化细节：几行几列、往哪滑、定时关闭、取值上限… */
function factsOf(it: Item, lang: Lang, widths: Record<string, number> = {}): string[] {
  const out: string[] = [];
  if (it.kind === "invGrid" || it.kind === "gridWheel") {
    /* 行列数取渲染时用的那一套；作者没写列数时它是按宽度算的 */
    const grid = slotGrid(it, widths);
    const cells = (it.children ?? []).length;
    out.push(`${t("planRowsCols", lang).replace("{r}", String(grid.rows)).replace("{c}", String(grid.cols))}`);
    if (cells) out.push(`${t("planCells", lang)} ${cells}`);
  }
  if (it.scroll) out.push(it.scroll === "x" ? t("planHorizontally", lang) : t("planVertically", lang));
  if (it.autoClose) out.push(t("planAutoCloseIn", lang).replace("{n}", String(it.autoClose)));
  if (it.kind === "slider" || it.kind === "stepper") out.push(`${0}–${it.max ?? 100}`);
  if (it.tabs?.length) out.push(`${t("planTabsCount", lang)} ${it.tabs.length}`);
  if (it.prizes?.length) out.push(`${t("prizes", lang)} ${it.prizes.length}`);
  if (it.rewards?.length) out.push(`${t("rewards", lang)} ${it.rewards.length}`);
  return out;
}


/** 这一屏上的交互：点了什么、满足什么、然后怎样、去哪 */
function actionsOf(groups: Group[], frame: Frame, frames: Frame[], widths: Record<string, number>, lang: Lang): UiAction[] {
  const nameOf = nameOfFrame(frames, lang);
  const out: UiAction[] = [];
  const mine = groups.filter((g) => frameOfGroup(g, frames, widths)?.id === frame.id);
  for (const it of flatten(mine.flatMap((g) => g.items))) out.push(...itemActions(it, lang, nameOf));
  /* 同一条交互可能从多个部件上来，去掉完全重复的 */
  const seen = new Set<string>();
  return out.filter((a) => {
    const key = `${a.what}|${a.when}|${a.then}|${a.transition}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const nameOfFrame = (frames: Frame[], lang: Lang) => {
  const byId = new Map(frames.map((f) => [f.id, f]));
  return (id: string) => byId.get(id)?.name?.trim() || (id === "back" ? t("planBack", lang) : id);
};

/** 一个部件自己产生的交互（点它去哪、点一下换外观、点某一页去另一屏） */
function itemActions(it: Item, lang: Lang, nameOf: (id: string) => string): UiAction[] {
  const out: UiAction[] = [];
  {
    const who = label(it, lang);
    const jump = (a: { to: string; transition?: string; dialog?: boolean }, slot?: string) => {
      const target = a.to === "back" ? t("planBack", lang) : nameOf(a.to);
      out.push({
        what: slot ? `${who} · ${slot}` : who,
        when: t("planWhenTap", lang),
        then: a.dialog ? `${t("planOpensDialog", lang)} ${target}` : `${t("planGoesTo", lang)} ${target}`,
        to: a.to,
        transition: transitionName(lang, a.transition),
      });
    };
    if (it.action) jump(it.action);
    for (const [slot, a] of Object.entries(it.actions ?? {})) if (a) jump(a, slot);
    /* 状态机：点一下换一种外观，或等一会儿自己变 */
    for (const step of it.flow?.steps ?? []) {
      const when = step.trigger.kind === "after" ? `${step.trigger.seconds}${t("planSecondsLater", lang)}` : t("planWhenTap", lang);
      const look = step.to ? (it.flow?.looks.find((l) => l.id === step.to)?.name ?? t("planAnotherLook", lang)) : t("planStaysSame", lang);
      out.push({ what: who, when, then: `${t("planChangesLook", lang)} → ${look}` });
    }
    for (const t2 of it.tabs ?? []) {
      const a = it.actions?.[`tab:${(it.tabs ?? []).indexOf(t2)}`];
      if (a) jump(a, t2.label || t("planOneEntry", lang));
    }
  }
  return out;
}

/**
 * 把一个部件的**构成**写成几句话：它是由哪几样东西拼出来的
 *
 * 这是"还原这个功能到底是什么"的关键：像「角色信息」这种组件，
 * 名字本身说明不了什么，但拆开一看是**头像 + 角色名 + 经验进度条**，
 * 用途就清楚了。整片格子不逐个列（只报行列数），纯数值文字也不列。
 */
/**
 * 按**上下文**给部件起个说得通的名字
 *
 * 光写类型名（"图标按钮""进度条"）读者读不出这是什么。
 * 但放进上下文就明白了：一个没有文字说明的图标按钮，旁边写着"角色名XXXX"、
 * 下面还有一条"6万/12 万"的进度条 —— 这个图标按钮**就是头像**。
 * 这类推定只做有把握的（名字里已经点明了功能区），拿不准就照实写类型名。
 */
function semanticName(it: Item, ctx: string, label: string | undefined, lang: Lang): string {
  const noun = KIND_TEXT[lang][it.kind]?.noun ?? it.kind;
  const has = (re: RegExp) => re.test(ctx);
  /* 角色区：无字的图标位是头像，进度条是经验 */
  if (it.kind === "iconButton" && !label) {
    if (has(/角色|头像|资料|个人信息|档案/)) return t("planAvatar", lang);
    return t("planIconSlot", lang);
  }
  if (it.kind === "progressBar") {
    if (has(/角色|等级|经验|成长/)) return t("planExpBar", lang);
  }
  /* 任务区：带 (n/m) 的文字是任务目标 */
  if (it.kind === "text" && label && has(/任务/) && /[（(]\s*\d+\s*\/\s*\d+\s*[）)]/.test(label)) {
    return t("planQuestGoal", lang);
  }
  /* 资产区：纯数值的文字是数量 */
  if (it.kind === "text" && label && /^[\d.,]+\s*[万亿]?$/.test(label) && has(/资产|金币|钻石|点券|余额|钱/)) {
    return t("planAmount", lang);
  }
  return noun;
}

export function compositionOf(items: Item[], lang: Lang, widths: Record<string, number>, ctx = ""): string[] {
  const out: string[] = [];
  /** 这些是"看得见的东西"，才值得写出来；纯容器（box）和没字的角标跳过 */
  const SHOW: Kind[] = ["text", "progressBar", "iconButton", "button", "image", "slider", "checkbox", "switch", "chip", "fab", "badge", "stepper"];
  const walk = (list: Item[], depth: number) => {
    for (const it of list) {
      const nm = (it.name ?? "").trim();
      const lb = (it.label ?? "").trim();
      /* 格位与纯数量不逐个列 */
      if (/^格子\d+-\d+$/.test(nm) || /^格子\d+-\d+$/.test(lb)) continue;
      if (/^\d+$/.test(lb)) continue;
      if (it.kind === "invGrid" || it.kind === "gridWheel") {
        const grid = slotGrid(it, widths);
        out.push(`${t("planGridBox", lang)}（${t("planRowsCols", lang).replace("{r}", String(grid.rows)).replace("{c}", String(grid.cols))}${it.scroll ? ` · ${it.scroll === "x" ? t("planHorizontally", lang) : t("planVertically", lang)}` : ""}）`);
        continue;
      }
      if (SHOW.includes(it.kind) && (lb || it.kind !== "badge" || nm)) {
        out.push(lb ? `${semanticName(it, ctx, lb, lang)}：${lb}` : semanticName(it, ctx, undefined, lang));
      }
      walk(it.children ?? [], depth + 1);
    }
  };
  walk(items, 0);
  return [...new Set(out)];
}

/** 一个控件子树里的全部交互（含子项） */
const actionsUnder = (c: UiControl): UiAction[] => [...c.actions, ...c.children.flatMap(actionsUnder)];

/** 布局事实：几行几列、往哪滑、几个格子 */
function layoutOf(groups: Group[], frame: Frame, frames: Frame[], widths: Record<string, number>, lang: Lang): LayoutFact[] {
  const mine = groups.filter((g) => frameOfGroup(g, frames, widths)?.id === frame.id);
  const out: LayoutFact[] = [];
  for (const it of flatten(mine.flatMap((g) => g.items))) {
    if (it.kind === "invGrid" || it.kind === "gridWheel") {
      /* 行列数取**渲染时用的那一套**（slotGrid）：作者没显式写列数时它是按宽度算出来的，
         自己另算一遍就会和画布上看到的对不上。 */
      const grid = slotGrid(it, widths);
      const cells = Math.max(0, it.children?.length ?? 0);
      out.push({
        what: label(it, lang),
        detail: [
          `${t("planRowsCols", lang).replace("{r}", String(grid.rows)).replace("{c}", String(grid.cols))}`,
          `${t("planCellSize", lang)} ${cellOf(it)}`,
          `${t("planCells", lang)} ${cells}${it.gridCols === undefined ? `（${t("planColsAuto", lang)}）` : ""}`,
          it.cellNames ? t("planCellNames", lang) : "",
          it.scroll ? `${t("planScrollDir", lang)} ${it.scroll === "x" ? t("planHorizontally", lang) : t("planVertically", lang)}` : t("planNoScroll", lang),
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
    if (it.kind === "box" && it.scroll) {
      out.push({ what: label(it, lang), detail: `${t("planScrollable", lang)}：${it.scroll === "x" ? t("planHorizontally", lang) : t("planVertically", lang)}` });
    }
    if (it.kind === "bottomNav" || it.kind === "navRail") {
      out.push({
        what: label(it, lang),
        detail: `${t("planSlots", lang)} ${it.tabs?.length ?? 0}：${(it.tabs ?? []).map((x) => x.label || x.icon || "·").join(" / ")}${it.navPerRow ? ` · ${t("planPerRow", lang)} ${it.navPerRow}` : ""}`,
      });
    }
    if (it.kind === "tabs" || it.kind === "sideTabs") {
      const items = (it.tabs ?? []).map((x) => (x.label ?? "").trim()).filter(Boolean);
      out.push({ what: label(it, lang), detail: `${t("planTabsCount", lang)} ${items.length}：${items.join(" / ")}`, items });
    }
  }
  return out;
}

/* ---------- 功能：这个原型有哪些系统，各自怎么操作 ---------- */

/** 已知的功能类型：按界面名/入口名/控件特征认，顺序即优先级 */
const FEATURE_RULES: { id: string; nameKey: string; keywords: string[]; kinds: Kind[] }[] = [
  { id: "login", nameKey: "featLogin", keywords: ["登录", "登入", "ログイン", "login", "signin", "sign in", "注册", "register"], kinds: [] },
  { id: "battle", nameKey: "featBattle", keywords: ["战斗", "对战", "バトル", "battle", "combat", "pvp", "关卡", "stage", "boss"], kinds: [] },
  /* 只看文字：格子框在商店、图鉴、任务里都有，"有格子"不足以说明它是背包 */
  { id: "bag", nameKey: "featBag", keywords: ["背包", "仓库", "道具", "バッグ", "bag", "inventory", "warehouse", "storage", "物品"], kinds: [] },
  { id: "shop", nameKey: "featShop", keywords: ["商城", "商店", "购买", "ショップ", "shop", "store", "mall", "充值", "礼包"], kinds: [] },
  { id: "quest", nameKey: "featQuest", keywords: ["任务", "ミッション", "quest", "task", "mission", "成就", "每日"], kinds: ["taskBar"] },
  { id: "friends", nameKey: "featFriends", keywords: ["好友", "フレンド", "friend", "社交", "公会", "ギルド", "guild", "聊天"], kinds: [] },
  { id: "pet", nameKey: "featPet", keywords: ["宠物", "萌宠", "ペット", "pet", "坐骑"], kinds: [] },
  { id: "codex", nameKey: "featCodex", keywords: ["图鉴", "図鑑", "codex", "collection", "百科"], kinds: [] },
  { id: "dress", nameKey: "featDress", keywords: ["装扮", "换装", "着せ替え", "dress", "outfit", "skin", "时装"], kinds: [] },
  { id: "gacha", nameKey: "featGacha", keywords: ["抽奖", "抽卡", "扭蛋", "ガチャ", "gacha", "lottery", "wheel", "转盘", "砸蛋"], kinds: ["wheel", "gacha", "eggSmash", "gridWheel"] },
  { id: "reward", nameKey: "featReward", keywords: ["奖励", "報酬", "reward", "签到", "礼包", "领取"], kinds: ["rewardTrack", "moneyTree"] },
  { id: "share", nameKey: "featShare", keywords: ["分享", "シェア", "share", "邀请", "invite"], kinds: [] },
  { id: "settings", nameKey: "featSettings", keywords: ["设置", "設定", "settings", "preferences"], kinds: [] },
  { id: "profile", nameKey: "featProfile", keywords: ["我的", "个人", "プロフィール", "profile", "account", "头像"], kinds: [] },
];

/** 把一屏的"特征文字"收集起来：名字 + 入口文字 + 屏上的按钮文字 */
function textOf(s: ScreenPlan, nav: NavEntry[], lang: Lang): string {
  const fromNav = nav.filter((n) => s.openedFrom.includes(n.from) || n.to === s.id).map((n) => n.label);
  const labels = s.controls.map((c) => c.label ?? "").filter(Boolean);
  return [s.name, ...fromNav, ...labels].join(" ").toLowerCase();
}

function matchFeature(s: ScreenPlan, nav: NavEntry[], planKinds: Set<Kind>, lang: Lang): { id: string; nameKey: string } | null {
  /**
   * 先看**这一屏自己的名字**，再看别处凑出来的文字。
   *
   * 顺序很要紧：任务弹框里的文字里有一句"每日登录游戏（1/1）"，
   * 要是拿整屏文字去匹配，任务就会被认成"登录"功能。
   */
  const own = (s.name ?? "").toLowerCase();
  for (const rule of FEATURE_RULES) if (rule.keywords.some((k) => own.includes(k.toLowerCase()))) return rule;
  const text = textOf(s, nav, lang);
  for (const rule of FEATURE_RULES) if (rule.keywords.some((k) => text.includes(k.toLowerCase()))) return rule;
  for (const rule of FEATURE_RULES) if (rule.kinds.some((k) => planKinds.has(k))) return rule;
  return null;
}

/** 一句"这是什么功能" */
function featureSummary(name: string, screens: ScreenPlan[], lang: Lang): string {
  const overlays = screens.filter((x) => x.kind === "overlay").length;
  return overlays
    ? `${name}——${t("featSummaryLayers", lang).replace("{n}", String(overlays))}`
    : `${name}——${t("featSummaryOne", lang)}`;
}

/**
 * 把一个功能里"玩家会做的事"按顺序写成句子
 *
 * 顺序按操作的自然次序：先进入、再点里面的东西、然后是批量与滑动的用法。
 * 这不是从勾选动作里推出来的，而是从"这个界面上有什么"推出来的 ——
 * 勾选框、滑动、使用按钮各自都对应一句玩家语言。
 */
function stepsOf(feature: { id: string }, screens: ScreenPlan[], nav: NavEntry[], lang: Lang): string[] {
  const steps: string[] = [];
  const entryScreen = screens.find((s) => s.kind === "screen") ?? screens[0];
  const entries = nav.filter((n) => screens.some((s) => s.name === n.from || n.to === s.id));
  if (entries.length) {
    steps.push(t("featStepOpen", lang).replace("{entry}", entries.map((e) => e.label).join(" / ")).replace("{screen}", entryScreen?.name ?? ""));
  }
  for (const s of screens) {
    for (const a of s.actions) {
      if (a.then.includes(t("planBack", lang))) continue;
      steps.push(`${s.name}：${a.what} → ${a.when} → ${a.then}`);
    }
  }
  return steps;
}

/** 一屏上的操作，写成策划案那种一句话 */
function outlineLinesOf(screen: ScreenPlan, lang: Lang): string[] {
  const out: string[] = [];
  for (const a of screen.actions) {
    if (a.then.includes(t("planBack", lang))) continue;
    const bits = [t("featTap", lang).replace("{what}", a.what)];
    /* a.then 形如"弹出弹框 → 仓库·弹框"；取箭头后面那一段当名字 */
    const target = a.then.includes("→") ? a.then.split("→").pop()!.trim() : "";
    if (a.then.includes(t("planOpensDialog", lang))) bits.push(t("featPops", lang).replace("{name}", target));
    else if (a.then.includes(t("planGoesTo", lang))) bits.push(t("featGoes", lang).replace("{name}", target));
    else bits.push(a.then);
    if (a.transition && a.transition !== t("planNoAnim", lang)) bits.push(t("featEnter", lang).replace("{how}", a.transition));
    out.push(bits.join("，"));
  }
  /* 可滑动的格子框：补一句滑动用法（用户点名要有） */
  const grid = screen.controls.find((c) => c.kind === "invGrid" || c.kind === "gridWheel");
  if (grid?.interactive.includes(t("planScrollable", lang))) out.push(t("featHowBag", lang));
  if (screen.controls.some((c) => c.interactive.includes(t("planCheckable", lang)))) out.push(t("featStepBulk", lang));
  return [...new Set(out)];
}

/**
 * 编号大纲：功能 → 界面/标签页 → 操作
 *
 * 标签页单独成一层：仓库弹框里有"果实/超变果实/种子/道具"四个标签，
 * 它们各自是玩家眼里的一个入口，不该被压成一行文字。
 */
function outlineOf(name: string, members: ScreenPlan[], entry: string[], lang: Lang, isNav: boolean): PlanOutline[] {
  const root = members.find((m) => m.kind === "screen") ?? members[0];
  /** 一条动作写成一行 */
  const line = (a: UiAction): string => {
    const bits = [t("featTap", lang).replace("{what}", a.what)];
    const target = a.then.includes("→") ? a.then.split("→").pop()!.trim() : "";
    if (a.then.includes(t("planOpensDialog", lang))) bits.push(t("featPops", lang).replace("{name}", target));
    else if (a.then.includes(t("planGoesTo", lang))) bits.push(t("featGoes", lang).replace("{name}", target));
    else bits.push(a.then);
    if (a.transition && a.transition !== t("planNoAnim", lang)) bits.push(t("featEnter", lang).replace("{how}", a.transition));
    return bits.join("，");
  };
  const acts = (m: ScreenPlan) => m.actions.filter((a) => !a.then.includes(t("planBack", lang)));
  /* 标签行子树里的交互已经归到各页了；这里把它们从"整屏"那一层摘掉 */
  const underTabs = (m: ScreenPlan) =>
    new Set(
      m.controls
        .filter((c) => c.kind === "tabs" || c.kind === "sideTabs")
        .flatMap((c) => c.children.flatMap(actionsUnder))
        .map((a) => a.what),
    );
  /* 这一屏的"用法"几句：能滑动怎么用、能勾选怎么用（作者点名要有）。
     一条功能里同样的句子只说一次，免得"物品栏可上下滑动"在几处重复。 */
  const said = new Set<string>();
  const usage = (m: ScreenPlan): string[] => {
    const out: string[] = [];
    /* 这一层自己会不会定时关掉（气泡浮层 3 秒） */
    if (m.frame.autoClose) out.push(t("planAutoCloseIn", lang).replace("{n}", String(m.frame.autoClose)));
    const grid = m.controls.find((c) => c.kind === "invGrid" || c.kind === "gridWheel");
    if (grid?.interactive.includes(t("planScrollable", lang)) && !said.has("scroll")) {
      said.add("scroll");
      out.push(t("featHowBag", lang));
    }
    if (m.controls.some((c) => c.interactive.includes(t("planCheckable", lang))) && !said.has("bulk")) {
      said.add("bulk");
      out.push(t("featStepBulk", lang));
    }
    return out;
  };

  /** 把一个控件写成一行（带它自己的事实） */
  const controlLine = (c: UiControl): string => {
    const head = c.label ? `「${c.label}」` : c.name;
    const tail = c.facts.length ? `（${c.facts.join(" · ")}）` : c.interactive.length ? `（${c.interactive.join("、")}）` : "";
    return `${head}${tail}`;
  };
  /**
   * 一棵控件树铺成几行
   *
   * 两条规矩：格子框**只写它自己那一行**（几行几列、往哪滑），里面的 30 个格位不逐个列；
   * 已经在"点击…"那一行里说过的按钮，这里不再重复。
   */
  const alreadySaid = new Set<string>();
  const tabLabels = new Set<string>();
  for (const m of members) for (const c of m.controls) if (c.kind === "tabs" || c.kind === "sideTabs") for (const p of c.children) if (p.label) tabLabels.add(p.label);
  const controlLines = (list: UiControl[], depth = 0): string[] => {
    const out: string[] = [];
    for (const c of list) {
      if (!worth(c)) continue;
      if (c.label && alreadySaid.has(c.label)) continue;
      /* 格位不逐个列（"格子1-1"这样的名字）—— 格子框那一行已经写了行列数 */
      if (/^格子\d+-\d+$/.test(c.name)) continue;   /* 格位不逐个列 */
      if (/^\d+$/.test(c.label ?? "")) continue;       /* 格位里的数量不算控件 */
      if (tabLabels.has(c.label ?? "")) continue;      /* 标签名由各自那一页代表 */
      if (c.kind === "invGrid" || c.kind === "gridWheel") {
        out.push(controlLine(c));   /* 格位不展开 */
        continue;
      }
      out.push(controlLine(c));
      if (c.children.length && depth < 2) out.push(...controlLines(c.children, depth + 1));
    }
    return [...new Set(out)];
  };
  /**
   * 值得写进文档的控件
   *
   * 原型里有一堆装饰件（图片、分割线、没名字的图标按钮），列出来只是噪音。
   * 判据取三条：有作者起的名字/文字、能操作、或带着可量化的事实（几行几列、定时关闭…）。
   */
  const worth = (c: UiControl): boolean => {
    /* 带可量化事实的（格子框几行几列、滑块取值、定时关闭…） */
    if (c.facts.length > 0) return true;
    /* 读数据的文字（"格子上限：180/210"、"活动期间获取 …"） */
    if (c.label && /[：:0-9]/.test(c.label)) return true;
    /* 真能操作的控件 */
    if (c.interactive.length > 0 && ["button", "checkbox", "switch", "slider", "stepper", "radio", "chip"].includes(c.kind)) return true;
    return false;
  };
  /** 一屏里、标签行之外的控件：格子框、按钮…（标签行下面的那些单独处理） */
  const looseControls = (m: ScreenPlan): UiControl[] =>
    m.controls.filter((c) => c.kind !== "tabs" && c.kind !== "sideTabs" && worth(c));

  /**
   * 这一条功能的大纲
   *
   * 只有两层，加点深一层用于"弹框里再弹出来的东西"：
   *   · 功能名（顶层）
   *   · 直接写在功能名下的行 = 主界面上的操作
   *   · 一级子项 = 主界面弹出的层；那一层里有标签行时，按标签拆开，各自一段
   *     （默认打开的那一页带上"打开默认X标签页"和该层的操作 —— 与作者给的模板一致）
   *   · 二级子项 = 某个弹层里再弹出来的（出售 → 出售气泡浮层）
   */
  const lines: string[] = [];
  if (isNav && entry.length) lines.push(t("featStepOpenSimple", lang).replace("{entry}", entry.join(" / ")));
  /* 主界面自己的操作。主界面本身是个弹层时（作者直接从导航栏指过来），
     这一层的操作就等于这条功能的主线操作 —— 与作者给的样子一致。 */
  const rootUnder = underTabs(root);
  for (const a of acts(root)) if (!rootUnder.has(a.what)) lines.push(line(a));
  for (const m of members) {
    for (const a of acts(m)) alreadySaid.add(a.what);
    /* 归到标签页里的交互，别在整屏那一层再说一遍 */
    for (const c of m.controls) {
      if (c.kind !== "tabs" && c.kind !== "sideTabs") continue;
      for (const a of c.children.flatMap(actionsUnder)) alreadySaid.add(a.what);
    }
  }
  /* 主界面自己带标签行时，它的控件归属"默认打开的那一页"，别在这里重复一遍 */
  const rootTabs = root.controls.find((c) => c.kind === "tabs" || c.kind === "sideTabs");
  if (!rootTabs) lines.push(...controlLines(looseControls(root)));
  lines.push(...usage(root));

  /* 谁是从主界面直接打开的：主界面自己 + 它的动作指向的那些层 */
  const directIds = new Set<string>([root.id, ...(acts(root).map((a) => a.to).filter(Boolean) as string[])]);
  const children: PlanOutline[] = [];

  /* ① 主界面，以及它直接弹出的层；有标签行的按标签拆开 */
  const nodes: PlanOutline[] = [];
  const attach = new Map<string, PlanOutline>();   // 屏 id → 该屏对应的那一节
  for (const m of members) {
    if (!directIds.has(m.id)) continue;
    const tabs = m.layout.find((l) => (l.items?.length ?? 0) > 1)?.items ?? [];
    /* 没有标签行、且它就是这条功能本身时，不要再造一个同名的子项把内容重复一遍 */
    if (m.id === root.id && tabs.length <= 1) continue;
    /* 主界面自己的操作已经写在顶层那几行了，这里不再重复 */
    const mine = m.id === root.id ? [] : acts(m);
    if (tabs.length > 1) {
      /* 默认打开第一页：把"默认X标签页"和这一层的操作放在它下面 */
      /* 标签行的每一页，把这一页里的控件列出来（果子框、批量出售按钮…） */
      const tabRow = m.controls.find((c) => c.kind === "tabs" || c.kind === "sideTabs");
      const pages = tabRow?.children ?? [];
      /* 一页标签的行 = 这一页里的控件 + **这一页里那些控件的交互**
         （只在"果实"页才有的"出售""批量出售"就落在这里，不再挂到整屏上） */
      /* 同一页里同名按钮有好几个，渲染出来的句子一样，去个重 */
      const pageActions = (i: number) => (pages[i] ? [...new Set(actionsUnder(pages[i]).map(line))] : []);
      const pageLines = (i: number) => [...controlLines(pages[i]?.children ?? []), ...pageActions(i)];
      const pageOwner = underTabs(m);
      const first: PlanOutline = {
        title: `${m.name}·${tabs[0]}`,
        lines: [
          ...new Set([
            t("featDefaultTab", lang).replace("{tab}", tabs[0]),
            ...controlLines(looseControls(m)),
            ...pageLines(0),
            ...mine.filter((a) => !pageOwner.has(a.what)).map(line),
            ...usage(m),
          ]),
        ],
        children: [],
      };
      nodes.push(first);
      attach.set(m.id, first);
      tabs.slice(1).forEach((tab, i) => nodes.push({ title: `${m.name}·${tab}`, lines: pageLines(i + 1), children: [] }));
    } else {
      const one: PlanOutline = { title: m.name, lines: [...controlLines(looseControls(m)), ...mine.map(line), ...usage(m)], children: [] };
      nodes.push(one);
      attach.set(m.id, one);
    }
  }
  children.push(...nodes);

  /* ② 再下一层（出售弹框 → 出售气泡浮层）：挂在"打开它的那一节"下面。
       打开它的可能是主界面，也可能是某一个弹层；找最近的那个祖先。 */
  const ownerOf = (id: string): PlanOutline | undefined => {
    let cur: string | undefined = id;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const at = attach.get(cur);
      if (at) return at;
      /* 谁打开了 cur：在成员里找一条指向它的动作 */
      const opener = members.find((m) => acts(m).some((a) => a.to === cur));
      cur = opener?.id;
    }
    return undefined;
  };
  for (const m of members) {
    if (directIds.has(m.id)) continue;
    const parent = ownerOf(m.id);
    const node: PlanOutline = { title: m.name, lines: [...controlLines(looseControls(m)), ...acts(m).map(line), ...usage(m)], children: [] };
    if (parent) parent.children.push(node);
    else children.push(node);
  }

  /*
   * 把"从某一项打开的层"搬到**那一项下面**
   *
   * 之前这些层（出售弹框、出售气泡浮层、批量出售弹框）都跟标签页平级排在后面，
   * 读起来像是仓库的第四个标签页。它们其实是某一项点出来的，就该缩在那一项里 ——
   * 作者给的模板也是这个形态（`1.3 出售` → `1.3.1 "出售"弹框`）。
   */
  const top: PlanOutline = { title: name, lines, children: [] };
  /* 同名可能有多个（果实页和种子页各自弹出一次"出售气泡浮层"），按出现顺序排队 */
  const byName = new Map<string, PlanOutline[]>();
  const collect = (list: PlanOutline[]) => {
    for (const n of list) {
      byName.set(n.title, [...(byName.get(n.title) ?? []), n]);
      collect(n.children);
    }
  };
  collect(children);

  /* ① 先算出"谁该搬到谁下面"，别一边搬一边改，不然搬进去的会被当成要剔除的 */
  const pairs: { host: PlanOutline; target: PlanOutline }[] = [];
  const taken = new Set<PlanOutline>();
  /** 动作那一行渲染成「点击「出售」，弹出「出售弹框」」—— 按名字找 */
  const scan = (host: PlanOutline) => {
    for (const text of host.lines) {
      if (!/弹出|跳转到/.test(text)) continue;
      for (const [title, queue] of byName) {
        if (!text.includes(title)) continue;
        const target = queue.find((x) => x !== host && !taken.has(x));
        if (!target) continue;
        taken.add(target);
        pairs.push({ host, target });
        scan(target);
      }
    }
  };
  for (const child of children) scan(child);
  for (const text of lines) {
    if (!/弹出|跳转到/.test(text)) continue;
    for (const [title, queue] of byName) {
      if (!text.includes(title)) continue;
      const target = queue.find((x) => !taken.has(x));
      if (!target) continue;
      taken.add(target);
      pairs.push({ host: top, target });
      scan(target);
    }
  }

  /* ② 先从原来的位置摘掉（就地改，保住对象身份 —— host 就是这些对象本身） */
  const prune = (list: PlanOutline[]): PlanOutline[] => {
    const kept = list.filter((n) => !taken.has(n));
    for (const n of kept) n.children = prune(n.children);
    return kept;
  };
  top.children = prune(children);

  /* ③ 再搬到打开它的那一项下面 */
  for (const { host, target } of pairs) host.children.push(target);

  /*
   * 同一个层只写一次
   *
   * 原型里"出售气泡浮层"被多个页签的按钮各自弹出一次，
   * 照搬就会出现两节一模一样的内容。保留第一次出现的位置，后面重复的去掉。
   */
  const seenTitle = new Set<string>();
  const dedupe = (list: PlanOutline[]): PlanOutline[] =>
    list
      .filter((n) => {
        if (seenTitle.has(n.title)) return false;
        seenTitle.add(n.title);
        return true;
      })
      .map((n) => ({ ...n, children: dedupe(n.children) }));
  top.children = dedupe(top.children);

  return [top];
}

/* ---------- 系统：一屏主界面 + 它弹出来的层 ---------- */

function summarise(name: string, screens: ScreenPlan[], lang: Lang): string {
  const overlays = screens.filter((s) => s.kind === "overlay");
  const grids = screens.flatMap((s) => s.layout.filter((l) => l.what && l.detail.includes(t("planRowsCols", lang).split("{")[0]))).length;
  const parts = [
    screens.length > 1 ? t("planNInterfaces", lang).replace("{n}", String(screens.length)) : t("planOneInterface", lang),
    overlays.length ? t("planNOverlays", lang).replace("{n}", String(overlays.length)) : "",
    grids ? t("planNGrids", lang).replace("{n}", String(grids)) : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export function buildGamePlan(doc: Doc | null, lang: Lang, widths: Record<string, number> = {}): GamePlan {
  const frames = doc?.frames ?? [];
  const groups = doc?.groups ?? [];
  const byId = new Map(frames.map((f) => [f.id, f]));

  const screens: ScreenPlan[] = frames.map((f) => {
    const openedFrom: string[] = [];
    for (const other of frames) {
      const mine = groups.filter((g) => frameOfGroup(g, frames, widths)?.id === other.id);
      for (const it of flatten(mine.flatMap((g) => g.items))) {
        const targets = [it.action?.to, ...Object.values(it.actions ?? {}).map((a) => a?.to)].filter(Boolean) as string[];
        if (targets.includes(f.id) && other.id !== f.id) openedFrom.push(other.name || other.id);
      }
    }
      return {
      frame: f,
      id: f.id,
      name: f.name?.trim() || t("planUntitledScreen", lang),
      kind: f.role === "overlay" ? "overlay" : "screen",
      level: f.role === "overlay" ? overlayLevelText(overlayLevelOfFrame(f), lang) : undefined,
      openedFrom: [...new Set(openedFrom)],
      text: [f.note, ...(f.noteHistory ?? [])].filter(Boolean) as string[],
      controls: controlsOf(groups, f, frames, widths, lang),
      actions: actionsOf(groups, f, frames, widths, lang),
      layout: [
        /* 界面尺寸不写进文档：作者要的是"这屏能干什么"，不是像素。
           但"这一层 3 秒后自己关掉"这种规矩要写 —— 它就是玩法。 */
        ...(f.autoClose ? [{ what: t("planAutoClose", lang), detail: t("planAutoCloseIn", lang).replace("{n}", String(f.autoClose)) }] : []),
        ...(f.bg ? [{ what: t("planBackground", lang), detail: f.bg }] : []),
        ...(f.autoClose ? [{ what: t("planAutoClose", lang), detail: `${f.autoClose}s` }] : []),
        ...layoutOf(groups, f, frames, widths, lang),
      ],
    };
  });

  /* 归组：一屏主界面 + **从它打开的那些层**算一个系统。
     用精确的引用关系（谁的动作指向它），而不是靠名字像不像。 */
  const frameById = new Map(frames.map((f) => [f.id, f]));
  const isLayer = (id: string) => frameById.get(id)?.role === "overlay";
  /** 这一屏打开了哪些**层**：只算弹层，普通跳屏不算 —— 跳到另一屏是那一屏的事 */
  const openedBy = new Map<string, Set<string>>();
  for (const s of screens) {
    const mine = groups.filter((g) => frameOfGroup(g, frames, widths)?.id === s.id);
    for (const it of flatten(mine.flatMap((g) => g.items))) {
      const acts = [it.action, ...Object.values(it.actions ?? {})].filter(Boolean) as { to: string; dialog?: boolean }[];
      for (const a of acts) {
        if (!a.to || !a.dialog || !isLayer(a.to)) continue;
        if (!openedBy.has(a.to)) openedBy.set(a.to, new Set());
        openedBy.get(a.to)!.add(s.id);
      }
    }
  }
  const systems: SystemPlan[] = [];
  const used = new Set<string>();
  for (const s of screens) {
    if (used.has(s.id) || s.kind === "overlay") continue;
    /* 只收"直接从这个界面打开的层"，以及那些层的下一层（弹框里再开弹框） */
    const members = [s];
    const queue = [s.id];
    while (queue.length) {
      const from = queue.shift()!;
      for (const x of screens) {
        if (used.has(x.id) || x.id === s.id) continue;
        if (openedBy.get(x.id)?.has(from)) {
          used.add(x.id);
          members.push(x);
          queue.push(x.id);
        }
      }
    }
    used.add(s.id);
    const kinds = new Map<string, number>();
    for (const m of members) for (const c of m.controls) kinds.set(c.kindName, (kinds.get(c.kindName) ?? 0) + c.count);
    systems.push({
      name: s.name,
      screens: members,
      summary: summarise(s.name, members, lang),
      controls: [...kinds.entries()].map(([kindName, count]) => ({ kindName, count })).sort((a, b) => b.count - a.count),
      interactions: members.reduce((n, m) => n + m.actions.length, 0),
    });
  }
  /* 没被归进任何系统的弹层（没人指到它）单独成一条 */
  for (const s of screens) {
    if (used.has(s.id)) continue;
    used.add(s.id);
    systems.push({ name: s.name, screens: [s], summary: summarise(s.name, [s], lang), controls: s.controls.map((c) => ({ kindName: c.kindName, count: c.count })), interactions: s.actions.length });
  }

  /* 主界面上能看到的入口：导航栏、标签行、工具栏上的每一项。
     这些文字是"这个原型有哪些功能"最直接的依据。 */
  const nav: NavEntry[] = [];
  for (const s of screens) {
    const mine = groups.filter((g) => frameOfGroup(g, frames, widths)?.id === s.id);
    for (const it of flatten(mine.flatMap((g) => g.items))) {
      if (!(it.kind === "bottomNav" || it.kind === "navRail" || it.kind === "tabs" || it.kind === "sideTabs" || it.kind === "toolbar")) continue;
      (it.tabs ?? []).forEach((tab, i) => {
        nav.push({
          label: (tab.label ?? "").trim() || tab.icon || `#${i + 1}`,
          icon: tab.icon ?? undefined,
          to: it.actions?.[`tab:${i}`]?.to,
          from: s.name,
        });
      });
      if (it.action?.to && !(it.tabs ?? []).length) nav.push({ label: label(it, lang), to: it.action.to, from: s.name });
    }
  }
  const uniqueNav = nav.filter((n, i) => nav.findIndex((x) => x.label === n.label && x.from === n.from) === i);

  /* 功能（玩法系统）
     粒度取"主界面上的一个入口"：仓库、商店、宠物、图鉴、装扮、好友、任务…
     每个入口连带**从它打开的那些层**算一条功能。这比"按屏幕名归类"准得多 ——
     主界面上本来就有仓库/商店两扇门，它们不该被并成一条。 */
  const byName = new Map(screens.map((s) => [s.name, s]));
  /** 从某一屏出发，连带它能打开的所有层 */
  const withLayers = (root: ScreenPlan): ScreenPlan[] => {
    const out = [root];
    const queue = [root.id];
    while (queue.length) {
      const from = queue.shift()!;
      for (const x of screens) {
        /* 只收弹层：跳到别的界面不算"这一功能的层" */
        if (x.kind !== "overlay" || out.some((o) => o.id === x.id)) continue;
        if (openedBy.get(x.id)?.has(from)) {
          out.push(x);
          queue.push(x.id);
        }
      }
    }
    return out;
  };
  const features: FeaturePlan[] = [];
  const claimed = new Set<string>();
  const featureFor = (id: string, name: string, members: ScreenPlan[], entry: string[], isNav: boolean) => {
    const sub = members.filter((m) => m.kind === "overlay");
    const steps: string[] = [];
    /* 先写"怎么进去"，再按屏写里面的操作 */
    if (isNav && entry.length) steps.push(t("featStepOpen", lang).replace("{entry}", entry.join(" / ")).replace("{screen}", members[0]?.name ?? ""));
    for (const m of members) {
      for (const a of m.actions) {
        if (a.then.includes(t("planBack", lang))) continue;
        const line = `${m.name}：${a.what} → ${a.when} → ${a.then}`;
        if (!steps.includes(line)) steps.push(line);
      }
      /* 这一屏上有勾选框/可滑动的格子，就补一句"玩家会这么用" */
      for (const c of m.controls) {
        if (c.interactive.includes(t("planCheckable", lang)) && !steps.some((x) => x.includes(t("planBulk", lang)))) {
          steps.push(`${m.name}：${t("featStepBulk", lang)}`);
        }
        if (c.kind === "invGrid" && c.interactive.includes(t("planScrollable", lang)) && !steps.some((x) => x.includes(t("featHowBag", lang)))) {
          steps.push(`${m.name}：${t("featHowBag", lang)}`);
        }
      }
    }
    /* 同一个功能的两种叫法（"仓库"与"背包"）应当合并：名字互相包含即视为同一条 */
    const same = features.find((x) => x.name === name || x.name.includes(name) || name.includes(x.name));
    if (same) {
      /* 同一个功能被两处指到：合成一条，界面并列 */
      same.screens = [...new Set([...same.screens, ...members.map((m) => m.name)])];
      same.entry = [...new Set([...same.entry, ...entry])];
      same.details = [...same.details, ...members.flatMap((m) => m.layout.map((l) => `${m.name}｜${l.what}：${l.detail}`))].slice(0, 12);
      same.outline = outlineOf(same.name, members, same.entry, lang, true);
      members.forEach((m) => claimed.add(m.id));
      return;
    }
    features.push({
      id,
      name,
      outline: outlineOf(name, members, entry, lang, isNav),
      summary: featureSummary(name, members, lang),
      entry: entry.length ? entry : [members[0]?.name ?? ""],
      steps,
      details: members
        .flatMap((m) => m.layout.filter((l) => l.detail).map((l) => `${m.name}｜${l.what}：${l.detail}`))
        .slice(0, 12),
      screens: members.map((m) => m.name),
    });
    members.forEach((m) => claimed.add(m.id));
  };

  /* ① 导航栏上的每一项：它自己就是一扇门。
     一条功能按"门上的那行字"认，不按玩法类型合并 —— 仓库和商店是两扇门，
     即使两者都带格子框，也不该被并成一条。 */
  const claimedLabels = new Set<string>();
  /* 主界面（枢纽屏）：整条导航栏自己指向的那一屏。它不是"一项功能"，
     而是功能之间的中转站 —— 否则"背包"这种入口会把它连同所有弹层一起吞掉。 */
  const hubs = new Set<string>();
  for (const s of screens) {
    const mine = groups.filter((g) => frameOfGroup(g, frames, widths)?.id === s.id);
    if (flatten(mine.flatMap((g) => g.items)).some((it) => it.kind === "bottomNav" || it.kind === "navRail")) hubs.add(s.id);
  }
  hubs.forEach((id) => claimed.add(id));
  for (const n of uniqueNav) {
    if (!n.to || claimedLabels.has(n.label)) continue;
    const root = screens.find((s) => s.id === n.to);
    if (!root || claimed.has(root.id) || hubs.has(root.id)) continue;
    claimedLabels.add(n.label);
    featureFor(`nav:${n.label}`, n.label, withLayers(root), [n.label], true);
  }

  /* ② 导航没指到、但名字认得出来的屏（比如"任务弹框·领取任务奖励"）。
       已经是某个功能的层的，不另立一条 —— 它属于那个功能。 */
  const isLayerOfSomething = new Set<string>();
  for (const f of features) {
    for (const m of f.screens) if (m !== f.screens[0]) isLayerOfSomething.add(m);
  }
  const nameById = new Map(screens.map((x) => [x.id, x.name]));
  const attach = (screen: ScreenPlan): boolean => {
    /* 先看这一层自己的名字像哪条功能（"任务弹框·领取任务奖励"就该归"任务"）；
       再退回到"谁把它打开的"。主界面本身不算功能，所以它是中转站而不是归属。 */
    const own = [screen.name, ...screen.controls.map((c) => c.label ?? "")].join(" ").toLowerCase();
    const byNameMatch = features.find((f) => own.includes(f.name.toLowerCase()));
    const owners = [...(openedBy.get(screen.id) ?? [])]
      .filter((id) => !hubs.has(id))
      .map((id) => features.find((f) => f.screens[0] === nameById.get(id)));
    const first = byNameMatch ?? owners.find(Boolean);
    if (!first) return false;
    if (!first.screens.includes(screen.name)) first.screens = [...first.screens, screen.name];
    first.details = [...first.details, ...screen.layout.map((l) => `${screen.name}｜${l.what}：${l.detail}`)].slice(0, 12);
    for (const a of screen.actions) {
      const line = `${screen.name}：${a.what} → ${a.when} → ${a.then}`;
      if (!first.steps.includes(line)) first.steps.push(line);
    }
    claimed.add(screen.id);
    return true;
  };
  /* 只让**主界面/独立界面**另立功能。弹层永远归到某条功能下面 ——
     一个弹框自己不是一项玩法，把它提升成功能只会造出"背包：分享·弹框"这种条目。 */
  for (const s of screens) {
    if (claimed.has(s.id) || isLayerOfSomething.has(s.name) || s.kind === "overlay") continue;
    const rule = matchFeature(s, uniqueNav, new Set(s.controls.map((c) => c.kind)), lang);
    if (!rule) continue;
    featureFor(rule.id, t(rule.nameKey as never, lang), withLayers(s), [], false);
  }
  /* 还没归属的弹层：名字本身认得出是一种玩法（任务、分享…）就各立一条功能；
     否则按"谁打开的"并进某条功能。 */
  for (const s of screens) {
    if (claimed.has(s.id) || s.kind !== "overlay") continue;
    const rule = matchFeature(s, uniqueNav, new Set(s.controls.map((c) => c.kind)), lang);
    if (rule && !features.some((f) => f.name === t(rule.nameKey as never, lang))) {
      featureFor(rule.id, t(rule.nameKey as never, lang), withLayers(s), [], false);
      continue;
    }
    attach(s);
  }

  /* ③ 导航上写了名字、但还没对应界面的入口：也各占一条功能，
        内容为空 —— 这样"整个原型包含哪些功能"一眼看全，没做的也留了位。 */
  /* 主界面上作者**命名过、而且带动作**的部件，也各算一个入口
     （"音乐按钮"这种 —— 原型上是一扇门，但没指向任何界面，靠导航栏找不到它）。
     判据收得很紧：必须作者起了名字、去掉"按钮/框"等后缀还剩东西、而且**真的有动作**，
     否则"点券框""金币框""角色名XXXX"这些显示件会一股脑涌进来。 */
  const hubs2 = new Set(screens.filter((x) => hubs.has(x.id)).map((x) => x.id));
  const entryName = (nm: string) => nm.replace(/(按钮|信息条|框|栏|条)$/u, "").trim() || nm;
  const named: { name: string; items: Item[] }[] = [];
  for (const s of screens) {
    if (!hubs2.has(s.id)) continue;
    const mine = groups.filter((g) => frameOfGroup(g, frames, widths)?.id === s.id);
    for (const it of flatten(mine.flatMap((g) => g.items))) {
      const nm = ((it as Item).name ?? "").trim() || ((it as Item).label ?? "").trim();
      if (!nm) continue;
      if (interactiveOf(it as Item, lang).length === 0 && !it.action && !it.actions) continue;
      if (/格子|血条|资产|折叠|进度|徽标|图标按钮|文本|标签|导航栏/.test(nm)) continue;
      /* 纯数值/比率（"6万/12 万"）是显示件，不是入口 */
      if (/^[\d.,\s万亿%/]+$/u.test(nm)) continue;
      named.push({ name: nm, items: [it as Item] });
    }
  }
  /* 作者自建组件里带"信息"的那几个（"角色信息""任务信息条"）也是入口：
     它们是把一组部件包起来给作者复用的，本身就是界面上的一个区域。 */
  for (const cp of doc?.customParts ?? []) {
    const nm = (cp.name ?? "").trim();
    if (nm && /信息/.test(nm)) named.push({ name: nm, items: (cp.items ?? []) as Item[] });
  }
  /* 同名的合并成一条（"任务框"和"任务按钮"都是任务） */
  const namedBy = new Map<string, Item[]>();
  for (const n of named) {
    const key = entryName(n.name);
    if (!key) continue;
    namedBy.set(key, [...(namedBy.get(key) ?? []), ...n.items]);
  }
  for (const [nm, items] of [...namedBy].reverse()) {
    if (features.some((f) => f.name === nm || f.name.includes(nm) || nm.includes(f.name))) continue;
    features.push({ id: `named:${nm}`, name: nm, summary: "", entry: [t("planFromMain", lang)], steps: [], outline: [{ title: nm, lines: [], children: [] }], details: [], screens: [] });
    /* 这一条没有自己的界面，但**组件本身**说明了它是什么：把构成写出来 */
    const parts = compositionOf(items, lang, widths, nm);
    if (parts.length) features[features.length - 1].outline[0].lines.push(...parts);
  }
  const overlayNames = new Set(screens.filter((x) => x.kind === "overlay").map((x) => x.name));
  for (const n of uniqueNav) {
    if (!n.label || n.label === n.icon) continue;
    /* 弹层里的标签行（仓库弹框里的"果实/种子"）不是一项功能，它们已经在大纲里了 */
    if (overlayNames.has(n.from)) continue;
    if (features.some((f) => f.name === n.label)) continue;
    features.push({ id: `todo:${n.label}`, name: n.label, summary: "", entry: [n.from], steps: [], outline: [{ title: n.label, lines: [], children: [] }], details: [], screens: [] });
  }

  /* 剩下没归类的屏：列在"其它"里，不硬塞进某个玩法 */
  const otherEntries = [
    ...screens.filter((s) => !claimed.has(s.id)).map((s) => s.name),
  ].filter((x, i, arr) => x && arr.indexOf(x) === i).slice(0, 40);

  const grids = screens.flatMap((s) => s.layout).filter((l) => l.detail.includes(t("planRowsCols", lang).split("{")[0])).length;
  const slots = screens.reduce((n, s) => n + s.layout.filter((l) => l.what && l.detail.includes(t("planSlots", lang).split(" ")[0])).length, 0);
  return {
    systems,
    features,
    nav: uniqueNav,
    otherEntries,
    screens,
    flows: screens.flatMap((s) => s.actions.map((a) => ({ ...a, what: `${s.name} · ${a.what}` }))),
    stats: {
      screens: screens.filter((s) => s.kind === "screen").length,
      overlays: screens.filter((s) => s.kind === "overlay").length,
      controls: screens.reduce((n, s) => n + s.controls.reduce((m, c) => m + c.count, 0), 0),
      interactions: screens.reduce((n, s) => n + s.actions.length, 0),
      grids,
      slots,
    },
  };
}

export { byIdName as planFrameName };
function byIdName(f: Frame | undefined, fallback: string) {
  return f?.name?.trim() || fallback;
}
