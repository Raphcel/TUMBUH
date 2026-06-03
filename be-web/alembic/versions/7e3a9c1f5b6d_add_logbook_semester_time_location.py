"""add_logbook_semester_time_location

Revision ID: 7e3a9c1f5b6d
Revises: 1d4f7a8c9b2e
Create Date: 2026-06-01 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7e3a9c1f5b6d"
down_revision: Union[str, None] = "1d4f7a8c9b2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("internship_logbooks", sa.Column("semester", sa.String(length=100), nullable=True))
    with op.batch_alter_table("logbook_entries") as batch_op:
        batch_op.add_column(sa.Column("start_time", sa.Time(), nullable=True))
        batch_op.add_column(sa.Column("end_time", sa.Time(), nullable=True))
        batch_op.add_column(sa.Column("location", sa.String(length=255), nullable=True))
        batch_op.create_check_constraint(
            "ck_logbook_entries_time_range",
            "start_time IS NULL OR end_time IS NULL OR end_time > start_time",
        )


def downgrade() -> None:
    with op.batch_alter_table("logbook_entries") as batch_op:
        batch_op.drop_constraint("ck_logbook_entries_time_range", type_="check")
        batch_op.drop_column("location")
        batch_op.drop_column("end_time")
        batch_op.drop_column("start_time")
    op.drop_column("internship_logbooks", "semester")
