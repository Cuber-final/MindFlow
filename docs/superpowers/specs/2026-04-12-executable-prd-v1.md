# MindFlow 研发可执行 PRD（V1 草案）

> 日期：2026-04-12  
> 版本：v1-draft  
> 目标：将交互审查结论转化为可直接交付研发执行的功能与交互规格

---

## 1. 文档边界与输入

### 1.1 输入来源

本 PRD 以以下文档为唯一输入：
- `docs/superpowers/specs/2026-04-12-interaction-audit-report.md`
- `docs/superpowers/specs/2026-04-12-interaction-evidence-matrix.md`
- `docs/superpowers/specs/2026-04-12-interaction-gap-log.md`
- `docs/superpowers/specs/2026-04-12-interaction-deep-dive-questions.md`

### 1.2 口径优先级

- 产品规则冲突：**PRD 口径优先于技术规格**。
- 交互执行时的规则来源：`matrix 行级判定 + gap-log 优先级`。

### 1.3 当前范围

执行范围：`Newsletter / InterestSettings / Sources / Settings` 四个页面，20 条主要交互。  
当前分层：`Green 11 / Yellow 4 / Red 5`。

---

## 2. 本草案采用的决策（来自深挖议题推荐项）

为保证“可执行”，本草案先采用 DDQ 推荐项作为默认决策：

1. `DDQ-01`：`/api/digests` 采用**轻量数组列表**（不使用分页 DTO）。
2. `DDQ-02`：Read Source 点击采用**非阻塞埋点**，失败不阻断跳转。
3. `DDQ-03`：点赞/点踩采用**点击即提交二元反馈**。
4. `DDQ-04`：DELETE 保持 `204`，前端封装统一支持空响应成功。
5. `DDQ-05`：设置页必须支持四态：加载中 / 加载失败 / 未配置 / 已配置。
6. `DDQ-06`：Test Connection 默认测试**当前表单草稿**。
7. `DDQ-07`：保存配置时，空 `api_key` 表示**保留已有密钥**。

---

## 3. 核心契约总则

### 3.1 列表契约

- `GET /api/digests?limit=<n>` 返回数组 `DailyDigest[]`。
- 前端禁止读取 `res.items`；统一按数组消费。

### 3.2 删除契约

- `DELETE` 接口可返回 `204 No Content`。
- 前端 `fetchApi` 必须把 `204` 视为成功，不再强制 `res.json()`。

### 3.3 行为反馈契约

- 显式反馈：`POST /api/behavior/feedback`。
- 隐式日志：`POST /api/behavior/logs`。
- 任何埋点失败不得阻断主阅读/主跳转路径。

### 3.4 配置契约

- `GET /api/config/ai` 不返回 `api_key` 明文。
- `PUT /api/config/ai` 支持“保留已存密钥”语义。
- 建议请求体支持 `keep_api_key: true` 或在 `api_key` 为空时后端默认保留。

---

## 4. 页面级可执行规格

## 4.1 Newsletter

### 4.1.1 历史日期切换
- 入口：日期下拉选择器（含“今天”）。
- 前置：页面加载成功。
- 请求：
  - 初始化：`GET /api/digests?limit=30`
  - 选择某天：`GET /api/digests/{date}`
  - 选择今天：`GET /api/digests/latest`
- 成功：更新当前简报内容与日期显示。
- 失败：显示“加载失败，可重试”状态，不可静默吞错。
- 验收：历史日期列表必须可见且可选；错误时有可见提示。

### 4.1.2 来源链接点击（Read Source）
- 入口：洞察卡片来源链接。
- 动作顺序：
  1) 触发 `POST /api/behavior/logs`（action=`click`，非阻塞）
  2) 立即跳转原文（新标签页）
- 失败策略：埋点失败仅记录，不打断跳转。
- 验收：跳转稳定 + 后端可观测到 click 日志（在成功路径）。

### 4.1.3 点赞 / 点踩
- 入口：Main Channel 点赞、点踩按钮。
- 请求：`POST /api/behavior/feedback`
- 必填字段：`digest_id`, `anchor_id`, `action(show|hide)`。
- 成功反馈：按钮状态变化 + 轻提示“已记录反馈”。
- 失败反馈：轻提示“反馈失败，请重试”；按钮回到可重试态。
- 去重：同一用户在同一简报同一锚点，后一次覆盖前一次。
- 验收：按钮不可再是“假可用”；必须实际触发后端。

---

## 4.2 InterestSettings

### 4.2.1 新增兴趣标签
- 入口：输入框回车 / Add Interest。
- 校验：空字符串禁止提交。
- 请求：`POST /api/interests/tags`。
- 成功后串行刷新：
  - `GET /api/interests/tags`
  - `GET /api/interests/tags/stats`
  - `GET /api/interests/candidates?top_n=5`
- 验收：新增后列表与统计均刷新。

### 4.2.2 冻结 / 激活
- 请求：`PATCH /api/interests/tags/{tag_id}`。
- 成功：同上三接口刷新。
- 验收：状态、权重、标签展示一致。

### 4.2.3 删除标签
- 请求：`DELETE /api/interests/tags/{tag_id}`（204）。
- 要求：前端封装支持 204 成功，不报解析错误。
- 成功：列表移除并刷新统计。
- 失败：显示可见错误提示（不能仅 console）。
- 验收：删除成功后 UI 与数据一致。

### 4.2.4 候选标签采纳
- 请求：`POST /api/interests/tags`。
- 技术规格要求：补齐候选响应 schema（`tag`,`count`,`avg_significance`）。
- 验收：候选采纳后进入正式标签列表，候选池同步刷新。

---

## 4.3 Sources

### 4.3.1 Quick Add（链接解析）
- 输入校验：非空 + 微信域名。
- 请求：`POST /api/sources/parse-url`。
- 成功：显示公众号预览，不直接入库。
- 失败：行内错误提示 + 支持重试。

### 4.3.2 Quick Add 确认添加
- 请求：`POST /api/sources`。
- 成功：关闭弹窗 + 列表刷新。
- 验收：两段式流程闭环（解析→确认→入库）。

### 4.3.3 单条抓取 Fetch Now
- 请求：`POST /api/sources/{id}/fetch`。
- 成功：显示单条结果 + 列表刷新。
- 验收：按钮 loading、结果提示、刷新三者完整。

### 4.3.4 批量抓取 Manual Crawl All
- 当前问题：逐条 forEach 调用，无总进度和汇总结果。
- 新规则：必须有批处理反馈模型，至少包含：
  - 总数、成功数、失败数
  - 失败来源列表
  - 处理完成提示
- 验收：操作者能判断整批是否完成与失败对象。

---

## 4.4 Settings（AI 配置）

### 4.4.1 页面状态机
必须实现并显式展示四态：
1. loading
2. load_error
3. unconfigured
4. configured

禁止加载失败后静默回填默认值冒充成功。

### 4.4.2 Test Connection
- 默认测试对象：**当前表单草稿**。
- 若需测试已保存配置，必须是单独次级动作（文案明确区分）。
- 成功/失败均给出明确提示。

### 4.4.3 Save Architecture
- 保存语义：空 `api_key` = 保留已存密钥。
- 清空密钥必须单独动作并二次确认。
- 成功后刷新配置展示状态，不回退到误导性的默认态。

---

## 5. 优先级与实施闸门

### 5.1 实施顺序
- P0：点赞/点踩反馈接线
- P1：日期契约、Read Source 埋点、删除 204 处理、Settings 三项
- P2：候选标签 schema、批量抓取反馈、分层命名对齐

### 5.2 闸门规则
- 未完成 P0 与关联 P1，不得进入“功能完成”声明。
- 每条实现必须回链 `gap-log ID`。

---

## 6. 验收清单（研发执行最小标准）

1. 20 条交互均有明确：入口、请求、成功反馈、失败反馈。  
2. 非 Green 项全部有修复规则与实现映射。  
3. `Read Source` 与 `点赞/点踩` 都能产生可验证的行为回流。  
4. Settings 页四态可复现，且 test/save 语义一致。  
5. 运行态点测结果在报告里可追踪，不再出现“静默成功”路径。

---

## 7. 下一步

本草案可作为“研发执行 PRD v1”起稿基线。  
进入实施前，建议你快速确认第 2 节的 7 条决策是否全部接受；若有变更，只需改该节和对应页面规则，不需要重做全量审查。
