from fastapi import APIRouter, Depends, Query

from app.domain.models.user import User
from app.services.company_service import CompanyService
from app.services.company_review_service import CompanyReviewService
from app.services.organization_service import OrganizationService
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyResponse, CompanyListResponse,
)
from app.schemas.company_review import CompanyReviewCreate, CompanyReviewResponse, CompanyReviewListResponse
from app.api.dependencies import (
    get_company_service,
    require_role,
    get_company_review_service,
    get_organization_service,
    get_current_user,
)

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("/", response_model=CompanyListResponse)
def list_companies(
    search: str | None = Query(None, description="Search by name or industry"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    company_service: CompanyService = Depends(get_company_service),
):
    """List all companies or search by name/industry."""
    if search:
        return company_service.search_companies(search, skip, limit)
    return company_service.list_companies(skip, limit)


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    company_service: CompanyService = Depends(get_company_service),
):
    """Get a single company by ID."""
    return company_service.get_company(company_id)


@router.post("/", response_model=CompanyResponse, status_code=201)
def create_company(
    data: CompanyCreate,
    current_user: User = Depends(require_role("hr")),
    company_service: CompanyService = Depends(get_company_service),
):
    """Create a new company (HR only)."""
    return company_service.create_company(data)


@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    data: CompanyUpdate,
    current_user: User = Depends(require_role("hr")),
    company_service: CompanyService = Depends(get_company_service),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    """Update company details (HR only, own company)."""
    organization_service.require_permission(current_user, company_id, "manage_company_profile")
    return company_service.update_company(company_id, data)


@router.delete("/{company_id}")
def delete_company(
    company_id: int,
    current_user: User = Depends(require_role("hr")),
    company_service: CompanyService = Depends(get_company_service),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    """Delete a company (HR only, own company)."""
    organization_service.require_permission(current_user, company_id, "manage_company_profile")
    return company_service.delete_company(company_id)


@router.get("/{company_id}/reviews", response_model=CompanyReviewListResponse)
def list_company_reviews(
    company_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    review_service: CompanyReviewService = Depends(get_company_review_service),
):
    """List all reviews for a company."""
    return review_service.list_reviews(company_id, skip, limit)


@router.post("/{company_id}/reviews", response_model=CompanyReviewResponse, status_code=201)
def create_company_review(
    company_id: int,
    data: CompanyReviewCreate,
    current_user: User = Depends(require_role("student")),
    review_service: CompanyReviewService = Depends(get_company_review_service),
):
    """Write a review for a company (Students only)."""
    return review_service.create_review(company_id, current_user.id, data)


@router.put("/{company_id}/reviews/{review_id}", response_model=CompanyReviewResponse)
def update_company_review(
    company_id: int,
    review_id: int,
    data: CompanyReviewCreate,
    current_user: User = Depends(get_current_user),
    review_service: CompanyReviewService = Depends(get_company_review_service),
):
    """Update a review (owner only)."""
    return review_service.update_review(company_id, review_id, current_user.id, data)


@router.delete("/{company_id}/reviews/{review_id}")
def delete_company_review(
    company_id: int,
    review_id: int,
    current_user: User = Depends(get_current_user),
    review_service: CompanyReviewService = Depends(get_company_review_service),
):
    """Delete a review (owner or admin only)."""
    is_admin = current_user.role.value == "admin"
    return review_service.delete_review(company_id, review_id, current_user.id, is_admin)
