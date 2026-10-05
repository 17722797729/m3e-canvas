"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { readDoc } from "@/lib/project";
import { Doc, Palette } from "@/lib/tokens";
import { t, useLang } from "@/lib/i18n";
import { AiSettings, ChatAttachment, ChatTurn, MAX_IMAGE_BYTES, modelInUse } from "@/lib/ai";
import { shareLink } from "@/lib/share";
import { Icon } from "./M3Node";
import { inputBox } from "./ui";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const appUrl = () => `${window.location.origin}${BASE}/`;
const guideUrl = () => `${appUrl()}agent.md`;

/**
 * 「让 AI 画」的对话面板
 * ---------------------------------------------------------------------------
 * 一条对话流：作者说一句，助手要么接着问、要么直接画一版放到画布上。
 *
 * · 每一轮都带着之前的对话（与附件）一起发，所以「再改一下」「第三屏去掉」接得上；
 * · 可以传图片（当参考）和画布文件（.json，直接打开看；也可以让助手照着改）；
 * · 助手带回设计时，不直接覆盖画布 —— 由作者按「放到画布」，
 *   放上去之后仍然走已有的撤销/重来那一套。
 *
 * 面板本身就是预览的宿主：带键盘操作、可滚动、发送后不丢焦点。
 */
export function ChatPanel({
  p,
  open,
  onClose,
  turns,
  busy,
  aiReady,
  onSend,
  onCancel,
  onApply,
  onSetupAi,
  currentDoc,
  onOpenProject,
  settings,
}: {
  p: Palette;
  open: boolean;
  onClose: () => void;
  /** 整段对话，由页面持有：关掉面板再打开还在 */
  turns: ChatTurn[];
  /** 助手正在回答 */
  busy: boolean;
  /** 配好了 key（或本地服务）才能真的发出去 */
  aiReady: boolean;
  /** 这一句连同附件发给助手 */
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onCancel: () => void;
  /** 把助手这一版设计放到画布上 */
  onApply: (design: Doc) => void;
  /** 画布现在的样子：复制给编码 Agent 时用 */
  currentDoc: Doc;
  /** 打开作者传上来的画布文件 */
  onOpenProject: (design: Doc) => void;
  /** 当前用的服务商与模型：顶部只显示，改它要去 AI 设置 */
  settings: AiSettings;
  onSetupAi: () => void;
}) {
  const lang = useLang();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<ChatAttachment[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [askCopied, setAskCopied] = useState(false);
  const [note, setNote] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* 新消息进来就滚到底：对话是「往下长」的 */
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (busy) onCancel();
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, busy, onCancel, onClose]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!linkCopied) return;
    const id = setTimeout(() => setLinkCopied(false), 1400);
    return () => clearTimeout(id);
  }, [linkCopied]);
  useEffect(() => {
    if (!askCopied) return;
    const id = setTimeout(() => setAskCopied(false), 3000);
    return () => clearTimeout(id);
  }, [askCopied]);

  /** 选文件：图片当参考，.json 画布文件直接读成设计 */
  const attach = async (picked: FileList | null) => {
    if (!picked?.length) return;
    setNote("");
    const next: ChatAttachment[] = [];
    for (const file of Array.from(picked).slice(0, 4)) {
      const isImage = /^image\//.test(file.type);
      if (isImage && file.size > MAX_IMAGE_BYTES) {
        setNote(t("chatImageTooBig", lang).replace("{name}", file.name));
        continue;
      }
      if (isImage) {
        const dataUrl = await readImage(file);
        if (dataUrl) next.push({ name: file.name, kind: "image", dataUrl });
        continue;
      }
      if (/\.json$/i.test(file.name) || file.type === "application/json") {
        const json = await readText(file);
        const design = json ? tryParseDoc(json) : undefined;
        if (design) {
          /* 是本工具的画布文件：既当附件，也允许直接打开 */
          next.push({ name: file.name, kind: "project" });
          onOpenProject(design);
        } else {
          setNote(t("chatFileUnknown", lang).replace("{name}", file.name));
        }
        continue;
      }
      setNote(t("chatFileUnknown", lang).replace("{name}", file.name));
    }
    if (next.length) setFiles((cur) => [...cur, ...next].slice(0, 4));
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = () => {
    if (busy || (!text.trim() && files.length === 0)) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
  };

  const copyAsk = async () => {
    try {
      const raw = t("askAiText", lang).replace("{url}", guideUrl()).replace("{idea}", text.trim() || t("askAiIdeaFallback", lang));
      await navigator.clipboard.writeText(raw);
      setAskCopied(true);
    } catch {}
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(await shareLink(currentDoc, appUrl()));
      setLinkCopied(true);
    } catch {}
  };

  const roundBtn = (icon: string, label: string, onClick: () => void, opts?: { primary?: boolean; danger?: boolean; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={opts?.disabled}
      title={label}
      aria-label={label}
      className="m3-press"
      style={{
        width: 40,
        height: 40,
        flex: "0 0 auto",
        borderRadius: 20,
        border: "none",
        background: opts?.primary ? p.primary : opts?.danger ? p.errorContainer : p.surfaceContainerHighest,
        color: opts?.primary ? p.onPrimary : opts?.danger ? p.onErrorContainer : p.onSurfaceVariant,
        cursor: opts?.disabled ? "default" : "pointer",
        opacity: opts?.disabled ? 0.5 : 1,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Icon name={icon} size={20} />
    </button>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="chat-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.32)", display: "grid", placeItems: "center", padding: 24 }}
        >
          <motion.section
            role="dialog"
            aria-modal
            aria-label={t("askAi", lang)}
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 34, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 760px)",
              /* 文字一多，矮框里只能看见一两行，改起来很难受：给它更多高度，
                 并用 dvh 跟着窗口走，小窗口也不溢出。 */
              height: "min(94dvh, 1000px)",
              display: "flex",
              flexDirection: "column",
              borderRadius: 28,
              overflow: "hidden",
              background: p.surfaceContainerHigh,
              color: p.onSurface,
              boxShadow: "0 12px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
            }}
          >
            {/* 标题栏 */}
            <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px" }}>
              <Icon name="auto_awesome" size={22} color={p.primary} />
              <span style={{ fontSize: 18, fontWeight: 600 }}>{t("askAi", lang)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: p.tertiaryContainer, color: p.onTertiaryContainer, letterSpacing: 0.4 }}>
                {t("chatAgent", lang)}
              </span>
              <span style={{ flex: 1, minWidth: 8 }} />
              {roundBtn(linkCopied ? "check" : "link", t("shareLinkHint", lang), copyLink)}
              {roundBtn("close", t("closeBtn", lang), onClose)}
            </header>

            {/* 对话 */}
            <div ref={listRef} className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 18px 8px", display: "grid", gap: 12, alignContent: "start" }}>
              {turns.length === 0 && (
                <div style={{ display: "grid", gap: 8, padding: "16px 2px", color: p.onSurfaceVariant, fontSize: 13, lineHeight: 1.6 }}>
                  <span>{t("chatWelcome", lang)}</span>
                  <span style={{ display: "grid", gap: 6 }}>
                    {[t("chatExample1", lang), t("chatExample2", lang), t("chatExample3", lang)].map((ex) => (
                      <button
                        key={ex}
                        onClick={() => setText(ex)}
                        className="m3-press"
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: 14,
                          border: `1px solid ${p.outlineVariant}`,
                          background: "transparent",
                          color: p.onSurface,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {ex}
                      </button>
                    ))}
                  </span>
                </div>
              )}

              {turns.map((turn) => (
                <Bubble key={turn.id} p={p} turn={turn} onApply={onApply} />
              ))}

              {busy && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: p.onSurfaceVariant, fontSize: 13, padding: "0 4px" }}>
                  <span className="m3-spin" style={{ display: "inline-flex" }}>
                    <Icon name="progress_activity" size={18} />
                  </span>
                  {t("askAiGenerating", lang)}
                </div>
              )}
            </div>

            {/* 待发送的附件 */}
            {files.length > 0 && (
              <div style={{ display: "flex", gap: 8, padding: "0 18px 8px", flexWrap: "wrap" }}>
                {files.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 6px 4px 4px",
                      borderRadius: 12,
                      background: p.surfaceContainerHighest,
                      fontSize: 11,
                      color: p.onSurfaceVariant,
                    }}
                  >
                    {f.kind === "image" && f.dataUrl ? (
                      <img src={f.dataUrl} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }} />
                    ) : (
                      <Icon name="description" size={16} />
                    )}
                    <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button
                      onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))}
                      title={t("chatRemoveAttachment", lang)}
                      aria-label={t("chatRemoveAttachment", lang)}
                      className="m3-press"
                      style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: "transparent", color: p.onSurfaceVariant, cursor: "pointer", display: "grid", placeItems: "center" }}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 输入区：一个整体的框，里面是"写东西"和"底部一排动作" —— 参考常见的对话式输入条。
                附件、模型、发送都在这一排里，长句也有足够的高度去改。 */}
            <footer style={{ padding: "4px 18px 16px", display: "grid", gap: 8 }}>
              <div
                style={{
                  display: "grid",
                  gap: 4,
                  padding: "12px 12px 10px",
                  borderRadius: 26,
                  ...inputBox(p, 26),
                }}
              >
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    /* Enter 发送，Shift+Enter 换行：对话面板的常规手感 */
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={t("chatPlaceholder", lang)}
                  rows={2}
                  spellCheck={false}
                  style={{
                    width: "100%",
                    minHeight: 56,
                    maxHeight: 260,
                    padding: "2px 6px",
                    border: "none",
                    background: "transparent",
                    color: p.onSurface,
                    font: "inherit",
                    fontSize: 14.5,
                    lineHeight: 1.5,
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />

                {/* 底部一排：左边是加东西的地方，右边是"用哪个模型"和发送 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*,.json,application/json"
                    onChange={(e) => void attach(e.target.files)}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    title={t("chatAttach", lang)}
                    aria-label={t("chatAttach", lang)}
                    className="m3-press"
                    style={{
                      width: 34,
                      height: 34,
                      flex: "0 0 auto",
                      borderRadius: 17,
                      border: "none",
                      background: p.surfaceContainerHigh,
                      color: p.onSurface,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon name="add" size={20} />
                  </button>

                  <span style={{ flex: 1, minWidth: 0 }} />

                  {/* 当前用的模型：面板里只显示，改它去 AI 设置（那里是唯一的来源） */}
                  <button
                    onClick={onSetupAi}
                    title={t("chatModelHint", lang)}
                    className="m3-press"
                    style={{
                      maxWidth: 230,
                      minWidth: 0,
                      height: 30,
                      padding: "0 4px",
                      border: "none",
                      background: "transparent",
                      color: p.onSurfaceVariant,
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      flex: "0 0 auto",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {modelInUse(settings)}
                    </span>
                    <Icon name="expand_more" size={16} />
                  </button>

                  {busy
                    ? roundBtn("stop_circle", t("cancel", lang), onCancel, { danger: true })
                    : aiReady
                      ? roundBtn("arrow_upward", t("chatSend", lang), send, { primary: true, disabled: !text.trim() && files.length === 0 })
                      : roundBtn("key", t("aiSetup", lang), onSetupAi, { primary: true })}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 18, fontSize: 12, color: p.onSurfaceVariant }}>
                <span style={{ flex: 1, minWidth: 0, color: note ? p.error : p.onSurfaceVariant, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {note || (aiReady ? t("chatHint", lang) : t("aiSetupHint", lang))}
                </span>
                {askCopied && (
                  <button
                    onClick={copyAsk}
                    className="m3-press"
                    style={{ border: "none", background: "transparent", color: p.primary, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}
                  >
                    <Icon name="content_copy" size={14} />
                    {t("chatCopyForAgent", lang)}
                  </button>
                )}
              </div>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 一条消息：用户靠右、助手靠左；助手带回设计时给一个「放到画布」 */
function Bubble({ p, turn, onApply }: { p: Palette; turn: ChatTurn; onApply: (d: Doc) => void }) {
  const lang = useLang();
  const mine = turn.role === "user";
  const tone = turn.role === "error" ? { bg: p.errorContainer, ink: p.onErrorContainer } : mine ? { bg: p.primary, ink: p.onPrimary } : { bg: p.surfaceContainer, ink: p.onSurface };
  return (
    <div style={{ display: "grid", justifyItems: mine ? "end" : "start", gap: 6, maxWidth: "100%" }}>
      <div
        style={{
          maxWidth: "86%",
          padding: "10px 14px",
          borderRadius: mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
          background: tone.bg,
          color: tone.ink,
          fontSize: 13.5,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {turn.text || (turn.design ? t("chatDesignReady", lang) : "")}
      </div>

      {turn.attachments && turn.attachments.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: mine ? "flex-end" : "flex-start" }}>
          {turn.attachments.map((a, i) =>
            a.kind === "image" && a.dataUrl ? (
              <img key={`${a.name}-${i}`} src={a.dataUrl} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: `1px solid ${p.outlineVariant}` }} />
            ) : (
              <span key={`${a.name}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 10, background: p.surfaceContainerHigh, fontSize: 11, color: p.onSurfaceVariant }}>
                <Icon name="description" size={14} />
                {a.name}
              </span>
            ),
          )}
        </div>
      )}

      {turn.design && (
        <button
          onClick={() => onApply(turn.design as Doc)}
          className="m3-press"
          style={{
            height: 36,
            padding: "0 14px",
            borderRadius: 18,
            border: "none",
            background: p.secondaryContainer,
            color: p.onSecondaryContainer,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="wallpaper" size={16} />
          {t("chatApply", lang)}
        </button>
      )}
    </div>
  );
}

const readImage = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });

const readText = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });

/** 读出来的 JSON 是不是一份画布文档；不是就返回 undefined */
function tryParseDoc(json: string): Doc | undefined {
  try {
    const value: unknown = JSON.parse(json);
    return readDoc(value) ?? undefined;
  } catch {
    return undefined;
  }
}
