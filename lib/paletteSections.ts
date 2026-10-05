import { t, type Lang } from "./i18n";
import { CATEGORIES, type Category } from "./tokens";

/** 分类标题：英文用 tokens 自己的 label，其余语言在这里（调色板每一节的标题） */
export const CATEGORY_TEXT = {
  ja: { actions: "操作", navigation: "ナビゲーション", containment: "コンテナ", inputs: "入力", content: "コンテンツ", progress: "進捗", features: "機能" },
  zh: { actions: "操作", navigation: "导航", containment: "容器", inputs: "输入", content: "内容", progress: "进度", features: "功能" },
  ko: { actions: "동작", navigation: "내비게이션", containment: "컨테이너", inputs: "입력", content: "콘텐츠", progress: "진행 상태", features: "기능" },
} satisfies Record<string, Record<Category, string>>;

/** 调色板里的一节：id 同时也是它折叠状态的存储键（见 ui.tsx 的 Section） */
export type PaletteSection = { id: string; icon: string; title: string; category?: Category };

/** 收藏那一节的 id —— 它永远排在最前 */
export const FAVORITES_SECTION_ID = "fav";
/** 作者自己存下来的那几套组合组件的那一节 */
export const COMPOSITES_SECTION_ID = "composite";

/**
 * 调色板各节的顺序 —— 顺序的唯一出处，调色板铺开时也按它来（见 components/PartsPalette.tsx）。
 *
 * 用户要求：收藏排第一，在所有分类之前；而且**就算一个收藏都没有，这一节也要在**（那一节里换成
 * 一句提示，见 favoritesHint），否则星标这个功能没人发现得了。
 *
 * 搜索时的结果不分节，所以那一路不走这里（调色板里 `q ? … : …` 的另一支）。
 * 组合组件那一节仍然只在作者真的存过组合时才出现。
 */
export function paletteSections(lang: Lang, opts: { composites: boolean }): PaletteSection[] {
  return [
    { id: FAVORITES_SECTION_ID, icon: "star", title: t("favorites", lang) },
    ...(opts.composites ? [{ id: COMPOSITES_SECTION_ID, icon: "widgets", title: t("composites", lang) }] : []),
    ...CATEGORIES.map((c) => ({
      id: `cat:${c.key}`,
      icon: c.icon,
      title: lang === "en" ? c.label : CATEGORY_TEXT[lang][c.key],
      category: c.key,
    })),
  ];
}
