# MindFlow Requirements Backlog

这份文档是 MindFlow 的统一需求池。

从现在开始，新的产品需求、体验问题、后续改进项，先记录到这里，再决定是否拆成独立 plan。

## 使用规则

- 新需求先进入这一份文档，不再分散写在多个临时文档里
- 每条需求必须归类
- 每条需求必须带状态
- 决策未定、不能直接进入开发的需求，使用 `DEC` 分类，默认状态为 `parked`
- 当某条需求进入正式实施时，在这里补充对应的 plan 链接
- 当某条需求完成后，保留记录，但把状态改为 `done`

## 常见需求分类

| 分类代码 | 分类名称 | 适用范围 |
| --- | --- | --- |
| `UX` | 界面与交互 | 弹窗、按钮、反馈方式、页面状态、视觉一致性、操作流畅度 |
| `SRC` | 信息源接入与源管理 | RSS / RSSHub / we-mp-rss 接入、批量导入、来源配置、抓取入口 |
| `AI` | AI 加工与内容生成 | 摘要、锚点提取、Digest 生成、推荐解释、模型接入 |
| `FLOW` | 阅读链路与信息工作流 | Daily Digest、Now、详情页、搜索、统一时间线、处理流转 |
| `DATA` | 数据模型与接口契约 | 前后端字段、API 契约、状态字段、持久化结构 |
| `OPS` | 部署、运行与可靠性 | Docker、调度器、任务稳定性、错误恢复、监控与日志 |
| `DX` | 开发体验、测试与文档 | 测试基线、开发脚本、调试工具、文档同步、维护约定 |
| `DEC` | 决策型需求 | 需要先明确产品方向、页面边界或范围取舍的问题 |

## 状态定义

| 状态 | 含义 |
| --- | --- |
| `open` | 已确认要记录，尚未进入具体实施 |
| `planned` | 已进入明确计划或已挂接独立 plan |
| `in_progress` | 正在实施 |
| `done` | 已完成并验证 |
| `parked` | 暂不推进，但保留需求记录 |

## 当前需求池

### 已录入的交互与 Source 体验需求

| ID | 分类 | 优先级 | 状态 | 需求 | 备注 | 关联计划 |
| --- | --- | --- | --- | --- | --- | --- |
| `REQ-UX-001` | `UX` | P1 | `open` | 把 Sources 页“删除来源”操作从浏览器原生确认弹窗改成产品内确认对话框 | 当前交互风格与页面整体设计语言不一致 | [2026-04-22-sources-we-mprss-auth-ui.md](superpowers/plans/2026-04-22-sources-we-mprss-auth-ui.md) |
| `REQ-SRC-001` | `SRC` | P1 | `open` | 支持批量导入或批量配置多个微信公众号 RSS 源 | 当前只能逐个配置 `we-mp-rss` source，批量接入成本偏高 | [2026-04-22-sources-we-mprss-auth-ui.md](superpowers/plans/2026-04-22-sources-we-mprss-auth-ui.md) |
| `REQ-SRC-002` | `SRC` | P2 | `open` | 重做 `Quick Add RSS`，基于 feed URL 自动推断 source type 并引导正确配置 | 当前快速添加价值有限，未来应成为更智能的入口 | [2026-04-22-sources-we-mprss-auth-ui.md](superpowers/plans/2026-04-22-sources-we-mprss-auth-ui.md) |

### 基于 `2026-04-22-plan-draft.md` 拆解的后续开发需求

以下需求来自 [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) 的优先级分析。

这些条目已经进入明确的后续规划，因此默认状态记为 `planned`；需要先做产品决策的条目，单独归为 `DEC` 并记为 `parked`。

#### 调度与任务可靠性

| ID | 分类 | 优先级 | 状态 | 需求 | 备注 | 关联计划 |
| --- | --- | --- | --- | --- | --- | --- |
| `REQ-OPS-001` | `OPS` | P1 | `planned` | 修通并验证 `定时抓取 -> 锚点提取 -> Digest 生成` 的后台任务链路 | 对应 plan-draft Rank 1，优先解决调度链路不稳定问题 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-OPS-002` | `OPS` | P1 | `planned` | 为后台任务补齐执行状态、结果与失败原因的可观测能力 | 任务需要可追踪、可定位失败，不再只停留在后台执行 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-OPS-003` | `OPS` | P1 | `planned` | 增加任务 / 日志页，面向用户或操作者展示任务运行记录 | 当前 MVP 缺少任务页与日志页闭环 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-OPS-004` | `OPS` | P1 | `planned` | 把刷新频率设置从已有 API 接到前端设置页 | 后端已有 schedule API，但 UI 尚未接入 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |

#### 检索与内容输出能力

| ID | 分类 | 优先级 | 状态 | 需求 | 备注 | 关联计划 |
| --- | --- | --- | --- | --- | --- | --- |
| `REQ-FLOW-001` | `FLOW` | P1 | `planned` | 补齐文章搜索能力 | 顶部搜索框目前未接线 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-FLOW-002` | `FLOW` | P1 | `planned` | 支持时间、来源、标签、状态等多维筛选 | 当前文章列表过滤能力明显不足 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-FLOW-003` | `FLOW` | P2 | `planned` | 增加导出能力 | 属于 PRD 范围内的内容输出能力，但优先级低于检索与筛选闭环 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-FLOW-004` | `FLOW` | P1 | `planned` | 为搜索 / 筛选结果补齐可消费的阅读入口与结果闭环 | 搜索与筛选不能只停留在列表，需要接上现有阅读工作流 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |

#### 平台化数据模型与治理

| ID | 分类 | 优先级 | 状态 | 需求 | 备注 | 关联计划 |
| --- | --- | --- | --- | --- | --- | --- |
| `REQ-DATA-001` | `DATA` | P1 | `planned` | 扩充 Source 数据模型，补齐 `enabled / category / tags / refresh_interval / last_error` 等治理字段 | 当前 Source 模型还不足以支撑平台化管理 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-DATA-002` | `DATA` | P1 | `planned` | 扩充 Entry / Job 的状态字段与管理语义 | 为任务追踪、检索和治理能力提供底层模型支撑 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-DATA-003` | `DATA` | P1 | `planned` | 同步扩展前后端 API 契约，使治理字段与状态模型可被前端消费 | 避免模型扩展后前后端继续脱节 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-SRC-003` | `SRC` | P2 | `planned` | 在 Sources 管理页展示并编辑新增的治理字段 | 数据模型扩展后，Source 管理页需要具备相应操作入口 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |

#### 决策型需求

| ID | 分类 | 优先级 | 状态 | 需求 | 备注 | 关联计划 |
| --- | --- | --- | --- | --- | --- | --- |
| `REQ-DEC-001` | `DEC` | P2 | `parked` | 决定是否补“统一时间线 / 搜索结果阅读面” | 这是产品边界决策，不应直接混成普通待开发功能 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |

#### 文章级 AI 加工增强

| ID | 分类 | 优先级 | 状态 | 需求 | 备注 | 关联计划 |
| --- | --- | --- | --- | --- | --- | --- |
| `REQ-AI-001` | `AI` | P2 | `planned` | 增加文章级关键词提取 | 从“摘要”扩展到更完整的文章 processing 层 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-AI-002` | `AI` | P2 | `planned` | 增加文章语言识别 | 为后续翻译和内容处理策略提供基础信号 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-AI-003` | `AI` | P2 | `planned` | 提供可选翻译能力 | 作为文章级 AI 加工增强的一部分，而非当前主链路前置条件 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |
| `REQ-AI-004` | `AI` | P2 | `planned` | 明确文章级 processing 状态在 Detail / Digest / Now 中的消费方式 | AI 加工结果不仅要生成，还要有稳定的消费路径 | [2026-04-22-plan-draft.md](superpowers/plans/2026-04-22-plan-draft.md) |

## 新需求录入模板

新增需求时，按下面字段补一行：

| ID | 分类 | 优先级 | 状态 | 需求 | 备注 | 关联计划 |
| --- | --- | --- | --- | --- | --- | --- |
| `REQ-XXX-000` | `UX / SRC / AI / FLOW / DATA / OPS / DX / DEC` | `P1 / P2 / P3` | `open / planned / in_progress / done / parked` | 一句话描述需求 | 为什么要做 / 当前痛点 | plan 链接或 `-` |
