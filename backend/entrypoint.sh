#!/bin/sh
set -eu

cd /app/backend

STAMP_FLAG="/tmp/alembic_stamp_head"

python - <<'PY'
import os
import psycopg2

host = os.getenv("POSTGRES_HOST", "localhost")
port = os.getenv("POSTGRES_PORT", "5432")
db = os.getenv("POSTGRES_DB", "mindflow")
user = os.getenv("POSTGRES_USER", "mindflow")
password = os.getenv("POSTGRES_PASSWORD", "")

conn = psycopg2.connect(
    host=host,
    port=port,
    dbname=db,
    user=user,
    password=password,
)
try:
    with conn.cursor() as cur:
        def table_exists(table_name: str) -> bool:
            cur.execute("SELECT to_regclass(%s)", (f"public.{table_name}",))
            return cur.fetchone()[0] is not None

        has_alembic_version = table_exists("alembic_version")
        has_existing_schema = any(
            table_exists(name) for name in ("ai_config", "news_sources", "articles")
        )

        if (not has_alembic_version) and has_existing_schema:
            with open("/tmp/alembic_stamp_head", "w", encoding="utf-8") as f:
                f.write("1")
finally:
    conn.close()
PY

if [ -f "$STAMP_FLAG" ]; then
  echo "[entrypoint] Existing schema detected without Alembic history, stamping head..."
  alembic stamp head
  rm -f "$STAMP_FLAG"
fi

echo "[entrypoint] Running database migrations..."
alembic upgrade head

echo "[entrypoint] Starting API server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
