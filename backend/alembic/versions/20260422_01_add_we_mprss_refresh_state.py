"""add we-mp-rss article refresh state

Revision ID: 20260422_01
Revises: 20260420_01
Create Date: 2026-04-22 01:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260422_01"
down_revision = "20260420_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("articles", sa.Column("content_html", sa.Text(), nullable=False, server_default=""))
    op.add_column(
        "articles",
        sa.Column("content_refresh_status", sa.String(), nullable=False, server_default="ready"),
    )
    op.add_column("articles", sa.Column("content_refresh_task_id", sa.String(), nullable=True))
    op.add_column("articles", sa.Column("content_refresh_requested_at", sa.DateTime(), nullable=True))
    op.add_column("articles", sa.Column("content_refresh_checked_at", sa.DateTime(), nullable=True))
    op.add_column("articles", sa.Column("content_refreshed_at", sa.DateTime(), nullable=True))
    op.add_column("articles", sa.Column("content_refresh_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("articles", "content_refresh_error")
    op.drop_column("articles", "content_refreshed_at")
    op.drop_column("articles", "content_refresh_checked_at")
    op.drop_column("articles", "content_refresh_requested_at")
    op.drop_column("articles", "content_refresh_task_id")
    op.drop_column("articles", "content_refresh_status")
    op.drop_column("articles", "content_html")
