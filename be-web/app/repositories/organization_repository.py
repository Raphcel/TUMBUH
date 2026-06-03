from datetime import datetime

from sqlalchemy.orm import Session, joinedload

from app.domain.models.company import Company, CompanyStatus
from app.domain.models.organization import (
    OrganizationInvite,
    OrganizationInviteStatus,
    OrganizationMember,
    OrganizationMemberStatus,
)
from app.domain.models.user import User, UserRole
from app.repositories.base import BaseRepository


class OrganizationMemberRepository(BaseRepository[OrganizationMember]):
    def __init__(self, db: Session):
        super().__init__(OrganizationMember, db)

    def get_active_by_user(self, user_id: int) -> OrganizationMember | None:
        return (
            self._db.query(OrganizationMember)
            .options(joinedload(OrganizationMember.company))
            .join(Company, Company.id == OrganizationMember.company_id)
            .filter(
                OrganizationMember.user_id == user_id,
                OrganizationMember.status == OrganizationMemberStatus.ACTIVE,
                Company.status == CompanyStatus.APPROVED,
            )
            .order_by(OrganizationMember.created_at.asc())
            .first()
        )

    def get_primary_by_user(self, user_id: int) -> OrganizationMember | None:
        return (
            self._db.query(OrganizationMember)
            .options(joinedload(OrganizationMember.company))
            .filter(OrganizationMember.user_id == user_id)
            .order_by(OrganizationMember.created_at.desc())
            .first()
        )

    def get_by_user_and_company(self, user_id: int, company_id: int) -> OrganizationMember | None:
        return (
            self._db.query(OrganizationMember)
            .options(joinedload(OrganizationMember.company))
            .filter(
                OrganizationMember.user_id == user_id,
                OrganizationMember.company_id == company_id,
            )
            .first()
        )

    def get_pending_owner_by_company(self, company_id: int) -> OrganizationMember | None:
        return (
            self._db.query(OrganizationMember)
            .filter(
                OrganizationMember.company_id == company_id,
                OrganizationMember.status == OrganizationMemberStatus.PENDING,
            )
            .order_by(OrganizationMember.created_at.asc())
            .first()
        )

    def get_active_users_by_company(self, company_id: int) -> list[User]:
        return (
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

    def list_by_company(self, company_id: int) -> list[OrganizationMember]:
        return (
            self._db.query(OrganizationMember)
            .options(joinedload(OrganizationMember.user))
            .filter(
                OrganizationMember.company_id == company_id,
                OrganizationMember.status.in_(
                    [
                        OrganizationMemberStatus.ACTIVE,
                        OrganizationMemberStatus.PENDING,
                    ]
                ),
            )
            .order_by(
                OrganizationMember.role.asc(),
                OrganizationMember.created_at.asc(),
            )
            .all()
        )


class OrganizationInviteRepository(BaseRepository[OrganizationInvite]):
    def __init__(self, db: Session):
        super().__init__(OrganizationInvite, db)

    def get_by_token_hash(self, token_hash: str) -> OrganizationInvite | None:
        return (
            self._db.query(OrganizationInvite)
            .options(joinedload(OrganizationInvite.company))
            .filter(OrganizationInvite.token_hash == token_hash)
            .first()
        )

    def mark_expired_before(self, now: datetime) -> int:
        invites = (
            self._db.query(OrganizationInvite)
            .filter(
                OrganizationInvite.status == OrganizationInviteStatus.PENDING,
                OrganizationInvite.expires_at < now,
            )
            .all()
        )
        for invite in invites:
            invite.status = OrganizationInviteStatus.EXPIRED
        self._db.commit()
        return len(invites)


class CompanyRequestRepository:
    def __init__(self, db: Session):
        self._db = db

    def list_pending(self, skip: int = 0, limit: int = 100) -> tuple[list[Company], int]:
        query = self._db.query(Company).filter(Company.status == CompanyStatus.PENDING)
        total = query.count()
        items = query.order_by(Company.created_at.asc()).offset(skip).limit(limit).all()
        return items, total
