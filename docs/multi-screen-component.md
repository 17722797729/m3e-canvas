# 跨屏组件（一组屏一起上传）—— 设计与施工图

一个组件落到别人的画布上时，**引用是按 id 写的**（一个 frame id，或者某个部件的 id），而 id 是文档内的：
换一份文档就不成立了。所以"点 A 上的删除图标 → 弹出 B 的确认框"这种跨屏联动，上传 A 时那条引用在别人
的画布上指不到任何东西 —— 而且**静默什么都不发生**（`Preview` 的 `go()` 里 `frames.find(...)` 找不到就
`return`，编辑器审计把它报成 `deadLink`「点击没有目标」）。

这份说明记的是定下来的做法：**引用到的屏一起打包，落地时建成真屏并把引用重指过去。**

## 定下来的规矩（作者逐条确认过）

| 规矩 | 说明 |
|---|---|
| 闭包 | A→B→C：上传 A 时 C 也在清单里、也一起打包 |
| 去重 | 每个屏只带**一份**：A↔B 互相引用也只有 A 和 B 两个（`seen` 集合就是去重，环不需要特殊处理） |
| 上限 | **最多 3 屏（含起屏自己）**；超过**不让上传**（不是"提醒一下还能传"） |
| 落地 | 接收方那边**多出真屏**：出现在图层里、能编辑、能再被引用 |
| 起屏 | **不建**：起屏的内容就是拖进来的那个组件本身。所以"回到起屏"的引用重指到**组件所落的那一页**（组件在哪儿，那一屏就在哪儿）；其余每一屏各建一页真屏 |
| 同名 | 接收方已有同名屏就**并存**（各建各的，不合并、不改名） |
| 不记来源 | 不写"来自某组件"这类标记：用户用了就是他的内容，之后按他的文档对待 |
| 流程图/文档 | **不需要额外登记**：`buildFlow`（流程图）和 `buildDocs`（文档）都是从 `Doc` 现算的，所以"建真屏 + 重指引用"之后它们自动就有那几屏和那几条跨屏连线 |
| 市场详情页 | **现有预览不变**；另加一块区域列出这一组屏（A、B、C…），点一屏把上面的预览切到那一屏 |
| 跳转与弹框一视同仁 | 跳过去的页、弹在 A 上的弹框**都是 frame**；`role: "overlay"` + `level` 照带，落地后仍旧弹在那一屏上 |

## 什么算"引用了别的屏"

四类引用都算，缺一类就会静默漏屏：

| 出处 | 目标 | 形态 |
|---|---|---|
| `item.action.to`、`item.actions[槽].to` | frame id，或**画在某屏上的浮层部件**的 id | 跳转 / 弹框 |
| 流程步骤 `do: {kind:"goto"}.to` | **只能是 frame id**（预览那条路只认 frame） | 跳转 |
| **`frame.swipe[方向]`** | frame id | 滑动换屏 —— 长在**屏**上，不在部件上，最容易漏 |
| 流程步骤 `do: {kind:"look"}.target`、`item.shows` | **任何部件**的 id（候选项本来就按屏分组） | 改 / 读别的屏上的部件 |

两个哨兵值**不算**跨屏：`back`、`close`（`CLOSE_PANEL_TARGET`）—— 它们在预览里本地兑现，换了文档照样
成立。

两种"不算跨屏但要留意"的，按同一支笔处理：

- **画在本屏上的浮层部件**（`action.to` = 那个部件的 id）：不带走任何屏，但它的 id 落地时会换，所以落地
  那一步要一起重指。判断阶段它既不算 `out` 也不算 `dead`。
- **指到已经不在的屏/部件**：算 `dead` 单独报出来（就是审计面板里那条 `deadLink`）。顺带一提，审计目前
  只看部件的 `action` / `actions`，**不看**流程步骤里的 `goto`、`look.target`，也不看 `frame.swipe`
  —— 这三处现在只有上传判断在管。

## 闭包算法（`lib/screens.ts`）

```
visited = {A}; queue = [A]; screens = []; refs = []; dead = []
while queue:
  f = queue.shift(); screens.push(f)
  for ref in refsOfScreen(f):          # 上表四类，遍历 f 这一屏的全部部件（含容器里的孩子）
    if ref 指不到任何东西: dead.push(ref); continue
    if ref 落在 f 自己身上: continue    # 本屏浮层 / 本屏部件：不带走屏
    refs.push(ref)
    if ref.owner not in visited: visited.add(ref.owner); queue.push(ref.owner)
over = screens.length > MAX_UPLOAD_SCREENS      # 3
```

- **每个屏只进一次**，`screens` 的顺序就是发现顺序（起屏在第一个）——上传清单和详情页都按它展示。
- 超上限时闭包**照样算完整**（`over` 只是为真）：提示里要说得清"多出来的是哪几屏"，作者才知道去删哪条
  引用。

## 打包格式（`lib/market.ts`）

```ts
ScreenData = { name, w, h, bg?, role?, level?, autoClose?, note?, groups }
```

- `groups` 就是现有的 `SerializedGroup`（坐标已相对屏左上角）。
- `packData(..., screen?, screens?)`：`screens` 是闭包（起屏在前）。**只有不止一屏时才写**，所以只上传
  一屏的老路径载荷里一个字都不多；写了 `screens` 时 `screen` 照旧写第一屏 —— 老读者认那一项，详情页现有
  的预览也用它。
- `parseMarketData` 读不出来就整屏丢掉，`MarketPart.screens` **总是**至少含第一屏（旧组件就一屏），
  没有屏幕时是空数组。
- **引用关系不存进数据**：落地时按 `groups` 现算，和上传时共用同一份 `refsOfScreen`，载荷里不留第二份真相。

## 落地（工程量在这里）

| 字段 | 目标 | 规则 |
|---|---|---|
| `action.to`、`actions[*].to` | frame id / 浮层部件 id | 在带过来的集合里 → 换新 id |
| 流程 `goto.to` | frame id | 同 |
| `frame.swipe[方向]` | frame id | 同（**屏级**字段） |
| 流程 `look.target` | 部件 id | 在集合里 → 新 id |
| `shows` | 部件 id | 同 |
| `back` / `close` | — | **不动** |
| `flow` 的 `step.from/to`、`slotFlows` 的键、`states[].id` | 机器内部 | 不重指（跟着 flow 对象一起复制，本来就自洽） |

- **建屏**：按 `role` / `level` / `autoClose` / `bg` / `w` / `h` / `note` 建真 frame；找空位摆（复用粘贴
  那套"位置被占就 +24"）；`revealFrame` + 一条 toast「带上来了 3 个屏幕：A、B、C」。组件本身照旧落在当前
  那一屏上。
- **只重指"集合内"的目标** —— 最容易踩的一脚：`copySubtree` 现在**故意**不重指 frame 引用（原地复制一个
  按钮，不该改它指向的屏），这对"复制"是对的，对"组件实例带屏"就不够。所以**不改 `copySubtree`**，另写
  一支 `remapRefs(items, { frameMap, itemMap })`。
- 同一个组件拖两次 = 两套副本（各建各的屏）。
- **验收标准**：落地之后接收方的审计面板应当是干净的（没有 `deadLink`），流程图和文档里也该多出那几屏与
  那几条连线。

## 上传对话框

- 名称/类型/描述之后多一块「这一组屏」：每行 名字 · `页面`/`浮层` · 被引用几处 · `[查看]`。
- `over` 为真时**不让上传**：按钮禁用 + 说清"一共 N 屏，超过上限 3"，并把多出来的那几屏列出来。
- 主按钮文案：「带上这 3 个屏幕一起上传」。
- 死链单独一行说明（它们本来就没有去处，带上也变不好）。

## 做到哪一步了

三步都做完了，`tsc` / 全量 vitest / `next build` 都过。

- ✅ **判断与闭包**：`lib/screens.ts`（`refsOfScreen` / `screenClosure` / `refCountsOf` /
  `MAX_UPLOAD_SCREENS`）+ `lib/screens.test.ts`（链、环、自引用、死链、滑动、跨屏部件、上限）。
- ✅ **打包格式**：`lib/market.ts` 的 `ScreenData` / `packData` / `parseMarketData` / `MarketPart.screens`
  （`ScreenData.id` 记的是**上传前那一屏的 frame id** —— 落地认引用全靠它），`screenDataOf` 把一屏
  收成打包的样子 + `lib/market.test.ts` 里的那一组用例。
- ✅ **上传对话框**：`components/UploadMarketDialog.tsx` 多一块「这一组屏」（名字 · 页面/浮层 · 被引用
  几处 · 查看），超过 3 屏按钮禁用并说清多出来的是谁，死链单独一行；`components/UploadMarketDialog.test.tsx`
  盯着这几条。清单里的「查看」由编辑器给上（`onReveal`）。
- ✅ **落地**：`placeScreens`（建真屏、摆位、复制部件并收下新旧 id 的映射）+ `remapRefs` / `remapTree`
  （五类字段重指、哨兵不动、认不出来的原样留着）；编辑器在放手那一刻算出"落在哪一页"再重指，并 toast
  说一起带上了哪几屏（`screensArrived`）。验收用例：`lib/screens.test.ts` 里那条"A→B（弹框）→C→A
  打包落地之后**一处死链都没有**"。
- ✅ **市场详情页**：右侧信息卡多一块「这一组屏」，点一屏把上面的预览切到那一屏（预览本身没变，只是换了
  那一屏的数据）。

## 要动的文件

| 文件 | 干什么 |
|---|---|
| `lib/screens.ts` | 判断与闭包 + 落地建屏与重指（已做） |
| `lib/market.ts` | 打包格式（已做） |
| `components/UploadMarketDialog.tsx` | 清单 UI、上限拦截、把闭包交给 `packData` |
| `app/Editor.tsx` | 落地建屏 + 重指 + toast |
| `lib/tokens.ts` | `compositeInstance` 旁边加一支"连屏一起返回"的版本；`copySubtree` 不动 |
| `components/MarketDialog.tsx` | 「这一组屏」区域 |
| `lib/audit.ts` | （可选）把 `goto` / `look.target` / `frame.swipe` 也纳入 `deadLink` 判定 |
