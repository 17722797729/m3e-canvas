import { describe, expect, it } from "vitest";

import { firstRule, holds, initialVars, NUMERIC_OPS, readVars, varInitial, varText, writtenValue, type Condition, type ItemRule, type Var } from "./tokens";

/* Variables are what turn a clickable picture into something playable: a button has to be
 * able to do one thing when the visitor can afford it and another when they cannot. The
 * evaluation is pure, so every combination is pinned here rather than clicked through. */

const num = (id: string, name: string, initial: number): Var => ({ id, name, kind: "number", initial });
const bool = (id: string, name: string, initial: boolean): Var => ({ id, name, kind: "boolean", initial });
const text = (id: string, name: string, initial: string): Var => ({ id, name, kind: "text", initial });
const cond = (varId: string, op: Condition["op"], value: Condition["value"]): Condition => ({ varId, op, value });

describe("variable values", () => {
  it("reads an initial value as the variable's own kind says it should", () => {
    expect(varInitial(num("a", "coins", 10))).toBe(10);
    /* a number written as text is still a number: documents come back from JSON and files */
    expect(varInitial({ ...num("a", "coins", 0), initial: "12" as unknown as number })).toBe(12);
    expect(varInitial({ ...num("a", "coins", 0), initial: "abc" as unknown as number })).toBe(0);
    expect(varInitial(bool("b", "claimed", false))).toBe(false);
    expect(varInitial({ ...bool("b", "claimed", false), initial: "true" as unknown as boolean })).toBe(true);
    expect(varInitial(text("c", "name", "Ada"))).toBe("Ada");
    expect(varInitial({ ...text("c", "name", ""), initial: 7 as unknown as string })).toBe("7");
  });

  it("starts the preview from every variable's initial value", () => {
    expect(initialVars([num("a", "coins", 10), bool("b", "claimed", false), text("c", "name", "Ada")])).toEqual({
      a: 10,
      b: false,
      c: "Ada",
    });
    expect(initialVars(undefined)).toEqual({});
  });
});

describe("conditions", () => {
  const vars = [num("stamina", "stamina", 12), bool("claimed", "claimed", false), text("rank", "rank", "bronze")];
  const state = { stamina: 12, claimed: false, rank: "bronze" };

  it("compares numbers with every operator", () => {
    expect(holds(cond("stamina", ">=", 10), state, vars)).toBe(true);
    expect(holds(cond("stamina", ">", 12), state, vars)).toBe(false);
    expect(holds(cond("stamina", "<", 20), state, vars)).toBe(true);
    expect(holds(cond("stamina", "<=", 12), state, vars)).toBe(true);
    expect(holds(cond("stamina", "==", 12), state, vars)).toBe(true);
    expect(holds(cond("stamina", "!=", 12), state, vars)).toBe(false);
  });

  it("refuses a numeric comparison on a value that is not a number", () => {
    /* the editor hides these operators, but a document can still arrive holding one */
    expect(holds(cond("stamina", ">", "lots"), state, vars)).toBe(false);
    expect(holds(cond("rank", ">", "bronze"), state, vars)).toBe(false);
    expect(holds(cond("claimed", ">", 0), state, vars)).toBe(false);
    expect(NUMERIC_OPS).toEqual([">", "<", ">=", "<="]);
  });

  it("compares booleans as on and off, and text as text", () => {
    expect(holds(cond("claimed", "==", false), state, vars)).toBe(true);
    expect(holds(cond("claimed", "!=", false), state, vars)).toBe(false);
    expect(holds(cond("claimed", "==", "true"), { ...state, claimed: true }, vars)).toBe(true);
    expect(holds(cond("rank", "==", "bronze"), state, vars)).toBe(true);
    expect(holds(cond("rank", "!=", "gold"), state, vars)).toBe(true);
  });

  it("never holds for a variable that is not there", () => {
    expect(holds(cond("ghost", "==", 1), state, vars)).toBe(false);
    expect(holds(cond("stamina", "==", 12), { ...state, stamina: undefined as unknown as number }, vars)).toBe(false);
  });
});

describe("rules", () => {
  const vars = [num("stamina", "stamina", 12)];
  const rules: ItemRule[] = [
    { id: "r1", when: [cond("stamina", ">=", 10)], do: { kind: "goto", to: "battle", transition: "slide" } },
    { id: "r2", when: [cond("stamina", ">=", 1)], do: { kind: "goto", to: "tired", transition: "slide" } },
    { id: "r3", do: { kind: "goto", to: "empty", transition: "slide" } },
  ];

  it("takes the first rule whose conditions hold", () => {
    expect(firstRule(rules, { stamina: 12 }, vars)?.id).toBe("r1");
    expect(firstRule(rules, { stamina: 3 }, vars)?.id).toBe("r2");
  });

  it("falls through to a rule with no conditions at all", () => {
    expect(firstRule(rules, { stamina: 0 }, vars)?.id).toBe("r3");
  });

  it("returns nothing when no rule holds, so the part's plain action can run", () => {
    const guarded: ItemRule[] = [{ id: "r1", when: [cond("stamina", ">=", 10)], do: { kind: "back" } }];
    expect(firstRule(guarded, { stamina: 2 }, vars)).toBeNull();
    expect(firstRule(undefined, { stamina: 2 }, vars)).toBeNull();
    expect(firstRule([], { stamina: 2 }, vars)).toBeNull();
  });

  it("needs every condition of a rule to hold, not just one", () => {
    const both: ItemRule[] = [{ id: "r", when: [cond("stamina", ">=", 10), cond("stamina", "<", 20)], do: { kind: "back" } }];
    expect(firstRule(both, { stamina: 12 }, vars)?.id).toBe("r");
    expect(firstRule(both, { stamina: 30 }, vars)).toBeNull();
  });
});

describe("writing a variable", () => {
  const coins = num("c", "coins", 100);
  const claimed = bool("b", "claimed", false);

  it("sets a literal, reading it as the variable's kind", () => {
    expect(writtenValue(coins, { kind: "set", varId: "c", value: 0 }, 100)).toBe(0);
    expect(writtenValue(coins, { kind: "set", varId: "c", value: "50" }, 100)).toBe(50);
    expect(writtenValue(claimed, { kind: "set", varId: "b", value: true }, false)).toBe(true);
  });

  it("adds a step, spending into the negative when the visitor overspends", () => {
    expect(writtenValue(coins, { kind: "add", varId: "c", delta: -30 }, 100)).toBe(70);
    expect(writtenValue(coins, { kind: "add", varId: "c", delta: 5 }, 0)).toBe(5);
    expect(writtenValue(coins, { kind: "add", varId: "c", delta: -30 }, 10)).toBe(-20);
    /* a step on a value that is not a number yet counts from zero rather than from NaN */
    expect(writtenValue(coins, { kind: "add", varId: "c", delta: 4 }, undefined)).toBe(4);
  });

  it("flips a boolean from whatever it holds", () => {
    expect(writtenValue(claimed, { kind: "toggle", varId: "b" }, false)).toBe(true);
    expect(writtenValue(claimed, { kind: "toggle", varId: "b" }, true)).toBe(false);
    expect(writtenValue(claimed, { kind: "toggle", varId: "b" }, undefined)).toBe(true);
  });
});

describe("text that reads a variable", () => {
  const vars = [num("s", "stamina", 12), text("n", "player", "Ada")];

  it("fills in what a variable holds right now", () => {
    expect(varText("Stamina {stamina}", { s: 7 }, vars)).toBe("Stamina 7");
    expect(varText("{player}, ready?", { n: "Bo" }, vars)).toBe("Bo, ready?");
    expect(varText("{a} and {a}", { a: 1 }, [num("a", "a", 0)])).toBe("1 and 1");
  });

  it("leaves a name nothing declares exactly as written, so a typo stays visible", () => {
    expect(varText("Coins {coins}", { s: 7 }, vars)).toBe("Coins {coins}");
    expect(varText("{stamina}", {}, vars)).toBe("{stamina}");
  });

  it("does nothing to text with no binding in it", () => {
    expect(varText("12", { s: 7 }, vars)).toBe("12");
    expect(varText("", { s: 7 }, vars)).toBe("");
    /* an unpaired brace is just a character */
    expect(varText("a { b", { s: 7 }, vars)).toBe("a { b");
  });

  it("lists the names a piece of text reads, for the editor's typo check", () => {
    expect(readVars("Stamina {stamina} of {max}")).toEqual(["stamina", "max"]);
    expect(readVars(undefined)).toEqual([]);
    expect(readVars("no bindings")).toEqual([]);
  });
});
