import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.database import get_db
from src.pcp_server.schemas import (
    EffectiveObjectivesResponse,
    ObjectiveCreate,
    ObjectiveResponse,
    ObjectiveUpdate,
)
from src.pcp_server.services import objective_service

router = APIRouter(prefix="/api/v1/objectives", tags=["objectives"])


@router.post("", response_model=ObjectiveResponse, status_code=201)
async def create_objective(data: ObjectiveCreate, db: AsyncSession = Depends(get_db)):
    return await objective_service.create_objective(db, data)


@router.get("/effective", response_model=EffectiveObjectivesResponse)
async def get_effective_objectives(
    user_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await objective_service.resolve_effective(db, user_id, project_id)


@router.get("/{objective_id}", response_model=ObjectiveResponse)
async def get_objective(objective_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await objective_service.get_objective(db, objective_id)
    if not result:
        raise HTTPException(status_code=404, detail="Objective not found")
    return result


@router.put("/{objective_id}", response_model=ObjectiveResponse)
async def update_objective(
    objective_id: uuid.UUID, data: ObjectiveUpdate, db: AsyncSession = Depends(get_db)
):
    result = await objective_service.update_objective(db, objective_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Objective not found")
    return result


@router.delete("/{objective_id}", status_code=204)
async def delete_objective(objective_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    deleted = await objective_service.delete_objective(db, objective_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Objective not found")
