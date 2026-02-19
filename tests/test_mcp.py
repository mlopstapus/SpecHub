"""Tests for MCP tool registration and invocation."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.pcp_server.mcp.server import mcp
from src.pcp_server.mcp.tools import _register_one, pcp_list, pcp_search
from src.pcp_server.models import Prompt, PromptVersion


def _test_session_factory(db_session):
    return async_sessionmaker(
        db_session.bind, class_=type(db_session), expire_on_commit=False
    )


@pytest.mark.asyncio
async def test_pcp_list_empty(db_session: AsyncSession, monkeypatch):
    """pcp-list returns a message when no prompts exist."""
    from src.pcp_server.mcp import tools as tools_module

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_list()
    assert "No prompts" in result


@pytest.mark.asyncio
async def test_pcp_list_with_prompts(db_session: AsyncSession, monkeypatch):
    """pcp-list returns prompt names."""
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

    result = await pcp_list()
    assert "pcp-my-prompt" in result


@pytest.mark.asyncio
async def test_pcp_search_match(db_session: AsyncSession, monkeypatch):
    """pcp-search finds prompts by name."""
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

    result = await pcp_search("search")
    assert "pcp-search-target" in result


@pytest.mark.asyncio
async def test_pcp_search_no_match(db_session: AsyncSession, monkeypatch):
    """pcp-search returns a message when nothing matches."""
    from src.pcp_server.mcp import tools as tools_module

    monkeypatch.setattr(tools_module, "async_session", _test_session_factory(db_session))

    result = await pcp_search("zzz-nonexistent")
    assert "No prompts matching" in result


def test_register_one_creates_tool():
    """_register_one adds a tool to the MCP server."""
    initial_count = len(mcp._tool_manager._tools)
    _register_one("unit-test-prompt", "A dynamically registered tool")
    new_count = len(mcp._tool_manager._tools)
    assert new_count == initial_count + 1
    assert "pcp-unit-test-prompt" in mcp._tool_manager._tools
