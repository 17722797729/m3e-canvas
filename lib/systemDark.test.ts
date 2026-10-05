import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeSystemDark } from "./theme";

/* 系统深浅色的订阅（lib/theme.ts）。这个仓库的测试没有 DOM，所以用一个假的
   `window.matchMedia`：锁住"挂载时读一次当前值 + 系统一变再读一次 + 退订后不再报"，
   也就是"应用开着的时候在系统里改深浅色，编辑器和画布要立刻跟上"。 */

type Listener = () => void;

function fakeMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mq = {
    matches: initial,
    addEventListener: (_type: string, fn: Listener) => void listeners.add(fn),
    removeEventListener: (_type: string, fn: Listener) => void listeners.delete(fn),
  };
  const queries: string[] = [];
  const matchMedia = vi.fn((query: string) => {
    queries.push(query);
    return mq as unknown as MediaQueryList;
  });
  const flip = (next: boolean) => {
    mq.matches = next;
    for (const fn of [...listeners]) fn();
  };
  return { matchMedia, queries, flip, listeners };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("subscribeSystemDark", () => {
  it("asks for the dark preference and reports the current value at once", () => {
    const { matchMedia, queries } = fakeMatchMedia(false);
    vi.stubGlobal("window", { matchMedia });
    const seen: boolean[] = [];
    const stop = subscribeSystemDark((dark) => seen.push(dark));
    expect(queries).toEqual(["(prefers-color-scheme: dark)"]);
    expect(seen).toEqual([false]);
    stop();
  });

  it("reports again on every system change while the app is open", () => {
    const { matchMedia, flip } = fakeMatchMedia(false);
    vi.stubGlobal("window", { matchMedia });
    const seen: boolean[] = [];
    const stop = subscribeSystemDark((dark) => seen.push(dark));
    flip(true);
    flip(false);
    flip(true);
    expect(seen).toEqual([false, true, false, true]);
    stop();
  });

  it("stops reporting once unsubscribed", () => {
    const { matchMedia, flip, listeners } = fakeMatchMedia(true);
    vi.stubGlobal("window", { matchMedia });
    const seen: boolean[] = [];
    const stop = subscribeSystemDark((dark) => seen.push(dark));
    expect(seen).toEqual([true]);
    expect(listeners.size).toBe(1);
    stop();
    expect(listeners.size).toBe(0);
    flip(false);
    expect(seen).toEqual([true]);
  });

  it("does nothing where there is no matchMedia (SSR, tests without a DOM)", () => {
    const onChange = vi.fn();
    const stop = subscribeSystemDark(onChange);
    expect(onChange).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });
});
