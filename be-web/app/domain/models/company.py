import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Enum
from sqlalchemy.orm import relationship

from app.config.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class CompanyStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Company(Base):
    """Company domain entity — represents partner companies."""

    __tablename__ = "companies"

    id: int = Column(Integer, primary_key=True, index=True)
    name: str = Column(String(200), nullable=False, index=True)
    industry: str = Column(String(100), nullable=False)
    location: str = Column(String(200), nullable=False)
    logo: str = Column(String(500), nullable=True)
    description: str = Column(Text, nullable=True)
    website: str = Column(String(500), nullable=True)
    rating: float = Column(Float, nullable=True, default=0.0)

    # Extended fields
    employee_count: int = Column(Integer, nullable=True)
    founded_year: int = Column(Integer, nullable=True)
    linkedin_url: str = Column(String(500), nullable=True)
    instagram_url: str = Column(String(500), nullable=True)
    tagline: str = Column(String(300), nullable=True)
    status: CompanyStatus = Column(Enum(CompanyStatus), nullable=False, default=CompanyStatus.APPROVED, index=True)

    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    staff = relationship("User", back_populates="company")
    opportunities = relationship("Opportunity", back_populates="company", cascade="all, delete-orphan")
    followers = relationship("CompanyFollow", back_populates="company", cascade="all, delete-orphan")
    reviews = relationship("CompanyReview", back_populates="company", cascade="all, delete-orphan")
    organization_members = relationship("OrganizationMember", back_populates="company", cascade="all, delete-orphan")
    organization_invites = relationship("OrganizationInvite", back_populates="company", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Company(id={self.id}, name='{self.name}')>"
