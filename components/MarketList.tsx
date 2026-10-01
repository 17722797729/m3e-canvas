"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, Palette } from "@/lib/tokens";
import { t, useLang } from "@/lib/i18n";
import {
  AUDIT_PASSED,
  AUDIT_REJECTED,
  ComponentType,
  ComponentTypeCode,
  MarketComponent,
  componentTypes,
  marketComponentPage,
} from "@/lib/syai";
import { CATEGORY_NAMES, CODE_OF_CATEGORY, categoryOf, downloadText } from "@/lib/market";
import { Icon } from "./M3Node";
import { Field, TypeSelect } from "./ui";
import { UserAvatar } from "./UserAvatar";

/** 左侧面板一屏放得下多少行 */
export const MARKET_PAGE_SIZE = 8;

/**
 * 市场组件列表（左侧面板里的一栏）
 * ---------------------------------------------------------------------------
 * 组件类型是**下拉选择**，不再是一条要左右拖的分类条；
 * 一行一张卡片：缩略图、组件名称、用户名称、下载量、类型。
 * 点缩略图或名称打开「屏幕」预览（由调用方处理）。
 */
export function MarketList({
  p,
  refreshKey = 0,
  onOpen,
}: {
  p: Palette;
  /** 变了就重新拉一次，例如刚上传完或刚审核过 */
  refreshKey?: number;
  onOpen: (component: MarketComponent) => void;
}) {
  const lang = useLang();
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [type, setType] = useState<ComponentTypeCode | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MarketComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const query = useRef(0);

  useEffect(() => {
    let alive = true;
    void componentTypes()
      .then((list) => alive && setTypes(list))
      .catch(() => {
        /* 类型表拿不到也还能用本地分类名兜底 */
      });
    return () => {
      alive = false;
    };
  }, []);

  /* 类型或搜索词一变就回到第一页：停在第三页看一个只有两页的结果是空手 */
  useEffect(() => {
    setPage(1);
  }, [type, q, refreshKey]);

  useEffect(() => {
    const id = ++query.current;
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => {
      void marketComponentPage(page, MARKET_PAGE_SIZE, type, q)
        .then((res) => {
          if (query.current !== id) return;
          setItems(res.list ?? []);
          setTotal(res.total ?? 0);
        })
        .catch(() => {
          if (query.current !== id) return;
          setFailed(true);
          setItems([]);
          setTotal(0);
        })
        .finally(() => {
          if (query.current === id) setLoading(false);
        });
    }, q ? 260 : 0);
    return () => clearTimeout(timer);
  }, [page, type, q, refreshKey]);

  const pages = Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE));
  const nameOfType = (code: number) =>
    types.find((x) => x.code === code)?.name ?? CATEGORY_NAMES[categoryOf(code)];

  const typeOptions = [
    { value: 0, label: t("marketAll", lang) },
    ...CATEGORIES.map((c) => ({ value: CODE_OF_CATEGORY[c.key] as number, label: CATEGORY_NAMES[c.key] })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "12px 12px 6px", display: "grid", gap: 8 }}>
        <Field value={q} onChange={setQ} placeholder={t("marketSearch", lang)} p={p} icon="search" height={40} />
        <TypeSelect
          p={p}
          value={type ?? 0}
          options={typeOptions}
          title={t("marketType", lang)}
          onChange={(value) => setType(value === 0 ? null : (value as ComponentTypeCode))}
        />
      </div>

      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "2px 12px 10px" }}>
        {loading && items.length === 0 ? (
          <Hint p={p} icon="hourglass_top" text={t("marketLoading", lang)} />
        ) : failed ? (
          <Hint p={p} icon="cloud_off" text={t("marketFailed", lang)} />
        ) : items.length === 0 ? (
          <Hint p={p} icon="widgets" text={t("marketEmpty", lang)} />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((component) => (
              <MarketCard
                key={component.id}
                p={p}
                component={component}
                typeName={nameOfType(component.type)}
                onOpen={() => onOpen(component)}
              />
            ))}
          </div>
        )}
      </div>

      <Pager p={p} page={page} pages={pages} busy={loading} onChange={setPage} />
    </div>
  );
}

/** 一行市场组件：缩略图、名称、作者、下载量、类型 */
export function MarketCard({
  p,
  component,
  typeName,
  onOpen,
  wide,
}: {
  p: Palette;
  component: MarketComponent;
  typeName: string;
  onOpen: () => void;
  /** 市场页里的卡片大一些，缩略图整块铺出来 */
  wide?: boolean;
}) {
  const lang = useLang();
  const rejected = component.auditStatus === AUDIT_REJECTED;
  return (
    <button
      onClick={onOpen}
      title={component.name}
      className="m3-press"
      style={{
        display: "grid",
        gridTemplateColumns: wide ? "1fr" : "76px 1fr",
        gridTemplateRows: wide ? "148px auto" : undefined,
        gap: wide ? 0 : 10,
        padding: wide ? 0 : 8,
        borderRadius: 16,
        border: "none",
        background: p.surfaceContainerLow,
        color: p.onSurface,
        textAlign: "left",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      {/* 缩略图是方的，位子也是方的：又高又窄或又扁又宽的组件都不会被切成一半 */}
      <span
        style={{
          width: wide ? "100%" : 76,
          height: wide ? "100%" : 76,
          borderRadius: wide ? 0 : 12,
          overflow: "hidden",
          background: p.surfaceContainerLow,
          display: "grid",
          placeItems: "center",
        }}
      >
        {component.thumbnail ? (
          <img
            src={component.thumbnail}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <Icon name="image" size={22} />
        )}
      </span>
      <span style={{ minWidth: 0, display: "grid", alignContent: "center", gap: 4, padding: wide ? "10px 12px 12px" : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {component.name}
        </span>
        <span style={{ fontSize: 11, color: p.onSurfaceVariant, display: "flex", gap: 8, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            <UserAvatar p={p} src={component.userAvatar} name={component.userName} seed={component.userId} size={16} />
            {component.userName || "-"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
            <Icon name="download" size={13} />
            {downloadText(component.downloadCount)}
          </span>
        </span>
        <span style={{ fontSize: 11, color: rejected ? p.error : p.onSurfaceVariant, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {typeName}
          {component.auditStatus !== undefined && component.auditStatus !== AUDIT_PASSED ? (
            <>
              · <AuditTag p={p} status={component.auditStatus} label={auditText(component.auditStatus, component.auditStatusName, lang)} compact />
            </>
          ) : null}
        </span>
      </span>
    </button>
  );
}

/** 审核状态的小标签；后端给了 statusName 就用它，否则按前端文案 */
export function AuditTag({
  p,
  status,
  label,
  compact,
}: {
  p: Palette;
  status?: number;
  label: string;
  compact?: boolean;
}) {
  const tone =
    status === AUDIT_PASSED
      ? { bg: p.secondaryContainer, ink: p.onSecondaryContainer }
      : status === AUDIT_REJECTED
        ? { bg: p.errorContainer, ink: p.onErrorContainer }
        : { bg: p.tertiaryContainer, ink: p.onTertiaryContainer };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: compact ? "1px 7px" : "3px 10px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.ink,
        fontSize: compact ? 10 : 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/** 审核状态文案：后端的中文优先，读不到再落到本地文案 */
export function auditText(status: number | undefined, backendName: string | undefined, lang: ReturnType<typeof useLang>): string {
  if (backendName) return backendName;
  if (status === AUDIT_PASSED) return t("auditPassed", lang);
  if (status === AUDIT_REJECTED) return t("auditRejected", lang);
  return t("auditWaiting", lang);
}

/** 列表底部的翻页条 */
export function Pager({
  p,
  page,
  pages,
  busy,
  onChange,
}: {
  p: Palette;
  page: number;
  pages: number;
  busy?: boolean;
  onChange: (page: number) => void;
}) {
  const lang = useLang();
  const style = (disabled: boolean): React.CSSProperties => ({
    width: 34,
    height: 34,
    flex: "0 0 auto",
    borderRadius: 17,
    border: "none",
    background: disabled ? "transparent" : p.surfaceContainerHigh,
    color: disabled ? p.onSurfaceVariant : p.onSurface,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "default" : "pointer",
    display: "grid",
    placeItems: "center",
  });
  const before = page <= 1 || Boolean(busy);
  const after = page >= pages || Boolean(busy);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px 12px",
        borderTop: `1px solid ${p.outlineVariant}`,
      }}
    >
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={before} title={t("marketPrev", lang)} aria-label={t("marketPrev", lang)} className="m3-press" style={style(before)}>
        <Icon name="chevron_left" size={18} />
      </button>
      <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: p.onSurfaceVariant, fontVariantNumeric: "tabular-nums" }}>
        {t("marketPage", lang).replace("{n}", String(page)).replace("{total}", String(pages))}
      </span>
      <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={after} title={t("marketNext", lang)} aria-label={t("marketNext", lang)} className="m3-press" style={style(after)}>
        <Icon name="chevron_right" size={18} />
      </button>
    </div>
  );
}

/** 空态 / 加载态 / 失败态 */
export const Hint = ({ p, icon, text }: { p: Palette; icon: string; text: string }) => (
  <div
    style={{
      display: "grid",
      placeItems: "center",
      gap: 8,
      padding: "28px 12px",
      color: p.onSurfaceVariant,
      fontSize: 12,
      textAlign: "center",
    }}
  >
    <Icon name={icon} size={26} />
    <span>{text}</span>
  </div>
);
