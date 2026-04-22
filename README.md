# MindFlow

> 面向个人与小团队的私有化 AI 信息工作台，把“收集”变成“编排、判断与处理”。

MindFlow 不是另一个只会堆时间线的资讯阅读器。它把信息消费拆成两个更符合实际工作的入口：

- `Daily Digest` 用来回答“今天最值得先看什么”
- `Now` Workbench 用来回答“接下来 24-48 小时我还要处理什么”

项目强调自托管、可替换模型、可控信息源，以及围绕兴趣偏好与行为反馈的持续调优能力，适合需要长期追踪行业、技术或主题信号的使用场景。

## 产品价值

- **从信息堆积转向信息编排**
  - Daily Digest 负责把当天值得先看的内容做成结构化入口，而不是把所有抓取结果原样堆给用户。
- **把“阅读”延伸到“待处理”**
  - Now Workbench 承接真正需要后续行动、继续判断或稍后再看的内容，避免看完即丢。
- **私有化可控**
  - 支持本地或内网部署，自主控制数据库、模型服务和信息源接入方式。
- **反馈可闭环**
  - 同时利用显式反馈和行为信号，对内容权重与推荐结果持续修正。

## 核心能力

- **Daily Digest**
  - 自动生成结构化每日简报，支持按日期与按周浏览。
- **Now Workbench**
  - 面向未来 24-48 小时仍值得处理的内容队列、详情与状态流转。
- **多源接入**
  - 支持原生 RSS / Atom / JSON Feed、RSSHub 路由，以及由 `we-mp-rss` 生成的 feed 地址。
- **AI 加工**
  - 支持通过 OpenAI 兼容接口完成摘要、洞察提取与内容编排。
- **兴趣与反馈机制**
  - 支持兴趣标签管理、内容负反馈与行为采集。
- **双语界面**
  - 内置中文 / English 静态 UI 切换与本地偏好持久化。

## 技术栈

- **后端**
  - FastAPI、SQLAlchemy Async、Alembic、PostgreSQL、pgvector、APScheduler、httpx
- **前端**
  - React 18、TypeScript、Vite、React Router、Tailwind CSS
- **AI 接入**
  - OpenAI 兼容接口，当前已覆盖硅基流动、MiniMax 等兼容服务
- **部署**
  - Docker Compose + Nginx 反向代理

## 快速开始

### Docker 部署

推荐先看部署文档：[docs/deploy.md](docs/deploy.md)

最短路径：

```bash
cat > .env <<'EOF'
POSTGRES_PASSWORD=change_me
SILICONFLOW_API_KEY=
AI_BASE_URL=https://api.siliconflow.cn/v1
AI_MODEL=Qwen/Qwen2.5-7B-Instruct
EOF

docker compose up -d --build
```

启动后可访问：

- 前端: `http://localhost:5173`
- 后端 API: `http://localhost:8000`
- OpenAPI 文档: `http://localhost:8000/docs`

### 本地开发

```bash
# 终端 1
docker compose up -d postgres

# 终端 2
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 终端 3
cd frontend
npm install
npm run dev
```

## 开发文档

- 部署说明：[docs/deploy.md](docs/deploy.md)
- 开发进度与计划回溯：[docs/development-history.md](docs/development-history.md)
- Superpowers 文档索引与时间线：[docs/superpowers/README.md](docs/superpowers/README.md)

README 保持面向开源项目访客的产品说明；阶段性进展、计划和执行记录统一沉淀到 `docs/`。

## 项目结构

```text
mindflow/
├── backend/    # FastAPI API、调度器、数据模型、迁移、测试
├── frontend/   # React + Vite 前端应用
├── docs/       # 部署说明、开发回溯、设计与计划文档
└── data/       # 历史数据或迁移辅助文件
```

## License

MIT
