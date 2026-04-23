"""add provider ids for we-mp-rss source and article sync

Revision ID: 20260423_01
Revises: 20260422_01
Create Date: 2026-04-23 13:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260423_01"
down_revision = "20260422_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("news_sources", sa.Column("provider_source_id", sa.String(), nullable=True))
    op.add_column("articles", sa.Column("provider_article_id", sa.String(), nullable=True))
    op.create_index(
        "idx_articles_source_provider_article",
        "articles",
        ["source_id", "provider_article_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_articles_source_provider_article", table_name="articles")
    op.drop_column("articles", "provider_article_id")
    op.drop_column("news_sources", "provider_source_id")
