from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.domain.models.user import User
from app.domain.models.opportunity import OpportunityType
from app.services.opportunity_service import OpportunityService
from app.schemas.opportunity import (
    OpportunityCreate, OpportunityUpdate, OpportunityResponse, OpportunityListResponse,
)
from app.api.dependencies import get_opportunity_service, require_role

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])


@router.get("/", response_model=OpportunityListResponse)
def list_opportunities(
    search: str | None = Query(None, description="Search by title"),
    type: OpportunityType | None = Query(None, description="Filter by type"),
    location: str | None = Query(None, description="Filter by location"),
    sort: str = Query("latest", pattern="^(latest|oldest|deadline)$"),
    company_id: int | None = Query(None, description="Filter by company_id"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    opportunity_service: OpportunityService = Depends(get_opportunity_service),
):
    """List and search opportunities with optional filters."""
    return opportunity_service.list_opportunities(search, type, location, sort, company_id, skip, limit)


@router.get("/{opportunity_id}", response_model=OpportunityResponse)
def get_opportunity(
    opportunity_id: int,
    opportunity_service: OpportunityService = Depends(get_opportunity_service),
):
    """Get a single opportunity by ID."""
    return opportunity_service.get_opportunity(opportunity_id)


@router.get("/company/{company_id}", response_model=OpportunityListResponse)
def get_company_opportunities(
    company_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    opportunity_service: OpportunityService = Depends(get_opportunity_service),
):
    """List all opportunities for a specific company."""
    return opportunity_service.get_by_company(company_id, skip, limit)


@router.post("/", response_model=OpportunityResponse, status_code=201)
def create_opportunity(
    data: OpportunityCreate,
    current_user: User = Depends(require_role("hr")),
    opportunity_service: OpportunityService = Depends(get_opportunity_service),
):
    """Create a new opportunity (HR only, forced to own company)."""
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must be associated with a company")
    data.company_id = current_user.company_id
    return opportunity_service.create_opportunity(data)


@router.put("/{opportunity_id}", response_model=OpportunityResponse)
def update_opportunity(
    opportunity_id: int,
    data: OpportunityUpdate,
    current_user: User = Depends(require_role("hr")),
    opportunity_service: OpportunityService = Depends(get_opportunity_service),
):
    """Update an opportunity (HR only, own company)."""
    opportunity_service.verify_ownership(opportunity_id, current_user.company_id)
    return opportunity_service.update_opportunity(opportunity_id, data)


@router.delete("/{opportunity_id}")
def delete_opportunity(
    opportunity_id: int,
    current_user: User = Depends(require_role("hr")),
    opportunity_service: OpportunityService = Depends(get_opportunity_service),
):
    """Delete an opportunity (HR only, own company)."""
    opportunity_service.verify_ownership(opportunity_id, current_user.company_id)
    return opportunity_service.delete_opportunity(opportunity_id)
