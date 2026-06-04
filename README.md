<p align="center">
  <img src="tumbuh.svg" alt="tumbuh." width="96" />
</p>

<h1 align="center">TUMBUH</h1>

<p align="center">
  Career and internship platform for IPB students, company HR teams, and platform administrators.
</p>

<p align="center">
  <a href="fe-web/package.json"><img alt="React" src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=111827" /></a>
  <a href="fe-web/package.json"><img alt="Vite" src="https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white" /></a>
  <a href="be-web/requirements.txt"><img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" /></a>
  <a href="be-web/requirements.txt"><img alt="Python" src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" /></a>
  <a href="be-web/requirements.txt"><img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Alembic%20managed-4169E1?logo=postgresql&logoColor=white" /></a>
  <a href="docker-compose.dokploy.yml"><img alt="Docker" src="https://img.shields.io/badge/Docker-Dokploy%20ready-2496ED?logo=docker&logoColor=white" /></a>
</p>

---

TUMBUH combines opportunity discovery, application workflows, organization management, student career tools, audit logging, and account security into a full-stack web application.

The project is organized as a compact service stack: a React frontend, a FastAPI backend, PostgreSQL managed through SQLAlchemy and Alembic, and an optional audit-log service.

## At A Glance

| Area | Summary |
|---|---|
| Product | Career and internship tracker for IPB students and employer partners |
| Users | Students, HR users, organization members, and platform administrators |
| Frontend | React 19, Vite 7, React Router, Tailwind CSS, Framer Motion, lucide-react |
| Backend | FastAPI, SQLAlchemy, Alembic, Pydantic, JWT auth, SlowAPI rate limiting |
| Data | PostgreSQL locally, with Supabase supported as managed PostgreSQL |
| Operations | Dockerized services with Dokploy compose support |

## Repository Structure

| Path | Service | Purpose |
|---|---|---|
| `fe-web/` | React + Vite frontend | Public pages, student dashboard, HR workspace, admin screens, and client-side API integration |
| `be-web/` | FastAPI backend | Authentication, authorization, business logic, REST API, migrations, seed data, and database access |
| `audit-log/` | Express + Winston service | Append-only audit event collection and dashboard support |
| `docs/` | Project documentation | Setup, backend, frontend, database, deployment, testing, and audit logging references |
| `docker-compose.dokploy.yml` | Production compose file | Full-stack container deployment for Dokploy |
| `docker-compose.yml` | Local database compose file | Local PostgreSQL for development |
| `docker-compose.local.yml` | Local full-stack override | Local port mappings for frontend, backend, and audit-log containers |

## Technology Stack

| Layer | Tools |
|---|---|
| Client | React, Vite, React Router, Tailwind CSS, Framer Motion, lucide-react |
| API | FastAPI, Uvicorn, Pydantic, python-jose, bcrypt, SlowAPI |
| Database | PostgreSQL, SQLAlchemy, Alembic, psycopg2 |
| Email and Auth Integrations | Resend, Google Auth |
| Audit Logging | Express, Winston, Winston Daily Rotate File |
| Deployment | Docker, Docker Compose, Dokploy, nginx frontend proxy |

## Core Capabilities

- Student accounts, email verification, Google sign-in, password reset, and account security controls.
- Internship and entry-level opportunity browsing, filtering, bookmarking, and applications.
- Student profile, CV, resume, externship, logbook, and application management.
- HR organization onboarding, member invitations, company profile management, opportunity posting, and applicant review.
- Admin user, company, opportunity, and audit views.
- Backend audit event forwarding to the `audit-log/` service.
- Alembic-managed PostgreSQL schema with migrations and seed data.

## Architecture

The FastAPI backend is the system of record. The frontend talks to the backend over HTTP, and the backend owns all database access.

```text
React/Vite frontend
        |
        v
FastAPI backend  --->  Audit-log service
        |
        v
SQLAlchemy + Alembic
        |
        v
PostgreSQL
```

Supabase may be used as managed PostgreSQL, but the application does not use Supabase client-side database access. Frontend code must never contain database credentials or direct database connection details.

## Prerequisites

- Node.js and npm.
- Python 3.11+.
- Docker, if using local PostgreSQL or containerized local development.
- PostgreSQL client tools are optional but useful for inspection.

## Local Development

Start PostgreSQL from the repository root:

```bash
docker compose up -d postgres
```

Configure and run the backend:

```bash
cd be-web
cp .env.example .env
pip install -r requirements.txt
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run the frontend:

```bash
cd fe-web
npm install
npm run dev
```

Optional audit-log service:

```bash
cd audit-log
npm install
npm start
```

Default local URLs:

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend API | `http://127.0.0.1:8000` |
| Backend Swagger UI | `http://127.0.0.1:8000/docs` |
| Audit log | `http://localhost:3001` |
| PostgreSQL | `localhost:5433` |

## Environment Configuration

Copy the example environment files and fill in local or deployment-specific values:

```bash
cp be-web/.env.example be-web/.env
cp fe-web/.env.example fe-web/.env
```

Important backend variables include:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string used by SQLAlchemy and Alembic |
| `SECRET_KEY` | JWT signing secret |
| `CORS_ORIGINS` | Allowed browser origins |
| `FRONTEND_URL` | Base URL used in email links |
| `EMAIL_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email configuration |
| `GOOGLE_CLIENT_ID` | Backend Google authentication client ID |
| `AUDIT_LOG_URL` | Audit event endpoint |

Important frontend variables include:

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API base URL, usually `/api/v1` in production behind nginx |
| `VITE_GOOGLE_CLIENT_ID` | Browser Google sign-in client ID |

Never commit real secrets, database passwords, API keys, or private signing keys.

## Testing And Verification

Backend tests:

```bash
PYTHONPATH=be-web python -m pytest -q be-web/tests
```

Frontend production build:

```bash
cd fe-web
npm run build
```

Frontend linting:

```bash
cd fe-web
npm run lint
```

Migration checks:

```bash
cd be-web
alembic heads
alembic current
```

Manual QA scenarios and expected checks are documented in [`docs/testing.md`](docs/testing.md).

## Deployment

The repository includes Dockerfiles for all runtime services and a Dokploy-ready compose file:

```text
docker-compose.dokploy.yml
```

In the Dokploy deployment, the frontend nginx container proxies `/api/` to the backend container, so production frontend builds can use:

```env
VITE_API_URL=/api/v1
```

Before production deployment, configure all required values from `.env.dokploy.example`, especially:

- `POSTGRES_PASSWORD`
- `SECRET_KEY`
- `CORS_ORIGINS`
- `FRONTEND_URL`
- Email and Google OAuth variables, if enabled

Deployment details, Supabase guidance, and team workflow notes are in [`docs/deployment.md`](docs/deployment.md).

## Documentation

Start with [`docs/README.md`](docs/README.md). Key references:

- [`docs/setup.md`](docs/setup.md): local development setup.
- [`docs/backend.md`](docs/backend.md): backend structure, conventions, and API responsibilities.
- [`docs/frontend.md`](docs/frontend.md): frontend routing, API integration, and UI conventions.
- [`docs/database.md`](docs/database.md): schema, migrations, seed data, and inspection commands.
- [`docs/deployment.md`](docs/deployment.md): deployment and Supabase-as-PostgreSQL guidance.
- [`docs/testing.md`](docs/testing.md): test and manual QA matrix.

## Development Principles

- Keep FastAPI as the only application boundary for data access.
- Keep Alembic as the source of truth for schema changes.
- Keep frontend code free of database credentials and backend secrets.
- Add migrations and tests for backend behavior changes.
- Verify user-facing flows through the browser or API surface before shipping.
