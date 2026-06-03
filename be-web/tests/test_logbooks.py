import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies import get_current_user, get_db
from app.config.database import Base
from app.domain.models.application import Application, ApplicationStatus
from app.domain.models.company import Company
from app.domain.models.opportunity import Opportunity, OpportunityType
from app.domain.models.user import User, UserRole
from app.main import app as fastapi_app
import app.domain.models  # noqa: F401
from app.repositories.user_repository import UserRepository


class LogbookApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db = self.SessionLocal()
        self.tempdir = tempfile.TemporaryDirectory()
        self.logbook_dir = Path(self.tempdir.name) / "logbook_evidence"

        self.audit_patcher = patch("app.services.logbook_service.audit_log")
        self.audit_patcher.start()
        self.route_dir_patcher = patch("app.api.routes.logbooks.LOGBOOK_EVIDENCE_DIR", self.logbook_dir)
        self.asset_dir_patcher = patch("app.services.user_asset_service.LOGBOOK_EVIDENCE_DIR", self.logbook_dir)
        self.route_dir_patcher.start()
        self.asset_dir_patcher.start()

        self._seed_data()
        self.user_repo = UserRepository(self.db)

    def tearDown(self):
        fastapi_app.dependency_overrides.clear()
        self.asset_dir_patcher.stop()
        self.route_dir_patcher.stop()
        self.audit_patcher.stop()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()
        self.tempdir.cleanup()

    def _seed_data(self):
        company = Company(id=1, name="Tumbuh Labs", industry="Technology", location="Bogor")
        opportunity = Opportunity(
            id=1,
            title="Backend Intern",
            company_id=1,
            type=OpportunityType.INTERNSHIP,
            location="Bogor",
            is_active=True,
        )
        rejected_opportunity = Opportunity(
            id=2,
            title="Rejected Intern",
            company_id=1,
            type=OpportunityType.INTERNSHIP,
            location="Bogor",
            is_active=True,
        )
        student = User(
            id=1,
            email="student@apps.ipb.ac.id",
            hashed_password="x",
            first_name="Student",
            last_name="One",
            role=UserRole.STUDENT,
            is_active=True,
        )
        other_student = User(
            id=2,
            email="other@apps.ipb.ac.id",
            hashed_password="x",
            first_name="Student",
            last_name="Two",
            role=UserRole.STUDENT,
            is_active=True,
        )
        hr = User(
            id=3,
            email="hr@tumbuh.test",
            hashed_password="x",
            first_name="HR",
            last_name="One",
            role=UserRole.HR,
            company_id=1,
            is_active=True,
        )
        accepted = Application(
            id=1,
            student_id=1,
            opportunity_id=1,
            status=ApplicationStatus.ACCEPTED,
        )
        rejected = Application(
            id=2,
            student_id=1,
            opportunity_id=2,
            status=ApplicationStatus.REJECTED,
        )
        self.db.add_all([company, opportunity, rejected_opportunity, student, other_student, hr, accepted, rejected])
        self.db.commit()

    def _client_for_user(self, user_id: int):
        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        def override_get_current_user():
            return self.user_repo.get_by_id(user_id)

        fastapi_app.dependency_overrides[get_db] = override_get_db
        fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
        return TestClient(fastapi_app)

    def test_logbook_endpoints_are_student_only(self):
        client = self._client_for_user(3)
        response = client.get("/api/v1/logbooks/")

        self.assertEqual(response.status_code, 403)

    def test_legacy_singular_logbook_list_route_is_supported(self):
        client = self._client_for_user(1)
        response = client.get("/api/v1/logbook/?skip=0&limit=100")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"items": [], "total": 0})

    def test_manual_logbook_create_entry_validation_and_pdf_export(self):
        client = self._client_for_user(1)
        created = client.post(
            "/api/v1/logbooks/",
            json={
                "title": "Manual Internship",
                "role": "Engineer",
                "company": "External Co",
                "semester": "2025/2026 Semester Genap",
                "target_hours": 400,
            },
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["semester"], "2025/2026 Semester Genap")
        logbook_id = created.json()["id"]

        invalid_category = client.post(
            f"/api/v1/logbooks/{logbook_id}/entries",
            json={
                "activity_date": date.today().isoformat(),
                "title": "Bad category",
                "category": "Custom",
                "hours": 2,
            },
        )
        self.assertEqual(invalid_category.status_code, 422)

        future_entry = client.post(
            f"/api/v1/logbooks/{logbook_id}/entries",
            json={
                "activity_date": (date.today() + timedelta(days=1)).isoformat(),
                "title": "Future work",
                "category": "Development",
                "hours": 2,
            },
        )
        self.assertEqual(future_entry.status_code, 400)

        invalid_time = client.post(
            f"/api/v1/logbooks/{logbook_id}/entries",
            json={
                "activity_date": date.today().isoformat(),
                "title": "Invalid time",
                "category": "Development",
                "hours": 2,
                "start_time": "16:00",
                "end_time": "15:00",
            },
        )
        self.assertEqual(invalid_time.status_code, 422)

        entry = client.post(
            f"/api/v1/logbooks/{logbook_id}/entries",
            json={
                "activity_date": date.today().isoformat(),
                "title": "Implemented API",
                "category": "Development",
                "hours": 3.5,
                "start_time": "09:00",
                "end_time": "12:30",
                "location": "Engineering Room",
                "description": "Built logbook endpoints.",
            },
        )
        self.assertEqual(entry.status_code, 201)
        self.assertEqual(entry.json()["hours"], 3.5)
        self.assertEqual(entry.json()["start_time"], "09:00:00")
        self.assertEqual(entry.json()["end_time"], "12:30:00")
        self.assertEqual(entry.json()["location"], "Engineering Room")

        empty_title_update = client.put(f"/api/v1/logbooks/{logbook_id}", json={"title": ""})
        self.assertEqual(empty_title_update.status_code, 422)

        empty_entry_title_update = client.put(f"/api/v1/logbooks/entries/{entry.json()['id']}", json={"title": ""})
        self.assertEqual(empty_entry_title_update.status_code, 422)

        pdf = client.get(f"/api/v1/logbooks/{logbook_id}/export/pdf")
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf.headers["content-type"], "application/pdf")
        self.assertTrue(pdf.content.startswith(b"%PDF"))

    def test_accepted_application_autofills_and_rejects_duplicates(self):
        client = self._client_for_user(1)
        created = client.post("/api/v1/logbooks/", json={"application_id": 1})

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["title"], "Backend Intern")
        self.assertEqual(created.json()["company"], "Tumbuh Labs")

        duplicate = client.post("/api/v1/logbooks/", json={"application_id": 1})
        self.assertEqual(duplicate.status_code, 400)

        rejected = client.post("/api/v1/logbooks/", json={"application_id": 2})
        self.assertEqual(rejected.status_code, 400)

    def test_other_student_cannot_read_logbook(self):
        owner_client = self._client_for_user(1)
        created = owner_client.post(
            "/api/v1/logbooks/",
            json={"title": "Private Internship", "role": "Engineer", "company": "Private Co"},
        )
        logbook_id = created.json()["id"]

        other_client = self._client_for_user(2)
        response = other_client.get(f"/api/v1/logbooks/{logbook_id}")

        self.assertEqual(response.status_code, 403)

    def test_attachment_upload_validation_and_download(self):
        client = self._client_for_user(1)
        logbook = client.post(
            "/api/v1/logbooks/",
            json={"title": "Evidence Internship", "role": "Engineer", "company": "Evidence Co"},
        ).json()
        entry = client.post(
            f"/api/v1/logbooks/{logbook['id']}/entries",
            json={
                "activity_date": date.today().isoformat(),
                "title": "Collected evidence",
                "category": "Documentation",
                "hours": 1,
            },
        ).json()

        invalid = client.post(
            f"/api/v1/logbooks/entries/{entry['id']}/attachments",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
        self.assertEqual(invalid.status_code, 400)

        uploaded = client.post(
            f"/api/v1/logbooks/entries/{entry['id']}/attachments",
            files={"file": ("evidence.pdf", b"%PDF-1.4\n%test\n", "application/pdf")},
        )
        self.assertEqual(uploaded.status_code, 201)

        downloaded = client.get(f"/api/v1/logbooks/attachments/{uploaded.json()['id']}/download")
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(downloaded.headers["content-type"], "application/pdf")
        self.assertEqual(downloaded.content, b"%PDF-1.4\n%test\n")


if __name__ == "__main__":
    unittest.main()
