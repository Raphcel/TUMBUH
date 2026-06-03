"""merge_company_reviews_and_organizations_heads

Revision ID: c9e3a7d2f1b4
Revises: a7f72d0571fc, b4e3d2c1a9f8
Create Date: 2026-06-03 23:30:00.000000
"""

from typing import Sequence, Union


revision: str = "c9e3a7d2f1b4"
down_revision: Union[str, tuple[str, str], None] = (
    "a7f72d0571fc",
    "b4e3d2c1a9f8",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
