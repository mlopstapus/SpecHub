"""Initial schema: prompts and prompt_versions tables.

Revision ID: 001
Revises: None
Create Date: 2026-02-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prompts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_deprecated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "prompt_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prompt_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("system_template", sa.Text(), nullable=True),
        sa.Column("user_template", sa.Text(), nullable=False),
        sa.Column("input_schema", sa.JSON(), nullable=True, server_default="{}"),
        sa.Column("tags", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["prompt_id"], ["prompts.id"]),
        sa.UniqueConstraint("prompt_id", "version"),
    )
    op.create_index("idx_prompt_versions_prompt_id", "prompt_versions", ["prompt_id"])


def downgrade() -> None:
    op.drop_index("idx_prompt_versions_prompt_id", table_name="prompt_versions")
    op.drop_table("prompt_versions")
    op.drop_table("prompts")
