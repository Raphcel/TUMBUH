import json
import re

from fastapi import HTTPException, status

from app.config.settings import get_settings
from app.domain.models.opportunity import OpportunityType
from app.repositories.notification_repository import NotificationRepository
from app.repositories.opportunity_repository import OpportunityRepository
from app.repositories.application_repository import ApplicationRepository
from app.repositories.company_follow_repository import CompanyFollowRepository
from app.repositories.user_repository import UserRepository
from app.schemas.opportunity import (
    OpportunityCreate, OpportunityUpdate, OpportunityResponse, OpportunityListResponse,
)
from app.services.audit_service import audit_log
from app.services.email_service import EmailService
from app.services.opportunity_matcher import find_matching_students, normalize_text


class OpportunityService:
    """Service handling opportunity business logic."""

    def __init__(
        self,
        opportunity_repo: OpportunityRepository,
        application_repo: ApplicationRepository | None = None,
        notification_repo: NotificationRepository | None = None,
        user_repo: UserRepository | None = None,
        company_follow_repo: CompanyFollowRepository | None = None,
        email_service: EmailService | None = None,
    ):
        self._opportunity_repo = opportunity_repo
        self._application_repo = application_repo
        self._notification_repo = notification_repo
        self._user_repo = user_repo
        self._company_follow_repo = company_follow_repo
        self._email_service = email_service

    def verify_ownership(self, opportunity_id: int, company_id: int | None) -> None:
        """Verify the opportunity belongs to the HR user's company."""
        opp = self._opportunity_repo.get_by_id(opportunity_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
        if opp.company_id != company_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only manage your own company's opportunities")

    def get_company_and_creator(self, opportunity_id: int) -> tuple[int, int | None]:
        opp = self._opportunity_repo.get_by_id(opportunity_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
        return opp.company_id, opp.created_by_user_id

    def get_opportunity(self, opportunity_id: int) -> OpportunityResponse:
        """Get a single opportunity by ID (with company)."""
        opp = self._opportunity_repo.get_by_id_with_company(opportunity_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
        return self._to_response(opp)

    def list_opportunities(
        self,
        query: str | None = None,
        type_filter: OpportunityType | None = None,
        location: str | None = None,
        sort: str = "latest",
        company_id: int | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> OpportunityListResponse:
        """List and search opportunities with filters."""
        results = self._opportunity_repo.search(query, type_filter, location, sort, company_id, skip, limit)
        total = self._opportunity_repo.count_search(query, type_filter, location, company_id)
        return OpportunityListResponse(
            items=[self._to_response(o) for o in results],
            total=total,
        )

    def get_by_company(self, company_id: int, skip: int = 0, limit: int = 100) -> OpportunityListResponse:
        """List opportunities for a specific company."""
        results = self._opportunity_repo.get_by_company(company_id, skip, limit)
        total = self._opportunity_repo.count_by_company(company_id)
        return OpportunityListResponse(
            items=[self._to_response(o) for o in results],
            total=total,
        )

    def create_opportunity(self, data: OpportunityCreate) -> OpportunityResponse:
        """Create a new opportunity."""
        opp_dict = data.model_dump()
        opp_dict["requirements"] = self._serialize_requirements(opp_dict.get("requirements"))
        opp_dict["target_majors"] = self._clean_list(opp_dict.get("target_majors"))
        opp_dict["skill_tags"] = self._clean_list(opp_dict.get("skill_tags"))
        opp_dict["application_questions"] = self._clean_application_questions(opp_dict.get("application_questions"))
        opp = self._opportunity_repo.create(opp_dict)
        # Re-fetch with eager-loaded relationships to avoid lazy-load errors
        opp = self._opportunity_repo.get_by_id_with_company(opp.id)
        self._notify_students_new_opportunity(opp)

        audit_log(
            "OPPORTUNITY_CREATE",
            resource="opportunity",
            resource_id=opp.id,
            detail=f"New opportunity created: '{data.title}' for company {data.company_id}",
            success=True,
        )

        return self._to_response(opp)

    def update_opportunity(self, opportunity_id: int, data: OpportunityUpdate) -> OpportunityResponse:
        """Update an existing opportunity."""
        opp = self._opportunity_repo.get_by_id(opportunity_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")

        update_data = data.model_dump(exclude_unset=True)
        if "requirements" in update_data:
            update_data["requirements"] = self._serialize_requirements(update_data.get("requirements"))
        if "target_majors" in update_data:
            update_data["target_majors"] = self._clean_list(update_data.get("target_majors"))
        if "skill_tags" in update_data:
            update_data["skill_tags"] = self._clean_list(update_data.get("skill_tags"))
        if "application_questions" in update_data:
            update_data["application_questions"] = self._clean_application_questions(update_data.get("application_questions"))

        updated = self._opportunity_repo.update(opp, update_data)
        # Re-fetch with eager-loaded relationships
        updated = self._opportunity_repo.get_by_id_with_company(updated.id)

        audit_log(
            "OPPORTUNITY_UPDATE",
            resource="opportunity",
            resource_id=opportunity_id,
            detail=f"Opportunity {opportunity_id} updated",
            success=True,
        )

        return self._to_response(updated)

    def delete_opportunity(self, opportunity_id: int) -> dict:
        """Delete an opportunity."""
        success = self._opportunity_repo.delete(opportunity_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")

        audit_log(
            "OPPORTUNITY_DELETE",
            level="warn",
            resource="opportunity",
            resource_id=opportunity_id,
            detail=f"Opportunity {opportunity_id} deleted",
            success=True,
        )

        return {"message": "Opportunity deleted successfully"}

    # ── Helper ───────────────────────────────────────────────

    @staticmethod
    def _to_response(opp) -> OpportunityResponse:
        """Convert ORM model to response schema."""
        data = OpportunityResponse.model_validate(opp)
        if hasattr(opp, "applications") and opp.applications is not None:
            data.applicants_count = len(opp.applications)
        return data

    @staticmethod
    def _clean_application_questions(questions: list[dict] | None) -> list[dict]:
        cleaned = []
        seen_ids = set()
        for index, raw in enumerate(questions or []):
            if not isinstance(raw, dict):
                continue
            label = str(raw.get("label") or "").strip()
            if not label:
                continue
            question_id = str(raw.get("id") or f"q_{index + 1}").strip()
            if question_id in seen_ids:
                question_id = f"{question_id}_{index + 1}"
            seen_ids.add(question_id)
            question_type = str(raw.get("type") or "short_text").strip()
            if question_type not in {"short_text", "long_text", "single_choice"}:
                question_type = "short_text"
            options = [
                str(option).strip()
                for option in raw.get("options", [])
                if str(option).strip()
            ]
            if question_type == "single_choice" and not options:
                question_type = "short_text"
            cleaned.append({
                "id": question_id,
                "label": label,
                "type": question_type,
                "required": bool(raw.get("required", False)),
                "options": options,
            })
        return cleaned

    def _notify_students_new_opportunity(self, opportunity) -> None:
        if not opportunity or not opportunity.is_active or not self._notification_repo or not self._user_repo:
            return

        students = self._user_repo.get_students(skip=0, limit=100000)
        if not students:
            return

        excluded_student_ids = (
            self._application_repo.get_student_ids_by_opportunity(opportunity.id)
            if self._application_repo
            else set()
        )
        followed_notified_student_ids = self._notify_followed_company_matches(
            opportunity,
            excluded_student_ids,
        )

        matches = find_matching_students(
            students,
            opportunity,
            excluded_student_ids | followed_notified_student_ids,
        )
        if not matches:
            return

        company_name = opportunity.company.name if getattr(opportunity, "company", None) else "A company"
        title = "Recommended opportunities for you"
        created = 0
        updated = 0
        for match in matches:
            existing = self._notification_repo.get_latest_unread_by_user_and_title_today(
                match.student.id,
                title,
            )
            if existing:
                next_count = self._extract_opportunity_digest_count(existing.message) + 1
                self._notification_repo.update(existing, {
                    "message": self._build_opportunity_digest_message(
                        count=next_count,
                        opportunity_title=opportunity.title,
                        company_name=company_name,
                        reason=match.reason,
                    ),
                    "action_label": "View latest match",
                    "action_url": f"/lowongan/{opportunity.id}",
                })
                updated += 1
                continue

            self._notification_repo.create({
                "user_id": match.student.id,
                "title": title,
                "message": self._build_opportunity_digest_message(
                    count=1,
                    opportunity_title=opportunity.title,
                    company_name=company_name,
                    reason=match.reason,
                ),
                "type": "info",
                "action_label": "View latest match",
                "action_url": f"/lowongan/{opportunity.id}",
            })
            created += 1

        audit_log(
            "NOTIFICATION_CREATE",
            resource="opportunity",
            resource_id=opportunity.id,
            detail=f"Created {created} and updated {updated} fit opportunity digest notification(s) for opportunity {opportunity.id}",
            success=True,
        )

    def _notify_followed_company_matches(self, opportunity, excluded_student_ids: set[int]) -> set[int]:
        if not self._company_follow_repo or not self._notification_repo:
            return set()

        target_majors = {normalize_text(major) for major in getattr(opportunity, "target_majors", []) if normalize_text(major)}
        if not target_majors:
            return set()

        followers = self._company_follow_repo.get_active_student_followers_by_company(opportunity.company_id)
        if not followers:
            return set()

        company_name = opportunity.company.name if getattr(opportunity, "company", None) else "A company"
        notifications = []
        email_notifications = []
        notified_student_ids = set()
        for student in followers:
            if student.id in excluded_student_ids:
                continue
            if normalize_text(student.major) not in target_majors:
                continue

            title = f"New opportunity from {company_name}"
            message = f"{company_name} posted {opportunity.title}, and it matches your major."
            action_label = "View opportunity"
            action_url = f"/lowongan/{opportunity.id}"
            notifications.append({
                "user_id": student.id,
                "title": title,
                "message": message,
                "type": "info",
                "action_label": action_label,
                "action_url": action_url,
            })
            email_notifications.append((student, title, message, action_label, action_url))
            notified_student_ids.add(student.id)

        self._notification_repo.create_many(notifications)
        for student, title, message, action_label, action_url in email_notifications:
            if self._email_service:
                view_url = f"{get_settings().FRONTEND_URL.rstrip('/')}{action_url}"
                opportunity_type = (
                    opportunity.type.value
                    if hasattr(opportunity.type, "value")
                    else str(opportunity.type)
                )
                self._email_service.send_new_opportunity_email(
                    student.email,
                    student.full_name,
                    opportunity_title=opportunity.title,
                    company_name=company_name,
                    work_mode=None,
                    opportunity_type=opportunity_type,
                    view_url=view_url,
                )
        if notifications:
            audit_log(
                "NOTIFICATION_CREATE",
                resource="opportunity",
                resource_id=opportunity.id,
                detail=f"Notified {len(notifications)} followed-company student(s) for opportunity {opportunity.id}",
                success=True,
            )
        return notified_student_ids

    @staticmethod
    def _serialize_requirements(values) -> str | None:
        if values is None:
            return None
        return json.dumps(OpportunityService._clean_list(values))

    @staticmethod
    def _clean_list(values) -> list[str]:
        if not isinstance(values, list):
            return []

        seen = set()
        cleaned = []
        for value in values:
            display_value = str(value or "").strip()
            normalized = normalize_text(display_value)
            if normalized and normalized not in seen:
                seen.add(normalized)
                cleaned.append(display_value)
        return cleaned

    @staticmethod
    def _extract_opportunity_digest_count(message: str) -> int:
        match = re.match(r"(\d+)\s+new opportunit", message or "")
        return int(match.group(1)) if match else 1

    @staticmethod
    def _build_opportunity_digest_message(
        count: int,
        opportunity_title: str,
        company_name: str,
        reason: str,
    ) -> str:
        prefix = (
            f"1 new opportunity matches your profile. Latest: {opportunity_title} at {company_name}."
            if count <= 1
            else f"{count} new opportunities match your profile today. Latest: {opportunity_title} at {company_name}."
        )
        return f"{prefix} Matched {reason}." if reason else prefix
