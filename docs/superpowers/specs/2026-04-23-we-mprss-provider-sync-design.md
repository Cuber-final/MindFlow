# We-MP-RSS Provider Sync Design

> 日期：2026-04-23
> 状态：approved-in-chat
> 目标：用 `mp_id -> 刷新公众号 -> 获取今日文章列表 -> 触发正文补抓` 替换当前基于 feed item `external_id` 的 `we_mp_rss` 主链路，并为后续治理保留稳定的 provider 标识字段。

## 设计结论

- `we_mp_rss` 不再以 feed item `id/guid` 作为主发现入口。
- `NewsSource` 新增中性字段 `provider_source_id`，对 `we_mp_rss` 存 `mp_id`。
- `Article` 新增中性字段 `provider_article_id`，对 `we_mp_rss` 存 `/api/v1/wx/articles` 返回的文章 `id`。
- `we_mp_rss` 的主去重键改为 `source_id + provider_article_id`。
- `external_id` 本轮软退役：保留列做兼容，不再参与新的 `we_mp_rss` 主链路。
- 继续使用 `httpx`，不引入 `requests`。

## 为什么替换旧链路

当前实现把 `we_mp_rss` JSON/RSS feed 条目直接映射成文章，并把 feed item `id` 记入 `external_id`。这有两个问题：

1. `external_id` 来自发现层 feed，而不是 provider 文章主接口，语义不稳定。
2. 新发现和正文回填被拆成两套标识体系，后续调 `/api/v1/wx/articles/{article_id}` 时只能依赖旧的 feed id 假设。

参考 [backend/tests/mp_refresh_today_flow.py](../../../backend/tests/mp_refresh_today_flow.py) 的完整链路，更合理的主流程应当围绕 provider 自己的 `mp_id` 和文章 `id` 运转。

## 新主链路

### 1. 从 RSS URL 解析 provider_source_id

- 输入仍然是 `we_mp_rss` source 已有的 RSS URL，例如 `/feed/MP_WXS_3941633310.rss?limit=5`
- 运行时从 URL 解析出 `provider_source_id`
- 对 `we_mp_rss` source：
  - 如果 `provider_source_id` 为空，自动回填保存
  - 如果已存在但和解析结果不同，以解析结果为准并更新

### 2. 刷新公众号最近页

- 先确保 `we_mp_rss` source 拿到有效认证状态
- 调 `/api/v1/wx/mps/update/{provider_source_id}` 触发 provider 侧刷新
- 保留短暂 settle 等待，避免刷新请求和文章列表读取打架

### 3. 获取收窄后的文章列表

- 调 `/api/v1/wx/articles?mp_id={provider_source_id}&limit={N}&offset=0`
- 只保留“今天”的文章
- “今天”按 `Asia/Shanghai` 判断，和参考脚本一致

### 4. 入库与去重

- 对当天文章，使用 `source_id + provider_article_id` 查重
- 新文章写入：
  - `provider_article_id`
  - 标题、链接、发布时间、作者等基础字段
  - `content` / `content_html`
  - `content_refresh_status`
- 旧文章更新：
  - 基础元数据
  - 如果正文已经补全，不回退状态
  - 如果正文仍缺失，可继续保留待回填状态

### 5. 触发正文补抓

- 对“今天”文章里 `has_content` 为假，且 `content/content_html` 为空的条目，触发 `/api/v1/wx/articles/{provider_article_id}/refresh`
- 如果列表接口已经带回可用正文：
  - 直接写入 `content_html/content`
  - 标记为 `detail_fetched`
- 如果列表接口没有正文：
  - 标记为 `waiting_for_refresh`
  - 交给现有回填流程继续处理

### 6. 正文回填

- scheduler 不再使用 `external_id` 调详情和 refresh
- 对 `we_mp_rss` 文章统一使用 `provider_article_id`
- 回填成功后：
  - 更新 `content_html`
  - 更新 `content`
  - `content_refresh_status = detail_fetched`
- 回填失败时保留错误信息在 `content_refresh_error`

## 数据模型

### NewsSource

新增：

- `provider_source_id: String | null`

语义：

- 对 `we_mp_rss`：存 `mp_id`
- 对 `native_rss` / `rsshub`：为空

### Article

新增：

- `provider_article_id: String | null`

保留并继续使用：

- `content_html`
- `content_refresh_status`
- `content_refresh_task_id`
- `content_refresh_error`

软退役：

- `external_id`
  - 本轮保留列
  - 对新的 `we_mp_rss` 主链路不再承担 provider 主键语义

## API / 契约影响

- Source API 响应可安全增加 `provider_source_id`
- Article API 响应可安全增加 `provider_article_id`
- 现有前端不依赖这两个字段，因此这轮不需要 UI 改造

## 存储与性能

- `content_html` 继续放在 `articles.content_html`，类型保持 `Text`
- 当前不额外拆 `article_contents` 表
- 但应注意：
  - 列表查询不应默认把大字段作为未来优化前提
  - 本轮重点先放在链路正确性和标识语义收敛

## 明确不做

- 不保留旧的 `we_mp_rss` feed item 发现逻辑作为 fallback
- 不在这轮引入新的任务页或日志页
- 不在这轮彻底删除 `external_id` 列
- 不为正文存储单独拆表
