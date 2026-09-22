import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* `public/material-symbols.json` is the list the icon picker offers and searches, so a name it does
 * not carry cannot be chosen by an author at all — however well the font draws it. The navigation
 * fold buttons are drawn with the "V" and the same icon turned 180°, which is why the pair has to
 * be listed here. */
const catalogue = JSON.parse(readFileSync(resolve(process.cwd(), "public/material-symbols.json"), "utf8")) as {
  n: string;
  p: number;
  t: string;
}[];

describe("the icon catalogue", () => {
  it("has one entry per name, each a slug with search words", () => {
    expect(catalogue.length).toBeGreaterThan(1000);
    const seen = new Set<string>();
    for (const icon of catalogue) {
      expect(icon.n).toMatch(/^[a-z0-9_]+$/);
      expect(icon.t.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(icon.p)).toBe(true);
      expect(seen.has(icon.n)).toBe(false);
      seen.add(icon.n);
    }
  });

  it("offers the fold pair the navigation buttons are drawn with", () => {
    const names = new Set(catalogue.map((i) => i.n));
    /* the "V", and the same icon turned 180° */
    expect(names.has("expand_more")).toBe(true);
    expect(names.has("expand_less")).toBe(true);
    /* and the handful the editor's own controls are drawn with */
    for (const n of ["add", "close", "menu", "search", "arrow_back"]) expect(names.has(n)).toBe(true);
  });
});
