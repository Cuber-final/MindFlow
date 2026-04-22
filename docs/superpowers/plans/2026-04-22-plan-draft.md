# Ranked Synthesis

| Rank | 接下来应推进的工作 | Confidence | Basis |
|------|------------------|------------|-------|
| 1 | 先修通并验证“定时抓取 -> 锚点提取 -> Digest 生成”后台任务链路 | High | PRD 明确要求调度、任务可追踪、结果可查看；当前调度层存在但实现还不稳，PRD 与 `backend/services/scheduler.py` |
| 2 | 补齐搜索/筛选、导出、任务/日志页、刷新频率设置这几个 MVP 缺口 | High | 这些都在 PRD 范围内，但当前前后端页面和路由都还没闭环，PRD，PRD，PRD，`frontend/src/App.tsx` |
| 3 | 扩充 Source / Entry / Job 数据模型与状态字段，支撑真正的平台化管理 | High | 最近提交把输入层统一到 feed 边界，但数据模型还没长到 PRD 需要的状态和治理能力，`backend/models.py`，PRD，PRD |
| 4 | 决定是否补一个“统一时间线/搜索结果”阅读面，而不只保留 Daily Digest + Now | Medium | 近一天提交明显在强化 Digest -> Now，但 PRD 仍要求首页时间线、文章详情、搜索结果页，`frontend/src/App.tsx`，PRD，PRD |
| 5 | 在核心链路稳定后，再补文章级 AI 加工：关键词、语言识别、可选翻译 | Medium | 现在已有摘要和锚点提取，但 PRD 要求比“总结”更完整的 Processing 层，`backend/services/ai.py`，PRD |

---

# Evidence

- PRD 的 MVP 目标不只是接入和阅读，还明确包含搜索、导出、任务日志、刷新频率、状态追踪
- 调度器已经定义了 `daily_fetch` 和 `daily_digest`，但同一个文件里对 `get_articles`、`get_anchors_by_article`、`create_anchor`、`get_digest_by_date`、`get_all_anchors_for_digest`、`create_digest` 都是直接调用，没有 `await`，`backend/services/scheduler.py`；这些数据库函数本身是 async，`backend/database.py`，`backend/database.py`，`backend/database.py`，`backend/database.py`。
- Source 目前只有 `name/source_type/api_base_url/auth_key/config/last_fetch_at/article_count`，没有 PRD 提到的 `enabled/category/tags/refresh_interval/last_error`，`backend/models.py`。
- 文章接口目前只有列表、详情、单篇 summarize，列表过滤也只有 `source_id/limit/offset`，没有全文检索、时间过滤、标签过滤，`backend/routers/articles.py`，`backend/database.py`。
- 前端路由只有 `/daily-digest`、`/now`、`/interests`、`/sources`、`/settings`，`frontend/src/App.tsx`。
- 顶部虽然有搜索框，但只是未接线输入框，`frontend/src/components/TopNav.tsx`。
- 设置页当前只做 AI 配置，`frontend/src/pages/Settings.tsx`；后端虽然有 schedule API，`backend/routers/config.py`，前端 API 也暴露了它，`frontend/src/api/newsletter.ts`，但 UI 没接出来。
- Source 管理页已经能增删改、单抓、批抓，说明“输入层收口”这条线基本完成，`frontend/src/pages/Sources.tsx`，`frontend/src/pages/Sources.tsx`，`frontend/src/pages/Sources.tsx`。

---

# Inference

最合理的下一阶段，不是继续做 UI 壳层，而是把 PRD 里“平台化 MVP”最缺的几块补齐：**任务可靠性、可观测性、检索、导出、状态模型**。
后面更该做的是围绕统一输入建立稳定的调度、状态和检索输出层。
“统一时间线”要不要做成单独页面，属于中等置信度项。