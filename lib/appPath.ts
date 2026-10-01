/**
 * 站内页面之间的地址
 *
 * ---------------------------------------------------------------------------
 * 为什么不能写 `"./"`
 *
 * 编辑器在站点根上，`/flow/` 与 `/market/` 是它下面的子页。子页里写 `"./"`，
 * 相对的是**子页自己**：
 *
 *   new URL("./", "http://host/market/") === "http://host/market/"
 *
 * 点「返回编辑器」于是又回到同一页，看起来像没反应（实测过）。
 * 所以这里统一给出绝对路径：部署到子路径时是 `/<basePath>/`，根部署时就是 `/`。
 */

/** 构建期注入的子路径前缀，没有就是根部署 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** 编辑器首页的地址；结尾一定带斜杠，`/market/` 这类子页也能正确跳回 */
export const editorHref = (basePath: string = BASE_PATH): string => `${basePath}/`;
