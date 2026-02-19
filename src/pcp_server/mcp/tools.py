"""
Dynamic MCP tool registration for PCP prompts.

Each prompt in the registry becomes a `pcp-{name}` MCP tool.
Static utility tools: `pcp-list`, `pcp-search`, `pcp-context`.
"""

import json
import uuid as uuid_mod

from src.pcp_server.database import async_session
from src.pcp_server.mcp.server import mcp
from src.pcp_server.schemas import ExpandRequest
from src.pcp_server.services import objective_service, policy_service, prompt_service


@mcp.tool(name="pcp-list")
async def pcp_list() -> str:
    """List all available prompts in the PCP registry."""
    async with async_session() as db:
        names = await prompt_service.get_all_prompt_names(db)
    if not names:
        return "No prompts registered yet."
    lines = ["Available prompts:"]
    for name in names:
        lines.append(f"  - pcp-{name}")
    return "\n".join(lines)


@mcp.tool(name="pcp-search")
async def pcp_search(query: str) -> str:
    """Search prompts by name or tag.

    Args:
        query: Search term to match against prompt names, descriptions, and tags.
    """
    async with async_session() as db:
        listing = await prompt_service.list_prompts(db, page=1, page_size=100)

    matches = []
    q = query.lower()
    for p in listing.items:
        name_match = q in p.name.lower()
        desc_match = p.description and q in p.description.lower()
        tag_match = p.latest_version and any(q in t.lower() for t in p.latest_version.tags)
        if name_match or desc_match or tag_match:
            desc = p.description or "No description"
            has_tags = p.latest_version and p.latest_version.tags
            tags = ", ".join(p.latest_version.tags) if has_tags else "none"
            matches.append(f"  - pcp-{p.name}: {desc} [tags: {tags}]")

    if not matches:
        return f"No prompts matching '{query}'."
    return f"Prompts matching '{query}':\n" + "\n".join(matches)


@mcp.tool(name="pcp-context")
async def pcp_context(user_id: str, project_id: str | None = None) -> str:
    """Show effective policies and objectives for a user, optionally within a project context.

    Args:
        user_id: UUID of the user to resolve context for.
        project_id: Optional UUID of the project to layer on top.
    """
    try:
        uid = uuid_mod.UUID(user_id)
    except ValueError:
        return "Error: invalid user_id UUID."
    pid = None
    if project_id:
        try:
            pid = uuid_mod.UUID(project_id)
        except ValueError:
            return "Error: invalid project_id UUID."

    async with async_session() as db:
        policies = await policy_service.resolve_effective(db, uid, pid)
        objectives = await objective_service.resolve_effective(db, uid, pid)

    lines = ["=== Effective Policies ==="]
    if policies.inherited:
        lines.append("Inherited (immutable):")
        for p in policies.inherited:
            lines.append(f"  - [{p.enforcement_type.value}] {p.name}: {p.content[:80]}")
    if policies.local:
        lines.append("Local (mutable):")
        for p in policies.local:
            lines.append(f"  - [{p.enforcement_type.value}] {p.name}: {p.content[:80]}")
    if not policies.inherited and not policies.local:
        lines.append("  (none)")

    lines.append("\n=== Effective Objectives ===")
    if objectives.inherited:
        lines.append("Inherited (immutable):")
        for o in objectives.inherited:
            lines.append(f"  - {o.title}")
    if objectives.local:
        lines.append("Local (mutable):")
        for o in objectives.local:
            lines.append(f"  - {o.title}")
    if not objectives.inherited and not objectives.local:
        lines.append("  (none)")

    return "\n".join(lines)


async def register_prompt_tools() -> None:
    """Dynamically register an MCP tool for each prompt in the DB."""
    async with async_session() as db:
        listing = await prompt_service.list_prompts(db, page=1, page_size=1000)

    for prompt in listing.items:
        _register_one(prompt.name, prompt.description)


def _register_one(prompt_name: str, description: str | None) -> None:
    """Register a single pcp-{name} tool."""
    tool_name = f"pcp-{prompt_name}"
    tool_description = description or f"Expand the '{prompt_name}' prompt with your input."

    async def _tool_fn(input: str, project: str | None = None) -> str:  # noqa: A002
        try:
            parsed = json.loads(input)
            if not isinstance(parsed, dict):
                parsed = {"input": input}
        except (json.JSONDecodeError, TypeError):
            parsed = {"input": input}

        project_id = None
        if project:
            try:
                project_id = uuid_mod.UUID(project)
            except ValueError:
                pass

        async with async_session() as db:
            result = await prompt_service.expand_prompt(
                db,
                prompt_name,
                ExpandRequest(input=parsed, project_id=project_id),
            )
        if not result:
            return f"Error: prompt '{prompt_name}' not found."

        parts = []
        if result.system_message:
            parts.append(f"[System]\n{result.system_message}")
        parts.append(f"[User]\n{result.user_message}")
        if result.applied_policies:
            parts.append(f"[Policies Applied]\n{', '.join(result.applied_policies)}")
        return "\n\n".join(parts)

    _tool_fn.__name__ = tool_name
    _tool_fn.__qualname__ = tool_name
    _tool_fn.__doc__ = tool_description

    mcp.tool(name=tool_name)(_tool_fn)
