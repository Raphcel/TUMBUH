from fastapi import APIRouter, Depends, Query, Response, status

from app.domain.models.user import User
from app.services.application_service import ApplicationService
from app.services.organization_service import OrganizationService
from app.schemas.application import (
    ApplicationCreate, ApplicationDraftSave, ApplicationSubmissionUpdate,
    ApplicationStatusUpdate,
    BulkApplicationStatusUpdate, ApplicationResponse, ApplicationDraftResponse,
    ApplicationListResponse,
)
from app.api.dependencies import (
    get_application_service, get_current_user, get_organization_service, require_role,
)

router = APIRouter(prefix="/applications", tags=["Applications"])


# ── Student Endpoints ────────────────────────────────────────

@router.post("/", response_model=ApplicationResponse, status_code=201)
def apply_to_opportunity(
    data: ApplicationCreate,
    current_user: User = Depends(require_role("student")),
    application_service: ApplicationService = Depends(get_application_service),
):
    """Submit an application to an opportunity (student only)."""
    return application_service.apply(current_user.id, data)


@router.get("/me", response_model=ApplicationListResponse)
def my_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(require_role("student")),
    application_service: ApplicationService = Depends(get_application_service),
):
    """List all applications for the current student."""
    return application_service.get_student_applications(current_user.id, skip, limit)


@router.get("/drafts", response_model=list[ApplicationDraftResponse])
def list_application_drafts(
    current_user: User = Depends(require_role("student")),
    application_service: ApplicationService = Depends(get_application_service),
):
    """List the current student's in-progress application drafts."""
    return application_service.get_student_drafts(current_user.id)


@router.get("/drafts/{opportunity_id}", response_model=ApplicationDraftResponse | None)
def get_application_draft(
    opportunity_id: int,
    current_user: User = Depends(require_role("student")),
    application_service: ApplicationService = Depends(get_application_service),
):
    """Get the current student's in-progress application draft."""
    return application_service.get_student_draft(current_user.id, opportunity_id)


@router.put("/drafts/{opportunity_id}", response_model=ApplicationDraftResponse)
def save_application_draft(
    opportunity_id: int,
    data: ApplicationDraftSave,
    current_user: User = Depends(require_role("student")),
    application_service: ApplicationService = Depends(get_application_service),
):
    """Create or update the current student's in-progress application draft."""
    return application_service.save_student_draft(current_user.id, opportunity_id, data)


@router.delete("/drafts/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application_draft(
    opportunity_id: int,
    current_user: User = Depends(require_role("student")),
    application_service: ApplicationService = Depends(get_application_service),
):
    """Delete the current student's in-progress application draft."""
    application_service.delete_student_draft(current_user.id, opportunity_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me/{application_id}", response_model=ApplicationResponse)
def update_my_application(
    application_id: int,
    data: ApplicationSubmissionUpdate,
    current_user: User = Depends(require_role("student")),
    application_service: ApplicationService = Depends(get_application_service),
):
    """Update the current student's submitted application before the deadline."""
    return application_service.update_student_submission(current_user.id, application_id, data)


# ── HR Endpoints ─────────────────────────────────────────────

@router.get("/opportunity/{opportunity_id}", response_model=ApplicationListResponse)
def list_applicants(
    opportunity_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(require_role("hr")),
    application_service: ApplicationService = Depends(get_application_service),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    """List all applicants for a specific opportunity (HR only, own company)."""
    company_id = application_service.get_company_id_for_opportunity(opportunity_id)
    organization_service.require_permission(current_user, company_id, "review_applicants")
    return application_service.get_opportunity_applications(opportunity_id, skip, limit)


@router.patch("/bulk-status", response_model=list[ApplicationResponse])
def bulk_update_status(
    data: BulkApplicationStatusUpdate,
    current_user: User = Depends(require_role("hr")),
    application_service: ApplicationService = Depends(get_application_service),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    """Bulk update application statuses (HR only, own company)."""
    company_id = application_service.get_company_id_for_applications(data.application_ids)
    organization_service.require_permission(current_user, company_id, "review_applicants")
    return application_service.bulk_update_status(
        data.application_ids, data.status, company_id
    )


@router.patch("/{application_id}/status", response_model=ApplicationResponse)
def update_application_status(
    application_id: int,
    data: ApplicationStatusUpdate,
    current_user: User = Depends(require_role("hr")),
    application_service: ApplicationService = Depends(get_application_service),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    """Update an application's status (HR only, own company)."""
    company_id = application_service.get_company_id_for_application(application_id)
    organization_service.require_permission(current_user, company_id, "review_applicants")
    return application_service.update_status(application_id, data, company_id)
