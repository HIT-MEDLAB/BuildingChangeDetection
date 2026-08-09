# Municipal Illegal Construction Detection System

An AI-powered web application for detecting structural changes in buildings by comparing inspection images over time. Inspectors upload two images of the same building (taken at different times), and a machine-learning model highlights areas where changes have occurred — cracks, structural shifts, new additions, or deterioration.

## Architecture

```mermaid
graph LR
    A[Inspector's Browser] -->|HTTPS| B[React Frontend<br/>Vite · Port 5173]
    B -->|REST API| C[Node.js / Express<br/>Backend · Port 3000]
    C -->|SQL| D[(PostgreSQL<br/>Port 5432)]
    C -->|HTTP| E[ML Service<br/>FastAPI · Port 8000]
    E -->|Inference| F[Tiny-CD Model]
```

**Data flow:** The inspector logs in, uploads two images via the React frontend. The backend stores metadata in PostgreSQL and forwards the images to the ML service, which runs change-detection inference and returns bounding boxes of detected changes. The backend saves the results and the frontend renders them visually.

## Tech Stack

| Layer       | Technology           | Purpose                              |
|-------------|----------------------|--------------------------------------|
| Frontend    | React 18, Vite, JS   | Single-page application UI           |
| Backend     | Node.js, Express     | REST API, authentication, file mgmt  |
| Database    | PostgreSQL 16        | Inspection data, user accounts        |
| ML Service  | Python, FastAPI      | Change-detection inference (Tiny-CD) |
| Dev Tools   | Docker Compose       | Local database provisioning           |

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- PostgreSQL 16 (local install, Docker, or a free cloud service like [Neon](https://neon.tech) / [Supabase](https://supabase.com))

### 1. Start the database

The backend requires a working database connection to do anything useful (including login — there
is no self-registration, so without a seeded user you can't sign in at all). Set this up first.

If you have Docker installed, spin up PostgreSQL + Adminer with one command:

```bash
cp .env.example .env        # Edit with your preferred credentials
docker compose up -d         # Starts PostgreSQL + Adminer, applies all migrations in database/
```

Adminer (DB browser) will be available at `http://localhost:8080`.

If you prefer to install PostgreSQL directly or use a cloud instance, create a database manually
and run all three migration files against it, in order: `database/001_initial_schema.sql`,
`database/002_add_roles_and_status.sql`, `database/003_add_processed_image.sql`.

### 2. Start the backend

```bash
cd backend
cp .env.example .env         # Edit if needed — must point at the database from step 1
npm install
node seed.js                 # Creates default login users (no self-registration endpoint exists):
                              #   inspector — yair@medlab.hit.ac.il / password123
                              #   admin     — admin@medlab.hit.ac.il / admin123
npm run dev                  # Runs on http://localhost:3000
```

> Without a reachable database, the backend still starts, but any DB-dependent request (e.g.
> `POST /api/auth/login`) fails with a `500 Internal Server Error`, not a special status code.

### 3. Start the frontend

```bash
cd frontend
cp .env.example .env         # Edit if needed
npm install
npm run dev                  # Runs on http://localhost:5173
```

### 4. Start the ML service

```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate
pip install -r requirements.txt   # Note: installs torch/torchvision (large download); the
                                   # current app.py is a mock and doesn't import them yet
uvicorn app:app --reload --port 8000
```

## Project Structure

```
BuildingChangeDetection/
├── frontend/           # React SPA (Vite)
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Route-level page components
│   │   └── styles/     # CSS files
│   └── ...
├── backend/            # Express REST API
│   ├── src/
│   │   ├── routes/     # Route handlers grouped by domain
│   │   ├── middleware/  # Auth, error handling, etc.
│   │   └── config/     # DB pool, environment config
│   ├── seed.js         # Creates default inspector/admin login users
│   └── ...
├── ml-service/         # FastAPI ML inference service
├── database/           # SQL migrations (001-003, applied via docker-compose)
├── docs/               # Architecture docs, API spec
└── docker-compose.yml  # Local development infrastructure
```

## Team

| Role               | Name                       |
|--------------------|----------------------------|
| Supervisor         | Dr. Kiril Vasilchenko      |
| Frontend Developer | Neta Goolzad               |
| Backend / ML       | Yair Katsav                |

## Academic Context

This project is a **Capstone Project (2025–2026)** at the **Holon Institute of Technology (HIT)**, Department of Information Systems.

### Key Documents

- [Initiation Document](#) — *link TBD*
- [Product Requirements Document (PRD)](#) — *link TBD*

> Students: the PRD is your source of truth for feature requirements. When in doubt about what to build, consult the PRD first, then ask the supervisor.
