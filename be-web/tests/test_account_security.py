import re
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.domain.models  # noqa: F401
from app.config.database import Base
from app.domain.models.application import ApplicationDraft
from app.domain.models.notification import Notification
from app.domain.models.user import User, UserRole
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.user_service import UserService


class FakeEmailService:
    is_configured = True

    def __init__(self):
        self.sent = []

    def send_email(self, to_email, subject, *, html_body, text_body, to_name=None):
        self.sent.append({
            "to_email": to_email,
            "subject": subject,
            "html_body": html_body,
            "text_body": text_body,
            "to_name": to_name,
        })
        return True

    def send_password_reset_email(self, to_email, to_name, *, reset_url, expires_hours):
        self.sent.append({
            "to_email": to_email,
            "to_name": to_name,
            "reset_url": reset_url,
            "expires_hours": expires_hours,
        })
        return True


class AccountSecurityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db = self.SessionLocal()
        self.audit_patchers = [
            patch("app.services.auth_service.audit_log"),
            patch("app.services.user_service.audit_log"),
        ]
        for patcher in self.audit_patchers:
            patcher.start()

        self.user = User(
            email="student@apps.ipb.ac.id",
            hashed_password=AuthService.hash_password("password123"),
            first_name="Student",
            last_name="User",
            role=UserRole.STUDENT,
            is_active=True,
            is_email_verified=True,
            auth_provider="password",
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)
        self.user_repo = UserRepository(self.db)

    def tearDown(self):
        for patcher in self.audit_patchers:
            patcher.stop()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_password_reset_email_allows_password_change(self):
        email_service = FakeEmailService()
        auth_service = AuthService(self.user_repo, email_service=email_service)

        response = auth_service.request_password_reset(self.user.email)

        self.assertIn("password reset link", response["message"])
        self.assertEqual(len(email_service.sent), 1)
        token_match = re.search(r"token=([^\s]+)", email_service.sent[0]["reset_url"])
        self.assertIsNotNone(token_match)

        auth_service.confirm_password_reset(token_match.group(1), "newpassword123")

        updated = self.user_repo.get_by_id(self.user.id)
        self.assertTrue(AuthService.verify_password("newpassword123", updated.hashed_password))
        self.assertIsNone(updated.password_reset_token_hash)
        self.assertIsNone(updated.password_reset_sent_at)

    def test_deactivate_account_blocks_future_login(self):
        user_service = UserService(self.user_repo)

        response = user_service.deactivate_account(self.user.id)

        self.assertTrue(response["deactivated"])
        self.assertFalse(self.user_repo.get_by_id(self.user.id).is_active)
        with self.assertRaises(HTTPException) as ctx:
            AuthService(self.user_repo).login(self.user.email, "password123")
        self.assertEqual(ctx.exception.status_code, 403)

    def test_delete_account_requires_matching_email_and_removes_owned_rows(self):
        self.db.add_all([
            Notification(
                user_id=self.user.id,
                title="Notice",
                message="Message",
                type="info",
            ),
            ApplicationDraft(
                student_id=self.user.id,
                opportunity_id=99,
            ),
        ])
        self.db.commit()
        user_service = UserService(self.user_repo)

        with self.assertRaises(HTTPException) as ctx:
            user_service.delete_account(self.user.id, "wrong@apps.ipb.ac.id")
        self.assertEqual(ctx.exception.status_code, 400)

        response = user_service.delete_account(self.user.id, self.user.email)

        self.assertTrue(response["deleted"])
        self.assertIsNone(self.user_repo.get_by_id(self.user.id))
        self.assertEqual(self.db.query(Notification).filter_by(user_id=self.user.id).count(), 0)
        self.assertEqual(self.db.query(ApplicationDraft).filter_by(student_id=self.user.id).count(), 0)
