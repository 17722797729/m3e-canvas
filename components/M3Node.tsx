"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  badge2ColorOf,
  badge2On,
  badge2TextOf,
  badgeColorOf,
  badgeOn,
  badgeSurface,
  badgeTextOf,
  buttonBadgeWidth,
  buttonMetrics,
  countdownLine,
  fnButtonCircle,
  fnButtonLines,
  FAB_SHADOW,
  FN_BUTTON_LINE,
  fnButtonNameInk,
  ITEM_CELL_FILL,
  ITEM_CELL_RADIUS,
  itemCellBox,
  itemCellRadius,
  roundShapeRadius,
  CONFIRM_BOX_BUTTONS,
  CONFIRM_BOX_FILL,
  CONFIRM_BOX_MAIN,
  confirmBoxButtonWords,
  confirmBoxMetrics,
  TASK_BAR_CELL_STROKE,
  TASK_BAR_CELL_STROKE_COLOR,
  TASK_BAR_FILL,
  TASK_BAR_ICON,
  TASK_BAR_VALUE,
  taskBarButtonBadge,
  taskBarButtonBadgeIcon,
  taskBarButtonLocked,
  taskBarMetrics,
  type Variant,
  timerOn,
  timerTicks,
  timerUnitOf,
  timerValueOf,
  R_INNER,
  H,
  Item,
  Kind,
  MEASURED,
  AUTHOR_WIDTHS,
  Palette,
  Radii,
  STATUS_BAR_H,
  assetPillMetrics,
  baseRadii,
  CARD_MEDIA_GAP,
  CARD_PADDING,
  CARD_TEXT_GAP,
  cardContentAlignOf,
  cardFillOf,
  cardImagePosOf,
  cardImageSizeOf,
  cardBodyColorOf,
  cardScrimOf,
  cardTextColorOf,
  colorOverrideOf,
  layerOf,
  onToken,
  paletteForItem,
  connectedButton,
  runCorners,
  scaleR,
  sizeOf,
  strokeOf,
  variantShadow,
  variantStyle,
  SETTLE_MS,
  progressThickness,
  progressTrack,
  scrollOffset,
  scrollRange,
  progressValue,
  BAR_FOLDED_W,
  isWideRail,
  NAV_ICON,
  NAV_INDICATOR,
  NAV_INDICATOR_R,
  NAV_LABEL_FONT,
  navLabelInk,
  navPerLine,
  navRows,
  railCell,
  railMetrics,
  isScrollableTabs,
  tabIndexOf,
  tabStyleOf,
  TAB_ROW_H,
  GRID_WHEEL_SIZE,
  WHEEL_SIZE,
  wheelSlice,
  gridRingCells,
  gridEdgeCells,
  GACHA_W,
  GACHA_H,
  CALENDAR_DAYS,
  CALENDAR_W,
  CALENDAR_COLS,
  calendarRows,
  secondLabel,
  gridRing,
  defaultPrizes,
  prizeLabel,
  joystickKnob,
  JOYSTICK_MAX,
  tabScrollOffset,
  SCROLL_TAB_W,
  fillColor,
  fillInk,
  slotGrid,
  rewardMarks,
  cellSlot,
  CELL_DEF,
  CELL_NAME_FONT,
  gridCheckZ,
  cellRadius,
  panelRadius,
  unitOf,
  sideRailW,
  rotOf,
  rotStyle,
  labelSideOf,
  tabShowsIcon,
  tabBadge,
  type NavTab,
  maxOf,
  clampValue,
} from "@/lib/tokens";
import { CircularProgress, LinearProgress, LoadingIndicator } from "./Loading";
import { KIND_TEXT, t, useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { railSelectedLabelColor } from "@/lib/color";

/** weight of a heading or label: heavier under the emphasized type setting */
const useWeight = () => {
  const emphasized = useTheme().emphasized;
  return (normal: number, strong: number) => (emphasized ? strong : normal);
};

export function Icon({
  name,
  size = 24,
  color,
  fill,
  weight,
}: {
  name: string;
  size?: number;
  color?: string;
  fill?: boolean;
  weight?: number;
}) {
  return (
    <span
      className="msr"
      data-fill={fill ? "1" : "0"}
      style={{
        fontSize: size,
        color,
        fontVariationSettings: weight
          ? `"FILL" ${fill ? 1 : 0}, "wght" ${weight}, "GRAD" 0, "opsz" 24`
          : undefined,
      }}
    >
      {name}
    </span>
  );
}

const ellipsis = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const NO_BOX: Kind[] = [
  "circularProgress",
  "linearProgress",
  "progressBar",
  "loadingIndicator",
  "switch",
  "checkbox",
  "radio",
  "slider",
  "text",
  "divider",
  "splitButton",
  "badge",
  "rewardTrack",
  /* the function button paints its own circle and its words, and an item cell its own square and the
     name under it, so the box around them stays plain */
  "fnButton",
  "itemCell",
];

/** Padding follows M3: icon+label is tighter than label alone. */
export function ButtonContent({ item, p }: { item: Item; p: Palette }) {
  const w = useWeight();
  const hasIcon = !!item.icon;
  const hasLabel = item.label.trim().length > 0;
  /* 按钮不再有右上角那枚徽标（作者：「去掉此属性」—— 角上的徽标仍旧是功能按钮、物品格和任务信息条
     自己的，任务信息条那一枚由 TaskBarContent 画）。所以这里只剩左图标、文字和它们之间的缝，盒子与
     画法都从 buttonMetrics 取。 */
  const m = buttonMetrics(item);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: item.size ? "100%" : undefined,
        boxSizing: "border-box",
        gap: m.gap,
        paddingLeft: m.pad,
        paddingRight: m.pad,
        /* the box's own height, which the author can set */
        height: "100%",
        fontSize: m.font,
        fontWeight: w(500, 700),
        letterSpacing: 0.1,
        whiteSpace: "nowrap",
      }}
    >
      {hasIcon && <Icon name={item.icon!} size={m.icon} fill={item.variant === "filled"} />}
      {hasLabel && <span>{item.label}</span>}
    </span>
  );
}

/**
 * 任务信息条：一条任务的信息、两个奖励格和一个「领取」按钮，全都在一个部件里 —— 这一条不是"一个框
 * 加四个孩子"，它的每一块都是一个属性（作者要求"将组合组件改为属性的方式融进单组件里面"）。
 *
 * 画的每一块都来自 taskBarMetrics —— 包围盒（sizeOf 的 taskBar 一档）用的是同一个助手，所以"盒子
 * 大小"和"画出来的样子"不会各说各话：留白、标题那一行、格子那一行和里头那个按钮都是那几个数。
 * 格子的个数、格子里的图标和格子里那个数字都是**常量**（两个 / TASK_BAR_ICON / TASK_BAR_VALUE）：
 * 那三个属性已经去掉了。
 *
 * 复用（不重画）：每个格子角上那两枚药丸就是物品格那两个角标的同一手 —— 绝对定位的 `mark()` 加上
 * 种类自己的 BadgeContent；格子里的图标就是那个 Icon；条里的按钮交给按钮自己的内容渲染器
 * ButtonContent，按钮的底、圆角和影子取按钮种类自己的那两样（variantStyle / variantShadow，和
 * boxStyle 的 button 一档同一套）；按钮右上角那枚徽标是这一条自己在按钮的**上层**画的另一层
 * （见下面 inner 那一段的注释）。
 */
function TaskBarContent({ item, p }: { item: Item; p: Palette }) {
  const w = useWeight();
  /* 条里那一枚领取按钮：由谁响应、画不画灰，见 PartPressContext —— 预览里只有它是活的 */
  const { press, off, preview } = useContext(PartPressContext);
  /** 这一下按在按钮上（按住时缩一点，和别处的按钮同一手感）；整条不再跟着缩 */
  const [held, setHeld] = useState(false);
  const m = taskBarMetrics(item);
  const title = item.label.trim();
  /* 格子里的数字：**固定**的 100 —— 奖励数量那个属性已经去掉了，格子里画的就是这个常量，这一条
     自己的 `value` 一个字都不看（老文档里写着的 23、0 读进来就让掉了，见 TASK_BAR_VALUE / readItem） */
  const count = String(TASK_BAR_VALUE);
  /* 格子的底和那圈发丝线照物品格来：同一个 ITEM_CELL_FILL，同一支 strokeOf（1dp 的
     secondaryContainer 角色），所以条里的格子和单放的一个物品格是同一个样子 */
  const cellStroke = strokeOf({ ...item, kind: "itemCell", strokeWidth: TASK_BAR_CELL_STROKE, strokeColor: TASK_BAR_CELL_STROKE_COLOR } as Item, p);
  /* 一枚角上的药丸：照物品格 `mark()` 那套 —— 绝对定位的锚点交出坐标（top 2 / left 3 / right 3），
     药丸本身交给 BadgeContent。它叠在格子的角上，所以一点都不长格子和条（见 taskBarMetrics）。
     `where` 是这一枚的角（也是给浏览器探针的稳定标记，纯新增、不参与样式和行为）。 */
  const mark = (key: string, where: "left" | "right", on: boolean, text: string, colour: string | undefined, style: React.CSSProperties) =>
    on ? (
      <span key={key} data-task-mark={where} style={{ position: "absolute", top: 2, ...style }}>
        <BadgeContent
          item={{ ...item, kind: "badge", label: text, size: undefined, size2: text ? m.markH : undefined, color: colour, strokeWidth: 0, strokeColor: undefined }}
          p={p}
        />
      </span>
    ) : null;
  /* 条里那个按钮：一个真正的按钮 —— 自己的 filled 底、半高的胶囊圆角和影子，内容交给 ButtonContent
     （带 `size` 所以它铺满这一格）。它站在一个"槽"里（`m.slot`）：槽比按钮宽出、高出的那一截就是给
     右上角那枚徽标留的地方（作者设计里的 124×48 按钮框正是这么框着 120×40 的按钮，见 taskBarMetrics）。

     那枚徽标**是这一条自己画的**，不再交给 ButtonContent：按钮种类自己那一枚是长在按钮**里面**的
     （`inset: 0` 加 2dp 内收的角上药丸），会被按钮自己的 `overflow: hidden` 裁住 —— 而作者的徽标在
     按钮的**上层**、在按钮的右上角，还可以探到按钮外面。所以：
       1. 它不是按钮的孩子，而是槽里排在按钮**后面**的一个兄弟 —— 兄弟关系加文档顺序就是"画在上层"；
       2. 按钮自己的 `overflow: hidden` 拦不到它（它不在按钮里），这一条的盒子也拦不到它（槽把这一截
          留在了条自己的盒子里，见 taskBarMetrics）；
       3. 它 `pointer-events: none`（和物品格那两枚角标、功能按钮那颗点同一个规矩），所以它既不吃点击
          也不撑大任何东西 —— 这一条里唯一吃点击的是它下面那颗按钮（见 PartPressContext）。锁住按钮
          靠的是语义，不是这一层拦不拦事件（见 taskBarButtonLocked）。 */
  const inner: Item = {
    ...item,
    kind: "button",
    label: (item.label2 ?? "").trim(),
    icon: null,
    variant: "filled",
    size: m.button.w,
    size2: m.button.h,
    /* 这一条自己的徽标由下面那一层画：按钮种类自己的右徽标一个字都没改，只是这一条不再用它 */
    badge: undefined,
    badgeText: undefined,
  };
  const badgeIcon = taskBarButtonBadgeIcon(item);
  const badgeText = taskBarButtonBadge(item);
  /* 药丸自己多宽：图标就是一枚圆药丸（高那么宽），字按它自己的字号估宽（和按钮自己那枚同一支笔） */
  const badgeW = badgeIcon ? m.badge.h : badgeText ? buttonBadgeWidth(badgeText, m.badge.h) : 0;
  const hasBadge = !!badgeIcon || !!badgeText;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        /* 上留白 + 标题 + 缝 + 格子那一行 + 下留白 = taskBarMetrics 那个高（见那里） */
        padding: `${m.padTop}px ${m.padX}px ${m.padBottom}px`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {title && (
        <div
          style={{
            height: m.titleLine,
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            fontSize: m.titleFont,
            lineHeight: 1,
            fontWeight: w(400, 600),
            color: p.onSurface,
            /* 一行：标题再长也把它省略掉，不把条撑高（所以盒子和画法永远说得上话） */
            ...ellipsis,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ marginTop: m.gap, height: m.row, flex: "0 0 auto", display: "flex", alignItems: "center", gap: m.cellGap }}>
        {/* 奖励格永远是那两个（`cells` 现在是个常量 2）：数一数这个属性已经去掉了，没有别的画法 */}
        {Array.from({ length: 2 }, (_, i) => (
          <span
            key={i}
            data-task-cell={i + 1}
            style={{
              position: "relative",
              width: m.cell,
              height: m.cell,
              flex: "0 0 auto",
              boxSizing: "border-box",
              borderRadius: ITEM_CELL_RADIUS,
              background: fillColor(ITEM_CELL_FILL, p, ITEM_CELL_FILL),
              color: fillInk(ITEM_CELL_FILL, p, ITEM_CELL_FILL),
              boxShadow: cellStroke ?? undefined,
            }}
          >
            <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              {/* 奖励图标：物品格那个图标的同一个大小和同一种墨（primary 角色）。画的是那个**固定**的
                  默认奖励图标，不是这一条自己的 `icon` —— 奖励图标没有可改的控件，存下来的那个字段
                  读进来就让掉了（见 TASK_BAR_ICON / readItem）。右下角那个数字同样是那个固定的
                  TASK_BAR_VALUE（奖励数量那个属性也去掉了，存下来的 `value` 一并让掉）。 */}
              <Icon name={TASK_BAR_ICON} size={Math.round(m.cell * 0.4)} color={p.primary} />
            </span>
            {count && (
              <span
                style={{
                  position: "absolute",
                  right: Math.round(m.cell * 0.1),
                  bottom: Math.round(m.cell * 0.06),
                  fontSize: Math.max(9, Math.min(24, Math.round(m.cell * 0.23))),
                  lineHeight: 1,
                  fontWeight: w(500, 700),
                }}
              >
                {count}
              </span>
            )}
            {/* 角标①在左、角标②在右：作者定的那一对（见 Item.badge / badgeColor 的注释） */}
            {mark("first", "left", badgeOn(item), badgeTextOf(item), badgeColorOf(item), { left: 3 })}
            {mark("second", "right", badge2On(item), badge2TextOf(item), badge2ColorOf(item) ?? "secondaryContainer", { right: 3 })}
          </span>
        ))}
        <span
          data-task-button-slot=""
          data-task-button-off={off ? "" : undefined}
          style={{
            /* 按钮和它右上角那枚徽标共用的那一槽：宽 120+9、高 40+4（见 taskBarMetrics 的 slot），
               行里占地方的是它 —— 徽标探出按钮的那一截就在这个盒子里，所以条自己的 overflow: hidden
               也裁不到它。按钮靠 marginLeft: auto 靠在行的右端（和从前一样）。 */
            position: "relative",
            flex: "0 0 auto",
            marginLeft: "auto",
            width: m.slot.w,
            height: m.slot.h,
            boxSizing: "border-box",
            /* 「置灰并停止响应」落在这一槽上（按钮 + 它右上角那枚徽标）：条里唯一活着的东西就是它，
               灰就该灰它 —— 标题和奖励格照旧画，整条也不因此不吃事件（见 disablesWholePart）。 */
            ...(off ? { filter: "grayscale(1)", opacity: 0.55 } : undefined),
          }}
        >
          <button
            type="button"
            data-task-button=""
            /* 关掉的时候把"这是个能点的东西"也说清楚：屏幕阅读器听到的是一颗不可用的按钮 */
            aria-disabled={off || undefined}
            /* 这一条里唯一吃点击的地方。整条从前的点击目标就是它 —— 于是点标题、点奖励格都会走这一下的
               action（作者的原话「点击相当于是点击整个容器」）。现在按下的落点收在这一格上：
                 · 有 `press`（预览里才有人给）时，pointerdown 就 stopPropagation —— 整条不做那个
                   0.97 的按下反馈，反馈落在按钮自己身上；
                 · click 也 stopPropagation，再调 press()：那一次点击该做的事（状态机、action）在
                   Preview 的 Tappable 里，一份逻辑、两个入口，不在这里重写一遍。
               没有 `press` 的时候（编辑器画布、导出图、市场缩略图）两个处理器都不挂 —— 按钮是死的，
               但**不能**写 disabled：禁用的表单控件在浏览器里连 pointerdown 都不派发，编辑器就没法
               从按钮上按下去拖动这一条了。 */
            onPointerDown={
              swallowsInnerTap(preview, !!press)
                ? (e) => {
                    e.stopPropagation();
                    if (!off) setHeld(true);
                  }
                : undefined
            }
            onPointerUp={() => setHeld(false)}
            onPointerCancel={() => setHeld(false)}
            onPointerLeave={() => setHeld(false)}
            onClick={
              swallowsInnerTap(preview, !!press)
                ? (e) => {
                    e.stopPropagation();
                    press?.();
                  }
                : undefined
            }
            style={{
              /* 按钮自己还是那颗胶囊：120×40，落在槽的左下角（槽比它高出的那 4dp 全在它上面，留给了
                 徽标），自己的 overflow: hidden 只管它自己这一格的底和内容 */
              position: "absolute",
              left: 0,
              bottom: 0,
              width: m.button.w,
              height: m.button.h,
              borderRadius: m.button.h / 2,
              boxSizing: "border-box",
              overflow: "hidden",
              /* 真按钮要自己清掉浏览器给的那几样：内边距、边框、字体（不 inherit 的话标签会换字体），
                 以及焦点框（点一下不该在画布上留一圈描边；键盘 Tab 过来仍有 :focus-visible） */
              padding: 0,
              border: "none",
              font: "inherit",
              outline: "none",
              display: "block",
              /* 预览里这颗按钮就有按下的手感（哪怕它这一条还没配 action），和确认框那两颗同一条规矩 */
              cursor: swallowsInnerTap(preview, !!press) && !off ? "pointer" : "default",
              /* 只有预览里才可能出现"按住"这一下；导出的图里不该带上与交互有关的东西 */
              ...(swallowsInnerTap(preview, !!press) && !off ? { transition: "transform 120ms cubic-bezier(0.2, 0, 0, 1)" } : undefined),
              transform: held ? "scale(0.94)" : undefined,
              boxShadow: variantShadow("filled"),
              ...variantStyle("filled", p),
            }}
          >
            <ButtonContent item={inner} p={p} />
          </button>
          {/* 那枚徽标：槽里排在按钮后面的一层，站在槽的右上角 —— 于是它压在按钮的右上角、并且探出
              按钮的右边 9dp、上面 4dp。药丸交给 BadgeContent（和别处同一支笔），尺寸就是这一槽留给
              它的那一块，所以"量到的"就是"画出来的"。 */}
          {hasBadge && (
            <span
              data-task-badge=""
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: badgeW,
                height: m.badge.h,
                pointerEvents: "none",
              }}
            >
              <BadgeContent
                item={{ ...item, kind: "badge", label: badgeText ?? "", size: badgeW, size2: m.badge.h, color: undefined, strokeWidth: 0, strokeColor: undefined }}
                p={p}
                icon={badgeIcon}
              />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * 确认框：标题、正文和两颗普通按钮，全都在一个部件里 —— 这一块不是"一个框加三个孩子"，它的每一块
 * 都是一个属性（作者要求"融合成单组件"，见 docs/reference-prototypes/confirm-box.md）。
 *
 * 画的每一块都来自 confirmBoxMetrics —— 包围盒（sizeOf 的 confirmBox 一档）用的是同一个助手，所以
 * "盒子大小"和"画出来的样子"不会各说各话：留白、标题那一行、正文带和底下那两颗按钮都是那几个数。
 *
 * 复用（不重画）：两颗按钮的内容交给按钮自己的内容渲染器 ButtonContent，底、圆角和影子取按钮种类
 * 自己的那两样（variantStyle / variantShadow，和 boxStyle 的 button 一档同一套）—— 和任务信息条里
 * 那颗领取按钮同一支笔。那条正文带和框**同色**（原稿就是这么画的），所以它在框上看不见，只是正文的
 * 排版盒子（量折行用的，见 confirmBoxMetrics）。
 *
 * 点击：整块框不吃点击，**只有里面那两颗按钮吃**（作者报的「点击相当于是点击整个容器」就是这件事）。
 * 它们各自那一下通过 PartPressContext 从 Preview 的 Tappable 递下来（见 PartPressContext 与
 * swallowsInnerTap）：主按钮（确认）走 `press`，取消走 `pressSlot("cancel")`。编辑器画布、导出图和
 * 市场缩略图里没有人提供它，两颗按钮因此是死的，但**不能**写 disabled —— 禁用的表单控件连 pointerdown
 * 都不派发，编辑器就没法从按钮上按下拖动这一块了。
 */
function ConfirmBoxContent({ item, p }: { item: Item; p: Palette }) {
  const w = useWeight();
  const { press, pressSlot, off, preview } = useContext(PartPressContext);
  /** 哪一颗正被按住（按住时缩一点，和别处的按钮同一手感）；框不跟着缩 */
  const [held, setHeld] = useState<string | null>(null);
  const m = confirmBoxMetrics(item);
  const title = item.label.trim();
  const body = (item.supporting ?? "").trim();
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        /* 上留白 + 标题 + 缝 + 正文带 + 缝 + 按钮那一行 + 下留白 = confirmBoxMetrics 那个高（见那里） */
        padding: `${m.padTop}px ${m.padX}px ${m.padBottom}px`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!!title && (
        <div
          style={{
            height: m.titleLine,
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            /* 标题**居中**：原稿那句「温馨提示」就摆在框的正中 */
            textAlign: "center",
            fontSize: m.titleFont,
            lineHeight: 1,
            fontWeight: w(400, 600),
            color: p.onSurface,
            /* 一行：标题再长也把它省略掉，不把框撑高（所以盒子和画法永远说得上话） */
            ...ellipsis,
          }}
        >
          {title}
        </div>
      )}
      {!!m.band.h && (
        <div
          data-confirm-band=""
          style={{
            /* 标题和带之间那道缝：标题空着时那一行和缝一起不占（见 confirmBoxMetrics 的那道式子） */
            marginTop: title ? m.gap : 0,
            width: m.band.w,
            height: m.band.h,
            flex: "0 0 auto",
            boxSizing: "border-box",
            paddingTop: m.bodyPadTop,
            paddingLeft: m.bodyPadLeft,
            /* 带和框同色：原稿就是这么画的，所以它在框上看不见 —— 它只是正文的排版盒子 */
            background: "transparent",
          }}
        >
          <div
            style={{
              fontSize: m.bodyFont,
              lineHeight: `${m.bodyLine}px`,
              color: p.onSurface,
              /* 正文左对齐（带内左 25、上 10，见 CONFIRM_BOX_BODY_PAD_LEFT） */
              textAlign: "left",
              /* 作者自己的换行留着；长单词（西文）折行而不是溢出 —— 框的高度是同一个函数量出来的 */
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {body}
          </div>
        </div>
      )}
      <div
        style={{
          /* 正文带和按钮之间那道缝：带空着时它和缝一起不占（见 confirmBoxMetrics） */
          marginTop: m.band.h ? m.gap : 0,
          height: m.button.h,
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          /* 左「取消」右「确认」：两颗各占一头，中间那道缝就是框宽减去两边留白和两个按钮 */
          justifyContent: "space-between",
        }}
      >
        {CONFIRM_BOX_BUTTONS.map((b) => {
          const words = confirmBoxButtonWords(item, b.slot);
          /* 这一颗自己的那一下：主按钮（确认）就是这一部件自己的（`flow` / `action`），取消走它那个槽
             （见 tokens 的 CONFIRM_BOX_MAIN / CONFIRM_BOX_CANCEL_SLOT 与 Preview 的 pickSlot） */
          const tap = b.slot === CONFIRM_BOX_MAIN ? press : pressSlot?.(b.slot);
          /* 两颗**一模一样**：同样的吞、同样的手感、同样的画法，只有各自的词和各自的去处不同
             （作者：「取消和确认是完全一样的普通按钮，跟名称没有关系」） */
          const swallow = swallowsInnerTap(preview, !!tap);
          return (
            <button
              key={b.field}
              type="button"
              data-confirm-button={b.slot || "main"}
              data-confirm-button-off={off ? "" : undefined}
              /* 关掉的时候把"这是个能点的东西"也说清楚：屏幕阅读器听到的是一颗不可用的按钮 */
              aria-disabled={off || undefined}
              /* 只有有人接的时候才吞这一下：编辑器画布里按住按钮是"从按钮上拖走这一块"的手势，
                 吞掉的话就拖不动了（见 swallowsInnerTap）。预览里一律吞。 */
              onPointerDown={
                swallow
                  ? (e) => {
                      e.stopPropagation();
                      if (!off) setHeld(b.field);
                    }
                  : undefined
              }
              onPointerUp={() => setHeld(null)}
              onPointerCancel={() => setHeld(null)}
              onPointerLeave={() => setHeld(null)}
              onClick={
                swallow
                  ? (e) => {
                      e.stopPropagation();
                      tap?.();
                    }
                  : undefined
              }
              style={{
                /* 按钮是那颗胶囊：104×49、半高的圆角；自己的 overflow: hidden 只管自己这一格的底和内容 */
                width: m.button.w,
                height: m.button.h,
                borderRadius: m.button.h / 2,
                boxSizing: "border-box",
                overflow: "hidden",
                /* 真按钮要自己清掉浏览器给的那几样（和任务信息条那颗按钮同一个理由：内边距、边框、
                   字体、焦点框）。也**不能**写 disabled，理由见上面那段 */
                padding: 0,
                border: "none",
                font: "inherit",
                outline: "none",
                display: "block",
                /* 预览里这两颗按钮就有按下的手感（哪怕还没配去处） */
                cursor: swallow && !off ? "pointer" : "default",
                /* 只有预览里才可能出现"按住"这一下；导出的图里不该带上与交互有关的东西 */
                ...(swallow && !off ? { transition: "transform 120ms cubic-bezier(0.2, 0, 0, 1)" } : undefined),
                transform: held === b.field ? "scale(0.94)" : undefined,
                /* 「置灰并停止响应」灰的是**这两颗按钮**，不是整块框（见 disablesWholePart） */
                ...(off ? { filter: "grayscale(1)", opacity: 0.55 } : undefined),
                boxShadow: variantShadow("filled"),
                ...variantStyle("filled", p),
              }}
            >
              <ButtonContent
                item={{ ...item, kind: "button", label: words, icon: null, variant: "filled", size: m.button.w, size2: m.button.h }}
                p={p}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExtendedFabContent({ item }: { item: Item }) {
  const w = useWeight();
  const hasIcon = !!item.icon;
  const hasLabel = item.label.trim().length > 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: hasIcon && hasLabel ? 12 : 0,
        padding: "0 20px",
        height: 56,
        fontSize: 14,
        fontWeight: w(500, 700),
        whiteSpace: "nowrap",
      }}
    >
      {hasIcon && <Icon name={item.icon!} size={24} />}
      {hasLabel && <span>{item.label}</span>}
    </span>
  );
}

/* ---------- the second hand a function button counts on ---------- */

/**
 * One clock for the whole editor: every part that counts by the second subscribes here, so a screen
 * full of countdowns still runs a single interval, and the last part to leave stops it. The interval
 * is only ever started from an effect (see useSecondHand), so the first paint — the server's and the
 * client's first render alike — shows the count the author set and hydration cannot mismatch.
 */
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;
function subscribeTick(fn: () => void): () => void {
  tickListeners.add(fn);
  if (tickTimer === null) tickTimer = setInterval(() => { for (const l of [...tickListeners]) l(); }, 1000);
  return () => {
    tickListeners.delete(fn);
    if (tickListeners.size === 0 && tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

/**
 * How many seconds this part has been on screen. Nothing here writes to the item: the tick is drawn,
 * never saved. The author's own number is where the countdown starts, so changing the count or the
 * unit (or reusing the component for another part) puts the hand back to zero.
 */
function useSecondHand(on: boolean, restart: string): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (!on) return;
    return subscribeTick(() => setElapsed((s) => s + 1));
  }, [on, restart]);
  return elapsed;
}

/**
 * A function button: the round button and, under it, the lines it actually says — its name and, while
 * the timer is on, the countdown. An empty name and a switched-off timer take no room at all.
 *
 * It is a component of its own because it owns the one thing no other kind has: a second hand. Minutes
 * and seconds count down while it is on screen; a still drawing — a market thumbnail, the export's
 * snapshot, anything rendered without effects — keeps the author's own number.
 */
function FnButtonContent({ item, p, still }: { item: Item; p: Palette; still?: boolean }) {
  const lang = useLang();
  const w = useWeight();
  const value = timerValueOf(item);
  const unit = timerUnitOf(item);
  const elapsed = useSecondHand(!still && timerOn(item) && timerTicks(unit), `${item.id}:${unit}:${value}`);

  const box = sizeOf(item, {});
  const label = item.label.trim();
  const countdown = countdownLine(item, lang, elapsed);
  /* the circle and the line count come from the same helpers `sizeOf` measured with, so the box is
     exactly the size of what is drawn and the round corner is the one `baseRadii` reports */
  const d = fnButtonCircle(item, box.w);
  const lines = fnButtonLines(item);
  const row = lines > 0 ? Math.max(8, Math.round((box.h - d) / lines)) : 0;
  /* 两行用同一个字号（作者要求统一），取值随部件宽度走，并留出行的余量 */
  const font = Math.max(9, Math.min(18, Math.round(box.w * 0.32)));
  const lineStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: row,
    display: "grid",
    placeItems: "center",
    fontSize: font,
    lineHeight: 1,
    fontWeight: w(500, 700),
    color: p.onSurface,
    ...ellipsis,
  };
  /* 只有第一行（功能名）用作者选的颜色，第二行是计时，颜色照旧 —— 一个颜色不会漏到时间上 */
  const nameStyle: React.CSSProperties = { ...lineStyle, color: fnButtonNameInk(item, p) };

  /* the badge: an empty one is the bare dot a "new" mark is, and its words make it a pill */
  const badgeText = badgeTextOf(item);
  const dot = Math.max(6, Math.round(d * 0.16));
  const badgeH = badgeText ? Math.max(12, Math.round(d * 0.3)) : dot;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          left: Math.round((box.w - d) / 2),
          top: 0,
          width: d,
          height: d,
          /* circle or rounded square: the same two outlines an icon button takes */
          borderRadius: roundShapeRadius(item.shape, d),
          display: "grid",
          placeItems: "center",
          boxSizing: "border-box",
          /* The shadow a floating button carries, so it reads as floating on any surface — except on
             the two flat variants, which have nothing to float: a shadow under a transparent outline
             reads as a mistake. The line under the circle stays onSurface and the badge keeps its own
             error colours, so both are legible whatever the circle wears. */
          boxShadow: item.variant === "outlined" || item.variant === "text" ? "none" : FAB_SHADOW,
          ...variantStyle(item.variant, p),
        }}
      >
        {/* the glyph takes the variant's own ink (it inherits the circle's colour); only a filled
            circle draws the solid icon, as the button kind does */}
        {item.icon && <Icon name={item.icon} size={Math.round(d * 0.44)} fill={item.variant === "filled"} />}
      </div>
      {badgeOn(item) && (
        <span
          style={{
            position: "absolute",
            top: 0,
            /* the mark's trailing edge rides the circle's own right edge, whatever size it is */
            right: Math.round((box.w - d) / 2),
            minWidth: badgeH,
            height: badgeH,
            padding: badgeText ? `0 ${Math.max(4, Math.round(badgeH * 0.35))}px` : 0,
            borderRadius: badgeH / 2,
            boxSizing: "border-box",
            background: p.error,
            color: p.onError,
            display: "grid",
            placeItems: "center",
            fontSize: Math.max(8, Math.round(badgeH * 0.66)),
            lineHeight: 1,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {badgeText}
        </span>
      )}
      {label && <div style={{ ...nameStyle, top: d }}>{label}</div>}
      {countdown && <div style={{ ...lineStyle, top: d + (label ? row : 0) }}>{countdown}</div>}
    </div>
  );
}

function ChipContent({ item, p }: { item: Item; p: Palette }) {
  const on = !!item.checked;
  const lead = on ? "check" : item.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        paddingLeft: lead ? 8 : 16,
        paddingRight: 16,
        height: 32,
        fontSize: 14,
        fontWeight: 500,
        whiteSpace: "nowrap",
        color: on ? p.onSecondaryContainer : undefined,
      }}
    >
      {lead && <Icon name={lead} size={18} />}
      <span>{item.label}</span>
    </span>
  );
}

function SwitchContent({ item, p }: { item: Item; p: Palette }) {
  const hasLabel = item.label.trim().length > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14, height: H - 8, whiteSpace: "nowrap", width: item.size ? "100%" : undefined, justifyContent: item.size ? "space-between" : undefined }}>
      {hasLabel && <span style={{ fontSize: 16, color: p.onSurface, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>}
      <SwitchControl on={!!item.checked} noCheck={!!item.noCheck} p={p} />
    </span>
  );
}

/** the M3 switch track and handle, 52 × 32 */
function SwitchControl({ on, noCheck, p }: { on: boolean; noCheck?: boolean; p: Palette }) {
  return (
    <span
        style={{
          position: "relative",
          width: 52,
          height: 32,
          borderRadius: 16,
          background: on ? p.primary : p.surfaceContainerHighest,
          border: on ? "2px solid transparent" : `2px solid ${p.outline}`,
          boxSizing: "border-box",
          flex: "0 0 auto",
          transition: "background 160ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: on ? 22 : 4,
            width: on ? 24 : 16,
            height: on ? 24 : 16,
            marginTop: on ? -12 : -8,
            borderRadius: 12,
            background: on ? p.onPrimary : p.outline,
            display: "grid",
            placeItems: "center",
            color: p.onPrimaryContainer,
            transition: "left 160ms, width 160ms, height 160ms",
          }}
        >
          {on && !noCheck && <Icon name="check" size={16} weight={600} />}
        </span>
      </span>
  );
}

function CheckboxContent({ item, p }: { item: Item; p: Palette }) {
  const on = !!item.checked;
  const hasLabel = item.label.trim().length > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 40, whiteSpace: "nowrap" }}>
      <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            boxSizing: "border-box",
            border: on ? "none" : `2px solid ${p.onSurfaceVariant}`,
            background: on ? p.primary : "transparent",
            color: p.onPrimary,
            display: "grid",
            placeItems: "center",
          }}
        >
          {on && <Icon name="check" size={16} weight={700} />}
        </span>
      </span>
      {hasLabel && <span style={{ fontSize: 16, color: p.onSurface, paddingRight: 8 }}>{item.label}</span>}
    </span>
  );
}

function TextContent({ item, p }: { item: Item; p: Palette }) {
  const w = useWeight();
  const fs = item.size ?? 28;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: fs,
        lineHeight: 1.3,
        fontWeight: item.bold ? w(700, 800) : w(400, fs >= 22 ? 600 : 500),
        letterSpacing: fs >= 28 ? -0.25 : 0,
        color: p.onSurface,
        whiteSpace: "nowrap",
        padding: "0 2px",
      }}
    >
      {item.label || " "}
    </span>
  );
}

/** A split button: the labeled action and, after a hairline gap, a menu trigger.
 *  The two halves keep their own corners, so the box around them stays plain. */
function SplitButtonContent({ item, p }: { item: Item; p: Palette }) {
  const w = useWeight();
  const st = variantStyle(item.variant, p);
  const outer = scaleR(28);
  const inner = scaleR(8);
  const hasLabel = item.label.trim().length > 0;
  const shadow = variantShadow(item.variant);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, height: H }}>
      <span
        style={{
          ...st,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: H,
          padding: hasLabel ? "0 20px 0 22px" : "0 16px",
          borderTopLeftRadius: outer,
          borderBottomLeftRadius: outer,
          borderTopRightRadius: inner,
          borderBottomRightRadius: inner,
          fontSize: 16,
          fontWeight: w(500, 700),
          whiteSpace: "nowrap",
          boxSizing: "border-box",
          boxShadow: shadow,
        }}
      >
        {item.icon && <Icon name={item.icon} size={22} fill={item.variant === "filled"} />}
        {hasLabel && <span>{item.label}</span>}
      </span>
      <span
        style={{
          ...st,
          display: "inline-grid",
          placeItems: "center",
          width: 52,
          height: H,
          borderTopLeftRadius: inner,
          borderBottomLeftRadius: inner,
          borderTopRightRadius: outer,
          borderBottomRightRadius: outer,
          boxSizing: "border-box",
          boxShadow: shadow,
        }}
      >
        <Icon name="keyboard_arrow_down" size={24} />
      </span>
    </span>
  );
}

function RadioContent({ item, p }: { item: Item; p: Palette }) {
  const on = !!item.checked;
  const hasLabel = item.label.trim().length > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 40, whiteSpace: "nowrap" }}>
      <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            boxSizing: "border-box",
            border: `2px solid ${on ? p.primary : p.onSurfaceVariant}`,
            display: "grid",
            placeItems: "center",
          }}
        >
          {on && <span style={{ width: 10, height: 10, borderRadius: 5, background: p.primary }} />}
        </span>
      </span>
      {hasLabel && <span style={{ fontSize: 16, color: p.onSurface, paddingRight: 8 }}>{item.label}</span>}
    </span>
  );
}

/** A badge: a 6dp dot when it has no text, a 16dp pill with the count otherwise. `place` moves the
 *  pill inside the box it was given, on the grid alignment the caller names (a corner badge asks for
 *  `"start end"` — top trailing corner — where everything else wants the middle). */
export function BadgeContent({ item, p, place, icon }: { item: Item; p: Palette; place?: "center" | "start end"; icon?: string | null }) {
  /* 徽标里画的是字还是图标：一枚药丸只说一件事 —— 给了图标就画图标（图标优先，见 taskBarButtonBadgeOn），
     字让位。别的调用方不传 icon，画法一个像素都不变。 */
  const text = (icon ? "" : item.label).trim();
  /* a badge the author sized fills the box it was given; otherwise it hugs its number
     (a dot when it is empty) */
  const own = item.size !== undefined;
  const h = item.size2 ?? (text ? 16 : 6);
  const w = own ? "100%" : icon ? h : text ? undefined : 6;
  /* the number shrinks and grows with the badge, so a short one is not spilling out of its pill */
  const pad = Math.max(2, Math.round(h / 4));
  /* 图标跟字一样大：同一条 0.7 的规矩，所以换成锁图标时那枚药丸不会忽然变胖或变瘦 */
  const markSize = Math.max(8, Math.min(20, Math.round(h * 0.7)));
  return (
    /* Centred in the box, whichever way the author sized it: the pill is drawn as tall as they
       asked, from the middle out — a top-anchored pill looked like the badge was shrinking from
       the bottom only. (A badge handed a corner asks for `place: "start end"` instead.) */
    <div style={{ display: "grid", placeItems: place ?? "center", height: "100%", boxSizing: "border-box" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: w,
          minWidth: own || !text ? undefined : Math.max(6, h),
          height: h,
          padding: text && !own ? `0 ${pad}px` : 0,
          borderRadius: h / 2,
          boxSizing: "border-box",
          /* the pill is the badge: its colour and its border live here (see badgeSurface) */
          ...badgeSurface(item, p),
          fontSize: markSize,
          fontWeight: 500,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {icon ? <Icon name={icon} size={markSize} /> : text}
      </span>
    </div>
  );
}

/** Content for kinds that size to their text; rendered again offscreen to measure. */
/**
 * 资产框的内容：金额，以及它两旁作者摆的圆图标。图标多大、间距多宽、留白多宽、字多大，全部来自
 * assetPillMetrics —— 和包围盒（sizeOf）同一个来源，所以盒子和画出来的东西不会各说各话。
 *
 * 它是一个"量出来的"部件（见 MEASURED）：宽度不受限时由浏览器按真实的字体量出内容宽度（少一个图标
 * 就少一个图标加一个间距），所以金额不会被省略；作者钉了宽度时才回到"文字让位"的老规矩。
 */
export function AssetPillContent({ item, p }: { item: Item; p: Palette }) {
  const w = useWeight();
  const { chip, gap, inset, font } = assetPillMetrics(item);
  const amount = item.label.trim();
  /* 作者钉了宽度，文字就是唯一能让位的子项；没钉的时候宽度由内容决定，文字不缩也不省略 */
  const pinned = item.size !== undefined;
  /* 两边的圆图标取部件自己的 variant（编辑器的"样式"一行，和按钮同一套标签）：一个选择管两个
     图标，和条本身的 fill 各管各的——所以填充的条上也能是一个描边的图标。border-box 让描边的 1dp
     画在 20dp 之内，几何和包围盒都还算这个大小。 */
  const mark = (key: string, name: string | null | undefined) =>
    name ? (
      <span
        key={key}
        style={{
          width: chip,
          height: chip,
          flex: "0 0 auto",
          borderRadius: chip / 2,
          display: "grid",
          placeItems: "center",
          boxSizing: "border-box",
          ...variantStyle(item.variant, p),
        }}
      >
        {/* the glyph takes the chip's own ink (it inherits the colour); a filled chip draws it solid */}
        <Icon name={name} size={Math.round(chip * 0.6)} fill={item.variant === "filled"} />
      </span>
    ) : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
        height: "100%",
        padding: `0 ${inset}px`,
        boxSizing: "border-box",
        /* the row itself may not be squeezed: the box is either the content's own width or the one the
           author pinned, and in the pinned case the words are what gives way */
        minWidth: 0,
      }}
    >
      {mark("left", item.icon)}
      {amount && (
        <span
          style={{
            fontSize: font,
            lineHeight: 1,
            fontWeight: w(500, 700),
            whiteSpace: "nowrap",
            ...(pinned ? { flex: "0 1 auto", minWidth: 0, ...ellipsis } : { flex: "0 0 auto" }),
          }}
        >
          {amount}
        </span>
      )}
      {mark("right", item.icon2)}
    </div>
  );
}

export function MeasuredContent({ item, p }: { item: Item; p: Palette }) {
  switch (item.kind) {
    case "button":
      return <ButtonContent item={item} p={p} />;
    case "extendedFab":
      return <ExtendedFabContent item={item} />;
    case "chip":
      return <ChipContent item={item} p={p} />;
    case "switch":
      return <SwitchContent item={item} p={p} />;
    case "checkbox":
      return <CheckboxContent item={item} p={p} />;
    case "text":
      return <TextContent item={item} p={p} />;
    case "splitButton":
      return <SplitButtonContent item={item} p={p} />;
    case "radio":
      return <RadioContent item={item} p={p} />;
    case "badge":
      return <BadgeContent item={item} p={p} />;
    case "assetPill":
      return <AssetPillContent item={item} p={p} />;
    default:
      return null;
  }
}

/** How thick a scroll bar is drawn, and how short its thumb may get. */
const SCROLL_BAR = 4;
const SCROLL_THUMB_MIN = 24;

/**
 * A container's children where the container scrolls: moved by the offset its content is at, with a
 * slim bar on the axis that has room to move so the design itself says the content goes on. The box
 * around it clips, so what has been scrolled past is simply not drawn — in the canvas, in the export
 * and in the preview alike, which is what keeps the three showing the same thing.
 */
function ScrollLayer({
  item,
  p,
  widths,
  scroll,
  children,
}: {
  item: Item;
  p: Palette;
  widths: Record<string, number>;
  /** what the visitor has moved the content to; the offset the author designed when absent */
  scroll?: { x?: number; y?: number };
  children?: React.ReactNode;
}) {
  /* a slot grid draws its child frame itself; its cells are ordinary children and sit on top */
  const inside = item.kind === "invGrid" ? <><GridPanel item={item} p={p} widths={widths} />{children}</> : children;
  if (!inside) return null;
  if (!item.scroll) return <>{inside}</>;
  const size = sizeOf(item, widths);
  const range = scrollRange(item, widths);
  const at = scrollOffset(item, widths, scroll);
  const bar = (axis: "x" | "y") => {
    const max = axis === "y" ? range.y : range.x;
    if (max <= 0) return null;
    const view = axis === "y" ? size.h : size.w;
    const track = view;
    const thumb = Math.max(SCROLL_THUMB_MIN, Math.round((view / (view + max)) * track));
    const pos = Math.round(((axis === "y" ? at.y : at.x) / max) * (track - thumb));
    return (
      <div
        key={axis}
        data-scrollbar={axis}
        style={{
          position: "absolute",
          pointerEvents: "none",
          borderRadius: SCROLL_BAR / 2,
          background: p.outline,
          opacity: 0.6,
          ...(axis === "y" ? { right: 3, top: pos, width: SCROLL_BAR, height: thumb } : { bottom: 3, left: pos, height: SCROLL_BAR, width: thumb }),
        }}
      />
    );
  };
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${-at.x}px, ${-at.y}px)` }}>{inside}</div>
      {bar("y")}
      {bar("x")}
    </>
  );
}

/**
 * A slot grid's child frame: the inset panel its cells sit on. It is drawn in the part's own
 * coordinates, and the frame scrolls over it together with the cells — so a board with more rows
 * than the frame fits slides whole, the child frame included, which is what the author drew.
 */
function GridPanel({ item, p, widths }: { item: Item; p: Palette; widths: Record<string, number> }) {
  const lang = useLang();
  const g = slotGrid(item, widths);
  /* the item name under a cell that holds something: what the author typed, or the kind's own
     placeholder while the field is still empty, so the switch shows something the moment it is on */
  const name = item.cellText?.trim() || t("cellItemName", lang);
  return (
    <>
      <div
        data-grid="panel"
        style={{
          position: "absolute",
          left: g.panel.x,
          top: g.panel.y,
          width: g.panel.w,
          height: g.panel.h,
          borderRadius: panelRadius(),
          background: p.surfaceContainerHighest,
        }}
      />
      {/* an empty slot stays bare: a name labels an item, and a slot with nothing in it has none.
          The words sit in the room the row pitch already keeps for them, so they never touch the
          row below. */}
      {g.nameH > 0 &&
        (item.children ?? []).map((c) => {
          const slot = cellSlot(c);
          if (!slot || !c.children?.length) return null;
          const at = g.cellAt(slot.col, slot.row);
          return (
            <span
              key={c.id}
              data-cell-name={c.id}
              style={{
                position: "absolute",
                left: at.x,
                top: at.y + g.cell,
                width: g.cell,
                height: g.nameH,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: CELL_NAME_FONT,
                lineHeight: 1,
                color: p.onSurfaceVariant,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                pointerEvents: "none",
              }}
            >
              {name}
            </span>
          );
        })}
    </>
  );
}

/**
 * What a board adds to one of its cells: the checkbox the visitor ticks when the author turned the
 * boxes on, and — while a cell is still empty — the placeholder icon the board carries. Both are
 * drawn over the cell rather than inside it, so a cell stays a plain container the author can put
 * anything in.
 *
 * The box is only drawn over a cell that holds something: a tick marks an item, and an empty slot
 * has nothing to mark. It also rides above the cell's contents, so filling a cell never buries it.
 */
export function GridCellMarks({
  grid,
  cell,
  checked,
  onToggle,
  p,
  z,
}: {
  grid: Item;
  cell: Item;
  checked: boolean;
  /** given only where ticking a cell is an edit: the canvas, with the board in hand */
  onToggle?: () => void;
  p: Palette;
  /** where the box rides; the preview lifts it over the part the visitor touched last */
  z?: number;
}) {
  const size = Math.max(14, Math.round((cell.size ?? CELL_DEF) * 0.34));
  return (
    <>
      {!cell.children?.length && grid.icon && (
        <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: p.onSurfaceVariant, pointerEvents: "none" }}>
          <Icon name={grid.icon} size={Math.round((cell.size ?? CELL_DEF) * 0.5)} />
        </span>
      )}
      {grid.checkboxes && !!cell.children?.length && (
        <span
          data-cell-check={checked ? "on" : "off"}
          role={onToggle ? "checkbox" : undefined}
          aria-checked={onToggle ? checked : undefined}
          onPointerDown={onToggle ? (e) => e.stopPropagation() : undefined}
          onClick={
            onToggle
              ? (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggle();
                }
              : undefined
          }
          style={{
            position: "absolute",
            left: Math.max(3, Math.round(size * 0.2)),
            top: Math.max(3, Math.round(size * 0.2)),
            width: size,
            height: size,
            boxSizing: "border-box",
            borderRadius: Math.max(3, Math.round(size * 0.24)),
            background: checked ? p.primary : "transparent",
            border: checked ? "none" : `1.5px solid ${p.outline}`,
            color: p.onPrimary,
            display: "grid",
            placeItems: "center",
            cursor: onToggle ? "pointer" : undefined,
            /* above whatever the author dropped into the cell, at layer 20 to begin with */
            zIndex: z ?? gridCheckZ(cell),
          }}
        >
          {checked && <Icon name="check" size={Math.round(size * 0.76)} />}
        </span>
      )}
    </>
  );
}

/**
 * What a control inside a part needs to know about the value it carries: where a change goes. It is
 * absent on the canvas and in an export, where a part is drawn but not live — the number is then
 * read-only, which is exactly what the canvas shows.
 */
export type WheelRun = { angle: number; lit: number; ms: number };
export const ValueContext = createContext<{
  onSet?: (v: number) => void;
  /** the three symbols a slot machine is showing */
  reels?: (id: string) => number[] | undefined;
  /** what a prize wheel is doing right now: how far its disc has turned, which prize is lit, and how
   *  long the turn takes. Absent on the canvas, where a wheel is drawn at rest. */
  wheel?: (id: string) => WheelRun | undefined;
  /** takes a reward on a track, by the part and the place of the reward in its list. Given only
   *  where there is a visitor to take it: the preview. */
  claim?: (id: string, i: number) => void;
  /** whether that reward has been taken already */
  claimed?: (id: string, i: number) => boolean;
}>({});
const useValueControls = () => useContext(ValueContext);
/** What a prize wheel is doing, if it is spinning at all. */
const useWheelRun = () => useContext(ValueContext).wheel;
const useReels = () => useContext(ValueContext).reels;
/** How a reward track takes a reward: the callback that claims one, and what is already claimed. */
const useClaims = () => {
  const cbs = useContext(ValueContext);
  return { claim: cbs.claim, claimed: cbs.claimed };
};

/**
 * 画在部件里面的那颗按钮，此刻是什么状态
 *
 * 单部件里"看起来像按钮"的那一块（任务信息条的领取按钮）该由谁响应？预览里每一次点按都要过的那道门
 * 在 Preview 的 `Tappable` 上（状态机先走、再触发这一部件自己的 action），而那条逻辑只该有一份。
 * 所以 Tappable 顺着这个 context 把它交下来：条里的按钮调 `press()`，而不是让整条都吃点击 —— 作者报的
 * 「点哪里都像点了整个容器」就是这么来的（从前整条都是点击目标，标题和奖励格也一起响应）。
 *
 * `off` 是那道门关上的时候（状态里的「置灰并停止响应」落在这一颗按钮上，不是整条 —— 见
 * `disablesWholePart`）：`press` 一起没有，按钮画灰、不响应，标题和奖励格照旧。
 *
 * 画在编辑器画布上、导出成图、放进市场缩略图时没有人提供它，按钮因此是死的 —— 和从前一样。
 */
export const PartPressContext = createContext<{
  /** 这一部件自己的那一下（状态机 + action），交给里面那颗**主**按钮（任务信息条的领取按钮、
   *  确认框的「确认」） */
  press?: () => void;
  /** 融合部件里**不是主按钮**的那几颗：一颗按钮一个槽，取到的是那颗按钮自己的那一下（它自己的状态机
   *  + 它自己的 action），取不到就是这一颗还没配去处。确认框的「取消」走的正是它（见 tokens 的
   *  CONFIRM_BOX_CANCEL_SLOT 与 Preview 的 pickSlot / onSlot）。 */
  pressSlot?: (slot: string) => (() => void) | undefined;
  /** 「置灰并停止响应」关掉了里面的按钮：画灰、不响应（见 disablesWholePart） */
  off?: boolean;
  /** 这一部件画在**预览**的 Tappable 里（编辑器画布、导出图、市场缩略图里没有这一层）。
   *  融合部件里那几颗按钮据此决定要不要吞掉这一下，见 swallowsInnerTap。 */
  preview?: boolean;
}>({});

/**
 * 融合部件里那颗按钮要不要吞掉这一下
 *
 * 预览里**一律吞**：这一下是那颗按钮的，不能冒到外面去 —— 一个融合部件如果放在自己的面板（或任何可点
 * 的容器）里，点它里面那颗按钮绝不该让那层面板/那个容器响应（作者：「取消按钮就是个普通按钮就行」，
 * 那是确认框那一次的原话，规矩对每个融合部件都一样）。
 * 编辑器画布里只在**有人给它处理器**时才吞：那里没有 PartPressContext，按钮上按住是"从按钮上拖走
 * 这一块"的手势，吞掉的话就拖不动了（见 TaskBarContent / ConfirmBoxContent 上那两处注释）。
 */
export const swallowsInnerTap = (preview: boolean | undefined, hasHandler: boolean) => !!preview || hasHandler;

/** The value a slider, a slider field or a stepper stands at: what the author set, 0 when unset —
 *  clamped to the part's own range, so a slider that runs to ten thousand is read on its own scale. */
const shownValue = (it: Item) => clampValue(it.value ?? 40, maxOf(it));

/**
 * The badge a destination carries, at its top trailing corner: a game's count of what waits behind a
 * tab ("3"), or a word like "new". It rides over the label rather than taking room in it, so a
 * destination with a badge and one without line up the same way.
 */
function NavBadge({ tab, p, size = 16, inset = 0 }: { tab: NavTab; p: Palette; size?: number; inset?: number }) {
  const text = tabBadge(tab);
  if (!text) return null;
  return (
    <span
      data-nav-badge={text}
      style={{
        position: "absolute",
        top: inset,
        right: inset,
        minWidth: size,
        height: size,
        padding: text.length > 2 ? `0 ${Math.round(size * 0.28)}px` : 0,
        borderRadius: size / 2,
        background: p.error,
        color: p.onError,
        fontSize: Math.round(size * 0.62),
        fontWeight: 700,
        lineHeight: `${size}px`,
        textAlign: "center",
        boxSizing: "border-box",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

/** The track, the thumb and the tick of a slider — drawn to the width the part is given, so the
 *  thumb lands under the finger whether it stands on a screen or inside a dialog panel. */
function SliderTrack({ item, p, showValue }: { item: Item; p: Palette; showValue?: boolean }) {
  const value = shownValue(item);
  const v = value / maxOf(item);
  const w = item.size ?? 280;
  const handleX = 2 + (w - 4) * v;
  const top = showValue ? 34 : 14;
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={{ position: "absolute", left: 0, width: Math.max(0, handleX - 8), top, height: 16, borderRadius: "8px 2px 2px 8px", background: p.primary }} />
      <div style={{ position: "absolute", left: handleX + 8, right: 0, top, height: 16, borderRadius: "2px 8px 8px 2px", background: p.secondaryContainer }} />
      <div style={{ position: "absolute", right: 6, top: top + 6, width: 4, height: 4, borderRadius: 2, background: p.onSecondaryContainer }} />
      <div style={{ position: "absolute", left: handleX - 2, top: top - 14, width: 4, height: 44, borderRadius: 2, background: p.primary }} />
      {showValue && (
        /* the number sits over the handle and stays inside the part at either end */
        <span
          data-value={value}
          style={{
            position: "absolute",
            left: Math.max(0, Math.min(w - 52, handleX - 26)),
            top: 0,
            width: 52,
            height: 24,
            borderRadius: 8,
            background: p.primary,
            color: p.onPrimary,
            fontSize: 13,
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            boxSizing: "border-box",
          }}
        >
          {/* the percent sign is the author's to keep or drop: a slider standing for a count of
              something is the same control without it — and one text node, because the pill lays
              its children out in a grid */}
          {`${value}${unitOf(item) ? "%" : ""}`}
        </span>
      )}
    </div>
  );
}

/**
 * The number a stepper and a slider field carry, with the two buttons that walk it by one: the box
 * can be typed into where the part is live, and the buttons answer a tap. Everything inside the row
 * takes its own press, so the part's own drag never starts from a button or from the box.
 */
function ValueRow({ item, p }: { item: Item; p: Palette }) {
  const cbs = useValueControls();
  const v = shownValue(item);
  const round = Math.max(28, Math.round((item.size2 ?? 56) * 0.62));
  const box: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: round,
    height: round,
    borderRadius: round / 2,
    border: "none",
    background: "transparent",
    color: p.onSurface,
    cursor: cbs.onSet ? "pointer" : "default",
    flex: "0 0 auto",
    padding: 0,
  };
  const step = (by: number) => (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    cbs.onSet?.(clampValue(v + by, maxOf(item)));
  };
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ display: "flex", alignItems: "center", gap: 2, width: "100%", height: "100%", padding: "0 6px", boxSizing: "border-box" }}
    >
      {item.label.trim().length > 0 && (
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, color: p.onSurface }}>
          {item.label}
        </span>
      )}
      <button type="button" aria-label="-" style={box} onClick={step(-1)}>
        <Icon name="remove" size={Math.round(round * 0.5)} />
      </button>
      {/* the number itself: an author types a value into it, and the slider follows */}
      <input
        type="text"
        inputMode="numeric"
        value={String(v)}
        readOnly={!cbs.onSet}
        aria-label={item.label.trim() || String(v)}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9]/g, ""));
          if (Number.isFinite(n)) cbs.onSet?.(clampValue(n, maxOf(item)));
        }}
        style={{
          width: 56,
          height: Math.max(32, round),
          border: "none",
          outline: "none",
          background: "transparent",
          color: p.onSurface,
          font: "inherit",
          fontSize: 18,
          fontWeight: 700,
          textAlign: "center",
          padding: 0,
        }}
      />
      <button type="button" aria-label="+" style={box} onClick={step(1)}>
        <Icon name="add" size={Math.round(round * 0.5)} />
      </button>
    </div>
  );
}

function Body({
  item,
  p,
  tabScroll,
  widths,
  still,
}: {
  item: Item;
  p: Palette;
  tabScroll?: number;
  widths?: Record<string, number>;
  /** drawn once, with no clock: a still frame keeps the author's own count (see FnButtonContent) */
  still?: boolean;
}) {
  const lang = useLang();
  const w = useWeight();
  const hasLabel = item.label.trim().length > 0;
  const hasSupporting = !!item.supporting?.trim();

  if (MEASURED.includes(item.kind)) return <MeasuredContent item={item} p={p} />;

  switch (item.kind) {
    case "iconButton": {
      /* one shape, one icon in it: no words under it, whatever the document still carries */
      const s = item.size ?? 48;
      return (
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          {item.icon && <Icon name={item.icon} size={Math.round(s / 2)} fill={item.variant === "filled"} />}
        </div>
      );
    }

    case "itemCell": {
      /* One part: a cell holding the item's picture, its count and its two corner marks, with the
         item's name under it. The picture is drawn the way an icon button draws its own, and each mark
         with the badge kind's own pill, so a cell and a dropped badge look the same. */
      const box = sizeOf(item, {});
      const cell = itemCellBox(item, box.w);
      const name = item.label.trim();
      const count = (item.supporting ?? "").trim();
      const markH = Math.max(10, Math.round(cell * 0.18));
      /* a mark is the badge kind handed the words, the size and the colour it would have had there */
      const mark = (key: string, on: boolean, text: string, colour: string | undefined, style: React.CSSProperties) =>
        on ? (
          <span key={key} style={{ position: "absolute", top: 2, ...style }}>
            <BadgeContent
              item={{ ...item, kind: "badge", label: text, size: undefined, size2: text ? markH : undefined, color: colour, strokeWidth: 0, strokeColor: undefined }}
              p={p}
            />
          </span>
        ) : null;
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: cell,
              height: cell,
              borderRadius: itemCellRadius(item, cell),
              background: fillColor(item.fill, p, ITEM_CELL_FILL),
              color: fillInk(item.fill, p, ITEM_CELL_FILL),
              /* the hairline the author set rings the cell itself, not the box around the name */
              boxShadow: strokeOf(item, p) ?? undefined,
              boxSizing: "border-box",
            }}
          >
            {item.icon && (
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                {/* the picture wears the author's own colour when they picked one (the inspector names
                    that control 图标颜色 for this kind), and the primary role when they did not */}
                <Icon name={item.icon} size={Math.round(cell * 0.4)} color={colorOverrideOf(item, p)?.main ?? p.primary} />
              </span>
            )}
            {count && (
              <span
                style={{
                  position: "absolute",
                  right: Math.round(cell * 0.1),
                  bottom: Math.round(cell * 0.06),
                  fontSize: Math.max(9, Math.min(24, Math.round(cell * 0.23))),
                  lineHeight: 1,
                  fontWeight: w(500, 700),
                }}
              >
                {count}
              </span>
            )}
            {/* the quality tag on the top-left, the "new" mark on the top-right — the two the
                背包格子 composite carried as badges of its own */}
            {mark("quality", badge2On(item), badge2TextOf(item), badge2ColorOf(item) ?? "secondaryContainer", { left: 3 })}
            {mark("fresh", badgeOn(item), badgeTextOf(item), undefined, { right: 3 })}
          </div>
          {name && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: cell,
                height: Math.max(8, box.h - cell),
                display: "grid",
                placeItems: "center",
                fontSize: Math.max(9, Math.min(24, Math.round(box.w * 0.22))),
                lineHeight: 1,
                fontWeight: w(500, 700),
                color: p.onSurface,
                ...ellipsis,
              }}
            >
              {name}
            </div>
          )}
        </div>
      );
    }


    case "fab": {
      const s = item.size ?? 56;
      return (
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          {item.icon && <Icon name={item.icon} size={Math.round(s * 0.42)} />}
        </div>
      );
    }

    case "fnButton":
      return <FnButtonContent item={item} p={p} still={still} />;

    case "taskBar":
      return <TaskBarContent item={item} p={p} />;

    case "confirmBox":
      return <ConfirmBoxContent item={item} p={p} />;


    case "topAppBar":
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            /* the inset the bar has, if any (see sizeOf) */
            padding: `${sizeOf(item, {}).h - 64}px 4px 0`,
            height: "100%",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          <div style={{ width: 48, height: 48, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            {item.icon && <Icon name={item.icon} size={24} color={p.onSurface} />}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: w(400, 600), color: p.onSurface, ...ellipsis }}>
            {item.label}
          </div>
          <div style={{ width: 48, height: 48, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            {item.icon2 && <Icon name={item.icon2} size={24} color={p.onSurfaceVariant} />}
          </div>
        </div>
      );

    case "searchBar":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: "100%" }}>
          {item.icon && <Icon name={item.icon} size={24} color={p.onSurface} />}
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, color: p.onSurfaceVariant, ...ellipsis }}>
            {item.label}
          </div>
          {item.icon2 && <Icon name={item.icon2} size={24} color={p.onSurfaceVariant} />}
        </div>
      );

    case "card": {
      const pos = cardImagePosOf(item);
      const hasImage = !item.noImage;
      const padding = CARD_PADDING;
      const align = cardContentAlignOf(item);
      const justifyContent = { start: "flex-start", center: "center", end: "flex-end" }[align] as React.CSSProperties["justifyContent"];
      const ink = cardTextColorOf(item, p);
      const body = cardBodyColorOf(item, p);
      const picture = item.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        item.icon && <Icon name={item.icon} size={34} />
      );
      const media = (style: React.CSSProperties) => (
        <div
          style={{
            borderRadius: scaleR(14),
            background: p.primaryContainer,
            color: p.onPrimaryContainer,
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
            overflow: "hidden",
            ...style,
          }}
        >
          {picture}
        </div>
      );
      const text = (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: CARD_TEXT_GAP, justifyContent }}>
          {hasLabel && (
            <div style={{ fontSize: 16, fontWeight: w(600, 700), color: ink, ...ellipsis }}>{item.label}</div>
          )}
          {hasSupporting && (
            <div style={{ fontSize: 13, lineHeight: 1.5, color: body.color, opacity: body.opacity, overflow: "hidden" }}>
              {item.supporting}
            </div>
          )}
        </div>
      );
      if (hasImage && pos === "background") {
        /* Full-bleed media behind the text. A photo, or a chosen text color that the placeholder's
         * container may not carry, gets a scrim on the text's side: dark under light text, light under dark. */
        const scrim = item.src || item.textColor ? cardScrimOf(ink, align) : undefined;
        return (
          <div style={{ position: "relative", height: "100%", boxSizing: "border-box" }}>
            <div style={{ position: "absolute", inset: 0, background: p.primaryContainer, color: p.onPrimaryContainer, display: "grid", placeItems: "center" }}>
              {picture}
            </div>
            {scrim && <div style={{ position: "absolute", inset: 0, background: scrim }} />}
            <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding, display: "flex", flexDirection: "column" }}>{text}</div>
          </div>
        );
      }
      /* top: the image band above the text; leading / trailing: a full-height column beside it */
      const side = hasImage && (pos === "leading" || pos === "trailing");
      return (
        <div
          style={{
            padding,
            height: "100%",
            display: "flex",
            flexDirection: side ? "row" : "column",
            gap: CARD_MEDIA_GAP,
            boxSizing: "border-box",
          }}
        >
          {hasImage && pos !== "trailing" && media(side ? { width: cardImageSizeOf(item), alignSelf: "stretch" } : { height: cardImageSizeOf(item) })}
          {text}
          {hasImage && pos === "trailing" && media({ width: cardImageSizeOf(item), alignSelf: "stretch" })}
        </div>
      );
    }

    case "listItem": {
      const iconBg = item.iconFill === "none" ? null : (item.iconFill ?? "primaryContainer");
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 16px", height: "100%" }}>
          {item.icon && (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: iconBg ? fillColor(iconBg, p, "primaryContainer") : "transparent",
                color: iconBg ? fillInk(iconBg, p, "primaryContainer") : fillInk(item.fill, p, "surfaceContainerLow"),
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
              }}
            >
              <Icon name={item.icon} size={22} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {hasLabel && <div style={{ fontSize: 16, color: p.onSurface, ...ellipsis }}>{item.label}</div>}
            {hasSupporting && (
              <div style={{ fontSize: 13, color: p.onSurfaceVariant, ...ellipsis }}>{item.supporting}</div>
            )}
          </div>
          {item.switch ? <SwitchControl on={!!item.checked} noCheck={!!item.noCheck} p={p} /> : item.icon2 && <Icon name={item.icon2} size={22} color={p.onSurfaceVariant} />}
        </div>
      );
    }

    case "dialog":
      return (
        <div
          style={{
            padding: 24,
            height: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {item.icon && (
            <div style={{ textAlign: "center", color: p.primary }}>
              <Icon name={item.icon} size={24} />
            </div>
          )}
          {hasLabel && (
            <div
              style={{
                fontSize: 24,
                fontWeight: w(400, 600),
                color: p.onSurface,
                textAlign: item.icon ? "center" : "left",
                ...ellipsis,
              }}
            >
              {item.label}
            </div>
          )}
          {hasSupporting && (
            <div style={{ fontSize: 14, lineHeight: 1.5, color: p.onSurfaceVariant, flex: 1, overflow: "hidden" }}>
              {item.supporting}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {[t("cancel", lang), t("ok", lang)].map((t) => (
              <span
                key={t}
                style={{
                  padding: "0 12px",
                  height: 40,
                  display: "inline-flex",
                  alignItems: "center",
                  color: p.primary,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      );

    case "snackbar":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 0 16px", height: "100%" }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: p.inverseOnSurface, ...ellipsis }}>
            {item.label}
          </div>
          {hasSupporting && (
            <span
              style={{
                padding: "0 12px",
                height: 36,
                display: "inline-flex",
                alignItems: "center",
                color: p.inversePrimary,
                fontSize: 14,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {item.supporting}
            </span>
          )}
        </div>
      );

    case "textField": {
      const filled = item.variant === "filled";
      return (
        <div style={{ position: "relative", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: "100%" }}>
            {item.icon && <Icon name={item.icon} size={24} color={p.onSurfaceVariant} />}
            <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: p.onSurfaceVariant, ...ellipsis }}>
              {filled ? "" : ""}
            </span>
          </div>
          {hasLabel && (
            <span
              style={{
                position: "absolute",
                left: item.icon ? 52 : 16,
                top: filled ? 8 : -8,
                fontSize: 12,
                lineHeight: "16px",
                color: p.primary,
                background: filled ? "transparent" : p.surface,
                padding: filled ? 0 : "0 4px",
                marginLeft: filled ? 0 : -4,
              }}
            >
              {item.label}
            </span>
          )}
          {filled && (
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 2,
                background: p.primary,
              }}
            />
          )}
          {hasSupporting && (
            <span
              style={{
                position: "absolute",
                left: 16,
                top: "100%",
                marginTop: 4,
                fontSize: 12,
                color: p.onSurfaceVariant,
                whiteSpace: "nowrap",
              }}
            >
              {item.supporting}
            </span>
          )}
        </div>
      );
    }

    case "select": {
      /* a closed dropdown: the chosen option is the value and the label floats; with
       * nothing chosen the label sits in the field */
      const filled = item.variant === "filled";
      const value = item.selected === undefined ? undefined : item.tabs?.[item.selected]?.label;
      return (
        <div style={{ position: "relative", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 12px 0 16px", height: "100%" }}>
            {item.icon && <Icon name={item.icon} size={24} color={p.onSurfaceVariant} />}
            <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: value ? p.onSurface : p.onSurfaceVariant, paddingTop: value && filled ? 16 : 0, ...ellipsis }}>
              {value ?? item.label}
            </span>
            <Icon name="arrow_drop_down" size={24} color={p.onSurfaceVariant} />
          </div>
          {value && hasLabel && (
            <span
              style={{
                position: "absolute",
                left: item.icon ? 52 : 16,
                top: filled ? 8 : -8,
                fontSize: 12,
                lineHeight: "16px",
                color: p.onSurfaceVariant,
                background: filled ? "transparent" : p.surface,
                padding: filled ? 0 : "0 4px",
                marginLeft: filled ? 0 : -4,
              }}
            >
              {item.label}
            </span>
          )}
          {filled && <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: p.onSurfaceVariant }} />}
          {hasSupporting && (
            <span style={{ position: "absolute", left: 16, top: "100%", marginTop: 4, fontSize: 12, color: p.onSurfaceVariant, whiteSpace: "nowrap" }}>
              {item.supporting}
            </span>
          )}
        </div>
      );
    }

    case "slider":
      /* with `showValue` the number rides above the track, on the handle, the way M3's own value
         indicator does: the track keeps the whole width, so dragging still reads across the part */
      return <SliderTrack item={item} p={p} showValue={!!item.showValue} />;

    case "stepper":
      return <ValueRow item={item} p={p} />;

    case "image":
      if (item.src) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.src}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        );
      }
      return (
        <div style={{ display: "grid", placeItems: "center", height: "100%", color: p.outline }}>
          {item.icon && <Icon name={item.icon} size={Math.min(48, Math.round((item.size ?? 200) * 0.3))} />}
        </div>
      );

    case "camera":
      /* a viewfinder: the live feed is dark, with focus brackets and a shutter row */
      return (
        <div style={{ position: "relative", height: "100%", color: p.inverseOnSurface }}>
          {(["left", "right"] as const).map((side) =>
            (["top", "bottom"] as const).map((edge) => (
              <div
                key={`${side}-${edge}`}
                style={{
                  position: "absolute",
                  [side]: 24,
                  [edge]: 24,
                  width: 28,
                  height: 28,
                  opacity: 0.7,
                  [`border${side === "left" ? "Left" : "Right"}`]: `3px solid ${p.inverseOnSurface}`,
                  [`border${edge === "top" ? "Top" : "Bottom"}`]: `3px solid ${p.inverseOnSurface}`,
                  [`border${edge === "top" ? "Top" : "Bottom"}${side === "left" ? "Left" : "Right"}Radius`]: 6,
                }}
              />
            )),
          )}
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0.5 }}>
            {item.icon && <Icon name={item.icon} size={40} />}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, display: "grid", placeItems: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, border: `4px solid ${p.inverseOnSurface}`, display: "grid", placeItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: p.inverseOnSurface }} />
            </div>
          </div>
        </div>
      );

    case "map":
      /* a stylised city: blocks on a light ground, two main roads and a river, one pin */
      return (
        <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
          <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }} aria-hidden>
            <rect width="400" height="300" fill={p.surfaceContainerLow} />
            <path d="M-20 210 C 80 170, 140 260, 240 220 S 380 150, 430 190 L 430 240 C 380 200, 300 260, 240 250 S 120 230, -20 250 Z" fill={p.primaryContainer} opacity={0.6} />
            {[
              [20, 20, 90, 60], [130, 20, 110, 60], [260, 20, 120, 60],
              [20, 100, 90, 70], [130, 100, 60, 70], [210, 100, 170, 70],
              [20, 190, 60, 40], [300, 200, 80, 30],
            ].map(([x, y, w, h], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} rx={6} fill={p.surfaceContainerHighest} />
            ))}
            <path d="M0 90 H400 M110 0 V300 M250 0 V300" stroke={p.surface} strokeWidth={10} fill="none" />
            <path d="M0 90 H400 M110 0 V300 M250 0 V300" stroke={p.outlineVariant} strokeWidth={1} fill="none" opacity={0.6} />
            <g transform="translate(200 150)">
              <path d="M0 24 C -14 6, -20 -2, -20 -12 A 20 20 0 0 1 20 -12 C 20 -2, 14 6, 0 24 Z" fill={p.primary} />
              <circle cx="0" cy="-12" r="7" fill={p.onPrimary} />
            </g>
          </svg>
        </div>
      );

    case "divider":
      return (
        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
          <div style={{ width: "100%", height: 1, background: p.outlineVariant }} />
        </div>
      );

    case "navRail": {
      const tabs = item.tabs ?? [];
      const wide = isWideRail(item);
      const expanded = !!item.railExpanded;
      const rail = railMetrics(item);
      if (wide) return (
        <div style={{ position: "relative", height: "100%" }}>
          {/* the rail folds up and down: "V" folds everything away, the turned-around "V" opens it */}
          <div className="m3-rail-geometry" style={{ position: "absolute", left: Math.round(rail.headerLeft), top: rail.headerTop, width: 48, height: 48, display: "grid", placeItems: "center", color: p.onSurfaceVariant }}>
            <Icon name={item.railFolded || !expanded ? "expand_less" : "expand_more"} size={24} />
          </div>
          {!item.railFolded &&
            tabs.map((tab, i) => {
              const on = i === Math.min(item.selected ?? 0, Math.max(0, tabs.length - 1));
              /* every position is read off the rail's own width, and the icon always sits above
                 its label; past the author's per-line limit the destinations start another column.
                 The cell comes from the same helper the preview's hit areas use, so what answers a
                 tap is what is drawn. */
              const cell = railCell(item, tabs.length, i);
              const pillW = expanded ? cell.width : Math.min(cell.width, 56);
              /* a rail squeezed for height keeps its icons: the pill shrinks to the cell and the
                 words go, rather than the column running out of the bottom */
              const tight = cell.height < rail.itemHeight;
              return (
                <div
                  key={i}
                  className="m3-rail-geometry"
                  style={{
                    position: "absolute",
                    left: cell.left,
                    top: cell.top,
                    width: cell.width,
                    height: cell.height,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                  }}
                >
                  <div
                    className="m3-rail-geometry"
                    style={{
                      width: Math.min(NAV_INDICATOR, pillW, cell.height),
                      height: Math.min(NAV_INDICATOR, cell.height),
                      borderRadius: scaleR(NAV_INDICATOR_R),
                      display: "grid",
                      placeItems: "center",
                      background: on ? p.secondaryContainer : "transparent",
                      color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
                      transition: "background 160ms, color 160ms",
                      filter: tab.disabled ? "grayscale(1)" : undefined,
                      opacity: tab.disabled ? 0.45 : 1,
                      transform: tab.grown ? "scale(1.15)" : undefined,
                    }}
                  >
                    {tabShowsIcon(tab) && <Icon name={tab.icon} size={NAV_ICON} fill={on} />}
                    <NavBadge tab={tab} p={p} size={16} inset={-2} />
                  </div>
                  {tab.label.trim() && !tight && (
                    <span
                      className="m3-rail-geometry"
                      /* The label sits on the rail itself, below the pill, so it takes the ink the
                         rail's own background reads in — the pill's ink belongs to the icon inside
                         it, and using it here painted white words on a white rail. */
                      style={{ width: cell.width, textAlign: "center", fontSize: expanded ? NAV_LABEL_FONT + 1 : NAV_LABEL_FONT, lineHeight: "16px", fontWeight: on ? w(600, 700) : w(400, 500), color: p[navLabelInk(on)], ...ellipsis }}
                    >
                      {tab.label}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      );
      return (
        /* the 80dp rail lays its columns out from the same cells the preview's hit areas use */
        <div style={{ position: "relative", height: "100%" }}>
          {tabs.map((t, i) => {
            const on = i === Math.min(item.selected ?? 0, Math.max(0, tabs.length - 1));
            const withLabel = t.label.trim().length > 0;
            const cell = railCell(item, tabs.length, i);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: cell.left,
                  top: cell.top,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  width: cell.width,
                  height: cell.height,
                }}
              >
                <div
                  style={{
                    width: Math.min(NAV_INDICATOR, cell.width),
                    height: Math.min(NAV_INDICATOR, cell.height),
                    borderRadius: scaleR(NAV_INDICATOR_R),
                    display: "grid",
                    placeItems: "center",
                    background: on ? p.secondaryContainer : "transparent",
                    color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
                    /* a destination its own rule has greyed out, or grown, shows it */
                    transition: "background 160ms, color 160ms, transform 160ms",
                    filter: t.disabled ? "grayscale(1)" : undefined,
                    opacity: t.disabled ? 0.45 : 1,
                    transform: t.grown ? "scale(1.15)" : undefined,
                  }}
                >
                  {tabShowsIcon(t) && <Icon name={t.icon} size={NAV_ICON} fill={on} />}
                  <NavBadge tab={t} p={p} size={16} inset={-2} />
                </div>
                {withLabel && (
                  <span
                    style={{
                      fontSize: NAV_LABEL_FONT,
                      fontWeight: on ? w(600, 700) : w(400, 500),
                      color: p[navLabelInk(on)],
                      maxWidth: "100%",
                      ...ellipsis,
                    }}
                  >
                    {t.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case "bottomNav": {
      const tabs = item.tabs ?? [];
      /* the bar's own collapse button: "<" folds every label away, ">" brings them back */
      const folded = item.barFolded === true;
      const hasToggle = item.barFolded !== undefined;
      return (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            alignContent: "center",
            /* Folded, the one thing left is its button, at the trailing edge. On one line the
             * destinations spread out; once they wrap, a short last row is pushed right so its
             * columns line up with the full rows above it. */
            justifyContent: folded || navRows(tabs.length, item.navPerRow) > 1 ? "flex-end" : "space-around",
            height: "100%",
            /* The collapse button owns the trailing strip, so no destination sits under it.
             * The destinations centre in the whole bar rather than in the 80dp above the
             * gesture strip (see sizeOf): centring them higher left a hem at the bottom that
             * read as a mistake. They are short enough to stay clear of the strip anyway. */
            padding: `0 ${hasToggle ? 44 : 4}px 0 4px`,
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* folded, the bar keeps nothing but its own ">" button; more tabs than one row
              holds flow onto the next row, which is why the bar grows taller */}
          {!folded && tabs.map((t, i) => {
            const on = i === Math.min(item.selected ?? 0, Math.max(0, tabs.length - 1));
            const withLabel = t.label.trim().length > 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  flex: `0 0 ${100 / navPerLine(tabs.length, item.navPerRow)}%`,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: NAV_INDICATOR,
                    height: NAV_INDICATOR,
                    borderRadius: scaleR(NAV_INDICATOR_R),
                    display: "grid",
                    placeItems: "center",
                    background: on ? p.secondaryContainer : "transparent",
                    color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
                    transition: "background 160ms, color 160ms",
                  }}
                >
                  {tabShowsIcon(t) && <Icon name={t.icon} size={NAV_ICON} fill={on} />}
                  <NavBadge tab={t} p={p} size={16} inset={-2} />
                </div>
                {withLabel && !folded && (
                  <span
                    style={{
                      fontSize: NAV_LABEL_FONT,
                      fontWeight: on ? w(600, 700) : w(400, 500),
                      color: p[navLabelInk(on)],
                      maxWidth: "100%",
                      ...ellipsis,
                    }}
                  >
                    {t.label}
                  </span>
                )}
              </div>
            );
          })}
          {hasToggle && (
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, display: "grid", placeItems: "center", color: p.onSurfaceVariant }}>
              {/* The bar's own fold button. Its chevrons point along the bar — the way its
                  destinations run — the same way the rail's point along the rail: "◀" says the
                  destinations are out to the left, "▶" that they are folded away and come back. */}
              <Icon name={folded ? "chevron_right" : "chevron_left"} size={20} />
            </div>
          )}
        </div>
      );
    }

    case "circularProgress":
      return (
        <CircularProgress
          size={item.size ?? 48}
          color={p.primary}
          trackColor={p.secondaryContainer}
          wavy={item.wavy}
          trackThickness={progressThickness(item)}
          value={item.value === undefined ? undefined : item.value / 100}
        />
      );

    case "linearProgress":
      return (
        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
          <LinearProgress
            width={item.size ?? 320}
            color={p.primary}
            trackColor={p.secondaryContainer}
            wavy={item.wavy}
            trackThickness={progressThickness(item)}
            value={item.value === undefined ? undefined : item.value / 100}
          />
        </div>
      );

    case "progressBar": {
      const h = sizeOf(item, {}).h;
      const value = progressValue(item);
      const track = progressTrack(item, p);
      const words = item.label.trim();
      const font = Math.max(9, Math.min(28, Math.round(h * 0.58)));
      /* A bar can be as slim as 4dp, so its words cannot simply sit inside it: they are centred on
         the bar, and the copy over the filled part is clipped to it. The two halves are inked
         against the colour each one lies on, so the words read wherever the fill's edge lands. */
      const line = (color: string) => (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: "0 6px", boxSizing: "border-box", fontSize: font, fontWeight: 700, lineHeight: 1.1, ...ellipsis }}>{words}</span>
      );
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: Math.round(h / 2), background: track.color }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${value}%`, background: p.primary }} />
          {words && <span style={{ color: track.ink }}>{line(track.ink)}</span>}
          {/* the same words again, clipped to the fill: the inner line is as wide as the whole bar,
              so the two copies sit on exactly the same letters */}
          {words && value > 0 && (
            <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${value}%`, overflow: "hidden", color: p.onPrimary }}>
              <span style={{ position: "absolute", left: 0, top: 0, width: `${10000 / value}%`, height: "100%" }}>{line(p.onPrimary)}</span>
            </span>
          )}
        </div>
      );
    }

    case "toolbar": {
      const tabs = item.tabs ?? [];
      const vibrant = item.variant === "filled";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px", height: "100%", boxSizing: "border-box" }}>
          {tabs.map((tab, i) => (
            <span
              key={i}
              style={{
                width: 48,
                height: 48,
                borderRadius: scaleR(24),
                display: "grid",
                placeItems: "center",
                color: vibrant ? p.onPrimaryContainer : p.onSurfaceVariant,
                flex: "0 0 auto",
              }}
            >
              {tabShowsIcon(tab) && <Icon name={tab.icon} size={24} />}
              <NavBadge tab={tab} p={p} size={16} inset={-2} />
            </span>
          ))}
        </div>
      );
    }

    case "tabs": {
      const tabs = item.tabs ?? [];
      const scroll = isScrollableTabs(item);
      const offset = tabScroll ?? tabScrollOffset(item, sizeOf(item, {}).w);
      const sel = tabIndexOf(item);
      /* Buttons, the way most games switch a page: the tab in front is a filled chip and the rest are
         outlined. The row is the same height either way, so the panels under it start in the same place. */
      /* where the strip sits: the top edge, or the foot of the box with the page above it */
      const atBottom = labelSideOf(item) === "bottom";
      const strip: React.CSSProperties = { position: "absolute", left: 0, right: 0, height: TAB_ROW_H, ...(atBottom ? { bottom: 0 } : { top: 0 }) };
      if (tabStyleOf(item) === "buttons") {
        const outer = scaleR((TAB_ROW_H - 16) / 2);
        return (
          <div style={{ ...strip, display: "flex", alignItems: "center", padding: "0 8px", overflow: "hidden", boxSizing: "border-box" }}>
            {tabs.map((tab, i) => {
              const on = i === sel;
              /* The buttons sit flush against one another, the way a connected group does: only the
                 two ends of the row are rounded off, neighbours share one 1px edge, and the tab in
                 front keeps its place in the row rather than floating in a gap. */
              const c = connectedButton(i, tabs.length, outer, scaleR(R_INNER));
              return (
                <div
                  key={i}
                  style={{
                    flex: scroll ? "none" : 1,
                    width: scroll ? SCROLL_TAB_W : undefined,
                    marginLeft: scroll && i === 0 ? -offset : c.margin || undefined,
                    minWidth: 0,
                    height: TAB_ROW_H - 16,
                    borderRadius: `${c.radii.tl}px ${c.radii.tr}px ${c.radii.br}px ${c.radii.bl}px`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "0 12px",
                    boxSizing: "border-box",
                    background: on ? p.secondaryContainer : "transparent",
                    color: on ? p.onSecondaryContainer : p.onSurfaceVariant,
                    border: on ? "none" : `1px solid ${p.outlineVariant}`,
                  }}
                >
                  {tabShowsIcon(tab) && <Icon name={tab.icon} size={18} fill={on} />}
                  <span style={{ fontSize: 14, fontWeight: on ? w(600, 700) : w(400, 500), maxWidth: "100%", ...ellipsis }}>{tab.label}</span>
                  <NavBadge tab={tab} p={p} size={16} inset={4} />
                </div>
              );
            })}
          </div>
        );
      }
      /* the underline row keeps one edge of the box; the rest of the box is the page */
      return (
        <div style={{ ...strip, display: "flex", alignItems: "stretch", overflow: "hidden" }}>
          {tabs.map((tab, i) => {
            const on = i === sel;
            return (
              <div
                key={i}
                style={{
                  flex: scroll ? "none" : 1,
                  width: scroll ? SCROLL_TAB_W : undefined,
                  marginLeft: scroll && i === 0 ? -offset : undefined,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  position: "relative",
                  padding: "0 8px",
                }}
              >
                {/* the icon rides beside the words here — the strip is one line tall — and the badge
                    sits at the corner of the destination, over both */}
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: w(500, 700),
                    color: on ? p.primary : p.onSurfaceVariant,
                    padding: "0 4px 14px",
                    maxWidth: "100%",
                  }}
                >
                  {tabShowsIcon(tab) && <Icon name={tab.icon} size={18} fill={on} />}
                  <span style={ellipsis}>{tab.label}</span>
                </span>
                <NavBadge tab={tab} p={p} size={16} inset={2} />
                {on && (
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      ...(atBottom ? { top: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 } : { bottom: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3 }),
                      transform: "translateX(-50%)",
                      width: `calc(100% - 24px)`,
                      height: 3,
                      background: p.primary,
                    }}
                  />
                )}
              </div>
            );
          })}
          <span style={{ position: "absolute", left: 0, right: 0, ...(atBottom ? { top: 0 } : { bottom: 0 }), height: 1, background: p.outlineVariant }} />
        </div>
      );
    }

    /**
     * The same row of tabs stood on its side: the destinations run down the left in a column, each a
     * label with its icon, and the page of the tab in front is what is left of the box — the panels
     * are the row's children, laid out beside this column by `panelBox`.
     */
    case "sideTabs": {
      const tabs = item.tabs ?? [];
      const sel = tabIndexOf(item);
      const rail = sideRailW(item);
      const atRight = labelSideOf(item) === "right";
      const buttons = tabStyleOf(item) === "buttons";
      const outer = scaleR((TAB_ROW_H - 16) / 2);
      return (
        <div style={{ display: "flex", alignItems: "stretch", width: rail, height: "100%", marginLeft: atRight ? "auto" : undefined, flexDirection: "column", padding: "8px 0", boxSizing: "border-box", overflow: "hidden" }}>
          {tabs.map((tab, i) => {
            const on = i === sel;
            /* Buttons, the way the horizontal row offers them: the destination in front is a filled
               pill and the rest are outlined; the underline style marks the one in front with a bar
               down its leading edge instead */
            const c = buttons ? connectedButton(i, tabs.length, outer, scaleR(R_INNER)) : null;
            return (
              <div
                key={i}
                style={{
                  height: TAB_ROW_H,
                  flex: "0 0 auto",
                  margin: buttons ? "2px 8px" : undefined,
                  padding: buttons ? "0 12px" : "0 12px 0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  position: "relative",
                  minWidth: 0,
                  boxSizing: "border-box",
                  ...(c
                    ? { borderRadius: `${c.radii.tl}px ${c.radii.tr}px ${c.radii.br}px ${c.radii.bl}px`, background: on ? p.secondaryContainer : "transparent", border: on ? "none" : `1px solid ${p.outlineVariant}`, color: on ? p.onSecondaryContainer : p.onSurfaceVariant }
                    : {}),
                }}
              >
                {tabShowsIcon(tab) && <Icon name={tab.icon} size={20} fill={on} color={buttons ? undefined : on ? p.primary : p.onSurfaceVariant} />}
                <span style={{ fontSize: 14, fontWeight: on ? w(600, 700) : w(400, 500), maxWidth: "100%", ...ellipsis, color: buttons ? undefined : on ? p.primary : p.onSurfaceVariant }}>{tab.label}</span>
                <NavBadge tab={tab} p={p} size={16} inset={4} />
                {on && !buttons && (
                  <span style={{ position: "absolute", [atRight ? "right" : "left"]: 0, top: 10, bottom: 10, width: 3, borderRadius: 3, background: p.primary } as React.CSSProperties} />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case "joystick": {
      /* A movement pad: the round plate, a centre mark, and the knob the visitor drags. There are no
         direction keys — the pad is the control — and the knob is placed from the part's own value, so
         the canvas, the preview and an export all show the same stick. Nothing here reads the angle
         out: a number chasing the finger is what this part must not show. */
      /* the plate's side is the box's own (see sizeOf), which is what its round corner and the
         knob's travel are measured from */
      const size = sizeOf(item, {}).w;
      const angle = clampValue(item.value ?? 0, JOYSTICK_MAX);
      const knob = joystickKnob(angle, size, angle > 0);
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <span
            data-joystick-knob=""
            style={{
              position: "absolute",
              left: `calc(50% + ${knob.dx}px)`,
              top: `calc(50% + ${knob.dy}px)`,
              width: Math.max(24, Math.round(size * 0.34)),
              height: Math.max(24, Math.round(size * 0.34)),
              marginLeft: -Math.round(Math.max(24, size * 0.34) / 2),
              marginTop: -Math.round(Math.max(24, size * 0.34) / 2),
              borderRadius: "50%",
              /* the knob carries no reading of its own: the angle is the author's number (see the
                 inspector's value control), and a figure following the finger is exactly what the
                 pad must not show. Its fill still says whether the stick is being held. */
              background: angle > 0 ? p.primary : p.primaryContainer,
              boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
            }}
          />
          <span style={{ position: "absolute", left: "50%", top: "50%", width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: 3, background: p.outlineVariant }} />
        </div>
      );
    }

    case "wheel": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      /* The pool drawn as wedges, a pointer at the top that never moves, and the button in the
         middle. The wedges are a conic gradient, so the wheel is one element however many prizes it
         holds; the disc turns under the pointer while the preview spins it. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const n = prizes.length;
      const sweep = 360 / n;
      const run = wheelOf?.(item.id);
      const lit = run?.lit ?? -1;
      const disc = prizes
        .map((_: unknown, i: number) => {
          const fill = i === lit ? p.primaryContainer : i % 2 ? p.surfaceContainerHigh : p.surfaceContainerLow;
          return `${fill} ${i * sweep}deg ${(i + 1) * sweep}deg`;
        })
        .join(", ");
      const size = Math.min(item.size ?? WHEEL_SIZE, item.size2 ?? item.size ?? WHEEL_SIZE);
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <div
            data-wheel-disc=""
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: `conic-gradient(${disc})`,
              transform: `rotate(${run?.angle ?? 0}deg)`,
              transition: run && run.ms > 0 ? `transform ${run.ms}ms cubic-bezier(0.15, 0.85, 0.2, 1)` : undefined,
            }}
          >
            {prizes.map((pr, i) => (
              <span
                key={i}
                data-prize={i}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  /* The label lies along its own spoke: turned so its first character is the one
                     nearest the middle and its words run out towards the rim, and placed far enough
                     out to sit in the wedge rather than across the button. */
                  transform: `translate(-50%, -50%) rotate(${wheelSlice(i, n).start + sweep / 2 - 90}deg) translateX(${Math.round(size * 0.28)}px)`,
                  color: i === lit ? p.onPrimaryContainer : p.onSurfaceVariant,
                  fontSize: Math.max(9, Math.round(size * 0.055)),
                  fontWeight: i === lit ? 700 : 500,
                  whiteSpace: "nowrap",
                  maxWidth: Math.round(size * 0.52),
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                {pr.icon && <Icon name={pr.icon} size={Math.max(10, Math.round(size * 0.06))} />}
                {prizeLabel(pr)}
              </span>
            ))}
          </div>
          {/* the pointer, the rim and the button: none of them turn with the wheel */}
          <span style={{ position: "absolute", left: "50%", top: -2, marginLeft: -8, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: `14px solid ${p.error}` }} />
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${p.outlineVariant}` }} />
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: Math.max(48, Math.round(size * 0.3)),
              height: Math.max(48, Math.round(size * 0.3)),
              marginLeft: -Math.round(Math.max(48, size * 0.3) / 2),
              marginTop: -Math.round(Math.max(48, size * 0.3) / 2),
              borderRadius: "50%",
              background: p.primary,
              color: p.onPrimary,
              display: "grid",
              placeItems: "center",
              fontSize: Math.max(10, Math.round(size * 0.065)),
              fontWeight: 700,
              textAlign: "center",
              padding: 4,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {item.label.trim() || "抽奖"}
          </span>
        </div>
      );
    }

    case "gridWheel": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      /* The same pool laid round the edge of a grid, with the button in the middle: the highlight
         runs from cell to cell and stops on the prize, which is the shape a nine-cell draw is drawn
         in. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const { rows, cols } = gridRing(prizes.length);
      /* every cell of the edge is drawn; the ones the pool does not reach show the blank prize, so a
         ring is a ring rather than a few cards and a gap */
      const cells = gridEdgeCells(prizes.length);
      const placed = gridRingCells(prizes.length);
      const run = wheelOf?.(item.id);
      const lit = run?.lit ?? -1;
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "grid", gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, boxSizing: "border-box", padding: 4 }}>
          {cells.map((cell, i) => {
            const at = placed.findIndex((c) => c.row === cell.row && c.col === cell.col);
            const pr = at >= 0 ? prizes[at] : undefined;
            const empty = !pr;
            return (
              <div
                key={i}
                data-prize={i}
                data-prize-at={at >= 0 ? at : undefined}
                data-prize-empty={empty ? "" : undefined}
                style={{
                  gridRow: cell.row + 1,
                  gridColumn: cell.col + 1,
                  borderRadius: 10,
                  background: at === lit ? p.primaryContainer : i % 2 ? p.surfaceContainerHigh : p.surfaceContainerLow,
                  color: at === lit ? p.onPrimaryContainer : p.onSurfaceVariant,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  minWidth: 0,
                  overflow: "hidden",
                  padding: 2,
                  boxSizing: "border-box",
                  fontWeight: at === lit ? 700 : 500,
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                {(pr?.icon ?? (empty ? "sentiment_dissatisfied" : undefined)) && <Icon name={pr?.icon ?? "sentiment_dissatisfied"} size={16} />}
                <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prizeLabel(pr)}</span>
              </div>
            );
          })}
          {rows >= 3 && cols >= 3 && (
            <div
              style={{
                gridRow: `2 / span ${rows - 2}`,
                gridColumn: `2 / span ${cols - 2}`,
                borderRadius: 10,
                background: p.primary,
                color: p.onPrimary,
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 12,
                textAlign: "center",
                padding: 4,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              {item.label.trim() || "抽奖"}
            </div>
          )}
        </div>
      );
    }

    case "gacha": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      /* A capsule machine: a glass dome of capsules, a knob that turns, and the prize named when it
         stops. The knob's turn is the run the preview sends, and the lit capsule is the prize it is
         passing. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const run = wheelOf?.(item.id);
      const lit = run?.lit ?? -1;
      const w = item.size ?? GACHA_W;
      const h = item.size2 ?? GACHA_H;
      const dome = Math.round(Math.min(w * 0.74, h * 0.5));
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: 8, boxSizing: "border-box", gap: 6 }}>
          <div
            style={{
              position: "relative",
              width: dome,
              height: dome,
              borderRadius: "50%",
              background: p.surfaceContainerLow,
              border: `3px solid ${p.outlineVariant}`,
              overflow: "hidden",
            }}
          >
            {Array.from({ length: Math.min(12, Math.max(6, prizes.length * 2)) }, (_, i) => {
              const on = i % Math.max(1, prizes.length) === lit;
              const a = (i / 12) * Math.PI * 2 + (run ? Math.sin((run.lit + i) * 1.7) * 0.9 : 0);
              const rad = dome / 2;
              return (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: `calc(50% + ${Math.round(Math.cos(a) * rad * (run ? 0.36 + (i % 3) * 0.06 : 0.45))}px)`,
                    top: `calc(50% + ${Math.round(Math.sin(a) * rad * (run ? 0.36 + (i % 3) * 0.06 : 0.45))}px)`,
                    width: Math.max(10, Math.round(dome * 0.16)),
                    height: Math.max(10, Math.round(dome * 0.16)),
                    marginLeft: -Math.round(Math.max(10, dome * 0.16) / 2),
                    marginTop: -Math.round(Math.max(10, dome * 0.16) / 2),
                    borderRadius: "50%",
                    background: on ? p.primaryContainer : i % 2 ? p.tertiaryContainer : p.secondaryContainer,
                  }}
                />
              );
            })}
          </div>
          <div style={{ width: "100%", flex: 1, minHeight: 0, borderRadius: 12, background: p.surfaceContainerHigh, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 6, boxSizing: "border-box", position: "relative", overflow: "hidden" }}>
            <span
              data-gacha-knob=""
              style={{
                width: Math.max(28, Math.round(w * 0.22)),
                height: Math.max(28, Math.round(w * 0.22)),
                borderRadius: "50%",
                background: p.primary,
                color: p.onPrimary,
                display: "grid",
                placeItems: "center",
                transform: `rotate(${run ? (run.lit + 1) * 40 : 0}deg)`,
                transition: run ? "transform 120ms linear" : undefined,
              }}
            >
              <Icon name="rotate_right" size={Math.max(16, Math.round(w * 0.1))} />
            </span>
            <div style={{ display: "flex", gap: 6, width: "100%" }}>
              {[{ text: item.label.trim(), many: false }, { text: secondLabel(item), many: true }].map((b, i) => (
                <span
                  key={i}
                  data-gacha-button={b.many ? "ten" : "one"}
                  style={{ flex: 1, minWidth: 0, height: Math.max(24, Math.round(h * 0.14)), borderRadius: 12, background: i === 0 ? p.primary : p.secondaryContainer, color: i === 0 ? p.onPrimary : p.onSecondaryContainer, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap" }}
                >
                  {b.text}
                </span>
              ))}
            </div>
            {lit >= 0 && prizes[lit] && (
              <span data-gacha-prize={prizes[lit].label} style={{ position: "absolute", right: 8, bottom: 6, fontSize: 11, fontWeight: 700, color: p.primary }}>{prizeLabel(prizes[lit])}</span>
            )}
          </div>
        </div>
      );
    }

    
    
    case "slot": {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const wheelOf = useWheelRun();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const reelsOf = useReels();
      /* Three reels and a lever: the reels flick through the pool while the draw runs and stop on the
         prize it landed on, all three showing it. */
      const prizes = item.prizes && item.prizes.length ? item.prizes : defaultPrizes();
      const run = wheelOf?.(item.id);
      const win = run?.lit ?? -1;
      const reels = reelsOf?.(item.id);
      const shownAt = (i: number) => {
        const at = reels ? reels[i] : run ? run.lit + i : 0;
        return prizes[((at % prizes.length) + prizes.length) % prizes.length];
      };
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 6, padding: 8, boxSizing: "border-box" }}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} data-slot-reel={i} style={{ flex: 1, minWidth: 0, borderRadius: 10, background: p.surfaceContainerLow, border: `2px solid ${p.outlineVariant}`, display: "grid", placeItems: "center", color: p.onSurface, overflow: "hidden", fontSize: 20 }}>
                {(() => {
                  const pr = shownAt(i);
                  return (
                    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, maxWidth: "100%", overflow: "hidden" }}>
                      {pr?.icon && <Icon name={pr.icon} size={22} />}
                      <span style={{ fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{prizeLabel(pr)}</span>
                    </span>
                  );
                })()}
              </div>
            ))}
          </div>
          <div style={{ height: 24, borderRadius: 12, background: p.primary, color: p.onPrimary, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, overflow: "hidden" }}>
            {item.label.trim()}
          </div>
        </div>
      );
    }

    case "calendar": {
      /* A month of days with the ones already signed in the primary colour: the visitor's own count
         is the part's value, so the canvas shows what the author left and the preview counts on. */
      const days = CALENDAR_DAYS;
      const signed = clampValue(item.value ?? 0, days);
      const rows = calendarRows(days);
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 6, padding: 8, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: p.onSurface }}>
            <span>{item.label.trim()}</span>
            <span data-calendar-count={signed} style={{ color: p.primary }}>{`${signed}/${days}`}</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: `repeat(${CALENDAR_COLS}, 1fr)`, gap: 3 }}>
            {Array.from({ length: rows * CALENDAR_COLS }, (_, i) => {
              const day = i + 1;
              /* the day's number scales with the calendar, so the tick on it can too */
              const fontSize = Math.max(10, Math.round((item.size ?? CALENDAR_W) / 26));
              const on = day <= signed;
              const today = day === signed + 1 && signed < days;
              return (
                <div
                  key={i}
                  data-calendar-day={day <= days ? day : undefined}
                  data-calendar-signed={on ? "" : undefined}
                  style={{
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 8,
                    fontSize,
                    fontWeight: on || today ? 700 : 500,
                    background: on ? p.primary : today ? p.primaryContainer : i % 2 ? p.surfaceContainerLow : p.surfaceContainerHigh,
                    color: on ? p.onPrimary : today ? p.onPrimaryContainer : day <= days ? p.onSurfaceVariant : "transparent",
                    outline: today ? `2px solid ${p.primary}` : undefined,
                  }}
                >
                  {day <= days && (
                    /* a signed day keeps its number and wears the tick across it, the way a wall
                       calendar is crossed off */
                    <span style={{ position: "relative", display: "grid", placeItems: "center", width: "100%", height: "100%" }}>
                      <span style={{ opacity: on ? 0.45 : 1 }}>{day}</span>
                      {on && (
                        <span data-calendar-tick="" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: p.onPrimary }}>
                          <Icon name="check" size={Math.max(14, Math.round(fontSize * 1.6))} />
                        </span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case "rewardTrack": {
      /* A progress bar that hands things out: the visitor's progress is the part's own value, the
         bar shows how far along it is, and every reward waits at its mark with the number it needs
         under it. A reward in reach is tapped to take it, and its icon becomes the check that says
         it is taken — which is the whole point of the part. */
      const { claim, claimed } = useClaims();
      const g = rewardMarks(item, widths ?? {});
      const pct = g.max > 0 ? (g.value / g.max) * 100 : 0;
      const numFont = Math.max(9, Math.round(g.tile * 0.28));
      const nameFont = Math.max(8, Math.round(g.tile * 0.2));
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {/* the track and the visitor's share of it */}
          <div
            data-reward-track=""
            style={{ position: "absolute", left: 0, right: 0, top: g.barY, height: g.barH, borderRadius: g.barH / 2, background: p.secondaryContainer, overflow: "hidden" }}
          >
            <div data-reward-fill={Math.round(pct)} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: p.primary }} />
          </div>
          {g.marks.map((m) => {
            const taken = claimed?.(item.id, m.i) ?? false;
            const live = !!claim && m.ready && !taken;
            const ink = taken ? p.onPrimaryContainer : m.ready ? p.onSurface : p.onSurfaceVariant;
            return (
              <div key={m.i}>
                {/* the mark: the tile on top, a pointer down to the bar, and the number the progress
                    has to reach sitting under it */}
                <span
                  aria-hidden
                  style={{ position: "absolute", left: m.x + g.tile / 2 - 8, top: g.barY - 11, width: 16, height: 11, display: "grid", placeItems: "center", color: m.ready ? p.primary : p.outline, pointerEvents: "none" }}
                >
                  <Icon name="arrow_drop_down" size={16} />
                </span>
                <button
                  type="button"
                  data-reward={m.i}
                  data-reward-state={taken ? "claimed" : m.ready ? "ready" : "locked"}
                  disabled={!live}
                  onPointerDown={live ? (e) => e.stopPropagation() : undefined}
                  onClick={
                    live
                      ? (e) => {
                          e.stopPropagation();
                          claim?.(item.id, m.i);
                        }
                      : undefined
                  }
                  title={`${item.label.trim() || KIND_TEXT[lang]?.rewardTrack?.noun || ""} ${m.at}`.trim()}
                  style={{
                    position: "absolute",
                    left: m.x,
                    top: 0,
                    width: g.tile,
                    height: g.tile,
                    boxSizing: "border-box",
                    padding: 0,
                    borderRadius: Math.round(g.tile * 0.28),
                    border: m.ready && !taken ? `2px solid ${p.primary}` : `1px solid ${p.outlineVariant}`,
                    background: taken ? p.primaryContainer : p.surfaceContainerLow,
                    color: ink,
                    cursor: live ? "pointer" : "default",
                    /* a reward the progress has not reached is there to be seen, not to be taken */
                    opacity: m.ready || taken ? 1 : 0.5,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <span style={{ display: "grid", placeItems: "center", marginBottom: nameFont + 2 }}>
                    <Icon name={taken ? "check" : m.reward.icon || "redeem"} size={Math.round(g.tile * 0.46)} />
                  </span>
                  {!m.ready && !taken && (
                    <span aria-hidden style={{ position: "absolute", top: 2, right: 2, color: p.onSurfaceVariant, pointerEvents: "none" }}>
                      <Icon name="lock" size={Math.round(g.tile * 0.24)} />
                    </span>
                  )}
                  {!!m.reward.label.trim() && (
                    /* the count sits inside the tile, along its foot, the way a game draws it */
                    <span
                      data-reward-label={m.reward.label.trim()}
                      style={{ position: "absolute", left: 0, right: 2, bottom: 3, textAlign: "center", fontSize: nameFont, fontWeight: 700, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {m.reward.label.trim()}
                    </span>
                  )}
                </button>
                <span
                  data-reward-at={m.at}
                  style={{ position: "absolute", left: m.x, top: g.barY + g.barH + 1, width: g.tile, height: g.numH, display: "grid", placeItems: "center", fontSize: numFont, fontWeight: 700, color: m.ready ? p.primary : p.onSurfaceVariant, fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}
                >
                  {m.at}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    case "loadingIndicator": {
      const s = item.size ?? 48;
      return (
        <LoadingIndicator
          size={s}
          color={item.contained ? p.onPrimaryContainer : p.primary}
          contained={item.contained}
          containerColor={p.primaryContainer}
        />
      );
    }
  }
  return null;
}

function boxStyle(item: Item, p: Palette): React.CSSProperties {
  if (NO_BOX.includes(item.kind)) return { background: "transparent", border: "none" };
  /* a part given a colour of its own paints its surface with it, drawing its own
   * readable ink; an outlined part keeps an outline in the same colour */
  const own = colorOverrideOf(item, p);
  if (own) {
    const outlined = item.variant === "outlined" || item.kind === "textField" || item.kind === "select";
    return { background: own.main, color: own.on, border: outlined ? `1px solid ${own.main}` : "none" };
  }
  switch (item.kind) {
    case "joystick":
      return { background: p.surfaceContainerHighest, color: p.onSurfaceVariant, border: `1px solid ${p.outlineVariant}` };
    case "wheel":
      return { background: p.surfaceContainerHighest, color: p.onSurface, border: `1px solid ${p.outlineVariant}` };
    case "gridWheel":
      return { background: p.surfaceContainerLow, color: p.onSurface, border: `1px solid ${p.outlineVariant}` };
    case "box": {
      const t = item.fill ?? "surfaceContainerLow";
      return { background: fillColor(t, p, "surfaceContainerLow"), color: fillInk(t, p, "surfaceContainerLow"), border: "none" };
    }
    case "invGrid": {
      /* the frame paints a surface the way a box does; the child frame and the cells on it are
         painted by the grid itself, against roles of their own */
      const t = item.fill ?? "surfaceContainer";
      return { background: fillColor(t, p, "surfaceContainer"), color: fillInk(t, p, "surfaceContainer"), border: "none" };
    }
    case "stepper":
      /* a filled field: the row the two buttons and the number sit in */
      return { background: p.surfaceContainerHighest, color: p.onSurface, border: "none" };
    case "button":
    case "iconButton":
    case "fab":
    case "extendedFab": {
      /* a picture of its own sits behind the words and the icon */
      const look = variantStyle(item.variant, p);
      return item.src ? { ...look, backgroundImage: `url("${item.src}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : look;
    }
    case "chip":
      if (item.checked) return { background: p.secondaryContainer, color: p.onSecondaryContainer, border: "none" };
      return item.variant === "outlined"
        ? { background: "transparent", color: p.onSurfaceVariant, border: `1px solid ${p.outlineVariant}` }
        : { background: p.surfaceContainerLow, color: p.onSurfaceVariant, border: "none" };
    case "card":
      return { background: fillColor(cardFillOf(item), p, "surfaceContainerHighest"), border: item.variant === "outlined" ? `1px solid ${p.outlineVariant}` : "none" };
    case "textField":
    case "select":
      return item.variant === "filled"
        ? { background: p.surfaceContainerHighest, border: "none", color: p.onSurface }
        : { background: p.surface, border: `1px solid ${p.outline}`, color: p.onSurface };
    case "topAppBar":
    case "bottomNav":
    case "navRail":
      return { background: p.surfaceContainer, border: "none", color: p.onSurface };
    case "toolbar":
      return item.variant === "filled"
        ? { background: p.primaryContainer, border: "none", color: p.onPrimaryContainer }
        : { background: p.surfaceContainer, border: "none", color: p.onSurfaceVariant };
    case "tabs":
    case "sideTabs":
      return { background: p.surface, border: "none", color: p.onSurface };
    case "searchBar":
      return { background: p.surfaceContainerHigh, border: "none", color: p.onSurface };
    case "dialog":
      return { background: p.surfaceContainerHigh, border: "none", color: p.onSurface };
    case "snackbar":
      return { background: p.inverseSurface, border: "none", color: p.inverseOnSurface };
    case "image":
    case "map":
      return { background: p.surfaceContainerHighest, border: "none" };
    case "camera":
      return { background: p.inverseSurface, border: "none", color: p.inverseOnSurface };
    case "listItem": {
      const t = item.fill ?? "surfaceContainerLow";
      return { background: fillColor(t, p, "surfaceContainerLow"), border: "none", color: fillInk(t, p, "surfaceContainerLow") };
    }
    case "assetPill": {
      /* the bar's own surface: a role, or a colour of the author's own (see fillColor) */
      const t = item.fill ?? "surfaceContainerHigh";
      return { background: fillColor(t, p, "surfaceContainerHigh"), border: "none", color: fillInk(t, p, "surfaceContainerHigh") };
    }
    case "taskBar": {
      /* 任务信息条自己的底：一个刚放下的写的是 TASK_BAR_FILL（那个 composite 画出来的那一层），
         作者改成别的角色或者自己的颜色就按作者的（见 fillColor）。里面那两个格子各画各的底。 */
      const t = item.fill ?? TASK_BAR_FILL;
      return { background: fillColor(t, p, TASK_BAR_FILL), border: "none", color: fillInk(t, p, TASK_BAR_FILL) };
    }
    case "confirmBox": {
      /* 确认框自己的底：一个刚放下的写的是 CONFIRM_BOX_FILL（作者原稿那个框的那一层），作者改成
         别的角色或者自己的颜色就按作者的（见 fillColor）。那颗正文带和它同色，画上去看不见。 */
      const t = item.fill ?? CONFIRM_BOX_FILL;
      return { background: fillColor(t, p, CONFIRM_BOX_FILL), border: "none", color: fillInk(t, p, CONFIRM_BOX_FILL) };
    }
    default:
      return { background: p.surfaceContainerHigh, border: "none", color: p.onSurface };
  }
}

function shadowOf(item: Item): string {
  if (NO_BOX.includes(item.kind)) return "none";
  switch (item.kind) {
    case "navRail":
      return item.railModal && item.railExpanded ? "0 2px 6px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.10)" : "none";
    case "button":
    case "iconButton":
    case "extendedFab":
      return variantShadow(item.variant);
    case "fab":
      return FAB_SHADOW;
    case "card":
      return item.variant === "elevated" ? "0 1px 3px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.10)" : "none";
    case "dialog":
      return "0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)";
    case "snackbar":
      return "0 3px 8px rgba(0,0,0,0.18)";
    case "toolbar":
      return "0 2px 6px rgba(0,0,0,0.14), 0 1px 2px rgba(0,0,0,0.10)";
    default:
      return "none";
  }
}

export type { Radii };

/** Corner radii are driven continuously by the magnet; a stiff spring keeps them on the pointer. */
const RADIUS_TWEEN = { type: "spring" as const, stiffness: 900, damping: 48, mass: 0.4 };

export function M3Node({
  item,
  palette,
  radii,
  widths,
  pressed,
  dragging,
  selected,
  inRun = false,
  interactive = true,
  onPointerDown,
  tabScroll,
  overlay,
  style,
  scroll,
  onWheel,
  onClickCapture,
}: {
  item: Item;
  palette: Palette;
  radii?: Radii;
  widths: Record<string, number>;
  pressed?: boolean;
  dragging?: boolean;
  selected?: boolean;
  /** the part sits in a connected run (non-free group, or a hidden run inside a free group) */
  inRun?: boolean;
  interactive?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  /** how far a scrollable tab row is scrolled in the preview; the canvas uses the resting position */
  tabScroll?: number;
  /** a container's children, drawn inside its box (their offsets are the container's own) */
  overlay?: React.ReactNode;
  /** what the editor adds to the wrapper: an invisible run member still takes its space */
  style?: React.CSSProperties;
  /** a scrolling container's live offset in the preview; the authored one is drawn when absent */
  scroll?: { x?: number; y?: number };
  /** the preview turns a wheel over a scrolling container into movement */
  onWheel?: React.WheelEventHandler<HTMLDivElement>;
  /** the preview swallows the click that ends a scroll drag, so it does not also tap a child */
  onClickCapture?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const reducedMotion = useReducedMotion();
  const instantRail = reducedMotion && item.kind === "navRail" && isWideRail(item);
  const radiusTransition = instantRail ? { duration: 0 } : RADIUS_TWEEN;
  const r = radii ?? baseRadii(item);
  const size = sizeOf(item, widths);
  const measured = MEASURED.includes(item.kind) && !(AUTHOR_WIDTHS.includes(item.kind) && item.size);
  const clips = !NO_BOX.includes(item.kind) && item.kind !== "textField" && item.kind !== "select";
  /* a part with a colour of its own draws from a scheme whose primary role is that colour */
  const ep = paletteForItem(item, palette);
  /* 一条被徽标里的锁锁住的任务信息条：它里面的按钮点了没有反应（作者的原话「当出现这个锁的图标
     时，该按钮点击时，禁止响应」——见 lib/tokens 的 taskBarButtonLocked）。这一层给的是**画在编辑器
     里的那一份**：它永远不按下（pressed 也压不动它），鼠标也不摆出"抓一下"的样子。真正的点击拦截在
     预览的那条路上（Preview.tsx 的 Tappable，那里才是每一次点按都要过的门）。编辑器自己的选中和拖动
     照旧 —— 那是编辑器的手势，不是按钮的响应；锁着就选不了、也就解不开锁了。 */
  const locked = taskBarButtonLocked(item);

  return (
    <motion.div
      data-node={item.id}
      /* 给浏览器探针用的稳定标记（纯新增，不参与样式和行为）：每个部件的最外层元素都带自己的 id */
      data-part-id={item.id}
      data-kind={item.kind}
      data-wide-rail={item.kind === "navRail" && isWideRail(item) ? "true" : undefined}
      data-locked={item.kind === "taskBar" && locked ? "true" : undefined}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      onClickCapture={onClickCapture}
      initial={false}
      animate={{
        borderTopLeftRadius: r.tl,
        borderBottomLeftRadius: r.bl,
        borderTopRightRadius: r.tr,
        borderBottomRightRadius: r.br,
        scale: pressed && !locked ? 0.97 : 1,
        /* motion owns the transform: the turn is animated here rather than written into `style`, so a
           part that is turned still presses and grows the way an upright one does */
        rotate: rotOf(item),
      }}
      transition={{
        borderTopLeftRadius: radiusTransition,
        borderBottomLeftRadius: radiusTransition,
        borderTopRightRadius: radiusTransition,
        borderBottomRightRadius: radiusTransition,
        scale: instantRail ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 30, mass: 0.5 },
      }}
      style={{
        ...boxStyle(item, ep),
        width: measured ? undefined : size.w,
        height: size.h,
        display: measured ? "inline-flex" : "block",
        alignItems: "center",
        overflow: clips ? "hidden" : "visible",
        /* the selection ring sticks out 5px (3px offset + 2px ring); in a run the next
           sibling sits 3px away and would overpaint that edge — lift the selected part.
           Runs never overlap, so the lift only beats the sibling that hides the ring.
           Lone parts in free groups may overlap by design: keep their layer order. */
        position: "relative",
        /* the author's own level decides what draws over what; parts at the same level
           keep the order they are listed in */
        zIndex: selected && inRun ? 1_000_000 : layerOf(item),
        cursor: !interactive || locked ? "default" : dragging ? "grabbing" : "grab",
        userSelect: "none",
        touchAction: "none",
        boxSizing: "border-box",
        /* a badge rings its own pill and an item cell its own square, so the box behind them draws no
           ring of its own */
        boxShadow: [item.kind === "badge" || item.kind === "itemCell" ? null : strokeOf(item, ep), shadowOf(item)].filter((v) => v && v !== "none").join(", ") || "none",
        outline: selected ? `2px solid ${palette.primary}` : "2px solid transparent",
        outlineOffset: 3,
        /* a part turns about its own middle: the place it takes in the layout does not move */
        transformOrigin: "center",
        /* a part that changes width with its screen eases the way the screen does */
        transition: measured ? "outline-color 120ms" : `outline-color 120ms, width ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`,
        flex: "0 0 auto",
        /* what the editor adds to the wrapper: the place a folded navigation part sits in, say */
        ...style,
      }}
    >
      <Body item={item} p={ep} tabScroll={tabScroll} widths={widths} />
      <ScrollLayer item={item} p={ep} widths={widths} scroll={scroll}>
        {overlay}
      </ScrollLayer>
    </motion.div>
  );
}

/** Plain (non-animated) rendering of a part; used where frames must be deterministic. */
export function M3Static({
  item,
  palette,
  radii,
  style,
  overlay,
}: {
  item: Item;
  palette: Palette;
  radii?: Radii;
  style?: React.CSSProperties;
  /** a container's children, drawn inside its box */
  overlay?: React.ReactNode;
}) {
  const r = radii ?? baseRadii(item);
  const size = sizeOf(item, {});
  const measured = MEASURED.includes(item.kind) && !(AUTHOR_WIDTHS.includes(item.kind) && item.size);
  const clips = !NO_BOX.includes(item.kind) && item.kind !== "textField" && item.kind !== "select";
  const ep = paletteForItem(item, palette);
  return (
    <div
      data-part-id={item.id}
      style={{
        ...boxStyle(item, ep),
        width: measured ? undefined : size.w,
        height: size.h,
        display: measured ? "inline-flex" : "block",
        alignItems: "center",
        overflow: clips ? "hidden" : "visible",
        position: "relative",
        zIndex: layerOf(item),
        boxSizing: "border-box",
        /* a badge rings its own pill and an item cell its own square, so the box behind them draws no
           ring of its own */
        boxShadow: [item.kind === "badge" || item.kind === "itemCell" ? null : strokeOf(item, ep), shadowOf(item)].filter((v) => v && v !== "none").join(", ") || "none",
        borderTopLeftRadius: r.tl,
        borderTopRightRadius: r.tr,
        borderBottomLeftRadius: r.bl,
        borderBottomRightRadius: r.br,
        flex: "0 0 auto",
        transformOrigin: "center",
        transform: rotStyle(item),
        ...style,
      }}
    >
      <Body item={item} p={ep} widths={{}} still />
      <ScrollLayer item={item} p={ep} widths={{}}>
        {overlay}
      </ScrollLayer>
    </div>
  );
}
