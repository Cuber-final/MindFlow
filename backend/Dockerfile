FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 先安装依赖以最大化利用缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 再复制后端源码，保持 /app/backend 目录结构兼容现有路径逻辑
COPY . ./backend

# 创建数据目录
RUN mkdir -p /app/data

ENV PYTHONPATH=/app/backend

# 暴露端口
EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
