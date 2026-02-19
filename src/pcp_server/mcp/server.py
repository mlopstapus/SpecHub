from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    "Prompt Control Plane",
    instructions=(
        "PCP is a prompt registry. Use pcp-list to see available prompts, "
        "pcp-search to find prompts by tag or name, and pcp-{name} to expand "
        "a specific prompt with your input."
    ),
    streamable_http_path="/",
)
