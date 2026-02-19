"""Tests for the user-scoped API Key CRUD endpoints."""

import pytest


async def _create_user(client):
    """Helper: create a team + user, return user_id."""
    team = await client.post("/api/v1/teams", json={"name": "Key Team", "slug": "key-team"})
    team_id = team.json()["id"]
    user = await client.post(
        "/api/v1/users",
        json={"username": "keyuser", "team_id": team_id, "email": "key@test.com"},
    )
    return user.json()["id"]


@pytest.mark.asyncio
async def test_create_api_key(client):
    user_id = await _create_user(client)

    resp = await client.post(
        f"/api/v1/users/{user_id}/api-keys",
        json={"name": "ci-pipeline", "scopes": ["read", "expand"]},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["raw_key"].startswith("pcp_")
    assert data["key"]["name"] == "ci-pipeline"
    assert data["key"]["prefix"] == data["raw_key"][:12]
    assert data["key"]["is_active"] is True
    assert data["key"]["scopes"] == ["read", "expand"]


@pytest.mark.asyncio
async def test_list_api_keys(client):
    user_id = await _create_user(client)

    await client.post(
        f"/api/v1/users/{user_id}/api-keys",
        json={"name": "key-a"},
    )
    await client.post(
        f"/api/v1/users/{user_id}/api-keys",
        json={"name": "key-b"},
    )

    resp = await client.get(f"/api/v1/users/{user_id}/api-keys")
    assert resp.status_code == 200
    names = [k["name"] for k in resp.json()]
    assert "key-a" in names
    assert "key-b" in names


@pytest.mark.asyncio
async def test_revoke_api_key(client):
    user_id = await _create_user(client)

    create_resp = await client.post(
        f"/api/v1/users/{user_id}/api-keys",
        json={"name": "to-revoke"},
    )
    key_id = create_resp.json()["key"]["id"]

    resp = await client.delete(f"/api/v1/api-keys/{key_id}")
    assert resp.status_code == 204

    keys = await client.get(f"/api/v1/users/{user_id}/api-keys")
    revoked = [k for k in keys.json() if k["id"] == key_id]
    assert len(revoked) == 1
    assert revoked[0]["is_active"] is False


@pytest.mark.asyncio
async def test_revoke_not_found(client):
    resp = await client.delete("/api/v1/api-keys/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404
