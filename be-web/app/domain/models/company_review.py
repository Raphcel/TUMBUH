from datetime import datetime, timezone

from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.config.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class CompanyReview(Base):
    """CompanyReview entity - represents a review left by a student for a company."""

    __tablename__ = "company_reviews"

    id: int = Column(Integer, primary_key=True, index=True)
    company_id: int = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: int = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating: int = Column(Integer, nullable=False)
    content: str = Column(Text, nullable=False)
    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    company = relationship("Company", back_populates="reviews")
    user = relationship("User", back_populates="reviews")

    def __repr__(self) -> str:
        return f"<CompanyReview(id={self.id}, company_id={self.company_id}, user_id={self.user_id}, rating={self.rating})>"
