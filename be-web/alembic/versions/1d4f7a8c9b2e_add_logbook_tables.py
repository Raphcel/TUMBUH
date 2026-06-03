"""add_logbook_tables

Revision ID: 1d4f7a8c9b2e
Revises: f2d4b6c8a9e1
Create Date: 2026-06-01 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1d4f7a8c9b2e"
down_revision: Union[str, None] = "f2d4b6c8a9e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "internship_logbooks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("role", sa.String(length=200), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("mentor_name", sa.String(length=200), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("target_hours", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("target_hours IS NULL OR target_hours > 0", name="ck_logbooks_target_hours_positive"),
        sa.CheckConstraint("start_date IS NULL OR end_date IS NULL OR end_date >= start_date", name="ck_logbooks_date_range"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id"),
    )
    op.create_index(op.f("ix_internship_logbooks_id"), "internship_logbooks", ["id"], unique=False)
    op.create_index(op.f("ix_internship_logbooks_student_id"), "internship_logbooks", ["student_id"], unique=False)
    op.create_index(op.f("ix_internship_logbooks_application_id"), "internship_logbooks", ["application_id"], unique=False)

    op.create_table(
        "logbook_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("logbook_id", sa.Integer(), nullable=False),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("hours", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("hours > 0", name="ck_logbook_entries_hours_positive"),
        sa.ForeignKeyConstraint(["logbook_id"], ["internship_logbooks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_logbook_entries_id"), "logbook_entries", ["id"], unique=False)
    op.create_index(op.f("ix_logbook_entries_logbook_id"), "logbook_entries", ["logbook_id"], unique=False)
    op.create_index(op.f("ix_logbook_entries_activity_date"), "logbook_entries", ["activity_date"], unique=False)

    op.create_table(
        "logbook_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("entry_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["entry_id"], ["logbook_entries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_logbook_attachments_id"), "logbook_attachments", ["id"], unique=False)
    op.create_index(op.f("ix_logbook_attachments_entry_id"), "logbook_attachments", ["entry_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_logbook_attachments_entry_id"), table_name="logbook_attachments")
    op.drop_index(op.f("ix_logbook_attachments_id"), table_name="logbook_attachments")
    op.drop_table("logbook_attachments")

    op.drop_index(op.f("ix_logbook_entries_activity_date"), table_name="logbook_entries")
    op.drop_index(op.f("ix_logbook_entries_logbook_id"), table_name="logbook_entries")
    op.drop_index(op.f("ix_logbook_entries_id"), table_name="logbook_entries")
    op.drop_table("logbook_entries")

    op.drop_index(op.f("ix_internship_logbooks_application_id"), table_name="internship_logbooks")
    op.drop_index(op.f("ix_internship_logbooks_student_id"), table_name="internship_logbooks")
    op.drop_index(op.f("ix_internship_logbooks_id"), table_name="internship_logbooks")
    op.drop_table("internship_logbooks")
