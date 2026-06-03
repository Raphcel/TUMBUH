from datetime import date, datetime, time

from pydantic import BaseModel, Field, field_validator, model_validator


LOGBOOK_CATEGORIES = (
    "Development",
    "Meeting",
    "Training",
    "Research",
    "Documentation",
    "Presentation",
    "Administration",
    "Other",
)


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class LogbookBase(BaseModel):
    @field_validator("title", "role", "company", "semester", "mentor_name", "notes", mode="before", check_fields=False)
    @classmethod
    def normalize_optional_text(cls, value):
        return _normalize_optional_text(value)


class LogbookCreate(LogbookBase):
    """Create an internship logbook profile."""

    application_id: int | None = None
    title: str | None = Field(default=None, max_length=300)
    role: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    semester: str | None = Field(default=None, max_length=100)
    mentor_name: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    target_hours: float | None = Field(default=None, gt=0)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        for field in ("title", "role", "company"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field.replace('_', ' ').title()} cannot be empty")
        return self


class LogbookUpdate(LogbookBase):
    """Update an internship logbook profile."""

    title: str | None = Field(default=None, max_length=300)
    role: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    semester: str | None = Field(default=None, max_length=100)
    mentor_name: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    target_hours: float | None = Field(default=None, gt=0)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        for field in ("title", "role", "company"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field.replace('_', ' ').title()} cannot be empty")
        return self


class LogbookEntryCreate(BaseModel):
    """Create a dated activity entry."""

    activity_date: date
    title: str = Field(..., max_length=300)
    category: str | None = Field(default=None, max_length=100)
    hours: float = Field(..., gt=0)
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = Field(default=None, max_length=255)
    description: str | None = None

    @field_validator("title", "location", "description", mode="before")
    @classmethod
    def normalize_text(cls, value):
        return _normalize_optional_text(value)

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, value):
        value = _normalize_optional_text(value)
        if value is not None and value not in LOGBOOK_CATEGORIES:
            raise ValueError("Invalid logbook category")
        return value

    @model_validator(mode="after")
    def validate_entry(self):
        if not self.title:
            raise ValueError("Title is required")
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")
        return self


class LogbookEntryUpdate(BaseModel):
    """Update a dated activity entry."""

    activity_date: date | None = None
    title: str | None = Field(default=None, max_length=300)
    category: str | None = Field(default=None, max_length=100)
    hours: float | None = Field(default=None, gt=0)
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = Field(default=None, max_length=255)
    description: str | None = None

    @field_validator("title", "location", "description", mode="before")
    @classmethod
    def normalize_text(cls, value):
        return _normalize_optional_text(value)

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, value):
        value = _normalize_optional_text(value)
        if value is not None and value not in LOGBOOK_CATEGORIES:
            raise ValueError("Invalid logbook category")
        return value

    @model_validator(mode="after")
    def validate_entry(self):
        if "title" in self.model_fields_set and not self.title:
            raise ValueError("Title cannot be empty")
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")
        return self


class LogbookAttachmentResponse(BaseModel):
    id: int
    entry_id: int
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class LogbookEntryResponse(BaseModel):
    id: int
    logbook_id: int
    activity_date: date
    title: str
    category: str | None = None
    hours: float
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    description: str | None = None
    attachments: list[LogbookAttachmentResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class LogbookResponse(BaseModel):
    id: int
    student_id: int
    application_id: int | None = None
    title: str
    role: str
    company: str
    semester: str | None = None
    mentor_name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    target_hours: float | None = None
    notes: str | None = None
    entries: list[LogbookEntryResponse] = Field(default_factory=list)
    total_hours: float = 0
    attachment_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None

    @model_validator(mode="after")
    def populate_summary(self):
        self.total_hours = sum(entry.hours for entry in self.entries)
        self.attachment_count = sum(len(entry.attachments) for entry in self.entries)
        return self

    class Config:
        from_attributes = True


class LogbookListResponse(BaseModel):
    items: list[LogbookResponse]
    total: int
