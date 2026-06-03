from app.repositories.base import BaseRepository
from app.repositories.user_repository import UserRepository
from app.repositories.company_repository import CompanyRepository
from app.repositories.opportunity_repository import OpportunityRepository
from app.repositories.application_repository import ApplicationRepository
from app.repositories.bookmark_repository import BookmarkRepository
from app.repositories.company_follow_repository import CompanyFollowRepository
from app.repositories.externship_repository import ExternshipRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.resume_repository import ResumeRepository
from app.repositories.company_review_repository import CompanyReviewRepository

__all__ = [
    "BaseRepository",
    "UserRepository",
    "CompanyRepository",
    "OpportunityRepository",
    "ApplicationRepository",
    "BookmarkRepository",
    "CompanyFollowRepository",
    "ExternshipRepository",
    "NotificationRepository",
    "ResumeRepository",
    "CompanyReviewRepository",
]
