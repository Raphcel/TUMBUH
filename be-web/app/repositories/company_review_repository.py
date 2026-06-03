from sqlalchemy.orm import Session

from app.domain.models.company_review import CompanyReview
from app.repositories.base import BaseRepository


class CompanyReviewRepository(BaseRepository[CompanyReview]):
    """Repository for CompanyReview entity — handles all review data access."""

    def __init__(self, db: Session):
        super().__init__(CompanyReview, db)

    def get_by_company(self, company_id: int, skip: int = 0, limit: int = 100) -> list[CompanyReview]:
        """Fetch reviews for a company sorted by newest."""
        return (
            self._db.query(CompanyReview)
            .filter(CompanyReview.company_id == company_id)
            .order_by(CompanyReview.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_by_company(self, company_id: int) -> int:
        """Count total reviews for a company."""
        return (
            self._db.query(CompanyReview)
            .filter(CompanyReview.company_id == company_id)
            .count()
        )

    def get_user_review(self, company_id: int, user_id: int) -> CompanyReview | None:
        """Get a user's review for a company if they have already written one."""
        return (
            self._db.query(CompanyReview)
            .filter(
                CompanyReview.company_id == company_id,
                CompanyReview.user_id == user_id
            )
            .first()
        )
