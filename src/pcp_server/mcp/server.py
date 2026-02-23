from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    "Prompt Control Plane",
    instructions=(
        "PCP is a prompt registry. Use sh-list to see available prompts, "
        "sh-search to find prompts by tag or name, and sh-run to expand "
        "a specific prompt with your input (e.g. sh-run name='commit' input='...'). "
        "Use sh-workflow-list to see available workflows and sh-workflow-run to "
        "execute a multi-step prompt pipeline by name. "
        "When you authenticate with an API key, your team's policies and "
        "objectives are automatically injected into the first tool response "
        "of each session — no need to fetch them separately."
    ),
    streamable_http_path="/",
)
