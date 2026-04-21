# MindFlow UI 双语化执行计划（中文 / English）

> 执行模式：`$executing-plans`
> 
> 目标：除产品 Logo「MindFlow」外，将当前前端 UI 静态文案全部切换为可双语显示，并提供中英文切换能力。

## Scope & Decisions

- ✅ 本轮处理 **UI 静态文案**（导航、按钮、标题、提示、placeholder、空状态等）。
- ✅ 使用**零新依赖**实现（自建 i18n provider + locale 字典）。
- ✅ 语言设置持久化到 `localStorage`。
- ✅ 默认语言：优先用户已保存设置，否则按浏览器语言自动选择。
- ⚠️ 不翻译内容数据（如文章正文、AI 摘要、用户输入标签名）。

---

## Tasks

- [x] **Task 1 — 搭建 i18n 基础设施**
  - 新增 `I18nProvider / useI18n / t()`
  - 新增 `zh-CN` 与 `en-US` locale 字典
  - 在应用入口接入 provider

- [x] **Task 2 — 全局壳层双语化 + 语言切换入口**
  - TopNav / Sidebar / MobileNav 接入 `t()`
  - 增加语言切换控件（中/EN）

- [x] **Task 3 — Now 工作台双语化**
  - `pages/Now.tsx`
  - `components/now/NowContextRail.tsx`
  - `components/now/NowQueueList.tsx`
  - `components/now/NowDetailPane.tsx`

- [x] **Task 4 — 其余路由页面双语化**
  - `pages/Newsletter.tsx`
  - `pages/InterestSettings.tsx`
  - `pages/Sources.tsx`
  - `pages/Settings.tsx`

- [x] **Task 5 — 验证与收尾**
  - `npm run build`
  - 关键页面手测要点记录
  - 在本计划文档补齐每个 Task 的完成摘要

---

## Task Progress Updates

### Task 1
- 已新增 `frontend/src/i18n/` 基础设施：`I18nProvider`、`useI18n`、locale 字典、类型定义。
- 已在 `frontend/src/main.tsx` 接入 provider，语言状态支持本地持久化与浏览器默认语言自动识别。
- 已联动 `dayjs.locale`，为后续日期文本本地化打基础。

### Task 2
- TopNav / Sidebar / MobileNav 已接入 `t()`。
- TopNav 已新增中/EN 切换按钮（即时生效 + localStorage 持久化）。
- Logo「MindFlow」保持不翻译，其余壳层静态文案已双语化。

### Task 3
- `Now.tsx`、`NowContextRail`、`NowQueueList`、`NowDetailPane` 均已接入 `t()`。
- Now 页面头部、错误提示、空状态、按钮、标签、队列与详情区静态文案已双语化。
- 新增 zone 文案映射（main/explore/discover）与 score/read/processed 标签翻译。

### Task 4
- `pages/Newsletter.tsx` 已完成静态文案双语化，包含周切换面板、主频道卡片、探索区、惊喜盒子、反馈 Snackbar 等。
- `pages/InterestSettings.tsx` 已完成双语化，覆盖标题、副标题、状态标签、候选兴趣提示、操作按钮与底部说明区。
- `pages/Sources.tsx` 已完成双语化，覆盖头部、统计卡片、表格、快速添加区、抓取反馈弹窗、来源编辑/URL 解析弹窗。
- `pages/Settings.tsx` 已完成双语化，覆盖配置加载态、错误态、表单标签、按钮与反馈提示（含 provider 选项文本）。

### Task 5
- 已执行构建验证：`cd frontend && npm run build`（通过，Vite/TS 编译成功）。
- 已在代码层记录关键手测要点（语言切换后需确认）：TopNav 壳层、Now 工作台、Newsletter、Interests、Sources、Settings 页面文案与按钮状态均随中/英切换即时变化。
- Logo「MindFlow」保持不翻译，符合既定约束。
