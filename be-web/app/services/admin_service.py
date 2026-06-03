"""
Admin service — aggregates data from all repositories for platform-wide oversight.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config.audit import AUDIT_LOG_TIMEOUT, AUDIT_LOG_URL
from app.config.settings import get_settings
from app.domain.models.application import ApplicationDraft
from app.domain.models.notification import Notification
from app.domain.models.organization import OrganizationInvite, OrganizationMember
from app.domain.models.opportunity import Opportunity
from app.repositories.user_repository import UserRepository
from app.repositories.company_repository import CompanyRepository
from app.repositories.opportunity_repository import OpportunityRepository
from app.repositories.application_repository import ApplicationRepository
from app.services.security_service import security_service


class AdminService:
    """Service handling admin-specific business logic."""

    def __init__(
        self,
        user_repo: UserRepository,
        company_repo: CompanyRepository,
        opportunity_repo: OpportunityRepository,
        application_repo: ApplicationRepository,
    ):
        self._user_repo = user_repo
        self._company_repo = company_repo
        self._opportunity_repo = opportunity_repo
        self._application_repo = application_repo

    # ── Platform Stats ───────────────────────────────────────

    def get_stats(self) -> dict:
        """Return platform-wide statistics for the admin dashboard."""
        total_users = self._user_repo.count()
        total_companies = self._company_repo.count()
        total_opportunities = self._opportunity_repo.count()
        total_applications = self._application_repo.count()

        # Count by role
        all_users = self._user_repo.get_all(skip=0, limit=100000)
        students = [u for u in all_users if u.role.value == "student"]
        hr_users = [u for u in all_users if u.role.value == "hr"]
        active_users = [u for u in all_users if u.is_active]

        # Count applications by status
        all_apps = self._application_repo.get_all(skip=0, limit=100000)
        status_counts = {}
        for app in all_apps:
            s = app.status.value if hasattr(app.status, "value") else str(app.status)
            status_counts[s] = status_counts.get(s, 0) + 1

        return {
            "total_users": total_users,
            "total_students": len(students),
            "total_hr": len(hr_users),
            "active_users": len(active_users),
            "total_companies": total_companies,
            "total_opportunities": total_opportunities,
            "total_applications": total_applications,
            "application_status_breakdown": status_counts,
        }

    # ── User Management ──────────────────────────────────────

    def list_users(
        self,
        skip: int = 0,
        limit: int = 50,
        role: str | None = None,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> dict:
        """List all users with optional filters."""
        from app.domain.models.user import User

        query = self._user_repo._db.query(User)

        if role:
            query = query.filter(User.role == role)
        if is_active is not None:
            query = query.filter(User.is_active == is_active)
        if search:
            term = f"%{search}%"
            query = query.filter(
                (User.first_name.ilike(term))
                | (User.last_name.ilike(term))
                | (User.email.ilike(term))
            )

        total = query.count()
        items = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": items, "total": total}

    def toggle_user_active(self, user_id: int) -> dict:
        """Toggle a user's is_active status."""
        user = self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.is_active = not user.is_active
        self._user_repo._db.commit()
        self._user_repo._db.refresh(user)
        return {"id": user.id, "is_active": user.is_active}

    def delete_user(self, user_id: int) -> dict:
        """Delete a user permanently, cleaning up rows that bypass ORM cascades.

        The User model declares `cascade="all, delete-orphan"` on
        applications / bookmarks / company_follows / externships /
        resume_profiles / logbooks / organization_memberships, so the ORM
        takes care of those. The remaining FKs (opportunities.created_by_user_id,
        notifications.user_id, application_drafts.student_id,
        organization_invites.{accepted,created}_by_user_id) are NOT cascaded
        and use ON DELETE NO ACTION, so we must clean them up explicitly
        before the user row can go.
        """
        db = self._user_repo._db
        user = self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        db.query(Opportunity).filter(Opportunity.created_by_user_id == user_id).update(
            {Opportunity.created_by_user_id: None}, synchronize_session=False
        )
        db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
        db.query(ApplicationDraft).filter(ApplicationDraft.student_id == user_id).delete(synchronize_session=False)
        db.query(OrganizationInvite).filter(OrganizationInvite.accepted_by_user_id == user_id).delete(synchronize_session=False)
        db.query(OrganizationInvite).filter(OrganizationInvite.created_by_user_id == user_id).delete(synchronize_session=False)
        db.query(OrganizationMember).filter(OrganizationMember.invited_by_user_id == user_id).delete(synchronize_session=False)
        db.query(OrganizationMember).filter(OrganizationMember.user_id == user_id).delete(synchronize_session=False)

        try:
            db.delete(user)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "User has related records that could not be removed automatically. "
                    "Deactivate the user instead, or contact engineering."
                ),
            ) from exc
        return {"deleted": True}

    # ── Company Management ───────────────────────────────────

    def list_companies(self, skip: int = 0, limit: int = 50) -> dict:
        """List all companies."""
        from app.domain.models.company import Company

        query = self._company_repo._db.query(Company)
        total = query.count()
        items = query.order_by(Company.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": items, "total": total}

    def delete_company(self, company_id: int) -> dict:
        """Delete a company permanently."""
        deleted = self._company_repo.delete(company_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Company not found")
        return {"deleted": True}

    def update_company(self, company_id: int, data) -> dict:
        """Update a company's profile (admin override, no ownership check)."""
        from app.schemas.company import CompanyResponse

        company = self._company_repo.get_by_id(company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        updated = self._company_repo.update(company, data.model_dump(exclude_unset=True))
        return CompanyResponse.model_validate(updated)

    # ── Opportunity Management ───────────────────────────────

    def list_opportunities(self, skip: int = 0, limit: int = 50) -> dict:
        """List all opportunities."""
        from app.domain.models.opportunity import Opportunity

        query = self._opportunity_repo._db.query(Opportunity)
        total = query.count()
        items = query.order_by(Opportunity.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": items, "total": total}

    def delete_opportunity(self, opportunity_id: int) -> dict:
        """Delete an opportunity permanently."""
        deleted = self._opportunity_repo.delete(opportunity_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        return {"deleted": True}

    def verify_application_signature(self, application_id: int) -> dict:
        """Verify the stored non-repudiation signature for an application event."""
        application = self._application_repo.get_by_id(application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        if not application.signature_payload or not application.digital_signature:
            return {
                "application_id": application_id,
                "valid": False,
                "reason": "Application has no stored signature payload/signature yet.",
                "algorithm": application.signature_algorithm,
            }

        try:
            payload = json.loads(application.signature_payload)
        except json.JSONDecodeError:
            return {
                "application_id": application_id,
                "valid": False,
                "reason": "Stored signature payload is not valid JSON.",
                "algorithm": application.signature_algorithm,
            }

        valid = security_service.verify_signature(payload, application.digital_signature)
        return {
            "application_id": application_id,
            "valid": valid,
            "reason": "Signature matches stored payload." if valid else "Signature does not match stored payload.",
            "algorithm": application.signature_algorithm,
            "payload": payload,
            "public_key": security_service.public_key_pem(),
        }

    def get_audit_events(self, limit: int = 200) -> dict:
        """Fetch recent audit events through the admin backend boundary."""
        return self._request_audit_service(f"/logs/recent?limit={limit}")

    def verify_audit_chain(self) -> dict:
        """Verify the audit service hash chain through the admin backend boundary."""
        return self._request_audit_service("/audit/verify-chain")

    def edit_audit_entry(self, body: dict) -> dict:
        """DEV TOOLS: edit an audit log entry by eventHash."""
        return self._request_audit_service("/audit/edit-entry", method="POST", body=body)

    def reset_audit_logs(self) -> dict:
        """DEV TOOLS: restore audit logs from backup."""
        return self._request_audit_service("/audit/reset-logs", method="POST")

    def clear_all_audit_logs(self) -> dict:
        """DEV TOOLS: clear/delete all audit logs completely."""
        return self._request_audit_service("/audit/clear-all-logs", method="POST")

    def _request_audit_service(self, path: str, method: str = "GET", body: dict | None = None) -> dict:
        base_url = AUDIT_LOG_URL.rsplit("/log", 1)[0]
        url = f"{base_url}{path}"
        headers = {"Accept": "application/json"}
        dashboard_key = get_settings().AUDIT_DASHBOARD_KEY
        if dashboard_key:
            headers["X-Audit-Dashboard-Key"] = dashboard_key

        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(url, headers=headers, method=method, data=data)
        try:
            with urllib.request.urlopen(req, timeout=AUDIT_LOG_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise HTTPException(
                status_code=exc.code,
                detail=f"Audit service rejected request: {exc.reason}",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Audit service unavailable: {exc}",
            ) from exc
