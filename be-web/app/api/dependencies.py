"""
Dependency injection module — wires repositories and services per request.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.models.user import User
from app.repositories import (
    UserRepository, CompanyRepository, OpportunityRepository, ApplicationRepository,
    BookmarkRepository, CompanyFollowRepository, ExternshipRepository, NotificationRepository, ResumeRepository,
    CompanyReviewRepository,
    LogbookRepository,
    CompanyRequestRepository, OrganizationInviteRepository, OrganizationMemberRepository,
)
from app.services import (
    AuthService, UserService, CompanyService, OpportunityService, ApplicationService,
    BookmarkService, CompanyFollowService, ExternshipService, NotificationService, AdminService, ResumeService,
    EmailService, CompanyReviewService, LogbookService, OrganizationService,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Repository Factories ─────────────────────────────────────

def get_user_repo(db: Session = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_company_repo(db: Session = Depends(get_db)) -> CompanyRepository:
    return CompanyRepository(db)


def get_opportunity_repo(db: Session = Depends(get_db)) -> OpportunityRepository:
    return OpportunityRepository(db)


def get_application_repo(db: Session = Depends(get_db)) -> ApplicationRepository:
    return ApplicationRepository(db)


def get_bookmark_repo(db: Session = Depends(get_db)) -> BookmarkRepository:
    return BookmarkRepository(db)


def get_company_follow_repo(db: Session = Depends(get_db)) -> CompanyFollowRepository:
    return CompanyFollowRepository(db)


def get_externship_repo(db: Session = Depends(get_db)) -> ExternshipRepository:
    return ExternshipRepository(db)


def get_notification_repo(db: Session = Depends(get_db)) -> NotificationRepository:
    return NotificationRepository(db)


def get_resume_repo(db: Session = Depends(get_db)) -> ResumeRepository:
    return ResumeRepository(db)


def get_company_review_repo(db: Session = Depends(get_db)) -> CompanyReviewRepository:
    return CompanyReviewRepository(db)


def get_logbook_repo(db: Session = Depends(get_db)) -> LogbookRepository:
    return LogbookRepository(db)


def get_email_service() -> EmailService:
    return EmailService()


def get_organization_member_repo(db: Session = Depends(get_db)) -> OrganizationMemberRepository:
    return OrganizationMemberRepository(db)


def get_organization_invite_repo(db: Session = Depends(get_db)) -> OrganizationInviteRepository:
    return OrganizationInviteRepository(db)


def get_company_request_repo(db: Session = Depends(get_db)) -> CompanyRequestRepository:
    return CompanyRequestRepository(db)


# ── Service Factories ────────────────────────────────────────

def get_auth_service(
    user_repo: UserRepository = Depends(get_user_repo),
    notification_repo: NotificationRepository = Depends(get_notification_repo),
    email_service: EmailService = Depends(get_email_service),
    organization_member_repo: OrganizationMemberRepository = Depends(get_organization_member_repo),
    company_repo: CompanyRepository = Depends(get_company_repo),
) -> AuthService:
    return AuthService(user_repo, notification_repo, email_service, organization_member_repo, company_repo)


def get_user_service(
    user_repo: UserRepository = Depends(get_user_repo),
    organization_member_repo: OrganizationMemberRepository = Depends(get_organization_member_repo),
    company_repo: CompanyRepository = Depends(get_company_repo),
) -> UserService:
    return UserService(user_repo, organization_member_repo, company_repo)


def get_company_service(company_repo: CompanyRepository = Depends(get_company_repo)) -> CompanyService:
    return CompanyService(company_repo)


def get_company_review_service(
    review_repo: CompanyReviewRepository = Depends(get_company_review_repo),
    company_repo: CompanyRepository = Depends(get_company_repo),
) -> CompanyReviewService:
    return CompanyReviewService(review_repo, company_repo)


def get_opportunity_service(
    opportunity_repo: OpportunityRepository = Depends(get_opportunity_repo),
    application_repo: ApplicationRepository = Depends(get_application_repo),
    notification_repo: NotificationRepository = Depends(get_notification_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    company_follow_repo: CompanyFollowRepository = Depends(get_company_follow_repo),
    email_service: EmailService = Depends(get_email_service),
) -> OpportunityService:
    return OpportunityService(
        opportunity_repo,
        application_repo,
        notification_repo,
        user_repo,
        company_follow_repo,
        email_service,
    )


def get_application_service(
    application_repo: ApplicationRepository = Depends(get_application_repo),
    opportunity_repo: OpportunityRepository = Depends(get_opportunity_repo),
    notification_repo: NotificationRepository = Depends(get_notification_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    email_service: EmailService = Depends(get_email_service),
) -> ApplicationService:
    return ApplicationService(application_repo, opportunity_repo, notification_repo, user_repo, email_service)


def get_bookmark_service(
    bookmark_repo: BookmarkRepository = Depends(get_bookmark_repo),
) -> BookmarkService:
    return BookmarkService(bookmark_repo)


def get_company_follow_service(
    company_follow_repo: CompanyFollowRepository = Depends(get_company_follow_repo),
    company_repo: CompanyRepository = Depends(get_company_repo),
) -> CompanyFollowService:
    return CompanyFollowService(company_follow_repo, company_repo)


def get_externship_service(
    externship_repo: ExternshipRepository = Depends(get_externship_repo),
) -> ExternshipService:
    return ExternshipService(externship_repo)


def get_notification_service(
    notification_repo: NotificationRepository = Depends(get_notification_repo),
) -> NotificationService:
    return NotificationService(notification_repo)


def get_resume_service(
    resume_repo: ResumeRepository = Depends(get_resume_repo),
) -> ResumeService:
    return ResumeService(resume_repo)


def get_logbook_service(
    logbook_repo: LogbookRepository = Depends(get_logbook_repo),
    application_repo: ApplicationRepository = Depends(get_application_repo),
) -> LogbookService:
    return LogbookService(logbook_repo, application_repo)


def get_admin_service(
    user_repo: UserRepository = Depends(get_user_repo),
    company_repo: CompanyRepository = Depends(get_company_repo),
    opportunity_repo: OpportunityRepository = Depends(get_opportunity_repo),
    application_repo: ApplicationRepository = Depends(get_application_repo),
) -> AdminService:
    return AdminService(user_repo, company_repo, opportunity_repo, application_repo)


def get_organization_service(
    company_repo: CompanyRepository = Depends(get_company_repo),
    member_repo: OrganizationMemberRepository = Depends(get_organization_member_repo),
    invite_repo: OrganizationInviteRepository = Depends(get_organization_invite_repo),
    company_request_repo: CompanyRequestRepository = Depends(get_company_request_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    email_service: EmailService = Depends(get_email_service),
) -> OrganizationService:
    return OrganizationService(
        company_repo,
        member_repo,
        invite_repo,
        company_request_repo,
        user_repo,
        email_service,
    )


# ── Auth Dependencies ────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Extract and validate the current user from the JWT token."""
    return auth_service.get_current_user(token)


def require_role(required_role: str):
    """Factory for role-based access control dependency."""

    def _check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}",
            )
        return current_user

    return _check_role
