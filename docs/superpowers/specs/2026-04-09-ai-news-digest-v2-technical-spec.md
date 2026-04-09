# AI News Digest V2 - 技术架构文档

> 本文档为 ai-crawler V2 版本的技术规格书，供多 Agent 并行开发参考使用。
> 项目背景：个人使用的私有化部署产品，支持 Docker，后端 Python，前端浏览器端呈现。

---

## 一、项目背景与约束

### 1.1 部署形态
- **私有化部署**：个人使用，数据完全自主
- **Docker 优先**：后端 + 数据库 + 爬虫打包为一键部署
- **不依赖云服务**：所有数据存储在本地或自建服务

### 1.2 技术栈约束
| 层级 | 技术选型 | 约束原因 |
|------|---------|---------|
| 后端 | Python FastAPI | 已有项目基础，轻量高效 |
| 数据库 | SQLite | 轻量、免配置、适合个人使用 |
| 前端 | React + TypeScript | 已有项目基础，生态成熟 |
| AI 服务 | OpenAI API 兼容 | 锚点提取、简报合成需要 LLM 能力 |
| 爬虫 | Python requests + BeautifulSoup | 成熟稳定 |
| 调度 | APScheduler | 已有项目基础 |
| 容器化 | Docker + docker-compose | 私有化部署标准 |

### 1.3 非功能性需求
- 简报生成时间 < 60s（10篇文章）
- 前端页面加载 < 2s
- 权重更新延迟 < 24h
- 学习算法收敛稳定（权重不超过 0.1-2.5 范围）

---

## 二、系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
│  简报首页  ·  兴趣管理  ·  信息源管理  ·  AI配置            │
└─────────────────────────────────────────────────────────────┘
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端 (FastAPI + Uvicorn)                │
│  简报 API  ·  锚点 API  ·  兴趣学习 API  ·  行为日志 API   │
└─────────────────────────────────────────────────────────────┘
              │               │               │
              ▼               ▼               ▼
      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
      │   SQLite    │  │  爬虫调度器  │  │  AI 服务    │
      │   数据库     │  │  APScheduler │  │  OpenAI     │
      └─────────────┘  └─────────────┘  └─────────────┘
```

### 2.2 数据流

```
信息源爬取 → 文章存储 → AI锚点提取 → 锚点存储
                                          ↓
                              兴趣匹配 + 探索策略
                                          ↓
                              每日简报合成 → 前端展示
                                          ↓
                          用户反馈(显式show/hide + 隐式行为)
                                          ↓
                              兴趣权重更新 → 下一轮简报
```

---

## 三、后端技术规格

### 3.1 依赖清单

```txt
# backend/requirements.txt
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0
sqlalchemy>=2.0.25
aiosqlite>=0.19.0        # 异步 SQLite 支持
apscheduler>=3.10.4
beautifulsoup4>=4.12.3
requests>=2.31.0
feedparser>=6.0.10
numpy>=1.26.0            # 权重计算
openai>=1.12.0           # AI 服务
python-dotenv>=1.0.0
httpx>=0.26.0            # 异步 HTTP
```

### 3.2 数据模型

#### AnchorPoint（锚点）
```python
class AnchorPoint(BaseModel):
    id: int
    article_id: int
    title: str                      # 洞察标题
    content: str                    # 核心内容（200字内）
    dialectical_analysis: str       # 辩证分析（150字内）
    anchor_type: str                # "breakthrough" | "controversy" | "data" | "opinion"
    significance: float             # 重要性 0.0-1.0
    source_article_title: str
    source_article_link: str
    source_name: str
    tags: list[str]
    related_tag_weights: dict       # {"强化学习": 0.8, "AI": 0.5}
    created_at: datetime
```

#### DailyDigest（每日简报）
```python
class DailyDigest(BaseModel):
    id: int
    date: date
    title: str                      # "2026-04-09 今日资讯"
    overview: str                    # 导语（100字）
    sections: list[DigestSection]   # 分组
    total_articles_processed: int
    anchor_count: int
    created_at: datetime

class DigestSection(BaseModel):
    domain: str                     # "AI领域", "金融领域"
    domain_icon: str                # "🤖", "💰"
    insights: list[InsightRef]

class InsightRef(BaseModel):
    anchor_id: int
    title: str
    content: str
    dialectical_analysis: str
    source_article_link: str
    source_name: str
    tags: list[str]
    zone: str                       # "main" | "explore" | "surprise"
```

#### UserInterestTag（用户兴趣标签）
```python
class UserInterestTag(BaseModel):
    id: int
    tag: str                        # "强化学习", "LLM", "理财"
    weight: float                   # 0.1 - 2.5, 初始1.0
    status: str                     # "active" | "frozen" | "candidate"
    view_count: int
    show_count: int
    hide_count: int
    total_time_spent: float         # 累计阅读时长(秒)
    click_count: int
    last_updated: datetime
    created_at: datetime
```

#### UserBehaviorLog（行为日志）
```python
class UserBehaviorLog(BaseModel):
    id: int
    digest_id: int
    anchor_id: int
    tag: str
    signal_type: str               # "explicit" | "implicit"
    action: str                    # "show" | "hide" | "click" | "dwell" | "scroll" | "revisit"
    value: float                   # 时长、滚动百分比等
    created_at: datetime
```

### 3.3 API 设计

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/digests` | 获取简报列表（分页） |
| GET | `/api/digests/{date}` | 获取指定日期简报 |
| POST | `/api/digests/generate` | 手动触发简报生成 |
| GET | `/api/digests/latest` | 获取最新一份简报 |
| GET | `/api/anchors` | 获取锚点列表 |
| GET | `/api/anchors/{id}` | 获取锚点详情 |
| GET | `/api/interests` | 获取用户所有兴趣标签 |
| POST | `/api/interests` | 添加新兴趣标签 |
| PUT | `/api/interests/{id}` | 更新标签 |
| DELETE | `/api/interests/{id}` | 删除标签 |
| POST | `/api/interests/{id}/feedback` | 提交显式反馈 |
| GET | `/api/interests/stats` | 获取标签统计 |
| POST | `/api/behavior/batch` | 批量提交隐式行为 |
| GET | `/api/behavior/history` | 获取行为历史 |
| GET | `/api/sources` | 获取所有信息源 |
| POST | `/api/sources` | 添加信息源 |
| PUT | `/api/sources/{id}` | 更新信息源 |
| DELETE | `/api/sources/{id}` | 删除信息源 |
| GET | `/api/sources/types` | 获取支持的信息源类型 |

### 3.4 AI Prompt 设计

#### 锚点提取 Prompt
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

#### 简报合成 Prompt
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
用户兴趣标签：{user_interests}"""
```

### 3.5 学习算法

#### 信号权重表
```python
SIGNAL_WEIGHTS = {
    # 显式信号（高置信度）
    "show": 1.0,
    "hide": -1.3,
    "share": 0.8,

    # 隐式信号
    "click": 0.3,
    "dwell_10s": 0.1,
    "dwell_30s": 0.3,
    "dwell_60s": 0.5,
    "scroll_bottom": 0.2,
    "revisit": 0.4,
}

DECAY_FACTOR = 0.95        # 每7天衰减5%
NOVELTY_BONUS = 0.2        # 新领域首次正向反馈bonus
```

#### 权重更新公式
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

    signal_count_penalty = 1.0 / (1.0 + 0.1 * len(signals))
    novelty = NOVELTY_BONUS if is_new_discovery else 0.0

    change_factor = np.exp(weighted_sum * signal_count_penalty + novelty)

    new_weight = current_weight * change_factor
    new_weight = max(0.1, min(2.5, new_weight))

    return new_weight
```

#### 内容分层策略
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
```

---

## 四、前端技术规格

### 4.1 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 18.x |
| 语言 | TypeScript | 5.x |
| 路由 | React Router | 6.x |
| 状态 | Zustand / TanStack Query | latest |
| 样式 | CSS Modules + CSS Variables | - |
| 日期 | dayjs | 1.x |
| 构建 | Vite | 5.x |

### 4.2 页面结构

```
/                     → 重定向到 /digest
/digest               → 简报首页（今日/历史简报）
/digest/:date         → 指定日期简报
/settings             → 设置页
/settings/interests   → 兴趣标签管理
/settings/sources     → 信息源管理
/settings/ai          → AI配置
```

### 4.3 组件清单

| 组件 | 说明 |
|------|------|
| DigestPage | 简报首页容器 |
| DigestHeader | 日期选择器 + 设置按钮 |
| DigestOverview | 导语展示 |
| DigestSection | 领域分组（如 AI领域） |
| InsightBlock | 单个洞察块（含标题、内容、辩证分析） |
| DialecticalBox | 辩证分析展示（支持/质疑/延伸） |
| FeedbackButtons | show/hide 反馈按钮 |
| ExploreSection | 探索区（弱兴趣内容） |
| InterestTagItem | 兴趣标签项（权重条+统计） |
| InterestTagList | 标签列表 |
| SourceItem | 信息源项 |

### 4.4 Hooks

| Hook | 说明 |
|------|------|
| useDigest | 获取简报数据 |
| useInterests | 操作用户兴趣标签 |
| useBehaviorCollector | 收集用户隐式行为 |
| useSources | 管理信息源 |

---

## 五、UI/UX 设计规格

详细统一规范见：[2026-04-09-ui-design-guidelines.md](./2026-04-09-ui-design-guidelines.md)

### 5.1 设计定位

| 维度 | 决策 |
|------|------|
| **视觉方向** | Editorial / Newspaper-inspired |
| **情感基调** | 冷静、理性、值得信赖 |
| **核心隐喻** | 私人编辑精选的 Newsletter |
| **记忆点** | 读简报像翻阅资深编辑为你梳理的世界 |

### 5.2 调色板

```css
:root {
  /* 纸感背景 - 暖白，编辑质感 */
  --bg-primary: #FAF9F7;
  --bg-secondary: #F3F1ED;
  --bg-insight: #FFFFFF;

  /* 文字层次 */
  --text-primary: #1A1A1A;     /* 标题黑 */
  --text-body: #3D3D3D;        /* 正文灰 */
  --text-muted: #8A8A8A;       /* 次要信息 */
  --text-inverse: #FAFAFA;     /* 反色文字 */

  /* 强调色 */
  --accent: #C73E3E;           /* 编辑红 - 锚点/标题强调 */
  --accent-explore: #2E6B9E;   /* 探索蓝 */

  /* 辩证三色 */
  --dialectical-support: #2D5A27;    /* 支持 - 森林绿 */
  --dialectical-question: #A0522D;   /* 质疑 - 赭石 */
  --dialectical-extend: #4A4A8A;     /* 延伸 - 靛蓝 */

  /* 边框与阴影 */
  --border-subtle: #E8E5DF;
  --border-hover: #D4D0C8;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-hover: 0 8px 24px rgba(0,0,0,0.12);
}
```

### 5.3 字体方案

```css
/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  /* 标题/锚点 - 衬线体，编辑感 */
  --font-display: 'Playfair Display', 'Source Serif Pro', Georgia, serif;

  /* 正文 - 无衬线，易读 */
  --font-body: 'Inter', 'IBM Plex Sans', system-ui, sans-serif;

  /* 标签/代码 - 等宽 */
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* 字号 */
  --text-xs: 0.75rem;     /* 12px - 标签 */
  --text-sm: 0.875rem;    /* 14px - 次要 */
  --text-base: 1rem;       /* 16px - 正文 */
  --text-lg: 1.125rem;    /* 18px - 大正文 */
  --text-xl: 1.25rem;     /* 20px - 小标题 */
  --text-2xl: 1.5rem;     /* 24px - 标题 */
  --text-3xl: 2rem;        /* 32px - 大标题 */
  --text-4xl: 2.5rem;     /* 40px - 页面标题 */

  /* 行高 */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

### 5.4 空间系统

```css
:root {
  /* 间距 */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;       /* 16px */
  --space-6: 1.5rem;     /* 24px */
  --space-8: 2rem;       /* 32px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */

  /* 布局 */
  --content-max-width: 680px;   /* 阅读最佳宽度 */
  --content-padding: clamp(1rem, 5vw, 3rem);
}
```

### 5.5 关键组件设计

#### InsightBlock（洞察块）
```
┌─────────────────────────────────────────────────────┐
│ ▎ 强化学习新突破：AlphaZero 2.0 超越人类冠军        │ ← 衬线标题，左侧红色边条
│                                                     │
│  DeepMind发布了AlphaZero的重大升级版本，在国际象棋、  │ ← 正文，18px，1.75行高
│  日本将棋和围棋中展现出超越人类冠军的能力...         │
│                                                     │
│  ┌─ 辩证分析 ─────────────────────────────────┐   │
│  │ 🟢【支持】学界认可其技术突破性               │   │ ← 缩进，左侧绿色竖线
│  │ 🟤【质疑】泛化能力仍受限，新环境表现存疑     │   │ ← 缩进，左侧赭色竖线
│  │ 🟣【延伸】预示AI在策略类游戏的商业应用加速   │   │ ← 缩进，左侧蓝色竖线
│  └────────────────────────────────────────────┘   │
│                                                     │
│  🔗 DeepMind官方发布  🏷️ #强化学习 #AI            │ ← 元信息，14px
│                              [✓] [✗]              │ ← hover时显示反馈按钮
└─────────────────────────────────────────────────────┘
```

#### 视觉规范
- **InsightBlock 容器**: 白底 `--bg-insight`，圆角 8px，轻阴影 `--shadow-sm`
- **左侧边条**: 3px，`--accent` 红色
- **hover 时阴影**: 升至 `--shadow-hover`
- **FeedbackButtons**: 默认 `opacity: 0`，hover 时 `opacity: 1` 淡入

#### DialecticalBox（辩证分析）
```
┌─ 辩证分析 ─────────────────────────────────────────┐
│                                                    │
│  🟢 支持                                           │  ← 森林绿标签
│  学界认可其技术突破性，认为这是深度学习在策略领域   │
│  的重大进步...                                     │
│                                                    │
│  🟤 质疑                                           │  ← 赭石标签
│  部分研究者指出其在新环境中的泛化能力存疑...       │
│                                                    │
│  🟣 延伸                                           │  ← 靛蓝标签
│  这预示着AI在策略类游戏和商业决策中的加速应用...   │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 视觉规范
- **左侧竖线**: 3px，对应颜色（support/question/extend）
- **缩进**: `padding-left: var(--space-6)`
- **标签**: 14px `--font-mono`，颜色对应

#### ExploreSection（探索区）
```
══════════════════════════════════════════════════════
           🔍 探索区 · 可能感兴趣的新动向
══════════════════════════════════════════════════════

▎ 量子计算进入商用阶段
  IBM宣布其量子计算机已实现99.9%保真度...
  #量子计算 #新发现
```

#### 视觉规范
- **分隔线**: 1px `--border-subtle`，中间带文字
- **区域标签**: `--accent-explore` 蓝色，16px
- **背景**: 保持 `--bg-primary`，不做卡片化处理

### 5.6 动效规范

```css
/* 过渡 */
--transition-fast: 150ms ease-out;
--transition-normal: 300ms ease-out;
--transition-slow: 500ms ease-out;

/* 使用场景 */
/* FeedbackButtons 淡入 */ opacity: 0 → 1, 300ms
/* InsightBlock hover阴影 */ box-shadow变化, 200ms
/* 页面切换 */ fade + translateY, 400ms
/* DialecticalBox 展开 */ max-height + opacity, 300ms
```

---

## 六、文件变更清单

### 6.1 新增文件

```
backend/
├── models.py                    # 扩展：AnchorPoint, DailyDigest, UserInterestTag等
├── database.py                   # 扩展：新增数据表
├── routers/
│   ├── digests.py               # 新增：简报路由
│   ├── interests.py             # 新增：兴趣路由
│   ├── behavior.py              # 新增：行为路由
│   └── sources.py               # 扩展：支持新source_type
├── services/
│   ├── ai.py                    # 扩展：锚点提取、简报合成
│   ├── crawler_zhihu.py         # 新增：知乎爬虫
│   ├── crawler_rss.py           # 新增：RSS爬虫
│   ├── learning.py              # 新增：权重更新算法
│   └── scheduler.py             # 扩展：触发锚点提取和简报生成
├── prompts/
│   ├── anchor_extraction.py      # 新增：锚点提取prompt
│   └── digest_synthesis.py      # 新增：简报合成prompt

frontend/src/
├── pages/
│   ├── Digest.tsx               # 新增：简报页面
│   ├── InterestSettings.tsx     # 新增：兴趣设置页面
│   └── Sources.tsx              # 扩展：支持新源类型
├── components/
│   ├── InsightBlock.tsx         # 新增：洞察块
│   ├── DialecticalBox.tsx       # 新增：辩证分析
│   ├── FeedbackButtons.tsx       # 新增：反馈按钮
│   ├── DigestSection.tsx        # 新增：领域分组
│   ├── ExploreSection.tsx       # 新增：探索区
│   ├── InterestTagItem.tsx      # 新增：标签项
│   ├── InterestTagList.tsx      # 新增：标签列表
│   └── DateSelector.tsx         # 新增：日期选择器
├── hooks/
│   ├── useDigest.ts             # 新增：简报数据hook
│   ├── useInterests.ts          # 新增：兴趣标签hook
│   ├── useBehaviorCollector.ts  # 新增：行为收集hook
│   └── useSources.ts            # 新增：信息源hook
├── styles/
│   ├── tokens.css               # 新增：CSS变量定义
│   ├── typography.css           # 新增：字体规范
│   └── components/              # 新增：组件样式
│       ├── insight-block.css
│       ├── dialectical-box.css
│       └── feedback-buttons.css
└── api/
    └── client.ts                # 扩展：新增API方法

docker/
├── Dockerfile.backend            # 新增：后端Dockerfile
├── Dockerfile.frontend          # 新增：前端Dockerfile
└── docker-compose.yml           # 扩展：整合所有服务
```

### 6.2 修改文件

```
backend/
├── models.py                    # 扩展数据模型
├── main.py                      # 注册新路由
├── requirements.txt             # 新增依赖

frontend/
├── App.tsx                      # 更新路由
├── pages/Home.tsx              # 重构为DigestPage
├── index.css                    # 扩展样式
└── package.json                 # 新增依赖
```

---

## 七、实现计划

### Phase 1: 后端简报生成 ✅ 完成

**Task A.1** - 扩展 models.py：新增 AnchorPoint, DailyDigest, DigestSection 模型 ✅
**Task A.2** - 新增数据库表：anchor_points, daily_digests ✅
**Task A.3** - 实现 anchor_extraction prompt 和 AI 调用 ✅
**Task A.4** - 实现 digest_synthesize prompt 和 AI 调用 ✅
**Task A.5** - 新增 /api/digests 路由 ✅
**Task A.6** - 修改 scheduler：文章抓取后触发锚点提取 ✅
**Task A.7** - 修改 scheduler：定时生成每日简报 ✅
**Task A.8** - 联调测试完整流程 ✅

### Phase 2: 后端兴趣学习 ✅ 完成

**Task B.1** - 扩展 models.py：新增 UserInterestTag, UserBehaviorLog 模型 ✅
**Task B.2** - 新增数据库表：user_interest_tags, user_behavior_logs, digest_feedback ✅
**Task B.3** - 实现权重更新算法 update_tag_weight() ✅
**Task B.4** - 实现锚点过滤和排序逻辑 ✅
**Task B.5** - 新增 /api/interests 路由（CRUD）✅
**Task B.6** - 新增 /api/behavior 路由（批量上报）✅
**Task B.7** - 实现每日批处理学习任务 ✅
**Task B.8** - 新标签自动发现和升级逻辑 ✅

### Phase 3: 前端 Newsletter UI 🔄 进行中

**Task C.1** - 重构 Home.tsx 为 Digest.tsx ✅
**Task C.2** - 实现 InsightBlock 组件（含辩证分析展示）✅
**Task C.3** - 实现 FeedbackButtons 组件（show/hide）✅
**Task C.4** - 实现 useBehaviorCollector Hook ⏳
**Task C.5** - 新增 /settings/interests 页面 ⏳
**Task C.6** - 实现 InterestTagItem 组件（权重条+统计）⏳
**Task C.7** - 实现日期选择器（历史简报切换）⏳
**Task C.8** - 实现探索区样式（弱兴趣内容）✅
**Task C.9** - CSS 样式适配（参考 tokens.css 规范）✅

### Phase 4: 信息源扩展 ⏳ 待开始

**Task D.1** - 实现 ZhihuCrawler（知乎文章爬虫）⏳
**Task D.2** - 实现 RSSCrawler（RSS订阅爬虫）⏳
**Task D.3** - 扩展 NewsSource 模型（新增 source_type）⏳
**Task D.4** - 前端新增源类型选择 ⏳
**Task D.5** - 知乎/知乎用户文章抓取逻辑 ⏳
**Task D.6** - RSS feed 解析和文章提取 ⏳

---

## 八、参考设计来源

### 8.1 Readwise Reader 设计理念
- **沉浸阅读优先**：UI 元素默认淡化，hover/聚焦时显现
- **Highlights 机制**：锚点高亮 + 同步 marginalia（页边批注）
- **Library vs Feed 隐喻**：主航道（archive）vs 探索区（feed）
- **Keyboard Shortcuts**：power user 友好
- 来源：[Readwise Reader Getting Started](https://blog.readwise.io/p/bf87944f-b0fe-4f08-a461-f75ab8aded6a/)

### 8.2 Newsletter 排版规范
- **字体搭配**：衬线标题 + 无衬线正文（最多2-3种字体）
- **行宽控制**：45-75字符（~580-680px）
- **行高**：1.5-1.8（衬线偏大）
- **层次区分**：靠留白和字重，非卡片边框
- 来源：[Newsletter Typography Best Practices](https://newsletterpro.com/blog/newsletter-typography-best-practices-for-captivating-readers/)

### 8.3 Reading App 字体技术细节
- **正文字号**：16-20px
- **用户字体控制**：提供衬线/无衬线切换
- **暗模式对比度调整**：暗色主题下笔画视觉更重
- **无障碍**：支持系统字体缩放、行间距调节
- 来源：[Font.News: Typography Behind Reading Apps](https://font.news/the-typography-behind-popular-reading-apps-design-functional)

---

## 九、技术注意事项

### 9.1 数据库顺序
- Phase A 先完成，models.py 中建立基础模型
- Phase B 在 Phase A 基础上扩展，避免模型冲突
- 如两 agent 同时跑，A 先写基础 model，B 后扩展

### 9.2 API 兼容性
- 前后端通过 REST API 交互
- 保持 API 响应格式一致（success/data/error 结构）

### 9.3 Docker 部署
```yaml
# docker-compose.yml 关键服务
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - ./data:/app/data
    depends_on:
      - database

  frontend:
    build: ./frontend
    ports: ["3000:80"]
    depends_on:
      - backend

  database:
    image: alpine
    volumes:
      - sqlite-data:/data
```

### 9.4 AI 服务配置
- 通过环境变量配置 `OPENAI_API_KEY`
- 支持 OpenAI API 兼容 endpoint（可对接代理或自建服务）
- 考虑添加 `OPENAI_BASE_URL` 支持

---

*文档版本：1.0*
*最后更新：2026-04-09*
*用途：多 Agent 并行开发参考文档*
