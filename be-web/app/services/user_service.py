from fastapi import HTTPException, status

from app.domain.models.user import User, UserRole
from app.repositories.user_repository import UserRepository
from app.repositories.company_repository import CompanyRepository
from app.repositories.organization_repository import OrganizationMemberRepository
from app.schemas.user import UserUpdate, UserResponse
from app.services.audit_service import audit_log
from app.services.user_asset_service import (
    delete_managed_asset,
    ensure_asset_in_managed_location,
    is_managed_avatar_url,
    is_managed_cv_url,
)
from app.services.organization_service import OrganizationService


class UserService:
    """Service handling user profile business logic."""

    def __init__(
        self,
        user_repo: UserRepository,
        organization_member_repo: OrganizationMemberRepository | None = None,
        company_repo: CompanyRepository | None = None,
    ):
        self._user_repo = user_repo
        self._organization_member_repo = organization_member_repo
        self._company_repo = company_repo

    def get_profile(self, user_id: int) -> UserResponse:
        """Get a user's profile by ID."""
        user = self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return self._to_response(user)

    def update_profile(self, user_id: int, data: UserUpdate) -> UserResponse:
        """Update a user's profile."""
        user = self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        updated = self._user_repo.update(user, data.model_dump(exclude_unset=True))

        audit_log(
            "USER_PROFILE_UPDATE",
            user_id=user_id,
            resource="user",
            resource_id=user_id,
            detail=f"User {user_id} updated their profile",
            success=True,
        )

        return self._to_response(updated)

    def deactivate_account(self, user_id: int) -> dict:
        """Deactivate a student account. Reactivation is admin-only."""
        user = self._get_student_or_404(user_id)
        self._user_repo.update(user, {"is_active": False})

        audit_log(
            "USER_ACCOUNT_DEACTIVATE",
            user_id=user_id,
            user_role=user.role.value,
            user_email=user.email,
            resource="user",
            resource_id=user_id,
            detail=f"Student {user.email} deactivated their account",
            success=True,
        )
        return {"deactivated": True}

    def delete_account(self, user_id: int, confirmation_email: str) -> dict:
        """Permanently delete a student account after exact email confirmation."""
        user = self._get_student_or_404(user_id)
        if confirmation_email.lower().strip() != user.email.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email confirmation does not match this account",
            )

        avatar = user.avatar
        cv_url = user.cv_url
        email = user.email

        audit_log(
            "USER_ACCOUNT_DELETE",
            user_id=user_id,
            user_role=user.role.value,
            user_email=email,
            resource="user",
            resource_id=user_id,
            detail=f"Student {email} permanently deleted their account",
            success=True,
        )

        self._delete_student_owned_rows(user_id)
        self._user_repo._db.delete(user)
        self._user_repo._db.commit()
        delete_managed_asset("avatar", avatar)
        delete_managed_asset("cv", cv_url)
        return {"deleted": True}

    def list_students(self, skip: int = 0, limit: int = 100) -> list[UserResponse]:
        """List all student users."""
        students = self._user_repo.get_students(skip, limit)
        return [self._to_response(s) for s in students]

    def _get_student_or_404(self, user_id: int) -> User:
        user = self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if user.role != UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only student accounts can use this action",
            )
        return user

    def _delete_student_owned_rows(self, user_id: int) -> None:
        from app.domain.models.application import ApplicationDraft
        from app.domain.models.notification import Notification

        self._user_repo._db.query(ApplicationDraft).filter(ApplicationDraft.student_id == user_id).delete(
            synchronize_session=False
        )
        self._user_repo._db.query(Notification).filter(Notification.user_id == user_id).delete(
            synchronize_session=False
        )

    def _to_response(self, user: User) -> UserResponse:
        """Normalize managed asset references before serializing the user."""
        updates: dict[str, str | None] = {}

        if is_managed_avatar_url(user.avatar) and not ensure_asset_in_managed_location("avatar", user.avatar):
            updates["avatar"] = None

        if is_managed_cv_url(user.cv_url) and not ensure_asset_in_managed_location("cv", user.cv_url):
            updates["cv_url"] = None

        if updates:
            user = self._user_repo.update(user, updates)

        response = UserResponse.model_validate(user)
        if self._organization_member_repo and self._company_repo:
            org_service = OrganizationService(
                self._company_repo,
                self._organization_member_repo,
                invite_repo=None,
                company_request_repo=None,
                user_repo=self._user_repo,
            )
            membership = org_service.active_membership_response(user)
            response.organization_membership = membership
            if membership:
                response.company_id = membership.company_id
        return response
