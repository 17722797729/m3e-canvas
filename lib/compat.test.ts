import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isProject } from "./project";

describe("旧构建导出的文档要读得动", () => {
  it("groups[].locked 是 null 也算合法（旧文档里的「没锁」）", () => {
    const doc = JSON.parse(readFileSync("/Users/yin/Downloads/m3e-canvas_1.json", "utf8"));
    expect(isProject(doc)).toBe(true);
  });

  it("locked 是别的类型仍然挡掉", () => {
    const bad = {
      title: "", brief: "", paletteKey: "mono", frame: "phone",
      frames: [{ id: "f1", name: "页", x: 0, y: 0 }],
      groups: [{ id: "g1", x: 0, y: 0, axis: "x", locked: "yes", items: [{ id: "i1", kind: "button", label: "甲", icon: null, variant: "filled", x: 0, y: 0 }] }],
    };
    expect(isProject(bad)).toBe(false);
  });
});
