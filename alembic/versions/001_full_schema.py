"""Full schema: teams, users, auth, prompts, projects, policies, objectives,
api_keys, workflows, invitations, prompt_usage.

Revision ID: 001
Create Date: 2026-02-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- teams ---
    op.create_table(
        "teams",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("parent_team_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        sa.ForeignKeyConstraint(["parent_team_id"], ["teams.id"]),
    )
    op.create_index("idx_teams_owner_id", "teams", ["owner_id"])
    op.create_index("idx_teams_parent_team_id", "teams", ["parent_team_id"])

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("email"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
    )
    op.create_index("idx_users_team_id", "users", ["team_id"])

    # Deferred FK: teams.owner_id -> users.id
    op.create_foreign_key("fk_teams_owner_id", "teams", "users", ["owner_id"], ["id"])

    # --- projects ---
    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("lead_user_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["lead_user_id"], ["users.id"]),
    )
    op.create_index("idx_projects_team_id", "projects", ["team_id"])
    op.create_index("idx_projects_lead_user_id", "projects", ["lead_user_id"])

    # --- project_members ---
    op.create_table(
        "project_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("project_id", "user_id"),
    )
    op.create_index("idx_project_members_project_id", "project_members", ["project_id"])
    op.create_index("idx_project_members_user_id", "project_members", ["user_id"])

    # --- policies ---
    op.create_table(
        "policies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "enforcement_type",
            sa.Enum("prepend", "append", "inject", "validate", name="enforcementtype"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
    )
    op.create_index("idx_policies_team_id", "policies", ["team_id"])
    op.create_index("idx_policies_project_id", "policies", ["project_id"])

    # --- objectives ---
    op.create_table(
        "objectives",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("parent_objective_id", sa.Uuid(), nullable=True),
        sa.Column("is_inherited", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["parent_objective_id"], ["objectives.id"]),
    )
    op.create_index("idx_objectives_team_id", "objectives", ["team_id"])
    op.create_index("idx_objectives_project_id", "objectives", ["project_id"])
    op.create_index("idx_objectives_user_id", "objectives", ["user_id"])
    op.create_index("idx_objectives_parent_id", "objectives", ["parent_objective_id"])

    # --- prompts ---
    op.create_table(
        "prompts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_deprecated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("active_version_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("idx_prompts_user_id", "prompts", ["user_id"])

    # --- prompt_versions ---
    op.create_table(
        "prompt_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prompt_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("system_template", sa.Text(), nullable=True),
        sa.Column("user_template", sa.Text(), nullable=False),
        sa.Column("input_schema", sa.JSON(), nullable=True, server_default="{}"),
        sa.Column("tags", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["prompt_id"], ["prompts.id"]),
        sa.UniqueConstraint("prompt_id", "version"),
    )
    op.create_index("idx_prompt_versions_prompt_id", "prompt_versions", ["prompt_id"])

    # Deferred FK: prompts.active_version_id -> prompt_versions.id
    op.create_foreign_key(
        "fk_prompts_active_version_id", "prompts", "prompt_versions",
        ["active_version_id"], ["id"],
    )

    # --- api_keys (user-scoped) ---
    op.create_table(
        "api_keys",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False),
        sa.Column("prefix", sa.String(16), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("idx_api_keys_user_id", "api_keys", ["user_id"])

    # --- workflows (user-scoped, optionally project-associated) ---
    op.create_table(
        "workflows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("steps", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
    )
    op.create_index("idx_workflows_user_id", "workflows", ["user_id"])
    op.create_index("idx_workflows_project_id", "workflows", ["project_id"])

    # --- invitations ---
    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("token", sa.String(255), nullable=False),
        sa.Column("invited_by_id", sa.Uuid(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["invited_by_id"], ["users.id"]),
    )
    op.create_index("idx_invitations_team_id", "invitations", ["team_id"])

    # --- prompt_usage ---
    op.create_table(
        "prompt_usage",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prompt_name", sa.String(255), nullable=False),
        sa.Column("prompt_version", sa.String(50), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_prompt_usage_prompt_name", "prompt_usage", ["prompt_name"])
    op.create_index("idx_prompt_usage_created_at", "prompt_usage", ["created_at"])


def downgrade() -> None:
    op.drop_table("prompt_usage")
    op.drop_table("invitations")
    op.drop_table("workflows")
    op.drop_table("api_keys")
    op.drop_constraint("fk_prompts_active_version_id", "prompts", type_="foreignkey")
    op.drop_table("prompt_versions")
    op.drop_table("prompts")
    op.drop_table("objectives")
    op.drop_table("policies")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_constraint("fk_teams_owner_id", "teams", type_="foreignkey")
    op.drop_table("users")
    op.drop_table("teams")
    sa.Enum(name="enforcementtype").drop(op.get_bind())
