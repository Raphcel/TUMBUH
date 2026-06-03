from datetime import datetime, timedelta, timezone
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.domain.models  # noqa: F401
from app.api.dependencies import get_current_user, get_db
from app.config.database import Base
from app.domain.models.company import Company, CompanyStatus
from app.domain.models.organization import (
    OrganizationInvite,
    OrganizationInviteStatus,
    OrganizationMember,
    OrganizationMemberRole,
    OrganizationMemberStatus,
)
from app.domain.models.opportunity import Opportunity, OpportunityType
from app.domain.models.user import User, UserRole
from app.main import app as fastapi_app


OWNER_PERMISSIONS = [
    "manage_company_profile",
    "manage_members",
    "manage_invites",
    "create_opportunities",
    "manage_all_opportunities",
    "review_applicants",
]


class OrganizationWorkflowTests(unittest.TestCase):
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
            patch("app.services.organization_service.audit_log"),
            patch("app.services.company_service.audit_log"),
        ]
        for patcher in self.audit_patchers:
            patcher.start()
        self._seed_users()

    def tearDown(self):
        fastapi_app.dependency_overrides.clear()
        for patcher in self.audit_patchers:
            patcher.stop()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _seed_users(self):
        self.admin = User(
            id=1,
            email="admin@tumbuh.example",
            hashed_password="x",
            first_name="Platform",
            last_name="Admin",
            role=UserRole.ADMIN,
            is_active=True,
        )
        self.owner = User(
            id=2,
            email="owner@tddlabs.example",
            hashed_password="x",
            first_name="Owner",
            last_name="HR",
            role=UserRole.HR,
            is_active=True,
        )
        self.recruiter = User(
            id=3,
            email="recruiter@tddlabs.example",
            hashed_password="x",
            first_name="Recruiter",
            last_name="HR",
            role=UserRole.HR,
            is_active=True,
        )
        self.viewer = User(
            id=4,
            email="viewer@tddlabs.example",
            hashed_password="x",
            first_name="Viewer",
            last_name="HR",
            role=UserRole.HR,
            is_active=True,
        )
        self.db.add_all([self.admin, self.owner, self.recruiter, self.viewer])
        self.db.commit()

    def _client_for_user(self, user: User) -> TestClient:
        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        def override_get_current_user():
            return self.db.get(User, user.id)

        fastapi_app.dependency_overrides[get_db] = override_get_db
        fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
        return TestClient(fastapi_app)

    def _public_client(self) -> TestClient:
        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        fastapi_app.dependency_overrides[get_db] = override_get_db
        return TestClient(fastapi_app)

    def _seed_approved_company(self) -> Company:
        company = Company(
            id=1,
            name="TDD Labs",
            industry="Technology",
            location="Bogor",
            status=CompanyStatus.APPROVED,
        )
        owner_membership = OrganizationMember(
            company_id=1,
            user_id=self.owner.id,
            role=OrganizationMemberRole.OWNER,
            status=OrganizationMemberStatus.ACTIVE,
            permissions=OWNER_PERMISSIONS,
        )
        self.owner.company_id = 1
        self.db.add_all([company, owner_membership])
        self.db.commit()
        self.db.refresh(company)
        return company

    def test_hr_can_create_pending_company_and_admin_can_approve_membership(self):
        # Given: an HR account with no organization.
        owner_client = self._client_for_user(self.owner)

        # When: the HR submits a company request and an admin approves it.
        request_response = owner_client.post(
            "/api/v1/organizations/company-requests",
            json={"name": "TDD Labs", "industry": "Technology", "location": "Bogor"},
        )
        assert request_response.status_code == 201
        company_id = request_response.json()["company"]["id"]

        admin_client = self._client_for_user(self.admin)
        approve_response = admin_client.patch(f"/api/v1/admin/company-requests/{company_id}/approve")
        assert approve_response.status_code == 200

        owner_client = self._client_for_user(self.owner)
        org_response = owner_client.get("/api/v1/organizations/me")

        # Then: the company is approved and the requester has active owner permissions.
        assert org_response.status_code == 200
        org_data = org_response.json()
        assert org_data["company"]["status"] == "approved"
        assert org_data["membership"]["role"] == "owner"
        assert "manage_members" in org_data["membership"]["permissions"]

    def test_hr_can_join_company_with_invite_code_once(self):
        # Given: an approved owner membership and an invite for a recruiter.
        self._seed_approved_company()
        owner_client = self._client_for_user(self.owner)
        invite_response = owner_client.post(
            "/api/v1/organizations/invites",
            json={"role": "recruiter", "email": self.recruiter.email},
        )
        assert invite_response.status_code == 201
        token = invite_response.json()["token"]

        # When: the invite is accepted once, then malformed and reused codes are submitted.
        recruiter_client = self._client_for_user(self.recruiter)
        accept_response = recruiter_client.post("/api/v1/organizations/invites/accept", json={"token": token})
        malformed_response = recruiter_client.post("/api/v1/organizations/invites/accept", json={"token": "not-a-real-token"})
        reused_response = recruiter_client.post("/api/v1/organizations/invites/accept", json={"token": token})

        # Then: the first accept creates one active membership; bad/reused tokens do not.
        assert accept_response.status_code == 200
        assert accept_response.json()["membership"]["role"] == "recruiter"
        assert malformed_response.status_code in {400, 404}
        assert reused_response.status_code in {400, 404}

        active_memberships = (
            self.db.query(OrganizationMember)
            .filter(
                OrganizationMember.company_id == 1,
                OrganizationMember.user_id == self.recruiter.id,
                OrganizationMember.status == OrganizationMemberStatus.ACTIVE,
            )
            .all()
        )
        assert len(active_memberships) == 1

    def test_organization_permissions_replace_direct_company_id_checks(self):
        # Given: a viewer member in an approved organization.
        self._seed_approved_company()
        viewer_membership = OrganizationMember(
            company_id=1,
            user_id=self.viewer.id,
            role=OrganizationMemberRole.VIEWER,
            status=OrganizationMemberStatus.ACTIVE,
            permissions=[],
        )
        invite = OrganizationInvite(
            company_id=1,
            token_hash="unused",
            role=OrganizationMemberRole.VIEWER,
            status=OrganizationInviteStatus.ACCEPTED,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            created_by_user_id=self.owner.id,
            accepted_by_user_id=self.viewer.id,
        )
        self.db.add_all([viewer_membership, invite])
        self.db.commit()

        # When: the viewer attempts to edit the organization company profile.
        viewer_client = self._client_for_user(self.viewer)
        response = viewer_client.put("/api/v1/companies/1", json={"tagline": "Unauthorized edit"})

        # Then: permission-aware HR checks reject the request.
        assert response.status_code == 403

    def test_recruiter_can_manage_only_their_own_opportunity(self):
        # Given: an approved organization where a recruiter can create posts.
        self._seed_approved_company()
        recruiter_membership = OrganizationMember(
            company_id=1,
            user_id=self.recruiter.id,
            role=OrganizationMemberRole.RECRUITER,
            status=OrganizationMemberStatus.ACTIVE,
            permissions=["create_opportunities", "manage_own_opportunities", "review_applicants"],
        )
        owner_opportunity = Opportunity(
            id=1,
            title="Owner Internship",
            company_id=1,
            created_by_user_id=self.owner.id,
            type=OpportunityType.INTERNSHIP,
            location="Bogor",
            is_active=True,
        )
        self.db.add_all([recruiter_membership, owner_opportunity])
        self.db.commit()

        recruiter_client = self._client_for_user(self.recruiter)

        # When: the recruiter creates a post and edits both their post and the owner's post.
        create_response = recruiter_client.post(
            "/api/v1/opportunities/",
            json={
                "title": "Recruiter Internship",
                "type": "Internship",
                "location": "Bogor",
                "description": "Recruiter-owned post",
            },
        )
        recruiter_opportunity_id = create_response.json()["id"]
        own_update_response = recruiter_client.put(
            f"/api/v1/opportunities/{recruiter_opportunity_id}",
            json={"title": "Recruiter Internship Updated"},
        )
        owner_update_response = recruiter_client.put(
            "/api/v1/opportunities/1",
            json={"title": "Unauthorized Owner Edit"},
        )

        # Then: own posts are manageable, but company-wide edits are blocked.
        assert create_response.status_code == 201
        assert create_response.json()["company_id"] == 1
        assert create_response.json()["created_by_user_id"] == self.recruiter.id
        assert own_update_response.status_code == 200
        assert owner_update_response.status_code == 403

    def test_public_lists_ignore_pending_companies_and_keep_approved_visible(self):
        # Given: one approved company and one pending company, each with an opportunity.
        self._seed_approved_company()
        pending_company = Company(
            id=2,
            name="Pending Labs",
            industry="Technology",
            location="Jakarta",
            status=CompanyStatus.PENDING,
        )
        approved_opportunity = Opportunity(
            id=1,
            title="Approved Internship",
            company_id=1,
            type=OpportunityType.INTERNSHIP,
            location="Bogor",
            is_active=True,
        )
        pending_opportunity = Opportunity(
            id=2,
            title="Pending Internship",
            company_id=2,
            type=OpportunityType.INTERNSHIP,
            location="Jakarta",
            is_active=True,
        )
        self.db.add_all([pending_company, approved_opportunity, pending_opportunity])
        self.db.commit()

        # When: a public user lists companies and opportunities.
        client = self._public_client()
        companies_response = client.get("/api/v1/companies/")
        opportunities_response = client.get("/api/v1/opportunities/")

        # Then: only approved-company records are visible publicly.
        assert companies_response.status_code == 200
        assert opportunities_response.status_code == 200
        assert [item["name"] for item in companies_response.json()["items"]] == ["TDD Labs"]
        assert [item["title"] for item in opportunities_response.json()["items"]] == ["Approved Internship"]


if __name__ == "__main__":
    unittest.main()
