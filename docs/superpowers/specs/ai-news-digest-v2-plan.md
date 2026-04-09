# AI News Digest V2 - 开发计划

> 本文档定义 ai-crawler 项目的 V2 版本，详细说明 Newsletter 形态简报系统的设计与实现计划。

## 1. 项目愿景

### 1.1 核心定位

**从"文章列表展示"升级为"个性化每日资讯简报"**

- 用户设定兴趣标签，系统定期爬取信息源
- AI 对文章进行深度加工：提取锚点、辩证分析、生成简报
- 用户通过显式/隐式反馈持续训练兴趣模型
- 引入 Exploration 机制，避免信息茧房

### 1.2 Newsletter 形态

```
┌──────────────────────────────────────────────────────┐
│  📅 2026-04-09 今日资讯                    [⚙️ 设置] │
│  ─────────────────────────────────────────────────  │
│                                                       │
│  【导语】                                             │
│  今日资讯整体平稳，AI领域有重大突破，理财市场持续震荡。   │
│  以下内容经AI辩证分析，供你参考。                      │
│                                                       │
│  【🤖 AI领域】                                        │
│                                                       │
│  ▎强化学习新突破：AlphaZero 2.0 超越人类冠军           │
│  DeepMind发布了AlphaZero的重大升级版本...              │
│                                                       │
│  ┌─ 辩证分析 ────────────────────────────────┐        │
│  │ 【支持】学界认可其技术突破性               │        │
│  │ 【质疑】泛化能力仍受限，新环境表现存疑       │        │
│  │ 【延伸】预示AI在策略类游戏的商业应用加速     │        │
│  └──────────────────────────────────────────┘        │
│  🔗 DeepMind官方发布 | 🏷️ #强化学习 #AI              │
│                                                       │
│  【💰 金融领域】...                                   │
│                                                       │
│  【🔍 探索区】本周值得关注的新动向                    │
│  ▎量子计算进入商用阶段（#量子计算 #新发现）             │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 1.3 设计原则

| 原则 | 说明 |
|------|------|
| **Newsletter优先** | 每天一份结构化简报，文字为主，而非卡片流 |
| **辩证分析** | 观点提炼不止于摘要，要包含支持/质疑/延伸 |
| **防止茧房** | 主航道60% + 探索区30% + 惊喜箱10% |
| **自主学习** | 显式show/hide + 隐式行为信号驱动权重更新 |
| **用户可控** | 兴趣标签可管理，探索深度可调整 |

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  简报首页   │  │  兴趣管理   │  │   信息源管理        │ │
│  │  Newsletter │  │  标签权重   │  │   公众号/知乎/RSS  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端 (FastAPI)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  简报 API   │  │  锚点 API   │  │   兴趣学习 API      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  行为日志   │  │  反馈处理   │  │   AI 服务           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
       │   SQLite    │  │  爬虫调度器  │  │  AI 服务    │
       │   数据库     │  │  APScheduler │  │  OpenAI兼容 │
       └─────────────┘  └─────────────┘  └─────────────┘
```

### 2.2 核心数据流

```
信息源爬取
    ↓
文章存储
    ↓
AI锚点提取 (Anchor Extraction)
    ↓
锚点存储 (AnchorPoint)
    ↓
兴趣匹配 + 探索策略 (Exploitation/Exploration)
    ↓
每日简报合成 (Digest Synthesis)
    ↓
前端展示
    ↓
用户反馈 (显式show/hide + 隐式行为)
    ↓
兴趣权重更新 (Daily Learning Batch)
    ↓
下一轮简报生成
```

---

## 3. 数据模型

### 3.1 现有模型扩展

```python
# backend/models.py

# === 新增：锚点 ===
class AnchorPoint(BaseModel):
    """从文章中提取的关键洞察"""
    id: int
    article_id: int
    title: str                      # 洞察标题
    content: str                    # 核心内容（200字内）
    dialectical_analysis: str       # 辩证分析（150字内）
    anchor_type: str                # "breakthrough" | "controversy" | "data" | "opinion"
    significance: float             # 重要性 0.0-1.0
    source_article_title: str
    source_article_link: str
    source_name: str                # 来源名称
    tags: list[str]                 # 关联的兴趣标签
    related_tag_weights: dict       # {"强化学习": 0.8, "AI": 0.5}
    created_at: datetime

# === 新增：每日简报 ===
class DailyDigest(BaseModel):
    """每日资讯简报"""
    id: int
    date: date
    title: str                      # "2026-04-09 今日资讯"
    overview: str                    # 导语（100字）
    sections: list[DigestSection]   # 分组
    total_articles_processed: int   # 处理文章总数
    anchor_count: int               # 锚点总数
    created_at: datetime

class DigestSection(BaseModel):
    """简报分组"""
    domain: str                     # "AI领域", "金融领域"
    domain_icon: str                # "🤖", "💰"
    insights: list[InsightRef]      # 该领域洞察

class InsightRef(BaseModel):
    """洞察引用（简报中的洞察）"""
    anchor_id: int
    title: str
    content: str
    dialectical_analysis: str
    source_article_link: str
    source_name: str
    tags: list[str]
    zone: str                       # "main" | "explore" | "surprise"

# === 新增：用户兴趣标签 ===
class UserInterestTag(BaseModel):
    """用户兴趣标签"""
    id: int
    tag: str                        # "强化学习", "LLM", "理财"
    weight: float                   # 0.1 - 2.5, 初始1.0
    status: str                     # "active" | "frozen" | "candidate"
    view_count: int                 # 被展示次数
    show_count: int                 # 显式show次数
    hide_count: int                 # 显式hide次数
    total_time_spent: float         # 累计阅读时长(秒)
    click_count: int                # 点击原文次数
    last_updated: datetime
    created_at: datetime

# === 新增：行为日志 ===
class UserBehaviorLog(BaseModel):
    """用户行为日志"""
    id: int
    digest_id: int
    anchor_id: int
    tag: str
    signal_type: str               # "explicit" | "implicit"
    action: str                     # "show" | "hide" | "click" | "dwell" | "scroll" | "revisit"
    value: float                    # 时长、滚动百分比等
    created_at: datetime

# === 新增：简报反馈 ===
class DigestFeedback(BaseModel):
    """简报反馈（显式）"""
    id: int
    digest_id: int
    anchor_id: int
    action: str                    # "show" | "hide"
    created_at: datetime
```

### 3.2 数据库 Schema

```sql
-- 锚点表
CREATE TABLE anchor_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    dialectical_analysis TEXT,
    anchor_type TEXT DEFAULT 'opinion',
    significance REAL DEFAULT 0.5,
    source_article_title TEXT,
    source_article_link TEXT,
    source_name TEXT,
    tags TEXT,  -- JSON array
    related_tag_weights TEXT,  -- JSON dict
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- 每日简报表
CREATE TABLE daily_digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    title TEXT NOT NULL,
    overview TEXT,
    sections TEXT,  -- JSON
    total_articles_processed INTEGER DEFAULT 0,
    anchor_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户兴趣标签表
CREATE TABLE user_interest_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT UNIQUE NOT NULL,
    weight REAL DEFAULT 1.0,
    status TEXT DEFAULT 'active',
    view_count INTEGER DEFAULT 0,
    show_count INTEGER DEFAULT 0,
    hide_count INTEGER DEFAULT 0,
    total_time_spent REAL DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 行为日志表
CREATE TABLE user_behavior_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    digest_id INTEGER,
    anchor_id INTEGER,
    tag TEXT,
    signal_type TEXT,
    action TEXT,
    value REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 简报反馈表
CREATE TABLE digest_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    digest_id INTEGER NOT NULL,
    anchor_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API 设计

### 4.1 简报相关 API

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/digests` | 获取简报列表（分页） |
| GET | `/api/digests/{date}` | 获取指定日期简报 |
| POST | `/api/digests/generate` | 手动触发简报生成 |
| GET | `/api/digests/latest` | 获取最新一份简报 |

### 4.2 锚点相关 API

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/anchors` | 获取锚点列表（支持筛选） |
| GET | `/api/anchors/{id}` | 获取锚点详情 |

### 4.3 兴趣标签 API

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/interests` | 获取用户所有兴趣标签 |
| POST | `/api/interests` | 添加新兴趣标签 |
| PUT | `/api/interests/{id}` | 更新标签（权重、状态） |
| DELETE | `/api/interests/{id}` | 删除标签 |
| POST | `/api/interests/{id}/feedback` | 提交显式反馈 |
| GET | `/api/interests/stats` | 获取标签统计 |

### 4.4 行为日志 API

| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/behavior/batch` | 批量提交隐式行为 |
| GET | `/api/behavior/history` | 获取行为历史（用于调试） |

### 4.5 信息源 API

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/sources` | 获取所有信息源 |
| POST | `/api/sources` | 添加信息源 |
| PUT | `/api/sources/{id}` | 更新信息源 |
| DELETE | `/api/sources/{id}` | 删除信息源 |
| GET | `/api/sources/types` | 获取支持的信息源类型 |

---

## 5. AI Prompt 设计

### 5.1 锚点提取 Prompt

```python
PROMPT_ANCHOR_EXTRACT = """你是一个资深编辑，负责从文章中提炼具有辩证性的洞察。

任务：
1. 提取文章的核心观点（不是摘要，是观点）
2. 给出辩证分析，格式必须包含：
   - 【支持】观点成立的核心论据
   - 【质疑】潜在的反对声音或局限
   - 【延伸】这一观点的深层影响或衍生思考
3. 识别文章涉及的领域/话题标签

格式要求：
- content: 核心内容，200字内
- dialectical_analysis: 辩证分析，150字内，格式【支持】...【质疑】...【延伸】...
- tags: 数组，最多5个标签
- anchor_type: breakthrough | controversy | data | opinion

原文信息：
标题：{title}
内容：{content}

请以JSON格式输出："""
```

### 5.2 简报合成 Prompt

```python
PROMPT_DIGEST_SYNTHESIZE = """你是一个资深编辑，负责将多个洞察合成一篇结构化每日简报。

要求：
1. 阅读用户兴趣标签，了解用户当前关注领域
2. 将锚点按领域/主题分组
3. 每组选取最重要的洞察（主航道选2-3个，探索区选1-2个）
4. 撰写导语，总结今日整体态势（100字内）
5. 保持文字流畅，像编辑好的Newsletter
6. 注意多样性：同一领域不超过60%篇幅

输出格式：
{
  "overview": "今日导语，100字内",
  "sections": [
    {
      "domain": "AI领域",
      "domain_icon": "🤖",
      "insights": [锚点列表]
    }
  ]
}

今日锚点：{anchors_json}
用户兴趣标签：{user_interests}
"""
```

### 5.3 领域分类 Prompt

```python
PROMPT_DOMAIN_CLASSIFY = """将以下标签分类到对应的领域：

标签列表：{tags}

领域选项：AI领域, 金融领域, 科技领域, 生物医药, 教育, 文化, 其他

输出JSON格式：
{
  "mappings": {"标签名": "领域"}
}
"""
```

---

## 6. 学习算法

### 6.1 信号权重表

```python
SIGNAL_WEIGHTS = {
    # 显式信号（高置信度）
    "show": 1.0,
    "hide": -1.3,          # 负向权重稍大，减少噪音
    "share": 0.8,

    # 隐式信号
    "click": 0.3,          # 点击原文
    "dwell_10s": 0.1,
    "dwell_30s": 0.3,
    "dwell_60s": 0.5,
    "scroll_bottom": 0.2,
    "revisit": 0.4,
}

DECAY_FACTOR = 0.95        # 每7天衰减5%
NOVELTY_BONUS = 0.2        # 新领域首次正向反馈bonus
```

### 6.2 权重更新公式

```python
import numpy as np

def update_tag_weight(
    current_weight: float,
    signals: list[FeedbackSignal],
    is_new_discovery: bool = False
) -> float:
    """
    权重更新算法
    new_weight = old_weight * exp(sum(weighted_signals))
    """
    if not signals:
        return current_weight

    now = datetime.now()
    weighted_sum = 0.0

    for signal in signals:
        days_old = (now - signal.timestamp).days
        time_decay = DECAY_FACTOR ** (days_old / 7)
        base_weight = SIGNAL_WEIGHTS.get(signal.action, 0)
        weighted_sum += base_weight * time_decay

    # 信号数量惩罚（防止刷分）
    signal_count_penalty = 1.0 / (1.0 + 0.1 * len(signals))

    # 新发现bonus
    novelty = NOVELTY_BONUS if is_new_discovery else 0.0

    # 计算变化因子
    change_factor = np.exp(weighted_sum * signal_count_penalty + novelty)

    # 有界更新
    new_weight = current_weight * change_factor
    new_weight = max(0.1, min(2.5, new_weight))

    return new_weight
```

### 6.3 内容分层策略

```python
STRONG_INTEREST = 1.3    # 主航道阈值
WEAK_INTEREST = 0.7      # 探索区阈值
SURPRISE_RATIO = 0.1     # 惊喜箱比例

def get_content_zone(tag_weight: float) -> str:
    if tag_weight >= STRONG_INTEREST:
        return "main"
    elif tag_weight >= WEAK_INTEREST:
        return "explore"
    else:
        return "discover"

def generate_daily_digest(
    all_anchors: list[AnchorPoint],
    user_tags: list[UserInterestTag],
    target_size: int = 10
) -> DailyDigest:
    # 1. 按zone分组
    main_anchors = []
    explore_anchors = []
    surprise_pool = []

    for anchor in all_anchors:
        max_tag_weight = max(
            (tag.weight for tag in user_tags if tag.tag in anchor.tags),
            default=0
        )
        zone = get_content_zone(max_tag_weight)

        if zone == "main":
            main_anchors.append((anchor, max_tag_weight))
        elif zone == "explore":
            explore_anchors.append((anchor, max_tag_weight))
        else:
            surprise_pool.append(anchor)

    # 2. 排序选择
    main_anchors.sort(key=lambda x: -x[1])
    explore_anchors.sort(key=lambda x: -x[1])

    main_selected = main_anchors[:int(target_size * 0.6)]
    explore_selected = explore_anchors[:int(target_size * 0.3)]
    surprise_selected = random.sample(
        surprise_pool,
        min(int(target_size * SURPRISE_RATIO), len(surprise_pool))
    )

    # 3. 合并
    final_anchors = [a for a, _ in main_selected] + \
                    [a for a, _ in explore_selected] + \
                    surprise_selected

    # 4. 领域平衡：同一领域不超过60%
    final_anchors = balance_domains(final_anchors, max_ratio=0.6)

    return final_anchors
```

---

## 7. 前端设计

### 7.1 页面结构

```
/                     → 重定向到 /digest
/digest               → 简报首页（今日/历史简报）
/digest/:date         → 指定日期简报
/settings             → 设置页
/settings/interests   → 兴趣标签管理
/settings/sources     → 信息源管理
/settings/ai          → AI配置
```

### 7.2 简报首页组件

```
DigestPage
├── DigestHeader
│   ├── DateSelector (切换历史简报)
│   └── SettingsButton
├── DigestOverview (导语)
├── DigestSection[] (按领域分组)
│   └── InsightBlock[]
│       ├── InsightTitle
│       ├── InsightContent
│       ├── DialecticalBox
│       │   ├── DialecticalLabel
│       │   └── DialecticalContent
│       ├── InsightMeta
│       │   ├── SourceLink
│       │   └── Tags
│       └── FeedbackButtons (hover显示)
│           ├── ShowButton
│           └── HideButton
└── ExploreSection (探索区弱兴趣内容)
```

### 7.3 兴趣管理页组件

```
InterestSettingsPage
├── InterestTagList
│   └── InterestTagItem
│       ├── TagName
│       ├── WeightBar (可视化权重)
│       ├── WeightValue
│       ├── StatsSummary (展示/点击/时长)
│       ├── TrendIndicator (+/-变化)
│       └── Actions
│           ├── FreezeToggle
│           └── DeleteButton
├── AddTagForm
└── LearningStats (学习情况总览)
```

---

## 8. 实现计划

### Phase 1: 简报生成流程 (A) ✅ 完成

**目标**: 实现后端核心：锚点提取 + 简报合成

| Task | Description | Status |
|------|-------------|--------|
| A.1 | 扩展 models.py：新增 AnchorPoint, DailyDigest, DigestSection 模型 | ✅ 完成 |
| A.2 | 新增数据库表：anchor_points, daily_digests | ✅ 完成 |
| A.3 | 实现 anchor_extraction prompt 和 AI 调用 | ✅ 完成 |
| A.4 | 实现 digest_synthesize prompt 和 AI 调用 | ✅ 完成 |
| A.5 | 新增 /api/digests 路由 | ✅ 完成 |
| A.6 | 修改 scheduler：文章抓取后触发锚点提取 | ✅ 完成 |
| A.7 | 修改 scheduler：定时生成每日简报 | ✅ 完成 |
| A.8 | 联调测试完整流程 | ✅ 完成 |

### Phase 2: 兴趣标签系统 (B) ✅ 完成

**目标**: 实现用户兴趣模型和自学习机制

| Task | Description | Status |
|------|-------------|--------|
| B.1 | 扩展 models.py：新增 UserInterestTag, UserBehaviorLog 模型 | ✅ 完成 |
| B.2 | 新增数据库表：user_interest_tags, user_behavior_logs, digest_feedback | ✅ 完成 |
| B.3 | 实现权重更新算法 update_tag_weight() | ✅ 完成 |
| B.4 | 实现锚点过滤和排序逻辑 | ✅ 完成 |
| B.5 | 新增 /api/interests 路由（CRUD） | ✅ 完成 |
| B.6 | 新增 /api/behavior 路由（批量上报） | ✅ 完成 |
| B.7 | 实现每日批处理学习任务 | ✅ 完成 |
| B.8 | 新标签自动发现和升级逻辑 | ✅ 完成 |

### Phase 3: 前端改版 (C) ✅ 完成

**目标**: 重构前端，实现 Newsletter 形态和交互

| Task | Description | Status |
|------|-------------|--------|
| C.1 | 重构 Home.tsx 为 DigestPage | ✅ 完成 |
| C.2 | 实现 InsightBlock 组件（含辩证分析展示） | ✅ 完成 |
| C.3 | 实现 FeedbackButtons 组件（show/hide） | ✅ 完成 |
| C.4 | 实现 useBehaviorCollector Hook | ⏳ 待开始 |
| C.5 | 新增 /settings/interests 页面 | ⏳ 待开始 |
| C.6 | 实现 InterestTagItem 组件（权重条+统计） | ⏳ 待开始 |
| C.7 | 实现日期选择器（历史简报切换） | ⏳ 待开始 |
| C.8 | 实现探索区样式（弱兴趣内容） | ✅ 完成 |
| C.9 | CSS 样式适配（参考 Newsletter 风格） | ✅ 完成 |

### Phase 4: 信息源扩展 (D)

**目标**: 支持更多类型的信息源

| Task | Description | Status |
|------|-------------|--------|
| D.1 | 实现 ZhihuCrawler（知乎文章爬虫） | TODO |
| D.2 | 实现 RSSCrawler（RSS订阅爬虫） | TODO |
| D.3 | 扩展 NewsSource 模型（新增 source_type） | TODO |
| D.4 | 前端新增源类型选择（mptext/zhihu/rss） | TODO |
| D.5 | 知乎/知乎用户文章抓取逻辑 | TODO |
| D.6 | RSS feed 解析和文章提取 | TODO |

---

## 9. 验收标准

### 9.1 功能验收

- [ ] 每日简报自动生成，内容为 Newsletter 形态
- [ ] 每个锚点包含辩证分析（支持/质疑/延伸）
- [ ] 锚点可点击跳转原文
- [ ] 用户可对锚点执行 show/hide 操作
- [ ] 隐式行为（停留、滚动、点击）被自动收集
- [ ] 兴趣标签权重根据反馈自动调整
- [ ] 新标签候选被自动发现和升级
- [ ] 探索区内容占 30% 比例
- [ ] 可切换查看历史简报
- [ ] 支持微信公众号、知乎、RSS 三种信息源

### 9.2 非功能验收

- [ ] 简报生成时间 < 60s（10篇文章）
- [ ] 前端页面加载 < 2s
- [ ] 权重更新延迟 < 24h
- [ ] 学习算法收敛稳定（不会出现极端权重值）

---

## 10. 技术依赖

```txt
# backend/requirements.txt 需新增
numpy>=1.24.0           # 数值计算（权重更新）
feedparser>=6.0.0       # RSS 解析
beautifulsoup4>=4.12.0  # HTML 解析
requests>=2.31.0        # HTTP 请求

# frontend/package.json 需新增
dayjs>=1.11.0           # 日期处理（已安装）
```

---

## 11. 文件变更清单

### 新增文件

```
backend/
├── models.py              # 扩展：新增模型
├── routers/
│   ├── digests.py         # 新增：简报路由
│   ├── interests.py       # 新增：兴趣路由
│   └── behavior.py        # 新增：行为路由
├── services/
│   ├── ai.py              # 扩展：新增锚点提取和简报合成
│   ├── crawler_zhihu.py   # 新增：知乎爬虫
│   ├── crawler_rss.py     # 新增：RSS爬虫
│   └── learning.py        # 新增：学习算法

frontend/src/
├── pages/
│   ├── Digest.tsx         # 新增：简报页面（替换Home）
│   └── InterestSettings.tsx # 新增：兴趣设置页面
├── components/
│   ├── InsightBlock.tsx    # 新增：洞察块组件
│   ├── DialecticalBox.tsx  # 新增：辩证分析组件
│   ├── FeedbackButtons.tsx  # 新增：反馈按钮组件
│   └── InterestTagItem.tsx # 新增：兴趣标签项组件
├── hooks/
│   └── useBehaviorCollector.ts # 新增：行为收集Hook
└── api/
    └── client.ts           # 扩展：新增API方法
```

### 修改文件

```
backend/
├── models.py              # 扩展数据模型
├── database.py            # 扩展数据库表
├── routers/sources.py     # 支持新的source_type
└── services/scheduler.py  # 触发锚点提取和简报生成

frontend/src/
├── App.tsx               # 更新路由
├── pages/Home.tsx         # 重构为Digest.tsx
└── index.css             # 新增Newsletter样式
```

---

## 12. 里程碑

| Milestone | 内容 | 状态 | 完成日期 |
|-----------|------|------|----------|
| M1 | Phase A 完成 | ✅ 完成 | 2026-04-09 |
| M2 | Phase B 完成 | ✅ 完成 | 2026-04-09 |
| M3 | Phase C 完成 | 🔄 进行中 | - |
| M4 | Phase D 完成 | ⏳ 待开始 | - |
| M5 | 端到端联调 | ⏳ 待开始 | - |
| M6 | 文档和发布 | ⏳ 待开始 | - |

---

*最后更新: 2026-04-09*
