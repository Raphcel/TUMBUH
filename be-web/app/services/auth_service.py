import logging
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from jose import jwt, JWTError
from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config.settings import get_settings
from app.domain.models.user import User
from app.domain.models.user import UserRole
from app.repositories.notification_repository import NotificationRepository
from app.repositories.company_repository import CompanyRepository
from app.repositories.organization_repository import OrganizationMemberRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import GoogleAuthRequest, RegistrationResponse, UserCreate, UserResponse, TokenResponse
from app.services.audit_service import audit_log
from app.services.email_service import EmailService
from app.services.user_asset_service import (
    ensure_asset_in_managed_location,
    is_managed_avatar_url,
    is_managed_cv_url,
)
from app.services.organization_service import OrganizationService

logger = logging.getLogger(__name__)

settings = get_settings()


class AuthService:
    """Service handling authentication and authorization logic."""

    def __init__(
        self,
        user_repo: UserRepository,
        notification_repo: NotificationRepository | None = None,
        email_service: EmailService | None = None,
        organization_member_repo: OrganizationMemberRepository | None = None,
        company_repo: CompanyRepository | None = None,
    ):
        self._user_repo = user_repo
        self._notification_repo = notification_repo
        self._email_service = email_service
        self._organization_member_repo = organization_member_repo
        self._company_repo = company_repo

    # ── Password Utilities ───────────────────────────────────

    @staticmethod
    def hash_password(password: str) -> str:
        return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

    # ── Token Utilities ──────────────────────────────────────

    @staticmethod
    def create_access_token(data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire, "type": "access"})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @staticmethod
    def create_refresh_token(data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @staticmethod
    def decode_token(token: str) -> dict:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # ── Business Methods ─────────────────────────────────────

    def register(self, data: UserCreate) -> RegistrationResponse:
        """Register a password user and send an email verification link."""
        self._validate_registration_identity(data.email, data.role)
        existing = self._user_repo.get_by_email(data.email)
        if existing:
            audit_log(
                "AUTH_REGISTER_DUPLICATE",
                level="warn",
                user_email=data.email,
                resource="auth",
                detail=f"Registration attempt with existing email: {data.email}",
                success=False,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists",
            )

        user_dict = data.model_dump(exclude={"password"})
        user_dict["hashed_password"] = self.hash_password(data.password)
        verification_required = self._email_verification_required()
        user_dict["auth_provider"] = "password"
        user_dict["is_email_verified"] = not verification_required
        if verification_required:
            token, token_hash = self._make_verification_token()
            user_dict["email_verification_token_hash"] = token_hash
            user_dict["email_verification_sent_at"] = datetime.now(timezone.utc)

        user = self._user_repo.create(user_dict)

        logger.info("User registered: %s (role=%s)", user.email, user.role.value)
        if verification_required:
            self._send_verification_email(user, token)
        else:
            self._create_onboarding_notification(user)
        audit_log(
            "AUTH_REGISTER",
            user_id=user.id,
            user_role=user.role.value,
            user_email=user.email,
            resource="auth",
            detail=f"New {user.role.value} account registered: {user.email}",
            success=True,
        )

        message = (
            "Registration successful. Please check your email to verify your account."
            if verification_required
            else "Registration successful. Email verification is disabled."
        )
        return RegistrationResponse(
            message=message,
            user=self._to_user_response(user),
            email_verification_required=verification_required,
        )

    def login(self, email: str, password: str) -> TokenResponse:
        """Authenticate a user and return access + refresh tokens."""
        user = self._user_repo.get_by_email(email)
        if not user or not self.verify_password(password, user.hashed_password):
            logger.warning("Failed login attempt for email: %s", email)
            audit_log(
                "AUTH_LOGIN_FAILURE",
                level="warn",
                user_email=email,
                resource="auth",
                detail=f"Failed login attempt — incorrect credentials for: {email}",
                success=False,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        if not user.is_email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email before logging in.",
            )

        if not user.is_active:
            logger.warning("Deactivated user login attempt: %s", email)
            audit_log(
                "AUTH_LOGIN_BLOCKED",
                level="warn",
                user_id=user.id,
                user_role=user.role.value,
                user_email=email,
                resource="auth",
                detail=f"Login blocked — deactivated account: {email}",
                success=False,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )

        token_data = {"sub": str(user.id), "role": user.role.value}
        access_token = self.create_access_token(token_data)
        refresh_token = self.create_refresh_token(token_data)

        logger.info("User logged in: %s", user.email)
        audit_log(
            "AUTH_LOGIN_SUCCESS",
            user_id=user.id,
            user_role=user.role.value,
            user_email=user.email,
            resource="auth",
            detail=f"User logged in: {user.email}",
            success=True,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=self._to_user_response(user),
        )

    def verify_email(self, token: str) -> dict:
        """Verify an email address using a one-time token."""
        token_hash = self._hash_token(token)
        user = self._user_repo.get_by_email_verification_token_hash(token_hash)
        if not user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")

        sent_at = user.email_verification_sent_at
        if sent_at and sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)
        expires_at = sent_at + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS) if sent_at else None
        if expires_at and datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token expired")

        self._user_repo.update(user, {
            "is_email_verified": True,
            "email_verification_token_hash": None,
            "email_verification_sent_at": None,
        })
        self._create_onboarding_notification(user)

        audit_log(
            "AUTH_EMAIL_VERIFY",
            user_id=user.id,
            user_role=user.role.value,
            user_email=user.email,
            resource="auth",
            detail=f"Email verified for: {user.email}",
            success=True,
        )
        return {"message": "Email verified successfully"}

    def request_password_reset(self, email: str) -> dict:
        """Create and email a one-time password reset token.

        The response is intentionally generic to avoid account enumeration.
        """
        generic_response = {"message": "If the account exists, a password reset link has been sent."}
        normalized_email = email.lower().strip()
        user = self._user_repo.get_by_email(normalized_email)

        if not user or not user.is_active or user.auth_provider != "password":
            return generic_response

        token, token_hash = self._make_verification_token()
        self._user_repo.update(user, {
            "password_reset_token_hash": token_hash,
            "password_reset_sent_at": datetime.now(timezone.utc),
        })
        self._send_password_reset_email(user, token)

        audit_log(
            "AUTH_PASSWORD_RESET_REQUEST",
            user_id=user.id,
            user_role=user.role.value,
            user_email=user.email,
            resource="auth",
            detail=f"Password reset requested for: {user.email}",
            success=True,
        )
        return generic_response

    def confirm_password_reset(self, token: str, new_password: str) -> dict:
        """Set a new password using a one-time reset token."""
        token_hash = self._hash_token(token)
        user = self._user_repo.get_by_password_reset_token_hash(token_hash)
        if not user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

        sent_at = user.password_reset_sent_at
        if sent_at and sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)
        if not sent_at:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
        expires_at = sent_at + timedelta(hours=settings.PASSWORD_RESET_EXPIRE_HOURS) if sent_at else None
        if expires_at and datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token expired")

        self._user_repo.update(user, {
            "hashed_password": self.hash_password(new_password),
            "password_reset_token_hash": None,
            "password_reset_sent_at": None,
        })

        audit_log(
            "AUTH_PASSWORD_RESET_CONFIRM",
            user_id=user.id,
            user_role=user.role.value,
            user_email=user.email,
            resource="auth",
            detail=f"Password reset completed for: {user.email}",
            success=True,
        )
        return {"message": "Password updated successfully"}

    def google_auth(self, data: GoogleAuthRequest) -> TokenResponse:
        """Sign in or sign up using a Google ID token."""
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Google authentication is not configured")

        payload = self._verify_google_credential(data.credential)
        email = str(payload.get("email") or "").lower()
        google_sub = str(payload.get("sub") or "")
        if not email or not google_sub:
            raise HTTPException(status_code=400, detail="Google account did not provide email identity")
        if not payload.get("email_verified"):
            raise HTTPException(status_code=400, detail="Google email is not verified")

        user = self._user_repo.get_by_google_sub(google_sub) or self._user_repo.get_by_email(email)
        if user:
            if user.google_sub != google_sub:
                user = self._user_repo.update(user, {
                    "google_sub": google_sub,
                    "auth_provider": user.auth_provider if user.auth_provider == "password" else "google",
                    "is_email_verified": True,
                })
            return self._issue_tokens(user)

        if data.login_only:
            raise HTTPException(status_code=404, detail="No account found for this Google account. Please register first.")

        self._validate_registration_identity(email, data.role)

        first_name, last_name = self._resolve_google_names(data, payload)
        user = self._user_repo.create({
            "email": email,
            "hashed_password": self.hash_password(secrets.token_urlsafe(32)),
            "first_name": first_name,
            "last_name": last_name,
            "role": data.role,
            "company_id": data.company_id,
            "auth_provider": "google",
            "google_sub": google_sub,
            "is_email_verified": True,
            "avatar": payload.get("picture"),
        })
        self._create_onboarding_notification(user)
        audit_log(
            "AUTH_GOOGLE_SIGNUP",
            user_id=user.id,
            user_role=user.role.value,
            user_email=user.email,
            resource="auth",
            detail=f"Google account registered: {user.email}",
            success=True,
        )
        return self._issue_tokens(user)

    def refresh(self, refresh_token: str) -> TokenResponse:
        """Issue new tokens using a valid refresh token."""
        payload = self.decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")

        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        user = self._user_repo.get_by_id(int(user_id))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or deactivated")

        token_data = {"sub": str(user.id), "role": user.role.value}
        new_access = self.create_access_token(token_data)
        new_refresh = self.create_refresh_token(token_data)

        audit_log(
            "AUTH_TOKEN_REFRESH",
            user_id=user.id,
            user_role=user.role.value,
            user_email=user.email,
            resource="auth",
            detail=f"Token refreshed for: {user.email}",
            success=True,
        )

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            user=self._to_user_response(user),
        )

    def get_current_user(self, token: str) -> User:
        """Decode token and return the associated user."""
        payload = self.decode_token(token)
        if payload.get("type") == "refresh":
            raise HTTPException(status_code=401, detail="Cannot use refresh token for authentication")

        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        user = self._user_repo.get_by_id(int(user_id))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
        return user

    def _to_user_response(self, user: User) -> UserResponse:
        updates: dict[str, str | None] = {}

        if is_managed_avatar_url(user.avatar) and not ensure_asset_in_managed_location("avatar", user.avatar):
            updates["avatar"] = None

        if is_managed_cv_url(user.cv_url) and not ensure_asset_in_managed_location("cv", user.cv_url):
            updates["cv_url"] = None

        if updates:
            user = self._user_repo.update(user, updates)

        response = UserResponse.model_validate(user)
        if self._organization_member_repo and self._company_repo:
            org_service = OrganizationService(
                self._company_repo,
                self._organization_member_repo,
                invite_repo=None,
                company_request_repo=None,
                user_repo=self._user_repo,
            )
            membership = org_service.active_membership_response(user)
            response.organization_membership = membership
            if membership:
                response.company_id = membership.company_id
        return response

    def _create_onboarding_notification(self, user: User) -> None:
        if not self._notification_repo or user.role != UserRole.STUDENT:
            return

        self._notification_repo.create({
            "user_id": user.id,
            "title": "Welcome to TUMBUH",
            "message": "Complete your profile, upload your CV, and start applying to opportunities.",
            "type": "info",
            "action_label": "Open profile",
            "action_url": "/student/profile",
        })

    def _issue_tokens(self, user: User) -> TokenResponse:
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

        token_data = {"sub": str(user.id), "role": user.role.value}
        access_token = self.create_access_token(token_data)
        refresh_token = self.create_refresh_token(token_data)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=self._to_user_response(user),
        )

    def _validate_registration_identity(self, email: str, role: UserRole) -> None:
        if role == UserRole.STUDENT and not email.lower().endswith("ipb.ac.id"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Students must use an IPB institutional email.",
            )

    def _email_verification_required(self) -> bool:
        return bool(self._email_service and self._email_service.is_configured)

    def _send_verification_email(self, user: User, token: str) -> None:
        if not self._email_service:
            return

        verify_url = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"
        self._email_service.send_verification_email(
            user.email,
            user.full_name,
            verify_url=verify_url,
            expires_hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS,
        )

    def _send_password_reset_email(self, user: User, token: str) -> None:
        if not self._email_service:
            return

        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
        self._email_service.send_password_reset_email(
            user.email,
            user.full_name,
            reset_url=reset_url,
            expires_hours=settings.PASSWORD_RESET_EXPIRE_HOURS,
        )

    @staticmethod
    def _make_verification_token() -> tuple[str, str]:
        token = secrets.token_urlsafe(32)
        return token, AuthService._hash_token(token)

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _verify_google_credential(credential: str) -> dict:
        try:
            return id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential")

    @staticmethod
    def _resolve_google_names(data: GoogleAuthRequest, payload: dict) -> tuple[str, str]:
        first_name = (data.first_name or payload.get("given_name") or "").strip()
        last_name = (data.last_name or payload.get("family_name") or "").strip()

        if data.role == UserRole.HR and (not first_name or not last_name):
            raise HTTPException(status_code=400, detail="HR registration requires first and last name.")

        if not first_name:
            name = str(payload.get("name") or payload.get("email") or "Google User").strip()
            parts = name.split(maxsplit=1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else "User"
        elif not last_name:
            last_name = "User"

        return first_name, last_name
