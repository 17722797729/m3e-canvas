"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readDoc as readStoredDoc } from "@/lib/project";
import { CATEGORIES, DEFAULT_PALETTE_KEY, DEFAULT_THEME, Doc, Palette, Theme, paletteOf } from "@/lib/tokens";
import { loadAppTheme } from "@/lib/appTheme";
import { useSystemTheme } from "@/lib/theme";
import { LangContext, isLang, setGlobalLang, t, type Lang } from "@/lib/i18n";
import { bootSession } from "@/lib/session";
import {
  ComponentType,
  ComponentTypeCode,
  MarketComponent,
  MarketSort,
  componentTypes,
  marketComponentPage,
} from "@/lib/syai";
import { CATEGORY_NAMES, CODE_OF_CATEGORY, categoryOf, downloadText } from "@/lib/market";
import { goToEditor } from "@/lib/appPath";
import { MarketDialog } from "@/components/MarketDialog";
import { Icon } from "@/components/M3Node";
import { Field, TypeSelect } from "@/components/ui";
import { UserAvatar } from "@/components/UserAvatar";

/* 市场组件页：整页浏览所有已公开（审核通过）的组件，按类型筛选、分页。
 * 它读编辑器写下的同一份自动保存（配色），主题则读那**一处**应用级设置
 * （`m3e:theme`），所以进来还是自己的画风。 */

const PAGE_SIZE = 12;

/** the stored language, exactly as the editor reads it */
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



export default function MarketPage() {
  const [lang, setLang] = useState<Lang | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  /** 主题是应用级的：这一页不看 doc.theme，只看 `m3e:theme` */
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [type, setType] = useState<ComponentTypeCode | null>(null);
  const [sort, setSort] = useState<MarketSort>("created");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MarketComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState<MarketComponent | null>(null);

  useEffect(() => {
    const initial = initialLanguage();
    document.documentElement.lang = initial;
    setGlobalLang(initial);
    setLang(initial);
    setDoc(readDoc());
    setTheme(loadAppTheme(window.localStorage));
    /* 登录态和编辑器共用一个 store：这里也要引导一次，头像/审核信息才读得到 */
    bootSession();
    void componentTypes()
      .then(setTypes)
      .catch(() => {
        /* 类型名有本地兜底 */
      });
  }, []);

  const ui: Lang = lang ?? "ja";
  /* 深浅色模式：开了 bothModes 时上屏的深浅跟系统走（lib/systemTheme.ts） */
  const shownTheme = useSystemTheme(theme);
  const p: Palette = useMemo(
    () => paletteOf(doc?.paletteKey ?? DEFAULT_PALETTE_KEY, doc?.customPalette ?? null, shownTheme),
    [doc?.paletteKey, doc?.customPalette, shownTheme],
  );

  useEffect(() => {
    setPage(1);
  }, [type, sort, q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => {
      void marketComponentPage(page, PAGE_SIZE, type, q, sort)
        .then((res) => {
          if (!alive) return;
          setItems(res.list ?? []);
          setTotal(res.total ?? 0);
        })
        .catch(() => {
          if (!alive) return;
          setFailed(true);
          setItems([]);
          setTotal(0);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, q ? 260 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [page, type, sort, q]);

  const nameOfType = useCallback(
    (code: number) => types.find((x) => x.code === code)?.name ?? CATEGORY_NAMES[categoryOf(code)],
    [types],
  );

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const typeOptions = [
    { value: 0, label: t("marketAll", ui) },
    ...CATEGORIES.map((c) => ({ value: CODE_OF_CATEGORY[c.key] as number, label: CATEGORY_NAMES[c.key] })),
  ];

  const pager = (disabled: boolean): React.CSSProperties => ({
    width: 38,
    height: 38,
    borderRadius: 19,
    border: "none",
    background: disabled ? "transparent" : p.surfaceContainerHigh,
    color: disabled ? p.onSurfaceVariant : p.onSurface,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "default" : "pointer",
    display: "grid",
    placeItems: "center",
  });

  /* 语言在读出来之前先画一块底色，免得闪一下日文 */
  if (lang === null) return <div style={{ minHeight: "100vh", background: p.surface }} />;

  /* 这一页自己就是一棵树：语言要经 context 传下去，
     否则 t() 会落到 context 的默认值（日语），页面上就会中日混排 */
  return (
    <LangContext.Provider value={ui}>
    <div style={{ minHeight: "100vh", background: p.surface, color: p.onSurface, fontFamily: "Roboto, system-ui, sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          background: p.surfaceContainerLow,
          borderBottom: `1px solid ${p.outlineVariant}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{t("marketPageTitle", ui)}</div>
          <div style={{ fontSize: 12, color: p.onSurfaceVariant, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t("marketPageHint", ui)}
          </div>
        </div>
        {/* 从编辑器来的就退回去（不重新加载、回到离开前的面板），否则跳编辑器首页 */}
        <button
          onClick={() => goToEditor()}
          className="m3-press"
          style={{
            height: 40,
            padding: "0 18px",
            borderRadius: 20,
            border: "none",
            background: p.primary,
            color: p.onPrimary,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flex: "0 0 auto",
          }}
        >
          <Icon name="arrow_back" size={18} />
          {t("marketBackToEditor", ui)}
        </button>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "16px 20px 0" }}>
        <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
          <Field value={q} onChange={setQ} placeholder={t("marketSearch", ui)} p={p} icon="search" height={44} />
        </div>
        <div style={{ flex: "0 0 190px" }}>
          <TypeSelect
            p={p}
            value={type ?? 0}
            options={typeOptions}
            title={t("marketType", ui)}
            height={44}
            onChange={(value) => setType(value === 0 ? null : (value as ComponentTypeCode))}
          />
        </div>
        <div style={{ flex: "0 0 190px" }}>
          <TypeSelect
            p={p}
            value={sort === "downloads" ? 1 : 0}
            options={[
              { value: 0, label: t("marketSortNewest", ui), icon: "schedule" },
              { value: 1, label: t("marketSortPopular", ui), icon: "download" },
            ]}
            title={t("marketSort", ui)}
            height={44}
            onChange={(value) => setSort(value === 1 ? "downloads" : "created")}
          />
        </div>
        <span style={{ fontSize: 12, color: p.onSurfaceVariant, fontVariantNumeric: "tabular-nums" }}>
          {t("marketPageSize", ui).replace("{n}", String(total))}
        </span>
      </div>

      <div style={{ padding: "16px 20px 24px" }}>
        {loading && items.length === 0 ? (
          <Notice p={p} icon="hourglass_top" text={t("marketLoading", ui)} />
        ) : failed ? (
          <Notice p={p} icon="cloud_off" text={t("marketFailed", ui)} />
        ) : items.length === 0 ? (
          <Notice p={p} icon="widgets" text={t("marketEmpty", ui)} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {items.map((component) => (
              <button
                key={component.id}
                onClick={() => setOpened(component)}
                title={component.name}
                className="m3-press"
                style={{
                  padding: 0,
                  borderRadius: 20,
                  border: "none",
                  background: p.surfaceContainerLow,
                  color: p.onSurface,
                  textAlign: "left",
                  cursor: "pointer",
                  overflow: "hidden",
                  display: "grid",
                  gridTemplateRows: "168px auto",
                }}
              >
                <span style={{ overflow: "hidden", background: p.surfaceContainerHighest, display: "grid", placeItems: "center" }}>
                  {component.thumbnail ? (
                    <img src={component.thumbnail} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <Icon name="image" size={26} />
                  )}
                </span>
                <span style={{ padding: "10px 12px 12px", display: "grid", gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {component.name}
                  </span>
                  <span style={{ fontSize: 11, color: p.onSurfaceVariant, display: "flex", gap: 10, minWidth: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                      <UserAvatar p={p} src={component.userAvatar} name={component.userName} seed={component.userId} size={16} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{component.userName || "-"}</span>
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
                      <Icon name="download" size={13} />
                      {downloadText(component.downloadCount)}
                    </span>
                  </span>
                  <span style={{ fontSize: 11, color: p.onSurfaceVariant }}>{nameOfType(component.type)}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 20 }}>
          <button onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1 || loading} title={t("marketPrev", ui)} aria-label={t("marketPrev", ui)} className="m3-press" style={pager(page <= 1 || loading)}>
            <Icon name="chevron_left" size={20} />
          </button>
          <span style={{ fontSize: 13, color: p.onSurfaceVariant, fontVariantNumeric: "tabular-nums" }}>
            {t("marketPage", ui).replace("{n}", String(page)).replace("{total}", String(pages))}
          </span>
          <button onClick={() => setPage((n) => Math.min(pages, n + 1))} disabled={page >= pages || loading} title={t("marketNext", ui)} aria-label={t("marketNext", ui)} className="m3-press" style={pager(page >= pages || loading)}>
            <Icon name="chevron_right" size={20} />
          </button>
        </div>
      </div>

      {/* 详情「屏幕」自带出入场动画，这里不用再包一层 */}
      <MarketDialog
        p={p}
        component={opened}
        theme={shownTheme}
        onClose={() => setOpened(null)}
        onToast={() => {
          /* 市场页上「加入我的组件」已经写进后端；回到编辑器就能在组件面板里看到 */
        }}
      />
    </div>
    </LangContext.Provider>
  );
}

const Notice = ({ p, icon, text }: { p: Palette; icon: string; text: string }) => (
  <div style={{ display: "grid", placeItems: "center", gap: 10, padding: "60px 20px", color: p.onSurfaceVariant, fontSize: 13 }}>
    <Icon name={icon} size={32} />
    <span>{text}</span>
  </div>
);
