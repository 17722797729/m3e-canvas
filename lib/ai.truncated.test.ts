import { describe, expect, it, vi, afterEach } from "vitest";
import { aiErrorText, complete, completeChat } from "./ai";

/** 一家能用的假服务商：openaI 兼容 */
const settings = {
  provider: "openai",
  providers: { openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-x", key: "k" } },
} as never;

const stub = (body: unknown) => {
  vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => body }));
};

afterEach(() => vi.unstubAllGlobals());

describe("模型写到上限被截断", () => {
  it("默认仍然算失败（原来的行为：让别人知道没写完）", async () => {
    stub({ choices: [{ finish_reason: "length", message: { content: "前半段" } }] });
    await expect(complete(settings, "s", "u")).rejects.toThrow("long");
  });

  /* 这就是"AI 总结只返回 long"的根因：抛错 → 界面只看到 short code */
  it("allowTruncated 时把已经写出来的部分返回", async () => {
    stub({ choices: [{ finish_reason: "length", message: { content: "1 仓库\n  点击「仓库」打开。" } }] });
    const text = await complete(settings, "s", "u", undefined, 32000, { allowTruncated: true });
    expect(text).toContain("点击「仓库」打开");
  });

  it("截断时会明确回调一次（界面据此标「这是前半段」）", async () => {
    stub({ choices: [{ finish_reason: "length", message: { content: "前半段" } }] });
    let told = 0;
    await complete(settings, "s", "u", undefined, 100, { allowTruncated: true, onTruncated: () => (told += 1) });
    expect(told).toBe(1);
  });

  it("没截断就不回调", async () => {
    stub({ choices: [{ finish_reason: "stop", message: { content: "完整" } }] });
    let told = 0;
    await complete(settings, "s", "u", undefined, 100, { allowTruncated: true, onTruncated: () => (told += 1) });
    expect(told).toBe(0);
  });

  it("正常写完时两条路都给全文", async () => {
    stub({ choices: [{ finish_reason: "stop", message: { content: "完整内容" } }] });
    expect(await complete(settings, "s", "u")).toBe("完整内容");
    expect(await complete(settings, "s", "u", undefined, 100, { allowTruncated: true })).toBe("完整内容");
  });

  it("截断且一个字都没有时，仍然报 empty 而不是静默成功", async () => {
    stub({ choices: [{ finish_reason: "length", message: { content: "" } }] });
    await expect(completeChat(settings, "s", [{ role: "user", content: "u" }], undefined, 100, { allowTruncated: true })).rejects.toThrow("empty");
  });
});

describe("错误码翻成人话", () => {
  it("long 不再是裸的 long", () => {
    const text = aiErrorText(new Error("long"), "zh");
    expect(text).not.toBe("long");
    expect(text).toContain("截断");
  });

  it("其它短码也各有说法", () => {
    expect(aiErrorText(new Error("refusal"), "zh")).toContain("拒绝");
    expect(aiErrorText(new Error("empty"), "zh")).toContain("返回");
    expect(aiErrorText(new Error("reasoning"), "zh")).toContain("思考");
    expect(aiErrorText(new Error("model"), "zh")).not.toBe("model");
    for (const lang of ["ja", "en", "zh", "ko"] as const) {
      expect(aiErrorText(new Error("long"), lang).length).toBeGreaterThan(4);
    }
  });
});

describe("各家返回形状不同，正文要挖得出来", () => {
  it("新版 message.content（字符串）", async () => {
    stub({ choices: [{ finish_reason: "stop", message: { content: "正文" } }] });
    expect(await complete(settings, "s", "u")).toBe("正文");
  });

  it("message.content 是分块数组", async () => {
    stub({ choices: [{ finish_reason: "stop", message: { content: [{ text: "甲" }, { text: "乙" }] } }] });
    expect(await complete(settings, "s", "u")).toBe("甲乙");
  });

  it("旧的顶层 text 写法", async () => {
    stub({ choices: [{ finish_reason: "stop", text: "老写法" }] });
    expect(await complete(settings, "s", "u")).toBe("老写法");
  });

  it("有的服务商把错误塞在 200 里", async () => {
    stub({ error: { message: "max_tokens too large" } });
    await expect(complete(settings, "s", "u")).rejects.toThrow("max_tokens too large");
  });

  /* 这就是"无法解析模型的回复"的真身：推理模型把额度花在思考上，content 是空的 */
  it("只有思考过程、没有正文时，说清是思考吃掉了额度", async () => {
    stub({ choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "让我先想想……" } }] });
    await expect(complete(settings, "s", "u", undefined, 32000, { allowTruncated: true })).rejects.toThrow("reasoning");
  });

  it("思考过程不会被当成正文返回", async () => {
    stub({ choices: [{ finish_reason: "stop", message: { content: "正文", reasoning_content: "思考" } }] });
    expect(await complete(settings, "s", "u")).toBe("正文");
  });

  it("真的什么都没有才是 empty", async () => {
    stub({ choices: [{ finish_reason: "stop", message: { content: "" } }] });
    await expect(complete(settings, "s", "u")).rejects.toThrow("empty");
  });
});

describe("单次输出上限与关掉思考", () => {
  const capture = (body: unknown = { choices: [{ finish_reason: "stop", message: { content: "ok" } }] }) => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (u: string, i: { body: string }) => {
      calls.push({ url: String(u), body: JSON.parse(i.body) });
      return { ok: true, status: 200, json: async () => body };
    });
    return calls;
  };

  /** 会发 max_tokens 的那一家（openai 的新模型拒收这个字段，所以拿它测不出来） */
  const zhipu = (extra: Record<string, unknown> = {}) =>
    ({ provider: "zhipu", providers: { zhipu: { baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.3", key: "k", ...extra } } }) as never;

  /* 这就是真正的病根：一律夹到 8192，整份原型的说明根本写不完 */
  it("不再把上限一律夹到 8192", async () => {
    const calls = capture();
    await complete(zhipu(), "s", "u", undefined, 64000);
    expect(calls[0].body.max_tokens).toBeGreaterThan(8192);
  });

  it("也不会超过这一家自己报的量级", async () => {
    const calls = capture();
    await complete(zhipu(), "s", "u", undefined, 10_000_000);
    expect(calls[0].body.max_tokens).toBeLessThanOrEqual(96000);
  });

  it("openai 那边本来就不发 max_tokens（它自己按需给）", async () => {
    const calls = capture();
    await complete(settings, "s", "u", undefined, 64000);
    expect(calls[0].body).not.toHaveProperty("max_tokens");
  });

  it("关掉思考：智谱/DeepSeek 发 thinking: disabled", async () => {
    const calls = capture();
    await complete(zhipu({ noThinking: true }), "s", "u");
    expect(calls[0].body.thinking).toEqual({ type: "disabled" });
  });

  it("关掉思考：gemini 用 thinkingBudget: 0", async () => {
    const calls = capture();
    await complete({ provider: "gemini", providers: { gemini: { baseUrl: "https://x/v1", model: "m", key: "k", noThinking: true } } } as never, "s", "u");
    expect(calls[0].body.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("没开就不发这个字段", async () => {
    const calls = capture();
    await complete(settings, "s", "u");
    expect(calls[0].body).not.toHaveProperty("thinking");
  });

  /* 开关不该把请求弄坏：这一家不认就自动去掉重试 */
  it("服务商拒绝这个字段时，去掉它重试一次", async () => {
    const calls: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_u: string, i: { body: string }) => {
      const body = JSON.parse(i.body);
      calls.push(body);
      if (calls.length === 1) return { ok: false, status: 400, text: async () => "unknown field thinking" };
      return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: "重试成功" } }] }) };
    });
    const out = await complete({ ...(settings as object), providers: { openai: { baseUrl: "https://api.openai.com/v1", model: "m", key: "k", noThinking: true } } } as never, "s", "u");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toHaveProperty("reasoning_effort");
    expect(calls[1]).not.toHaveProperty("reasoning_effort");
    expect(out).toBe("重试成功");
  });
});
