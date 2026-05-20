# System Architecture

## Overview

The system follows a standard three-tier web architecture with a separate ML inference service. Each component runs as an independent process, communicating over HTTP/REST.

```mermaid
graph TD
    subgraph "Client"
        A[Inspector's Browser]
    end

    subgraph "Frontend · Port 5173"
        B[React SPA<br/>Vite Dev Server]
    end

    subgraph "Backend · Port 3000"
        C[Express API Server]
        C1[Auth Routes]
        C2[Inspection Routes]
        C3[Error Middleware]
    end

    subgraph "Data Layer"
        D[(PostgreSQL · Port 5432)]
    end

    subgraph "ML Service · Port 8000"
        E[FastAPI Server]
        F[Tiny-CD Model]
    end

    A -->|HTTPS| B
    B -->|REST API calls| C
    C --- C1
    C --- C2
    C --- C3
    C -->|SQL queries via pg pool| D
    C -->|POST /predict<br/>multipart images| E
    E --> F
```

## Component Details

### Frontend (React + Vite)

- **Role:** User interface for inspectors
- **Key pages:** Login, Upload, Processing, Results, History, Help
- **Communication:** Calls the backend API via Axios; never talks to the DB or ML service directly
- **Runs on:** `http://localhost:5173` (Vite dev server)

### Backend (Node.js + Express)

- **Role:** Business logic, authentication, file management, orchestration
- **Responsibilities:**
  - Authenticate users (JWT)
  - Accept image uploads and store metadata
  - Forward image pairs to the ML service for inference
  - Save and retrieve inspection results
- **Runs on:** `http://localhost:3000`

### Database (PostgreSQL 16)

- **Role:** Persistent storage for users, inspections, and results
- **Managed via:** Docker Compose (development), managed service in production
- **Schema:** See `database/001_initial_schema.sql`

### ML Service (Python + FastAPI)

- **Role:** Run change-detection inference on image pairs
- **Model:** Tiny-CD (a lightweight change-detection architecture)
- **Input:** Two images (before/after) via multipart form data
- **Output:** JSON with detected changes and bounding boxes
- **Runs on:** `http://localhost:8000`

## Design Decisions

<!-- TODO: Students should document key decisions here as the project evolves -->
<!-- Examples: Why JWT over sessions? Why separate ML service? Why PostgreSQL over MongoDB? -->

> Document your architectural decisions here as you make them. For each decision, note: what you decided, what alternatives you considered, and why you chose this approach.
