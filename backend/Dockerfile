FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV POETRY_VERSION=2.3.2
ENV POETRY_NO_INTERACTION=1
ENV POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app/backend

RUN pip install --no-cache-dir "poetry==${POETRY_VERSION}"

# 先安装依赖以最大化利用缓存
COPY pyproject.toml poetry.toml ./
RUN poetry install --only main --no-root

# 再复制后端源码
COPY . .

ENV PYTHONPATH=/app/backend

# 暴露端口
EXPOSE 8000

CMD ["sh", "/app/backend/entrypoint.sh"]
