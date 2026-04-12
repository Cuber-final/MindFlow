# MindFlow MVP 研发 Agent 可执行清单 V1

> 日期：2026-04-12  
> 用途：把 `2026-04-12-mvp-dev-todo-v1.md` 转成研发 agent 可直接执行的任务单  
> 上位约束：`docs/superpowers/specs/2026-04-12-mvp-dev-todo-v1.md`

---

## 1. 使用说明

本清单不是新的 PRD，而是 **implementation handoff sheet**。  
研发 agent 执行时必须遵守：

- 只实现本文定义的范围；
- 不自行扩展到 Exploration Zone / Surprise Box 反馈；
- 不新增“点赞 / 点踩双按钮”；
- 不新增“强抑制 / 硬屏蔽 / 权重解释 UI”；
- 先修稳定性，再修主链路，再补体验收口。

---

## 2. 推荐执行方式

### 2.1 串行主干

必须按下面顺序推进：

1. `A` 后端稳定性
2. `B` Settings 契约与状态机
3. `C` Digests 周维度列表契约
4. `D` Newsletter 主航道负反馈
5. `E` Read Source 弱隐式信号
6. `F` Shared API / 204 兼容与回归测试

### 2.2 可并行原则

允许并行的只有：

- `A1 / A2 / A3` 三个后端稳定性修复
- `B` 与 `C` 可在接口边界先对齐后并行开发
- `D` 与 `E` 可共享 Newsletter 页面改动，但必须由同一实现 owner 负责集成，避免互相覆盖

---

## 3. 任务总览

| 任务 ID | 名称 | 类型 | 依赖 | 主写入范围 |
|---|---|---|---|---|
| `A1` | 修复 AI summarize 异步读取 | Backend bugfix | 无 | `backend/services/ai.py`, `backend/tests/test_digests.py`, `backend/tests/test_full_flow.py` |
| `A2` | 修复 crawler 抓取异步对象误用 | Backend bugfix | 无 | `backend/services/crawler.py`, `backend/tests/test_full_flow.py` |
| `A3` | 修复 sources 时间序列化 | Backend bugfix | 无 | `backend/routers/sources.py`, `backend/tests/test_sources.py` |
| `B1` | 重构 AI config schema 与 test/save 契约 | Full-stack contract | `A*` 可并行 | `backend/schemas.py`, `backend/routers/config.py`, `backend/services/ai.py`, `frontend/src/api/newsletter.ts`, `frontend/src/pages/Settings.tsx`, `backend/tests/test_config.py` |
| `B2` | 实现 Settings 四态状态机 | Frontend UX/state | `B1` | `frontend/src/pages/Settings.tsx` |
| `C1` | 重做 digests 列表 DTO 为按周查询 | Full-stack contract | `A*` 可并行 | `backend/schemas.py`, `backend/routers/digests.py`, `frontend/src/api/newsletter.ts`, `backend/tests/test_digests.py` |
| `C2` | 实现 Newsletter 周切换日期面板 | Frontend UX | `C1` | `frontend/src/pages/Newsletter.tsx` |
| `D1` | Main Channel 单一负反馈接线 | Frontend + API wiring | `C2` | `frontend/src/pages/Newsletter.tsx`, `frontend/src/api/newsletter.ts`, 可选 `frontend/src/hooks/useBehaviorCollector.ts` |
| `E1` | Read Source 非阻塞 click 埋点 | Frontend + API wiring | `D1` 同 owner 集成 | `frontend/src/pages/Newsletter.tsx`, `frontend/src/hooks/useBehaviorCollector.ts` 或直接调用 `behaviorApi.recordLog` |
| `F1` | `fetchApi` 支持 204 No Content | Frontend shared fix | 无 | `frontend/src/api/newsletter.ts` |
| `F2` | 回归测试与验证脚本收口 | Verification | `A1~F1` | `backend/tests/*`, 前端人工验证步骤文档 |

---

## 4. 详细任务单

## `A1` 修复 AI summarize 异步读取

### 目标
消除 `services/ai.py` 中把 `get_ai_config()` 当同步返回值使用的问题。

### 当前证据

- `backend/services/ai.py`
- 失败路径：`backend/tests/test_digests.py`
- 失败路径：`backend/tests/test_full_flow.py`

### 实现要求

- 统一确认 `get_ai_config()` 的真实 async/sync 语义；
- `summarize_text()`、`extract_anchor()`、`synthesize_digest()`、`get_openai_client()` 内部的读取方式保持一致；
- 不允许再出现 coroutine 下标访问；
- 不允许通过“吞异常返回成功”来掩盖问题。

### 完成定义

- `test_summarize_text_with_mocked_ai`
- `test_summarize_text_without_config`
- full flow 中 AI mock 相关用例

都能按预期通过或明确稳定失败原因被消除。

---

## `A2` 修复 crawler 抓取异步对象误用

### 目标
修复抓取流程中把 source / article coroutine 当普通对象读取的问题。

### 当前证据

- `backend/services/crawler.py`
- 失败路径：`backend/tests/test_full_flow.py::test_fetch_source_articles_mock`

### 实现要求

- 核对 `get_source_by_id`、`get_article_by_external_id`、`create_article`、`update_source_fetch_time` 等调用的 async/sync 语义；
- 不允许在 `fetch_source_articles()` 里直接对 coroutine 做 `source["id"]` 之类访问；
- 保持当前抓取行为不扩 scope，不改业务逻辑，只修稳定性。

### 完成定义

- fetch 流程 mock 测试恢复；
- 单源抓取接口 `POST /api/sources/{id}/fetch` 不再因 coroutine 误用直接报错。

---

## `A3` 修复 sources 时间序列化

### 目标
使 `sources` 相关接口能同时兼容 `datetime` 和字符串时间值。

### 当前证据

- `backend/routers/sources.py::_format_datetime`
- 失败路径：`backend/tests/test_sources.py`

### 实现要求

- `_format_datetime()` 兼容：
  - `None`
  - `datetime`
  - 已经是字符串的时间值
- 不要强制对字符串执行 `.isoformat()`
- 保持 `config` 的 JSON 解析逻辑不变。

### 完成定义

- `test_list_sources_with_data`
- `test_get_source_by_id`
- `test_create_source`
- `test_update_source`

通过。

---

## `B1` 重构 AI config schema 与 test/save 契约

### 目标
把 Settings 页的草稿测试、保存前验证、`api_key` 保留语义固化到前后端契约。

### 写入范围

- Backend:
  - `backend/schemas.py`
  - `backend/routers/config.py`
  - 如需：`backend/services/ai.py`
- Frontend:
  - `frontend/src/api/newsletter.ts`
  - `frontend/src/pages/Settings.tsx`
- Tests:
  - `backend/tests/test_config.py`

### 需要落地的契约

#### `GET /api/config/ai`
- 继续**不返回明文 `api_key`**
- 返回是否已配置的状态信号，建议新增：
  - `has_api_key: boolean`
  - 或等价字段

#### `POST /api/config/ai/test`
- 改为支持接收**当前草稿**
- 请求体至少包含：
  - `provider`
  - `api_key`
  - `base_url`
  - `model`
  - 可选 `use_stored_api_key` 或等价语义字段

#### `PUT /api/config/ai`
- 保存前必须按相同草稿语义验证
- 已配置情况下：
  - 输入空 `api_key` = 保留旧 key
- 首次配置情况下：
  - `api_key` 不能为空

### 前端行为要求

- `handleTest` 使用当前 `formData`
- `handleSave` 不能直接保存，必须：
  1. 先验证当前草稿
  2. 验证通过才调用保存
  3. 失败则不写库

### 完成定义

- 仅测试旧配置的错误行为被移除；
- 空 `api_key` 不会误覆盖旧 key；
- 首次配置若空 key，测试和保存都应给出可见错误。

---

## `B2` 实现 Settings 四态状态机

### 目标
消除当前 Settings 页“加载失败时继续显示默认表单冒充成功”的问题。

### 状态定义

- `loading`
- `load_error`
- `unconfigured`
- `configured`

### UI 要求

#### loading
- 显示明确 loading skeleton / spinner

#### load_error
- 显示错误说明：
  - “加载失败，可重试或重新配置”
- 提供两个动作：
  - `Retry`
  - `重新手动配置`

#### unconfigured
- 顶部提示块说明“尚未完成 AI 配置”
- 直接展示可编辑表单
- 不增加单独“开始配置”按钮页

#### configured
- 展示当前 provider / base_url / model
- `api_key` 输入框为空，placeholder 表示已配置可留空保留

### 完成定义

- `Settings.tsx` 不再只靠 `loading:boolean + aiConfig:null` 混合判断；
- 页面任一失败路径都有可见反馈，不再只 `console.error`。

---

## `C1` 重做 digests 列表 DTO 为按周查询

### 目标
将 `GET /api/digests` 从当前“简单 limit/offset 列表”升级为支持周范围查询与 lazy load 的列表契约。

### 写入范围

- `backend/schemas.py`
- `backend/routers/digests.py`
- 如需：`backend/database.py`
- `frontend/src/api/newsletter.ts`
- `backend/tests/test_digests.py`

### 必须落实的契约变化

#### 请求
建议支持：
- `week_start`
- `week_end`
- `limit`
- `offset`

或同等表达“按周范围 + 分页”的参数。

#### 响应
必须是 DTO，不再是裸数组。建议至少包含：
- `items`
- `total`
- `limit`
- `offset`
- 可选：
  - `has_more`
  - `next_offset`
  - `week_start`
  - `week_end`

### 规则约束

- 当前默认视图只取“当前所在周”
- 历史周按用户交互再 lazy load
- 现有前端 `res.items` 读取方式要和后端保持一致

### 完成定义

- 历史日期列表不会再因数组/DTO 不一致而丢失；
- 周视图实现有稳定后端支撑。

---

## `C2` 实现 Newsletter 周切换日期面板

### 目标
替换当前简单日期 dropdown，改为周面板浏览器。

### 写入范围

- `frontend/src/pages/Newsletter.tsx`

### UI / 交互要求

- 顶部日期入口仍保留 popover 交互
- popover 内容改为：
  - 当前周范围标题
  - 上一周 / 下一周切换
  - 本周 7 天日期项
- 日期项规则：
  - 有简报：可点
  - 无简报：灰色不可点
- 若今天无简报：
  - 页面主区显示“今日暂无简报”
  - 提供跳转到最近一份简报的链接

### 明确不做

- 不做完整月历
- 不做跨月自由选日历面板

### 完成定义

- 默认按周加载；
- 翻周能触发新一周查询；
- 无简报日期不可点击；
- 今日无简报状态透明可见。

---

## `D1` Main Channel 单一负反馈接线

### 目标
把当前假可用的 thumbs UI 改成真实可用的“减少这类话题内容”能力。

### 写入范围

- `frontend/src/pages/Newsletter.tsx`
- `frontend/src/api/newsletter.ts`
- 需要时复用：`frontend/src/hooks/useBehaviorCollector.ts`
- 如 payload / action 需补充约束，可同步更新后端测试或行为相关文档

### 实现要求

#### UI
- 移除双按钮语义
- 替换为单一负反馈动作：
  - 文案或 tooltip 含义必须是“减少这类话题内容”

#### 交互
- 点击后：
  - 卡片淡出
  - 当前列表重排补位
  - 底部 snackbar/toast 出现
  - snackbar 含 `Undo`

#### 撤销
- Undo 仅恢复当前前端会话中的卡片展示
- 不要求补请求新卡片

#### 数据
- 使用 `behaviorApi.recordFeedback`
- payload 至少包含：
  - `digest_id`
  - `anchor_id`
  - `action = hide`（若沿用现有枚举）

### 明确不做

- 不在 Exploration Zone / Surprise Box 加同类按钮
- 不展示“已降低标签 X 权重”之类说明
- 不引入连续负反馈后的强抑制模式

### 完成定义

- Main Channel 按钮不是假可用；
- 点击、补位、Undo、失败回滚路径都存在；
- 行为被真实记录。

---

## `E1` Read Source 非阻塞 click 埋点

### 目标
让 `Read Source` 成为弱隐式兴趣信号，但不影响主阅读路径。

### 写入范围

- `frontend/src/pages/Newsletter.tsx`
- 可选复用：`frontend/src/hooks/useBehaviorCollector.ts`

### 实现要求

- 用户点击 `Read Source` 时：
  1. 先触发 click 上报
  2. 立即允许打开原文
- 若上报失败：
  - 只记录 warning / console
  - 绝不阻断跳转

### 数据要求

- 使用 `behaviorApi.recordLog`
- 信号类型：`implicit`
- 行为：`click`
- 值：建议 `1`
- tag 字段若需要，优先取该 insight 的主标签或首标签；若多标签策略待定，至少在本轮保持一致实现，不要一处传首标签、一处传全部标签拼接。

### 完成定义

- 原文跳转稳定；
- 成功路径可观测到 click 日志；
- 失败路径用户无感。

---

## `F1` `fetchApi` 支持 204 No Content

### 目标
修复前端共享请求层对空响应体的错误解析。

### 写入范围

- `frontend/src/api/newsletter.ts`

### 实现要求

- `fetchApi<T>()` 在以下场景不能强制 `res.json()`：
  - `204`
  - 空响应体
- 不能破坏现有 JSON 响应错误处理逻辑
- 调整后需验证 `interestsApi.deleteTag()` 相关页面逻辑正常

### 完成定义

- 删除兴趣标签后不会因空响应体报错；
- 删除成功后的刷新链路正常执行。

---

## `F2` 回归测试与验证收口

### 目标
在实现完成后给出最小可置信验证证据。

### 必跑后端测试

建议至少跑：

- `backend/tests/test_digests.py`
- `backend/tests/test_sources.py`
- `backend/tests/test_config.py`
- `backend/tests/test_full_flow.py`

### 必做前端人工验证

#### Settings
- 首次配置空 key：测试失败 / 保存失败
- 已配置后留空 key：保存不覆盖旧 key
- 输入新 key：必须先验证成功再保存
- 加载失败：页面显示 retry / reconfigure

#### Newsletter
- 周面板默认加载当前周
- 无简报日期灰显不可点
- 今日无简报时显示链接跳转最近日报
- Main Channel 负反馈：淡出、补位、Undo
- Read Source：可跳转，且 click 埋点不阻断

#### InterestSettings
- 删除标签不再因 204 报错

### 输出要求

- 在最终实现说明中列出：
  - 实际修改文件
  - 已跑测试
  - 未覆盖风险

---

## 5. Agent 执行注意事项

### 5.1 不允许的自行决策

- 不允许把负反馈扩展到 Exploration Zone
- 不允许重新引入点赞/点踩双按钮
- 不允许在 MVP 内加入标签权重解释文案
- 不允许擅自实现强抑制/硬屏蔽逻辑
- 不允许把“今日无简报”改成静默自动跳转

### 5.2 可以自行决策的细节

- snackbar 持续时间
- 淡出动画时长
- 周面板的具体布局（横排 / 两行）
- DTO 字段命名，只要语义清晰且前后端统一

---

## 6. 推荐交付物

实现完成后，研发 agent 的最终交付至少应包含：

1. 代码改动
2. 测试结果
3. 与本文各任务 ID 的回链关系
4. 剩余风险说明

---

## 7. 与上位文档关系

- 上位 scope 文档：`docs/superpowers/specs/2026-04-12-mvp-dev-todo-v1.md`
- 本文档作用：把上位 scope 转成 execution-ready task sheet
- 若两者发生冲突：
  - **以本任务单的执行细化为准**
  - 若涉及产品范围变化，则必须回到上位文档重新确认
