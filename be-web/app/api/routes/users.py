import base64
import re
import time

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.domain.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.repositories.user_repository import UserRepository
from app.services.user_asset_service import (
    AVATAR_DIR,
    PRIVATE_CV_DIR,
    build_avatar_url,
    build_cv_storage_url,
    delete_managed_asset,
    ensure_asset_in_managed_location,
    ensure_upload_dirs,
)
from app.services.user_service import UserService
from app.services.organization_service import OrganizationService
from app.schemas.user import AccountDeleteRequest, UserUpdate, UserResponse
from app.api.dependencies import (
    get_application_repo,
    get_current_user,
    get_organization_service,
    get_user_repo,
    get_user_service,
)

router = APIRouter(prefix="/users", tags=["Users"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
IMAGE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}
MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2MB
MAX_CV_SIZE = 5 * 1024 * 1024  # 5MB


def _build_cv_download_name(user: User) -> str:
    full_name = f"{user.first_name}-{user.last_name}".strip("-").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", full_name).strip("-")
    return f"{slug or f'user-{user.id}'}-cv.pdf"


def _resolve_cv_file_or_404(user: User):
    if not user.cv_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CV not found")

    file_path = ensure_asset_in_managed_location("cv", user.cv_url)
    if not file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CV file is missing")

    return file_path


def _build_cv_preview_payload(user: User, file_path):
    return {
        "filename": _build_cv_download_name(user),
        "content_type": "application/pdf",
        "data": base64.b64encode(file_path.read_bytes()).decode("ascii"),
    }


def _assert_cv_access(
    current_user: User,
    target_user: User,
    application_repo: ApplicationRepository,
    organization_service: OrganizationService,
) -> None:
    if current_user.id == target_user.id:
        return

    if current_user.role.value == "admin":
        return

    if current_user.role.value == "hr":
        company_id = organization_service.resolve_company_id(current_user)
        if company_id and application_repo.student_has_application_with_company(target_user.id, company_id):
            organization_service.require_permission(current_user, company_id, "review_applicants")
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this CV",
    )


@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Get the authenticated user's profile."""
    return user_service.get_profile(current_user.id)


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Update the authenticated user's profile."""
    return user_service.update_profile(current_user.id, data)


@router.patch("/me/deactivate")
def deactivate_my_account(
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Deactivate the authenticated student's account."""
    return user_service.deactivate_account(current_user.id)


@router.post("/me/delete")
def delete_my_account(
    data: AccountDeleteRequest,
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Permanently delete the authenticated student's account."""
    return user_service.delete_account(current_user.id, str(data.email))


@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Upload an avatar image for the current user."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="File must be an image (jpg, png, gif, webp)")

    contents = file.file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be smaller than 2MB")

    ext = IMAGE_EXTENSIONS.get(file.content_type, "jpg")
    filename = f"{current_user.id}_{int(time.time())}.{ext}"
    ensure_upload_dirs()
    filepath = AVATAR_DIR / filename

    with open(filepath, "wb") as f:
        f.write(contents)

    previous_avatar = current_user.avatar
    url = build_avatar_url(filename)
    user_service.update_profile(current_user.id, UserUpdate(avatar=url))
    delete_managed_asset("avatar", previous_avatar)

    return {"url": url}


@router.post("/me/cv")
def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Upload a CV (PDF) for the current user."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")

    contents = file.file.read()
    if len(contents) > MAX_CV_SIZE:
        raise HTTPException(status_code=400, detail="CV must be smaller than 5MB")

    filename = f"{current_user.id}_{int(time.time())}.pdf"
    ensure_upload_dirs()
    filepath = PRIVATE_CV_DIR / filename

    with open(filepath, "wb") as f:
        f.write(contents)

    previous_cv = current_user.cv_url
    url = build_cv_storage_url(filename)
    user_service.update_profile(current_user.id, UserUpdate(cv_url=url))
    delete_managed_asset("cv", previous_cv)

    return {"url": url}


@router.get("/me/cv")
def get_my_cv(
    download: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    """Open or download the authenticated user's CV."""
    file_path = _resolve_cv_file_or_404(current_user)
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=_build_cv_download_name(current_user),
        content_disposition_type="attachment" if download else "inline",
    )


@router.get("/me/cv/preview")
def preview_my_cv(
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's CV as JSON-safe bytes for in-app preview."""
    file_path = _resolve_cv_file_or_404(current_user)
    return _build_cv_preview_payload(current_user, file_path)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    _: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Get a user's profile by ID (authenticated only)."""
    return user_service.get_profile(user_id)


@router.get("/{user_id}/cv")
def get_user_cv(
    user_id: int,
    download: bool = Query(True),
    current_user: User = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
    application_repo: ApplicationRepository = Depends(get_application_repo),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    """Open or download a student's CV when the requester is authorized."""
    target_user = user_repo.get_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    _assert_cv_access(current_user, target_user, application_repo, organization_service)
    file_path = _resolve_cv_file_or_404(target_user)

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=_build_cv_download_name(target_user),
        content_disposition_type="attachment" if download else "inline",
    )


@router.get("/{user_id}/cv/preview")
def preview_user_cv(
    user_id: int,
    current_user: User = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
    application_repo: ApplicationRepository = Depends(get_application_repo),
    organization_service: OrganizationService = Depends(get_organization_service),
):
    """Return a student's CV as JSON-safe bytes when the requester is authorized."""
    target_user = user_repo.get_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    _assert_cv_access(current_user, target_user, application_repo, organization_service)
    file_path = _resolve_cv_file_or_404(target_user)
    return _build_cv_preview_payload(target_user, file_path)
