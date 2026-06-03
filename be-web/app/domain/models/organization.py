import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.config.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class OrganizationMemberRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    RECRUITER = "recruiter"
    VIEWER = "viewer"


class OrganizationMemberStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REVOKED = "revoked"


class OrganizationInviteStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("company_id", "user_id", name="uq_organization_member_company_user"),
    )

    id: int = Column(Integer, primary_key=True, index=True)
    company_id: int = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    user_id: int = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role: OrganizationMemberRole = Column(Enum(OrganizationMemberRole), nullable=False)
    status: OrganizationMemberStatus = Column(
        Enum(OrganizationMemberStatus),
        nullable=False,
        default=OrganizationMemberStatus.PENDING,
        index=True,
    )
    permissions: list[str] = Column(JSON, nullable=False, default=list)
    invited_by_user_id: int | None = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    company = relationship("Company", back_populates="organization_members")
    user = relationship("User", foreign_keys=[user_id], back_populates="organization_memberships")
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])


class OrganizationInvite(Base):
    __tablename__ = "organization_invites"

    id: int = Column(Integer, primary_key=True, index=True)
    company_id: int = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    token_hash: str = Column(String(64), unique=True, nullable=False, index=True)
    email: str | None = Column(String(255), nullable=True, index=True)
    role: OrganizationMemberRole = Column(Enum(OrganizationMemberRole), nullable=False)
    permissions: list[str] = Column(JSON, nullable=False, default=list)
    status: OrganizationInviteStatus = Column(
        Enum(OrganizationInviteStatus),
        nullable=False,
        default=OrganizationInviteStatus.PENDING,
        index=True,
    )
    expires_at: datetime = Column(DateTime, nullable=False)
    created_by_user_id: int = Column(Integer, ForeignKey("users.id"), nullable=False)
    accepted_by_user_id: int | None = Column(Integer, ForeignKey("users.id"), nullable=True)
    accepted_at: datetime | None = Column(DateTime, nullable=True)
    created_at: datetime = Column(DateTime, default=_utcnow)
    revoked_at: datetime | None = Column(DateTime, nullable=True)
    is_email_sent: bool = Column(Boolean, default=False, nullable=False)

    company = relationship("Company", back_populates="organization_invites")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    accepted_by = relationship("User", foreign_keys=[accepted_by_user_id])
