"use client";

import { useCallback, useEffect, useState } from "react";
import { CustomPart, Palette, Theme } from "@/lib/tokens";
import { t, useLang } from "@/lib/i18n";
import {
  AUDIT_PASSED,
  AUDIT_REJECTED,
  AUDIT_WAITING,
  ComponentTypeCode,
  MarketComponent,
  MyComponent,
  deleteMyComponent,
  deleteMyUpload,
  myComponentList,
  myUploadPage,
} from "@/lib/syai";
import { CATEGORY_NAMES, categoryOf, formatWhen, partOf } from "@/lib/market";
import { useSession } from "@/lib/session";
import { Icon } from "./M3Node";
import { AuditTag, Hint, MarketList, Pager, auditText } from "./MarketList";
import { MarketDialog } from "./MarketDialog";
import { TypeSelect } from "./ui";

/** 一次最多铺出多少个「我的组件」的预览；再多的仍在后端，组件面板按类型分组去看 */
const MINE_LIMIT = 40;
const MINE_PAGE_SIZE = 10;

/** 市场组件面板的两页：市场，和自己上传的那一批 */
type MarketTab = "market" | "mine";

/**
 * 市场组件面板
 * ---------------------------------------------------------------------------
 * 「市场组件」：按组件类型（下拉）筛选 + 分页，一行一张卡片；点缩略图或名称打开「屏幕」。
 *              底部给一个入口去独立的市场页，那里是整页的大卡片。
 * 「我的市场组件」：自己上传的组件，带审核状态、审核备注与时间。
 */
export function MarketPanel({
  p,
  theme,
  onAddPart,
  onToast,
  onOpenMarketPage,
  refreshKey = 0,
}: {
  p: Palette;
  theme?: Theme;
  /** 把组件摆到当前屏幕上 */
  onAddPart?: (part: CustomPart) => void;
  onToast?: (text: string, ms?: number, icon?: string) => void;
  /** 打开独立的市场组件页（分页浏览全部） */
  onOpenMarketPage?: () => void;
  /** 变了就重拉，例如刚上传或刚加入 */
  refreshKey?: number;
}) {
  const lang = useLang();
  const { loggedIn } = useSession();
  const [tab, setTab] = useState<MarketTab>("market");
  const [mine, setMine] = useState<MyComponent[]>([]);
  const [opened, setOpened] = useState<MarketComponent | null>(null);
  const [reload, setReload] = useState(0);

  /* 我的市场组件（上传的那一批）：分页 + 审核状态筛选 */
  const [uploads, setUploads] = useState<MarketComponent[]>([]);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadPage, setUploadPage] = useState(1);
  const [uploadAudit, setUploadAudit] = useState<number | null>(null);
  const [uploadLoad, setUploadLoad] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);

  const loadMine = useCallback(() => {
    if (!loggedIn) {
      setMine([]);
      return;
    }
    void myComponentList()
      .then((list) => setMine(list ?? []))
      .catch(() => setMine([]));
  }, [loggedIn]);

  useEffect(loadMine, [loadMine, refreshKey, reload]);

  /* 筛选或刷新一变就回到第一页：停在第三页看一个只有两页的结果是空手 */
  useEffect(() => {
    setUploadPage(1);
  }, [uploadAudit, refreshKey, reload]);

  useEffect(() => {
    if (!loggedIn) {
      setUploads([]);
      setUploadTotal(0);
      return;
    }
    let alive = true;
    setUploadLoad(true);
    setUploadFailed(false);
    void myUploadPage(uploadPage, MINE_PAGE_SIZE, null, uploadAudit)
      .then((res) => {
        if (!alive) return;
        setUploads(res.list ?? []);
        setUploadTotal(res.total ?? 0);
      })
      .catch(() => {
        if (!alive) return;
        setUploadFailed(true);
        setUploads([]);
        setUploadTotal(0);
      })
      .finally(() => {
        if (alive) setUploadLoad(false);
      });
    return () => {
      alive = false;
    };
  }, [loggedIn, uploadPage, uploadAudit, refreshKey, reload]);

  /** 加入我的组件：市场那边记一次下载量，这里把清单刷新出来并把组件摆到屏幕上 */
  const onAdd = (part: CustomPart) => {
    setReload((n) => n + 1);
    onAddPart?.(part);
  };

  /** 「我的组件」也用同一块「屏幕」来看 */
  const openMine = (component: MyComponent) => {
    setOpened({
      id: component.id,
      name: component.name,
      type: component.type,
      typeName: component.typeName,
      thumbnail: component.thumbnail,
      description: component.description,
      userName: component.sourceUserName,
      data: component.data,
    });
  };

  const removeOwned = async (component: MyComponent) => {
    try {
      await deleteMyComponent(component.id);
      setMine((cur) => cur.filter((c) => c.id !== component.id));
      onToast?.(t("myPartDeleted", lang), 2200, "delete");
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : t("marketFailed", lang), 2400, "error");
    }
  };

  /** 删掉自己上传的市场组件：市场页与「我的市场组件」都不会再看到它 */
  const removeUpload = async (component: MarketComponent) => {
    try {
      await deleteMyUpload(component.id);
      setUploads((cur) => cur.filter((c) => c.id !== component.id));
      setUploadTotal((n) => Math.max(0, n - 1));
      setReload((n) => n + 1);
      onToast?.(t("myUploadDeleted", lang), 2200, "delete");
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : t("marketFailed", lang), 2400, "error");
    }
  };

  const myPart = (component: MyComponent) =>
    partOf(component.data, `mine-${component.id}`, component.name);

  const uploadPages = Math.max(1, Math.ceil(uploadTotal / MINE_PAGE_SIZE));
  const auditOptions = [
    { value: -1, label: t("auditAll", lang) },
    { value: AUDIT_WAITING, label: t("auditWaiting", lang) },
    { value: AUDIT_PASSED, label: t("auditPassed", lang) },
    { value: AUDIT_REJECTED, label: t("auditRejected", lang) },
  ];

  const tabButton = (key: MarketTab, label: string, icon: string) => {
    const on = tab === key;
    return (
      <button
        key={key}
        onClick={() => setTab(key)}
        aria-pressed={on}
        className="m3-press"
        style={{
          flex: 1,
          height: 36,
          padding: "0 8px",
          borderRadius: 18,
          border: "none",
          background: on ? p.secondaryContainer : "transparent",
          color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <Icon name={icon} size={16} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* 「我的市场组件」和「市场组件」两页 */}
      <div style={{ display: "flex", gap: 4, padding: "10px 10px 6px", background: p.surfaceContainerLow }}>
        {tabButton("market", t("marketTab", lang), "storefront")}
        {tabButton("mine", t("marketMine", lang), "cloud_upload")}
      </div>

      {tab === "market" ? (
        <>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MarketList p={p} refreshKey={refreshKey + reload} onOpen={setOpened} />
          </div>

          {loggedIn && (
            <div style={{ borderTop: `1px solid ${p.outlineVariant}`, padding: "10px 12px 12px", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="bookmark" size={16} />
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{t("myParts", lang)}</span>
                <span style={{ fontSize: 11, color: p.onSurfaceVariant }}>{mine.length}</span>
              </div>

              {mine.length === 0 ? (
                <span style={{ fontSize: 11, color: p.onSurfaceVariant }}>{t("myPartsEmpty", lang)}</span>
              ) : (
                <div className="no-scrollbar" style={{ maxHeight: 150, overflowY: "auto", display: "grid", gap: 6 }}>
                  {mine.slice(0, MINE_LIMIT).map((component) => {
                    const parsed = myPart(component);
                    return (
                      <div
                        key={component.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "44px 1fr auto",
                          alignItems: "center",
                          gap: 8,
                          padding: 6,
                          borderRadius: 12,
                          background: p.surfaceContainerLow,
                        }}
                      >
                        <button
                          onClick={() => openMine(component)}
                          title={t("myPartDetail", lang)}
                          className="m3-press"
                          style={{
                            width: 44,
                            height: 44,
                            padding: 0,
                            borderRadius: 10,
                            border: "none",
                            overflow: "hidden",
                            background: p.surfaceContainerHighest,
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          {component.thumbnail ? (
                            <img src={component.thumbnail} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          ) : (
                            <Icon name="dashboard_customize" size={18} />
                          )}
                        </button>
                        <button
                          onClick={() => parsed && onAddPart?.(parsed)}
                          disabled={!parsed}
                          title={parsed ? t("myPartAdd", lang) : t("marketNoData", lang)}
                          className="m3-press"
                          style={{
                            minWidth: 0,
                            padding: 0,
                            border: "none",
                            background: "transparent",
                            color: p.onSurface,
                            textAlign: "left",
                            cursor: parsed ? "pointer" : "default",
                            display: "grid",
                            gap: 2,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {component.name}
                          </span>
                          <span style={{ fontSize: 10, color: p.onSurfaceVariant }}>
                            {CATEGORY_NAMES[categoryOf(component.type)]}
                            {component.sourceUserName ? ` · ${t("myPartBy", lang).replace("{name}", component.sourceUserName)}` : ""}
                          </span>
                        </button>
                        <button
                          onClick={() => void removeOwned(component)}
                          title={t("myPartDelete", lang)}
                          aria-label={t("myPartDelete", lang)}
                          className="m3-press"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            border: "none",
                            background: p.errorContainer,
                            color: p.onErrorContainer,
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <Icon name="delete" size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {onOpenMarketPage && (
                <button
                  onClick={onOpenMarketPage}
                  title={t("marketOpenHint", lang)}
                  className="m3-press"
                  style={{
                    height: 40,
                    borderRadius: 20,
                    border: "none",
                    background: p.primary,
                    color: p.onPrimary,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Icon name="open_in_new" size={18} />
                  {t("marketOpen", lang)}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        /* 「我的市场组件」：自己上传的，带审核情况 */
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
          <div style={{ padding: "6px 12px 8px" }}>
            <TypeSelect
              p={p}
              value={uploadAudit === null ? -1 : uploadAudit}
              options={auditOptions}
              title={t("auditStatus", lang)}
              onChange={(value) => setUploadAudit(value === -1 ? null : value)}
            />
          </div>

          {!loggedIn ? (
            <Hint p={p} icon="person" text={t("signInToUse", lang)} />
          ) : (
            <>
              <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 12px 10px" }}>
                {uploadLoad && uploads.length === 0 ? (
                  <Hint p={p} icon="hourglass_top" text={t("marketLoading", lang)} />
                ) : uploadFailed ? (
                  <Hint p={p} icon="cloud_off" text={t("marketMineFailed", lang)} />
                ) : uploads.length === 0 ? (
                  <Hint p={p} icon="cloud_upload" text={t("marketMineEmpty", lang)} />
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {uploads.map((component) => (
                      <UploadRow
                        key={component.id}
                        p={p}
                        component={component}
                        onOpen={() => setOpened(component)}
                        onDelete={() => void removeUpload(component)}
                      />
                    ))}
                  </div>
                )}
              </div>
              <Pager p={p} page={uploadPage} pages={uploadPages} busy={uploadLoad} onChange={setUploadPage} />
            </>
          )}
        </div>
      )}

      <MarketDialog
        p={p}
        component={opened}
        theme={theme}
        onClose={() => setOpened(null)}
        onAdd={onAdd}
        onToast={onToast}
      />
    </div>
  );
}

/** 我上传的一个市场组件：缩略图、名称、审核状态、审核备注与时间 */
function UploadRow({
  p,
  component,
  onOpen,
  onDelete,
}: {
  p: Palette;
  component: MarketComponent;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const lang = useLang();
  const status = component.auditStatus;
  const openBtn: React.CSSProperties = {
    padding: 0,
    border: "none",
    background: "transparent",
    color: p.onSurface,
    textAlign: "left",
    cursor: "pointer",
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "68px 1fr auto",
        gap: 10,
        padding: 8,
        borderRadius: 16,
        background: p.surfaceContainerLow,
      }}
    >
      <button
        onClick={onOpen}
        title={component.name}
        className="m3-press"
        style={{
          ...openBtn,
          width: 68,
          height: 68,
          borderRadius: 12,
          overflow: "hidden",
          background: p.surfaceContainerHighest,
          display: "grid",
          placeItems: "center",
        }}
      >
        {component.thumbnail ? (
          <img src={component.thumbnail} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <Icon name="image" size={20} />
        )}
      </button>

      <button
        onClick={onOpen}
        title={t("myPartDetail", lang)}
        className="m3-press"
        style={{ ...openBtn, minWidth: 0, display: "grid", gap: 3, alignContent: "start" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {component.name}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <AuditTag p={p} status={status} label={auditText(status, component.auditStatusName, lang)} />
          <span style={{ fontSize: 10, color: p.onSurfaceVariant, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="download" size={12} />
            {component.downloadCount ?? 0}
          </span>
        </span>
        {/* 通过了的组件才在市场里：这一行说清楚它此刻在不在 */}
        {status === AUDIT_PASSED && (
          <span style={{ fontSize: 10, color: p.primary }}>{t("marketInMarket", lang)}</span>
        )}
        {component.auditRemark && (
          <span style={{ fontSize: 10, lineHeight: 1.5, color: status === AUDIT_REJECTED ? p.error : p.onSurfaceVariant }}>
            {t("auditRemarkLabel", lang)}：{component.auditRemark}
          </span>
        )}
        <span style={{ fontSize: 10, color: p.outline }}>
          {t("uploadTimeLabel", lang)}：{formatWhen(component.createTime)}
          {component.auditTime ? ` · ${t("auditTimeLabel", lang)}：${formatWhen(component.auditTime)}` : ""}
        </span>
      </button>

      <button
        onClick={onDelete}
        title={t("myUploadDeleteTitle", lang)}
        aria-label={t("myUploadDelete", lang)}
        className="m3-press"
        style={{
          width: 28,
          height: 28,
          alignSelf: "start",
          borderRadius: 14,
          border: "none",
          background: p.errorContainer,
          color: p.onErrorContainer,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name="delete" size={15} />
      </button>
    </div>
  );
}

