"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Palette, R_FULL } from "@/lib/tokens";
import { t, useLang } from "@/lib/i18n";
import { avatarOf, displayNameOf, signOut, useSession } from "@/lib/session";
import { Icon } from "./M3Node";
import { LoginDialog } from "./LoginDialog";

/** 头像里的首字母：昵称没有就用手机号最后一位，都没有就一个点 */
const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || "·";

/** 圆形头像：有图用图，没有就画首字母 */
export function Avatar({ p, size = 38 }: { p: Palette; size?: number }) {
  const { user } = useSession();
  const [broken, setBroken] = useState(false);
  const src = avatarOf(user);

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: R_FULL, objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: R_FULL,
        background: p.primaryContainer,
        color: p.onPrimaryContainer,
        display: "grid",
        placeItems: "center",
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {user ? initialOf(displayNameOf(user)) : <Icon name="person" size={Math.round(size * 0.55)} />}
    </span>
  );
}

/**
 * 左下角的账号入口
 * ---------------------------------------------------------------------------
 * 未登录：点一下弹登录框；
 * 已登录：点一下展开账号菜单，退出登录也在这里。
 */
export function AvatarMenu({ p, size = 44 }: { p: Palette; size?: number }) {
  const lang = useLang();
  const { user, loggedIn } = useSession();
  const [login, setLogin] = useState(false);
  const [menu, setMenu] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* 点面板以外的地方收起菜单；登录弹窗自己管关闭，不在这里拦 */
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const name = displayNameOf(user);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "grid", placeItems: "center" }}>
      <button
        onClick={() => (loggedIn ? setMenu((o) => !o) : setLogin(true))}
        title={loggedIn ? name || t("account", lang) : t("signIn", lang)}
        aria-label={loggedIn ? t("account", lang) : t("signIn", lang)}
        aria-expanded={loggedIn ? menu : undefined}
        className="m3-press"
        style={{
          width: size,
          height: size,
          padding: 0,
          borderRadius: R_FULL,
          border: "none",
          background: menu ? p.secondaryContainer : "transparent",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Avatar p={p} size={Math.round(size * 0.82)} />
      </button>

      <AnimatePresence>
        {menu && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, x: -6, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
            style={{
              position: "absolute",
              left: size + 8,
              bottom: 0,
              minWidth: 176,
              padding: 6,
              borderRadius: 18,
              background: p.surfaceContainerLow,
              color: p.onSurface,
              boxShadow: "0 6px 20px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)",
              zIndex: 60,
              transformOrigin: "bottom left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
              <Avatar p={p} size={32} />
              <span style={{ minWidth: 0, display: "grid" }}>
                <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name || t("account", lang)}
                </span>
                <span style={{ fontSize: 11, color: p.onSurfaceVariant }}>{t("account", lang)}</span>
              </span>
            </div>
            <button
              role="menuitem"
              onClick={() => {
                setMenu(false);
                signOut();
              }}
              className="m3-press"
              style={{
                width: "100%",
                height: 40,
                padding: "0 14px 0 10px",
                borderRadius: 12,
                border: "none",
                background: "transparent",
                color: p.error,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                whiteSpace: "nowrap",
              }}
            >
              <Icon name="logout" size={18} />
              {t("signOut", lang)}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <LoginDialog p={p} open={login} onClose={() => setLogin(false)} />
    </div>
  );
}
