from sqlalchemy.orm import Session

from app.domain.models.user import User, UserRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User entity — handles all user data access."""

    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str) -> User | None:
        """Find a user by their email address."""
        return self._db.query(User).filter(User.email == email).first()

    def get_by_google_sub(self, google_sub: str) -> User | None:
        """Find a user by their Google subject identifier."""
        return self._db.query(User).filter(User.google_sub == google_sub).first()

    def get_by_email_verification_token_hash(self, token_hash: str) -> User | None:
        """Find a user by email verification token hash."""
        return (
            self._db.query(User)
            .filter(User.email_verification_token_hash == token_hash)
            .first()
        )

    def get_by_password_reset_token_hash(self, token_hash: str) -> User | None:
        """Find a user by password reset token hash."""
        return (
            self._db.query(User)
            .filter(User.password_reset_token_hash == token_hash)
            .first()
        )

    def get_students(self, skip: int = 0, limit: int = 100) -> list[User]:
        """Retrieve all users with student role."""
        return (
            self._db.query(User)
            .filter(User.role == UserRole.STUDENT, User.is_active == True)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_hr_by_company(self, company_id: int) -> list[User]:
        """Retrieve all HR staff for a given company."""
        legacy_users = (
            self._db.query(User)
            .filter(User.role == UserRole.HR, User.company_id == company_id, User.is_active == True)
            .all()
        )
        from app.domain.models.organization import OrganizationMember, OrganizationMemberStatus

        member_users = (
            self._db.query(User)
            .join(OrganizationMember, OrganizationMember.user_id == User.id)
            .filter(
                User.role == UserRole.HR,
                User.is_active == True,
                OrganizationMember.company_id == company_id,
                OrganizationMember.status == OrganizationMemberStatus.ACTIVE,
            )
            .all()
        )
        by_id = {user.id: user for user in legacy_users}
        by_id.update({user.id: user for user in member_users})
        return list(by_id.values())
