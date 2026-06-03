from sqlalchemy.orm import Session, joinedload
from sqlalchemy import asc, desc, nullslast

from app.domain.models.company import Company, CompanyStatus
from app.domain.models.opportunity import Opportunity, OpportunityType
from app.repositories.base import BaseRepository


class OpportunityRepository(BaseRepository[Opportunity]):
    """Repository for Opportunity entity — handles all opportunity data access."""

    def __init__(self, db: Session):
        super().__init__(Opportunity, db)

    def get_by_id_with_company(self, id: int) -> Opportunity | None:
        """Retrieve an opportunity with its company eagerly loaded."""
        return (
            self._db.query(Opportunity)
            .options(joinedload(Opportunity.company), joinedload(Opportunity.applications))
            .filter(Opportunity.id == id)
            .first()
        )

    def get_by_company(self, company_id: int, skip: int = 0, limit: int = 100) -> list[Opportunity]:
        """Retrieve all opportunities posted by a specific company."""
        return (
            self._db.query(Opportunity)
            .join(Company, Company.id == Opportunity.company_id)
            .options(joinedload(Opportunity.applications))
            .filter(
                Opportunity.company_id == company_id,
                Company.status == CompanyStatus.APPROVED,
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

    def search(
        self,
        query: str | None = None,
        type_filter: OpportunityType | None = None,
        location: str | None = None,
        sort: str = "latest",
        company_id: int | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Opportunity]:
        """Search and filter opportunities."""
        q = self._db.query(Opportunity).join(Company, Company.id == Opportunity.company_id).options(
            joinedload(Opportunity.company),
            joinedload(Opportunity.applications),
        ).filter(Company.status == CompanyStatus.APPROVED)

        if query:
            search_term = f"%{query}%"
            q = q.filter(Opportunity.title.ilike(search_term))

        if type_filter:
            q = q.filter(Opportunity.type == type_filter)

        if location:
            q = q.filter(Opportunity.location.ilike(f"%{location}%"))

        if company_id:
            q = q.filter(Opportunity.company_id == company_id)

        if sort == "oldest":
            q = q.order_by(asc(Opportunity.posted_at))
        elif sort == "deadline":
            q = q.order_by(nullslast(asc(Opportunity.deadline)), desc(Opportunity.posted_at))
        else:
            q = q.order_by(desc(Opportunity.posted_at))

        return q.offset(skip).limit(limit).all()

    def count_by_company(self, company_id: int) -> int:
        """Count opportunities for a given company."""
        return (
            self._db.query(Opportunity)
            .join(Company, Company.id == Opportunity.company_id)
            .filter(
                Opportunity.company_id == company_id,
                Company.status == CompanyStatus.APPROVED,
            )
            .count()
        )

    def count_search(
        self,
        query: str | None = None,
        type_filter: OpportunityType | None = None,
        location: str | None = None,
        company_id: int | None = None,
    ) -> int:
        """Count opportunities matching the given filters."""
        q = self._db.query(Opportunity).join(Company, Company.id == Opportunity.company_id).filter(
            Company.status == CompanyStatus.APPROVED
        )
        if query:
            q = q.filter(Opportunity.title.ilike(f"%{query}%"))
        if type_filter:
            q = q.filter(Opportunity.type == type_filter)
        if location:
            q = q.filter(Opportunity.location.ilike(f"%{location}%"))
        if company_id:
            q = q.filter(Opportunity.company_id == company_id)
        return q.count()
