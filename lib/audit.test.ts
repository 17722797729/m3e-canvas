import { describe, expect, it } from "vitest";

import { audit, auditCounts, AUDIT_KINDS, AUDIT_SEVERITY, AUDIT_TEXT, type AuditIssue } from "./audit";
import { BACK_TARGET, type Doc, type Frame, type Group, type Item } from "./tokens";
import { LANGS } from "./i18n";

/* The report is the only place that judges a document rather than drawing it, so each check
 * gets a document built around it: the tests read as the mistake they describe. */

const item = (patch: Partial<Item>): Item => ({ id: "i", kind: "button", label: "Go", icon: null, variant: "filled", ...patch });
const frame = (id: string, patch: Partial<Frame> = {}): Frame => ({ id, name: id, x: 0, y: 0, ...patch });
const group = (id: string, owner: Frame | null, items: Item[]): Group => ({
  id,
  x: owner?.x ?? 0,
  y: owner?.y ?? 0,
  axis: "x",
  items,
  ...(owner ? { frameId: owner.id } : {}),
});
const doc = (frames: Frame[], groups: Group[]): Doc => ({ groups, frames, paletteKey: "purple", frame: "phone", title: "App", brief: "" });

const kinds = (issues: AuditIssue[]) => issues.map((i) => i.kind);
const only = (issues: AuditIssue[], kind: AuditIssue["kind"]) => issues.filter((i) => i.kind === kind);

describe("audit: taps", () => {
  it("says nothing about a document whose taps all land somewhere", () => {
    const home = frame("home");
    const next = frame("next", { x: 500 });
    const report = audit(
      doc(
        [home, next],
        [
          group("g1", home, [item({ id: "a", action: { to: "next", transition: "slide" } })]),
          group("g2", next, [item({ id: "b", action: { to: BACK_TARGET, transition: "slide" } })]),
        ],
      ),
      {},
    );
    expect(report).toEqual([]);
  });

  it("reports a tap whose page is gone, naming the id it still points at", () => {
    const home = frame("home");
    const report = audit(doc([home], [group("g", home, [item({ id: "a", action: { to: "ghost", transition: "slide" } })])]), {});
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ kind: "deadLink", severity: "error", frameId: "home", itemId: "a", targetId: "ghost" });
  });

  it("does not call a link to a dialog broken, even when the dialog is defined further down", () => {
    const home = frame("home");
    const report = audit(
      doc(
        [home],
        [
          group("g", home, [item({ id: "a", label: "Shop", action: { to: "dlg", transition: "expand", dialog: true } })]),
          /* the dialog the button points at is drawn after it: the whole document is read first */
          group("d", home, [{ ...item({ id: "dlg", kind: "dialog", label: "Bag", overlay: "modal" }) }]),
        ],
      ),
      {},
    );
    expect(report).toEqual([]);
  });

  it("reports a tap that leads back to the page it sits on", () => {
    const home = frame("home");
    const report = audit(doc([home], [group("g", home, [item({ id: "a", action: { to: "home", transition: "none" } })])]), {});
    expect(report.map((i) => i.kind)).toContain("selfJump");
  });
});

describe("audit: pages", () => {
  it("reports a page nothing reaches and no swipe leads to", () => {
    const home = frame("home");
    const lost = frame("lost", { x: 500 });
    const report = audit(doc([home, lost], [group("g1", home, [item({ id: "a" })]), group("g2", lost, [item({ id: "b" })])]), {});
    expect(only(report, "unreachable").map((i) => i.frameId)).toEqual(["lost"]);
  });

  it("counts a page a swipe leads to as reachable", () => {
    const home = frame("home", { swipe: { left: "next" } });
    const next = frame("next", { x: 500 });
    const report = audit(doc([home, next], [group("g1", home, [item({ id: "a" })]), group("g2", next, [item({ id: "b" })])]), {});
    expect(only(report, "unreachable")).toEqual([]);
    /* the screen is reached, but nothing on it does anything */
    expect(only(report, "deadEnd").map((i) => i.frameId)).toEqual(["next"]);
  });

  it("reports a screen that neither leads anywhere nor reacts to anything", () => {
    const home = frame("home");
    const stuck = frame("stuck", { x: 500 });
    const report = audit(
      doc(
        [home, stuck],
        [group("g1", home, [item({ id: "a", action: { to: "stuck", transition: "slide" } })]), group("g2", stuck, [item({ id: "b" })])],
      ),
      {},
    );
    expect(only(report, "deadEnd").map((i) => i.frameId)).toEqual(["stuck"]);
  });

  it("reports the home screen too when nothing at all happens on it", () => {
    const home = frame("home");
    const report = audit(doc([home], [group("g", home, [item({ id: "a" })])]), {});
    expect(only(report, "deadEnd").map((i) => i.frameId)).toEqual(["home"]);
  });

  it("reports a page with no parts on it", () => {
    const home = frame("home");
    const bare = frame("bare", { x: 500 });
    const report = audit(
      doc([home, bare], [group("g", home, [item({ id: "a", action: { to: "bare", transition: "slide" } })])]),
      {},
    );
    /* an empty page is empty and nothing more: calling it a dead end as well would be noise,
       since the fix is the same one line */
    expect(kinds(report)).toEqual(["emptyFrame"]);
    expect(only(report, "unreachable")).toEqual([]);
  });

  it("says a blank canvas has no pages once, not once per stray part", () => {
    const report = audit(doc([], [group("g", null, [item({ id: "a" }), item({ id: "b" })])]), {});
    expect(report).toHaveLength(1);
    expect(report[0].kind).toBe("noPages");
  });
});

describe("audit: overlays", () => {
  const bag = () => frame("bag", { x: 500, role: "overlay", level: "modal" });
  const openBag = (id = "a") => group("g1", frame("home"), [item({ id, label: "Bag", action: { to: "bag", transition: "expand" } })]);

  it("reports an overlay page no tap opens", () => {
    const home = frame("home");
    const report = audit(doc([home, bag()], [group("g1", home, [item({ id: "a" })])]), {});
    expect(only(report, "orphanOverlay").map((i) => i.frameId)).toEqual(["bag"]);
  });

  it("leaves an overlay a tap opens alone when its level can be dismissed", () => {
    const home = frame("home");
    /* the bag has content of its own: a modal is dismissed by the back key or a tap beside it,
       so it needs no Back action inside */
    const report = audit(doc([home, bag()], [openBag(), group("g2", bag(), [item({ id: "b", label: "Content" })])]), {});
    expect(report).toEqual([]);
  });

  it("reports a system layer the visitor cannot leave, and clears one that carries its own way out", () => {
    const home = frame("home");
    const login = frame("login", { x: 500, role: "overlay", level: "system" });
    const open = group("g1", home, [item({ id: "a", label: "Sign in", action: { to: "login", transition: "fade" } })]);
    const trapped = audit(doc([home, login], [open, group("g2", login, [item({ id: "b", label: "Field" })])]), {});
    expect(only(trapped, "overlayTrapped").map((i) => i.frameId)).toEqual(["login"]);

    /* A Back action is *not* a way out of one: the back gesture is what the level refuses, so
       telling the author to add one would send them round in circles. */
    const stillTrapped = audit(
      doc([home, login], [open, group("g2", login, [item({ id: "b", label: "Cancel", action: { to: BACK_TARGET, transition: "fade" } })])]),
      {},
    );
    expect(only(stillTrapped, "overlayTrapped").map((i) => i.frameId)).toEqual(["login"]);

    /* what does work: a part whose rule closes the overlay, or one that goes somewhere */
    const closed = audit(
      doc([home, login], [open, group("g2", login, [item({ id: "b", label: "Later", rules: [{ id: "r", do: { kind: "close" } }] })])]),
      {},
    );
    expect(only(closed, "overlayTrapped")).toEqual([]);
    const left = audit(
      doc([home, login], [open, group("g2", login, [item({ id: "b", label: "Retry", action: { to: "home", transition: "fade" } })])]),
      {},
    );
    expect(only(left, "overlayTrapped")).toEqual([]);
  });

  it("reports an in-page dialog no tap opens, and one that traps the visitor", () => {
    const home = frame("home");
    const orphan = audit(doc([home], [group("g", home, [{ ...item({ id: "dlg", kind: "dialog", label: "Bag", overlay: "modal" }) }])]), {});
    /* the unbound dialog is the point; the screen it hides on is also a dead end, because a
       dialog nobody opens gives the visitor nothing to tap */
    expect(orphan.map((i) => i.kind)).toEqual(["deadEnd", "orphanOverlayItem"]);
    expect(only(orphan, "orphanOverlayItem")[0]).toMatchObject({ frameId: "home", itemId: "dlg" });

    const trapped = audit(
      doc(
        [home],
        [
          group("g", home, [item({ id: "a", action: { to: "lock", transition: "fade", dialog: true } })]),
          group("d", home, [{ ...item({ id: "lock", kind: "dialog", label: "PIN", overlay: "system" }) }]),
        ],
      ),
      {},
    );
    expect(trapped.map((i) => i.kind)).toEqual(["overlayTrapped"]);
    expect(trapped[0]).toMatchObject({ frameId: "home", itemId: "lock" });
  });
});

describe("audit: variables", () => {
  const stamina = { id: "st", name: "stamina", kind: "number" as const, initial: 12 };

  it("reports a rule that names a variable the document does not declare", () => {
    const home = frame("home");
    const d: Doc = {
      ...doc([home], [
        group("g", home, [
          item({ id: "a", rules: [{ id: "r", when: [{ varId: "ghost", op: ">=", value: 1 }], do: { kind: "back" } }] }),
        ]),
      ]),
      vars: [stamina],
    };
    const missing = only(audit(d, {}), "missingVar");
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ frameId: "home", itemId: "a", varId: "ghost", severity: "error" });
  });

  it("reports a write to a variable that is not declared", () => {
    const home = frame("home");
    const d: Doc = {
      ...doc([home], [group("g", home, [item({ id: "a", rules: [{ id: "r", do: { kind: "add", varId: "ghost", delta: -1 } }] })])]),
      vars: [stamina],
    };
    expect(only(audit(d, {}), "missingVar").map((i) => i.varId)).toEqual(["ghost"]);
  });

  it("passes a rule that tests and writes a declared variable", () => {
    const home = frame("home");
    const next = frame("next", { x: 500 });
    const d: Doc = {
      ...doc(
        [home, next],
        [
          group("g", home, [
            item({
              id: "a",
              rules: [
                { id: "r1", when: [{ varId: "st", op: ">=", value: 10 }], do: { kind: "goto", to: "next", transition: "slide" } },
                { id: "r2", do: { kind: "add", varId: "st", delta: -10 } },
              ],
            }),
          ]),
          group("g2", next, [item({ id: "b", action: { to: BACK_TARGET, transition: "slide" } })]),
        ],
      ),
      vars: [stamina],
    };
    expect(audit(d, {})).toEqual([]);
  });

  it("counts a page only a conditional tap reaches as reachable", () => {
    const home = frame("home");
    const locked = frame("locked", { x: 500 });
    const d: Doc = {
      ...doc(
        [home, locked],
        [
          group("g", home, [
            item({ id: "a", rules: [{ id: "r", when: [{ varId: "st", op: ">", value: 0 }], do: { kind: "goto", to: "locked", transition: "slide" } }] }),
          ]),
          group("g2", locked, [item({ id: "b", action: { to: BACK_TARGET, transition: "slide" } })]),
        ],
      ),
      vars: [stamina],
    };
    expect(only(audit(d, {}), "unreachable")).toEqual([]);
  });

  it("reports a conditional tap that leads nowhere", () => {
    const home = frame("home");
    const d: Doc = {
      ...doc([home], [group("g", home, [item({ id: "a", rules: [{ id: "r", do: { kind: "goto", to: "ghost", transition: "slide" } }] })])]),
      vars: [stamina],
    };
    expect(only(audit(d, {}), "deadLink").map((i) => i.targetId)).toEqual(["ghost"]);
  });

  it("reports text that reads a name nothing declares, and clears it when it does", () => {
    const home = frame("home");
    const bad: Doc = { ...doc([home], [group("g", home, [item({ id: "a", label: "Stamina {stamnia}" })])]), vars: [stamina] };
    const unknown = only(audit(bad, {}), "unknownBinding");
    expect(unknown).toHaveLength(1);
    expect(unknown[0]).toMatchObject({ itemId: "a", varId: "stamnia" });

    const good: Doc = { ...doc([home], [group("g", home, [item({ id: "a", label: "Stamina {stamina}" })])]), vars: [stamina] };
    expect(only(audit(good, {}), "unknownBinding")).toEqual([]);
  });

  it("reports a variable nothing reads and nothing writes", () => {
    const home = frame("home");
    const unused: Doc = { ...doc([home], [group("g", home, [item({ id: "a", action: { to: BACK_TARGET, transition: "none" } })])]), vars: [stamina] };
    const report = only(audit(unused, {}), "unusedVar");
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ varId: "stamina", severity: "info" });

    const read: Doc = { ...doc([home], [group("g", home, [item({ id: "a", label: "{stamina}", action: { to: BACK_TARGET, transition: "none" } })])]), vars: [stamina] };
    expect(only(audit(read, {}), "unusedVar")).toEqual([]);
  });
});

describe("audit: a tab row's panels", () => {
  /* A tab row switches by position, so a panel past the last tab has no tab that could ever bring it
   * forward. It would sit in the document, listed in the layers, and never be drawn. */
  const panel = (id: string) => ({ ...item({ id, kind: "box", label: id }), x: 0, y: 48 });

  it("reports a panel that no tab can reach", () => {
    const home = frame("home");
    const row = { ...item({ id: "row", kind: "tabs", tabs: [{ icon: "", label: "One" }] }), children: [panel("p1"), panel("p2")] } as Item;
    const report = audit(doc([home], [group("g", home, [row])]), {});
    expect(only(report, "extraPanel").map((i) => i.itemId)).toEqual(["row"]);
  });

  it("says nothing when every panel has a tab, or when the row has none", () => {
    const home = frame("home");
    const tabs = [{ icon: "", label: "One" }, { icon: "", label: "Two" }];
    const ok = { ...item({ id: "row", kind: "tabs", tabs }), children: [panel("p1"), panel("p2")] } as Item;
    expect(only(audit(doc([home], [group("g", home, [ok])]), {}), "extraPanel")).toEqual([]);
    const bare = item({ id: "row", kind: "tabs", tabs });
    expect(only(audit(doc([home], [group("g", home, [bare])]), {}), "extraPanel")).toEqual([]);
  });
});

describe("audit: the report itself", () => {
  it("puts errors before warnings before notes", () => {
    const home = frame("home");
    const bare = frame("bare", { x: 500 });
    const lost = frame("lost", { x: 1000 });
    const report = audit(
      doc(
        [home, bare, lost],
        [
          /* an empty page (note), a page nothing reaches (warning), a broken tap (error) */
          group("g1", home, [item({ id: "a", action: { to: "ghost", transition: "slide" } })]),
          group("g3", lost, [item({ id: "c" })]),
        ],
      ),
      {},
    );
    expect(kinds(report)).toEqual(["deadLink", "unreachable", "unreachable", "deadEnd", "emptyFrame"]);
    const rank = { error: 0, warning: 1, info: 2 } as const;
    const ranks = report.map((i) => rank[i.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("reports a step landing in a state that is gone, and a state nothing reaches", () => {
    const home = frame("home");
    const report = audit(
      doc([home], [
        group("g", home, [
          item({
            id: "b",
            flow: {
              looks: [{ id: "l1", label: "领取" }, { id: "l2", label: "孤儿" }],
              steps: [
                { id: "s1", from: ":start", to: "l1", trigger: { kind: "tap" } },
                { id: "s2", from: "l1", to: "ghost", trigger: { kind: "tap" } },
              ],
            },
          }),
        ]),
      ]),
      {},
    );
    expect(only(report, "danglingLook").map((i) => i.targetId)).toEqual(["ghost"]);
    expect(only(report, "unreachableLook").map((i) => i.targetId)).toEqual(["l2"]);
  });

  it("reads a step's condition and its writes like any other rule's", () => {
    const home = frame("home");
    const report = audit(
      doc([home], [
        group("g", home, [
          item({
            id: "b",
            flow: {
              looks: [{ id: "l1", label: "领取" }],
              steps: [
                {
                  id: "s1",
                  from: ":start",
                  to: "l1",
                  trigger: { kind: "tap" },
                  when: [{ varId: "ghost", op: ">=", value: 1 }],
                  do: [{ kind: "add", varId: "ghost", delta: -1 }],
                },
              ],
            },
          }),
        ]),
      ]),
      {},
    );
    /* the condition and the write both name the same undeclared variable, and neither is silently
       ignored: the report says so once per mention */
    expect(only(report, "missingVar").length).toBe(2);
  });

  it("counts each severity", () => {
    const counts = auditCounts([
      { kind: "deadLink", severity: "error", frameId: "a", itemId: null },
      { kind: "unreachable", severity: "warning", frameId: "b", itemId: null },
      { kind: "emptyFrame", severity: "info", frameId: "c", itemId: null },
    ]);
    expect(counts).toEqual({ error: 1, warning: 1, info: 1 });
  });

  it("gives every check a severity, an icon and words in every language", () => {
    for (const kind of AUDIT_KINDS) {
      expect(AUDIT_SEVERITY[kind]).toBeTruthy();
      for (const { key } of LANGS) {
        expect(AUDIT_TEXT[key].label[kind]).toBeTruthy();
        expect(AUDIT_TEXT[key].hint[kind]).toBeTruthy();
      }
    }
  });
});
