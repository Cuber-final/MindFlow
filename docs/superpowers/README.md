# Superpowers Docs Index

这个目录保留的是产品演进、执行计划、进度记录和历史设计材料。

结论先写明：

- 不建议把所有历史文档改写成一个“大 timeline 正文”
- 建议保留 `plans / progress / archive` 分层
- 额外维护这一份薄索引，作为时间线入口和查找导航

原因很直接：

- 单一 timeline 适合浏览，不适合承载原始计划、PRD、审计证据和执行细节
- 原始文档按类型分层，检索更稳定，也更方便继续增量追加
- 维护一份轻量索引，比持续重写历史正文更省 token，也更不容易失真

## 目录角色

- `plans/`
  - 仍在影响开发决策的计划、PRD、设计摘要和实施方案
- `progress/`
  - 已执行任务的进度、验证和闭环记录
- `archive/`
  - 已过时、已沉淀或主要用于回溯的历史材料
- `specs/`
  - 专题规格文档；当前主要保留 `we-mp-rss` 服务相关材料

## Timeline

| 日期 | 阶段 | 主要产物 |
| --- | --- | --- |
| 2026-04-09 | 早期架构与部署探索 | [技术架构](./archive/2026-04-09-ai-news-digest-v2-technical-spec.md), [Docker 部署方案](./archive/2026-04-09-docker-deployment.md), [UI 设计规范](./archive/2026-04-09-ui-design-guidelines.md) |
| 2026-04-10 | 数据层与产品需求收束 | [PostgreSQL 迁移计划](./archive/2026-04-10-postgres-migration.md), [产品需求文档](./archive/2026-04-10-product-requirements.md) |
| 2026-04-12 | 交互审计与 MVP 执行准备 | [研发可执行 PRD](./archive/2026-04-12-executable-prd-v1.md), [交互审查设计文档](./archive/2026-04-12-interaction-audit-for-executable-prd-design.md), [交互审查报告](./archive/2026-04-12-interaction-audit-report.md), [Gap Log](./archive/2026-04-12-interaction-gap-log.md), [MVP 待办](./archive/2026-04-12-mvp-dev-todo-v1.md) |
| 2026-04-20 | 双核心产品方向成型 | [下一阶段产品设计摘要](./plans/2026-04-20-mindflow-next-phase-product-design.md), [Daily Digest + Now 实现计划](./plans/2026-04-20-daily-digest-now-workbench.md) |
| 2026-04-21 | 产品版本化与 UI 双语化 | [新版本 PRD](./plans/2026-04-21-mindflow-new-version-prd.md), [双语 rollout 计划](./plans/2026-04-21-ui-i18n-bilingual-rollout.md), [双语 rollout 进度](./progress/2026-04-21-ui-i18n-bilingual-rollout-progress.md), [工作台进度记录](./progress/2026-04-21-daily-digest-now-workbench-progress.md) |
| 2026-04-22 | RSS 服务集成与微信公众号源闭环 | [RSS 服务端集成说明](./plans/2026-04-22-rss-server-integration-dev-spec.md), [Sources 鉴权 UI 计划](./plans/2026-04-22-sources-we-mprss-auth-ui.md), [We-MP-RSS 闭环计划](./plans/2026-04-22-we-mp-rss-digest-closure-plan.md), [进度记录](./progress/2026-04-22-we-mp-rss-digest-closure-progress.md), [设计稿归档](./archive/2026-04-22-sources-we-mprss-auth-ui-design.md) |

## 维护规则

- 新文档优先按类型归档，不要先塞进 timeline
- timeline 只做入口和摘要，不重复拷贝正文
- 仍在指导开发的文档放 `plans/`
- 已完成任务的验证记录放 `progress/`
- 不再直接驱动开发的材料移入 `archive/`

## 推荐的后续小清理

- 把 `docs/superpowers/` 下的 `.DS_Store` 从版本库中清掉
- 后续新增文档时统一标题风格与日期前缀
- 如果某个 `plan` 已完全结束，可以在文首补一行指向对应 `progress`，减少来回跳转
