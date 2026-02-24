"""Tests for prompt and workflow sharing."""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.models import Prompt, PromptVersion, Team, User, Workflow


@pytest_asyncio.fixture
async def team(db_session: AsyncSession) -> Team:
    t = Team(id=uuid.uuid4(), name="Share Test Team", slug="share-test-team")
    db_session.add(t)
    await db_session.flush()
    return t


@pytest_asyncio.fixture
async def owner(db_session: AsyncSession, team: Team) -> User:
    u = User(
        id=uuid.uuid4(),
        team_id=team.id,
        username="owner",
        display_name="Owner User",
        email="owner@test.local",
        role="member",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def other_user(db_session: AsyncSession, team: Team) -> User:
    u = User(
        id=uuid.uuid4(),
        team_id=team.id,
        username="other",
        display_name="Other User",
        email="other@test.local",
        role="member",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def third_user(db_session: AsyncSession, team: Team) -> User:
    u = User(
        id=uuid.uuid4(),
        team_id=team.id,
        username="third",
        display_name="Third User",
        email="third@test.local",
        role="member",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def owned_prompt(db_session: AsyncSession, owner: User) -> Prompt:
    p = Prompt(name="share-test-prompt", description="A prompt to share", user_id=owner.id)
    db_session.add(p)
    await db_session.flush()
    v = PromptVersion(
        prompt_id=p.id,
        version="1.0.0",
        user_template="{{ input }}",
        input_schema={"type": "object", "properties": {"input": {"type": "string"}}},
        tags=["test"],
    )
    db_session.add(v)
    await db_session.commit()
    return p


@pytest_asyncio.fixture
async def owned_workflow(db_session: AsyncSession, owner: User) -> Workflow:
    w = Workflow(
        user_id=owner.id,
        name="share-test-workflow",
        description="A workflow to share",
        steps=[],
    )
    db_session.add(w)
    await db_session.commit()
    await db_session.refresh(w)
    return w


# ---------------------------------------------------------------------------
# Prompt sharing tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_share_prompt(db_session: AsyncSession, owned_prompt: Prompt, other_user: User):
    from src.pcp_server.services import prompt_service

    result = await prompt_service.share_prompt(db_session, owned_prompt.name, other_user.id)
    assert result is not None
    assert result.user_id == other_user.id
    assert result.username == "other"


@pytest.mark.asyncio
async def test_share_prompt_idempotent(db_session: AsyncSession, owned_prompt: Prompt, other_user: User):
    from src.pcp_server.services import prompt_service

    r1 = await prompt_service.share_prompt(db_session, owned_prompt.name, other_user.id)
    r2 = await prompt_service.share_prompt(db_session, owned_prompt.name, other_user.id)
    assert r1 is not None
    assert r2 is not None
    assert r1.id == r2.id


@pytest.mark.asyncio
async def test_share_prompt_not_found(db_session: AsyncSession, other_user: User):
    from src.pcp_server.services import prompt_service

    result = await prompt_service.share_prompt(db_session, "nonexistent", other_user.id)
    assert result is None


@pytest.mark.asyncio
async def test_list_prompt_shares(
    db_session: AsyncSession, owned_prompt: Prompt, other_user: User, third_user: User
):
    from src.pcp_server.services import prompt_service

    await prompt_service.share_prompt(db_session, owned_prompt.name, other_user.id)
    await prompt_service.share_prompt(db_session, owned_prompt.name, third_user.id)

    shares = await prompt_service.list_prompt_shares(db_session, owned_prompt.name)
    assert shares is not None
    assert len(shares) == 2
    user_ids = {s.user_id for s in shares}
    assert other_user.id in user_ids
    assert third_user.id in user_ids


@pytest.mark.asyncio
async def test_list_prompt_shares_not_found(db_session: AsyncSession):
    from src.pcp_server.services import prompt_service

    result = await prompt_service.list_prompt_shares(db_session, "nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_unshare_prompt(db_session: AsyncSession, owned_prompt: Prompt, other_user: User):
    from src.pcp_server.services import prompt_service

    await prompt_service.share_prompt(db_session, owned_prompt.name, other_user.id)
    success = await prompt_service.unshare_prompt(db_session, owned_prompt.name, other_user.id)
    assert success is True

    shares = await prompt_service.list_prompt_shares(db_session, owned_prompt.name)
    assert shares is not None
    assert len(shares) == 0


@pytest.mark.asyncio
async def test_unshare_prompt_not_found(db_session: AsyncSession, owned_prompt: Prompt):
    from src.pcp_server.services import prompt_service

    success = await prompt_service.unshare_prompt(db_session, owned_prompt.name, uuid.uuid4())
    assert success is False


@pytest.mark.asyncio
async def test_list_prompts_user_scoped(
    db_session: AsyncSession, owned_prompt: Prompt, owner: User, other_user: User
):
    """Only owned + shared prompts should appear when user_id is provided."""
    from src.pcp_server.services import prompt_service

    # other_user sees nothing initially
    result = await prompt_service.list_prompts(db_session, user_id=other_user.id)
    assert result.total == 0

    # share with other_user
    await prompt_service.share_prompt(db_session, owned_prompt.name, other_user.id)

    # now other_user sees it
    result = await prompt_service.list_prompts(db_session, user_id=other_user.id)
    assert result.total == 1
    assert result.items[0].name == owned_prompt.name

    # owner always sees it
    result = await prompt_service.list_prompts(db_session, user_id=owner.id)
    assert result.total == 1


# ---------------------------------------------------------------------------
# Workflow sharing tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_share_workflow(db_session: AsyncSession, owned_workflow: Workflow, other_user: User):
    from src.pcp_server.services import workflow_service

    result = await workflow_service.share_workflow(db_session, owned_workflow.id, other_user.id)
    assert result is not None
    assert result.user_id == other_user.id
    assert result.username == "other"


@pytest.mark.asyncio
async def test_share_workflow_idempotent(
    db_session: AsyncSession, owned_workflow: Workflow, other_user: User
):
    from src.pcp_server.services import workflow_service

    r1 = await workflow_service.share_workflow(db_session, owned_workflow.id, other_user.id)
    r2 = await workflow_service.share_workflow(db_session, owned_workflow.id, other_user.id)
    assert r1 is not None
    assert r2 is not None
    assert r1.id == r2.id


@pytest.mark.asyncio
async def test_share_workflow_not_found(db_session: AsyncSession, other_user: User):
    from src.pcp_server.services import workflow_service

    result = await workflow_service.share_workflow(db_session, uuid.uuid4(), other_user.id)
    assert result is None


@pytest.mark.asyncio
async def test_list_workflow_shares(
    db_session: AsyncSession, owned_workflow: Workflow, other_user: User, third_user: User
):
    from src.pcp_server.services import workflow_service

    await workflow_service.share_workflow(db_session, owned_workflow.id, other_user.id)
    await workflow_service.share_workflow(db_session, owned_workflow.id, third_user.id)

    shares = await workflow_service.list_workflow_shares(db_session, owned_workflow.id)
    assert shares is not None
    assert len(shares) == 2


@pytest.mark.asyncio
async def test_list_workflow_shares_not_found(db_session: AsyncSession):
    from src.pcp_server.services import workflow_service

    result = await workflow_service.list_workflow_shares(db_session, uuid.uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_unshare_workflow(db_session: AsyncSession, owned_workflow: Workflow, other_user: User):
    from src.pcp_server.services import workflow_service

    await workflow_service.share_workflow(db_session, owned_workflow.id, other_user.id)
    success = await workflow_service.unshare_workflow(db_session, owned_workflow.id, other_user.id)
    assert success is True

    shares = await workflow_service.list_workflow_shares(db_session, owned_workflow.id)
    assert shares is not None
    assert len(shares) == 0


@pytest.mark.asyncio
async def test_unshare_workflow_not_found(db_session: AsyncSession, owned_workflow: Workflow):
    from src.pcp_server.services import workflow_service

    success = await workflow_service.unshare_workflow(db_session, owned_workflow.id, uuid.uuid4())
    assert success is False


@pytest.mark.asyncio
async def test_list_workflows_user_scoped(
    db_session: AsyncSession, owned_workflow: Workflow, owner: User, other_user: User
):
    """Only owned + shared workflows should appear when user_id is provided."""
    from src.pcp_server.services import workflow_service

    # other_user sees nothing initially
    result = await workflow_service.list_workflows(db_session, user_id=other_user.id)
    assert len(result) == 0

    # share with other_user
    await workflow_service.share_workflow(db_session, owned_workflow.id, other_user.id)

    # now other_user sees it
    result = await workflow_service.list_workflows(db_session, user_id=other_user.id)
    assert len(result) == 1
    assert result[0].name == owned_workflow.name

    # owner always sees it
    result = await workflow_service.list_workflows(db_session, user_id=owner.id)
    assert len(result) == 1
