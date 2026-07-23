"""Tests for the user-scoped API Key CRUD endpoints."""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.skillcanon_server.models import Base, User


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
    assert data["raw_key"].startswith("sh_")
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


# ---------------------------------------------------------------------------
# Endpoint protection — a separate client that does NOT override auth
# dependencies, so we can test the real auth flow end-to-end.
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def auth_engine():
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def auth_client(auth_engine) -> AsyncClient:
    """Client with real auth — no dependency overrides for auth."""
    session_factory = async_sessionmaker(auth_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    from src.skillcanon_server.database import get_db
    from src.skillcanon_server.main import app

    original_overrides = dict(app.dependency_overrides)
    app.dependency_overrides = {get_db: override_get_db}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides = original_overrides


@pytest.mark.asyncio
async def test_create_api_key_no_auth(auth_client):
    resp = await auth_client.post(
        "/api/v1/users/00000000-0000-0000-0000-000000000000/api-keys",
        json={"name": "no-auth-key"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_api_keys_no_auth(auth_client):
    resp = await auth_client.get("/api/v1/users/00000000-0000-0000-0000-000000000000/api-keys")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_revoke_api_key_no_auth(auth_client):
    resp = await auth_client.delete("/api/v1/api-keys/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_api_key_forbidden_for_other_user(client, user_client_factory):
    """A non-admin, non-owner user cannot mint an API key for someone else."""
    user_id = await _create_user(client)

    intruder = User(
        id=uuid.uuid4(), team_id=uuid.uuid4(), username="intruder", role="member", is_active=True
    )
    intruder_client = await user_client_factory(intruder)
    resp = await intruder_client.post(
        f"/api/v1/users/{user_id}/api-keys", json={"name": "sneaky"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_api_key_allowed_for_self(client, user_client_factory):
    """A non-admin user can mint their own API key."""
    user_id = await _create_user(client)

    owner = User(
        id=uuid.UUID(user_id), team_id=uuid.uuid4(), username="keyuser", role="member",
        is_active=True,
    )
    owner_client = await user_client_factory(owner)
    resp = await owner_client.post(
        f"/api/v1/users/{user_id}/api-keys", json={"name": "my-own-key"}
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_api_keys_forbidden_for_other_user(client, user_client_factory):
    """A non-admin, non-owner user cannot list someone else's API keys."""
    user_id = await _create_user(client)

    intruder = User(
        id=uuid.uuid4(), team_id=uuid.uuid4(), username="intruder2", role="member", is_active=True
    )
    intruder_client = await user_client_factory(intruder)
    resp = await intruder_client.get(f"/api/v1/users/{user_id}/api-keys")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_revoke_api_key_forbidden_for_other_user(client, user_client_factory):
    """A non-admin, non-owner user cannot revoke someone else's API key."""
    user_id = await _create_user(client)
    create_resp = await client.post(
        f"/api/v1/users/{user_id}/api-keys", json={"name": "protected-key"}
    )
    key_id = create_resp.json()["key"]["id"]

    intruder = User(
        id=uuid.uuid4(), team_id=uuid.uuid4(), username="intruder3", role="member", is_active=True
    )
    intruder_client = await user_client_factory(intruder)
    resp = await intruder_client.delete(f"/api/v1/api-keys/{key_id}")
    assert resp.status_code == 403
