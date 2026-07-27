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
- **Database** — PostgreSQL 16 (`docker-compose.yml`), schema in `database/001_initial_schema.sql`,
  extended by additive migrations `database/002_add_roles_and_status.sql` (roles, case status) and
  `database/003_add_processed_image.sql` (processed/result image path). All three files are
  re-runnable (`IF NOT EXISTS` / guarded `ALTER`s), so re-applying them to an existing database is
  a no-op, not an error.
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
`image_before_path`, `image_after_path`, `processed_image_path` (added in `003`; the
server-generated result image — see Processed Image Pipeline below), `created_at`, `updated_at`.

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

## Processed Image Pipeline (REQ-CORE-03/04/05)

Closing a gap found during a full re-read of the PRD this week (previously only the PDF report
rendered the detected-change overlay — nothing was stored or returned to the client):

- **Generation (REQ-CORE-03)**: `backend/src/utils/imageOverlay.js` exports
  `generateProcessedImage(sourceImagePath, boundingBoxes, outputPath)`. It reads the "after"
  image's own resolution with `sharp`, renders an SVG of the bounding boxes at that resolution
  (stroke color `OVERLAY_COLOR = '#ff2d55'`, matching what the PDF report used to draw manually),
  composites it over the image, and writes a PNG to `outputPath`. Runs once, synchronously, inside
  `POST /api/inspections/upload` right after the ML result is validated — before the inspection is
  marked `completed`.
- **Storage (REQ-CORE-04)**: the resulting path is saved to the new `inspections.processed_image_path`
  column (migration `003_add_processed_image.sql`) in the same `UPDATE` that marks the inspection
  `completed`, alongside `image_before_path` / `image_after_path`.
- **Return to client (REQ-CORE-05)**: `GET /api/inspections/:id` now returns it as
  `images.processed`; `GET /api/inspections` (history) returns it as `processed_image_path`. Both
  are `null` for inspections created before migration 003, or if generation failed for a specific
  inspection — failure here is logged and non-fatal (a successful detection with no processed
  image is a smaller problem than failing the whole upload over an image-compositing bug).
- **No drift between the report and the standalone image**: `backend/src/routes/report.js` now
  embeds this exact stored file in the PDF's "Processed Image" page when it exists, instead of
  re-drawing the boxes at report-render time. It only falls back to live box-drawing (using the
  same `OVERLAY_COLOR` constant) for inspections that predate migration 003.
- **US-2 (view a historical case)**: the fix above means `GET /api/inspections/:id` already
  returned both source images, the boxes, the status, and the note — the only thing missing was
  the processed image, which this closes. Response shape agreed with the frontend so the "open
  case from history" screen can render fully from one request (see `docs/api-spec.md`).

## API Field Naming Consistency

`GET /api/inspections` (history) previously returned the raw column name `case_status`, while
`GET /api/inspections/:id` (detail) returned `caseStatus` — the same data, two different key
spellings depending on which endpoint you called. Fixed by aliasing the column in the history SQL
query (`i.case_status AS "caseStatus"`) rather than in application code, so it can't silently drift
back out of sync with the detail endpoint. Covered by a regression test asserting both the response
body and the query text itself. Other history fields (`image_before_path`, `image_after_path`,
`created_at`, `changes_detected`) were intentionally left as-is — they weren't the reported
inconsistency, and renaming them would touch frontend code/tests written against that exact shape
without a live confirmation that both sides are changing together.

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
| Processed image generation (REQ-CORE-03) | within the 8s upload budget | **74ms** for a realistic 1920×1080 photo, 3 boxes | Direct timing around `generateProcessedImage()` with a generated 1920×1080 JPEG, run outside test mocks |

All four numbers were measured against the actual running system or the real `sharp`/PDF
pipeline (Docker Postgres + Node backend + FastAPI ML service for the first three; a real image
file and the real image-compositing code for the fourth), not test mocks — consistent with this
week's lesson that passing tests don't by themselves prove the system works. The processed-image
step adds negligible overhead against the 8-second budget even on realistic photo dimensions, well
under the ML timeout alone.
