# Development Document — Backend Sections

*Backend/ML portion of the joint development document with Neta's frontend sections. Drafted the
week of Jul 27 – Aug 2, 2026; completed during the delivery phase (Aug 5–12, 2026) with error
handling, testing, and future-work sections added. Covers architecture, data model, API, security,
ML integration, error handling, logging, testing, measured performance, and known limitations.*

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

**Bug fixed (found via a garbled-looking PDF report)**: the mock's bounding boxes used to be
hardcoded absolute pixel values, unrelated to the actual uploaded image's dimensions. Every
consumer (the standalone processed image, and the PDF report's live-drawn fallback) trusts these
coordinates as already being in the real "after" image's own pixel space and places a rectangle
directly at `(x, y, w, h)` - so a box like `y: 300, h: 60` could land entirely outside a smaller
image, or bunched in a tiny corner of a larger one. Fixed by deriving the mock boxes as a
proportion of the real "after" image's dimensions (`ml-service/app.py` already reads these via
Pillow for the aspect-ratio check). Verified against a 1200x800 synthetic image and rendered to
PDF - both boxes now land inside the image at sensible positions.

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

## Error Handling

All errors converge on one centralized Express error-handling middleware
(`backend/src/middleware/errorHandler.js`, registered last in `app.js`). Any error thrown or
passed to `next(err)` from a route ends up there: it's logged via winston with full context
(message, stack, method, path, `userId`, status code) and answered with `{ error: message }` at
`err.statusCode || 500`. Nothing crashes the process — an unhandled route error becomes a `500`
with a logged stack trace, not a dropped connection.

By layer:

- **Validation (400)** — missing required fields (`Both images are required`), an invalid
  `caseStatus` value, malformed request bodies.
- **Authentication (401)** — missing or invalid JWT (`authenticate` middleware, runs before every
  protected route).
- **Authorization (403)** — `requireAdmin` for `/api/admin/*`; per-inspection ownership checks for
  read/write/report/export.
- **Not found (404)** — inspection ID doesn't exist, or (for ownership-checked routes) exists but
  isn't visible to the requester.
- **Upload-specific (multer)** — oversized (`LIMIT_FILE_SIZE`) and disallowed-type files are both
  caught in the upload middleware itself and answered with `400` and a specific message
  (`File too large. Maximum size is 10MB.` / `Invalid file type...`).
- **ML-service-specific (422 / 502)** — a `422` from the ML service (corrupt image, mismatched
  camera angles) is relayed to the client with its original `detail` message; a timeout,
  unreachable service, or unexpected response shape marks the inspection `failed` and returns
  `502`, instead of hanging the request past the 8-second budget (see ML Integration above).

**Known inconsistency (not yet fixed, low risk):** the frontend's upload error handling
(`Upload.jsx`) branches on `err.response?.status === 413` / `=== 415` to show a tailored message
("images too large" / "unsupported file"), but the backend currently answers both cases with
`400`, not `413`/`415`. In practice this means an oversized or wrong-type file still fails
correctly and safely — the user just sees the generic fallback copy ("We could not upload the
images...") instead of the specific one, since the two status codes never match. Worth a one-line
fix (either send the more specific status codes, or have the frontend read the message text
instead of branching on status) — flagged here rather than silently left for someone to rediscover
via a confusing bug report.

## Testing

- **Backend** — Jest + Supertest, 47 test cases across 5 files (`auth`, `admin`, `inspections`,
  `report`, `app`). The database is mocked (`jest.mock('../config/db')`), so the suite runs without
  a live Postgres and stays fast enough to run on every save. **Confirmed: 47/47 passing** (local
  run, Aug 2026).
- **Frontend** — Vitest + Testing Library, 7 files. **Confirmed: 63/63 passing on this branch**
  (local run, Aug 2026). Note this branch is not `dev` — **66 test cases exist on `dev`**
  (`Upload.test.jsx` has 3 more there), and that is the count that matters for the item below.
- **E2E** — new this week (`e2e/`), one Playwright scenario driving a real browser through the
  full flow: log in → upload a before/after pair → wait for processing → verify the results overlay
  → download the PDF report → confirm the case appears in history. Passing locally end-to-end
  (~19s) against a freshly started stack.

**Open action item, not yet resolved:** per the latest supervisor review, 20 of the 66 frontend
tests fail when run against the fully merged `dev` branch, even though they pass on individual
feature branches. This is being tracked and fixed separately (details in Neta's testing notes) —
the point worth documenting here is *why* it happened: tests were being verified per-branch, not
after merging, so a conflict between two independently-green branches went unnoticed until they
were combined. The fix going forward (already adopted): merge locally and run both suites again
before treating any branch as done, not just trust a green run on an isolated feature branch.

## Future Work / Known Limitations

Stating these plainly rather than glossing over them:

- **Real ML model.** The `/predict` endpoint is a mock (see ML Integration) — it returns
  proportionally-placed bounding boxes and a fixed confidence score, not the output of a trained
  model. Model training/accuracy was explicitly out of scope for this project (PRD section 7).
  Integrating a real model (e.g. Tiny-CD, referenced in `ml-service/app.py`) is the single largest
  piece of deferred work; the backend's contract with the ML service (`POST /predict` →
  `{changes_detected, bounding_boxes, confidence}`) is already designed so that swapping the mock
  for a real model shouldn't require backend changes, only a new implementation behind the same
  endpoint.
- **Instant token revocation.** Role/active-status changes apply on the user's *next* login, not
  immediately (see Security) — acceptable at this project's scale, but would need a revocation list
  or short-lived tokens for a deployment requiring instant enforcement.
- **Production hardening.** Stack traces are not yet stripped from error responses in every path
  (tracked as a `TODO` in `errorHandler.js`); there's no rate limiting; there's no production
  deployment target (out of scope per the PRD — this is a local/demo system).
- **Status-code / message-copy mismatch on upload errors** — see Error Handling above.

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
