from __future__ import annotations

import os
import shutil
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_UPLOADS_DIR = BACKEND_ROOT / "uploads"
PRIVATE_UPLOADS_DIR = BACKEND_ROOT / "private_uploads"
LEGACY_UPLOADS_DIR = BACKEND_ROOT / "app" / "uploads"

AVATAR_DIR = PUBLIC_UPLOADS_DIR / "avatars"
PRIVATE_CV_DIR = PRIVATE_UPLOADS_DIR / "cvs"
LOGBOOK_EVIDENCE_DIR = PRIVATE_UPLOADS_DIR / "logbook_evidence"


def ensure_upload_dirs() -> None:
    """Create managed upload directories used by the application."""
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    PRIVATE_CV_DIR.mkdir(parents=True, exist_ok=True)
    LOGBOOK_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def build_avatar_url(filename: str) -> str:
    return f"/uploads/avatars/{filename}"


def build_cv_storage_url(filename: str) -> str:
    # Keep the stored value stable and backward compatible even though CVs are no
    # longer exposed through the public static mount.
    return f"/uploads/cvs/{filename}"


def build_logbook_evidence_storage_url(filename: str) -> str:
    return f"/uploads/logbook_evidence/{filename}"


def is_managed_avatar_url(value: str | None) -> bool:
    return bool(value and value.startswith("/uploads/avatars/"))


def is_managed_cv_url(value: str | None) -> bool:
    return bool(value and value.startswith("/uploads/cvs/"))


def is_managed_logbook_evidence_url(value: str | None) -> bool:
    return bool(value and value.startswith("/uploads/logbook_evidence/"))


def is_managed_url(value: str | None, asset_type: str) -> bool:
    if asset_type == "avatar":
        return is_managed_avatar_url(value)
    if asset_type == "cv":
        return is_managed_cv_url(value)
    if asset_type == "logbook_evidence":
        return is_managed_logbook_evidence_url(value)
    raise ValueError(f"Unsupported asset type: {asset_type}")


def extract_asset_filename(value: str | None, asset_type: str) -> str | None:
    if not is_managed_url(value, asset_type):
        return None
    filename = os.path.basename(value or "")
    return filename or None


def _current_path(asset_type: str, filename: str) -> Path:
    if asset_type == "avatar":
        return AVATAR_DIR / filename
    if asset_type == "cv":
        return PRIVATE_CV_DIR / filename
    if asset_type == "logbook_evidence":
        return LOGBOOK_EVIDENCE_DIR / filename
    raise ValueError(f"Unsupported asset type: {asset_type}")


def _legacy_candidates(asset_type: str, filename: str) -> list[Path]:
    if asset_type == "avatar":
        return [LEGACY_UPLOADS_DIR / "avatars" / filename]
    if asset_type == "cv":
        return [
            LEGACY_UPLOADS_DIR / "cvs" / filename,
            PUBLIC_UPLOADS_DIR / "cvs" / filename,
        ]
    if asset_type == "logbook_evidence":
        return [
            LEGACY_UPLOADS_DIR / "logbook_evidence" / filename,
            PUBLIC_UPLOADS_DIR / "logbook_evidence" / filename,
        ]
    raise ValueError(f"Unsupported asset type: {asset_type}")


def ensure_asset_in_managed_location(asset_type: str, value: str | None) -> Path | None:
    """
    Resolve the current file path for a managed asset.

    Legacy files are moved into the current managed directory lazily so existing
    uploads continue to work without a data migration.
    """
    filename = extract_asset_filename(value, asset_type)
    if not filename:
        return None

    ensure_upload_dirs()
    current_path = _current_path(asset_type, filename)
    if current_path.exists():
        return current_path

    for legacy_path in _legacy_candidates(asset_type, filename):
        if not legacy_path.exists():
            continue
        current_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(legacy_path), str(current_path))
        return current_path

    return None


def delete_managed_asset(asset_type: str, value: str | None) -> None:
    """Delete all managed copies of an asset, including legacy locations."""
    filename = extract_asset_filename(value, asset_type)
    if not filename:
        return

    for path in [_current_path(asset_type, filename), *_legacy_candidates(asset_type, filename)]:
        try:
            path.unlink()
        except FileNotFoundError:
            continue

