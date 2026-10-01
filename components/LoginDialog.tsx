"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Palette, R_FULL } from "@/lib/tokens";
import { t, useLang } from "@/lib/i18n";
import { ApiError, SMS_COOLDOWN, sendSmsCode, smsLogin } from "@/lib/syai";
import { setSessionUser } from "@/lib/session";
import { Icon } from "./M3Node";
import { inputBox } from "./ui";

const TERMS_URL =
  "https://tcn9nq7u52ec.feishu.cn/wiki/Uy4Aw3Q5MivIFFkRBnUcUozrndd?from=from_copylink";
const PRIVACY_URL =
  "https://tcn9nq7u52ec.feishu.cn/wiki/DWCXwo1xxin7fLkyxK8c3Rr6n5f?from=from_copylink";

const maskMobile = (m: string) => (m.length === 11 ? `${m.slice(0, 3)}****${m.slice(7)}` : m);
const PHONE_OK = /^1[3-9]\d{9}$/;

/**
 * 登录弹窗
 * ---------------------------------------------------------------------------
 * 与 looyo 官网、syai_web 用的是同一套短信登录接口和同一批 localStorage 键，
 * 所以在任意一处登录过，回到这里就已经是登录状态；这里的登录结果同样能带去别处。
 */
export function LoginDialog({
  p,
  open,
  onClose,
}: {
  p: Palette;
  open: boolean;
  onClose: () => void;
}) {
  const lang = useLang();
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [agree, setAgree] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "error" | "ok" | "" }>({ text: "", tone: "" });
  const phoneRef = useRef<HTMLInputElement>(null);

  /* 每次打开都从干净的表单开始，并把焦点放进手机号 */
  useEffect(() => {
    if (!open) return;
    setCode("");
    setAgree(false);
    setBusy(false);
    setMsg({ text: "", tone: "" });
    const id = setTimeout(() => phoneRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [open, cooldown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const phoneOk = PHONE_OK.test(mobile.trim());
  const formOk = phoneOk && code.trim().length === 6 && agree;

  const send = async () => {
    if (!phoneOk || cooldown > 0 || busy) return;
    setMsg({ text: t("marketLoading", lang), tone: "" });
    try {
      await sendSmsCode(mobile.trim());
      setCooldown(SMS_COOLDOWN);
      setMsg({ text: t("signInSent", lang).replace("{mobile}", maskMobile(mobile.trim())), tone: "ok" });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : t("signInFail", lang), tone: "error" });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOk) {
      setMsg({ text: t("signInNeedForm", lang), tone: "error" });
      return;
    }
    setBusy(true);
    setMsg({ text: t("signInBusy", lang), tone: "" });
    try {
      const user = await smsLogin(mobile.trim(), code.trim());
      setSessionUser(user);
      setMsg({ text: t("signInOk", lang), tone: "ok" });
      setTimeout(() => {
        onClose();
        setMobile("");
        setCode("");
      }, 380);
    } catch (err) {
      setMsg({
        text: err instanceof ApiError || err instanceof Error ? err.message : t("signInFail", lang),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const field = (
    label: string,
    node: React.ReactNode,
  ) => (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: p.onSurfaceVariant }}>{label}</span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 48,
          padding: "0 14px",
          ...inputBox(p, 14),
        }}
      >
        {node}
      </span>
    </label>
  );

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: "100%",
    border: 0,
    background: "none",
    outline: "none",
    color: p.onSurface,
    font: "inherit",
    fontSize: 15,
  };

  const canSend = phoneOk && cooldown === 0 && !busy;
  const sendLabel = cooldown > 0 ? t("signInResend", lang).replace("{n}", String(cooldown)) : t("signInSend", lang);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="login-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 700,
            background: "rgba(0,0,0,0.32)",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <motion.form
            role="dialog"
            aria-modal
            aria-label={t("signIn", lang)}
            onSubmit={submit}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 400px)",
              padding: 24,
              borderRadius: 28,
              background: p.surfaceContainerHigh,
              color: p.onSurface,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 400 }}>{t("signInTitle", lang)}</div>
                <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: p.onSurfaceVariant }}>
                  {t("signInHint", lang)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                title={t("closeBtn", lang)}
                aria-label={t("closeBtn", lang)}
                className="m3-press"
                style={{
                  width: 32,
                  height: 32,
                  flex: "0 0 auto",
                  borderRadius: R_FULL,
                  border: "none",
                  background: "transparent",
                  color: p.onSurfaceVariant,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {field(
              t("signInMobile", lang),
              <>
                <span style={{ fontSize: 14, fontWeight: 600, color: p.onSurfaceVariant, paddingInlineEnd: 8, borderInlineEnd: `1px solid ${p.outlineVariant}` }}>
                  +86
                </span>
                <input
                  ref={phoneRef}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder={t("signInMobileHint", lang)}
                  style={inputStyle}
                />
              </>,
            )}

            {field(
              t("signInCode", lang),
              <>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("signInCodeHint", lang)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!canSend}
                  className="m3-press"
                  style={{
                    flex: "0 0 auto",
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 16,
                    border: "none",
                    background: canSend ? p.secondaryContainer : "transparent",
                    color: canSend ? p.onSecondaryContainer : p.onSurfaceVariant,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: canSend ? "pointer" : "default",
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {sendLabel}
                </button>
              </>,
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.6, color: p.onSurfaceVariant, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                style={{ marginTop: 3, width: 15, height: 15, flex: "0 0 auto", accentColor: p.primary, cursor: "pointer" }}
              />
              <span>
                {t("signInAgree", lang)}
                {" · "}
                <a href={TERMS_URL} target="_blank" rel="noreferrer noopener" style={{ color: p.onSurface }}>
                  {t("signInTerms", lang)}
                </a>
                {" / "}
                <a href={PRIVACY_URL} target="_blank" rel="noreferrer noopener" style={{ color: p.onSurface }}>
                  {t("signInPrivacy", lang)}
                </a>
              </span>
            </label>

            <p
              role="status"
              aria-live="polite"
              style={{
                margin: 0,
                minHeight: "1.2em",
                fontSize: 12,
                color: msg.tone === "error" ? p.error : msg.tone === "ok" ? p.primary : p.onSurfaceVariant,
              }}
            >
              {msg.text}
            </p>

            <button
              type="submit"
              disabled={busy}
              className="m3-press"
              style={{
                height: 48,
                borderRadius: 24,
                border: "none",
                background: formOk && !busy ? p.primary : p.surfaceContainerHighest,
                color: formOk && !busy ? p.onPrimary : p.onSurfaceVariant,
                fontSize: 15,
                fontWeight: 600,
                cursor: formOk && !busy ? "pointer" : "default",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {busy && <Icon name="hourglass_top" size={18} />}
              {busy ? t("signInBusy", lang) : t("signInSubmit", lang)}
            </button>

            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: p.onSurfaceVariant }}>{t("signInFoot", lang)}</p>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
