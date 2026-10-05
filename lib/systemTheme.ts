import { Theme } from "./tokens";

/**
 * 深浅色模式（`theme.bothModes`）
 * ---------------------------------------------------------------------------
 * `bothModes` 开着 = 应用跟随设备的浅色 / 深色设置：上屏的 `dark` 由系统决定，
 * 系统换了（白天变夜里、用户在系统设置里改了）就跟着换。关着 = 用作者在亮度里
 * 选的那一个（`theme.dark`）。
 *
 * 这条规则**只在这里写一遍**，是个纯函数、不碰 DOM：
 * `matchMedia("(prefers-color-scheme: dark)")` 的订阅在 lib/theme.ts 的
 * `useSystemDark`，它只负责把最新的系统值送进来。
 *
 * `theme.dark` 因此有两个身份：跟随系统时是"系统还没读到"的兜底（SSR、首帧、
 * 脚本还没跑），关掉跟随时是作者选的模式。所以跟随系统**不会**把系统值写进
 * `theme.dark`（那会把作者的显式选择改掉：回头关掉跟随系统就不知道用哪个了）。
 */
export const themeForSystem = (theme: Theme, systemDark: boolean): Theme =>
  theme.bothModes ? { ...theme, dark: systemDark } : theme;
