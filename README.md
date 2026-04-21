# MindFlow

> AI 驱动的私有化信息工作台：以 **Daily Digest + Now** 为双核心入口

## 当前项目状态（2026-04-21）

### 已完成的主链路
- ✅ Settings 页支持 `loading / load_error / unconfigured / configured` 四态
- ✅ AI 配置支持“先测试、再保存”，并实现 `api_key` 保留语义
- ✅ `Daily Digest` 支持按周查询 / 周切换 / 无简报日期灰显
- ✅ Digest Main Channel 保留“减少这类话题内容”负反馈 + Undo
- ✅ 主阅读链路已切换为 `Daily Digest -> Now Detail -> Read Source`
- ✅ 新增 `Now` 后端队列、详情、已读 / 已处理状态更新
- ✅ 前端已切换到 `/daily-digest` + `/now` 双核心路由
- ✅ `Now` 三栏工作台已接入优先级队列、摘要阅读和状态流转
- ✅ 前端 `fetchApi` 已兼容 `204 No Content`
- ✅ Docker 部署下前端已通过 nginx 代理 `/api` 到后端，避免白屏和数据契约错读
- ✅ 前端静态 UI 文案已支持中英文双语切换（TopNav `中 / EN` 按钮触发）
- ✅ 语言偏好已持久化到 `localStorage(mindflow.locale)`，首次访问支持浏览器语言自动兜底

### 仍属于后续迭代的内容
- ⏳ Exploration Zone / Surprise Box 的更深交互
- ⏳ 候选标签 schema 与 API 契约继续收敛
- ⏳ 批量抓取（Manual Crawl All）汇总反馈
- ⏳ 更复杂的推荐抑制 / 质量反馈机制
- ⏳ 多用户场景下把 workbench state 从 `articles` 中拆出

## 功能特性

### 核心功能
- 📰 **Daily Digest** - 每日自动生成结构化资讯简报，作为当天信息入口
- 🗂️ **Now Workbench** - 针对未来 24–48 小时仍值得处理的内容队列与详情工作台
- 🤖 **AI 智能加工** - 自动从文章中提取关键洞察，生成辩证性分析（支持/质疑/延伸）
- 🎯 **兴趣标签系统** - 用户可管理兴趣标签，AI 学习偏好实现个性化推荐
- 📊 **行为跟踪** - 自动收集阅读行为（停留、点击、滚动），持续优化推荐
- 🔄 **探索机制** - 主航道 60% + 探索区 30% + 惊喜箱 10%，避免信息茧房

### 信息源
- 📱 **微信公众号** - 通过 MPText API 抓取
- 📝 **知乎** - 抓取知乎文章和回答 (开发中)
- 📡 **RSS 订阅** - 支持标准 RSS/Atom 订阅源 (开发中)

### 技术亮点
- **每日简报自动生成** - 定时抓取 + AI 锚点提取 + 简报合成
- **显式 + 隐式反馈** - Show/Hide 按钮 + 行为信号驱动权重更新
- **实时权重调整** - 基于信号衰减和多样性惩罚的自适应算法
- **双语 UI 基础设施** - 内置 `I18nProvider/useI18n/t()`，覆盖核心页面与导航文案

## 双语 UI（中文 / English）

- 语言切换入口：顶部导航栏右侧 `中 / EN` 按钮
- 切换机制：前端 `I18nProvider` + 词典映射（`frontend/src/i18n/`）
- 持久化策略：写入 `localStorage` 的 `mindflow.locale`
- 默认策略：优先读取已保存语言；若无保存值，则根据浏览器语言自动选择（`zh-*` -> 中文，否则英文）
- 当前范围：导航壳层、Now、Daily Digest、Interests、Sources、Settings 等页面静态文案
- 约束说明：产品 Logo `MindFlow` 保持不翻译

## 技术栈

- **后端**: FastAPI + SQLAlchemy + PostgreSQL + APScheduler
- **前端**: React + TypeScript + TailwindCSS
- **AI**: OpenAI 兼容接口 (硅基流动 / MiniMax)

## Docker 一键部署（推荐）

### 1. 配置环境变量

在项目根目录创建 `.env`（供 `docker compose` 读取）：

```bash
cat > .env <<'EOF'
POSTGRES_PASSWORD=change_me
SILICONFLOW_API_KEY=
MPTEXT_API_KEY=
AI_BASE_URL=https://api.siliconflow.cn/v1
AI_MODEL=Qwen/Qwen2.5-7B-Instruct
MPTEXT_BASE_URL=https://down.mptext.top
EOF
```

### 2. 启动服务

```bash
docker compose up -d --build
```

后端启动时会自动执行 `alembic upgrade head` 迁移。

### 3. 验证

```bash
docker compose ps
curl http://localhost:8000/health
curl http://localhost:5173/api/interests/tags
curl "http://localhost:8000/api/now?limit=5"
```

健康接口期望返回：

```json
{"status":"healthy","database":"up"}
```

前端经由 nginx 反向代理同源访问后端 API，因此 `http://localhost:5173/api/*` 也应返回 JSON，而不是 `index.html`。

### 4. 访问

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs
- 前端主入口:
  - http://localhost:5173/daily-digest
  - http://localhost:5173/now


### 5. 数据持久化

PostgreSQL 数据保存在 Docker 命名卷 `postgres-data`（不是 `./data` 目录）。

## 快速开始

### 1. 克隆并安装依赖

```bash
cd backend
pip install -r requirements.txt

cd ../frontend
npm install
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入数据库和 API 配置
```

### 3. 启动服务

```bash
# 终端 0: 启动 PostgreSQL（本地开发建议）
docker compose up -d postgres

# 终端 1: 启动后端
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# 终端 2: 启动前端
cd frontend
npm run dev
```

### 4. 访问

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

## 配置说明

### AI API 配置

在「设置 → AI 配置」页面配置：

| 供应商 | 端点 | 推荐模型 |
|--------|------|----------|
| 硅基流动 | https://api.siliconflow.cn/v1 | Qwen/Qwen2.5-7B-Instruct |
| MiniMax | https://api.minimax.chat/v1 | MiniMax-Text-01 |

### 微信公众号配置

1. 从 https://down.mptext.top/ 获取 API Key
2. 在「设置 → AI 配置」填入 `MPTEXT_API_KEY`

### 信息源管理

1. 进入「新闻源」页面
2. 点击「添加新闻源」
3. 选择类型（微信公众号）
4. 填写配置信息并保存
5. 系统将自动定时抓取最新文章

## 项目结构

```
ai-crawler/
├── backend/
│   ├── main.py              # FastAPI 入口
│   ├── database.py          # PostgreSQL / SQLAlchemy 异步数据访问
│   ├── models.py            # SQLAlchemy ORM 模型
│   ├── schemas.py           # Pydantic 数据模型
│   ├── alembic/             # 数据库迁移版本管理
│   ├── routers/             # API 路由
│   │   ├── articles.py      # 文章管理
│   │   ├── sources.py        # 信息源管理
│   │   ├── digests.py       # 简报生成
│   │   ├── now.py           # Now 工作台
│   │   ├── interests.py     # 兴趣标签
│   │   ├── behavior.py      # 行为日志
│   │   └── config.py        # 系统配置
│   ├── services/
│   │   ├── ai.py            # AI 调用服务
│   │   ├── crawler.py       # 爬虫服务
│   │   ├── now.py           # Now 排序/详情/状态服务
│   │   ├── scheduler.py      # 定时任务
│   │   └── learning.py       # 权重学习算法
│   └── tests/               # 后端测试
│       ├── test_articles.py
│       ├── test_config.py
│       ├── test_database.py
│       ├── test_digests.py
│       ├── test_full_flow.py
│       ├── test_main.py
│       └── test_sources.py
├── frontend/
│   └── src/
│       ├── pages/            # 页面组件
│       │   ├── Newsletter.tsx      # Daily Digest
│       │   ├── Now.tsx             # Now 工作台
│       │   ├── Sources.tsx         # 新闻源管理
│       │   ├── Settings.tsx        # 系统设置
│       │   └── InterestSettings.tsx  # 兴趣设置
│       ├── components/       # 通用组件
│       │   ├── InsightCard.tsx     # 洞察卡片
│       │   └── InterestTagItem.tsx # 兴趣标签项
│       │   └── now/                # Now 工作台组件
│       ├── hooks/
│       │   └── useBehaviorCollector.ts  # 行为收集
│       └── api/
│           └── newsletter.ts  # API 客户端
├── data/                     # 历史 SQLite 数据（迁移用，可选）
└── docs/                     # 设计文档和规格
```

## 开发

### 运行测试

```bash
docker start mindflow-postgres || true

cd backend
source .venv/bin/activate
POSTGRES_PASSWORD=mindflow_dev alembic upgrade head
POSTGRES_PASSWORD=mindflow_dev pytest tests/test_now_api.py tests/test_articles.py tests/test_digests.py tests/test_main.py tests/test_sources.py tests/test_config.py tests/test_full_flow.py -q
```

说明：
- `tests/test_database.py` 目前依赖 `pytest_asyncio`；如果本地环境未安装该包，该文件不会作为默认验证集合的一部分。

### 构建前端

```bash
cd frontend
npm run build
```

### Docker 联调快速检查

```bash
docker compose up -d --build
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:5173/api/interests/tags
curl "http://127.0.0.1:8000/api/now?limit=5"
```

## 致谢

本项目基于 [wechat-article-exporter](https://github.com/wechat-article/wechat-article-exporter) 提供的公网接口服务进行二次封装，感谢原作者的贡献。

## 免责声明

本项目仅供学习交流使用，请勿用于任何商业目的。如需商业使用，请联系作者获得授权。

## License

MIT
