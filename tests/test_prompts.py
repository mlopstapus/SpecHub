"""Tests for the prompt CRUD REST API and expansion endpoint."""

import pytest


@pytest.mark.asyncio
async def test_create_prompt(client):
    resp = await client.post(
        "/api/v1/prompts",
        json={
            "name": "test-prompt",
            "description": "A test prompt",
            "version": {
                "version": "1.0.0",
                "system_template": "You are a helpful assistant.",
                "user_template": "Help me with: {{ input }}",
                "input_schema": {
                    "type": "object",
                    "properties": {"input": {"type": "string"}},
                    "required": ["input"],
                },
                "tags": ["test"],
            },
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "test-prompt"
    assert data["description"] == "A test prompt"
    assert data["is_deprecated"] is False
    assert data["latest_version"]["version"] == "1.0.0"
    assert data["latest_version"]["tags"] == ["test"]


@pytest.mark.asyncio
async def test_create_prompt_duplicate(client):
    payload = {
        "name": "dup-prompt",
        "version": {
            "version": "1.0.0",
            "user_template": "Hello {{ input }}",
        },
    }
    resp1 = await client.post("/api/v1/prompts", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/prompts", json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_create_prompt_invalid_name(client):
    resp = await client.post(
        "/api/v1/prompts",
        json={
            "name": "Invalid Name!",
            "version": {"version": "1.0.0", "user_template": "hi"},
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_prompts(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "list-a",
            "version": {"version": "1.0.0", "user_template": "a {{ input }}"},
        },
    )
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "list-b",
            "version": {"version": "1.0.0", "user_template": "b {{ input }}"},
        },
    )
    resp = await client.get("/api/v1/prompts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    names = [p["name"] for p in data["items"]]
    assert "list-a" in names
    assert "list-b" in names


@pytest.mark.asyncio
async def test_get_prompt(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "get-me",
            "description": "Fetch this",
            "version": {"version": "1.0.0", "user_template": "{{ input }}"},
        },
    )
    resp = await client.get("/api/v1/prompts/get-me")
    assert resp.status_code == 200
    assert resp.json()["name"] == "get-me"


@pytest.mark.asyncio
async def test_get_prompt_not_found(client):
    resp = await client.get("/api/v1/prompts/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_new_version(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "versioned",
            "version": {"version": "1.0.0", "user_template": "v1 {{ input }}"},
        },
    )
    resp = await client.put(
        "/api/v1/prompts/versioned",
        json={"version": "2.0.0", "user_template": "v2 {{ input }}"},
    )
    assert resp.status_code == 201
    assert resp.json()["version"] == "2.0.0"

    versions_resp = await client.get("/api/v1/prompts/versioned/versions")
    assert versions_resp.status_code == 200
    versions = versions_resp.json()
    assert len(versions) == 2


@pytest.mark.asyncio
async def test_deprecate_prompt(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "to-deprecate",
            "version": {"version": "1.0.0", "user_template": "{{ input }}"},
        },
    )
    resp = await client.delete("/api/v1/prompts/to-deprecate")
    assert resp.status_code == 204

    get_resp = await client.get("/api/v1/prompts/to-deprecate")
    assert get_resp.json()["is_deprecated"] is True


@pytest.mark.asyncio
async def test_expand_prompt(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "expand-me",
            "version": {
                "version": "1.0.0",
                "system_template": "You are a {{ role }}.",
                "user_template": "Do this: {{ task }}",
            },
        },
    )
    resp = await client.post(
        "/api/v1/expand/expand-me",
        json={"input": {"role": "planner", "task": "build a house"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["prompt_name"] == "expand-me"
    assert data["system_message"] == "You are a planner."
    assert data["user_message"] == "Do this: build a house"


@pytest.mark.asyncio
async def test_expand_prompt_not_found(client):
    resp = await client.post("/api/v1/expand/nope", json={"input": {}})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_expand_prompt_missing_variable(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "strict-expand",
            "version": {
                "version": "1.0.0",
                "user_template": "{{ required_var }}",
            },
        },
    )
    resp = await client.post("/api/v1/expand/strict-expand", json={"input": {}})
    assert resp.status_code == 422
    assert "required_var" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
