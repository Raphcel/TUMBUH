from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.domain.models.organization import (
    OrganizationInviteStatus,
    OrganizationMemberRole,
    OrganizationMemberStatus,
)
from app.schemas.company import CompanyCreate, CompanyResponse


ROLE_PERMISSIONS = {
    OrganizationMemberRole.OWNER: [
        "manage_company_profile",
        "manage_members",
        "manage_invites",
        "create_opportunities",
        "manage_all_opportunities",
        "review_applicants",
    ],
    OrganizationMemberRole.ADMIN: [
        "manage_company_profile",
        "manage_members",
        "manage_invites",
        "create_opportunities",
        "manage_all_opportunities",
        "review_applicants",
    ],
    OrganizationMemberRole.RECRUITER: [
        "create_opportunities",
        "manage_own_opportunities",
        "review_applicants",
    ],
    OrganizationMemberRole.VIEWER: [],
}


class OrganizationMemberResponse(BaseModel):
    id: int | None = None
    company_id: int
    user_id: int
    role: OrganizationMemberRole
    status: OrganizationMemberStatus
    permissions: list[str] = Field(default_factory=list)
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class OrganizationMemberUserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    avatar: str | None = None

    class Config:
        from_attributes = True


class OrganizationMemberDetailResponse(OrganizationMemberResponse):
    user: OrganizationMemberUserResponse | None = None


class OrganizationMeResponse(BaseModel):
    company: CompanyResponse | None = None
    membership: OrganizationMemberResponse | None = None
    members: list[OrganizationMemberDetailResponse] = Field(default_factory=list)
    onboarding_required: bool = False


class CompanyRequestCreate(CompanyCreate):
    pass


class CompanyRequestResponse(BaseModel):
    company: CompanyResponse
    membership: OrganizationMemberResponse


class CompanyRequestListResponse(BaseModel):
    items: list[CompanyResponse]
    total: int


class OrganizationInviteCreate(BaseModel):
    role: OrganizationMemberRole = OrganizationMemberRole.RECRUITER
    email: EmailStr | None = None
    expires_in_days: int = Field(7, ge=1, le=30)


class OrganizationInviteAccept(BaseModel):
    token: str = Field(..., min_length=16)


class OrganizationInviteResponse(BaseModel):
    id: int
    company_id: int
    email: str | None = None
    role: OrganizationMemberRole
    status: OrganizationInviteStatus
    expires_at: datetime
    token: str | None = None
    invite_url: str | None = None

    class Config:
        from_attributes = True


class OrganizationInviteAcceptResponse(BaseModel):
    company: CompanyResponse
    membership: OrganizationMemberResponse
