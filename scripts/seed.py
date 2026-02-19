"""Load example prompts from prompts/ directory into the database."""

import asyncio
import sys
from pathlib import Path

import yaml
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.pcp_server.database import async_session, engine
from src.pcp_server.models import Base, Prompt, PromptVersion


async def seed():
    prompts_dir = Path(__file__).resolve().parent.parent / "prompts"
    if not prompts_dir.exists():
        print(f"No prompts directory found at {prompts_dir}")
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yaml_files = sorted(prompts_dir.glob("*.yaml"))
    if not yaml_files:
        print("No YAML files found in prompts/")
        return

    async with async_session() as db:
        for path in yaml_files:
            data = yaml.safe_load(path.read_text())
            name = data["name"]

            result = await db.execute(select(Prompt).where(Prompt.name == name))
            if result.scalar_one_or_none():
                print(f"  skip: {name} (already exists)")
                continue

            prompt = Prompt(name=name, description=data.get("description"))
            db.add(prompt)
            await db.flush()

            version = PromptVersion(
                prompt_id=prompt.id,
                version=data.get("version", "1.0.0"),
                system_template=data.get("system_template"),
                user_template=data["user_template"],
                input_schema=data.get("input_schema", {}),
                tags=data.get("tags", []),
            )
            db.add(version)
            print(f"  added: {name} v{version.version}")

        await db.commit()

    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
