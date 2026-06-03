from sqlalchemy.orm import Session

from app.domain.models.company import Company, CompanyStatus
from app.repositories.base import BaseRepository


class CompanyRepository(BaseRepository[Company]):
    """Repository for Company entity — handles all company data access."""

    def __init__(self, db: Session):
        super().__init__(Company, db)

    def get_by_name(self, name: str) -> Company | None:
        """Find a company by name."""
        return self._db.query(Company).filter(Company.name == name).first()

    def search(self, query: str, skip: int = 0, limit: int = 100) -> list[Company]:
        """Search companies by name or industry."""
        search_term = f"%{query}%"
        return (
            self._db.query(Company)
            .filter(Company.status == CompanyStatus.APPROVED)
            .filter(
                (Company.name.ilike(search_term)) |
                (Company.industry.ilike(search_term))
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_search(self, query: str) -> int:
        """Count companies matching a search query."""
        search_term = f"%{query}%"
        return (
            self._db.query(Company)
            .filter(Company.status == CompanyStatus.APPROVED)
            .filter(
                (Company.name.ilike(search_term)) |
                (Company.industry.ilike(search_term))
            )
            .count()
        )

    def get_all(self, skip: int = 0, limit: int = 100) -> list[Company]:
        return (
            self._db.query(Company)
            .filter(Company.status == CompanyStatus.APPROVED)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count(self) -> int:
        return self._db.query(Company).filter(Company.status == CompanyStatus.APPROVED).count()
