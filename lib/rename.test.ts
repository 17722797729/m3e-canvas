import { describe, expect, it } from "vitest";
import { renamedTo } from "./rename";

/* 图层列表里改名的唯一规则（Enter、点到别处、Esc 都走它）。These are the cases the box can be left in:
 * what the author typed, and the name the row already had. */
describe("what a committed rename stores", () => {
  it("stores the author's own words, trimmed", () => {
    expect(renamedTo("Save", "Button")).toBe("Save");
    expect(renamedTo("  Save  ", "Button")).toBe("Save");
    expect(renamedTo("My Layer", "Button")).toBe("My Layer");
    expect(renamedTo("保存按钮", "Button")).toBe("保存按钮");
    expect(renamedTo("Layer 2 🙂", "")).toBe("Layer 2 🙂");
  });

  it("stores nothing when the box is empty, so the previous name stands", () => {
    /* 清空输入框提交时，图层不能变成没有名字 —— 原来的名字留着 */
    for (const typed of ["", " ", "\t", "\n", "   \u3000 "]) {
      expect(renamedTo(typed, "Button"), JSON.stringify(typed)).toBeNull();
      /* what the caller ends up with: the name the row had */
      expect(renamedTo(typed, "Button") ?? "Button").toBe("Button");
    }
    /* and a row that had no name of its own keeps having none */
    expect(renamedTo("", "")).toBeNull();
    expect(renamedTo("   ", "")).toBeNull();
  });

  it("stores nothing when the name is left as it was", () => {
    /* an unchanged double-click must not fill the undo history with a write that changes nothing */
    expect(renamedTo("Button", "Button")).toBeNull();
    expect(renamedTo("  Button ", "Button")).toBeNull();
    /* while a real change is stored, however small */
    expect(renamedTo("Button ", "Button 2")).toBe("Button");
    expect(renamedTo("button", "Button")).toBe("button");
  });

  it("never hands back an empty string to write", () => {
    for (const previous of ["", "Button", "  "]) {
      for (const typed of ["", "   ", "Save", " Save "]) {
        const stored = renamedTo(typed, previous);
        expect(stored === null || stored.length > 0, `${JSON.stringify(typed)} over ${JSON.stringify(previous)}`).toBe(true);
      }
    }
  });
});
