from jinja2 import StrictUndefined
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy import String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.pcp_server.models import Prompt, PromptVersion
from src.pcp_server.schemas import (
    ExpandRequest,
    ExpandResponse,
    NewVersionCreate,
    PromptCreate,
    PromptListResponse,
    PromptResponse,
    PromptVersionResponse,
)


def _prompt_response(prompt: Prompt) -> PromptResponse:
    latest = prompt.versions[0] if prompt.versions else None
    return PromptResponse(
        id=prompt.id,
        name=prompt.name,
        description=prompt.description,
        is_deprecated=prompt.is_deprecated,
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
        latest_version=PromptVersionResponse.model_validate(latest) if latest else None,
    )


async def create_prompt(db: AsyncSession, data: PromptCreate) -> PromptResponse:
    prompt = Prompt(name=data.name, description=data.description)
    db.add(prompt)
    await db.flush()

    version = PromptVersion(
        prompt_id=prompt.id,
        version=data.version.version,
        system_template=data.version.system_template,
        user_template=data.version.user_template,
        input_schema=data.version.input_schema,
        tags=data.version.tags,
    )
    db.add(version)
    await db.commit()

    result = await db.execute(
        select(Prompt).where(Prompt.id == prompt.id).options(selectinload(Prompt.versions))
    )
    prompt = result.scalar_one()
    return _prompt_response(prompt)


async def list_prompts(
    db: AsyncSession, page: int = 1, page_size: int = 20, tag: str | None = None
) -> PromptListResponse:
    query = select(Prompt).options(selectinload(Prompt.versions))
    count_query = select(func.count()).select_from(Prompt)

    if tag:
        query = query.join(Prompt.versions).where(
            PromptVersion.tags.cast(String).contains(tag)
        )
        count_query = (
            select(func.count(Prompt.id.distinct()))
            .select_from(Prompt)
            .join(Prompt.versions)
            .where(PromptVersion.tags.cast(String).contains(tag))
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Prompt.name)
    result = await db.execute(query)
    prompts = result.scalars().unique().all()

    return PromptListResponse(
        items=[_prompt_response(p) for p in prompts],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_prompt(db: AsyncSession, name: str) -> PromptResponse | None:
    result = await db.execute(
        select(Prompt).where(Prompt.name == name).options(selectinload(Prompt.versions))
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        return None
    return _prompt_response(prompt)


async def get_prompt_versions(db: AsyncSession, name: str) -> list[PromptVersionResponse] | None:
    result = await db.execute(
        select(Prompt).where(Prompt.name == name).options(selectinload(Prompt.versions))
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        return None
    return [PromptVersionResponse.model_validate(v) for v in prompt.versions]


async def create_version(
    db: AsyncSession, name: str, data: NewVersionCreate
) -> PromptVersionResponse | None:
    result = await db.execute(select(Prompt).where(Prompt.name == name))
    prompt = result.scalar_one_or_none()
    if not prompt:
        return None

    version = PromptVersion(
        prompt_id=prompt.id,
        version=data.version,
        system_template=data.system_template,
        user_template=data.user_template,
        input_schema=data.input_schema,
        tags=data.tags,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return PromptVersionResponse.model_validate(version)


async def deprecate_prompt(db: AsyncSession, name: str) -> bool:
    result = await db.execute(select(Prompt).where(Prompt.name == name))
    prompt = result.scalar_one_or_none()
    if not prompt:
        return False
    prompt.is_deprecated = True
    await db.commit()
    return True


async def expand_prompt(
    db: AsyncSession, name: str, data: ExpandRequest, version: str | None = None
) -> ExpandResponse | None:
    query = select(Prompt).where(Prompt.name == name).options(selectinload(Prompt.versions))
    result = await db.execute(query)
    prompt = result.scalar_one_or_none()
    if not prompt or not prompt.versions or prompt.is_deprecated:
        return None

    if version:
        pv = next((v for v in prompt.versions if v.version == version), None)
    else:
        pv = prompt.versions[0]

    if not pv:
        return None

    env = SandboxedEnvironment(undefined=StrictUndefined)

    system_message = None
    if pv.system_template:
        system_message = env.from_string(pv.system_template).render(**data.input)

    user_message = env.from_string(pv.user_template).render(**data.input)

    return ExpandResponse(
        prompt_name=prompt.name,
        prompt_version=pv.version,
        system_message=system_message,
        user_message=user_message,
    )


async def get_all_prompt_names(db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(Prompt.name).where(Prompt.is_deprecated.is_(False)).order_by(Prompt.name)
    )
    return list(result.scalars().all())
