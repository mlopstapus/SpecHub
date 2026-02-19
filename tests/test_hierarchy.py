"""Tests for the teams/users/policies/objectives/projects hierarchy."""

import uuid

import pytest


# ---------------------------------------------------------------------------
# Helper: create a team via API
# ---------------------------------------------------------------------------

async def _create_team(client, name, slug, parent_team_id=None):
    payload = {"name": name, "slug": slug}
    if parent_team_id:
        payload["parent_team_id"] = str(parent_team_id)
    resp = await client.post("/api/v1/teams", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_user(client, username, team_id, display_name=None, email=None):
    payload = {"username": username, "team_id": str(team_id)}
    if display_name:
        payload["display_name"] = display_name
    if email:
        payload["email"] = email
    resp = await client.post("/api/v1/users", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_policy(client, team_id=None, project_id=None, **kwargs):
    payload = {
        "name": kwargs.get("name", "test-policy"),
        "enforcement_type": kwargs.get("enforcement_type", "prepend"),
        "content": kwargs.get("content", "Test policy content"),
        "priority": kwargs.get("priority", 0),
    }
    if team_id:
        payload["team_id"] = str(team_id)
    if project_id:
        payload["project_id"] = str(project_id)
    resp = await client.post("/api/v1/policies", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_objective(client, team_id=None, project_id=None, user_id=None, **kwargs):
    payload = {
        "title": kwargs.get("title", "Test objective"),
    }
    if kwargs.get("description"):
        payload["description"] = kwargs["description"]
    if team_id:
        payload["team_id"] = str(team_id)
    if project_id:
        payload["project_id"] = str(project_id)
    if user_id:
        payload["user_id"] = str(user_id)
    resp = await client.post("/api/v1/objectives", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_project(client, team_id, slug, name=None, lead_user_id=None):
    payload = {
        "team_id": str(team_id),
        "name": name or slug,
        "slug": slug,
    }
    if lead_user_id:
        payload["lead_user_id"] = str(lead_user_id)
    resp = await client.post("/api/v1/projects", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Team CRUD
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_team(client):
    team = await _create_team(client, "Engineering", "engineering")
    assert team["name"] == "Engineering"
    assert team["slug"] == "engineering"
    assert team["parent_team_id"] is None


@pytest.mark.asyncio
async def test_create_sub_team(client):
    parent = await _create_team(client, "Eng", "eng-sub")
    child = await _create_team(client, "MLOps", "mlops-sub", parent_team_id=parent["id"])
    assert child["parent_team_id"] == parent["id"]


@pytest.mark.asyncio
async def test_list_root_teams(client):
    await _create_team(client, "Root1", "root1-list")
    resp = await client.get("/api/v1/teams")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_list_sub_teams(client):
    parent = await _create_team(client, "Parent", "parent-listsub")
    await _create_team(client, "Child1", "child1-listsub", parent_team_id=parent["id"])
    await _create_team(client, "Child2", "child2-listsub", parent_team_id=parent["id"])
    resp = await client.get(f"/api/v1/teams?parent_team_id={parent['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_get_team(client):
    team = await _create_team(client, "GetMe", "getme-team")
    resp = await client.get(f"/api/v1/teams/{team['id']}")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "getme-team"


@pytest.mark.asyncio
async def test_update_team(client):
    team = await _create_team(client, "OldName", "update-team")
    resp = await client.put(f"/api/v1/teams/{team['id']}", json={"name": "NewName"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "NewName"


@pytest.mark.asyncio
async def test_delete_team(client):
    team = await _create_team(client, "DeleteMe", "delete-team")
    resp = await client.delete(f"/api/v1/teams/{team['id']}")
    assert resp.status_code == 204
    resp2 = await client.get(f"/api/v1/teams/{team['id']}")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_team_slug_unique(client):
    await _create_team(client, "Dup", "dup-team-slug")
    resp = await client.post("/api/v1/teams", json={"name": "Dup2", "slug": "dup-team-slug"})
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_user(client):
    team = await _create_team(client, "UserTeam", "user-team")
    user = await _create_user(client, "alice", team["id"], display_name="Alice")
    assert user["username"] == "alice"
    assert user["team_id"] == team["id"]
    assert user["is_active"] is True


@pytest.mark.asyncio
async def test_list_users_by_team(client):
    team = await _create_team(client, "ListTeam", "list-users-team")
    await _create_user(client, "bob-lu", team["id"])
    await _create_user(client, "carol-lu", team["id"])
    resp = await client.get(f"/api/v1/users?team_id={team['id']}")
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


@pytest.mark.asyncio
async def test_update_user(client):
    team = await _create_team(client, "UpdTeam", "upd-user-team")
    user = await _create_user(client, "upd-user", team["id"])
    resp = await client.put(
        f"/api/v1/users/{user['id']}", json={"display_name": "Updated"}
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Updated"


@pytest.mark.asyncio
async def test_delete_user(client):
    team = await _create_team(client, "DelTeam", "del-user-team")
    user = await _create_user(client, "del-user", team["id"])
    resp = await client.delete(f"/api/v1/users/{user['id']}")
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Policy CRUD
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_team_policy(client):
    team = await _create_team(client, "PolTeam", "pol-team")
    policy = await _create_policy(
        client,
        team_id=team["id"],
        name="must-test",
        enforcement_type="prepend",
        content="All code must have tests.",
        priority=10,
    )
    assert policy["name"] == "must-test"
    assert policy["team_id"] == team["id"]
    assert policy["enforcement_type"] == "prepend"
    assert policy["priority"] == 10


@pytest.mark.asyncio
async def test_update_policy(client):
    team = await _create_team(client, "PolUpd", "pol-upd-team")
    policy = await _create_policy(client, team_id=team["id"], name="upd-pol")
    resp = await client.put(
        f"/api/v1/policies/{policy['id']}", json={"content": "Updated content"}
    )
    assert resp.status_code == 200
    assert resp.json()["content"] == "Updated content"


@pytest.mark.asyncio
async def test_delete_policy(client):
    team = await _create_team(client, "PolDel", "pol-del-team")
    policy = await _create_policy(client, team_id=team["id"], name="del-pol")
    resp = await client.delete(f"/api/v1/policies/{policy['id']}")
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Objective CRUD
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_team_objective(client):
    team = await _create_team(client, "ObjTeam", "obj-team")
    obj = await _create_objective(
        client, team_id=team["id"], title="Ship reliable software"
    )
    assert obj["title"] == "Ship reliable software"
    assert obj["team_id"] == team["id"]
    assert obj["status"] == "active"


@pytest.mark.asyncio
async def test_create_user_objective(client):
    team = await _create_team(client, "UObjTeam", "uobj-team")
    user = await _create_user(client, "uobj-user", team["id"])
    obj = await _create_objective(
        client, user_id=user["id"], title="Automate deployments"
    )
    assert obj["user_id"] == user["id"]


@pytest.mark.asyncio
async def test_update_objective(client):
    team = await _create_team(client, "ObjUpd", "obj-upd-team")
    obj = await _create_objective(client, team_id=team["id"], title="Old title")
    resp = await client.put(
        f"/api/v1/objectives/{obj['id']}", json={"title": "New title"}
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "New title"


# ---------------------------------------------------------------------------
# Policy Resolution (two-layer: inherited + local)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_policy_resolution_single_team(client):
    """User on a root team: no inherited, all local."""
    team = await _create_team(client, "RootPol", "root-pol")
    user = await _create_user(client, "root-pol-user", team["id"])
    await _create_policy(client, team_id=team["id"], name="root-policy", priority=5)

    resp = await client.get(f"/api/v1/policies/effective?user_id={user['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["local"]) == 1
    assert len(data["inherited"]) == 0
    assert data["local"][0]["name"] == "root-policy"


@pytest.mark.asyncio
async def test_policy_resolution_nested_teams(client):
    """User on a child team: parent policies are inherited, child's are local."""
    parent = await _create_team(client, "ParentPol", "parent-pol-res")
    child = await _create_team(client, "ChildPol", "child-pol-res", parent_team_id=parent["id"])
    user = await _create_user(client, "child-pol-user", child["id"])

    await _create_policy(client, team_id=parent["id"], name="parent-policy", priority=10)
    await _create_policy(client, team_id=child["id"], name="child-policy", priority=5)

    resp = await client.get(f"/api/v1/policies/effective?user_id={user['id']}")
    data = resp.json()
    assert len(data["inherited"]) == 1
    assert data["inherited"][0]["name"] == "parent-policy"
    assert data["inherited"][0]["is_inherited"] is True
    assert len(data["local"]) == 1
    assert data["local"][0]["name"] == "child-policy"
    assert data["local"][0]["is_inherited"] is False


@pytest.mark.asyncio
async def test_policy_resolution_deep_chain(client):
    """3-level chain: grandparent + parent = inherited, child = local."""
    gp = await _create_team(client, "GP", "gp-deep")
    parent = await _create_team(client, "P", "p-deep", parent_team_id=gp["id"])
    child = await _create_team(client, "C", "c-deep", parent_team_id=parent["id"])
    user = await _create_user(client, "deep-user", child["id"])

    await _create_policy(client, team_id=gp["id"], name="gp-policy", priority=20)
    await _create_policy(client, team_id=parent["id"], name="parent-policy", priority=10)
    await _create_policy(client, team_id=child["id"], name="child-policy", priority=5)

    resp = await client.get(f"/api/v1/policies/effective?user_id={user['id']}")
    data = resp.json()
    # GP + parent = inherited (coalesced)
    assert len(data["inherited"]) == 2
    inherited_names = {p["name"] for p in data["inherited"]}
    assert inherited_names == {"gp-policy", "parent-policy"}
    # Child = local
    assert len(data["local"]) == 1
    assert data["local"][0]["name"] == "child-policy"


@pytest.mark.asyncio
async def test_policy_resolution_with_project(client):
    """Project policies are independent, added to local layer."""
    team = await _create_team(client, "ProjPol", "proj-pol-res")
    user = await _create_user(client, "proj-pol-user", team["id"])
    project = await _create_project(client, team["id"], "proj-pol-slug")

    await _create_policy(client, team_id=team["id"], name="team-policy", priority=10)
    await _create_policy(client, project_id=project["id"], name="project-policy", priority=5)

    resp = await client.get(
        f"/api/v1/policies/effective?user_id={user['id']}&project_id={project['id']}"
    )
    data = resp.json()
    local_names = {p["name"] for p in data["local"]}
    assert "team-policy" in local_names
    assert "project-policy" in local_names


# ---------------------------------------------------------------------------
# Objective Resolution (two-layer: inherited + local)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_objective_resolution_nested(client):
    parent = await _create_team(client, "ObjParent", "obj-parent-res")
    child = await _create_team(client, "ObjChild", "obj-child-res", parent_team_id=parent["id"])
    user = await _create_user(client, "obj-res-user", child["id"])

    await _create_objective(client, team_id=parent["id"], title="Parent objective")
    await _create_objective(client, team_id=child["id"], title="Child objective")
    await _create_objective(client, user_id=user["id"], title="Personal objective")

    resp = await client.get(f"/api/v1/objectives/effective?user_id={user['id']}")
    data = resp.json()
    inherited_titles = {o["title"] for o in data["inherited"]}
    local_titles = {o["title"] for o in data["local"]}
    assert "Parent objective" in inherited_titles
    assert "Child objective" in local_titles
    assert "Personal objective" in local_titles


@pytest.mark.asyncio
async def test_objective_resolution_with_project(client):
    team = await _create_team(client, "ObjProj", "obj-proj-res")
    user = await _create_user(client, "obj-proj-user", team["id"])
    project = await _create_project(client, team["id"], "obj-proj-slug")

    await _create_objective(client, team_id=team["id"], title="Team objective")
    await _create_objective(client, project_id=project["id"], title="Project objective")

    resp = await client.get(
        f"/api/v1/objectives/effective?user_id={user['id']}&project_id={project['id']}"
    )
    data = resp.json()
    local_titles = {o["title"] for o in data["local"]}
    assert "Team objective" in local_titles
    assert "Project objective" in local_titles


# ---------------------------------------------------------------------------
# Project CRUD + Members
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_project_with_team(client):
    team = await _create_team(client, "ProjTeam", "proj-crud-team")
    user = await _create_user(client, "proj-lead", team["id"])
    project = await _create_project(
        client, team["id"], "proj-crud-slug", name="My Project", lead_user_id=user["id"]
    )
    assert project["team_id"] == team["id"]
    assert project["lead_user_id"] == user["id"]
    assert project["slug"] == "proj-crud-slug"


@pytest.mark.asyncio
async def test_list_projects_by_team(client):
    team = await _create_team(client, "ProjList", "proj-list-team")
    await _create_project(client, team["id"], "proj-list-1")
    await _create_project(client, team["id"], "proj-list-2")
    resp = await client.get(f"/api/v1/projects?team_id={team['id']}")
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


@pytest.mark.asyncio
async def test_project_members(client):
    team1 = await _create_team(client, "T1", "proj-mem-t1")
    team2 = await _create_team(client, "T2", "proj-mem-t2")
    user1 = await _create_user(client, "pm-user1", team1["id"])
    user2 = await _create_user(client, "pm-user2", team2["id"])
    project = await _create_project(client, team1["id"], "proj-mem-slug")

    # Add members (cross-team)
    resp1 = await client.post(
        f"/api/v1/projects/{project['id']}/members",
        json={"user_id": str(user1["id"])},
    )
    assert resp1.status_code == 201
    resp2 = await client.post(
        f"/api/v1/projects/{project['id']}/members",
        json={"user_id": str(user2["id"])},
    )
    assert resp2.status_code == 201

    # List members
    resp = await client.get(f"/api/v1/projects/{project['id']}/members")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Remove member
    resp = await client.delete(
        f"/api/v1/projects/{project['id']}/members/{user2['id']}"
    )
    assert resp.status_code == 204

    resp = await client.get(f"/api/v1/projects/{project['id']}/members")
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_project_member_duplicate(client):
    team = await _create_team(client, "DupMem", "dup-mem-team")
    user = await _create_user(client, "dup-mem-user", team["id"])
    project = await _create_project(client, team["id"], "dup-mem-proj")

    await client.post(
        f"/api/v1/projects/{project['id']}/members",
        json={"user_id": str(user["id"])},
    )
    resp = await client.post(
        f"/api/v1/projects/{project['id']}/members",
        json={"user_id": str(user["id"])},
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# API Key (user-scoped)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_api_key_user_scoped(client):
    team = await _create_team(client, "KeyTeam", "key-team")
    user = await _create_user(client, "key-user", team["id"])

    resp = await client.post(
        f"/api/v1/users/{user['id']}/api-keys",
        json={"name": "my-key"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["key"]["user_id"] == user["id"]
    assert data["raw_key"].startswith("pcp_")

    # List keys
    resp = await client.get(f"/api/v1/users/{user['id']}/api-keys")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # Revoke
    key_id = data["key"]["id"]
    resp = await client.delete(f"/api/v1/api-keys/{key_id}")
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Workflow (user-scoped)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_workflow_user_scoped(client):
    team = await _create_team(client, "WfTeam", "wf-team")
    user = await _create_user(client, "wf-user", team["id"])

    resp = await client.post(
        "/api/v1/workflows",
        json={
            "user_id": str(user["id"]),
            "name": "My Workflow",
            "steps": [],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == user["id"]

    # List by user
    resp = await client.get(f"/api/v1/workflows?user_id={user['id']}")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


# ---------------------------------------------------------------------------
# Prompt Expansion with Policy Enforcement
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_expand_with_prepend_policy(client):
    """Prepend policy content should appear before the system message."""
    team = await _create_team(client, "ExpTeam", "exp-team")
    user = await _create_user(client, "exp-user", team["id"])

    # Create a policy
    await _create_policy(
        client,
        team_id=team["id"],
        name="prepend-pol",
        enforcement_type="prepend",
        content="IMPORTANT: Always follow best practices.",
        priority=10,
    )

    # Create a prompt owned by this user
    resp = await client.post(
        "/api/v1/prompts",
        json={
            "name": "exp-test-prompt",
            "user_id": str(user["id"]),
            "version": {
                "version": "1.0.0",
                "system_template": "You are a helpful assistant.",
                "user_template": "Help me with: {{ input }}",
            },
        },
    )
    assert resp.status_code == 201

    # Expand
    resp = await client.post(
        "/api/v1/expand/exp-test-prompt",
        json={"input": {"input": "testing"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "IMPORTANT: Always follow best practices." in data["system_message"]
    assert "prepend-pol" in data["applied_policies"]


@pytest.mark.asyncio
async def test_expand_with_append_policy(client):
    """Append policy content should appear after the user message."""
    team = await _create_team(client, "AppTeam", "app-team")
    user = await _create_user(client, "app-user", team["id"])

    await _create_policy(
        client,
        team_id=team["id"],
        name="append-pol",
        enforcement_type="append",
        content="Remember to include tests.",
        priority=5,
    )

    resp = await client.post(
        "/api/v1/prompts",
        json={
            "name": "app-test-prompt",
            "user_id": str(user["id"]),
            "version": {
                "version": "1.0.0",
                "user_template": "Write code for: {{ input }}",
            },
        },
    )
    assert resp.status_code == 201

    resp = await client.post(
        "/api/v1/expand/app-test-prompt",
        json={"input": {"input": "a function"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_message"].endswith("Remember to include tests.")
    assert "append-pol" in data["applied_policies"]


@pytest.mark.asyncio
async def test_expand_with_project_context(client):
    """Expanding with a project_id should layer project policies on top."""
    team = await _create_team(client, "ProjExpTeam", "proj-exp-team")
    user = await _create_user(client, "proj-exp-user", team["id"])
    project = await _create_project(client, team["id"], "proj-exp-slug")

    await _create_policy(
        client,
        team_id=team["id"],
        name="team-exp-pol",
        enforcement_type="prepend",
        content="Team rule.",
        priority=10,
    )
    await _create_policy(
        client,
        project_id=project["id"],
        name="proj-exp-pol",
        enforcement_type="append",
        content="Project rule.",
        priority=5,
    )

    resp = await client.post(
        "/api/v1/prompts",
        json={
            "name": "proj-exp-prompt",
            "user_id": str(user["id"]),
            "version": {
                "version": "1.0.0",
                "system_template": "System.",
                "user_template": "User: {{ input }}",
            },
        },
    )
    assert resp.status_code == 201

    resp = await client.post(
        "/api/v1/expand/proj-exp-prompt",
        json={"input": {"input": "test"}, "project_id": str(project["id"])},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "Team rule." in data["system_message"]
    assert data["user_message"].endswith("Project rule.")
    assert "team-exp-pol" in data["applied_policies"]
    assert "proj-exp-pol" in data["applied_policies"]


@pytest.mark.asyncio
async def test_expand_without_user_no_policies(client):
    """Prompt without user_id: no policies applied, still works."""
    resp = await client.post(
        "/api/v1/prompts",
        json={
            "name": "no-user-prompt",
            "version": {
                "version": "1.0.0",
                "user_template": "Hello {{ name }}",
            },
        },
    )
    assert resp.status_code == 201

    resp = await client.post(
        "/api/v1/expand/no-user-prompt",
        json={"input": {"name": "world"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_message"] == "Hello world"
    assert data["applied_policies"] == []


@pytest.mark.asyncio
async def test_expand_objectives_in_response(client):
    """Objectives should appear in the expand response."""
    team = await _create_team(client, "ObjExpTeam", "obj-exp-team")
    user = await _create_user(client, "obj-exp-user", team["id"])

    await _create_objective(client, team_id=team["id"], title="Ship fast")
    await _create_objective(client, user_id=user["id"], title="Learn Rust")

    resp = await client.post(
        "/api/v1/prompts",
        json={
            "name": "obj-exp-prompt",
            "user_id": str(user["id"]),
            "version": {
                "version": "1.0.0",
                "user_template": "Do: {{ input }}",
            },
        },
    )
    assert resp.status_code == 201

    resp = await client.post(
        "/api/v1/expand/obj-exp-prompt",
        json={"input": {"input": "something"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "Ship fast" in data["objectives"]
    assert "Learn Rust" in data["objectives"]
