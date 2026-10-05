"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDocs, outlineNumbers, type DocBlock } from "@/lib/docs";
import { Doc, DEFAULT_PALETTE_KEY, DEFAULT_THEME, Theme, paletteOf, sizeOf, type Palette } from "@/lib/tokens";
import { loadAppTheme } from "@/lib/appTheme";
import { useSystemTheme } from "@/lib/theme";
import { readDoc as readStoredDoc } from "@/lib/project";
import { LangContext, isLang, setGlobalLang, t, type Lang } from "@/lib/i18n";
import { goToEditor } from "@/lib/appPath";
import { Icon } from "@/components/M3Node";
import { complete, aiConfigured, aiErrorText, loadAiSettings, modelInUse, saveAiSettings, withConfig, type AiSettings } from "@/lib/ai";
import {
  BUILTIN_SKILLS,
  Skill,
  fetchSkill,
  loadActiveSkillId,
  loadSkills,
  isBuiltinSkill,
  isEdited,
  parseSkillSource,
  resetSkill,
  saveSkill,
  saveActiveSkillId,
  saveSkills,
  summaryPrompt,
} from "@/lib/skills";

/* 策划文档：这份画布有哪些功能系统、每屏能怎么操作、格子几行几列。
 *
 * 内容由 `lib/docs.ts` 从画布里读出来；右上角的 skill 决定按哪几节、以什么标题输出。 */

function initialLanguage(): Lang {
  try {
    const ui = JSON.parse(localStorage.getItem("m3e:ui") ?? "null");
    if (isLang(ui?.lang)) return ui.lang;
  } catch {}
  const language = (navigator.language ?? "").toLowerCase();
  return language.startsWith("zh") ? "zh" : language.startsWith("ko") ? "ko" : language.startsWith("ja") ? "ja" : "en";
}

function readDoc(): Doc | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("m3e:doc") ?? "null");
    /* 读回来的文档先过归一化：超范围的倒计时收进 120，而不是把整份文档丢掉 */
    return readStoredDoc(value);
  } catch {
    return null;
  }
}

export default function DocsPage() {
  const [lang, setLang] = useState<Lang | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  /** 主题是应用级的：这一页的配色按 `m3e:theme` 算，不看 doc.theme */
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [skills, setSkills] = useState<Skill[]>(BUILTIN_SKILLS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** AI 总结：机器读出来的事实 → 模型按 skill 写成文档 */
  const [ai, setAi] = useState<AiSettings | null>(null);
  /** 正在编辑的那一条（null = 没在编辑） */
  const [editing, setEditing] = useState<Skill | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  /** 模型写到上限被截断了（前半段仍然显示出来了） */
  const [aiTruncated, setAiTruncated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initial = initialLanguage();
    document.documentElement.lang = initial;
    setGlobalLang(initial);
    setLang(initial);
    setDoc(readDoc());
    setTheme(loadAppTheme(window.localStorage));
    setSkills(loadSkills(window.localStorage));
    /* 只有一条 skill（作者给的模板），第一次打开就默认用它 */
    const stored = loadActiveSkillId(window.localStorage);
    const all = loadSkills(window.localStorage);
    const first = stored && all.some((x) => x.id === stored) ? stored : (all[0]?.id ?? null);
    setActiveId(first);
    if (first !== stored) saveActiveSkillId(window.localStorage, first);
    setAi(loadAiSettings());
  }, []);

  const ui: Lang = lang ?? "en";
  /* 深浅色模式：开了 bothModes 时上屏的深浅跟系统走（lib/systemTheme.ts） */
  const shownTheme = useSystemTheme(theme);
  const p: Palette = useMemo(() => paletteOf(doc?.paletteKey ?? DEFAULT_PALETTE_KEY, doc?.customPalette ?? null, shownTheme), [doc?.paletteKey, doc?.customPalette, shownTheme]);
  const widths = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of doc?.frames ?? []) out[f.id] = f.w ?? 412;
    return out;
  }, [doc?.frames]);
  const active = skills.find((s) => s.id === activeId) ?? null;
  const docs = useMemo(() => buildDocs(doc, ui, active, widths), [doc, ui, active, widths]);

  const install = useCallback(
    (skill: Skill) => {
      const next = [...loadSkills(window.localStorage).filter((s) => s.id !== skill.id), { ...skill, installedAt: Date.now() }];
      setSkills(next);
      saveSkills(window.localStorage, next);
      setActiveId(skill.id);
      saveActiveSkillId(window.localStorage, skill.id);
      setNote(t("skillInstalled", ui).replace("{name}", skill.name));
    },
    [ui],
  );

  const remove = (skill: Skill) => {
    const next = loadSkills(window.localStorage).filter((s) => s.id !== skill.id);
    setSkills(next);
    saveSkills(window.localStorage, next);
    if (activeId === skill.id) {
      setActiveId(null);
      saveActiveSkillId(window.localStorage, null);
    }
  };

  const installFromUrl = async (target: string) => {
    setBusy(true);
    setNote(null);
    const res = await fetchSkill(target.trim());
    setBusy(false);
    if ("error" in res) {
      setNote(`${t("skillFetchFailed", ui)}（${res.error}）`);
      return;
    }
    install(res);
  };

  /**
   * AI 总结
   *
   * 把机器已经从原型里读出来的事实交给模型，让模型**按 skill 的规范**写成文档。
   * 事实是素材、skill 是规矩 —— 所以模型不会瞎编，也换不了形态。
   */
  const runSummary = async () => {
    setAiError(null);
    const settings = ai ?? loadAiSettings();
    setAi(settings);
    if (!aiConfigured(settings)) {
      setAiError(t("aiNoKey", ui));
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setAiBusy(true);
    setSummary(null);
    setAiTruncated(false);
    try {
      const { system, user } = summaryPrompt(active, docs.markdown, ui, doc?.title?.trim() || t("canvasUntitled", ui));
      /* 整份原型的说明很容易超过模型的单次上限：给足额度，并且**允许截断** ——
         写到一半也比什么都拿不到好。真的被截断了在下面标一句。 */
      const text = await complete(settings, system, user, ac.signal, 32000, { allowTruncated: true, onTruncated: () => setAiTruncated(true) });
      setSummary(text.trim());
    } catch (err) {
      /* 错误码（long/refusal/empty…）要翻成人话，别把 short code 直接丢给用户 */
      if (!ac.signal.aborted) setAiError(aiErrorText(err, ui));
    } finally {
      setAiBusy(false);
    }
  };

  const download = () => {
    const url2 = URL.createObjectURL(new Blob([docs.markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url2;
    a.download = "m3e-docs.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url2), 0);
  };

  if (lang === null) return <div style={{ minHeight: "100vh", background: p.surface }} />;

  const chips = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        className="m3-press"
        onClick={() => setPickerOpen((v) => !v)}
        style={{
          height: 40,
          padding: "0 16px",
          borderRadius: 20,
          border: `1px solid ${active ? p.primary : p.outline}`,
          background: active ? p.secondaryContainer : "transparent",
          color: active ? p.onSecondaryContainer : p.primary,
          font: "500 14px Roboto, system-ui, sans-serif",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="extension" size={18} />
        {t("skill", ui)}
        {active ? ` · ${active.name}` : ""}
        <Icon name={pickerOpen ? "expand_less" : "expand_more"} size={18} />
      </button>
    </div>
  );

  return (
    <LangContext.Provider value={ui}>
      <div style={{ minHeight: "100vh", background: p.surface, color: p.onSurface, fontFamily: "Roboto, system-ui, sans-serif" }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 3,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 20px",
            background: p.surfaceContainerLow,
            borderBottom: `1px solid ${p.outlineVariant}`,
            flexWrap: "wrap",
          }}
        >
          <Icon name="menu_book" size={22} />
          <div style={{ flex: 1, minWidth: 160, font: "500 20px Roboto, system-ui, sans-serif" }}>{docs.title}</div>
          {chips}
          {/* 关掉思考：推理型模型光思考就能把额度吃光，正文一个字都不剩 */}
          <label
            title={t("aiNoThinkingHint", ui)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", borderRadius: 20, border: `1px solid ${p.outline}`, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={ai?.providers?.[ai.provider]?.noThinking === true}
              onChange={(e) => {
                const cur = ai ?? loadAiSettings();
                const next = withConfig(cur, { noThinking: e.target.checked });
                setAi(next);
                saveAiSettings(next);
              }}
            />
            <span style={{ font: "400 13px Roboto, system-ui, sans-serif", color: p.onSurface }}>{t("aiNoThinking", ui)}</span>
          </label>
          {/* AI 总结：把机器读出来的事实交给模型，按 skill 的规范写成文档 */}
          <button
            className="m3-press"
            onClick={() => void runSummary()}
            disabled={aiBusy}
            title={ai ? `${t("docAiSummary", ui)} · ${modelInUse(ai)}` : t("docAiSummary", ui)}
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 20,
              border: "none",
              background: aiBusy ? p.surfaceContainerHighest : p.secondaryContainer,
              color: aiBusy ? p.onSurfaceVariant : p.onSecondaryContainer,
              font: "500 14px Roboto, system-ui, sans-serif",
              cursor: aiBusy ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className={aiBusy ? "m3-spin" : undefined} style={{ display: "inline-flex" }}>
              <Icon name={aiBusy ? "progress_activity" : "auto_awesome"} size={18} />
            </span>
            {aiBusy ? t("docAiSummarising", ui) : t("docAiSummary", ui)}
          </button>
          <button
            className="m3-press"
            onClick={() => goToEditor()}
            style={{ height: 40, padding: "0 18px", borderRadius: 20, border: `1px solid ${p.outline}`, background: "transparent", color: p.primary, font: "500 14px Roboto, system-ui, sans-serif", cursor: "pointer" }}
          >
            {t("docBackToEditor", ui)}
          </button>
          <button
            className="m3-press"
            onClick={download}
            style={{ height: 40, padding: "0 18px", borderRadius: 20, border: "none", background: p.primary, color: p.onPrimary, font: "500 14px Roboto, system-ui, sans-serif", cursor: "pointer" }}
          >
            {t("docDownload", ui)}
          </button>
        </header>

        {pickerOpen && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 20px 0" }}>
            <div style={{ padding: 16, borderRadius: 20, background: p.surfaceContainerLow, border: `1px solid ${p.outlineVariant}`, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="extension" size={18} />
                <span style={{ font: "500 15px Roboto, system-ui, sans-serif", flex: 1 }}>{t("skillTitle", ui)}</span>
                <span style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>{t("skillHint", ui)}</span>
              </div>

              {/* 已装/自带：点一下就切过去 */}
              <div style={{ display: "grid", gap: 8 }}>
                {skills.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: s.id === activeId ? p.secondaryContainer : p.surfaceContainerHigh }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "500 14px Roboto, system-ui, sans-serif" }}>
                        {s.name}
                        {s.version ? <span style={{ color: p.onSurfaceVariant, fontWeight: 400 }}> · v{s.version}</span> : null}
                        {s.builtin ? <span style={{ color: p.onSurfaceVariant, fontWeight: 400 }}> · {t("skillBuiltin", ui)}</span> : null}
                      </div>
                      {s.description && <div style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, marginTop: 2 }}>{s.description}</div>}
                    </div>
                    <button
                      className="m3-press"
                      onClick={() => {
                        const next = s.id === activeId ? null : s.id;
                        setActiveId(next);
                        saveActiveSkillId(window.localStorage, next);
                      }}
                      style={{ height: 34, padding: "0 14px", borderRadius: 17, border: "none", background: s.id === activeId ? p.primary : p.surfaceContainerHighest, color: s.id === activeId ? p.onPrimary : p.onSurface, font: "500 12px Roboto, system-ui, sans-serif", cursor: "pointer" }}
                    >
                      {s.id === activeId ? t("skillInUse", ui) : t("skillUse", ui)}
                    </button>
                    {/* 编辑：内置的也能改，改的是一份本机覆盖，原件随时可恢复 */}
                    <button
                      className="m3-press"
                      onClick={() => setEditing(editing?.id === s.id ? null : { ...s })}
                      aria-label={t("skillEdit", ui)}
                      title={t("skillEdit", ui)}
                      style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: p.surfaceContainerHighest, color: p.onSurface, cursor: "pointer", display: "grid", placeItems: "center" }}
                    >
                      <Icon name={editing?.id === s.id ? "expand_less" : "edit"} size={16} />
                    </button>
                    {!isBuiltinSkill(s) && (
                      <button
                        className="m3-press"
                        onClick={() => remove(s)}
                        aria-label={t("skillRemove", ui)}
                        title={t("skillRemove", ui)}
                        style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: p.errorContainer, color: p.onErrorContainer, cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    )}
                    {isBuiltinSkill(s) && isEdited(s) && (
                      <button
                        className="m3-press"
                        onClick={() => {
                          setSkills(resetSkill(window.localStorage, s.id));
                          if (editing?.id === s.id) setEditing(null);
                          setNote(t("skillReset", ui).replace("{name}", s.name));
                        }}
                        title={t("skillRestore", ui)}
                        style={{ height: 34, padding: "0 12px", borderRadius: 17, border: "none", background: p.surfaceContainerHighest, color: p.onSurface, font: "500 12px Roboto, system-ui, sans-serif", cursor: "pointer" }}
                      >
                        {t("skillRestore", ui)}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {editing && (
                <div style={{ display: "grid", gap: 10, padding: 12, borderRadius: 14, border: `1px solid ${p.primary}`, background: p.surfaceContainerHigh }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="edit" size={16} />
                    <span style={{ font: "500 14px Roboto, system-ui, sans-serif", flex: 1 }}>{t("skillEdit", ui)}</span>
                    <span style={{ font: "400 11px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>
                      {isBuiltinSkill(editing) ? t("skillEditBuiltinHint", ui) : ""}
                    </span>
                  </div>
                  {(
                    [
                      { key: "name" as const, label: t("skillFieldName", ui) },
                      { key: "description" as const, label: t("skillFieldDesc", ui) },
                    ] as const
                  ).map((f) => (
                    <label key={f.key} style={{ display: "grid", gap: 4 }}>
                      <span style={{ font: "500 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>{f.label}</span>
                      <input
                        value={(editing[f.key] as string | undefined) ?? ""}
                        onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                        style={{ height: 38, padding: "0 12px", borderRadius: 10, border: `1px solid ${p.outline}`, background: p.surface, color: p.onSurface, font: "400 13px Roboto, system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                      />
                    </label>
                  ))}

                  {/* 写作规范：AI 总结时发给模型的 system */}
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ font: "500 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>{t("skillFieldInstructions", ui)}</span>
                    <textarea
                      value={editing.instructions ?? ""}
                      onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
                      rows={10}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${p.outline}`, background: p.surface, color: p.onSurface, font: "400 12px/1.6 ui-monospace, monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                    />
                    <span style={{ font: "400 11px Roboto, system-ui, sans-serif", color: p.outline }}>{t("skillFieldInstructionsHint", ui)}</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={editing.rewrite === true} onChange={(e) => setEditing({ ...editing, rewrite: e.target.checked })} />
                    <span style={{ font: "400 12px Roboto, system-ui, sans-serif" }}>{t("skillFieldRewrite", ui)}</span>
                  </label>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      className="m3-press"
                      onClick={() => setEditing(null)}
                      style={{ height: 36, padding: "0 16px", borderRadius: 18, border: `1px solid ${p.outline}`, background: "transparent", color: p.primary, font: "500 13px Roboto, system-ui, sans-serif", cursor: "pointer" }}
                    >
                      {t("cancel", ui)}
                    </button>
                    <button
                      className="m3-press"
                      disabled={!((editing.name ?? "").trim())}
                      onClick={() => {
                        const saved: Skill = { ...editing, name: (editing.name ?? "").trim() || t("skill", ui) };
                        setSkills(saveSkill(window.localStorage, saved));
                        setEditing(null);
                        setNote(t("skillSaved", ui).replace("{name}", saved.name));
                      }}
                      style={{ height: 36, padding: "0 18px", borderRadius: 18, border: "none", background: p.primary, color: p.onPrimary, font: "500 13px Roboto, system-ui, sans-serif", cursor: "pointer", opacity: (editing.name ?? "").trim() ? 1 : 0.6 }}
                    >
                      {t("skillSave", ui)}
                    </button>
                  </div>
                </div>
              )}

              {/* 从网址安装 */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ font: "500 13px Roboto, system-ui, sans-serif" }}>{t("skillInstallUrl", ui)}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/skill.json"
                    style={{ flex: 1, minWidth: 220, height: 40, padding: "0 14px", borderRadius: 12, border: `1px solid ${p.outline}`, background: p.surface, color: p.onSurface, font: "400 13px Roboto, system-ui, sans-serif", outline: "none" }}
                  />
                  <button
                    className="m3-press"
                    disabled={busy || !url.trim()}
                    onClick={() => void installFromUrl(url)}
                    style={{ height: 40, padding: "0 16px", borderRadius: 20, border: "none", background: p.primary, color: p.onPrimary, font: "500 13px Roboto, system-ui, sans-serif", cursor: busy || !url.trim() ? "default" : "pointer", opacity: busy || !url.trim() ? 0.6 : 1 }}
                  >
                    {busy ? t("skillFetching", ui) : t("skillInstall", ui)}
                  </button>
                  <button
                    className="m3-press"
                    onClick={() => setPasteOpen((v) => !v)}
                    style={{ height: 40, padding: "0 16px", borderRadius: 20, border: `1px solid ${p.outline}`, background: "transparent", color: p.primary, font: "500 13px Roboto, system-ui, sans-serif", cursor: "pointer" }}
                  >
                    {t("skillPaste", ui)}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json,.md,text/markdown,.txt,text/plain"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      void f.text().then((text) => {
                        const skill = parseSkillSource(text, f.name);
                        if (skill) install(skill);
                        else setNote(t("skillFetchFailed", ui));
                      });
                    }}
                    style={{ display: "none" }}
                  />
                  <button
                    className="m3-press"
                    onClick={() => fileRef.current?.click()}
                    style={{ height: 40, padding: "0 16px", borderRadius: 20, border: `1px solid ${p.outline}`, background: "transparent", color: p.primary, font: "500 13px Roboto, system-ui, sans-serif", cursor: "pointer" }}
                  >
                    {t("skillFromFile", ui)}
                  </button>
                </div>
                {pasteOpen && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <textarea
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                      placeholder='{"id":"my-skill","name":"我的规范","sections":["systems","flows"]}'
                      rows={5}
                      style={{ width: "100%", padding: 12, borderRadius: 12, border: `1px solid ${p.outline}`, background: p.surface, color: p.onSurface, font: "400 12px ui-monospace, monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                    />
                    <button
                      className="m3-press"
                      onClick={() => {
                        const skill = parseSkillSource(pasted, "pasted");
                        if (skill) {
                          install(skill);
                          setPasted("");
                          setPasteOpen(false);
                        } else setNote(t("skillFetchFailed", ui));
                      }}
                      style={{ justifySelf: "start", height: 38, padding: "0 16px", borderRadius: 19, border: "none", background: p.primary, color: p.onPrimary, font: "500 13px Roboto, system-ui, sans-serif", cursor: "pointer" }}
                    >
                      {t("skillInstall", ui)}
                    </button>
                  </div>
                )}
                <div style={{ font: "400 11px Roboto, system-ui, sans-serif", color: p.outline, lineHeight: 1.6 }}>{t("skillUrlHint", ui)}</div>
              </div>

              {note && <div style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.primary }}>{note}</div>}

              {active?.rewrite && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="auto_awesome" size={16} />
                  <span style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, flex: 1 }}>{t("skillRewriteHint", ui)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 80px", display: "grid", gap: 28 }}>
          {(aiError || summary) && (
            <section style={{ display: "grid", gap: 10, padding: 16, borderRadius: 20, background: p.secondaryContainer, color: p.onSecondaryContainer }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="auto_awesome" size={18} />
                <span style={{ font: "500 15px Roboto, system-ui, sans-serif", flex: 1 }}>{t("docAiSummary", ui)}</span>
                <span style={{ font: "400 12px Roboto, system-ui, sans-serif", opacity: 0.8 }}>{active?.name ?? ""}</span>
                {summary && (
                  <button
                    className="m3-press"
                    onClick={() => {
                      const url3 = URL.createObjectURL(new Blob([summary], { type: "text/markdown" }));
                      const a = document.createElement("a");
                      a.href = url3;
                      a.download = "m3e-docs-ai.md";
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url3), 0);
                    }}
                    style={{ height: 32, padding: "0 12px", borderRadius: 16, border: "none", background: p.primary, color: p.onPrimary, font: "500 12px Roboto, system-ui, sans-serif", cursor: "pointer" }}
                  >
                    {t("docDownload", ui)}
                  </button>
                )}
                <button
                  className="m3-press"
                  onClick={() => {
                    setSummary(null);
                    setAiError(null);
                    setAiTruncated(false);
                  }}
                  aria-label={t("cancel", ui)}
                  style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "transparent", color: p.onSecondaryContainer, cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              {aiError ? (
                <div style={{ font: "400 13px Roboto, system-ui, sans-serif" }}>{aiError}</div>
              ) : (
                <>
                  {aiTruncated && (
                    <div style={{ font: "400 12px Roboto, system-ui, sans-serif", opacity: 0.85 }}>{t("docAiTruncated", ui)}</div>
                  )}
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", font: "400 13px/1.7 Roboto, system-ui, sans-serif" }}>{summary}</pre>
                </>
              )}
            </section>
          )}
          {docs.sections.map((section) => (
            <section key={section.key} style={{ display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0, font: "500 22px Roboto, system-ui, sans-serif", color: p.primary }}>{section.title}</h2>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} p={p} />
              ))}
            </section>
          ))}
        </main>
      </div>
    </LangContext.Provider>
  );
}

function Block({ block, p }: { block: DocBlock; p: Palette }) {
  if (block.kind === "p") {
    return <p style={{ margin: 0, font: "400 14px Roboto, system-ui, sans-serif", lineHeight: 1.7, color: p.onSurfaceVariant }}>{block.text}</p>;
  }
  if (block.kind === "facts") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {block.rows.map((r) => (
          <div key={r.label} style={{ padding: 12, borderRadius: 14, background: p.surfaceContainerLow, border: `1px solid ${p.outlineVariant}` }}>
            <div style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant }}>{r.label}</div>
            <div style={{ font: "500 18px Roboto, system-ui, sans-serif", marginTop: 2 }}>{r.value}</div>
          </div>
        ))}
      </div>
    );
  }
  if (block.kind === "outline") {
    /*
     * 编号走 `outlineNumbers()` —— 和导出 Markdown 用的是同一个函数。
     * 之前两边各写一遍，结果页面改了导出没改（"还是 1 仓库"就是这么来的）。
     */
    const numbers = outlineNumbers(block.nodes);
    return (
      <div style={{ display: "grid", gap: 6 }}>
        {block.nodes.map((n, i) => {
          const number = numbers[i];
          /* 用真正的标题标签，方便在 Elements 里一眼看出层级 */
          const Tag = (n.depth === 0 ? "h2" : n.depth === 1 ? "h3" : "h4") as "h2";
          return (
            <div key={i} style={{ paddingInlineStart: n.depth === 0 ? 0 : 12 + n.depth * 20 }}>
              {n.title && (
                <Tag
                  style={{
                    margin: 0,
                    font: `${n.depth === 0 ? 600 : 500} ${n.depth === 0 ? 17 : 15 - n.depth}px Roboto, system-ui, sans-serif`,
                    color: n.depth === 0 ? p.onSurface : p.onSurfaceVariant,
                  }}
                >
                  {n.depth === 0 ? `${n.title}：` : `${number} ${n.title}：`}
                </Tag>
              )}
              {/* 一条事实一行，不用有序列表 —— 列表会自己加 1. 2.，和条目编号打架 */}
              {n.lines.length > 0 && (
                <div style={{ margin: "2px 0 0", display: "grid", gap: 2, paddingInlineStart: 12 }}>
                  {n.lines.map((l, j) => (
                    <div key={j} style={{ font: "400 13px Roboto, system-ui, sans-serif", lineHeight: 1.6, color: p.onSurfaceVariant }}>
                      {l}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  if (block.kind === "cards") {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {block.cards.map((c) => (
          <div key={c.title} style={{ padding: 14, borderRadius: 16, background: p.surfaceContainerLow, border: `1px solid ${p.outlineVariant}` }}>
            <div style={{ font: "500 15px Roboto, system-ui, sans-serif" }}>{c.title}</div>
            {c.subtitle && <div style={{ font: "400 12px Roboto, system-ui, sans-serif", color: p.onSurfaceVariant, marginTop: 2 }}>{c.subtitle}</div>}
            <ul style={{ margin: "8px 0 0", paddingInlineStart: 20, display: "grid", gap: 3 }}>
              {c.lines.map((l, i) => (
                <li key={i} style={{ font: "400 13px Roboto, system-ui, sans-serif", lineHeight: 1.6, color: p.onSurfaceVariant }}>{l}</li>
              ))}
              {(c.bullets ?? []).map((l, i) => (
                <li key={`b${i}`} style={{ font: "400 12px Roboto, system-ui, sans-serif", lineHeight: 1.6, color: p.outline }}>{l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${p.outlineVariant}` }}>
      <table style={{ borderCollapse: "collapse", width: "100%", font: "400 12px Roboto, system-ui, sans-serif" }}>
        <thead>
          <tr>
            {block.head.map((h) => (
              <th key={h} style={{ textAlign: "start", padding: "8px 10px", background: p.surfaceContainerHigh, color: p.onSurfaceVariant, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? p.surfaceContainerLow : "transparent" }}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: "7px 10px", color: p.onSurfaceVariant, borderTop: `1px solid ${p.outlineVariant}` }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
