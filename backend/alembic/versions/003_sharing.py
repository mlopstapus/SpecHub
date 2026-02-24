"""Add prompt_shares and workflow_shares tables for user-to-user sharing.

Revision ID: 003
Revises: 002
Create Date: 2026-02-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prompt_shares",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prompt_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["prompt_id"], ["prompts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("prompt_id", "user_id"),
    )
    op.create_index("idx_prompt_shares_prompt_id", "prompt_shares", ["prompt_id"])
    op.create_index("idx_prompt_shares_user_id", "prompt_shares", ["user_id"])

    op.create_table(
        "workflow_shares",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workflow_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("workflow_id", "user_id"),
    )
    op.create_index("idx_workflow_shares_workflow_id", "workflow_shares", ["workflow_id"])
    op.create_index("idx_workflow_shares_user_id", "workflow_shares", ["user_id"])


def downgrade() -> None:
    op.drop_table("workflow_shares")
    op.drop_table("prompt_shares")
