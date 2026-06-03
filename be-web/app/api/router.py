from fastapi import APIRouter

from app.api.routes import auth, users, resumes, companies, opportunities, applications, bookmarks, company_follows, externships, notifications, organizations, admin, logbooks

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(resumes.router)
api_router.include_router(companies.router)
api_router.include_router(opportunities.router)
api_router.include_router(applications.router)
api_router.include_router(bookmarks.router)
api_router.include_router(company_follows.router)
api_router.include_router(externships.router)
api_router.include_router(notifications.router)
api_router.include_router(organizations.router)
api_router.include_router(admin.router)
api_router.include_router(logbooks.router, prefix="/logbooks")
api_router.include_router(logbooks.router, prefix="/logbook", include_in_schema=False)
