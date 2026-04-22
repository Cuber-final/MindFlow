# MindFlow Docker 部署指南

适用于本地或内网环境的单机部署。

当前仓库的 Docker 部署以 `docker-compose.yml` 为准，实际编排包含：

- `postgres`
  - `pgvector/pgvector:pg16`
- `backend`
  - FastAPI API，启动时自动执行数据库迁移
- `frontend`
  - Nginx 托管前端静态资源，并反向代理 `/api` 到后端

## 前置条件

1. 已安装 Docker Desktop 或 Docker Engine
2. 当前目录为项目根目录

## 快速部署

### 1. 获取代码

```bash
git clone <your-fork-or-repo-url>
cd MindFlow
```

### 2. 配置 `.env`

在项目根目录创建 `.env`，供 `docker compose` 读取：

```bash
cat > .env <<'EOF'
POSTGRES_PASSWORD=change_me
SILICONFLOW_API_KEY=
AI_BASE_URL=https://api.siliconflow.cn/v1
AI_MODEL=Qwen/Qwen2.5-7B-Instruct
EOF
```

说明：

- `POSTGRES_PASSWORD` 建议修改为非默认值
- `SILICONFLOW_API_KEY` 可暂时留空，但 AI 生成链路会不可用
- `AI_BASE_URL` 和 `AI_MODEL` 使用 OpenAI 兼容接口约定，可替换为你自己的兼容服务
- 当前 Docker 部署不再使用历史的 `MPTEXT_*` 环境变量

### 3. 启动服务

```bash
docker compose up -d --build
```

后端容器启动时会自动：

1. 等待 PostgreSQL 就绪
2. 执行 `alembic upgrade head`
3. 启动 FastAPI 服务

### 4. 验证服务

```bash
docker compose ps
curl http://localhost:8000/health
curl http://localhost:5173/api/interests/tags
curl "http://localhost:8000/api/now?limit=5"
```

预期：

- `postgres` 为 `healthy`
- `backend` 为 `healthy`
- `frontend` 为 `Up`
- `GET /health` 返回：

```json
{"status":"healthy","database":"up"}
```

说明：

- 前端通过 Nginx 同源代理访问后端，因此 `http://localhost:5173/api/*` 应直接返回 JSON，而不是 `index.html`

### 5. 访问地址

- 前端首页：`http://localhost:5173`
- Daily Digest：`http://localhost:5173/daily-digest`
- Now Workbench：`http://localhost:5173/now`
- 后端 API：`http://localhost:8000`
- OpenAPI 文档：`http://localhost:8000/docs`

## 可选配置

### We-MP-RSS 源接入

如果需要接入 `we-mp-rss` 生成的 feed：

1. 先自行部署并确认对应 `/feed/...` 地址可访问
2. 在 MindFlow 的 `Sources` 页面添加该 feed
3. 如该服务开启鉴权，在 Sources 表单内填写用户名和密码

当前版本不要求通过 Docker 环境变量注入 `we-mp-rss` 凭证。

## 日常运维

### 查看日志

```bash
docker compose logs -f postgres
docker compose logs -f backend
docker compose logs -f frontend
```

### 停止服务

```bash
docker compose down
```

### 重建指定服务

```bash
docker compose up -d --build backend
docker compose up -d --build frontend
```

## 数据持久化

- PostgreSQL 数据保存在命名卷 `postgres-data`
- 数据不会写入项目根目录下的 `data/` 文件夹

查看卷：

```bash
docker volume ls | grep postgres-data
```

## 清理

### 仅删除容器和网络

```bash
docker compose down
```

### 连同数据库卷一起删除

```bash
docker compose down -v
```

### 删除构建镜像

```bash
docker image rm mindflow-backend mindflow-frontend
```

## 常见问题

### backend 持续重启

先看日志：

```bash
docker compose logs --tail=200 backend
```

常见原因：

- `POSTGRES_PASSWORD` 与已有数据库卷中的密码不一致
- PostgreSQL 尚未 ready
- 本地保留了不兼容的历史数据库状态

### 修改 `POSTGRES_PASSWORD` 后无法连接数据库

如果已经有旧卷，需继续使用原密码，或清空数据卷后重建：

```bash
docker compose down -v
docker compose up -d --build
```

### AI 相关功能不可用

优先检查：

- `.env` 中是否配置了有效的 `SILICONFLOW_API_KEY`
- `AI_BASE_URL` 是否指向可用的 OpenAI 兼容接口
- `AI_MODEL` 是否是目标服务支持的模型名

### 首次迁移历史 SQLite 数据

仓库保留了迁移脚本：

```text
backend/migrations/export_sqlite_to_postgres.py
```

建议在备份后执行，并先确保 PostgreSQL 服务可用。
