from datetime import date, datetime, timezone

from sqlalchemy import CheckConstraint, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import relationship

from app.config.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class InternshipLogbook(Base):
    """Student-owned internship profile for conversion-ready logbook records."""

    __tablename__ = "internship_logbooks"
    __table_args__ = (
        CheckConstraint("target_hours IS NULL OR target_hours > 0", name="ck_logbooks_target_hours_positive"),
        CheckConstraint("start_date IS NULL OR end_date IS NULL OR end_date >= start_date", name="ck_logbooks_date_range"),
    )

    id: int = Column(Integer, primary_key=True, index=True)
    student_id: int = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id: int | None = Column(Integer, ForeignKey("applications.id", ondelete="SET NULL"), nullable=True, unique=True, index=True)
    title: str = Column(String(300), nullable=False)
    role: str = Column(String(200), nullable=False)
    company: str = Column(String(200), nullable=False)
    semester: str | None = Column(String(100), nullable=True)
    mentor_name: str | None = Column(String(200), nullable=True)
    start_date: date | None = Column(Date, nullable=True)
    end_date: date | None = Column(Date, nullable=True)
    target_hours: float | None = Column(Float, nullable=True)
    notes: str | None = Column(Text, nullable=True)

    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    student = relationship("User", back_populates="logbooks")
    application = relationship("Application")
    entries = relationship(
        "LogbookEntry",
        back_populates="logbook",
        cascade="all, delete-orphan",
        order_by="desc(LogbookEntry.activity_date)",
    )


class LogbookEntry(Base):
    """Single dated activity entry inside an internship logbook."""

    __tablename__ = "logbook_entries"
    __table_args__ = (
        CheckConstraint("hours > 0", name="ck_logbook_entries_hours_positive"),
        CheckConstraint("start_time IS NULL OR end_time IS NULL OR end_time > start_time", name="ck_logbook_entries_time_range"),
    )

    id: int = Column(Integer, primary_key=True, index=True)
    logbook_id: int = Column(Integer, ForeignKey("internship_logbooks.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_date: date = Column(Date, nullable=False, index=True)
    title: str = Column(String(300), nullable=False)
    category: str | None = Column(String(100), nullable=True)
    hours: float = Column(Float, nullable=False)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    location: str | None = Column(String(255), nullable=True)
    description: str | None = Column(Text, nullable=True)

    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    logbook = relationship("InternshipLogbook", back_populates="entries")
    attachments = relationship(
        "LogbookAttachment",
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="LogbookAttachment.uploaded_at",
    )


class LogbookAttachment(Base):
    """Private evidence file attached to a logbook entry."""

    __tablename__ = "logbook_attachments"

    id: int = Column(Integer, primary_key=True, index=True)
    entry_id: int = Column(Integer, ForeignKey("logbook_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    filename: str = Column(String(255), nullable=False)
    original_filename: str = Column(String(255), nullable=False)
    content_type: str = Column(String(100), nullable=False)
    file_size: int = Column(Integer, nullable=False)
    storage_path: str = Column(String(500), nullable=False)
    uploaded_at: datetime = Column(DateTime, default=_utcnow)

    entry = relationship("LogbookEntry", back_populates="attachments")
