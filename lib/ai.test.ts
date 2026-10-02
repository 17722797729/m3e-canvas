import { afterEach, describe, expect, it, vi } from "vitest";
import { complete, hasKey, isSecureUrl, type AiSettings, type Provider, type ProviderConfig } from "./ai";

/* 扁平的写法保留下来：测试关心的是"当前这一家"用了什么，
   底下按服务商分开存的细节由 lib/ai 自己测。 */
type Flat = { provider?: Provider } & Partial<AiSettings> & Partial<ProviderConfig>;

const settings = (over: Flat = {}): AiSettings => {
  const provider = over.provider ?? "openai";
  const one = {
    baseUrl: over.baseUrl ?? "https://api.example.test",
    model: over.model ?? "test-model",
    key: over.key ?? "test-key",
  };
  return {
    provider,
    providers: { ...(over.providers ?? {}), [provider]: one } as AiSettings["providers"],
  };
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("complete on the claude path", () => {
  it("posts to the messages endpoint with the anthropic headers and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "hi" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const s = settings({ provider: "claude", baseUrl: "https://api.example.test/", key: "  test-key  " });
    await expect(complete(s, "sys prompt", "user prompt")).resolves.toBe("hi");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/messages");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "content-type": "application/json",
      "x-api-key": "test-key",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    });
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "test-model", max_tokens: 4096, system: "sys prompt", messages: [{ role: "user", content: "user prompt" }] });
  });

  it("joins only the text blocks of the reply", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      content: [{ type: "text", text: "a" }, { type: "tool_use", id: "t" }, { type: "text", text: "b" }],
    })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).resolves.toBe("ab");
  });

  it("returns an empty string for an empty content array instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ content: [] })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).resolves.toBe("");
  });

  it("throws long when the reply stops at max_tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "partial" }], stop_reason: "max_tokens" })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).rejects.toThrow("long");
  });

  it("throws refusal when the model refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ content: [], stop_reason: "refusal" })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).rejects.toThrow("refusal");
  });

  it("throws the status and provider detail on an http error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 529, statusText: "Overloaded" })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).rejects.toThrow("529 Overloaded: overloaded");
  });
});

describe("complete on the openai-compatible path", () => {
  it("sends bearer auth and omits max_tokens for the openai provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(complete(settings(), "sys prompt", "user prompt")).resolves.toBe("ok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json", authorization: "Bearer test-key" });
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "test-model", messages: [{ role: "system", content: "sys prompt" }, { role: "user", content: "user prompt" }] });
    expect(body).not.toHaveProperty("max_tokens");
  });

  it.each(["gemini", "deepseek"] as Provider[])("sends a max_tokens budget to %s", async (provider) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(complete(settings({ provider }), "s", "u")).resolves.toBe("ok");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(4096);
  });

  it("calls a local endpoint without a key and without an authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "local" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const s = settings({ baseUrl: "http://localhost:11434/v1/", key: "" });
    await expect(complete(s, "s", "u")).resolves.toBe("local");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(init.headers).toEqual({ "content-type": "application/json" });
  });

  it("joins array content parts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: [{ text: "a" }, {}, { text: "b" }] } }] })));
    await expect(complete(settings(), "s", "u")).resolves.toBe("ab");
  });

  it("throws long when finish_reason is length", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "length", message: { content: "partial" } }] })));
    await expect(complete(settings(), "s", "u")).rejects.toThrow("long");
  });

  it("throws the status and provider detail on an http error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401, statusText: "Unauthorized" })));
    await expect(complete(settings(), "s", "u")).rejects.toThrow("401 Unauthorized: bad key");
  });

  it("throws empty when the reply has no content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "stop", message: {} }] })));
    await expect(complete(settings(), "s", "u")).rejects.toThrow("empty");
  });
});

describe("complete input guards", () => {
  /* 型号留空不再是错误：那时用的是这一家当前的默认（见 modelInUse） */
  it.each([
    ["insecure", { baseUrl: "http://api.example.test" }],
  ])("rejects %s without calling fetch", async (message, over) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(complete(settings(over), "s", "u")).rejects.toThrow(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("hasKey and isSecureUrl", () => {
  it("requires a key for hosted endpoints but not for this machine", () => {
    expect(hasKey(settings())).toBe(true);
    expect(hasKey(settings({ key: "  " }))).toBe(false);
    expect(hasKey(settings({ key: "", baseUrl: "http://localhost:11434/v1" }))).toBe(true);
  });

  it("only allows https or an endpoint on this machine", () => {
    expect(isSecureUrl("https://api.example.test/v1")).toBe(true);
    expect(isSecureUrl("http://localhost:8080/v1")).toBe(true);
    expect(isSecureUrl("http://127.0.0.1:8080/v1")).toBe(true);
    expect(isSecureUrl("http://[::1]:8080/v1")).toBe(true);
    expect(isSecureUrl("http://api.example.test/v1")).toBe(false);
  });
});

describe("读模型的一次回答", () => {
  it("把代码块里的设计拿出来，前面的话留作说明", async () => {
    const { readReply } = await import("./ai");
    const doc = { title: "T", brief: "", paletteKey: "purple", frame: "phone", groups: [{ id: "g", x: 0, y: 0, axis: "x", items: [{ id: "i", kind: "button", label: "A", icon: null, variant: "filled" }] }], frames: [{ id: "f", name: "Home", x: 0, y: 0 }] };
    const reply = readReply(`加了一个按钮。\n\n\`\`\`json\n${JSON.stringify(doc)}\n\`\`\``);
    expect(reply.text).toBe("加了一个按钮。");
    expect(reply.design).toMatchObject({ title: "T" });
  });

  it("整段就是一个文档时也能认出来", async () => {
    const { readReply } = await import("./ai");
    const doc = { title: "", brief: "", paletteKey: "purple", frame: "phone", groups: [], frames: [{ id: "f", name: "Home", x: 0, y: 0 }] };
    expect(readReply(JSON.stringify(doc)).design).toMatchObject({ frame: "phone" });
  });

  /* 追问、说明、拒绝都是正常回答：不碰画布，只进对话 */
  it("普通回话就当回话，不误判成设计", async () => {
    const { readReply } = await import("./ai");
    expect(readReply("你是想要三屏还是四屏？")).toEqual({ text: "你是想要三屏还是四屏？", design: undefined });
    expect(readReply("```json\n{\"not\":\"a doc\"}\n```\n这段其实不是文档").design).toBeUndefined();
    /* 空回答是异常（界面按「读不出来」提示），不是「一句空话」 */
    expect(() => readReply("")).toThrow("empty");
  });
});

describe("附件", () => {
  it("只有文字时消息内容就是那段文字", async () => {
    const { userMessage } = await import("./ai");
    expect(userMessage("画一个首页")).toEqual({ role: "user", content: "画一个首页" });
  });

  it("带图片时内容块是 OpenAI 兼容的形状", async () => {
    const { userMessage } = await import("./ai");
    const msg = userMessage("照这个来", ["data:image/png;base64,AAA"]);
    expect(msg.role).toBe("user");
    expect(Array.isArray(msg.content)).toBe(true);
    expect((msg.content as unknown[])[0]).toEqual({ type: "text", text: "照这个来" });
    expect((msg.content as unknown[])[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AAA" } });
  });

  it("只发图片不写字也是合法的一轮", async () => {
    const { userMessage } = await import("./ai");
    const msg = userMessage("", ["data:image/png;base64,AAA"]);
    expect((msg.content as unknown[]).length).toBe(1);
  });
});

describe("智谱 GLM", () => {
  it("按 OpenAI 兼容的方式请求，Bearer 带上 key", async () => {
    const { PROVIDERS, providerSpec } = await import("./ai");
    expect(PROVIDERS.map((p) => p.key)).toContain("zhipu");
    const spec = providerSpec("zhipu");
    expect(spec.baseUrl).toBe("https://open.bigmodel.cn/api/paas/v4");
    expect(spec.model).toBe("glm-5.3");

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await complete(settings({ provider: "zhipu", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.3", key: "zhipu-key" }), "s", "u");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://open.bigmodel.cn/api/paas/v4/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer zhipu-key");
    expect(JSON.parse(init.body)).toMatchObject({ model: "glm-5.3", max_tokens: 4096 });
  });
});

describe("多轮对话", () => {
  it("把历史整段发上去，system 在最前", async () => {
    const { completeChat } = await import("./ai");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "好" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await completeChat(settings(), "sys", [
      { role: "user", content: "第一句" },
      { role: "assistant", content: "第一答" },
      { role: "user", content: "再改一下" },
    ]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "第一句" },
      { role: "assistant", content: "第一答" },
      { role: "user", content: "再改一下" },
    ]);
  });
});

describe("模型名由使用者在设置里填", () => {
  it("留空时按这一家当前的默认发出去", async () => {
    const { completeChat, providerSpec } = await import("./ai");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await completeChat(settings({ provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "   " }), "s", [{ role: "user", content: "u" }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(providerSpec("deepseek").model);
  });

  it("填了就用填的那个，不做任何改写", async () => {
    const { completeChat } = await import("./ai");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await completeChat(settings({ model: "my-own-model-7" }), "s", [{ role: "user", content: "u" }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("my-own-model-7");
  });

  /* 各家当前的主推型号：过期的默认值会让新用户第一次就请求失败 */
  it("默认型号是当前这一代", async () => {
    const { providerSpec } = await import("./ai");
    expect(providerSpec("openai").model).toMatch(/^gpt-6/);
    expect(providerSpec("claude").model).toBe("claude-sonnet-5");
    expect(providerSpec("gemini").model).toBe("gemini-3.8-flash");
    expect(providerSpec("deepseek").model).toBe("deepseek-flash");
    expect(providerSpec("zhipu").model).toBe("glm-5.3");
  });
});

/* 报告过的 bug：在 DeepSeek 填的型号会显示到智谱上 —— 三样设置必须按服务商分开存 */
describe("每家服务商的设置互不干扰", () => {
  const memoryStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
    };
  };

  const withStorage = async <T>(fn: () => Promise<T> | T): Promise<T> => {
    const real = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true });
    try {
      return await fn();
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: real, configurable: true });
    }
  };

  it("给 DeepSeek 填的型号和密钥不会跑到智谱上", async () => {
    const { DEFAULT_AI, configOf, modelInUse, keyInUse, baseUrlInUse, withConfig } = await import("./ai");
    let s: AiSettings = { ...DEFAULT_AI, provider: "deepseek" };
    s = withConfig(s, { model: "deepseek-flash", key: "deepseek-key" });

    /* 换到智谱：那一栏是空的，用的是智谱自己的默认 */
    const zhipu: AiSettings = { ...s, provider: "zhipu" };
    expect(configOf(zhipu).model).toBe("");
    expect(modelInUse(zhipu)).toBe("glm-5.3");
    expect(keyInUse(zhipu)).toBe("");
    expect(baseUrlInUse(zhipu)).toBe("https://open.bigmodel.cn/api/paas/v4");

    /* 换回 DeepSeek：原来的填写还在 */
    expect(modelInUse(s)).toBe("deepseek-flash");
    expect(keyInUse(s)).toBe("deepseek-key");
  });

  it("每家可以同时填不同的型号、地址与密钥", async () => {
    const { DEFAULT_AI, modelInUse, keyInUse, withConfig } = await import("./ai");
    let s: AiSettings = DEFAULT_AI;
    s = withConfig({ ...s, provider: "deepseek" }, { model: "deepseek-flash", key: "k1" });
    s = withConfig({ ...s, provider: "zhipu" }, { model: "glm-4v", key: "k2", baseUrl: "https://open.bigmodel.cn/api/paas/v4" });
    s = withConfig({ ...s, provider: "openai" }, { model: "gpt-6-luna", key: "k3" });

    expect(modelInUse({ ...s, provider: "deepseek" })).toBe("deepseek-flash");
    expect(modelInUse({ ...s, provider: "zhipu" })).toBe("glm-4v");
    expect(modelInUse({ ...s, provider: "openai" })).toBe("gpt-6-luna");
    expect(keyInUse({ ...s, provider: "zhipu" })).toBe("k2");
  });

  it("存下来再读回来，每家还是各家自己的", async () => {
    await withStorage(async () => {
      const { DEFAULT_AI, loadAiSettings, modelInUse, keyInUse, saveAiSettings, withConfig } = await import("./ai");
      let s: AiSettings = withConfig({ ...DEFAULT_AI, provider: "deepseek" }, { model: "deepseek-flash", key: "k1" });
      s = withConfig({ ...s, provider: "zhipu" }, { model: "glm-4v", key: "k2" });
      s = { ...s, provider: "deepseek" };
      saveAiSettings(s);

      const back = loadAiSettings();
      expect(back.provider).toBe("deepseek");
      expect(modelInUse(back)).toBe("deepseek-flash");
      expect(keyInUse(back)).toBe("k1");
      expect(modelInUse({ ...back, provider: "zhipu" })).toBe("glm-4v");
      expect(keyInUse({ ...back, provider: "zhipu" })).toBe("k2");
    });
  });

  /* 老版本把三样扁平地存在一起：只能算作"当时选中那一家"的，别家留空最安全 */
  it("老格式读回来记在当前这一家名下，别家不受影响", async () => {
    await withStorage(async () => {
      const { loadAiSettings, modelInUse, keyInUse } = await import("./ai");
      localStorage.setItem("m3e:ai", JSON.stringify({ provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-flash", key: "old-key" }));
      const back = loadAiSettings();
      expect(modelInUse(back)).toBe("deepseek-flash");
      expect(keyInUse(back)).toBe("old-key");
      expect(modelInUse({ ...back, provider: "zhipu" })).toBe("glm-5.3");
      expect(keyInUse({ ...back, provider: "zhipu" })).toBe("");
    });
  });
});
