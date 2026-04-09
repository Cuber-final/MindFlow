# AI News Aggregator V2 - 项目进度追踪

> 本文件追踪 AI News Digest V2 版本的开发进度

---

## 项目概览

| 项目 | 信息 |
|------|------|
| 项目名称 | AI News Aggregator (ai-crawler) V2 |
| 创建日期 | 2026-04-08 |
| V2 启动日期 | 2026-04-09 |
| 状态 | 🚧 开发中 |
| 当前阶段 | Phase C: 前端 Newsletter UI (进行中) |
| Python 虚拟环境 | backend/.venv |

---

## V2 里程碑进度

```
[██████████████████░░░░░░░░░░░░░░░░░░░░] 60% 完成
```

| Phase | 描述 | 状态 | 完成日期 |
|-------|------|------|----------|
| Phase A | 后端简报生成（锚点提取 + 简报合成） | ✅ 完成 | 2026-04-09 |
| Phase B | 后端兴趣学习（权重更新 + 行为日志） | ✅ 完成 | 2026-04-09 |
| Phase C | 前端 Newsletter UI | 🔄 进行中 | - |
| Phase D | 信息源扩展（知乎/RSS） | ⏳ 待开始 | - |
| Phase E | 端到端联调 | ⏳ 待开始 | - |
| Phase F | 文档和发布 | ⏳ 待开始 | - |

---

## 已完成功能

### Phase A: 简报生成后端 ✅

| 功能 | 文件 | 状态 |
|------|------|------|
| AnchorPoint 模型 | backend/models.py | ✅ |
| DailyDigest 模型 | backend/models.py | ✅ |
| anchor_points 表 | backend/database.py | ✅ |
| daily_digests 表 | backend/database.py | ✅ |
| 锚点提取 AI 调用 | backend/services/ai.py | ✅ |
| 简报合成 AI 调用 | backend/services/ai.py | ✅ |
| /api/digests 路由 | backend/routers/digests.py | ✅ |
| 定时生成简报 | backend/services/scheduler.py | ✅ |

### Phase B: 兴趣学习后端 ✅

| 功能 | 文件 | 状态 |
|------|------|------|
| UserInterestTag 模型 | backend/models.py | ✅ |
| BehaviorLog 模型 | backend/models.py | ✅ |
| user_interest_tags 表 | backend/database.py | ✅ |
| user_behavior_logs 表 | backend/database.py | ✅ |
| digest_feedback 表 | backend/database.py | ✅ |
| 权重更新算法 | backend/services/learning.py | ✅ |
| /api/interests 路由 | backend/routers/interests.py | ✅ |
| /api/behavior 路由 | backend/routers/behavior.py | ✅ |
| 内容分层策略 | backend/services/learning.py | ✅ |

### Phase C: 前端 Newsletter UI 🔄

| 功能 | 文件 | 状态 |
|------|------|------|
| Newsletter 页面 | frontend/src/pages/Newsletter.tsx | ✅ |
| 兴趣侧边栏 | frontend/src/pages/Newsletter.tsx | ✅ |
| ZoneBadge 组件 | frontend/src/pages/Newsletter.tsx | ✅ |
| InsightCard 组件 | frontend/src/pages/Newsletter.tsx | ✅ |
| tokens.css 设计系统 | frontend/src/styles/tokens.css | ✅ |
| 设计系统集成 | frontend/src/index.css | ✅ |
| useBehaviorCollector Hook | - | ⏳ 待实现 |
| InterestSettings 页面 | - | ⏳ 待实现 |
| 日期选择器 | - | ⏳ 待实现 |

---

## 下一步待办

### Phase C 剩余任务

- [ ] C.4: 实现 useBehaviorCollector Hook
- [ ] C.5: 新增 /settings/interests 页面
- [ ] C.6: 实现 InterestTagItem 组件（权重条+统计）
- [ ] C.7: 实现日期选择器（历史简报切换）

### Phase D 信息源扩展

- [ ] D.1: 实现 ZhihuCrawler（知乎文章爬虫）
- [ ] D.2: 实现 RSSCrawler（RSS订阅爬虫）
- [ ] D.3: 扩展 NewsSource 模型（新增 source_type）
- [ ] D.4: 前端新增源类型选择

---

## 资源链接

- 后端服务: http://localhost:8000
- API 文档: http://localhost:8000/docs
- 前端服务: http://localhost:5173
- Newsletter 页面: http://localhost:5173/newsletter
- 数据库文件: `./data/ai_crawler.db`
- V2 设计文档: `./docs/superpowers/specs/ai-news-digest-v2-plan.md`
- V2 技术规格: `./docs/superpowers/specs/2026-04-09-ai-news-digest-v2-technical-spec.md`

---

*最后更新: 2026-04-09*
