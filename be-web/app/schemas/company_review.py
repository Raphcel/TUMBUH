from datetime import datetime
from pydantic import BaseModel, Field


# ── Request Schemas ──────────────────────────────────────────

class CompanyReviewCreate(BaseModel):
    """Schema for submitting a review."""
    rating: int = Field(..., ge=1, le=5)
    content: str = Field(..., min_length=5, max_length=2000)


# ── Response Schemas ─────────────────────────────────────────

class CompanyReviewUserResponse(BaseModel):
    """Schema for user details attached to a review."""
    id: int
    first_name: str
    last_name: str
    avatar: str | None = None
    role: str

    class Config:
        from_attributes = True


class CompanyReviewResponse(BaseModel):
    """Schema for company review in API responses."""
    id: int
    company_id: int
    user_id: int
    rating: int
    content: str
    created_at: datetime
    updated_at: datetime
    user: CompanyReviewUserResponse

    class Config:
        from_attributes = True


class CompanyReviewListResponse(BaseModel):
    """Paginated list of company reviews."""
    items: list[CompanyReviewResponse]
    total: int
