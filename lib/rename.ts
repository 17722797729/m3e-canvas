/**
 * 改名时到底存什么名 —— 这是唯一一处规则，列表里的输入框、Enter、点到别处、Esc 都走它。
 *
 * The author's own words win, trimmed of the whitespace around them. An empty (or all-whitespace) box
 * stores nothing: the row keeps the name it already had, so clearing the box can never blank a layer —
 * **the previous name stands** rather than an empty one being written. A name the author left exactly as
 * it was also stores nothing, which keeps an unchanged double-click out of the undo history.
 *
 * `null` is how "nothing to store" is said, so a caller knows to leave the row alone instead of writing.
 */
export const renamedTo = (typed: string, previous: string): string | null => {
  const name = typed.trim();
  if (!name) return null;
  return name === previous.trim() ? null : name;
};
