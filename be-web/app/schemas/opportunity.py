from datetime import datetime
from pydantic import BaseModel, Field, field_validator
import json

from app.domain.models.opportunity import OpportunityType
from app.schemas.company import CompanyResponse


# ── Request Schemas ──────────────────────────────────────────

class OpportunityCreate(BaseModel):
    """Schema for creating a new opportunity."""
    title: str = Field(..., max_length=300)
    company_id: int | None = None
    created_by_user_id: int | None = None
    type: OpportunityType
    location: str = Field(..., max_length=200)
    salary: str | None = None
    description: str | None = None
    requirements: list[str] | None = None
    target_majors: list[str] = Field(default_factory=list)
    skill_tags: list[str] = Field(default_factory=list)
    application_questions: list[dict] = Field(default_factory=list)
    deadline: datetime | None = None
    is_active: bool = True


class OpportunityUpdate(BaseModel):
    """Schema for updating an opportunity."""
    title: str | None = None
    type: OpportunityType | None = None
    location: str | None = None
    salary: str | None = None
    description: str | None = None
    requirements: list[str] | None = None
    target_majors: list[str] | None = None
    skill_tags: list[str] | None = None
    application_questions: list[dict] | None = None
    deadline: datetime | None = None
    is_active: bool | None = None


# ── Response Schemas ─────────────────────────────────────────

class OpportunityResponse(BaseModel):
    """Schema for opportunity data in API responses."""
    id: int
    title: str
    company_id: int
    created_by_user_id: int | None = None
    type: OpportunityType
    location: str
    salary: str | None = None
    description: str | None = None
    requirements: list[str] | None = None
    target_majors: list[str] = Field(default_factory=list)
    skill_tags: list[str] = Field(default_factory=list)
    application_questions: list[dict] = Field(default_factory=list)
    is_active: bool = True
    posted_at: datetime | None = None
    deadline: datetime | None = None
    applicants_count: int = 0
    company: CompanyResponse | None = None

    @field_validator("requirements", mode="before")
    @classmethod
    def parse_requirements(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
            except json.JSONDecodeError:
                return []
            return parsed if isinstance(parsed, list) else []
        return v

    @field_validator("target_majors", "skill_tags", "application_questions", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
            except json.JSONDecodeError:
                return []
            return parsed if isinstance(parsed, list) else []
        return v

    class Config:
        from_attributes = True


class OpportunityListResponse(BaseModel):
    """Paginated opportunity list response."""
    items: list[OpportunityResponse]
    total: int
