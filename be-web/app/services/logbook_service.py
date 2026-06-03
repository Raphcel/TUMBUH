from datetime import date, datetime, timezone
from io import BytesIO

from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.domain.models.application import ApplicationStatus
from app.domain.models.logbook import InternshipLogbook, LogbookAttachment, LogbookEntry
from app.repositories.application_repository import ApplicationRepository
from app.repositories.logbook_repository import LogbookRepository
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
from app.services.audit_service import audit_log
from app.services.user_asset_service import delete_managed_asset


class LogbookService:
    """Business logic for student internship logbooks."""

    def __init__(
        self,
        logbook_repo: LogbookRepository,
        application_repo: ApplicationRepository,
    ):
        self._logbook_repo = logbook_repo
        self._application_repo = application_repo

    def create_logbook(self, student_id: int, data: LogbookCreate) -> LogbookResponse:
        self._validate_create_dates(data)
        application = None
        if data.application_id is not None:
            existing = self._logbook_repo.get_by_application(data.application_id)
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Logbook already exists for this application")

            application = self._application_repo.get_by_id(data.application_id)
            if not application or application.student_id != student_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
            if application.status != ApplicationStatus.ACCEPTED:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only accepted applications can be linked to a logbook")

        opportunity = application.opportunity if application else None
        company = opportunity.company if opportunity else None
        title = data.title or (opportunity.title if opportunity else None)
        role = data.role or title
        company_name = data.company or (company.name if company else None)

        if not title or not role or not company_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title, role, and company are required")

        logbook = self._logbook_repo.create({
            "student_id": student_id,
            "application_id": data.application_id,
            "title": title,
            "role": role,
            "company": company_name,
            "semester": data.semester,
            "mentor_name": data.mentor_name,
            "start_date": data.start_date,
            "end_date": data.end_date,
            "target_hours": data.target_hours,
            "notes": data.notes,
        })

        audit_log(
            "LOGBOOK_CREATE",
            user_id=student_id,
            user_role="student",
            resource="logbook",
            resource_id=logbook.id,
            detail=f"Student {student_id} created logbook for {company_name}",
            success=True,
        )

        return self._to_logbook_response(self._logbook_repo.get_by_id(logbook.id))

    def list_logbooks(self, student_id: int, skip: int = 0, limit: int = 100) -> LogbookListResponse:
        logbooks = self._logbook_repo.get_by_student(student_id, skip, limit)
        return LogbookListResponse(
            items=[self._to_logbook_response(logbook) for logbook in logbooks],
            total=self._logbook_repo.count_by_student(student_id),
        )

    def get_logbook(self, student_id: int, logbook_id: int) -> LogbookResponse:
        return self._to_logbook_response(self._get_owned_logbook(student_id, logbook_id))

    def update_logbook(self, student_id: int, logbook_id: int, data: LogbookUpdate) -> LogbookResponse:
        logbook = self._get_owned_logbook(student_id, logbook_id)
        update_data = data.model_dump(exclude_unset=True)
        self._validate_update_dates(logbook, update_data)
        updated = self._logbook_repo.update(logbook, update_data)

        audit_log(
            "LOGBOOK_UPDATE",
            user_id=student_id,
            user_role="student",
            resource="logbook",
            resource_id=logbook_id,
            detail=f"Student {student_id} updated logbook {logbook_id}",
            success=True,
        )

        return self._to_logbook_response(self._logbook_repo.get_by_id(updated.id))

    def delete_logbook(self, student_id: int, logbook_id: int) -> None:
        logbook = self._get_owned_logbook(student_id, logbook_id)
        storage_paths = [
            attachment.storage_path
            for entry in logbook.entries
            for attachment in entry.attachments
        ]
        self._logbook_repo.delete(logbook_id)
        for storage_path in storage_paths:
            delete_managed_asset("logbook_evidence", storage_path)

        audit_log(
            "LOGBOOK_DELETE",
            level="warn",
            user_id=student_id,
            user_role="student",
            resource="logbook",
            resource_id=logbook_id,
            detail=f"Student {student_id} deleted logbook {logbook_id}",
            success=True,
        )

    def create_entry(self, student_id: int, logbook_id: int, data: LogbookEntryCreate) -> LogbookEntryResponse:
        self._get_owned_logbook(student_id, logbook_id)
        self._validate_entry_date(data.activity_date)
        self._validate_entry_time(None, data.model_dump())
        entry = self._logbook_repo.create_entry({
            "logbook_id": logbook_id,
            **data.model_dump(),
        })

        audit_log(
            "LOGBOOK_ENTRY_CREATE",
            user_id=student_id,
            user_role="student",
            resource="logbook_entry",
            resource_id=entry.id,
            detail=f"Student {student_id} added {data.hours} hours to logbook {logbook_id}",
            success=True,
        )

        return self._to_entry_response(self._logbook_repo.get_entry_by_id(entry.id))

    def update_entry(self, student_id: int, entry_id: int, data: LogbookEntryUpdate) -> LogbookEntryResponse:
        entry = self._get_owned_entry(student_id, entry_id)
        update_data = data.model_dump(exclude_unset=True)
        if "activity_date" in update_data:
            self._validate_entry_date(update_data["activity_date"])
        self._validate_entry_time(entry, update_data)
        updated = self._logbook_repo.update_entry(entry, update_data)

        audit_log(
            "LOGBOOK_ENTRY_UPDATE",
            user_id=student_id,
            user_role="student",
            resource="logbook_entry",
            resource_id=entry_id,
            detail=f"Student {student_id} updated logbook entry {entry_id}",
            success=True,
        )

        return self._to_entry_response(self._logbook_repo.get_entry_by_id(updated.id))

    def delete_entry(self, student_id: int, entry_id: int) -> None:
        entry = self._get_owned_entry(student_id, entry_id)
        storage_paths = [attachment.storage_path for attachment in entry.attachments]
        self._logbook_repo.delete_entry(entry)
        for storage_path in storage_paths:
            delete_managed_asset("logbook_evidence", storage_path)

        audit_log(
            "LOGBOOK_ENTRY_DELETE",
            level="warn",
            user_id=student_id,
            user_role="student",
            resource="logbook_entry",
            resource_id=entry_id,
            detail=f"Student {student_id} deleted logbook entry {entry_id}",
            success=True,
        )

    def add_attachment(self, student_id: int, entry_id: int, data: dict) -> LogbookAttachmentResponse:
        self._get_owned_entry(student_id, entry_id)
        attachment = self._logbook_repo.create_attachment({"entry_id": entry_id, **data})

        audit_log(
            "LOGBOOK_ATTACHMENT_UPLOAD",
            user_id=student_id,
            user_role="student",
            resource="logbook_attachment",
            resource_id=attachment.id,
            detail=f"Student {student_id} uploaded attachment for logbook entry {entry_id}",
            success=True,
        )

        return LogbookAttachmentResponse.model_validate(attachment)

    def download_attachment(self, student_id: int, attachment_id: int) -> LogbookAttachment:
        attachment = self.get_attachment_for_user(student_id, attachment_id)

        audit_log(
            "LOGBOOK_ATTACHMENT_DOWNLOAD",
            user_id=student_id,
            user_role="student",
            resource="logbook_attachment",
            resource_id=attachment_id,
            detail=f"Student {student_id} downloaded logbook attachment {attachment_id}",
            success=True,
        )

        return attachment

    def get_attachment_for_user(self, student_id: int, attachment_id: int) -> LogbookAttachment:
        attachment = self._logbook_repo.get_attachment_by_id(attachment_id)
        if not attachment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
        if attachment.entry.logbook.student_id != student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your attachment")
        return attachment

    def delete_attachment(self, student_id: int, attachment_id: int) -> None:
        attachment = self.get_attachment_for_user(student_id, attachment_id)
        storage_path = attachment.storage_path
        self._logbook_repo.delete_attachment(attachment)
        delete_managed_asset("logbook_evidence", storage_path)

        audit_log(
            "LOGBOOK_ATTACHMENT_DELETE",
            level="warn",
            user_id=student_id,
            user_role="student",
            resource="logbook_attachment",
            resource_id=attachment_id,
            detail=f"Student {student_id} deleted logbook attachment {attachment_id}",
            success=True,
        )

    def export_pdf(self, student_id: int, logbook_id: int, student_name: str) -> bytes:
        logbook = self._get_owned_logbook(student_id, logbook_id)
        pdf = self._build_pdf(logbook, student_name)

        audit_log(
            "LOGBOOK_EXPORT_PDF",
            user_id=student_id,
            user_role="student",
            resource="logbook",
            resource_id=logbook_id,
            detail=f"Student {student_id} exported logbook {logbook_id} as PDF",
            success=True,
        )

        return pdf

    def _get_owned_logbook(self, student_id: int, logbook_id: int) -> InternshipLogbook:
        logbook = self._logbook_repo.get_by_id(logbook_id)
        if not logbook:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logbook not found")
        if logbook.student_id != student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your logbook")
        return logbook

    def _get_owned_entry(self, student_id: int, entry_id: int) -> LogbookEntry:
        entry = self._logbook_repo.get_entry_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
        if entry.logbook.student_id != student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your logbook entry")
        return entry

    @staticmethod
    def _validate_create_dates(data: LogbookCreate) -> None:
        if data.start_date and data.end_date and data.end_date < data.start_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date cannot be before start date")

    @staticmethod
    def _validate_update_dates(logbook: InternshipLogbook, update_data: dict) -> None:
        start_date = update_data.get("start_date", logbook.start_date)
        end_date = update_data.get("end_date", logbook.end_date)
        if start_date and end_date and end_date < start_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date cannot be before start date")

    @staticmethod
    def _validate_entry_date(activity_date: date) -> None:
        if activity_date > date.today():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Activity date cannot be in the future")

    @staticmethod
    def _validate_entry_time(entry: LogbookEntry | None, data: dict) -> None:
        start_time = data.get("start_time", entry.start_time if entry else None)
        end_time = data.get("end_time", entry.end_time if entry else None)
        if start_time and end_time and end_time <= start_time:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End time must be after start time")

    @staticmethod
    def _build_pdf(logbook: InternshipLogbook, student_name: str) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        story = []

        total_hours = sum(entry.hours for entry in logbook.entries)
        progress = None
        if logbook.target_hours:
            progress = min((total_hours / logbook.target_hours) * 100, 100)

        story.append(Paragraph(logbook.title, styles["Title"]))
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"Student: {student_name}", styles["Normal"]))
        story.append(Paragraph(f"Company: {logbook.company}", styles["Normal"]))
        story.append(Paragraph(f"Role: {logbook.role}", styles["Normal"]))
        if logbook.semester:
            story.append(Paragraph(f"Semester: {logbook.semester}", styles["Normal"]))
        if logbook.mentor_name:
            story.append(Paragraph(f"Mentor: {logbook.mentor_name}", styles["Normal"]))
        if logbook.start_date or logbook.end_date:
            story.append(Paragraph(f"Period: {logbook.start_date or ''} to {logbook.end_date or ''}", styles["Normal"]))
        target = f"{logbook.target_hours:g} hours" if logbook.target_hours else "Not set"
        progress_text = f" ({progress:.1f}% complete)" if progress is not None else ""
        story.append(Paragraph(f"Total Hours: {total_hours:g} / Target: {target}{progress_text}", styles["Normal"]))
        story.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
        story.append(Spacer(1, 18))

        rows = [["Date", "Time", "Title", "Category", "Hours", "Location", "Description"]]
        for entry in sorted(logbook.entries, key=lambda item: item.activity_date):
            time_range = ""
            if entry.start_time and entry.end_time:
                time_range = f"{entry.start_time.strftime('%H:%M')} - {entry.end_time.strftime('%H:%M')}"
            elif entry.start_time:
                time_range = entry.start_time.strftime("%H:%M")
            elif entry.end_time:
                time_range = entry.end_time.strftime("%H:%M")
            rows.append([
                entry.activity_date.isoformat(),
                time_range,
                Paragraph(entry.title, styles["BodyText"]),
                entry.category or "",
                f"{entry.hours:g}",
                entry.location or "",
                Paragraph(entry.description or "", styles["BodyText"]),
            ])

        if len(rows) == 1:
            story.append(Paragraph("No activity entries yet.", styles["Normal"]))
        else:
            table = Table(rows, colWidths=[58, 48, 92, 64, 34, 62, 132], repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a8754")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
            ]))
            story.append(table)

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def _to_logbook_response(logbook: InternshipLogbook) -> LogbookResponse:
        return LogbookResponse.model_validate(logbook)

    @staticmethod
    def _to_entry_response(entry: LogbookEntry) -> LogbookEntryResponse:
        return LogbookEntryResponse.model_validate(entry)
