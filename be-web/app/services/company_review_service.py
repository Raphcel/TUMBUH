from fastapi import HTTPException, status

from app.repositories.company_review_repository import CompanyReviewRepository
from app.repositories.company_repository import CompanyRepository
from app.schemas.company_review import CompanyReviewCreate, CompanyReviewResponse, CompanyReviewListResponse
from app.services.audit_service import audit_log


class CompanyReviewService:
    """Service handling company review business logic and rating calculation."""

    def __init__(self, review_repo: CompanyReviewRepository, company_repo: CompanyRepository):
        self._review_repo = review_repo
        self._company_repo = company_repo

    def list_reviews(self, company_id: int, skip: int = 0, limit: int = 100) -> CompanyReviewListResponse:
        """List all reviews for a company."""
        reviews = self._review_repo.get_by_company(company_id, skip, limit)
        total = self._review_repo.count_by_company(company_id)
        return CompanyReviewListResponse(
            items=[CompanyReviewResponse.model_validate(r) for r in reviews],
            total=total,
        )

    def create_review(self, company_id: int, user_id: int, data: CompanyReviewCreate) -> CompanyReviewResponse:
        """Create a new review for a company and update company average rating."""
        # Check if company exists
        company = self._company_repo.get_by_id(company_id)
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

        # Check if user already reviewed this company
        existing = self._review_repo.get_user_review(company_id, user_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already reviewed this company",
            )

        # Create review
        review_data = {
            "company_id": company_id,
            "user_id": user_id,
            "rating": data.rating,
            "content": data.content,
        }
        review = self._review_repo.create(review_data)

        # Recalculate company rating
        self._recalculate_company_rating(company_id)

        audit_log(
            "COMPANY_REVIEW_CREATE",
            resource="company",
            resource_id=company_id,
            detail=f"User {user_id} reviewed company {company_id} with rating {data.rating}",
            success=True,
        )

        return CompanyReviewResponse.model_validate(review)

    def update_review(self, company_id: int, review_id: int, user_id: int, data: CompanyReviewCreate) -> CompanyReviewResponse:
        """Update an existing review if owner."""
        review = self._review_repo.get_by_id(review_id)
        if not review or review.company_id != company_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

        if review.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to edit this review")

        update_data = {
            "rating": data.rating,
            "content": data.content,
        }
        self._review_repo.update(review, update_data)

        # Recalculate company rating
        self._recalculate_company_rating(company_id)

        audit_log(
            "COMPANY_REVIEW_UPDATE",
            resource="company",
            resource_id=company_id,
            detail=f"User {user_id} updated review {review_id} for company {company_id}",
            success=True,
        )

        return CompanyReviewResponse.model_validate(review)

    def delete_review(self, company_id: int, review_id: int, user_id: int, is_admin: bool) -> dict:
        """Delete a review if owner or admin."""
        review = self._review_repo.get_by_id(review_id)
        if not review or review.company_id != company_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

        if review.user_id != user_id and not is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to delete this review")

        self._review_repo.delete(review_id)

        # Recalculate company rating
        self._recalculate_company_rating(company_id)

        audit_log(
            "COMPANY_REVIEW_DELETE",
            resource="company",
            resource_id=company_id,
            detail=f"User {user_id} deleted review {review_id} for company {company_id}",
            success=True,
        )

        return {"message": "Review deleted successfully"}

    def _recalculate_company_rating(self, company_id: int):
        """Update the average rating field for a company."""
        db = self._review_repo._db
        company = self._company_repo.get_by_id(company_id)
        if not company:
            return

        reviews = self._review_repo.get_by_company(company_id, limit=100000)
        if reviews:
            avg_rating = sum(r.rating for r in reviews) / len(reviews)
            company.rating = round(avg_rating, 1)
        else:
            company.rating = 0.0

        db.commit()
