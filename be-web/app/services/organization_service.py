import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

from fastapi import HTTPException, status

from app.config.settings import get_settings
from app.domain.models.company import Company, CompanyStatus
from app.domain.models.organization import (
    OrganizationInvite,
    OrganizationInviteStatus,
    OrganizationMember,
    OrganizationMemberRole,
    OrganizationMemberStatus,
)
from app.domain.models.user import User, UserRole
from app.repositories.company_repository import CompanyRepository
from app.repositories.organization_repository import (
    CompanyRequestRepository,
    OrganizationInviteRepository,
    OrganizationMemberRepository,
)
from app.repositories.user_repository import UserRepository
from app.schemas.company import CompanyResponse
from app.schemas.organization import (
    CompanyRequestCreate,
    CompanyRequestListResponse,
    CompanyRequestResponse,
    OrganizationInviteAcceptResponse,
    OrganizationInviteCreate,
    OrganizationInviteResponse,
    OrganizationMeResponse,
    OrganizationMemberDetailResponse,
    OrganizationMemberResponse,
    ROLE_PERMISSIONS,
)
from app.services.audit_service import audit_log
from app.services.email_service import EmailService


class OrganizationService:
    def __init__(
        self,
        company_repo: CompanyRepository,
        member_repo: OrganizationMemberRepository,
        invite_repo: OrganizationInviteRepository,
        company_request_repo: CompanyRequestRepository,
        user_repo: UserRepository,
        email_service: EmailService | None = None,
    ):
        self._company_repo = company_repo
        self._member_repo = member_repo
        self._invite_repo = invite_repo
        self._company_request_repo = company_request_repo
        self._user_repo = user_repo
        self._email_service = email_service

    def get_current_organization(self, user: User) -> OrganizationMeResponse:
        membership = self._member_repo.get_active_by_user(user.id) or self._member_repo.get_primary_by_user(user.id)
        if membership:
            return OrganizationMeResponse(
                company=CompanyResponse.model_validate(membership.company),
                membership=OrganizationMemberResponse.model_validate(membership),
                members=self._members_response(membership.company_id, user),
                onboarding_required=membership.status != OrganizationMemberStatus.ACTIVE,
            )

        legacy = self._legacy_membership_response(user)
        if legacy:
            return legacy
        return OrganizationMeResponse(onboarding_required=user.role == UserRole.HR)

    def active_membership_response(self, user: User) -> OrganizationMemberResponse | None:
        membership = self._member_repo.get_active_by_user(user.id)
        if membership:
            return OrganizationMemberResponse.model_validate(membership)
        legacy = self._legacy_membership_response(user)
        return legacy.membership if legacy else None

    def resolve_company_id(self, user: User) -> int | None:
        membership = self._member_repo.get_active_by_user(user.id)
        if membership:
            return membership.company_id
        return user.company_id

    def require_permission(self, user: User, company_id: int, permission: str) -> OrganizationMemberResponse:
        if user.role != UserRole.HR:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="HR access required")
        membership = self._member_repo.get_by_user_and_company(user.id, company_id)
        if membership and membership.status == OrganizationMemberStatus.ACTIVE:
            response = OrganizationMemberResponse.model_validate(membership)
            if permission in response.permissions:
                return response
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission for this action")
        if user.company_id == company_id:
            return self._legacy_owner_membership(user, company_id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this company")

    def create_company_request(self, user: User, data: CompanyRequestCreate) -> CompanyRequestResponse:
        if user.role != UserRole.HR:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR users can create company requests")
        if self.resolve_company_id(user):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already belong to an organization")
        if self._company_repo.get_by_name(data.name):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company with this name already exists")

        company_data = data.model_dump()
        company_data["status"] = CompanyStatus.PENDING
        company = self._company_repo.create(company_data)
        membership = self._member_repo.create({
            "company_id": company.id,
            "user_id": user.id,
            "role": OrganizationMemberRole.OWNER,
            "status": OrganizationMemberStatus.PENDING,
            "permissions": ROLE_PERMISSIONS[OrganizationMemberRole.OWNER],
        })
        audit_log(
            "ORGANIZATION_COMPANY_REQUEST",
            user_id=user.id,
            user_role=user.role.value,
            resource="company",
            resource_id=company.id,
            detail=f"Company request submitted: {company.name}",
            success=True,
        )
        return CompanyRequestResponse(
            company=CompanyResponse.model_validate(company),
            membership=OrganizationMemberResponse.model_validate(membership),
        )

    def list_company_requests(self, skip: int = 0, limit: int = 100) -> CompanyRequestListResponse:
        items, total = self._company_request_repo.list_pending(skip, limit)
        return CompanyRequestListResponse(
            items=[CompanyResponse.model_validate(company) for company in items],
            total=total,
        )

    def approve_company_request(self, company_id: int, admin: User) -> CompanyRequestResponse:
        company = self._company_repo.get_by_id(company_id)
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company request not found")
        if company.status != CompanyStatus.PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company request is not pending")
        membership = self._member_repo.get_pending_owner_by_company(company_id)
        if not membership:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company request has no owner membership")

        company = self._company_repo.update(company, {"status": CompanyStatus.APPROVED})
        membership = self._member_repo.update(membership, {"status": OrganizationMemberStatus.ACTIVE})
        user = self._user_repo.get_by_id(membership.user_id)
        if user:
            self._user_repo.update(user, {"company_id": company.id})
        audit_log(
            "ORGANIZATION_COMPANY_APPROVE",
            user_id=admin.id,
            user_role=admin.role.value,
            resource="company",
            resource_id=company.id,
            detail=f"Company request approved: {company.name}",
            success=True,
        )
        return CompanyRequestResponse(
            company=CompanyResponse.model_validate(company),
            membership=OrganizationMemberResponse.model_validate(membership),
        )

    def create_invite(self, user: User, data: OrganizationInviteCreate) -> OrganizationInviteResponse:
        company_id = self.resolve_company_id(user)
        if not company_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must belong to an organization")
        self.require_permission(user, company_id, "manage_invites")
        token = secrets.token_urlsafe(24)
        invite = self._invite_repo.create({
            "company_id": company_id,
            "token_hash": self._hash_token(token),
            "email": str(data.email) if data.email else None,
            "role": data.role,
            "permissions": ROLE_PERMISSIONS[data.role],
            "status": OrganizationInviteStatus.PENDING,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=data.expires_in_days),
            "created_by_user_id": user.id,
        })
        invite_url = self._invite_url(token)
        email_sent = self._send_invite_email(
            invite,
            invite_url,
            inviter=user,
            expires_in_days=data.expires_in_days,
        )
        if email_sent:
            invite = self._invite_repo.update(invite, {"is_email_sent": True})
        return self._invite_response(invite, token, invite_url)

    def accept_invite(self, user: User, token: str) -> OrganizationInviteAcceptResponse:
        invite = self._invite_repo.get_by_token_hash(self._hash_token(token))
        if not invite:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
        if invite.status != OrganizationInviteStatus.PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite is no longer valid")
        expires_at = invite.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            self._invite_repo.update(invite, {"status": OrganizationInviteStatus.EXPIRED})
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has expired")
        if invite.email and invite.email.lower() != user.email.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite is restricted to another email")

        existing = self._member_repo.get_by_user_and_company(user.id, invite.company_id)
        if existing and existing.status == OrganizationMemberStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already a member")
        membership_data = {
            "company_id": invite.company_id,
            "user_id": user.id,
            "role": invite.role,
            "status": OrganizationMemberStatus.ACTIVE,
            "permissions": invite.permissions,
            "invited_by_user_id": invite.created_by_user_id,
        }
        membership = (
            self._member_repo.update(existing, membership_data)
            if existing
            else self._member_repo.create(membership_data)
        )
        self._invite_repo.update(invite, {
            "status": OrganizationInviteStatus.ACCEPTED,
            "accepted_by_user_id": user.id,
            "accepted_at": datetime.now(timezone.utc),
        })
        if not user.company_id:
            self._user_repo.update(user, {"company_id": invite.company_id})
        return OrganizationInviteAcceptResponse(
            company=CompanyResponse.model_validate(invite.company),
            membership=OrganizationMemberResponse.model_validate(membership),
        )

    def _legacy_membership_response(self, user: User) -> OrganizationMeResponse | None:
        if not user.company_id:
            return None
        company = self._company_repo.get_by_id(user.company_id)
        if not company or company.status != CompanyStatus.APPROVED:
            return None
        return OrganizationMeResponse(
            company=CompanyResponse.model_validate(company),
            membership=self._legacy_owner_membership(user, company.id),
            members=self._members_response(company.id, user),
            onboarding_required=False,
        )

    @staticmethod
    def _legacy_owner_membership(user: User, company_id: int) -> OrganizationMemberResponse:
        return OrganizationMemberResponse(
            id=None,
            company_id=company_id,
            user_id=user.id,
            role=OrganizationMemberRole.OWNER,
            status=OrganizationMemberStatus.ACTIVE,
            permissions=ROLE_PERMISSIONS[OrganizationMemberRole.OWNER],
        )

    def _members_response(self, company_id: int, current_user: User) -> list[OrganizationMemberDetailResponse]:
        members = self._member_repo.list_by_company(company_id)
        if members:
            return [OrganizationMemberDetailResponse.model_validate(member) for member in members]
        if current_user.company_id == company_id:
            membership = self._legacy_owner_membership(current_user, company_id)
            return [
                OrganizationMemberDetailResponse(
                    **membership.model_dump(),
                    user=current_user,
                )
            ]
        return []

    def _send_invite_email(
        self,
        invite: OrganizationInvite,
        invite_url: str,
        *,
        inviter: User | None = None,
        expires_in_days: int = 7,
    ) -> bool:
        if not invite.email or not self._email_service:
            return False
        company_name = invite.company.name if invite.company else "a TUMBUH organization"
        inviter_name = (
            inviter.full_name.strip() if inviter and inviter.full_name else "A teammate"
        )
        role_label = (
            invite.role.value.replace("_", " ").title()
            if hasattr(invite.role, "value")
            else str(invite.role)
        )
        return self._email_service.send_invitation_email(
            invite.email,
            invite.email,  # No name on invite; recipient is identified by email
            inviter_name=inviter_name,
            org_name=company_name,
            role_label=role_label,
            accept_url=invite_url,
            expires_days=expires_in_days,
        )

    @staticmethod
    def _invite_response(invite: OrganizationInvite, token: str, invite_url: str) -> OrganizationInviteResponse:
        return OrganizationInviteResponse(
            id=invite.id,
            company_id=invite.company_id,
            email=invite.email,
            role=invite.role,
            status=invite.status,
            expires_at=invite.expires_at,
            token=token,
            invite_url=invite_url,
        )

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _invite_url(token: str) -> str:
        return urljoin(get_settings().FRONTEND_URL.rstrip("/") + "/", f"hr/join?token={token}")
