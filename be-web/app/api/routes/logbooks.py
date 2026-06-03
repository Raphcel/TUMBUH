import re
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.api.dependencies import get_logbook_service, require_role
from app.domain.models.user import User
from app.schemas.logbook import (
    LogbookAttachmentResponse,
    LogbookCreate,
    LogbookEntryCreate,
    LogbookEntryResponse,
    LogbookEntryUpdate,
    LogbookListResponse,
    LogbookResponse,
    LogbookUpdate,
)
from app.services.logbook_service import LogbookService
from app.services.user_asset_service import (
    LOGBOOK_EVIDENCE_DIR,
    build_logbook_evidence_storage_url,
    delete_managed_asset,
    ensure_asset_in_managed_location,
    ensure_upload_dirs,
)

router = APIRouter(tags=["Logbooks"])

MAX_EVIDENCE_SIZE = 5 * 1024 * 1024
ALLOWED_EVIDENCE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}


def _download_name(value: str | None, fallback: str) -> str:
    value = value or fallback
    value = re.sub(r"[\r\n/\\]+", "-", value).strip()
    return value or fallback


def _pdf_name(logbook: LogbookResponse) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", logbook.title.lower()).strip("-")
    return f"{slug or f'logbook-{logbook.id}'}.pdf"


@router.post("/", response_model=LogbookResponse, status_code=status.HTTP_201_CREATED)
def create_logbook(
    data: LogbookCreate,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    return logbook_service.create_logbook(current_user.id, data)


@router.get("/", response_model=LogbookListResponse)
def list_logbooks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    return logbook_service.list_logbooks(current_user.id, skip, limit)


@router.get("/{logbook_id}", response_model=LogbookResponse)
def get_logbook(
    logbook_id: int,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    return logbook_service.get_logbook(current_user.id, logbook_id)


@router.put("/{logbook_id}", response_model=LogbookResponse)
def update_logbook(
    logbook_id: int,
    data: LogbookUpdate,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    return logbook_service.update_logbook(current_user.id, logbook_id, data)


@router.delete("/{logbook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_logbook(
    logbook_id: int,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    logbook_service.delete_logbook(current_user.id, logbook_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{logbook_id}/entries", response_model=LogbookEntryResponse, status_code=status.HTTP_201_CREATED)
def create_entry(
    logbook_id: int,
    data: LogbookEntryCreate,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    return logbook_service.create_entry(current_user.id, logbook_id, data)


@router.put("/entries/{entry_id}", response_model=LogbookEntryResponse)
def update_entry(
    entry_id: int,
    data: LogbookEntryUpdate,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    return logbook_service.update_entry(current_user.id, entry_id, data)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: int,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    logbook_service.delete_entry(current_user.id, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/entries/{entry_id}/attachments", response_model=LogbookAttachmentResponse, status_code=status.HTTP_201_CREATED)
def upload_attachment(
    entry_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    extension = ALLOWED_EVIDENCE_TYPES.get(file.content_type or "")
    if not extension:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG, PNG, WebP, and PDF files are allowed")

    contents = file.file.read()
    if len(contents) > MAX_EVIDENCE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be smaller than 5 MB")

    ensure_upload_dirs()
    filename = f"{uuid4().hex}.{extension}"
    storage_path = build_logbook_evidence_storage_url(filename)
    filepath = LOGBOOK_EVIDENCE_DIR / filename
    filepath.write_bytes(contents)

    try:
        return logbook_service.add_attachment(
            current_user.id,
            entry_id,
            {
                "filename": filename,
                "original_filename": _download_name(file.filename, filename),
                "content_type": file.content_type,
                "file_size": len(contents),
                "storage_path": storage_path,
            },
        )
    except Exception:
        delete_managed_asset("logbook_evidence", storage_path)
        raise


@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    attachment = logbook_service.download_attachment(current_user.id, attachment_id)
    file_path = ensure_asset_in_managed_location("logbook_evidence", attachment.storage_path)
    if not file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file is missing")

    return FileResponse(
        path=file_path,
        media_type=attachment.content_type,
        filename=_download_name(attachment.original_filename, attachment.filename),
        content_disposition_type="attachment",
    )


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: int,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    logbook_service.delete_attachment(current_user.id, attachment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{logbook_id}/export/pdf")
def export_pdf(
    logbook_id: int,
    current_user: User = Depends(require_role("student")),
    logbook_service: LogbookService = Depends(get_logbook_service),
):
    logbook = logbook_service.get_logbook(current_user.id, logbook_id)
    student_name = current_user.full_name
    pdf = logbook_service.export_pdf(current_user.id, logbook_id, student_name)
    headers = {"Content-Disposition": f'attachment; filename="{_pdf_name(logbook)}"'}
    return Response(content=pdf, media_type="application/pdf", headers=headers)
