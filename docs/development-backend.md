# Development Document — Backend Sections

*Drafted for the ~8-page development document (Week of Jul 27 – Aug 2, 2026). Covers architecture,
data model, API, security, ML integration, logging, and measured performance — the backend/ML
portion of the joint document with Neta's frontend sections.*

## Architecture

The system is a small set of independently-runnable services, orchestrated locally with Docker
Compose (no public deployment — see PRD section 7, Out of Scope):

- **Backend** (`backend/`) — Node.js + Express REST API. Owns authentication, authorization,
  inspection records, file storage orchestration, PDF report generation, and logging.
- **ML service** (`ml-service/`) — Python + FastAPI. A single `/predict` endpoint that accepts two
  images and returns detected-change bounding boxes. Currently a mock (per PRD section 7, model
  training/accuracy is explicitly out of scope) — the backend's job is to orchestrate its
  execution and visualize the output, not to train or own the model.
- **Database** — PostgreSQL 16 (`docker-compose.yml`), schema in `database/001_initial_schema.sql`
  plus an additive migration `database/002_add_roles_and_status.sql`.
- **Frontend** (`frontend/`) — React + Vite SPA (see Neta's sections for detail).

Request flow for the core use case: the frontend uploads a before/after image pair to
`POST /api/inspections/upload` → the backend stores the images, calls the ML service, persists the
result, and returns the inspection ID → the frontend polls `GET /api/inspections/:id` until
`status: "completed"` and renders the result.

## Data Model

Three tables (`database/001_initial_schema.sql`, extended by `002_add_roles_and_status.sql`):

**`users`** — `id`, `email` (unique), `password_hash` (bcrypt), `name`, `role` (`inspector` |
`admin`, default `inspector`), `is_active` (boolean, default true), `created_at`.

**`inspections`** — `id`, `user_id` (FK → users), `building_id`, `status` (ML processing state:
`pending` | `completed` | `failed`), `case_status` (the inspector's enforcement decision, distinct
from `status`: `under_review` | `confirmed` | `dismissed`, default `under_review`), `notes`,
`image_before_path`, `image_after_path`, `created_at`, `updated_at`.

**`inspection_results`** — `id`, `inspection_id` (FK → inspections, `ON DELETE CASCADE`),
`changes_detected` (boolean), `result_data` (JSONB — bounding boxes + confidence from the ML
service), `created_at`.

Indexes on `user_id`, `status`, `case_status` (inspections) and `inspection_id`
(inspection_results) for the common query patterns (a user's own inspections, filtering by
status). All `CREATE INDEX` statements use `IF NOT EXISTS` so the schema file can be safely
re-applied to an existing database without erroring.

## API

Full endpoint-by-endpoint reference: `docs/api-spec.md`. Summary by area:

- **Auth** — `POST /api/auth/login`. No self-registration endpoint (see Security below).
- **Inspections** — upload, list (paginated), get one, delete, update case status, export.
- **Reports** — `GET /api/report/:id`, server-side PDF generation.
- **Admin** — `GET/POST/PATCH /api/admin/users`, gated by role.

## Security

- **Authentication**: JWT (`jsonwebtoken`), 8h expiry, verified on every request via the
  `authenticate` middleware (`Authorization: Bearer <token>`).
- **Password storage**: bcrypt (cost factor 10), never logged (see Logging below).
- **Authorization**: role-based (`inspector` / `admin`) embedded in the JWT and enforced by
  `requireAdmin` middleware on `/api/admin/*`. Ownership checks (`inspection.user_id ===
  req.user.userId`) gate every inspection-scoped read/write, including report download and export
  (NFR-SEC-02).
- **Access model**: admin-managed, by design. The PRD (section 3.2, US-6) assigns "manage user
  access" to the Administrator role and never specifies self-registration — appropriate for a
  fixed municipal inspector/admin staff. Accounts are created via `POST /api/admin/users`, not
  public sign-up.
- **File naming**: uploaded images are renamed to a UUID on disk (`multer` + `uuid`), so file paths
  can't be guessed (NFR-SEC-01).
- **Known tradeoff**: role/active-status changes take effect on the affected user's *next* login,
  not instantly on already-issued tokens (max exposure window: 8h), since role is embedded in the
  JWT rather than checked against the DB on every request. Acceptable for this project's scale;
  would need a token-revocation list or shorter expiry for a system requiring instant revocation.

## ML Integration

The backend calls the ML service's `POST /predict` with both images as multipart form data and
expects `{ changes_detected: boolean, bounding_boxes: [{x,y,w,h}], confidence: number }`.

Robustness added this week (NFR-REL-01, NFR-PERF-01, REQ-CORE-06):

- **Timeout**: the ML call is bounded by an `AbortController` (`ML_TIMEOUT_MS`, default 5000ms,
  configurable via env). A hung or slow model aborts and the inspection is marked `failed` with a
  clear message, instead of hanging the whole request past the PRD's 8-second budget.
- **Response-shape validation**: if the ML service returns 200 but a response that isn't the
  expected shape (missing `changes_detected`/`bounding_boxes`), it's treated as a failure rather
  than persisted.
- **Incompatible images**: the ML service now actually opens both images with Pillow (previously
  only checked the `Content-Type` header, which is trivially spoofable). Corrupt/unreadable files
  are rejected with a clear `422` (`"...could not be read (corrupt or unsupported image data)"`).
  Image pairs with a mismatched aspect ratio (>25% difference) are rejected as
  `"camera angles are too different"`, per the PRD's own example error message (REQ-CORE-06). The
  backend relays the ML service's specific `detail` message to the client instead of a generic one.

## Logging (REQ-LOG-01)

`backend/src/config/logger.js` (winston), levels `error`/`warn`/`info`/`debug`. Writes to
`backend/logs/error.log`, `backend/logs/combined.log`, and the console outside `NODE_ENV=test`.
User actions logged via `logger.logUserAction(action, meta)`: `login`, `upload`,
`report_download`, `status_change`, `delete_inspection`, `export`, `admin_create_user`,
`admin_update_user`. A redaction step strips `password`, `token`, and similar keys from any log
line before it's written — verified directly against the log file, not just by inspection.

## Measured Performance (against the running system, not estimated)

| Requirement | Target | Measured | Method |
|---|---|---|---|
| NFR-PERF-01 (upload → result) | ≤ 8s | **0.24s** (happy path) | `curl -w "%{time_total}"` against a real upload |
| NFR-PERF-01 (ML timeout enforcement) | fail fast, not hang | **5.07s** (aborts, doesn't wait for a simulated 10s hang) | Manually induced a 10s delay in the mock ML service, confirmed the backend aborted at the configured 5s budget |
| NFR-PERF-02 (report generation) | < 3s | **0.32s** | `curl -w "%{time_total}"` against `GET /api/report/:id`, including PDF generation and image embedding |

All three numbers were measured against the actual running system (Docker Postgres + Node backend
+ FastAPI ML service), not test mocks — consistent with this week's lesson that passing tests
don't by themselves prove the system works.
