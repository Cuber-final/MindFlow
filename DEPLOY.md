# MindFlow Docker 部署指南

适用于本地或内网环境（`localhost`）。

当前版本使用：
- `PostgreSQL (pgvector)` 作为后端数据库
- `docker compose` 编排
- 后端启动时自动执行 `alembic upgrade head` 数据库迁移

## 前置条件

1. 已安装并启动 Docker Desktop（或 Docker Engine）
2. 当前目录为项目根目录（含 `docker-compose.yml`）

## 快速部署

### 1. 克隆项目

```bash
git clone https://github.com/Cuber-final/MindFlow.git
cd MindFlow
```

### 2. 配置环境变量（推荐）

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

说明：
- `POSTGRES_PASSWORD` 建议务必设置为非默认值
- 若暂不使用抓取/AI，可先留空 API Key

### 3. 启动服务

```bash
docker compose up -d --build
```

启动流程中，后端会自动：
1. 检测并处理历史 schema 状态
2. 执行 `alembic upgrade head`
3. 启动 API 服务

### 4. 验证服务

```bash
docker compose ps
```

期望看到：
- `postgres` 为 `healthy`
- `backend` 为 `healthy`
- `frontend` 为 `Up`

可进一步检查健康接口：

```bash
curl http://localhost:8000/health
```

期望返回示例：

```json
{"status":"healthy","database":"up"}
```

### 5. 访问地址

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

## 日常运维

### 查看日志

```bash
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f frontend
```

### 停止服务

```bash
docker compose down
```

### 重建后端（代码更新后）

```bash
docker compose up -d --build backend
```

## 数据持久化说明

PostgreSQL 数据持久化在命名卷 `postgres-data` 中（非 `./data` 目录）。

查看卷：

```bash
docker volume ls | grep postgres-data
```

## 清理

### 仅删除容器/网络（保留数据库数据）

```bash
docker compose down
```

### 连同数据库数据一起删除（危险）

```bash
docker compose down -v
```

### 删除本项目镜像

```bash
docker image rm ai-crawler-backend ai-crawler-frontend
```

## 常见问题

### 1) backend 一直重启

先看日志：

```bash
docker compose logs --tail=200 backend
```

常见原因：
- `POSTGRES_PASSWORD` 与已有数据库卷中的密码不一致
- PostgreSQL 尚未就绪
- 本地曾手动改过数据库 schema

### 2) 修改了 `POSTGRES_PASSWORD` 后无法连接数据库

如果已经存在旧卷，需保持密码一致，或清空数据重建：

```bash
docker compose down -v
docker compose up -d --build
```

### 3) 首次迁移历史 SQLite 数据

仓库提供了迁移脚本：`backend/migrations/export_sqlite_to_postgres.py`。
建议在备份后执行，并先确保 PostgreSQL 服务可用。
