from datetime import datetime, timedelta, timezone
from pathlib import PurePosixPath
import re
from urllib.parse import urlparse

from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator

from app.domain.models.user import UserRole
from app.schemas.organization import OrganizationMemberResponse


# ── Request Schemas ──────────────────────────────────────────

SOCIAL_LINK_DOMAINS = {
    "linkedin": "linkedin.com",
    "github": "github.com",
    "instagram": "instagram.com",
}
INDONESIA_PHONE_COUNTRY_CODE = "+62"
INDONESIA_PHONE_MIN_DIGITS = 9
INDONESIA_PHONE_MAX_DIGITS = 12


def _normalize_url(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        return ""
    if "://" not in cleaned:
        cleaned = f"https://{cleaned}"
    return cleaned


def _is_valid_hostname(hostname: str | None) -> bool:
    if not hostname:
        return False
    return hostname == "localhost" or "." in hostname


def normalize_social_links(value: dict[str, str] | None) -> dict[str, str] | None:
    if value is None:
        return None

    normalized: dict[str, str] = {}
    for key, raw_url in value.items():
        if raw_url is None:
            continue

        social_key = key.strip().lower()
        url = _normalize_url(str(raw_url))
        if not url:
            continue

        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not _is_valid_hostname(parsed.hostname):
            raise ValueError(f"{social_key} must be a valid http or https URL")

        expected_domain = SOCIAL_LINK_DOMAINS.get(social_key)
        if expected_domain and not parsed.hostname.lower().endswith(expected_domain):
            raise ValueError(f"{social_key} must use {expected_domain}")

        normalized[social_key] = url

    return normalized


def normalize_indonesia_phone(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = re.sub(r"[\s\-()]", "", str(value).strip())
    if not cleaned:
        return None

    if cleaned.startswith(INDONESIA_PHONE_COUNTRY_CODE):
        local_number = cleaned[len(INDONESIA_PHONE_COUNTRY_CODE):].lstrip("0")
    elif cleaned.startswith(INDONESIA_PHONE_COUNTRY_CODE[1:]):
        local_number = cleaned[len(INDONESIA_PHONE_COUNTRY_CODE[1:]):].lstrip("0")
    else:
        local_number = cleaned.lstrip("0")

    if not local_number.isdigit():
        raise ValueError("phone can only contain digits, spaces, hyphens, parentheses, or +62")
    if not local_number.startswith("8"):
        raise ValueError("Indonesian phone number must start with 08 or +628")
    if not INDONESIA_PHONE_MIN_DIGITS <= len(local_number) <= INDONESIA_PHONE_MAX_DIGITS:
        raise ValueError("Indonesian phone number must be 10-13 digits in local format")

    return f"{INDONESIA_PHONE_COUNTRY_CODE}{local_number}"


class UserCreate(BaseModel):
    """Schema for creating a new user (registration)."""
    email: EmailStr = Field(..., examples=["budi@apps.ipb.ac.id"])
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    role: UserRole = UserRole.STUDENT

    # Student-specific (optional)
    nim: str | None = None
    major: str | None = None
    university: str | None = "IPB University"
    gpa: float | None = None

    # HR-specific (optional)
    company_id: int | None = None


class GoogleAuthRequest(BaseModel):
    """Schema for Google sign-in/sign-up using a Google ID token."""
    credential: str = Field(..., min_length=10)
    role: UserRole = UserRole.STUDENT
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    company_id: int | None = None
    login_only: bool = False


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=20)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(..., min_length=20)
    new_password: str = Field(..., min_length=8)


class AccountDeleteRequest(BaseModel):
    email: EmailStr


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    bio: str | None = None
    nim: str | None = None
    major: str | None = None
    gpa: float | None = None
    avatar: str | None = None
    cv_url: str | None = None
    social_links: dict[str, str] | None = None
    skills: list[str] | None = None

    @field_validator("social_links")
    @classmethod
    def validate_social_links(cls, value):
        return normalize_social_links(value)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        return normalize_indonesia_phone(value)


class UserLogin(BaseModel):
    """Schema for login request."""
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Schema for token refresh request."""
    refresh_token: str


# ── Response Schemas ─────────────────────────────────────────

class UserResponse(BaseModel):
    """Schema for user data in API responses."""
    id: int
    email: str
    first_name: str
    last_name: str
    role: UserRole
    avatar: str | None = None
    phone: str | None = None
    bio: str | None = None
    social_links: dict[str, str] = Field(default_factory=dict)
    skills: list[str] = Field(default_factory=list)
    nim: str | None = None
    major: str | None = None
    university: str | None = None
    gpa: float | None = None
    cv_url: str | None = None
    has_cv: bool = False
    cv_filename: str | None = None
    company_id: int | None = None
    organization_membership: OrganizationMemberResponse | None = None
    is_active: bool = True
    is_email_verified: bool = True
    auth_provider: str = "password"
    created_at: datetime

    @model_validator(mode="after")
    def populate_cv_metadata(self):
        self.has_cv = bool(self.cv_url)
        self.cv_filename = PurePosixPath(self.cv_url).name if self.cv_url else None
        return self

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Schema for authentication token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegistrationResponse(BaseModel):
    """Response for email/password registration before verification."""
    message: str
    user: UserResponse
    email_verification_required: bool = True
