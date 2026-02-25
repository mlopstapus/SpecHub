-- PCP Schema Init
-- Generated from alembic migrations 001 + 002 + 003
-- This runs automatically on first container start via docker-entrypoint-initdb.d

BEGIN;

-- ============================================================================
-- Enum types
-- ============================================================================

CREATE TYPE enforcementtype AS ENUM ('prepend', 'append', 'inject', 'validate');

-- ============================================================================
-- teams (recursive hierarchy)
-- ============================================================================

CREATE TABLE teams (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    owner_id UUID,
    parent_team_id UUID REFERENCES teams(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_owner_id ON teams (owner_id);
CREATE INDEX idx_teams_parent_team_id ON teams (parent_team_id);

-- ============================================================================
-- users
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id),
    username VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_team_id ON users (team_id);

-- Deferred FK: teams.owner_id -> users.id
ALTER TABLE teams
    ADD CONSTRAINT fk_teams_owner_id FOREIGN KEY (owner_id) REFERENCES users(id);

-- ============================================================================
-- projects
-- ============================================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id),
    lead_user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_team_id ON projects (team_id);
CREATE INDEX idx_projects_lead_user_id ON projects (lead_user_id);

-- ============================================================================
-- project_members
-- ============================================================================

CREATE TABLE project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members (project_id);
CREATE INDEX idx_project_members_user_id ON project_members (user_id);

-- ============================================================================
-- policies
-- ============================================================================

CREATE TABLE policies (
    id UUID PRIMARY KEY,
    team_id UUID REFERENCES teams(id),
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enforcement_type enforcementtype NOT NULL,
    content TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policies_team_id ON policies (team_id);
CREATE INDEX idx_policies_project_id ON policies (project_id);

-- ============================================================================
-- objectives
-- ============================================================================

CREATE TABLE objectives (
    id UUID PRIMARY KEY,
    team_id UUID REFERENCES teams(id),
    project_id UUID REFERENCES projects(id),
    user_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    parent_objective_id UUID REFERENCES objectives(id),
    is_inherited BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_objectives_team_id ON objectives (team_id);
CREATE INDEX idx_objectives_project_id ON objectives (project_id);
CREATE INDEX idx_objectives_user_id ON objectives (user_id);
CREATE INDEX idx_objectives_parent_id ON objectives (parent_objective_id);

-- ============================================================================
-- prompts
-- ============================================================================

CREATE TABLE prompts (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_deprecated BOOLEAN NOT NULL DEFAULT false,
    active_version_id UUID,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompts_user_id ON prompts (user_id);

-- ============================================================================
-- prompt_versions
-- ============================================================================

CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY,
    prompt_id UUID NOT NULL REFERENCES prompts(id),
    version VARCHAR(50) NOT NULL,
    system_template TEXT,
    user_template TEXT,            -- nullable (migration 002)
    input_schema JSON DEFAULT '{}',
    tags JSON DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (prompt_id, version)
);

CREATE INDEX idx_prompt_versions_prompt_id ON prompt_versions (prompt_id);

-- Deferred FK: prompts.active_version_id -> prompt_versions.id
ALTER TABLE prompts
    ADD CONSTRAINT fk_prompts_active_version_id FOREIGN KEY (active_version_id) REFERENCES prompt_versions(id);

-- ============================================================================
-- api_keys (user-scoped)
-- ============================================================================

CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    prefix VARCHAR(16) NOT NULL,
    scopes JSON DEFAULT '[]',
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);

-- ============================================================================
-- workflows (user-scoped, optionally project-associated)
-- ============================================================================

CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSON DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_user_id ON workflows (user_id);
CREATE INDEX idx_workflows_project_id ON workflows (project_id);

-- ============================================================================
-- invitations
-- ============================================================================

CREATE TABLE invitations (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    team_id UUID NOT NULL REFERENCES teams(id),
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by_id UUID NOT NULL REFERENCES users(id),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invitations_team_id ON invitations (team_id);

-- ============================================================================
-- prompt_usage
-- ============================================================================

CREATE TABLE prompt_usage (
    id UUID PRIMARY KEY,
    prompt_name VARCHAR(255) NOT NULL,
    prompt_version VARCHAR(50) NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms FLOAT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_usage_prompt_name ON prompt_usage (prompt_name);
CREATE INDEX idx_prompt_usage_created_at ON prompt_usage (created_at);

-- ============================================================================
-- prompt_shares (migration 003)
-- ============================================================================

CREATE TABLE prompt_shares (
    id UUID PRIMARY KEY,
    prompt_id UUID NOT NULL REFERENCES prompts(id),
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (prompt_id, user_id)
);

CREATE INDEX idx_prompt_shares_prompt_id ON prompt_shares (prompt_id);
CREATE INDEX idx_prompt_shares_user_id ON prompt_shares (user_id);

-- ============================================================================
-- workflow_shares (migration 003)
-- ============================================================================

CREATE TABLE workflow_shares (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workflow_id, user_id)
);

CREATE INDEX idx_workflow_shares_workflow_id ON workflow_shares (workflow_id);
CREATE INDEX idx_workflow_shares_user_id ON workflow_shares (user_id);

-- ============================================================================
-- Alembic version tracking (so alembic upgrade head is a no-op)
-- ============================================================================

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

INSERT INTO alembic_version (version_num) VALUES ('003');

COMMIT;
