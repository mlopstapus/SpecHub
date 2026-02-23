"""Tests for the Project CRUD API (team-owned)."""

import pytest


async def _make_team(client, slug="proj-team"):
    """Helper: create a team and return its id."""
    resp = await client.post("/api/v1/teams", json={"name": "Proj Team", "slug": slug})
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_project(client):
    team_id = await _make_team(client)
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "My Project", "slug": "my-project", "description": "Test project", "team_id": team_id},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Project"
    assert data["slug"] == "my-project"
    assert data["description"] == "Test project"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_project_duplicate_slug(client):
    team_id = await _make_team(client, slug="dup-team")
    await client.post(
        "/api/v1/projects",
        json={"name": "First", "slug": "dup-slug", "team_id": team_id},
    )
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "Second", "slug": "dup-slug", "team_id": team_id},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_projects(client):
    team_id = await _make_team(client, slug="list-team")
    await client.post("/api/v1/projects", json={"name": "Alpha", "slug": "alpha", "team_id": team_id})
    await client.post("/api/v1/projects", json={"name": "Beta", "slug": "beta", "team_id": team_id})
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    slugs = [p["slug"] for p in data["items"]]
    assert "alpha" in slugs
    assert "beta" in slugs


@pytest.mark.asyncio
async def test_get_project(client):
    team_id = await _make_team(client, slug="get-team")
    create_resp = await client.post(
        "/api/v1/projects", json={"name": "Get Me", "slug": "get-me", "team_id": team_id}
    )
    project_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/projects/{project_id}")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "get-me"


@pytest.mark.asyncio
async def test_get_project_not_found(client):
    resp = await client.get("/api/v1/projects/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_project(client):
    team_id = await _make_team(client, slug="upd-team")
    create_resp = await client.post(
        "/api/v1/projects", json={"name": "Old Name", "slug": "update-me", "team_id": team_id}
    )
    project_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/v1/projects/{project_id}",
        json={"name": "New Name", "description": "Updated"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["description"] == "Updated"


@pytest.mark.asyncio
async def test_update_project_not_found(client):
    resp = await client.put(
        "/api/v1/projects/00000000-0000-0000-0000-000000000000",
        json={"name": "Nope"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_project(client):
    team_id = await _make_team(client, slug="del-team")
    create_resp = await client.post(
        "/api/v1/projects", json={"name": "Delete Me", "slug": "delete-me", "team_id": team_id}
    )
    project_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/projects/{project_id}")
    assert resp.status_code == 204

    get_resp = await client.get(f"/api/v1/projects/{project_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_not_found(client):
    resp = await client.delete("/api/v1/projects/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


# --- Project Members ---


@pytest.mark.asyncio
async def test_add_and_list_members(client):
    team_id = await _make_team(client, slug="mem-team")
    user_resp = await client.post(
        "/api/v1/users",
        json={"username": "mem-user", "display_name": "Mem User", "team_id": team_id},
    )
    user_id = user_resp.json()["id"]
    proj_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Mem Project", "slug": "mem-project", "team_id": team_id},
    )
    project_id = proj_resp.json()["id"]

    add_resp = await client.post(
        f"/api/v1/projects/{project_id}/members",
        json={"user_id": user_id, "role": "contributor"},
    )
    assert add_resp.status_code == 201
    assert add_resp.json()["role"] == "contributor"

    list_resp = await client.get(f"/api/v1/projects/{project_id}/members")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["user_id"] == user_id


@pytest.mark.asyncio
async def test_remove_member(client):
    team_id = await _make_team(client, slug="rm-mem-team")
    user_resp = await client.post(
        "/api/v1/users",
        json={"username": "rm-user", "display_name": "Rm User", "team_id": team_id},
    )
    user_id = user_resp.json()["id"]
    proj_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Rm Mem Project", "slug": "rm-mem-project", "team_id": team_id},
    )
    project_id = proj_resp.json()["id"]

    await client.post(
        f"/api/v1/projects/{project_id}/members",
        json={"user_id": user_id},
    )
    del_resp = await client.delete(f"/api/v1/projects/{project_id}/members/{user_id}")
    assert del_resp.status_code == 204

    list_resp = await client.get(f"/api/v1/projects/{project_id}/members")
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_add_duplicate_member(client):
    team_id = await _make_team(client, slug="dup-mem-team")
    user_resp = await client.post(
        "/api/v1/users",
        json={"username": "dup-mem-user", "display_name": "Dup", "team_id": team_id},
    )
    user_id = user_resp.json()["id"]
    proj_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Dup Mem Project", "slug": "dup-mem-project", "team_id": team_id},
    )
    project_id = proj_resp.json()["id"]

    await client.post(f"/api/v1/projects/{project_id}/members", json={"user_id": user_id})
    resp = await client.post(f"/api/v1/projects/{project_id}/members", json={"user_id": user_id})
    assert resp.status_code == 409


# --- Project Objectives ---


@pytest.mark.asyncio
async def test_create_and_list_project_objectives(client):
    team_id = await _make_team(client, slug="obj-team")
    proj_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Obj Project", "slug": "obj-project", "team_id": team_id},
    )
    project_id = proj_resp.json()["id"]

    obj_resp = await client.post(
        f"/api/v1/projects/{project_id}/objectives",
        json={"title": "Ship v1", "description": "Launch the first version"},
    )
    assert obj_resp.status_code == 201
    data = obj_resp.json()
    assert data["title"] == "Ship v1"
    assert data["project_id"] == project_id

    list_resp = await client.get(f"/api/v1/projects/{project_id}/objectives")
    assert list_resp.status_code == 200
    titles = [o["title"] for o in list_resp.json()]
    assert "Ship v1" in titles


@pytest.mark.asyncio
async def test_project_objectives_empty(client):
    team_id = await _make_team(client, slug="empty-obj-team")
    proj_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Empty Obj", "slug": "empty-obj", "team_id": team_id},
    )
    project_id = proj_resp.json()["id"]

    list_resp = await client.get(f"/api/v1/projects/{project_id}/objectives")
    assert list_resp.status_code == 200
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_project_objective_overrides_project_id(client):
    """Even if body contains a different project_id, the URL project_id wins."""
    team_id = await _make_team(client, slug="override-team")
    proj_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Override", "slug": "override-proj", "team_id": team_id},
    )
    project_id = proj_resp.json()["id"]

    obj_resp = await client.post(
        f"/api/v1/projects/{project_id}/objectives",
        json={
            "title": "Overridden",
            "project_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    assert obj_resp.status_code == 201
    assert obj_resp.json()["project_id"] == project_id
