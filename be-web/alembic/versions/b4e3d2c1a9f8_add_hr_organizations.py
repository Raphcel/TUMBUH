"""add_hr_organizations

Revision ID: b4e3d2c1a9f8
Revises: 7e3a9c1f5b6d
Create Date: 2026-06-03 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b4e3d2c1a9f8"
down_revision: Union[str, tuple[str, str], None] = "7e3a9c1f5b6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


company_status = postgresql.ENUM("PENDING", "APPROVED", "REJECTED", name="companystatus", create_type=False)
member_role = postgresql.ENUM("OWNER", "ADMIN", "RECRUITER", "VIEWER", name="organizationmemberrole", create_type=False)
member_status = postgresql.ENUM("PENDING", "ACTIVE", "REVOKED", name="organizationmemberstatus", create_type=False)
invite_status = postgresql.ENUM("PENDING", "ACCEPTED", "REVOKED", "EXPIRED", name="organizationinvitestatus", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    company_status.create(bind, checkfirst=True)
    member_role.create(bind, checkfirst=True)
    member_status.create(bind, checkfirst=True)
    invite_status.create(bind, checkfirst=True)

    op.add_column(
        "companies",
        sa.Column(
            "status",
            company_status,
            nullable=False,
            server_default="APPROVED",
        ),
    )
    op.create_index("ix_companies_status", "companies", ["status"])

    op.create_table(
        "organization_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", member_role, nullable=False),
        sa.Column("status", member_status, nullable=False, server_default="PENDING"),
        sa.Column("permissions", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "user_id", name="uq_organization_member_company_user"),
    )
    op.create_index("ix_organization_members_company_id", "organization_members", ["company_id"])
    op.create_index("ix_organization_members_id", "organization_members", ["id"])
    op.create_index("ix_organization_members_status", "organization_members", ["status"])
    op.create_index("ix_organization_members_user_id", "organization_members", ["user_id"])

    op.create_table(
        "organization_invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("role", member_role, nullable=False),
        sa.Column("permissions", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("status", invite_status, nullable=False, server_default="PENDING"),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("accepted_by_user_id", sa.Integer(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("is_email_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["accepted_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organization_invites_company_id", "organization_invites", ["company_id"])
    op.create_index("ix_organization_invites_email", "organization_invites", ["email"])
    op.create_index("ix_organization_invites_id", "organization_invites", ["id"])
    op.create_index("ix_organization_invites_status", "organization_invites", ["status"])
    op.create_index("ix_organization_invites_token_hash", "organization_invites", ["token_hash"], unique=True)

    op.add_column("opportunities", sa.Column("created_by_user_id", sa.Integer(), nullable=True))
    op.create_index("ix_opportunities_created_by_user_id", "opportunities", ["created_by_user_id"])
    op.create_foreign_key(
        "fk_opportunities_created_by_user_id_users",
        "opportunities",
        "users",
        ["created_by_user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_opportunities_created_by_user_id_users", "opportunities", type_="foreignkey")
    op.drop_index("ix_opportunities_created_by_user_id", table_name="opportunities")
    op.drop_column("opportunities", "created_by_user_id")

    op.drop_index("ix_organization_invites_token_hash", table_name="organization_invites")
    op.drop_index("ix_organization_invites_status", table_name="organization_invites")
    op.drop_index("ix_organization_invites_id", table_name="organization_invites")
    op.drop_index("ix_organization_invites_email", table_name="organization_invites")
    op.drop_index("ix_organization_invites_company_id", table_name="organization_invites")
    op.drop_table("organization_invites")

    op.drop_index("ix_organization_members_user_id", table_name="organization_members")
    op.drop_index("ix_organization_members_status", table_name="organization_members")
    op.drop_index("ix_organization_members_id", table_name="organization_members")
    op.drop_index("ix_organization_members_company_id", table_name="organization_members")
    op.drop_table("organization_members")

    op.drop_index("ix_companies_status", table_name="companies")
    op.drop_column("companies", "status")

    bind = op.get_bind()
    invite_status.drop(bind, checkfirst=True)
    member_status.drop(bind, checkfirst=True)
    member_role.drop(bind, checkfirst=True)
    company_status.drop(bind, checkfirst=True)
