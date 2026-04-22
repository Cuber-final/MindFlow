# MindFlow Development History

这份文档承接原先 README 中的阶段性“开发进度 / 后续计划”信息，作为开发人员回溯入口。

约定：

- `README.md` 只保留项目价值、能力、技术栈、使用与部署入口
- 阶段性进展、计划、PRD、执行记录统一沉淀到 `docs/`
- 新的增量需求统一先记录到 [docs/requirements-backlog.md](docs/requirements-backlog.md)

## 当前阶段快照

更新时间：`2026-04-22`

### 已完成的主链路

- Settings 页面已支持 `loading / load_error / unconfigured / configured` 四态
- AI 配置已支持“先测试、再保存”，并保留 `api_key` 的已有值语义
- `Daily Digest` 已支持按周查询、周切换与无简报日期灰显
- Digest 主通道已保留“减少这类话题内容”负反馈与撤销
- 主阅读链路已切换为 `Daily Digest -> Now Detail -> Read Source`
- `Now` 后端队列、详情、已读 / 已处理状态更新已打通
- 前端主路由已切换为 `/daily-digest` + `/now` 双核心结构
- `Now` 三栏工作台已接入优先级队列、摘要阅读与状态流转
- 前端 `fetchApi` 已兼容 `204 No Content`
- Docker 部署下前端已通过 Nginx 代理 `/api` 到后端，避免同源访问误读
- 核心静态 UI 文案已支持中英文双语切换
- 语言偏好已持久化到 `localStorage(mindflow.locale)`，首次访问支持浏览器语言兜底
- `we-mp-rss` 相关链路已补齐受保护源接入、内容回填与简报输入闭环验证

### 仍属于后续迭代的方向

- Exploration Zone / Surprise Box 的更深交互
- 候选标签 schema 与 API 契约继续收敛
- 批量抓取（Manual Crawl All）汇总反馈
- 更复杂的推荐抑制 / 质量反馈机制
- 多用户场景下将 workbench state 从 `articles` 中拆分
- 是否需要补一个统一时间线 / 搜索结果阅读面，仍待产品层面收束

## 回溯索引

- Superpowers 时间线入口：[docs/superpowers/README.md](superpowers/README.md)
- 统一需求池：[docs/requirements-backlog.md](docs/requirements-backlog.md)

### 产品与交互方向

- 双核心产品设计：[docs/superpowers/plans/2026-04-20-mindflow-next-phase-product-design.md](docs/superpowers/plans/2026-04-20-mindflow-next-phase-product-design.md)
- 早期交互审计归档：[`docs/superpowers/archive/`](docs/superpowers/archive)

### 实施计划

- Daily Digest + Now 工作台实现计划：[docs/superpowers/plans/2026-04-20-daily-digest-now-workbench.md](docs/superpowers/plans/2026-04-20-daily-digest-now-workbench.md)
- UI 双语切换 rollout：[docs/superpowers/plans/2026-04-21-ui-i18n-bilingual-rollout.md](docs/superpowers/plans/2026-04-21-ui-i18n-bilingual-rollout.md)
- `we-mp-rss` 闭环补齐计划：[docs/superpowers/plans/2026-04-22-we-mp-rss-digest-closure-plan.md](docs/superpowers/plans/2026-04-22-we-mp-rss-digest-closure-plan.md)
- Sources 鉴权 UI 计划：[docs/superpowers/plans/2026-04-22-sources-we-mprss-auth-ui.md](docs/superpowers/plans/2026-04-22-sources-we-mprss-auth-ui.md)
- 当前计划草稿：[docs/superpowers/plans/2026-04-22-plan-draft.md](docs/superpowers/plans/2026-04-22-plan-draft.md)

### 执行进展

- Daily Digest + Now 工作台进度：[docs/superpowers/progress/2026-04-21-daily-digest-now-workbench-progress.md](docs/superpowers/progress/2026-04-21-daily-digest-now-workbench-progress.md)
- UI 双语 rollout 进度：[docs/superpowers/progress/2026-04-21-ui-i18n-bilingual-rollout-progress.md](docs/superpowers/progress/2026-04-21-ui-i18n-bilingual-rollout-progress.md)
- `we-mp-rss` 闭环补齐进度：[docs/superpowers/progress/2026-04-22-we-mp-rss-digest-closure-progress.md](docs/superpowers/progress/2026-04-22-we-mp-rss-digest-closure-progress.md)

### 规格文档

- `we-mp-rss` 服务配置说明：[docs/superpowers/specs/we-mp-rss-server/we-mp-rss-config.md](docs/superpowers/specs/we-mp-rss-server/we-mp-rss-config.md)
- `we-mp-rss` API 规格：[docs/superpowers/specs/we-mp-rss-server/we-mp-rss-api-specs.md](docs/superpowers/specs/we-mp-rss-server/we-mp-rss-api-specs.md)

## 维护约定

- 新的需求、体验问题和后续改进项先进入 `docs/requirements-backlog.md`
- 新的计划文档继续放在 `docs/superpowers/plans/`
- 新的阶段性进展继续放在 `docs/superpowers/progress/`
- 设计审计、已过期讨论或历史材料继续放在 `docs/superpowers/archive/`
- 不再把临时进度列表直接写回 `README.md`
