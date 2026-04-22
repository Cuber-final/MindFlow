# MindFlow Docker 一键部署方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan.

**Goal:** 构建 Docker + Docker Compose 一键部署方案，用户运行 `docker-compose up -d` 即可启动完整服务。适用于内网 localhost 环境。

**Architecture:**
- 后端：Python FastAPI (端口 8000)
- 前端：Vite dev server (端口 5173)
- 数据库：SQLite (挂载 volume 持久化)

**Tech Stack:** Docker, Docker Compose, Python, Node.js

---

## 文件结构

```
ai-crawler/
├── docker-compose.yml      # Docker Compose 编排配置
├── Dockerfile.backend     # 后端镜像构建
├── Dockerfile.frontend   # 前端镜像构建
├── .env.example           # 环境变量模板
└── scripts/
    └── init.sh           # 初始化脚本
```

---

## Task 1: 创建后端 Dockerfile

**Files:**
- Create: `Dockerfile.backend`

- [ ] **Step 1: 创建 Dockerfile.backend**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile.backend
git commit -m "feat: add backend Dockerfile"
```

---

## Task 2: 创建前端 Dockerfile

**Files:**
- Create: `Dockerfile.frontend`

- [ ] **Step 1: 创建 Dockerfile.frontend**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制 package 文件
COPY frontend/package.json frontend/package-lock.json ./

# 安装依赖
RUN npm ci

# 复制前端源码
COPY frontend/ ./

# 暴露端口
EXPOSE 5173

# 启动命令
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile.frontend
git commit -m "feat: add frontend Dockerfile"
```

---

## Task 3: 创建 Docker Compose 配置

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: 创建 docker-compose.yml**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: mindflow-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - SILICONFLOW_API_KEY=${SILICONFLOW_API_KEY:-}
      - AI_BASE_URL=${AI_BASE_URL:-https://api.siliconflow.cn/v1}
      - AI_MODEL=${AI_MODEL:-Qwen/Qwen2.5-7B-Instruct}
      - MPTEXT_API_KEY=${MPTEXT_API_KEY:-}
      - MPTEXT_BASE_URL=${MPTEXT_BASE_URL:-https://down.mptext.top}
    volumes:
      - ./data:/app/data
      - ./backend/.env:/app/.env:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: mindflow-frontend
    restart: unless-stopped
    ports:
      - "5173:5173"
    depends_on:
      - backend

networks:
  default:
    name: mindflow-network
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Docker Compose orchestration"
```

---

## Task 4: 更新 .env.example

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: 更新 .env.example**

```env
# AI API 配置
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
AI_BASE_URL=https://api.siliconflow.cn/v1
AI_MODEL=Qwen/Qwen2.5-7B-Instruct

# MPText API (微信公众号爬取)
MPTEXT_API_KEY=your_mptext_api_key_here
MPTEXT_BASE_URL=https://down.mptext.top
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "docs: update .env.example for Docker deployment"
```

---

## Task 5: 创建部署文档

**Files:**
- Create: `DEPLOY.md`

- [ ] **Step 1: 创建 DEPLOY.md**

```markdown
# MindFlow Docker 部署指南

适用于内网 localhost 环境

## 快速部署

### 1. 克隆项目

```bash
git clone https://github.com/Cuber-final/MindFlow.git
cd MindFlow
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入你的 API Key
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 访问

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

## 停止服务

```bash
docker-compose down
```

## 数据持久化

SQLite 数据库保存在 `./data` 目录。

## 清理

```bash
# 停止并删除容器
docker-compose down

# 删除镜像
docker-compose rm
```
```

- [ ] **Step 2: Commit**

```bash
git add DEPLOY.md
git commit -m "docs: add Docker deployment guide"
```

---

## Task 6: 验证 Docker 构建

- [ ] **Step 1: 构建镜像**

```bash
docker-compose build
```

Expected: 两个镜像构建成功 (mindflow-backend, mindflow-frontend)

- [ ] **Step 2: 启动服务**

```bash
docker-compose up -d
```

- [ ] **Step 3: 验证服务**

```bash
curl http://localhost:8000/health
curl http://localhost:5173
```

- [ ] **Step 4: 停止服务**

```bash
docker-compose down
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete Docker deployment setup"
```

---

## 验收标准

- [ ] `docker-compose build` 成功构建两个镜像
- [ ] `docker-compose up -d` 成功启动服务
- [ ] http://localhost:5173 返回前端页面
- [ ] http://localhost:8000/health 返回 OK
- [ ] `docker-compose down` 正常停止服务
- [ ] 所有文件已提交并推送
```
