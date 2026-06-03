import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Enum, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship

from app.config.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class OpportunityType(str, enum.Enum):
    INTERNSHIP = "Internship"
    FULL_TIME = "Full-time"
    SCHOLARSHIP = "Scholarship"


class Opportunity(Base):
    """Opportunity domain entity — represents jobs, internships, and scholarships."""

    __tablename__ = "opportunities"

    id: int = Column(Integer, primary_key=True, index=True)
    title: str = Column(String(300), nullable=False, index=True)
    company_id: int = Column(Integer, ForeignKey("companies.id"), nullable=False)
    created_by_user_id: int | None = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    type: OpportunityType = Column(Enum(OpportunityType), nullable=False)
    location: str = Column(String(200), nullable=False)
    salary: str = Column(String(100), nullable=True)
    description: str = Column(Text, nullable=True)
    requirements: str = Column(Text, nullable=True)  # Stored as JSON string
    target_majors: list = Column(JSON, nullable=False, default=list)
    skill_tags: list = Column(JSON, nullable=False, default=list)
    application_questions: list = Column(JSON, nullable=False, default=list)
    is_active: bool = Column(Boolean, default=True, nullable=False, index=True)
    posted_at: datetime = Column(DateTime, default=_utcnow)
    deadline: datetime = Column(DateTime, nullable=True)

    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    company = relationship("Company", back_populates="opportunities")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    applications = relationship("Application", back_populates="opportunity", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="opportunity", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Opportunity(id={self.id}, title='{self.title}', type='{self.type}')>"
