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
