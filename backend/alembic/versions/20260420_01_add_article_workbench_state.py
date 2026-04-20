"""add article workbench state

Revision ID: 20260420_01
Revises: 72af35b254e0
Create Date: 2026-04-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260420_01"
down_revision = "72af35b254e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("articles", sa.Column("read_at", sa.DateTime(), nullable=True))
    op.add_column("articles", sa.Column("processed_at", sa.DateTime(), nullable=True))
    op.add_column("articles", sa.Column("last_opened_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("articles", "last_opened_at")
    op.drop_column("articles", "processed_at")
    op.drop_column("articles", "read_at")
