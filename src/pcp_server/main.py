import contextlib
import logging

from fastapi import FastAPI

from src.pcp_server.config import settings
from src.pcp_server.mcp.server import mcp
from src.pcp_server.mcp.tools import register_prompt_tools
from src.pcp_server.routers.prompts import router as prompts_router

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger("pcp")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PCP server starting up")
    await register_prompt_tools()
    logger.info("MCP tools registered")
    async with mcp.session_manager.run():
        yield
    logger.info("PCP server shutting down")


app = FastAPI(
    title="Prompt Control Plane",
    description="An open-source, self-hosted prompt registry distributed via MCP",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(prompts_router)
app.mount("/mcp", mcp.streamable_http_app())


@app.get("/health")
async def health():
    return {"status": "ok"}
