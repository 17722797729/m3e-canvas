import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, Theme } from "./tokens";
import { themeForSystem } from "./systemTheme";

/* 深浅色模式（bothModes）：没有 DOM 的那一半 —— matchMedia 的订阅在
   lib/theme.ts 的 useSystemDark，这里只锁"系统值进来之后怎么定 dark"。 */

const theme = (patch: Partial<Theme> = {}): Theme => ({ ...DEFAULT_THEME, ...patch });

describe("themeForSystem：跟随系统深浅色", () => {
  it("bothModes 开着：系统深色就深色，系统浅色就浅色", () => {
    const t = theme({ bothModes: true, dark: false });
    expect(themeForSystem(t, true).dark).toBe(true);
    expect(themeForSystem(t, false).dark).toBe(false);
  });

  it("bothModes 开着时，作者存的那个 dark 不参与（系统说了算）", () => {
    /* 作者上次选的是深色，但系统现在是浅色：跟随系统赢 */
    expect(themeForSystem(theme({ bothModes: true, dark: true }), false).dark).toBe(false);
    /* 反过来也一样 */
    expect(themeForSystem(theme({ bothModes: true, dark: false }), true).dark).toBe(true);
  });

  it("bothModes 关着：系统是什么都不管，用作者选的那个", () => {
    const light = theme({ bothModes: false, dark: false });
    const dark = theme({ bothModes: false, dark: true });
    expect(themeForSystem(light, true)).toBe(light);
    expect(themeForSystem(light, true).dark).toBe(false);
    expect(themeForSystem(dark, false)).toBe(dark);
    expect(themeForSystem(dark, false).dark).toBe(true);
  });

  it("只换 dark，其余轴原样，而且不改传进来的那份", () => {
    const t = theme({ bothModes: true, dark: false, contrast: "medium", shape: "square", font: "robotoSerif", emphasized: true, motion: "expressive" });
    expect(themeForSystem(t, true)).toEqual({ ...t, dark: true });
    expect(themeForSystem(t, false)).toEqual({ ...t, dark: false });
    expect(t.dark).toBe(false);
  });

  it("出厂默认（bothModes: true）自然跟随系统", () => {
    expect(themeForSystem(DEFAULT_THEME, true).dark).toBe(true);
    expect(themeForSystem(DEFAULT_THEME, false).dark).toBe(false);
  });
});
