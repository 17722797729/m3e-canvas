"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, CustomPart, Palette, Theme } from "@/lib/tokens";
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
  myComponentPage,
  myUploadPage,
} from "@/lib/syai";
import { CODE_OF_CATEGORY, CATEGORY_NAMES, categoryOf, formatWhen, partOf } from "@/lib/market";
import { useSession } from "@/lib/session";
import { Icon } from "./M3Node";
import { AuditTag, Hint, Pager, auditText } from "./MarketList";
import { MarketDialog } from "./MarketDialog";
import { TypeSelect } from "./ui";

const JOINED_PAGE_SIZE = 10;
const UPLOAD_PAGE_SIZE = 10;

/** 市场组件面板的两页：已经加入的组件，和自己上传的那一批 */
type MarketTab = "joined" | "mine";

/**
 * 市场组件面板
 * ---------------------------------------------------------------------------
 * 「已加入的组件」：从市场加入到自己名下的那一批（后端 my-page），带类型筛选与分页，
 *              可以摆到屏幕上、打开看、或删掉。
 * 「我的市场组件」：自己上传的组件，连同审核状态、审核备注与时间；
 *              底部给一个入口去独立的市场页，在整页里逛全部已公开的组件。
 */
export function MarketPanel({
  p,
  theme,
  onAddPart,
  onToast,
  onConfirmDelete,
  onOpenMarketPage,
  refreshKey = 0,
}: {
  p: Palette;
  theme?: Theme;
  /** 把组件摆到当前屏幕上 */
  onAddPart?: (part: CustomPart) => void;
  onToast?: (text: string, ms?: number, icon?: string) => void;
  /** 删除前先问一句：面板把这件事交给编辑器同一个确认框 */
  onConfirmDelete?: (title: string, body: string, run: () => void) => void;
  /** 打开独立的市场组件页（分页浏览全部） */
  onOpenMarketPage?: () => void;
  /** 变了就重拉，例如刚上传或刚加入 */
  refreshKey?: number;
}) {
  const lang = useLang();
  const { loggedIn } = useSession();
  const [tab, setTab] = useState<MarketTab>("joined");
  const [opened, setOpened] = useState<MarketComponent | null>(null);
  const [reload, setReload] = useState(0);

  /* 我上传的组件：分页 + 审核状态筛选 */
  const [uploads, setUploads] = useState<MarketComponent[]>([]);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadPage, setUploadPage] = useState(1);
  const [uploadAudit, setUploadAudit] = useState<number | null>(null);
  const [uploadLoad, setUploadLoad] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);

  /* 已加入的组件：分页 + 类型筛选 */
  const [joined, setJoined] = useState<MyComponent[]>([]);
  const [joinedTotal, setJoinedTotal] = useState(0);
  const [joinedPage, setJoinedPage] = useState(1);
  const [joinedType, setJoinedType] = useState<ComponentTypeCode | null>(null);
  const [joinedLoad, setJoinedLoad] = useState(false);
  const [joinedFailed, setJoinedFailed] = useState(false);

  /* 筛选或刷新一变就回到第一页：停在第三页看一个只有两页的结果是空手 */
  useEffect(() => {
    setJoinedPage(1);
  }, [joinedType, refreshKey, reload]);

  useEffect(() => {
    if (!loggedIn) {
      setJoined([]);
      setJoinedTotal(0);
      return;
    }
    let alive = true;
    setJoinedLoad(true);
    setJoinedFailed(false);
    void myComponentPage(joinedPage, JOINED_PAGE_SIZE, joinedType)
      .then((res) => {
        if (!alive) return;
        setJoined(res.list ?? []);
        setJoinedTotal(res.total ?? 0);
      })
      .catch(() => {
        if (!alive) return;
        setJoinedFailed(true);
        setJoined([]);
        setJoinedTotal(0);
      })
      .finally(() => {
        if (alive) setJoinedLoad(false);
      });
    return () => {
      alive = false;
    };
  }, [loggedIn, joinedPage, joinedType, refreshKey, reload]);

  /* 我上传的组件：与「已加入的组件」一样，筛选或刷新一变就回到第一页 */
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
    void myUploadPage(uploadPage, UPLOAD_PAGE_SIZE, null, uploadAudit)
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

  /** 加入我的组件：市场那边记一次下载量，这里把「已加入的组件」刷新出来 */
  const onAdd = (part: CustomPart) => {
    setReload((n) => n + 1);
    onAddPart?.(part);
  };

  /** 删掉自己上传的市场组件：市场里与「我的市场组件」都不会再看到它 */
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

  /** 从「已加入的组件」里删掉一份：后端删掉，列表随之少一条 */
  const removeJoined = async (component: MyComponent) => {
    try {
      await deleteMyComponent(component.id);
      setJoined((cur) => cur.filter((c) => c.id !== component.id));
      setJoinedTotal((n) => Math.max(0, n - 1));
      setReload((n) => n + 1);
      onToast?.(t("myPartDeleted", lang), 2200, "delete");
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : t("marketFailed", lang), 2400, "error");
    }
  };

  const joinedPages = Math.max(1, Math.ceil(joinedTotal / JOINED_PAGE_SIZE));
  const uploadPages = Math.max(1, Math.ceil(uploadTotal / UPLOAD_PAGE_SIZE));
  const auditOptions = [
    { value: -1, label: t("auditAll", lang) },
    { value: AUDIT_WAITING, label: t("auditWaiting", lang) },
    { value: AUDIT_PASSED, label: t("auditPassed", lang) },
    { value: AUDIT_REJECTED, label: t("auditRejected", lang) },
  ];
  const typeOptions = [
    { value: 0, label: t("marketAll", lang) },
    ...CATEGORIES.map((c) => ({ value: CODE_OF_CATEGORY[c.key] as number, label: CATEGORY_NAMES[c.key] })),
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
        {tabButton("joined", t("marketJoined", lang), "bookmark_added")}
        {tabButton("mine", t("marketMine", lang), "cloud_upload")}
      </div>

      {tab === "joined" ? (
        /* 「已加入的组件」：从市场加入到自己名下的那一批 */
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
          <div style={{ padding: "6px 12px 8px" }}>
            <TypeSelect
              p={p}
              value={joinedType ?? 0}
              options={typeOptions}
              title={t("marketType", lang)}
              onChange={(value) => setJoinedType(value === 0 ? null : (value as ComponentTypeCode))}
            />
          </div>

          {!loggedIn ? (
            <Hint p={p} icon="person" text={t("signInToUse", lang)} />
          ) : (
            <>
              <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 12px 10px" }}>
                {joinedLoad && joined.length === 0 ? (
                  <Hint p={p} icon="hourglass_top" text={t("marketLoading", lang)} />
                ) : joinedFailed ? (
                  <Hint p={p} icon="cloud_off" text={t("marketFailed", lang)} />
                ) : joined.length === 0 ? (
                  <Hint p={p} icon="bookmark_added" text={t("marketJoinedEmpty", lang)} />
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {joined.map((component) => (
                      <JoinedRow
                        key={component.id}
                        p={p}
                        component={component}
                        onPreview={() =>
                          setOpened({
                            id: component.id,
                            name: component.name,
                            type: component.type,
                            typeName: component.typeName,
                            thumbnail: component.thumbnail,
                            description: component.description,
                            userName: component.sourceUserName,
                            data: component.data,
                          })
                        }
                        onAdd={() => {
                          const part = partOf(component.data, `joined-${component.id}`, component.name, component.id);
                          if (part) onAddPart?.(part);
                        }}
                        onDelete={() =>
                          onConfirmDelete?.(t("myPartDeleteTitle", lang), t("deleteJoinedAsk", lang).replace("{name}", component.name), () => void removeJoined(component))
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
              <Pager p={p} page={joinedPage} pages={joinedPages} busy={joinedLoad} onChange={setJoinedPage} />
              <OpenMarketButton p={p} onClick={onOpenMarketPage} />
            </>
          )}
        </div>
      ) : (
        /* 「我的市场组件」：自己上传的，带审核状态、备注与时间 */
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
                        onDelete={() =>
                          onConfirmDelete?.(t("myUploadDeleteTitle", lang), t("deleteUploadAsk", lang).replace("{name}", component.name), () => void removeUpload(component))
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
              <Pager p={p} page={uploadPage} pages={uploadPages} busy={uploadLoad} onChange={setUploadPage} />

              <OpenMarketButton p={p} onClick={onOpenMarketPage} />
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

/** 「已加入的组件」里的一行：缩略图、名称、类型与来源作者；可以摆到屏幕上或删掉 */
function JoinedRow({
  p,
  component,
  onPreview,
  onAdd,
  onDelete,
}: {
  p: Palette;
  component: MyComponent;
  onPreview: () => void;
  /** 摆到当前屏幕上 */
  onAdd: () => void;
  onDelete: () => void;
}) {
  const lang = useLang();
  const openBtn: React.CSSProperties = {
    padding: 0,
    border: "none",
    background: "transparent",
    color: p.onSurface,
    textAlign: "left",
    cursor: "pointer",
  };
  const actionBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "58px 1fr auto",
        gap: 10,
        padding: 8,
        borderRadius: 16,
        background: p.surfaceContainerLow,
      }}
    >
      <button
        onClick={onPreview}
        title={component.name}
        className="m3-press"
        style={{
          ...openBtn,
          width: 58,
          height: 58,
          borderRadius: 12,
          overflow: "hidden",
          background: p.surfaceContainerLow,
          display: "grid",
          placeItems: "center",
        }}
      >
        {component.thumbnail ? (
          <img src={component.thumbnail} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <Icon name="dashboard_customize" size={20} />
        )}
      </button>

      <button
        onClick={onPreview}
        title={t("myPartDetail", lang)}
        className="m3-press"
        style={{ ...openBtn, minWidth: 0, display: "grid", gap: 3, alignContent: "center" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {component.name}
        </span>
        <span style={{ fontSize: 10, color: p.onSurfaceVariant, display: "flex", gap: 8, minWidth: 0 }}>
          <span>{component.typeName ?? CATEGORY_NAMES[categoryOf(component.type)]}</span>
          {component.sourceUserName ? (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t("myPartBy", lang).replace("{name}", component.sourceUserName)}
            </span>
          ) : null}
        </span>
      </button>

      <span style={{ display: "flex", gap: 4, alignSelf: "start" }}>
        <button
          onClick={onAdd}
          title={t("myPartAdd", lang)}
          aria-label={t("myPartAdd", lang)}
          className="m3-press"
          style={{ ...actionBtn, background: p.secondaryContainer, color: p.onSecondaryContainer }}
        >
          <Icon name="add_to_photos" size={15} />
        </button>
        <button
          onClick={onDelete}
          title={t("myPartDelete", lang)}
          aria-label={t("myPartDelete", lang)}
          className="m3-press"
          style={{ ...actionBtn, background: p.errorContainer, color: p.onErrorContainer }}
        >
          <Icon name="delete" size={15} />
        </button>
      </span>
    </div>
  );
}

/** 「我的市场组件」里的一行：缩略图、名称、审核状态、审核备注与时间 */
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
        gridTemplateColumns: "58px 1fr auto",
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
          width: 58,
          height: 58,
          borderRadius: 12,
          overflow: "hidden",
          background: p.surfaceContainerLow,
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
        style={{ ...openBtn, minWidth: 0, display: "grid", gap: 3, alignContent: "center" }}
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
        {status === AUDIT_PASSED && <span style={{ fontSize: 10, color: p.primary }}>{t("marketInMarket", lang)}</span>}
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
        aria-label={t("myUploadDeleteTitle", lang)}
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

/**
 * 「打开市场组件页」入口
 *
 * 「已加入的组件」与「我的市场组件」两页底部都有它：
 * 这两页管的都是「我自己的那一份」，想逛全部已公开的组件就去这一页。
 */
function OpenMarketButton({ p, onClick }: { p: Palette; onClick?: () => void }) {
  const lang = useLang();
  if (!onClick) return null;
  return (
    <div style={{ padding: "0 12px 12px" }}>
      <button
        onClick={onClick}
        title={t("marketOpenHint", lang)}
        className="m3-press"
        style={{
          width: "100%",
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
    </div>
  );
}
