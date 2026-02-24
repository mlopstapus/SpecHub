"""Tests for auth: register, login, JWT, invitations, endpoint protection."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.pcp_server.models import Base


# ---------------------------------------------------------------------------
# We need a *separate* client that does NOT override auth dependencies,
# so we can test the real auth flow end-to-end.
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
    session_factory = async_sessionmaker(
        auth_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    from src.pcp_server.database import get_db
    from src.pcp_server.main import app

    original_overrides = dict(app.dependency_overrides)
    app.dependency_overrides = {get_db: override_get_db}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides = original_overrides


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_org_status_empty(auth_client):
    res = await auth_client.get("/api/v1/auth/status")
    assert res.status_code == 200
    assert res.json()["has_org"] is False


@pytest.mark.asyncio
async def test_register_admin(auth_client):
    res = await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
        "display_name": "Admin User",
    })
    assert res.status_code == 201
    data = res.json()
    assert "token" in data
    assert data["user"]["role"] == "admin"
    assert data["user"]["email"] == "admin@acme.com"
    assert data["user"]["username"] == "admin"


@pytest.mark.asyncio
async def test_org_status_after_register(auth_client):
    # Register first
    await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    res = await auth_client.get("/api/v1/auth/status")
    assert res.status_code == 200
    assert res.json()["has_org"] is True


@pytest.mark.asyncio
async def test_register_twice_fails(auth_client):
    await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    res = await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Other Corp",
        "org_slug": "other-corp",
        "email": "other@other.com",
        "username": "other",
        "password": "securepass123",
    })
    assert res.status_code == 409


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_success(auth_client):
    await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    res = await auth_client.post("/api/v1/auth/login", json={
        "email": "admin@acme.com",
        "password": "securepass123",
    })
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["user"]["username"] == "admin"


@pytest.mark.asyncio
async def test_login_wrong_password(auth_client):
    await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    res = await auth_client.post("/api/v1/auth/login", json={
        "email": "admin@acme.com",
        "password": "wrongpassword",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_email(auth_client):
    res = await auth_client.post("/api/v1/auth/login", json={
        "email": "nobody@nowhere.com",
        "password": "whatever",
    })
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# /me endpoint
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_me_authenticated(auth_client):
    reg = await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    token = reg.json()["token"]
    res = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["username"] == "admin"
    assert res.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_me_unauthenticated(auth_client):
    res = await auth_client.get("/api/v1/auth/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_bad_token(auth_client):
    res = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invitation_flow(auth_client):
    """Full flow: register admin → create invitation → accept invitation."""
    # 1. Register admin
    reg = await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    admin_token = reg.json()["token"]
    team_id = reg.json()["user"]["team_id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create invitation
    inv_res = await auth_client.post(
        "/api/v1/auth/invitations",
        json={"email": "bob@acme.com", "team_id": team_id, "role": "member"},
        headers=admin_headers,
    )
    assert inv_res.status_code == 201
    inv = inv_res.json()
    assert inv["email"] == "bob@acme.com"
    assert inv["role"] == "member"
    inv_token = inv["token"]

    # 3. List invitations
    list_res = await auth_client.get(
        "/api/v1/auth/invitations",
        headers=admin_headers,
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 4. Get invitation info (public)
    info_res = await auth_client.get(f"/api/v1/auth/invitations/token/{inv_token}")
    assert info_res.status_code == 200
    assert info_res.json()["email"] == "bob@acme.com"

    # 5. Accept invitation
    accept_res = await auth_client.post(
        f"/api/v1/auth/invitations/{inv_token}/accept",
        json={
            "username": "bob",
            "password": "bobpassword123",
            "display_name": "Bob Builder",
        },
    )
    assert accept_res.status_code == 201
    bob_data = accept_res.json()
    assert bob_data["user"]["username"] == "bob"
    assert bob_data["user"]["role"] == "member"
    assert "token" in bob_data

    # 6. Bob can use /me
    bob_me = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {bob_data['token']}"},
    )
    assert bob_me.status_code == 200
    assert bob_me.json()["username"] == "bob"


@pytest.mark.asyncio
async def test_invitation_already_accepted(auth_client):
    """Accepting the same invitation twice should fail."""
    reg = await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    admin_token = reg.json()["token"]
    team_id = reg.json()["user"]["team_id"]

    inv_res = await auth_client.post(
        "/api/v1/auth/invitations",
        json={"email": "carol@acme.com", "team_id": team_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    inv_token = inv_res.json()["token"]

    # Accept once
    await auth_client.post(
        f"/api/v1/auth/invitations/{inv_token}/accept",
        json={"username": "carol", "password": "carolpass123"},
    )

    # Accept again — should fail
    res = await auth_client.post(
        f"/api/v1/auth/invitations/{inv_token}/accept",
        json={"username": "carol2", "password": "carolpass123"},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_invitation_invalid_token(auth_client):
    res = await auth_client.get("/api/v1/auth/invitations/token/bogus-token")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Endpoint protection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_protected_endpoint_no_auth(auth_client):
    """Creating a team without auth should fail."""
    res = await auth_client.post("/api/v1/teams", json={
        "name": "Test Team",
        "slug": "test-team",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_member_forbidden(auth_client):
    """A member should not be able to create a team (admin-only)."""
    # Register admin
    reg = await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    admin_token = reg.json()["token"]
    team_id = reg.json()["user"]["team_id"]

    # Invite a member
    inv_res = await auth_client.post(
        "/api/v1/auth/invitations",
        json={"email": "member@acme.com", "team_id": team_id, "role": "member"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    inv_token = inv_res.json()["token"]

    # Accept as member
    accept_res = await auth_client.post(
        f"/api/v1/auth/invitations/{inv_token}/accept",
        json={"username": "member", "password": "memberpass123"},
    )
    member_token = accept_res.json()["token"]

    # Member tries to create a team — should be 403
    res = await auth_client.post(
        "/api/v1/teams",
        json={"name": "Rogue Team", "slug": "rogue-team"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_protected_endpoint_admin_allowed(auth_client):
    """An admin should be able to create a team."""
    reg = await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    admin_token = reg.json()["token"]

    res = await auth_client.post(
        "/api/v1/teams",
        json={"name": "Engineering", "slug": "engineering"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    assert res.json()["name"] == "Engineering"


@pytest.mark.asyncio
async def test_read_endpoints_open(auth_client):
    """Read endpoints (list teams, list prompts) should not require auth."""
    res = await auth_client.get("/api/v1/teams")
    assert res.status_code == 200

    res = await auth_client.get("/api/v1/prompts")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_member_can_create_objective(auth_client):
    """Members should be able to create objectives (requires auth, not admin)."""
    reg = await auth_client.post("/api/v1/auth/register", json={
        "org_name": "Acme Corp",
        "org_slug": "acme-corp",
        "email": "admin@acme.com",
        "username": "admin",
        "password": "securepass123",
    })
    admin_token = reg.json()["token"]
    team_id = reg.json()["user"]["team_id"]

    # Invite member
    inv_res = await auth_client.post(
        "/api/v1/auth/invitations",
        json={"email": "dev@acme.com", "team_id": team_id, "role": "member"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    inv_token = inv_res.json()["token"]
    accept_res = await auth_client.post(
        f"/api/v1/auth/invitations/{inv_token}/accept",
        json={"username": "dev", "password": "devpass12345"},
    )
    member_token = accept_res.json()["token"]

    # Member creates an objective — should work
    res = await auth_client.post(
        "/api/v1/objectives",
        json={"team_id": team_id, "title": "Ship v2"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert res.status_code == 201
