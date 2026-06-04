import json
import re
from datetime import datetime, timezone
from fastapi import HTTPException, status

from app.config.settings import get_settings
from app.domain.models.application import ApplicationStatus
from app.repositories.application_repository import ApplicationRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.opportunity_repository import OpportunityRepository
from app.repositories.user_repository import UserRepository
from app.schemas.application import (
    ApplicationCreate, ApplicationDraftSave, ApplicationSubmissionUpdate,
    ApplicationStatusUpdate,
    ApplicationResponse, ApplicationDraftResponse, ApplicationListResponse,
)
from app.services.audit_service import audit_log
from app.services.email_service import EmailService
from app.services.security_service import SIGNATURE_ALGORITHM, security_service


class ApplicationService:
    """Service handling application business logic."""

    def __init__(
        self,
        application_repo: ApplicationRepository,
        opportunity_repo: OpportunityRepository | None = None,
        notification_repo: NotificationRepository | None = None,
        user_repo: UserRepository | None = None,
        email_service: EmailService | None = None,
    ):
        self._application_repo = application_repo
        self._opportunity_repo = opportunity_repo
        self._notification_repo = notification_repo
        self._user_repo = user_repo
        self._email_service = email_service

    def verify_opportunity_ownership(self, opportunity_id: int, company_id: int | None) -> None:
        """Verify the opportunity belongs to the HR user's company."""
        if not self._opportunity_repo:
            raise HTTPException(status_code=500, detail="Internal configuration error")
        opp = self._opportunity_repo.get_by_id(opportunity_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
        if opp.company_id != company_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only manage applicants for your own company's opportunities")

    def get_company_id_for_opportunity(self, opportunity_id: int) -> int:
        if not self._opportunity_repo:
            raise HTTPException(status_code=500, detail="Internal configuration error")
        opp = self._opportunity_repo.get_by_id(opportunity_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
        return opp.company_id

    def get_company_id_for_application(self, application_id: int) -> int:
        application = self._application_repo.get_by_id(application_id)
        if not application:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
        return self.get_company_id_for_opportunity(application.opportunity_id)

    def get_company_id_for_applications(self, application_ids: list[int]) -> int:
        applications = self._application_repo.get_by_ids(application_ids)
        if len(applications) != len(application_ids):
            found_ids = {application.id for application in applications}
            missing = [application_id for application_id in application_ids if application_id not in found_ids]
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Applications not found: {missing}",
            )

        company_ids = {
            self.get_company_id_for_opportunity(application.opportunity_id)
            for application in applications
        }
        if len(company_ids) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bulk status updates must target one organization at a time",
            )
        return company_ids.pop()

    def apply(self, student_id: int, data: ApplicationCreate) -> ApplicationResponse:
        """Submit a new application (student action)."""
        opportunity = self._opportunity_repo.get_by_id_with_company(data.opportunity_id) if self._opportunity_repo else None
        if not opportunity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Opportunity not found",
            )

        existing = self._application_repo.get_by_student_and_opportunity(
            student_id, data.opportunity_id
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already applied to this opportunity",
            )

        question_answers = self._validate_question_answers(
            getattr(opportunity, "application_questions", []),
            data.question_answers,
            require_required=True,
        )

        now = datetime.now(timezone.utc).isoformat()
        initial_history = json.dumps([{"status": "Applied", "date": now}])

        app_dict = {
            "student_id": student_id,
            "opportunity_id": data.opportunity_id,
            "status": ApplicationStatus.APPLIED,
            "cover_letter": security_service.encrypt_text(data.cover_letter),
            "question_answers": question_answers,
            "history": initial_history,
        }
        application = self._application_repo.create(app_dict)
        self._application_repo.delete_draft(student_id, data.opportunity_id)
        self._sign_application_event(
            application,
            action="APPLICATION_SUBMIT",
            actor_id=student_id,
            timestamp=now,
        )
        self._notify_hr_new_application(student_id, opportunity, application.id)

        audit_log(
            "APPLICATION_SUBMIT",
            user_id=student_id,
            user_role="student",
            resource="application",
            resource_id=application.id,
            detail=f"Student {student_id} applied to opportunity {data.opportunity_id}",
            success=True,
        )

        return self._to_response(application)

    def get_student_draft(self, student_id: int, opportunity_id: int) -> ApplicationDraftResponse | None:
        """Return the student's draft for one opportunity, if it exists."""
        self._ensure_opportunity_exists(opportunity_id)
        draft = self._application_repo.get_draft(student_id, opportunity_id)
        return ApplicationDraftResponse.model_validate(draft) if draft else None

    def get_student_drafts(self, student_id: int) -> list[ApplicationDraftResponse]:
        """Return all in-progress drafts for a student."""
        drafts = self._application_repo.get_drafts_by_student(student_id)
        return [
            ApplicationDraftResponse.model_validate(draft)
            for draft in drafts
            if not self._application_repo.get_by_student_and_opportunity(student_id, draft.opportunity_id)
        ]

    def save_student_draft(
        self,
        student_id: int,
        opportunity_id: int,
        data: ApplicationDraftSave,
    ) -> ApplicationDraftResponse:
        """Save an in-progress application draft."""
        opportunity = self._ensure_opportunity_exists(opportunity_id)
        existing_application = self._application_repo.get_by_student_and_opportunity(
            student_id, opportunity_id
        )
        if existing_application:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already applied to this opportunity",
            )

        draft = self._application_repo.save_draft(
            student_id,
            opportunity_id,
            data.cover_letter,
            self._validate_question_answers(
                getattr(opportunity, "application_questions", []),
                data.question_answers,
                require_required=False,
            ),
        )
        return ApplicationDraftResponse.model_validate(draft)

    def delete_student_draft(self, student_id: int, opportunity_id: int) -> None:
        """Delete the student's draft for one opportunity."""
        self._application_repo.delete_draft(student_id, opportunity_id)

    def update_student_submission(
        self,
        student_id: int,
        application_id: int,
        data: ApplicationSubmissionUpdate,
    ) -> ApplicationResponse:
        """Allow students to edit their submitted application before the deadline."""
        application = self._application_repo.get_by_id(application_id)
        if not application or application.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )

        opportunity = self._ensure_opportunity_exists(application.opportunity_id)
        if opportunity.deadline:
            deadline = opportunity.deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > deadline:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The application deadline has passed",
                )

        if opportunity.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This opportunity is no longer accepting changes",
            )

        question_answers = self._validate_question_answers(
            getattr(opportunity, "application_questions", []),
            data.question_answers,
            require_required=True,
        )

        updated = self._application_repo.update(
            application,
            {
                "cover_letter": security_service.encrypt_text(data.cover_letter),
                "question_answers": question_answers,
            },
        )

        audit_log(
            "APPLICATION_UPDATE",
            user_id=student_id,
            user_role="student",
            resource="application",
            resource_id=application_id,
            detail=f"Student {student_id} updated application {application_id}",
            success=True,
        )

        return self._to_response(updated)

    def get_student_applications(
        self, student_id: int, skip: int = 0, limit: int = 100
    ) -> ApplicationListResponse:
        """List all applications for a student."""
        apps = self._application_repo.get_by_student(student_id, skip, limit)
        total = self._application_repo.count_by_student(student_id)
        return ApplicationListResponse(
            items=[self._to_response(a) for a in apps],
            total=total,
        )

    def get_opportunity_applications(
        self, opportunity_id: int, skip: int = 0, limit: int = 100
    ) -> ApplicationListResponse:
        """List all applications for an opportunity (HR view)."""
        apps = self._application_repo.get_by_opportunity(opportunity_id, skip, limit)
        total = self._application_repo.count_by_opportunity(opportunity_id)
        return ApplicationListResponse(
            items=[self._to_response(a) for a in apps],
            total=total,
        )

    def update_status(self, application_id: int, data: ApplicationStatusUpdate, company_id: int | None = None) -> ApplicationResponse:
        """Update application status and append to history (HR action)."""
        application = self._application_repo.get_by_id(application_id)
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )

        # Verify ownership if company_id provided
        if company_id is not None and self._opportunity_repo:
            opp = self._opportunity_repo.get_by_id(application.opportunity_id)
            if not opp or opp.company_id != company_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update applications for your own company's opportunities")

        # Parse existing history and append new status
        history = []
        if application.history:
            try:
                history = json.loads(application.history)
            except json.JSONDecodeError:
                history = []

        history.append({
            "status": data.status.value,
            "date": datetime.now(timezone.utc).isoformat(),
        })

        updated = self._application_repo.update(
            application,
            {"status": data.status, "history": json.dumps(history)},
        )
        self._sign_application_event(
            updated,
            action="APPLICATION_STATUS_UPDATE",
            actor_id=company_id,
            timestamp=history[-1]["date"],
        )
        self._notify_student_status_update(updated, data.status)

        audit_log(
            "APPLICATION_STATUS_UPDATE",
            user_id=company_id,
            user_role="hr",
            resource="application",
            resource_id=application_id,
            detail=f"Application {application_id} status changed to {data.status.value}",
            success=True,
        )

        return self._to_response(updated)

    def bulk_update_status(
        self,
        application_ids: list[int],
        new_status: ApplicationStatus,
        company_id: int | None = None,
    ) -> list[ApplicationResponse]:
        """Bulk update status for multiple applications (HR action)."""
        applications = self._application_repo.get_by_ids(application_ids)

        if len(applications) != len(application_ids):
            found_ids = {a.id for a in applications}
            missing = [aid for aid in application_ids if aid not in found_ids]
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Applications not found: {missing}",
            )

        if company_id is not None and self._opportunity_repo:
            for app in applications:
                opp = self._opportunity_repo.get_by_id(app.opportunity_id)
                if not opp or opp.company_id != company_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Application {app.id} does not belong to your company",
                    )

        now = datetime.now(timezone.utc).isoformat()
        results = []
        for app in applications:
            history = []
            if app.history:
                try:
                    history = json.loads(app.history)
                except json.JSONDecodeError:
                    history = []
            history.append({"status": new_status.value, "date": now})

            updated = self._application_repo.update(
                app, {"status": new_status, "history": json.dumps(history)}
            )
            self._sign_application_event(
                updated,
                action="APPLICATION_BULK_STATUS_UPDATE",
                actor_id=company_id,
                timestamp=now,
            )
            self._notify_student_status_update(updated, new_status)
            results.append(self._to_response(updated))

        audit_log(
            "APPLICATION_BULK_STATUS_UPDATE",
            user_id=company_id,
            user_role="hr",
            resource="application",
            detail=f"Bulk status update to {new_status.value} for {len(application_ids)} applications: {application_ids}",
            success=True,
        )

        return results

    # ── Helper ───────────────────────────────────────────────

    def _ensure_opportunity_exists(self, opportunity_id: int):
        opportunity = self._opportunity_repo.get_by_id(opportunity_id) if self._opportunity_repo else None
        if not opportunity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Opportunity not found",
            )
        return opportunity

    @staticmethod
    def _validate_question_answers(
        questions: list[dict],
        answers: dict[str, str] | None,
        require_required: bool,
    ) -> dict[str, str]:
        cleaned_answers = {
            str(key): str(value).strip()
            for key, value in (answers or {}).items()
            if value is not None and str(value).strip()
        }
        question_ids = {str(question.get("id")) for question in questions or [] if question.get("id")}
        cleaned_answers = {
            key: value
            for key, value in cleaned_answers.items()
            if key in question_ids
        }
        if require_required:
            missing = [
                str(question.get("label") or "Required question")
                for question in questions or []
                if question.get("required") and not cleaned_answers.get(str(question.get("id")))
            ]
            if missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Please answer required questions: {', '.join(missing)}",
                )
        return cleaned_answers

    @staticmethod
    def _to_response(app) -> ApplicationResponse:
        """Convert ORM model to response — history JSON is parsed by the schema validator."""
        encrypted_cover_letter = app.cover_letter
        app.cover_letter = security_service.decrypt_text(encrypted_cover_letter)
        response = ApplicationResponse.model_validate(app)
        app.cover_letter = encrypted_cover_letter
        return response

    def _sign_application_event(
        self,
        application,
        *,
        action: str,
        actor_id: int | None,
        timestamp: str,
    ) -> None:
        payload = security_service.build_application_signature_payload(
            action=action,
            actor_id=actor_id,
            student_id=application.student_id,
            opportunity_id=application.opportunity_id,
            status=application.status.value,
            timestamp=timestamp,
        )
        signature = security_service.sign_payload(payload)
        self._application_repo.update(
            application,
            {
                "signature_payload": json.dumps(payload, sort_keys=True),
                "digital_signature": signature,
                "signature_algorithm": SIGNATURE_ALGORITHM,
            },
        )

    def _notify_hr_new_application(self, student_id: int, opportunity, application_id: int) -> None:
        if not self._notification_repo or not self._user_repo:
            return

        hr_users = self._user_repo.get_hr_by_company(opportunity.company_id)
        if not hr_users:
            return

        student = self._user_repo.get_by_id(student_id)
        student_name = student.full_name if student else f"Student {student_id}"
        company_name = opportunity.company.name if getattr(opportunity, "company", None) else "your company"
        title = f"New applicants for {opportunity.title}"
        action_label = "Review applicants"
        action_url = "/hr/opportunities"
        review_url = f"{get_settings().FRONTEND_URL.rstrip('/')}{action_url}"

        created = 0
        updated = 0
        for hr in hr_users:
            message = self._build_hr_notification_message(
                count=1,
                opportunity_title=opportunity.title,
                company_name=company_name,
                latest_applicant_name=student_name,
            )
            existing = self._notification_repo.get_latest_unread_by_user_and_title_today(
                hr.id,
                title,
            )
            if existing:
                next_count = self._extract_notification_count(existing.message) + 1
                message = self._build_hr_notification_message(
                    count=next_count,
                    opportunity_title=opportunity.title,
                    company_name=company_name,
                    latest_applicant_name=student_name,
                )
                self._notification_repo.update(existing, {
                    "message": message,
                    "action_label": action_label,
                    "action_url": action_url,
                })
                updated += 1
                if self._email_service:
                    self._email_service.send_new_applicant_email(
                        hr.email,
                        hr.full_name,
                        opportunity_title=opportunity.title,
                        company_name=company_name,
                        applicant_name=student_name,
                        review_url=review_url,
                    )
                continue

            self._notification_repo.create({
                "user_id": hr.id,
                "title": title,
                "message": message,
                "type": "info",
                "action_label": action_label,
                "action_url": action_url,
            })
            created += 1
            if self._email_service:
                self._email_service.send_new_applicant_email(
                    hr.email,
                    hr.full_name,
                    opportunity_title=opportunity.title,
                    company_name=company_name,
                    applicant_name=student_name,
                    review_url=review_url,
                )

        audit_log(
            "NOTIFICATION_CREATE",
            resource="notification",
            resource_id=application_id,
            detail=f"Created {created} and updated {updated} HR notification(s) for application {application_id}",
            success=True,
        )

    def _notify_student_status_update(self, application, new_status: ApplicationStatus) -> None:
        if not self._notification_repo:
            return

        opportunity = getattr(application, "opportunity", None)
        if not opportunity and self._opportunity_repo:
            opportunity = self._opportunity_repo.get_by_id_with_company(application.opportunity_id)

        title = opportunity.title if opportunity else f"Opportunity {application.opportunity_id}"
        company_name = (
            opportunity.company.name
            if opportunity and getattr(opportunity, "company", None)
            else "the company"
        )
        notification_type = "success" if new_status == ApplicationStatus.ACCEPTED else "info"
        message = f"Your application for {title} at {company_name} is now {new_status.value}."
        action_label = "View applications"
        action_url = "/student/applications"

        notification = self._notification_repo.create({
            "user_id": application.student_id,
            "title": "Application status updated",
            "message": message,
            "type": notification_type,
            "action_label": action_label,
            "action_url": action_url,
        })
        if self._user_repo and self._email_service:
            student = self._user_repo.get_by_id(application.student_id)
            if student:
                view_url = f"{get_settings().FRONTEND_URL.rstrip('/')}{action_url}"
                self._email_service.send_application_status_email(
                    student.email,
                    student.full_name,
                    opportunity_title=title,
                    company_name=company_name,
                    new_status=new_status.value,
                    view_url=view_url,
                )

        audit_log(
            "NOTIFICATION_CREATE",
            resource="notification",
            resource_id=notification.id,
            detail=f"Notified student {application.student_id} about application {application.id} status {new_status.value}",
            success=True,
        )

    @staticmethod
    def _extract_notification_count(message: str) -> int:
        match = re.match(r"(\d+)\s+new application", message or "")
        return int(match.group(1)) if match else 1

    @staticmethod
    def _build_hr_notification_message(
        count: int,
        opportunity_title: str,
        company_name: str,
        latest_applicant_name: str,
    ) -> str:
        if count <= 1:
            return f"1 new application for {opportunity_title} at {company_name}. Latest applicant: {latest_applicant_name}."
        return f"{count} new applications for {opportunity_title} at {company_name}. Latest applicant: {latest_applicant_name}."
