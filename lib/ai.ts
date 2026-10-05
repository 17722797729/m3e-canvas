import { Doc, Frame, Group, Item, frameOfGroup } from "./tokens";
import { buildPrompt } from "./prompt";
import { isProject, readDoc } from "./project";
import { t, type Lang } from "./i18n";

/* Optional AI helpers. The browser talks to the model provider directly with the
 * author's own key; there is no server in between. Every action has a fixed
 * prompt and a fixed JSON answer shape, and the result is only applied after the
 * author has looked at it. Coordinates are never touched by the model. */

export type Provider = "claude" | "openai" | "gemini" | "deepseek" | "zhipu";

/**
 * 服务商与各自的当前模型
 *
 * `model` 是各家**当前**的主推型号，也是"留空时发哪个"的答案。
 * 模型名由使用者在 AI 设置里填：填了就以他填的为准（一个字符都不改），
 * 留空就落到这里。厂商改名的速度比发版快，所以设置里那一栏默认留白，
 * 想换型号随时填，不必等我们更新这张表。
 *
 * 最近核对（含来源）：
 *   OpenAI   gpt-6 代      https://developers.openai.com/api/docs/guides/latest-model
 *   Claude   5 代无日期 ID  https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions
 *   Gemini   3.8 Flash     https://ai.google.dev/gemini-api/docs/models
 *   DeepSeek V4.1-Flash    https://api-docs.deepseek.com/news/news260910   （模型名是 deepseek-flash）
 *   智谱     GLM-5.3       https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3
 */
export const PROVIDERS: { key: Provider; label: string; baseUrl: string; model: string; keysUrl?: string }[] = [
  { key: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-6.1-sol", keysUrl: "https://platform.openai.com/api-keys" },
  { key: "claude", label: "Claude", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-5", keysUrl: "https://console.anthropic.com/settings/keys" },
  { key: "gemini", label: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash", keysUrl: "https://aistudio.google.com/apikey" },
  { key: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-flash", keysUrl: "https://platform.deepseek.com/api_keys" },
  /* 智谱走 OpenAI 兼容接口，所以只要换 baseUrl 与模型名即可（Bearer 鉴权） */
  { key: "zhipu", label: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.3", keysUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys" },
];

export const providerSpec = (k: Provider) => PROVIDERS.find((p) => p.key === k) ?? PROVIDERS[0];

/**
 * 每一家自己的连接信息
 *
 * 三样（地址、型号、密钥）**按服务商各存一份**：不然在 DeepSeek 填的东西会跑到智谱上，
 * 轻则型号不对，重则把一家的密钥发到另一家的服务器上。
 */
export type ProviderConfig = {
  /** 基础 URL；留空用这一家的默认 */
  baseUrl: string;
  /** 模型 ID；留空用这一家当前的默认 */
  model: string;
  /** API 密钥 */
  key: string;
  /**
   * 关掉模型的"思考"
   *
   * 推理型模型会先把一大段推理写进 `reasoning_content`，正文要等推理结束才出现；
   * 推理把这一次的额度吃光时，正文就是空的（界面上会显示"模型只输出了思考过程"）。
   * 关掉它，正文直接产出 —— 对"照着材料整理成文档"这类任务，思考本来也帮不上多少。
   *
   * 各家的参数名不一样（见 `thinkingField`），所以逐家各存一份。
   */
  noThinking?: boolean;
};

export type AiSettings = {
  /** 当前用哪一家 */
  provider: Provider;
  /** 各家自己的设置 */
  providers: Record<Provider, ProviderConfig>;
};

/** 空设置：每一家都是「留空即默认」 */
const emptyProviders = (): Record<Provider, ProviderConfig> =>
  PROVIDERS.reduce((acc, p) => {
    acc[p.key] = { baseUrl: p.baseUrl, model: "", key: "" };
    return acc;
  }, {} as Record<Provider, ProviderConfig>);

export const DEFAULT_AI: AiSettings = { provider: PROVIDERS[0].key, providers: emptyProviders() };

const STORE_KEY = "m3e:ai";

/** 当前这一家的设置（读） */
export const configOf = (s: AiSettings): ProviderConfig =>
  s.providers[s.provider] ?? { baseUrl: providerSpec(s.provider).baseUrl, model: "", key: "" };

/** 当前这一家的设置（写）；只改这一家，别家的原样保留 */
export function withConfig(s: AiSettings, patch: Partial<ProviderConfig>): AiSettings {
  const now = configOf(s);
  return { ...s, providers: { ...s.providers, [s.provider]: { ...now, ...patch } } };
}

/**
 * 单次输出能给多少 token
 *
 * 按各家自己公布的上限取一个"够用但不会离谱"的数。以前不看这张表，
 * 一律夹到 8192：整份原型的说明根本写不完，推理型模型更是把额度全花在思考上，
 * 于是返回的正文是空的（界面上就是"模型只输出了思考过程"）。
 */
const OUTPUT_CAP: Record<Provider, number> = {
  zhipu: 96000,
  deepseek: 64000,
  openai: 128000,
  gemini: 64000,
  claude: 32000,
};

/** 这一家要不要关掉思考（逐家各存） */
export const noThinkingInUse = (s: AiSettings): boolean => configOf(s).noThinking === true;

/**
 * "关掉思考"在这一家对应的请求字段
 *
 * 各家的名字都不一样，而且**给不支持的模型发这些字段会被拒**，
 * 所以发失败时调用方会去掉它重试一次（见 `postChat`）。
 * Claude 不用发：它的思考是显式开启的，不发就是没开。
 */
const thinkingField = (s: AiSettings): Record<string, unknown> | null => {
  if (!noThinkingInUse(s)) return null;
  switch (s.provider) {
    case "zhipu":
    case "deepseek":
      return { thinking: { type: "disabled" } };
    case "gemini":
      return { thinkingConfig: { thinkingBudget: 0 } };
    case "openai":
      return { reasoning_effort: "minimal" };
    default:
      return null;
  }
};

/** 实际发出去的基础 URL：填了用填的，留空用默认 */
export const baseUrlInUse = (s: AiSettings): string => configOf(s).baseUrl.trim() || providerSpec(s.provider).baseUrl;

/** 这一家当前会用哪个模型：填了用填的，留空用默认 */
export const modelInUse = (s: AiSettings): string => configOf(s).model.trim() || providerSpec(s.provider).model;

/** 这一家的密钥 */
export const keyInUse = (s: AiSettings): string => configOf(s).key;

export function loadAiSettings(): AiSettings {
  const s: AiSettings = { provider: DEFAULT_AI.provider, providers: emptyProviders() };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return s;
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.provider === "string" && PROVIDERS.some((p) => p.key === v.provider)) s.provider = v.provider as Provider;

    if (v.providers && typeof v.providers === "object") {
      /* 现在的形态：逐家读回来，缺哪家就用空设置补上 */
      const saved = v.providers as Record<string, Partial<ProviderConfig>>;
      for (const p of PROVIDERS) {
        const one = saved[p.key];
        if (!one) continue;
        s.providers[p.key] = {
          baseUrl: typeof one.baseUrl === "string" && one.baseUrl.trim() ? one.baseUrl : p.baseUrl,
          model: typeof one.model === "string" ? one.model : "",
          key: typeof one.key === "string" ? one.key : "",
          ...(one.noThinking === true ? { noThinking: true } : {}),
        };
      }
      return s;
    }

    /* 老形态：三样是扁平的、全服务商共用。全部记到当时选中的那一家名下，
       别家的留空 —— 那份密钥多半也只属于它。 */
    const one = s.providers[s.provider];
    if (typeof v.baseUrl === "string" && v.baseUrl.trim()) one.baseUrl = v.baseUrl;
    if (typeof v.model === "string" && v.model.trim()) one.model = v.model;
    if (typeof v.key === "string") one.key = v.key;
  } catch {}
  return s;
}

/** 「留空即默认」意味着不能因为没填型号就把 AI 判成不可用 */
export const aiConfigured = (s: AiSettings): boolean => hasKey(s) && isSecureUrl(baseUrlInUse(s));

/** Settings live in this browser only, like the document itself. */
export function saveAiSettings(s: AiSettings) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {}
}

const isLocal = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(u.trim());

/** a hosted endpoint needs a key; a server on this machine may run without one */
export const hasKey = (s: AiSettings) => keyInUse(s).trim().length > 0 || isLocal(baseUrlInUse(s));

/** the key must not travel over plain http, except to this machine */
export const isSecureUrl = (u: string) => /^https:\/\//i.test(u.trim()) || isLocal(u);

const trimSlash = (u: string) => u.trim().replace(/\/+$/, "");

async function readError(res: Response): Promise<string> {
  let detail = "";
  try {
    const j = await res.json();
    detail = j?.error?.message ?? j?.message ?? JSON.stringify(j);
  } catch {
    try {
      detail = await res.text();
    } catch {}
  }
  return `${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 300)}` : ""}`;
}

/**
 * 一条对话消息
 *
 * `content` 在只有文字时就是字符串；带附件（图片）时是内容块数组，
 * 与 OpenAI 的 `messages[].content` 形状一致 —— 智谱、DeepSeek、Gemini 的兼容层都认这个。
 */
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
};

export type ChatContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** 把「历史 + 这一轮」拼成消息数组；用户只给文字时不必构造内容块 */
export const userMessage = (text: string, images: string[] = []): ChatMessage =>
  images.length === 0
    ? { role: "user", content: text }
    : {
        role: "user",
        content: [
          ...(text.trim() ? [{ type: "text" as const, text }] : []),
          ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
        ],
      };

/** one round trip: a system prompt and a user message in, the model's text out */
export async function complete(
  s: AiSettings,
  system: string,
  user: string,
  signal?: AbortSignal,
  maxTokens = 4096,
  opts?: { allowTruncated?: boolean; onTruncated?: () => void },
): Promise<string> {
  return completeChat(s, system, [{ role: "user", content: user }], signal, maxTokens, opts);
}

/**
 * 一轮多轮对话：system + 完整历史进，模型这一次的文本出
 *
 * 与 `complete` 共用同一套请求构造，差别只在消息数组 ——
 * 「让 AI 画」的对话面板靠它把之前几轮一起发上去。
 */
export async function completeChat(
  s: AiSettings,
  system: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
  maxTokens = 4096,
  /**
   * `allowTruncated`：模型写到上限被截断时，**把已经写出来的部分返回**，而不是抛错。
   * 长文档（整份原型的说明）一次很容易超上限，这时前半段仍然有用；
   * 抛错的话用户什么也拿不到 —— 之前界面上的"long"就是这么来的。
   */
  opts?: { allowTruncated?: boolean; onTruncated?: () => void },
): Promise<string> {
  const truncated = (text: string): string => {
    /* 一个字都没有就是没结果，无论允不允许截断 */
    if (!text.trim()) throw new Error("empty");
    /* 真的被截断了要说一声 —— 让调用方自己标"这是前半段"，
       别去猜正文结尾（猜不准：正常写完的一段也可能不以句号收尾） */
    opts?.onTruncated?.();
    if (opts?.allowTruncated) return text;
    throw new Error("long");
  };
  const base = trimSlash(baseUrlInUse(s));
  /* 型号留空就用这一家当前的默认：设置里写的是"你要用哪个"，不写就跟着默认走 */
  const model = modelInUse(s);
  const key = keyInUse(s).trim();
  if (!model) throw new Error("model");
  if (!isSecureUrl(base)) throw new Error("insecure");
  if (s.provider === "claude") {
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model, max_tokens: Math.min(maxTokens, 8192), system, messages }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const j = await res.json();
    if (j.stop_reason === "refusal") throw new Error("refusal");
    /* 只取 text 块：带思考的模型还会给 thinking 块，那不是正文 */
    const text = (j.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
    if (j.stop_reason === "max_tokens") return truncated(text);
    if (!text && (j.content ?? []).some((b: { type: string }) => b.type === "thinking")) throw new Error("reasoning");
    return text;
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  /* OpenAI 的新模型拒收 `max_tokens`（自己按需给），其余 OpenAI 兼容端点收。
     上限按各家自己报的量级给 —— 原来一律夹到 8192，长文档会被硬生生截断
     （推理型模型光思考就吃光这 8192，正文一个字都不剩）。 */
  const budget = s.provider === "openai" ? null : Math.min(maxTokens, OUTPUT_CAP[s.provider] ?? 8192);
  const payload: Record<string, unknown> = {
    model,
    ...(budget ? { max_tokens: budget } : {}),
    messages: [{ role: "system", content: system }, ...messages],
  };
  const off = thinkingField(s);
  const post = (extra: Record<string, unknown> | null) =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify(extra ? { ...payload, ...extra } : payload),
    });
  let res = await post(off);
  /* 这一家/这个模型不认"关掉思考"那个字段时，去掉它重试一次 —— 开关不该把请求弄坏 */
  if (!res.ok && off) res = await post(null);
  if (!res.ok) throw new Error(await readError(res));
  const j = await res.json();
  const got = readCompletion(j);
  if (got.text) return got.truncated ? truncated(got.text) : got.text;
  /* 正文是空的：如果它其实写了思考过程，那就是额度被思考吃光了 —— 说清楚 */
  if (got.reasoning) throw new Error("reasoning");
  throw new Error("empty");
}

/**
 * 从一家的返回里把正文挖出来
 *
 * 各家形状不一，而且**推理型模型**会把输出放进 `reasoning_content`：
 * 额度被思考用光时 `content` 就是空的。只看 `content` 的话，
 * 这种情况会被误判成"无法解析模型的回复" —— 用户根本不知道发生了什么。
 *
 * 返回正文、思考过程，以及是否被截断。
 */
function readCompletion(j: Record<string, unknown>): { text: string; reasoning: string; truncated: boolean } {
  /* 有的服务商把错误塞在 200 的响应体里 */
  if (j.error) {
    const e = j.error as { message?: string; code?: string };
    throw new Error(e.message ?? e.code ?? "error");
  }
  const choice = (Array.isArray(j.choices) ? j.choices[0] : undefined) as
    | { finish_reason?: string; text?: string; message?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown } }
    | undefined;
  /* 兼容：新版 message.content 与旧的顶层 text 两种写法 */
  const raw = choice?.message?.content ?? choice?.text ?? (j.output_text as unknown);
  const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((x: { text?: string }) => (x && x.text) || "").join("") : "";
  const r = choice?.message?.reasoning_content ?? choice?.message?.reasoning;
  const reasoning = typeof r === "string" ? r : "";
  return { text, reasoning, truncated: choice?.finish_reason === "length" || j.stop_reason === "max_tokens" };
}

/**
 * 请求失败时给用户看的那句话
 *
 * `completeChat` 抛的是**短码**（refusal / long / empty / model / insecure…），
 * 直接显示出来就是"long"这种看不懂的东西 —— 之前"AI 总结"只返回 long 就是这个原因。
 * 集中在这里映射一次，两个面板共用。
 */
export function aiErrorText(e: unknown, lang: Lang): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m === "refusal") return t("aiErrorRefusal", lang);
  if (m === "long") return t("aiErrorLong", lang);
  if (m === "empty") return t("aiErrorEmpty", lang);
  if (m === "reasoning") return t("aiErrorReasoning", lang);
  if (m === "json") return t("aiErrorJson", lang);
  if (m === "model") return t("aiErrorModel", lang);
  if (m === "insecure") return t("aiErrorInsecure", lang);
  if (/failed to fetch|networkerror|load failed/i.test(m)) return t("aiErrorNetwork", lang);
  return `${t("aiError", lang)}: ${m}`;
}

/** the first JSON object in a reply, with any code fence stripped */
function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("json");
  const v = JSON.parse(cleaned.slice(a, b + 1));
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("json");
  return v as Record<string, unknown>;
}

/* ---------- actions ---------- */

const LANG_NAME: Record<Lang, string> = { ja: "Japanese", en: "English", zh: "Simplified Chinese", ko: "Korean" };

const hasText = (v?: string | null) => !!v && v.trim().length > 0;

const itemsOnFrame = (doc: Doc, frame: Frame, widths: Record<string, number>): Item[] =>
  doc.groups.filter((g: Group) => frameOfGroup(g, doc.frames, widths)?.id === frame.id).flatMap((g) => g.items);

const describeItem = (it: Item) => {
  const bits = [`id=${it.id}`, `kind=${it.kind}`];
  if (hasText(it.label)) bits.push(`label=${JSON.stringify(it.label)}`);
  if (hasText(it.supporting)) bits.push(`supporting=${JSON.stringify(it.supporting)}`);
  if (it.icon) bits.push(`icon=${it.icon}`);
  if (it.tabs?.length) bits.push(`items=${JSON.stringify(it.tabs.map((t) => t.label || t.icon))}`);
  if (it.action) bits.push(`tap=${it.action.to}`);
  if (it.toggle) bits.push("toggle");
  if (hasText(it.note)) bits.push(`current_note=${JSON.stringify(it.note)}`);
  return bits.join(" ");
};

const context = (doc: Doc, widths: Record<string, number>, frame: Frame, lang: Lang) =>
  [
    "The author is sketching a Material 3 Expressive app. Below is the generated description of the whole design, then the screen to work on.",
    "",
    "=== Whole design ===",
    buildPrompt(doc, widths, undefined, lang),
    "",
    `=== Screen to work on: ${JSON.stringify(frame.name || "(unnamed)")} ===`,
  ].join("\n");

const SYSTEM = "You help an app designer finish a sketch. Answer with a single JSON object and nothing else: no prose, no markdown fence.";

/** picks the strings the model returned for exactly the parts asked about */
function pickStrings(v: unknown, parts: Item[], max: number): Record<string, string> {
  const map = (v ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const it of parts) {
    const s = map[it.id];
    if (typeof s === "string" && s.trim()) out[it.id] = s.trim().slice(0, max);
  }
  return out;
}

/** a short behavior note for one part; an existing note is refined rather than replaced */
export async function proposeBehavior(s: AiSettings, doc: Doc, widths: Record<string, number>, frame: Frame, lang: Lang, itemId: string, signal?: AbortSignal): Promise<string | undefined> {
  const parts = itemsOnFrame(doc, frame, widths).filter((it) => it.id === itemId);
  if (!parts.length) return undefined;
  const user = [
    context(doc, widths, frame, lang),
    "",
    "For the part listed below, write what happens when the user interacts with it: what it does, where it leads, what it shows. One sentence, concrete, in the voice of a product spec (no 'should', no hedging). Infer from the labels, icons and the other screens; do not invent screens that do not exist.",
    "A part with a current_note already has the author's own wording: keep its intent and facts, and improve it (clearer, more specific, consistent with the rest of the screen). Do not contradict it.",
    `Write in ${LANG_NAME[lang]}.`,
    "",
    "Part:",
    describeItem(parts[0]),
    "",
    'Answer as {"notes": {"<id>": "<sentence>"}} using exactly the id above.',
  ].join("\n");
  const j = parseJsonObject(await complete(s, SYSTEM, user, signal));
  return pickStrings(j.notes, parts, 300)[itemId];
}

/** a name (only when the screen has none) and a one-line purpose for the screen; an existing description is refined */
export async function proposeDescription(s: AiSettings, doc: Doc, widths: Record<string, number>, frame: Frame, lang: Lang, signal?: AbortSignal): Promise<{ name?: string; note: string }> {
  const user = [
    context(doc, widths, frame, lang),
    "",
    "Describe this screen's purpose in one or two sentences: who opens it, what they see and what they can do here. Also propose a short screen name (one to three words).",
    hasText(frame.note) ? `The author's current description is ${JSON.stringify(frame.note)}: keep its intent and facts, and improve it.` : "",
    `Write in ${LANG_NAME[lang]}.`,
    "",
    'Answer as {"name": "<name>", "description": "<sentences>"}.',
  ]
    .filter((l) => l !== "")
    .join("\n");
  const j = parseJsonObject(await complete(s, SYSTEM, user, signal));
  const note = typeof j.description === "string" ? j.description.trim().slice(0, 400) : "";
  if (!note) throw new Error("json");
  const name = typeof j.name === "string" ? j.name.trim().slice(0, 40) : "";
  return { name: !hasText(frame.name) && name ? name : undefined, note };
}

/** the value a rewritten field had before, so the rewrite can be undone; an empty field leaves nothing to go back to */
export const pushHistory = (history: string[] | undefined, replaced: string | undefined): string[] | undefined => {
  const cur = (replaced ?? "").trim();
  return cur ? [cur] : history?.length ? history : undefined;
};

/** the patch that swaps a field with what it said before the AI wrote it; pressing again swaps back */
export function popHistory<V extends string, H extends string>(current: string | undefined, history: string[] | undefined, valueKey: V, historyKey: H): Record<V, string> & Record<H, string[] | undefined> {
  const [prev] = history ?? [];
  const cur = (current ?? "").trim();
  return { [valueKey]: prev ?? "", [historyKey]: cur ? [cur] : undefined } as Record<V, string> & Record<H, string[] | undefined>;
}

/** A whole design from an idea, drafted by the author's own model. `guide` is the same
 *  agent guide a coding agent reads (public/agent.md), so both paths follow one spec.
 *  The answer is the document itself; a link would be pointless here. */
export async function draftDesign(s: AiSettings, guide: string, idea: string, lang: Lang, signal?: AbortSignal): Promise<Doc> {
  const system = [
    "You draft M3E Canvas designs. Follow the guide below exactly.",
    "Reply with the JSON document only: no share link, no prose, no markdown fence, no explanation.",
    "",
    guide,
  ].join("\n");
  const user = [`Sketch this app: ${idea.trim()}`, `Write every label, title and note in ${LANG_NAME[lang]}.`, "Three to five screens. Keep it simple."].join("\n");
  const j = parseJsonObject(await complete(s, system, user, signal, 12000));
  const doc = readDoc(j);
  if (!doc) throw new Error("json");
  return doc;
}


/* ---------- 让 AI 画：对话式 Agent ---------- */

/** 面板里的一条消息；`design` 是这一轮带回的一整份设计 */
export type ChatTurn = {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  /** 用户这一轮带上的附件（图片显示缩略图，项目文件只记名字） */
  attachments?: ChatAttachment[];
  /** 助手带回的设计；面板据此显示「已放到画布」 */
  design?: Doc;
};

export type ChatAttachment = {
  name: string;
  kind: "image" | "project";
  /** 图片是 data URL；项目文件不带，直接用它的 JSON */
  dataUrl?: string;
};

/** 一轮里模型给的东西：一段话，外加（可选的）一份设计 */
export type ChatReply = { text: string; design?: Doc };

/** 一份设计在对话里这样交给画布：模型把文档包在 ```json 里，人只看到前面那段话 */
const DESIGN_FENCE = /```(?:json|m3e)\s*\n([\s\S]*?)```/i;

/**
 * 从模型的回答里分出「话」和「设计」
 *
 * 约定两条路都认：
 *   1. 回答里带一个 ```json 代码块，且内容是一份合法的设计 —— 那就是要画的东西；
 *   2. 整段就是一个 JSON 对象 —— 也算（有些模型不爱加围栏）。
 * 除此外就是普通回话（追问、说明、拒绝），不碰画布。
 */
export function readReply(raw: string): ChatReply {
  const text = (raw ?? "").trim();
  if (!text) throw new Error("empty");

  const fenced = DESIGN_FENCE.exec(text);
  if (fenced) {
    const design = tryDesign(fenced[1]);
    /* 围栏里的东西不是设计：那它就是段普通代码，整段当回话 */
    if (design) return { text: text.replace(fenced[0], "").trim(), design };
  }
  const whole = tryDesign(text);
  if (whole) return { text: "", design: whole };
  return { text };
}

/** 解析一份设计；不是合法设计就返回 undefined，不抛 */
export function tryDesign(json: string): Doc | undefined {
  try {
    const value: unknown = JSON.parse(json);
    return readDoc(value) ?? undefined;
  } catch {
    return undefined;
  }
}

/** agent.md 是「怎么画」的说明书：整段给模型读，所以只取前这么多字符，别把上下文撑爆 */
const GUIDE_LIMIT = 24000;

/**
 * 让 AI 画：把整段对话交给模型，它要么接着聊，要么直接画一份设计出来
 *
 * 与旧的一条龙 `draftDesign` 的区别：这里是**多轮**的 ——
 * 作者的每一句话、模型的每一次回答、路上传的文件都在历史里，
 * 所以「再改一下」「第三个屏幕去掉」这种追问才接得上。
 */
export async function draftInConversation(
  s: AiSettings,
  guide: string,
  turns: ChatTurn[],
  lang: Lang,
  signal?: AbortSignal,
): Promise<ChatReply> {
  const system = [
    "你是 M3E Canvas 里的设计助手。M3E Canvas 是画 Material 3 Expressive 界面的草图工具。",
    "",
    "两种回答方式，按情况选一种：",
    "1. 需要澄清、或者只是回答问题：直接用一两句话回答，不要画。",
    "2. 要出图/改图：先写一两句说明你改了什么，然后给一个 ```json 代码块，里面是完整的画布文档。",
    "   文档必须是完整的（不是补丁）：一次给全，作者会整份替换。",
    "   不要输出分享链接，不要在代码块外再写文档。",
    "",
    `所有标签、标题、说明都用${LANG_NAME[lang]}书写。`,
    "",
    "=== 画布规格（必须遵守）===",
    guide.slice(0, GUIDE_LIMIT),
  ].join("\n");

  const messages: ChatMessage[] = turns
    .filter((t) => t.role !== "error" && (t.text.trim() || t.attachments?.length))
    .map((t) => {
      const images = (t.attachments ?? []).filter((a) => a.kind === "image" && a.dataUrl).map((a) => a.dataUrl as string);
      const files = (t.attachments ?? []).filter((a) => a.kind === "project").map((a) => a.name);
      const note = files.length ? `${t.text}${t.text ? "\n\n" : ""}[附带了画布文件：${files.join("、")}]` : t.text;
      return t.role === "user" ? userMessage(note, images) : { role: "assistant" as const, content: note };
    });

  if (messages.length === 0) throw new Error("empty");
  /* 文档可以很长，给足预算；别的路径仍然是 4096 */
  return readReply(await completeChat(s, system, messages, signal, 16000));
}

/** 把上传的图片读成 data URL，好当附件发给模型 */
export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("file"));
    reader.readAsDataURL(file);
  });
}

/** 一份设计里最容易看出「这是不是本工具的文档」的几个字段 */
export const looksLikeProject = (value: unknown): boolean => isProject(value);

/** 附件大小上限：图片当 base64 发，太大又慢又贵；画布文件本来就是文本 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
