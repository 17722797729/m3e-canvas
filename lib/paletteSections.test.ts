import { describe, expect, it } from "vitest";
import { LANGS, t } from "./i18n";
import { CATEGORIES } from "./tokens";
import { CATEGORY_TEXT, COMPOSITES_SECTION_ID, FAVORITES_SECTION_ID, paletteSections } from "./paletteSections";

/* 部件面板（PartsPalette）各节的顺序：没有 DOM，所以断言它铺开时用的那份顺序数据。
   用户要求：收藏永远排第一，在所有分类之前；而且一个收藏都没有时这一节也要在
   （里面换成 favoritesHint 那句话），否则星标这个功能没人发现得了。 */
describe("the parts palette's section order", () => {
  it("puts the favourites first, above every category, in every language", () => {
    for (const { key } of LANGS) {
      const ids = paletteSections(key, { composites: false }).map((s) => s.id);
      expect(ids[0], key).toBe(FAVORITES_SECTION_ID);
      expect(ids[0], key).toBe("fav");
      /* 收藏后面才会出现分类，而且一个分类都不落在它前面 */
      const firstCategory = ids.findIndex((id) => id.startsWith("cat:"));
      expect(firstCategory, key).toBeGreaterThan(0);
      expect(ids.slice(1).every((id) => id.startsWith("cat:")), key).toBe(true);
    }
  });

  it("always carries the favourites section, even with nothing starred, and titles it", () => {
    /* 顺序里没有"有没有收藏"这个开关：没有收藏时那一节也在，只是里面换成提示 */
    const sections = paletteSections("zh", { composites: false });
    expect(sections[0].id).toBe("fav");
    expect(sections[0].icon).toBe("star");
    expect(sections[0].title).toBe(t("favorites", "zh"));
    expect(sections[0].title).toBe("收藏");
    /* 而提示那句话是给这一节用的，四种语言都有 */
    for (const { key } of LANGS) expect(t("favoritesHint", key).trim(), key).not.toBe("");
  });

  it("keeps the author's composites after the favourites and before the categories", () => {
    const withComposites = paletteSections("zh", { composites: true }).map((s) => s.id);
    expect(withComposites[0]).toBe("fav");
    expect(withComposites[1]).toBe(COMPOSITES_SECTION_ID);
    expect(withComposites.findIndex((id) => id.startsWith("cat:"))).toBeGreaterThan(1);
    /* 没有组合时这一节照旧不出现 */
    expect(paletteSections("zh", { composites: false }).map((s) => s.id)).not.toContain(COMPOSITES_SECTION_ID);
  });

  it("offers one titled section per category, in the palette's own order", () => {
    const categories = CATEGORIES.map((c) => c.key);
    const sections = paletteSections("en", { composites: false }).slice(1);
    expect(sections.map((s) => s.category)).toEqual(categories);
    expect(sections.map((s) => s.id)).toEqual(categories.map((key) => `cat:${key}`));
    expect(sections.map((s) => s.title)).toEqual(CATEGORIES.map((c) => c.label));
    /* 其余语言用自己的标题，且每个分类都译到了 */
    for (const { key } of LANGS) {
      if (key === "en") continue;
      expect(Object.keys(CATEGORY_TEXT[key]).sort(), key).toEqual([...categories].sort());
      for (const c of CATEGORIES) {
        const title = paletteSections(key, { composites: false }).find((s) => s.category === c.key)?.title;
        expect(title?.trim(), `${key}.${c.key}`).not.toBe("");
      }
    }
  });
});
