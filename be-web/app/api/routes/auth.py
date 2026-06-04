from fastapi import APIRouter, Depends, Request

from app.domain.models.user import User
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.schemas.user import (
    GoogleAuthRequest,
    RegistrationResponse,
    UserCreate,
    UserLogin,
    RefreshRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
)
from app.api.dependencies import get_auth_service, get_current_user, get_user_service
from app.config.limiter import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegistrationResponse, status_code=201)
@limiter.limit("5/minute")
def register(
    request: Request,
    data: UserCreate,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Register a new user account."""
    return auth_service.register(data)


@router.post("/verify-email")
@limiter.limit("10/minute")
def verify_email(
    request: Request,
    data: VerifyEmailRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Verify a newly registered email address."""
    return auth_service.verify_email(data.token)


@router.post("/password-reset/request")
@limiter.limit("5/minute")
def request_password_reset(
    request: Request,
    data: PasswordResetRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Send a password reset link when the account can use password auth."""
    return auth_service.request_password_reset(str(data.email))


@router.post("/password-reset/confirm")
@limiter.limit("5/minute")
def confirm_password_reset(
    request: Request,
    data: PasswordResetConfirm,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Set a new password using a one-time reset token."""
    return auth_service.confirm_password_reset(data.token, data.new_password)


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
def google_auth(
    request: Request,
    data: GoogleAuthRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Sign in or register using a Google ID token."""
    return auth_service.google_auth(data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    data: UserLogin,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Authenticate and receive access + refresh tokens."""
    return auth_service.login(data.email, data.password)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    data: RefreshRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Issue new tokens using a valid refresh token."""
    return auth_service.refresh(data.refresh_token)


@router.get("/me", response_model=UserResponse)
def me(
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Get the currently authenticated user's profile."""
    return user_service.get_profile(current_user.id)
