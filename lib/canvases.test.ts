import { describe, expect, it } from "vitest";
import { Doc } from "./tokens";
import { isProject } from "./project";
import { frameOfGroup } from "./tokens";
import { BUILTIN_CANVAS_DOC } from "./builtinCanvas";
import {
  BUILTIN_CANVAS_ID,
  BUILTIN_CANVAS_NAME,
  CANVASES_KEY,
  CanvasState,
  activeCanvas,
  canvasBlank,
  canvasClosed,
  canvasCopy,
  canvasLabel,
  ensureBuiltin,
  isBuiltinCanvas,
  loadCanvases,
  saveCanvases,
  switchTo,
  withDoc,
  withName,
} from "./canvases";

const doc = (title: string): Doc => ({ title, brief: "", paletteKey: "purple", frame: "phone", frames: [], groups: [] });

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage;
};

/* 一份"自己的画布"：从内置那份出发，再开一份自己的并切过去 */
const fresh = (): CanvasState => {
  const base = ensureBuiltin(loadCanvases(memory()), doc(""));
  return canvasBlank(base, "我的", doc("我的"));
};

const withBuiltin = (): CanvasState => ensureBuiltin(withDoc(fresh(), doc("我的")), doc(""));

describe("画布标签页", () => {
  it("第一次打开就落在内置那份上（编辑器一进来就是 QQ 农场）", () => {
    const s = loadCanvases(memory());
    expect(s.list).toHaveLength(1);
    expect(s.list[0].id).toBe(BUILTIN_CANVAS_ID);
    expect(s.activeId).toBe(BUILTIN_CANVAS_ID);
  });

  it("坏的存档不会把清单弄崩", () => {
    const store = memory();
    store.setItem(CANVASES_KEY, "{ nope");
    expect(loadCanvases(store).list).toHaveLength(1);
    store.setItem(CANVASES_KEY, JSON.stringify({ list: [{ name: "" }, null, 7] }));
    expect(loadCanvases(store).list).toHaveLength(1);
  });
});

describe("从一份画布复制出另一份", () => {
  it("新开一份并把它的文档一起存进去", () => {
    const base = fresh();
    const s = canvasCopy(base, "x", "副本", doc("副本"));
    expect(s.list).toHaveLength(base.list.length + 1);
    const opened = activeCanvas(s)!;
    expect(opened.name).toBe("副本");
    expect(opened.kind).toBe("own");
    expect(s.docs[opened.id].title).toBe("副本");
  });

  it("并存：两份画布的文档各是各的", () => {
    const first = withDoc(fresh(), doc("甲"));
    const second = canvasCopy(first, first.activeId, "副本", doc("副本"));
    const back = switchTo(second, first.activeId, doc("副本改过"), doc("空白"));
    /* 切回去拿到的是"甲"，而刚离开的那份记着"副本改过" */
    expect(back.doc.title).toBe("甲");
    expect(back.state.docs[second.activeId].title).toBe("副本改过");
    expect(Object.keys(back.state.docs)).toHaveLength(first.list.length + 1);
  });
});

describe("切换与关闭", () => {
  it("切走时把手上这一份存进当前标签页，切回来拿到的还是它", () => {
    const base = withDoc(fresh(), doc("甲"));
    const two = canvasBlank(base, "空白", doc(""));
    /* 用户在"空白"上又改了点东西，然后切回"甲" */
    const edited = withDoc(two, doc("空白改过"));
    const { state, doc: target } = switchTo(edited, base.activeId, doc("空白改过"), doc("空白"));
    expect(target.title).toBe("甲");
    expect(state.docs[two.activeId].title).toBe("空白改过");
    expect(state.activeId).toBe(base.activeId);
  });

  it("切到不存在的画布不动", () => {
    const s = withDoc(fresh(), doc("甲"));
    expect(switchTo(s, "nope", doc("甲"), doc("空白")).state).toBe(s);
  });

  it("关掉正开着的那个就落到剩下的一份，文档也跟着删掉", () => {
    const base = withDoc(fresh(), doc("甲"));
    const two = canvasBlank(base, "空白", doc(""));
    const closed = canvasClosed(two, two.activeId, doc("空白"));
    expect(closed.list).toHaveLength(base.list.length);
    /* 关掉自己那一份之后落到内置那份（清单里的第一份） */
    expect(closed.activeId).toBe(closed.list[0].id);
    expect(closed.docs[two.activeId]).toBeUndefined();
  });

  it("关掉最后一份自己的会落到内置那份；内置那份永远删不掉", () => {
    const s = withDoc(fresh(), doc("甲"));
    const closed = canvasClosed(s, s.activeId, doc("空白"));
    expect(closed.list.some((c) => c.id === BUILTIN_CANVAS_ID)).toBe(true);
    expect(closed.activeId).toBe(BUILTIN_CANVAS_ID);
    /* 只剩内置那份时再删，什么也不变 */
    const again = canvasClosed({ ...closed, list: [closed.list[0]] }, BUILTIN_CANVAS_ID, doc("空白"));
    expect(again.list).toHaveLength(1);
  });

  it("内置那份删不掉", () => {
    const s = withBuiltin();
    expect(isBuiltinCanvas(s.list.find((c) => c.id === BUILTIN_CANVAS_ID))).toBe(true);
    expect(canvasClosed(s, BUILTIN_CANVAS_ID, doc("空白"))).toBe(s);
  });

  it("存下来再读回来，几份画布都还在", () => {
    const store = memory();
    /* 四份：内置的、自己那份、空白的、复制出来的 */
    let s = ensureBuiltin(fresh(), doc(""));
    s = withName(s, "甲");
    const mine = s.activeId;
    s = canvasBlank(s, "空白", doc(""));
    s = canvasCopy(s, mine, "副本", doc("副本"));
    expect(s.list).toHaveLength(4);
    /* 每份都留一份文档：模拟每份都被打开过、自动保存过 */
    const farm = s.activeId;
    s = { ...s, docs: { ...s.docs, [mine]: doc("甲"), [farm]: doc("副本") } };
    saveCanvases(store, s);

    const back = loadCanvases(store);
    expect(back.list).toHaveLength(4);
    expect(back.activeId).toBe(s.activeId);
    expect(back.docs[mine].title).toBe("甲");
    expect(back.docs[s.activeId].title).toBe("副本");
    expect(Object.keys(back.docs)).toHaveLength(4);
  });
});

describe("标签页上的名字", () => {
  it("名字为空的用文档标题称呼", () => {
    const s = ensureBuiltin(loadCanvases(memory()), doc(""));
    const empty = { ...s.list[0], name: "" };
    expect(canvasLabel(empty, "甲")).toBe("甲");
    expect(canvasLabel(empty, "")).toBe("");
  });

  /* 内置那份叫"QQ 农场"；它的文档没有标题，空标题不该把它盖掉 */
  it("空标题不覆盖已有的名字", () => {
    const named = canvasCopy(fresh(), "x", "QQ 农场副本", doc(""));
    const again = withName(named, "   ");
    expect(activeCanvas(again)!.name).toBe("QQ 农场副本");
    const renamed = withName(again, "改过的标题");
    expect(activeCanvas(renamed)!.name).toBe("改过的标题");
  });

  it("内置那份永远在清单里、排第一", () => {
    const s = ensureBuiltin(withDoc(fresh(), doc("甲")), doc(""));
    expect(s.list[0].id).toBe(BUILTIN_CANVAS_ID);
    expect(s.list[0].name).toBe(BUILTIN_CANVAS_NAME);
    /* 再加一次不会多出第二条 */
    expect(ensureBuiltin(s, doc("")).list.filter((c) => c.id === BUILTIN_CANVAS_ID)).toHaveLength(1);
  });
});

/* 内置画布的内容必须是"这份构建读得动"的文档：读不动的话，
   编辑器一进来是空的，流程图也会说"画布上还没有页面"。 */
describe("内置画布的内容", () => {
  it("是一份合法的文档，每一组都落得到某一屏上", () => {
    expect(isProject(BUILTIN_CANVAS_DOC)).toBe(true);
    expect(BUILTIN_CANVAS_DOC.frames.length).toBeGreaterThan(1);
    const ids = new Set(BUILTIN_CANVAS_DOC.frames.map((f) => f.id));
    /* 写了 frameId 的必须指得到那一屏 */
    for (const g of BUILTIN_CANVAS_DOC.groups) {
      if (g.frameId) expect(ids.has(g.frameId)).toBe(true);
    }
    /* 没写 frameId 的靠几何归属（frameOfGroup 的老路）：也必须在某一屏里面 */
    for (const g of BUILTIN_CANVAS_DOC.groups) {
      expect(frameOfGroup(g, BUILTIN_CANVAS_DOC.frames, {})?.id).toBeTruthy();
    }
  });

  it("自定义组件与主题都在（照抄，不能只剩 frames/groups）", () => {
    expect(BUILTIN_CANVAS_DOC.theme).toBeTruthy();
    expect((BUILTIN_CANVAS_DOC.customParts ?? []).length).toBeGreaterThan(0);
  });

  /* 用户口径：内置那份要和「新建画布」出来的长得一样 */
  it("配色就是新建画布那套（purple），不用原稿的 mono", () => {
    expect(BUILTIN_CANVAS_DOC.paletteKey).toBe("purple");
    /* paletteKey 不是 custom 时 customPalette 本来就不生效，留着只会误导 */
    expect(BUILTIN_CANVAS_DOC.customPalette).toBeUndefined();
  });
});
