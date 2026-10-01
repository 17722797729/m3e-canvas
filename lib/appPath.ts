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

/**
 * 从编辑器进子页前留下的记号
 *
 * 子页上的「返回编辑器」要**回到刚才那一屏**，而不是重新加载一次编辑器：
 * 记下是从编辑器来的，子页就知道可以安全地 `history.back()`。
 * 直接从外链打开子页时没有这个记号，那就老老实实跳回编辑器首页。
 */
export const FROM_EDITOR_KEY = "m3e:from-editor";

export function markFromEditor(): void {
  try {
    sessionStorage.setItem(FROM_EDITOR_KEY, "1");
  } catch {
    /* 隐私模式下写不进去：那就在子页上退化成直接跳回编辑器 */
  }
}

export function takeFromEditor(): boolean {
  try {
    const had = sessionStorage.getItem(FROM_EDITOR_KEY) === "1";
    sessionStorage.removeItem(FROM_EDITOR_KEY);
    return had;
  } catch {
    return false;
  }
}

/**
 * 回编辑器：从编辑器来的就退回去（保留滚动与面板状态，不重新加载），
 * 否则跳编辑器首页。
 */
export function goToEditor(onFallback?: () => void): void {
  if (takeFromEditor()) {
    window.history.back();
    return;
  }
  if (onFallback) onFallback();
  else window.location.assign(editorHref());
}
