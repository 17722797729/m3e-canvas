"use client";

import { Palette } from "@/lib/tokens";
import { Icon } from "./M3Node";
import { t, useLang } from "@/lib/i18n";

const Beta = ({ p }: { p: Palette }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: p.tertiaryContainer, color: p.onTertiaryContainer, letterSpacing: 0.4 }}>BETA</span>
);

/** 「让 AI 画」的入口按钮：文字 + BETA 徽章；模型在答话时显示忙碌态 */

export function ShareButton({ p, onClick, busy }: { p: Palette; onClick: () => void; busy?: boolean }) {
  const lang = useLang();
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={busy ? t("askAiGenerating", lang) : t("askAiTitle", lang)}
      className="m3-press"
      style={{
        height: 40,
        padding: "0 8px 0 16px",
        borderRadius: 20,
        border: "none",
        background: "transparent",
        color: busy ? p.onSurfaceVariant : p.onSurface,
        fontSize: 13,
        fontWeight: 600,
        cursor: busy ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        whiteSpace: "nowrap",
      }}
    >
      {busy && <Icon name="hourglass_top" size={18} />}
      {busy ? t("askAiGenerating", lang) : t("askAi", lang)}
      {!busy && <Beta p={p} />}
    </button>
  );
}
