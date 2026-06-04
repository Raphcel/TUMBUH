import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, Enum, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship

from app.config.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    STUDENT = "student"
    HR = "hr"
    ADMIN = "admin"


class User(Base):
    """User domain entity — represents students and HR staff."""

    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True, index=True)
    email: str = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password: str = Column(String(255), nullable=False)
    first_name: str = Column(String(100), nullable=False)
    last_name: str = Column(String(100), nullable=False)
    role: UserRole = Column(Enum(UserRole), nullable=False, default=UserRole.STUDENT)
    auth_provider: str = Column(String(30), nullable=False, default="password")
    google_sub: str = Column(String(255), unique=True, nullable=True, index=True)
    is_email_verified: bool = Column(Boolean, default=True, nullable=False)
    email_verification_token_hash: str = Column(String(64), nullable=True, index=True)
    email_verification_sent_at: datetime = Column(DateTime, nullable=True)
    password_reset_token_hash: str = Column(String(64), nullable=True, index=True)
    password_reset_sent_at: datetime = Column(DateTime, nullable=True)
    avatar: str = Column(String(500), nullable=True)
    phone: str = Column(String(20), nullable=True)
    bio: str = Column(Text, nullable=True)
    social_links: dict = Column(JSON, nullable=False, default=dict)
    skills: list = Column(JSON, nullable=False, default=list)

    # Student-specific fields
    nim: str = Column(String(20), nullable=True, index=True)  # Student ID number
    major: str = Column(String(200), nullable=True)
    university: str = Column(String(200), nullable=True, default="IPB University")
    gpa: float = Column(Float, nullable=True)
    cv_url: str = Column(String(500), nullable=True)

    # HR-specific fields
    company_id: int = Column(Integer, ForeignKey("companies.id"), nullable=True)

    is_active: bool = Column(Boolean, default=True, nullable=False)
    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    company = relationship("Company", back_populates="staff")
    applications = relationship("Application", back_populates="student", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")
    company_follows = relationship("CompanyFollow", back_populates="student", cascade="all, delete-orphan")
    externships = relationship("Externship", back_populates="student", cascade="all, delete-orphan")
    resume_profiles = relationship("ResumeProfile", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("CompanyReview", back_populates="user", cascade="all, delete-orphan")
    logbooks = relationship("InternshipLogbook", back_populates="student", cascade="all, delete-orphan")
    organization_memberships = relationship(
        "OrganizationMember",
        foreign_keys="OrganizationMember.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
