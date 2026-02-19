import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PromptVersionCreate(BaseModel):
    version: str = Field(..., examples=["1.0.0"])
    system_template: str | None = None
    user_template: str = Field(..., examples=["Generate a PRD for: {{ feature_description }}"])
    input_schema: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class PromptCreate(BaseModel):
    name: str = Field(..., pattern=r"^[a-z0-9-]+$", examples=["feature-prd"])
    description: str | None = None
    version: PromptVersionCreate


class PromptVersionResponse(BaseModel):
    id: uuid.UUID
    prompt_id: uuid.UUID
    version: str
    system_template: str | None
    user_template: str
    input_schema: dict
    tags: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PromptResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_deprecated: bool
    created_at: datetime
    updated_at: datetime
    latest_version: PromptVersionResponse | None = None

    model_config = {"from_attributes": True}


class PromptListResponse(BaseModel):
    items: list[PromptResponse]
    total: int
    page: int
    page_size: int


class NewVersionCreate(BaseModel):
    version: str = Field(..., examples=["1.1.0"])
    system_template: str | None = None
    user_template: str
    input_schema: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class ExpandRequest(BaseModel):
    input: dict = Field(default_factory=dict)


class ExpandResponse(BaseModel):
    prompt_name: str
    prompt_version: str
    system_message: str | None
    user_message: str
