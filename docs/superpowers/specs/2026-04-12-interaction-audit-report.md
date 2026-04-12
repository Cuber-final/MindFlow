# 交互审查报告（研发可执行 PRD 前置）

## 1. 审查结论摘要

### 1.1 运行态点测结果

- 覆盖范围：
  - 按 `README.md` 的后端测试说明使用 `backend/.venv` 运行点测，执行了 `tests/test_digests.py`、`tests/test_sources.py tests/test_config.py`、`tests/test_full_flow.py` 三组高风险路径校验。
  - `tests/test_digests.py` 覆盖 digest 查询接口与 AI 摘要 mock 合约（4 项）。
  - `tests/test_sources.py tests/test_config.py` 覆盖 source CRUD / 响应序列化、AI config 读写 / test connection / schedule（合计 15 项）；其中 `tests/test_config.py` 已额外单独复跑确认。
  - `tests/test_full_flow.py` 覆盖 source parse/fetch、AI 摘要、interest feedback、API error smoke（10 项）。
- 通过项：
  - `backend/.venv/bin/python -m pytest tests/test_digests.py -q`：4 项中 2 项通过，`GET /api/digests/latest` 与 `GET /api/digests/by-date/{date}` 的查询类测试当前可通过。
  - `backend/.venv/bin/python -m pytest tests/test_config.py -q`：8/8 通过，AI 配置读取 / 保存 / 测试连接与调度接口在当前 mock 测试下可通过。
  - `backend/.venv/bin/python -m pytest tests/test_sources.py tests/test_config.py -q`：sources+config 合计 15 项中 11 项通过；其中 source 侧空列表、404、删除路径通过。
  - `backend/.venv/bin/python -m pytest tests/test_full_flow.py -q`：10 项中 2 项通过，微信 URL parse 正常 / 非法输入两项 smoke 通过。
- 失败项：
  - `tests/test_digests.py::TestAISummarize::test_summarize_text_with_mocked_ai` 与 `tests/test_digests.py::TestAISummarize::test_summarize_text_without_config` 失败：`services/ai.py:98` 将 `get_ai_config()` 返回值按同步 dict 读取，当前测试下得到 coroutine，触发 `TypeError: 'coroutine' object is not subscriptable`；同轮输出还出现 `AsyncMockMixin._execute_mock_call was never awaited` 警告。
  - `tests/test_sources.py` 中 `test_list_sources_with_data`、`test_get_source_by_id`、`test_create_source`、`test_update_source` 失败：`routers/sources.py:32` 的 `_format_datetime()` 对字符串时间直接调用 `.isoformat()`，在 mocked source dict 返回 `"2026-04-08 10:00:00"` 时触发 `AttributeError`，影响 source 读写回包序列化。
  - `tests/test_full_flow.py::TestArticleFetching::test_fetch_source_articles_mock` 失败：`services/crawler.py:357` 对 coroutine `source` 直接执行下标访问，触发 `TypeError: 'coroutine' object is not subscriptable`，说明 fetch 流程的 service/mock 合约当前不稳定。
  - `tests/test_full_flow.py::TestDigestFlowWithMocks::*` 两项失败，复现与 `tests/test_digests.py` 相同的 AI 配置异步读取问题。
  - `tests/test_full_flow.py` 中 interest / API error 相关 5 项在连接 PostgreSQL（`asyncpg` -> `localhost:5432`）时触发 `PermissionError: [Errno 1] Operation not permitted`；这是当前沙箱运行环境限制下的硬错误，本轮只能记录为“未完成运行态确认”，不能据此推断业务逻辑本身通过或失败。
- 对判定级别的影响：
  - 本轮点测未直接改写现有 `interaction-gap-log.md` 中已登记交互项的 P0/P1/P2 级别，因此未调整 gap log 行级 severity。
  - 运行态证据降低了对 backend 稳定性的置信度：AI 摘要路径、source 返回序列化与 source fetch mock 流程均存在可复现失败，后续若这些路径进入最终交互结论，需要作为独立 backend 缺口继续追踪，不能把本轮点测视为风险缓释证据。

## 2. 审查范围与基准

- 基准文档：
  - `docs/superpowers/specs/2026-04-10-product-requirements.md`
  - `docs/superpowers/specs/2026-04-09-ai-news-digest-v2-technical-spec.md`
- 事实来源：
  - `docs/superpowers/specs/2026-04-12-interaction-evidence-matrix.md`
  - `docs/superpowers/specs/2026-04-12-interaction-gap-log.md`
  - 本报告 `1.1 运行态点测结果`
- 覆盖范围：`Newsletter`、`InterestSettings`、`Sources`、`Settings` 四个页面共 20 条主要交互。
- 最终分层：Green 11 条、Yellow 4 条、Red 5 条；后续 PRD 编写应以该分层与 gap-log 优先级为唯一口径。

## 3. 合理交互逻辑清单（Green）

| 交互 | 可复用原因 | 复用边界 |
|---|---|---|
| `Newsletter / 兴趣标签侧栏` | 已完成“加载标签 → 选择标签 → 前端内存过滤 → 结果同步反馈”的闭环，当前简报内筛选无额外后端依赖。 | 仅适用于数据已在当前页面内存中、无需服务端二次查询的轻量筛选。 |
| `InterestSettings / Add Interest 输入框 + Add Interest 按钮` | 具备空值拦截、创建成功后清空输入框、并串联刷新 tags/stats/candidates 的完整新增路径。 | 适用于“单字段创建 + 成功后刷新相关面板”的表单型交互。 |
| `InterestSettings / 兴趣卡片 Freeze 操作` | 状态更新接口、列表刷新与权重展示回流一致，用户可直接看到冻结结果。 | 适用于单标签状态切换，前提是后端返回更新后的实体。 |
| `InterestSettings / 冻结兴趣 Thaw / Activate 操作` | 与 Freeze 共享同一闭环：点击即更新状态并刷新整页数据。 | 适用于成对状态切换；文案可调整，但成功后的状态回流模式可复用。 |
| `Sources / 页脚 Quick Add 输入框 + 添加按钮` | 在真正创建 source 前先完成非空校验、域名校验与 URL 解析，降低脏数据进入系统的概率。 | 适用于“先解析/校验、后确认入库”的 URL 驱动接入入口。 |
| `Sources / Quick Add 弹窗 / 解析` | 允许在弹窗内重复解析并即时看到公众号资料，失败和重试语义清晰。 | 适用于需要 preview 的异步解析步骤，不适合一次提交即落库的极简表单。 |
| `Sources / Quick Add 弹窗 / 确认添加` | 解析结果可直接映射为 source 并在成功后关闭弹窗、刷新列表，形成完成度高的“确认入库”路径。 | 适用于“预览结果确认后创建实体”的两段式流程。 |
| `Sources / SourceModal / 新增来源保存` | 页头入口与空状态入口共用同一保存链路，新增成功后的列表回流一致。 | 适用于多入口共用同一创建表单的资源管理页。 |
| `Sources / Source 行内 Edit Source` | 编辑动作与保存回流清晰，更新后可立即在列表看到结果。 | 适用于列表项编辑场景；前提是保存接口返回最新实体。 |
| `Sources / Source 行内 Delete Source` | 删除前确认、删除后本地列表即时移除，操作者反馈直接。 | 适用于可安全本地移除的资源列表；若删除存在级联影响，需追加二次提示。 |
| `Sources / Source 行内 Fetch Now` | 按钮 loading、抓取结果消息与列表刷新构成单条抓取闭环，主任务可完成。 | 适用于单资源即时执行类操作；若升级为批处理，不应直接复用其反馈方式。 |

## 4. 不合理交互逻辑清单（Red/Yellow）

- 判定直接继承自 `interaction-evidence-matrix.md` 的行级判定（Red/Yellow），以保证本报告脱离矩阵后仍可独立追溯。
- 若同一行同时关联多个 gap-log ID，则该行优先级取**关联 gap 中的最高优先级**（P0 高于 P1，高于 P2）；当前表内优先级均按此规则填写，并与矩阵保持一致。

| 交互 | 判定 | 当前行为 | 需求偏差 | 工程 / UX 风险 | 可执行修正规则 | 优先级 |
|---|---|---|---|---|---|---|
| `Newsletter / 日期选择器 / 今天`（`IA-BE-001`） | Red | 页面挂载时请求最近 30 天简报，但前端按 `res.items` 读取，后端实际返回裸数组；异常被吞掉后，历史日期候选可能为空。 | PRD 要求用户可切换今天 / 历史日期阅读简报；当前历史日期入口可能无法稳定出现。 | 用户以为“没有历史简报”；日期切换主路径断裂，且错误被静默吞掉。 | 在 PRD/TECH 中固定一个 digest 列表契约，并让前后端只保留一种实现：推荐按“轻量数组列表”消费，禁止再出现数组 / DTO 双口径。 | P1 |
| `Newsletter / Main Channel 来源链接`（`IA-BE-006`, `IA-SPEC-005`） | Yellow | 点击 `Read Source` 只会跳外链，不记录任何 click 行为日志。 | PRD 将内容分层与学习闭环绑定，原文阅读应能回流为隐式行为信号。 | 阅读路径可用但学习系统缺少 click 反馈，长期会削弱标签权重与推荐纠偏。 | `Read Source` 必须在跳转前触发非阻塞 click 埋点；上报失败不得阻断跳转，但 PRD 必须写明必填上下文字段。 | P1 |
| `Newsletter / Main Channel 点赞 / 点踩按钮`（`IA-BE-005`, `IA-SPEC-005`） | Red | 点赞 / 点踩按钮仅渲染 UI，没有 `onClick`，不会调用任何反馈接口。 | PRD 要求显式反馈进入兴趣学习闭环；当前属于“界面承诺存在、实际能力缺失”。 | 用户被误导为“已反馈”；核心 digest → feedback → learning 闭环缺失。 | PRD 必须定义按钮到 `POST /api/behavior/feedback` 的 payload 映射、成功/失败反馈与去重规则；若未接线完成，不得展示为可点击主操作。 | P0 |
| `InterestSettings / 兴趣卡片 Delete 操作`（`IA-BE-002`） | Red | 前端确认后调用删除，但 `fetchApi` 会在 `204 No Content` 上继续 `res.json()`，成功删除后仍可能抛错并中断刷新。 | 删除后应明确反映“已删除”，当前界面可能停留旧数据。 | 用户无法确认删除是否生效；列表与实际数据状态可能分叉。 | 删除成功语义必须全局统一：推荐保留 `204`，由前端 fetch 封装把空响应视为成功，并保证删除后刷新 / 本地移除总能执行。 | P1 |
| `InterestSettings / Emergent Patterns / Adopt`（`IA-BE-003`, `IA-SPEC-001`） | Yellow | 候选标签可被采纳，但候选接口未由后端 schema 锁定字段。 | PRD 要求“推荐新标签候选 + 一键采纳”，当前缺少稳定契约定义。 | 字段漂移不会被 FastAPI 校验，采纳入口易在无显式报错的情况下悄然退化。 | PRD/TECH 必须补齐候选标签响应模型，至少锁定 `tag / count / avg_significance` 等当前 UI 依赖字段。 | P2 |
| `Sources / 页头 Manual Crawl All`（`IA-SPEC-002`） | Yellow | 批量抓取只是前端 `forEach` 逐条调用单条抓取接口，没有总进度、总结果或批处理反馈。 | PRD 要求可手动触发抓取并查看来源状态；当前只能看到碎片化单条反馈。 | 操作者难以判断整批是否完成、失败了哪些来源、是否需要重试。 | PRD 必须定义批量抓取反馈语义：至少包含执行中状态、完成计数、失败清单或汇总结果展示，不得仅复用单条 `alert`。 | P2 |
| `Settings / Settings 页面加载`（`IA-SPEC-004`） | Yellow | 页面加载失败只写 `console.error`，界面继续展示默认表单值，`api_key` 也固定为空。 | PRD 明确要求 AI 未配置 / 加载中 / 失败态都有下一步提示；当前默认值会伪装成“已加载配置”。 | 用户可能把默认值误认为当前配置；后续测试 / 保存决策基于错误前提。 | PRD 必须把设置页分成加载中、已加载、未配置、加载失败四类状态；失败态要有可见提示与 retry/新建配置入口，禁止静默回退默认值。 | P1 |
| `Settings / Test Connection 按钮`（`IA-BE-007`, `IA-SPEC-003`） | Red | 点击测试连接时，后端验证的是已保存配置，而不是用户当前正在编辑的表单。 | PRD 期望用户能验证“即将保存的配置”是否有效；当前测试对象与用户心智对象不一致。 | 用户可能得到“测试成功”却保存失败，或反之，形成错误决策。 | `Test Connection` 默认必须验证当前表单草稿；若仍保留“测试已保存配置”，需改成单独命名的次级诊断动作。 | P1 |
| `Settings / Save Architecture 按钮`（`IA-BE-007`, `IA-SPEC-003`） | Red | 保存时会把空 `api_key` 一并提交，存在覆盖后端已存密钥的风险。 | PRD 要求用户可查看 / 修改配置，但不应因未重填密钥而破坏既有可用配置。 | 一次误保存即可让后续 AI 调用整体失效，属于高成本配置破坏。 | `api_key` 必须采用“空值保留原密钥，显式清除才删除”的规则；PRD 要求保存接口与表单文案同步体现该语义。 | P1 |

## 5. 风险优先级分布（P0/P1/P2）

| 优先级 | 数量 | 代表交互 | 处理要求 |
|---|---:|---|---|
| P0 | 1 | `Newsletter / Main Channel 点赞 / 点踩按钮` | 先确认反馈语义与接口映射，再允许进入研发可执行 PRD。 |
| P1 | 6 | 日期切换、原文点击埋点、兴趣删除、设置页加载、测试连接、保存配置 | 与主路径可理解性或稳定性直接相关，需在同一轮 PRD 中写清规则。 |
| P2 | 2 | 候选标签采纳契约、批量抓取反馈 | 不阻塞主流程，但必须在 TECH/PRD 中补齐约束，避免后续继续漂移。 |

> 结论：研发可执行 PRD 的编写顺序应为 **P0 → P1 → P2**，且每条规则都要显式回链到矩阵行与 gap-log ID。

## 6. 深挖议题总览

| 顺序 | 深挖问题ID | 来源交互 | 触发优先级 | 会议需要产出的结论 |
|---|---:|---|---|---|
| 1 | `DDQ-03` | `Newsletter / Main Channel 点赞 / 点踩按钮` | P0 | 确认显式反馈的最终 payload、成功反馈、失败兜底与是否允许未接线时继续展示。 |
| 2 | `DDQ-07` | `Settings / Save Architecture 按钮` | P1 | 确认 `api_key` 保存语义：保留、清空、必填三者取一，并落到接口契约。 |
| 3 | `DDQ-06` | `Settings / Test Connection 按钮` | P1 | 确认测试连接默认验证对象是“当前草稿”还是“已保存配置”。 |
| 4 | `DDQ-01` | `Newsletter / 日期选择器 / 今天` | P1 | 固定 digest 历史列表契约，避免数组 / DTO 双口径再次出现。 |
| 5 | `DDQ-02` | `Newsletter / Main Channel 来源链接` | P1 | 确认阅读原文是否必须计入学习信号，以及失败是否阻断跳转。 |
| 6 | `DDQ-04` | `InterestSettings / 兴趣卡片 Delete 操作` | P1 | 固定删除成功契约与前端空响应处理规则。 |
| 7 | `DDQ-05` | `Settings / Settings 页面加载` | P1 | 确认设置页在加载失败 / 未配置时的状态分流与可执行下一步。 |

> 详见 `docs/superpowers/specs/2026-04-12-interaction-deep-dive-questions.md`。这些议题完成决策前，不应开始对应条目的研发可执行 PRD 细化。

## 7. 给研发可执行 PRD 的输入规则

1. **一条矩阵行对应一条 PRD 交互规则。** 每个交互必须写明入口、触发条件、前端动作、后端接口、成功反馈、失败反馈、状态回流与验收条件。
2. **Green 交互只复用闭环，不复用命名偏差。** 可直接继承现有链路结构，但若存在 PRD/TECH 命名不一致（如内容分层命名），必须先以 PRD 口径统一再落到实现文案与枚举。
3. **Yellow/Red 交互必须显式引用 gap-log ID。** 研发可执行 PRD 中要把 `IA-BE-*` / `IA-SPEC-*` 作为规则来源，避免问题在实现阶段再次被“默认处理”。
4. **所有接口契约都要写到字段级。** 对请求体、响应体、空响应、错误码、缺省值、可选字段和保留语义（例如 `api_key`）都要明确，禁止只写“调用某接口”。
5. **行为学习链路必须写事件映射。** 点赞 / 点踩 / 阅读原文等交互要写清事件名、对象 ID、分类字段、是否阻断主路径、失败后的 UI 处理。
6. **状态设计不可省略。** 每个关键页面至少要写 loading、empty、error、success 四类状态；若页面允许“新建模式”与“读取已有配置模式”切换，也要单独定义切换条件。
7. **批量动作必须给操作者汇总反馈。** 任何批处理（例如 `Manual Crawl All`）都要定义整体进度、完成计数、失败清单和重试入口，不能仅依赖单条提示。
8. **深挖结论要先于实施计划冻结。** `DDQ-01` ~ `DDQ-07` 的决策结果应先回填 PRD/TECH，再进入新的 implementation plan；未定事项不得以占位语句进入实施计划。
