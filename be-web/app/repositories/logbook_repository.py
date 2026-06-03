from sqlalchemy.orm import Session, joinedload

from app.domain.models.application import Application
from app.domain.models.logbook import InternshipLogbook, LogbookAttachment, LogbookEntry
from app.domain.models.opportunity import Opportunity
from app.repositories.base import BaseRepository


class LogbookRepository(BaseRepository[InternshipLogbook]):
    """Data access for internship logbooks, entries, and evidence files."""

    def __init__(self, db: Session):
        super().__init__(InternshipLogbook, db)

    def get_by_id(self, id: int) -> InternshipLogbook | None:
        return (
            self._db.query(InternshipLogbook)
            .options(
                joinedload(InternshipLogbook.entries).joinedload(LogbookEntry.attachments),
                joinedload(InternshipLogbook.application)
                .joinedload(Application.opportunity)
                .joinedload(Opportunity.company),
            )
            .filter(InternshipLogbook.id == id)
            .first()
        )

    def get_by_student(self, student_id: int, skip: int = 0, limit: int = 100) -> list[InternshipLogbook]:
        return (
            self._db.query(InternshipLogbook)
            .options(joinedload(InternshipLogbook.entries).joinedload(LogbookEntry.attachments))
            .filter(InternshipLogbook.student_id == student_id)
            .order_by(InternshipLogbook.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_by_student(self, student_id: int) -> int:
        return (
            self._db.query(InternshipLogbook)
            .filter(InternshipLogbook.student_id == student_id)
            .count()
        )

    def get_by_application(self, application_id: int) -> InternshipLogbook | None:
        return (
            self._db.query(InternshipLogbook)
            .filter(InternshipLogbook.application_id == application_id)
            .first()
        )

    def create_entry(self, data: dict) -> LogbookEntry:
        entry = LogbookEntry(**data)
        self._db.add(entry)
        self._db.commit()
        self._db.refresh(entry)
        return entry

    def get_entry_by_id(self, entry_id: int) -> LogbookEntry | None:
        return (
            self._db.query(LogbookEntry)
            .options(joinedload(LogbookEntry.attachments), joinedload(LogbookEntry.logbook))
            .filter(LogbookEntry.id == entry_id)
            .first()
        )

    def update_entry(self, entry: LogbookEntry, data: dict) -> LogbookEntry:
        for field, value in data.items():
            setattr(entry, field, value)
        self._db.commit()
        self._db.refresh(entry)
        return entry

    def delete_entry(self, entry: LogbookEntry) -> None:
        self._db.delete(entry)
        self._db.commit()

    def create_attachment(self, data: dict) -> LogbookAttachment:
        attachment = LogbookAttachment(**data)
        self._db.add(attachment)
        self._db.commit()
        self._db.refresh(attachment)
        return attachment

    def get_attachment_by_id(self, attachment_id: int) -> LogbookAttachment | None:
        return (
            self._db.query(LogbookAttachment)
            .join(LogbookEntry, LogbookEntry.id == LogbookAttachment.entry_id)
            .options(joinedload(LogbookAttachment.entry).joinedload(LogbookEntry.logbook))
            .filter(LogbookAttachment.id == attachment_id)
            .first()
        )

    def delete_attachment(self, attachment: LogbookAttachment) -> None:
        self._db.delete(attachment)
        self._db.commit()
