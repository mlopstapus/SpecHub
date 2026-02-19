"""Add teams hierarchy: teams, users, policies, objectives, project_members.

Revision ID: 002
Revises: 001
Create Date: 2026-02-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
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
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("email"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
    )
    op.create_index("idx_users_team_id", "users", ["team_id"])

    # Now add the deferred FK from teams.owner_id -> users.id
    op.create_foreign_key(
        "fk_teams_owner_id", "teams", "users", ["owner_id"], ["id"]
    )

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
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
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
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
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

    # --- project_members ---
    op.create_table(
        "project_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("project_id", "user_id"),
    )
    op.create_index("idx_project_members_project_id", "project_members", ["project_id"])
    op.create_index("idx_project_members_user_id", "project_members", ["user_id"])

    # --- Modify existing tables ---

    # projects: add team_id, lead_user_id (nullable for migration)
    op.add_column("projects", sa.Column("team_id", sa.Uuid(), nullable=True))
    op.add_column("projects", sa.Column("lead_user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_projects_team_id", "projects", "teams", ["team_id"], ["id"])
    op.create_foreign_key("fk_projects_lead_user_id", "projects", "users", ["lead_user_id"], ["id"])
    op.create_index("idx_projects_team_id", "projects", ["team_id"])
    op.create_index("idx_projects_lead_user_id", "projects", ["lead_user_id"])

    # prompts: add user_id, drop project_id
    op.add_column("prompts", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_prompts_user_id", "prompts", "users", ["user_id"], ["id"])
    op.create_index("idx_prompts_user_id", "prompts", ["user_id"])
    op.drop_constraint("prompts_project_id_fkey", "prompts", type_="foreignkey")
    op.drop_index("ix_prompts_project_id", table_name="prompts")
    op.drop_column("prompts", "project_id")

    # workflows: replace project_id requirement with user_id + optional project_id
    op.add_column("workflows", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_workflows_user_id", "workflows", "users", ["user_id"], ["id"])
    op.create_index("idx_workflows_user_id", "workflows", ["user_id"])
    # Make project_id nullable
    op.alter_column("workflows", "project_id", nullable=True)

    # api_keys: replace project_id with user_id
    op.add_column("api_keys", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_api_keys_user_id", "api_keys", "users", ["user_id"], ["id"])
    op.create_index("idx_api_keys_user_id", "api_keys", ["user_id"])
    op.drop_constraint("api_keys_project_id_fkey", "api_keys", type_="foreignkey")
    op.drop_index("ix_api_keys_project_id", table_name="api_keys")
    op.drop_column("api_keys", "project_id")


def downgrade() -> None:
    # api_keys: restore project_id
    op.add_column("api_keys", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("api_keys_project_id_fkey", "api_keys", "projects", ["project_id"], ["id"])
    op.create_index("ix_api_keys_project_id", "api_keys", ["project_id"])
    op.drop_index("idx_api_keys_user_id", table_name="api_keys")
    op.drop_constraint("fk_api_keys_user_id", "api_keys", type_="foreignkey")
    op.drop_column("api_keys", "user_id")

    # workflows: restore project_id as required, drop user_id
    op.alter_column("workflows", "project_id", nullable=False)
    op.drop_index("idx_workflows_user_id", table_name="workflows")
    op.drop_constraint("fk_workflows_user_id", "workflows", type_="foreignkey")
    op.drop_column("workflows", "user_id")

    # prompts: restore project_id, drop user_id
    op.add_column("prompts", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("prompts_project_id_fkey", "prompts", "projects", ["project_id"], ["id"])
    op.create_index("ix_prompts_project_id", "prompts", ["project_id"])
    op.drop_index("idx_prompts_user_id", table_name="prompts")
    op.drop_constraint("fk_prompts_user_id", "prompts", type_="foreignkey")
    op.drop_column("prompts", "user_id")

    # projects: drop team_id, lead_user_id
    op.drop_index("idx_projects_lead_user_id", table_name="projects")
    op.drop_index("idx_projects_team_id", table_name="projects")
    op.drop_constraint("fk_projects_lead_user_id", "projects", type_="foreignkey")
    op.drop_constraint("fk_projects_team_id", "projects", type_="foreignkey")
    op.drop_column("projects", "lead_user_id")
    op.drop_column("projects", "team_id")

    # Drop new tables
    op.drop_index("idx_project_members_user_id", table_name="project_members")
    op.drop_index("idx_project_members_project_id", table_name="project_members")
    op.drop_table("project_members")

    op.drop_index("idx_objectives_parent_id", table_name="objectives")
    op.drop_index("idx_objectives_user_id", table_name="objectives")
    op.drop_index("idx_objectives_project_id", table_name="objectives")
    op.drop_index("idx_objectives_team_id", table_name="objectives")
    op.drop_table("objectives")

    op.drop_index("idx_policies_project_id", table_name="policies")
    op.drop_index("idx_policies_team_id", table_name="policies")
    op.drop_table("policies")

    op.drop_constraint("fk_teams_owner_id", "teams", type_="foreignkey")

    op.drop_index("idx_users_team_id", table_name="users")
    op.drop_table("users")

    op.drop_index("idx_teams_parent_team_id", table_name="teams")
    op.drop_index("idx_teams_owner_id", table_name="teams")
    op.drop_table("teams")

    sa.Enum(name="enforcementtype").drop(op.get_bind())
