"""
Admin API routes — platform-wide management endpoints.
All endpoints require 'admin' role.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.domain.models.user import User
from app.services.admin_service import AdminService
from app.services.organization_service import OrganizationService
from app.schemas.user import UserResponse
from app.schemas.company import CompanyResponse, CompanyUpdate
from app.schemas.opportunity import OpportunityResponse
from app.schemas.organization import CompanyRequestListResponse, CompanyRequestResponse
from app.api.dependencies import require_role, get_admin_service, get_organization_service

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Stats ────────────────────────────────────────────────────

@router.get("/stats")
def get_platform_stats(
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """Get platform-wide statistics for the admin dashboard."""
    return service.get_stats()


# ── User Management ─────────────────────────────────────────

@router.get("/users")
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """List all users with optional filters."""
    result = service.list_users(skip=skip, limit=limit, role=role, search=search, is_active=is_active)
    return {
        "items": [UserResponse.model_validate(u) for u in result["items"]],
        "total": result["total"],
    }


@router.patch("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """Toggle a user's active status."""
    return service.toggle_user_active(user_id)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """Delete a user permanently."""
    return service.delete_user(user_id)


# ── Company Management ──────────────────────────────────────

@router.get("/companies")
def list_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """List all companies."""
    result = service.list_companies(skip=skip, limit=limit)
    return {
        "items": [CompanyResponse.model_validate(c) for c in result["items"]],
        "total": result["total"],
    }


@router.get("/company-requests", response_model=CompanyRequestListResponse)
def list_company_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: User = Depends(require_role("admin")),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    return organization_service.list_company_requests(skip=skip, limit=limit)


@router.patch("/company-requests/{company_id}/approve", response_model=CompanyRequestResponse)
def approve_company_request(
    company_id: int,
    admin_user: User = Depends(require_role("admin")),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    return organization_service.approve_company_request(company_id, admin_user)


@router.put("/companies/{company_id}")
def update_company(
    company_id: int,
    data: CompanyUpdate,
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """Update a company's profile (admin override, no ownership check)."""
    return service.update_company(company_id, data)


@router.delete("/companies/{company_id}")
def delete_company(
    company_id: int,
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """Delete a company permanently."""
    return service.delete_company(company_id)


# ── Opportunity Management ──────────────────────────────────

@router.get("/opportunities")
def list_opportunities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """List all opportunities."""
    result = service.list_opportunities(skip=skip, limit=limit)
    return {
        "items": [OpportunityResponse.model_validate(o) for o in result["items"]],
        "total": result["total"],
    }


@router.delete("/opportunities/{opportunity_id}")
def delete_opportunity(
    opportunity_id: int,
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """Delete an opportunity permanently."""
    return service.delete_opportunity(opportunity_id)


# â”€â”€ Security Verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/security/applications/{application_id}/signature")
def verify_application_signature(
    application_id: int,
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """Verify a stored application digital signature. Admin-only."""
    return service.verify_application_signature(application_id)


@router.get("/security/audit/events")
def get_audit_events(
    limit: int = Query(200, ge=1, le=500),
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """Read recent audit events through the admin dashboard. Admin-only."""
    return service.get_audit_events(limit)


@router.get("/security/audit/verify-chain")
def verify_audit_chain(
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """Verify audit log hash-chain integrity. Admin-only."""
    return service.verify_audit_chain()


@router.post("/security/audit/edit-entry")
def edit_audit_entry(
    body: dict,
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """DEV TOOLS: edit an audit log entry by eventHash. Admin-only."""
    return service.edit_audit_entry(body)


@router.post("/security/audit/reset-logs")
def reset_audit_logs(
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """DEV TOOLS: restore audit logs from backup. Admin-only."""
    return service.reset_audit_logs()


@router.post("/security/audit/clear-all-logs")
def clear_all_audit_logs(
    _: User = Depends(require_role("admin")),
    service: AdminService = Depends(get_admin_service),
):
    """DEV TOOLS: delete/clear all audit logs completely. Admin-only."""
    return service.clear_all_audit_logs()
