import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.auth import require_admin
from src.pcp_server.database import get_db
from src.pcp_server.models import User
from src.pcp_server.schemas import (
    EffectivePoliciesResponse,
    PolicyCreate,
    PolicyResponse,
    PolicyUpdate,
)
from src.pcp_server.services import policy_service

router = APIRouter(prefix="/api/v1/policies", tags=["policies"])


@router.post("", response_model=PolicyResponse, status_code=201)
async def create_policy(
    data: PolicyCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await policy_service.create_policy(db, data)


@router.get("/effective", response_model=EffectivePoliciesResponse)
async def get_effective_policies(
    user_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await policy_service.resolve_effective(db, user_id, project_id)


@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(policy_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await policy_service.get_policy(db, policy_id)
    if not result:
        raise HTTPException(status_code=404, detail="Policy not found")
    return result


@router.put("/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    policy_id: uuid.UUID,
    data: PolicyUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await policy_service.update_policy(db, policy_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Policy not found")
    return result


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(
    policy_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    deleted = await policy_service.delete_policy(db, policy_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Policy not found")
