"""add_password_reset_tokens

Revision ID: a9d4e6f1c2b3
Revises: c9e3a7d2f1b4
Create Date: 2026-06-04 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "a9d4e6f1c2b3"
down_revision: str | None = "c9e3a7d2f1b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_reset_token_hash", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("password_reset_sent_at", sa.DateTime(), nullable=True))
    op.create_index(
        op.f("ix_users_password_reset_token_hash"),
        "users",
        ["password_reset_token_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_password_reset_token_hash"), table_name="users")
    op.drop_column("users", "password_reset_sent_at")
    op.drop_column("users", "password_reset_token_hash")
