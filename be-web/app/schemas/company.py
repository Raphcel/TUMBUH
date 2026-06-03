from datetime import datetime
from pydantic import BaseModel, Field

from app.domain.models.company import CompanyStatus


# ── Request Schemas ──────────────────────────────────────────

class CompanyCreate(BaseModel):
    """Schema for creating a new company."""
    name: str = Field(..., max_length=200)
    industry: str = Field(..., max_length=100)
    location: str = Field(..., max_length=200)
    logo: str | None = None
    description: str | None = None
    website: str | None = None
    employee_count: int | None = None
    founded_year: int | None = None
    linkedin_url: str | None = None
    instagram_url: str | None = None
    tagline: str | None = None
    status: CompanyStatus = CompanyStatus.APPROVED


class CompanyUpdate(BaseModel):
    """Schema for updating company details."""
    name: str | None = None
    industry: str | None = None
    location: str | None = None
    logo: str | None = None
    description: str | None = None
    website: str | None = None
    employee_count: int | None = None
    founded_year: int | None = None
    linkedin_url: str | None = None
    instagram_url: str | None = None
    tagline: str | None = None


# ── Response Schemas ─────────────────────────────────────────

class CompanyResponse(BaseModel):
    """Schema for company data in API responses."""
    id: int
    name: str
    industry: str
    location: str
    logo: str | None = None
    description: str | None = None
    website: str | None = None
    rating: float | None = None
    employee_count: int | None = None
    founded_year: int | None = None
    linkedin_url: str | None = None
    instagram_url: str | None = None
    tagline: str | None = None
    status: CompanyStatus = CompanyStatus.APPROVED
    created_at: datetime

    class Config:
        from_attributes = True


class CompanyListResponse(BaseModel):
    """Paginated company list response."""
    items: list[CompanyResponse]
    total: int
