"""Tests for MCP tool registration and invocation."""

from unittest.mock import MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.pcp_server.mcp.server import mcp
from src.pcp_server.mcp.tools import pcp_list, pcp_run, pcp_search
from src.pcp_server.models import Prompt, PromptVersion


def _test_session_factory(db_session):
    return async_sessionmaker(
        db_session.bind, class_=type(db_session), expire_on_commit=False
    )


def _mock_ctx():
    """Create a mock Context with a unique session identity."""
    ctx = MagicMock()
    ctx.session = MagicMock()
    return ctx


@pytest.mark.asyncio
async def test_pcp_list_empty(db_session: AsyncSession, monkeypatch):
    """sh-list returns a message when no prompts exist."""
    from src.pcp_server.mcp import tools as tools_module

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_list(ctx=_mock_ctx())
    assert "No prompts" in result


@pytest.mark.asyncio
async def test_pcp_list_with_prompts(db_session: AsyncSession, monkeypatch):
    """sh-list returns prompt names."""
    from src.pcp_server.mcp import tools as tools_module

    prompt = Prompt(name="my-prompt", description="A test prompt")
    db_session.add(prompt)
    await db_session.flush()
    version = PromptVersion(
        prompt_id=prompt.id,
        version="1.0.0",
        user_template="Hello {{ input }}",
    )
    db_session.add(version)
    await db_session.commit()

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_list(ctx=_mock_ctx())
    assert "my-prompt" in result


@pytest.mark.asyncio
async def test_pcp_search_match(db_session: AsyncSession, monkeypatch):
    """sh-search finds prompts by name."""
    from src.pcp_server.mcp import tools as tools_module

    prompt = Prompt(name="search-target", description="Find me")
    db_session.add(prompt)
    await db_session.flush()
    version = PromptVersion(
        prompt_id=prompt.id,
        version="1.0.0",
        user_template="{{ input }}",
        tags=["findable"],
    )
    db_session.add(version)
    await db_session.commit()

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_search("search", ctx=_mock_ctx())
    assert "sh-search-target" in result


@pytest.mark.asyncio
async def test_pcp_search_no_match(db_session: AsyncSession, monkeypatch):
    """sh-search returns a message when nothing matches."""
    from src.pcp_server.mcp import tools as tools_module

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_search("zzz-nonexistent", ctx=_mock_ctx())
    assert "No prompts matching" in result


@pytest.mark.asyncio
async def test_pcp_search_by_tag(db_session: AsyncSession, monkeypatch):
    """sh-search finds prompts by tag."""
    from src.pcp_server.mcp import tools as tools_module

    prompt = Prompt(name="tag-match", description="Has a special tag")
    db_session.add(prompt)
    await db_session.flush()
    version = PromptVersion(
        prompt_id=prompt.id,
        version="1.0.0",
        user_template="{{ input }}",
        tags=["unique-tag"],
    )
    db_session.add(version)
    await db_session.commit()

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_search("unique-tag", ctx=_mock_ctx())
    assert "sh-tag-match" in result


@pytest.mark.asyncio
async def test_pcp_search_by_description(db_session: AsyncSession, monkeypatch):
    """sh-search finds prompts by description."""
    from src.pcp_server.mcp import tools as tools_module

    prompt = Prompt(name="desc-match", description="A very distinctive description")
    db_session.add(prompt)
    await db_session.flush()
    version = PromptVersion(
        prompt_id=prompt.id,
        version="1.0.0",
        user_template="{{ input }}",
    )
    db_session.add(version)
    await db_session.commit()

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_search("distinctive", ctx=_mock_ctx())
    assert "sh-desc-match" in result


def test_sh_run_tool_registered():
    """sh-run is registered as a static MCP tool."""
    assert "sh-run" in mcp._tool_manager._tools


@pytest.mark.asyncio
async def test_sh_run_invocation(db_session: AsyncSession, monkeypatch):
    """sh-run expands a prompt by name and returns formatted output."""
    from src.pcp_server.mcp import tools as tools_module

    prompt = Prompt(name="invoke-me", description="Test invocation")
    db_session.add(prompt)
    await db_session.flush()
    version = PromptVersion(
        prompt_id=prompt.id,
        version="1.0.0",
        system_template="System says: {{ input }}",
        user_template="User says: {{ input }}",
    )
    db_session.add(version)
    await db_session.commit()

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_run(name="invoke-me", input='{"input": "hello"}', ctx=_mock_ctx())
    assert "[System]" in result
    assert "System says: hello" in result
    assert "[User]" in result
    assert "User says: hello" in result


@pytest.mark.asyncio
async def test_sh_run_plain_string_input(db_session: AsyncSession, monkeypatch):
    """sh-run handles plain string input (not JSON)."""
    from src.pcp_server.mcp import tools as tools_module

    prompt = Prompt(name="plain-input", description="Plain string test")
    db_session.add(prompt)
    await db_session.flush()
    version = PromptVersion(
        prompt_id=prompt.id,
        version="1.0.0",
        user_template="Got: {{ input }}",
    )
    db_session.add(version)
    await db_session.commit()

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_run(name="plain-input", input="just a string", ctx=_mock_ctx())
    assert "Got: just a string" in result
