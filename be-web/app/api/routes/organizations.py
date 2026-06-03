from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import get_current_user, get_organization_service, require_role
from app.domain.models.user import User
from app.schemas.organization import (
    CompanyRequestCreate,
    CompanyRequestResponse,
    OrganizationInviteAccept,
    OrganizationInviteAcceptResponse,
    OrganizationInviteCreate,
    OrganizationInviteResponse,
    OrganizationMeResponse,
)
from app.services.organization_service import OrganizationService

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("/me", response_model=OrganizationMeResponse)
def get_my_organization(
    current_user: User = Depends(get_current_user),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    return organization_service.get_current_organization(current_user)


@router.post(
    "/company-requests",
    response_model=CompanyRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_company_request(
    data: CompanyRequestCreate,
    current_user: User = Depends(require_role("hr")),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    return organization_service.create_company_request(current_user, data)


@router.post(
    "/invites",
    response_model=OrganizationInviteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invite(
    data: OrganizationInviteCreate,
    current_user: User = Depends(require_role("hr")),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    return organization_service.create_invite(current_user, data)


@router.post("/invites/accept", response_model=OrganizationInviteAcceptResponse)
def accept_invite(
    data: OrganizationInviteAccept,
    current_user: User = Depends(require_role("hr")),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    return organization_service.accept_invite(current_user, data.token)
