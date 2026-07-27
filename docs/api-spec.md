# API Specification

Base URL: `http://localhost:3000/api`

All endpoints return JSON. Authentication is via JWT Bearer token in the `Authorization` header (except login).

---

## Authentication

### POST /api/auth/login

Authenticate a user and receive a JWT token.

**Request Body:**

```json
{
  "email": "inspector@example.com",
  "password": "string"
}
```

**Success Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "inspector@example.com",
    "name": "Inspector Name"
  }
}
```

**Error Responses:**

| Status | Body                                          | When                    |
|--------|-----------------------------------------------|-------------------------|
| 400    | `{ "error": "Email and password are required" }` | Missing fields       |
| 401    | `{ "error": "Invalid credentials" }`          | Wrong email or password |

---

## Inspections

> All inspection endpoints require authentication:
> `Authorization: Bearer <token>`

### POST /api/inspections/upload

Upload two images for change-detection comparison.

**Request:** `multipart/form-data`

| Field         | Type | Required | Constraints              |
|---------------|------|----------|--------------------------|
| `imageBefore` | file | Yes      | JPEG / PNG / TIFF, ≤10MB |
| `imageAfter`  | file | Yes      | JPEG / PNG / TIFF, ≤10MB |

**Success Response (201):**

```json
{
  "inspectionId": 42,
  "status": "completed",
  "message": "Images uploaded. Processing will begin shortly."
}
```

**Error Responses:**

| Status | Body                                              | When                        |
|--------|---------------------------------------------------|-----------------------------|
| 400    | `{ "error": "Both images are required" }`         | Missing one or both files   |
| 400    | `{ "error": "Invalid file type. Only JPEG, PNG and TIFF are allowed." }` | Wrong file type |
| 400    | `{ "error": "File too large. Maximum size is 10MB." }` | File exceeds 10MB      |
| 401    | `{ "error": "Unauthorized" }`                     | Missing or invalid JWT      |
| 502    | `{ "error": "ML service unavailable. Inspection marked as failed.", "inspectionId": 42 }` | ML service is down |

---

### GET /api/inspections

Retrieve a paginated list of past inspections for the authenticated user.

**Query Parameters:**

| Param   | Type   | Default | Description   |
|---------|--------|---------|---------------|
| `page`  | number | 1       | Page number   |
| `limit` | number | 20      | Items per page|

**Success Response (200):**

```json
{
  "inspections": [
    {
      "id": 42,
      "status": "completed",
      "caseStatus": "under_review",
      "created_at": "2026-07-12T10:30:00Z",
      "notes": null,
      "image_before_path": "uploads/abc123.jpg",
      "image_after_path": "uploads/def456.jpg",
      "processed_image_path": "uploads/9c1e2f-processed.png",
      "changes_detected": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

**Note:** `caseStatus` is camelCase here to match the detail endpoint below (as of the Jul 27 gap-closure week, this previously returned `case_status` — fixed for consistency). Other fields on this list endpoint remain snake_case (`created_at`, `image_before_path`, `image_after_path`, `processed_image_path`, `changes_detected`) matching the raw column names; `processed_image_path` is `null` for inspections created before migration 003 or if processed-image generation failed for that inspection.

**Error Responses:**

| Status | Body                          | When                   |
|--------|-------------------------------|------------------------|
| 401    | `{ "error": "Unauthorized" }` | Missing or invalid JWT |

---

### GET /api/inspections/:id

Retrieve a single inspection with its full results.

**URL Parameters:**

| Param | Type   | Description       |
|-------|--------|-------------------|
| `id`  | number | The inspection ID |

**Success Response (200):**

```json
{
  "id": 42,
  "status": "completed",
  "createdAt": "2026-07-12T10:30:00Z",
  "notes": null,
  "images": {
    "before": "uploads/abc123.jpg",
    "after": "uploads/def456.jpg",
    "processed": "uploads/9c1e2f-processed.png"
  },
  "results": {
    "changesDetected": true,
    "boundingBoxes": [
      { "x": 120, "y": 85, "w": 200, "h": 150 },
      { "x": 400, "y": 300, "w": 80, "h": 60 }
    ]
  }
}
```

**Notes:**
- `status` can be: `pending`, `completed`, `failed`
- `results` is `null` if status is not `completed`
- `boundingBoxes` coordinates are in **pixels** relative to the original image dimensions
- `images.processed` (REQ-CORE-03/04/05) is the server-generated copy of the "after" image with the detected-change boxes drawn on top as a high-contrast overlay. It is `null` for inspections created before migration 003, or if generation failed for that specific inspection (non-fatal — the rest of the inspection still completes normally).

**Error Responses:**

| Status | Body                                  | When                          |
|--------|---------------------------------------|-------------------------------|
| 401    | `{ "error": "Unauthorized" }`         | Missing or invalid JWT        |
| 403    | `{ "error": "Forbidden" }`            | Inspection belongs to another user |
| 404    | `{ "error": "Inspection not found" }` | Invalid ID                    |

---

### DELETE /api/inspections/:id

Delete an inspection and its results (cascade).

**URL Parameters:**

| Param | Type   | Description       |
|-------|--------|-------------------|
| `id`  | number | The inspection ID |

**Success Response (200):**

```json
{
  "message": "Inspection deleted successfully"
}
```

**Error Responses:**

| Status | Body                                  | When                          |
|--------|---------------------------------------|-------------------------------|
| 401    | `{ "error": "Unauthorized" }`         | Missing or invalid JWT        |
| 403    | `{ "error": "Forbidden" }`            | Inspection belongs to another user |
| 404    | `{ "error": "Inspection not found" }` | Invalid ID                    |

---

## ML Service (Internal)

> Called by the backend only — not exposed to the frontend.

### POST http://localhost:8000/predict

**Request:** `multipart/form-data`

| Field          | Type | Required | Description    |
|----------------|------|----------|----------------|
| `image_before` | file | Yes      | Baseline image |
| `image_after`  | file | Yes      | Current image  |

**Success Response (200):**

```json
{
  "changes_detected": true,
  "bounding_boxes": [
    { "x": 120, "y": 85, "w": 200, "h": 150 },
    { "x": 400, "y": 300, "w": 80, "h": 60 }
  ],
  "confidence": 0.87
}
```

**Notes:**
- Coordinates `x`, `y`, `w`, `h` are in **pixels**
- `confidence` is a float between 0 and 1
- Currently returns mock data — real Tiny-CD model integration is pending

---

## Reports

### GET /api/report/:id

REQ-REP-01/REQ-REP-02. Generates a PDF report for a single inspection and streams it back — no report is stored server-side. Requires authentication; restricted to the inspection's owner (NFR-SEC-02).

**Success Response (200):** `application/pdf` binary stream, `Content-Disposition: attachment; filename="inspection-<id>-report.pdf"`.

Report contents: inspector name/email, date, reference (`#id` + `buildingId` if set), case status, reference & current image thumbnails, a full-page rendering of the processed (result) image — the stored file from REQ-CORE-03 when available, so the report and `images.processed` from `GET /api/inspections/:id` always show identical boxes — and a one-line textual conclusion.

**Error Responses:**

| Status | Body                                                        | When                                      |
|--------|--------------------------------------------------------------|--------------------------------------------|
| 401    | `{ "error": "Unauthorized" }`                                 | Missing or invalid JWT                     |
| 403    | `{ "error": "Forbidden" }`                                     | Caller does not own this inspection        |
| 404    | `{ "error": "Inspection not found" }`                          | Invalid ID                                 |
| 409    | `{ "error": "Report unavailable — inspection status is '...'" }` | Inspection hasn't finished processing yet |

Frontend: wire the "Download Summary Report" button (REQ-UI-03) to `GET /api/report/:id` with the JWT bearer header, and trigger a file download from the response blob.

---

## Inspections — case status & export

### PATCH /api/inspections/:id/status

US-4. Lets the inspector classify a case outcome, distinct from the ML `status` field (which reflects processing state: pending/processing/completed/failed).

**Request Body:**

```json
{ "caseStatus": "confirmed", "note": "Unpermitted rooftop extension, escalating." }
```

`caseStatus` must be one of `under_review` (default), `confirmed`, `dismissed`. `note` is optional and overwrites the inspection's `notes` field.

**Success Response (200):**

```json
{ "id": 42, "caseStatus": "confirmed", "notes": "Unpermitted rooftop extension, escalating.", "updatedAt": "2026-07-18T10:00:00Z" }
```

`caseStatus` is now also included in `GET /api/inspections` and `GET /api/inspections/:id` responses.

**Error Responses:** `400` invalid caseStatus, `401` unauthorized, `403` not the owner, `404` not found.

### GET /api/inspections/:id/export

US-5. Streams a zip (`application/zip`) containing `record.json` (case details + detection results) and the two source images (`before.<ext>`, `after.<ext>`). Same ownership rule as the report endpoint.

**Error Responses:** `401`, `403`, `404` — same semantics as the report endpoint.

---

## Admin (US-6)

> All endpoints below require authentication **and** an admin role (`role: "admin"` on the JWT). An inspector calling any of these gets `403 { "error": "Admin access required" }`.

### GET /api/admin/users

Lists all users.

**Success Response (200):**

```json
{
  "users": [
    { "id": 1, "email": "yair@medlab.hit.ac.il", "name": "Yair Katsav", "role": "inspector", "isActive": true, "createdAt": "2026-07-01T00:00:00Z" }
  ]
}
```

### POST /api/admin/users

Creates a new user account.

**Request Body:** `{ "email": "...", "password": "...", "name": "...", "role": "inspector" }` (`role` optional, defaults to `inspector`).

**Success Response (201):** the created user object (no password hash). **Errors:** `400` missing fields / invalid role, `409` email already exists.

### PATCH /api/admin/users/:id

Enable/disable a user and/or change their role.

**Request Body:** `{ "role": "admin" }` and/or `{ "isActive": false }`.

**Success Response (200):** the updated user object. **Errors:** `400` no fields provided / invalid role / admin targeting their own account (self-lockout guard), `404` user not found.

> Note: role/active changes take effect on the target user's next login — existing JWTs remain valid until they expire (8h), since role is embedded in the token rather than checked against the DB on every request.

---

## Logging (REQ-LOG-01)

The backend now logs through `backend/src/config/logger.js` (winston), with `error`/`warn`/`info`/`debug` levels, writing to `backend/logs/error.log`, `backend/logs/combined.log`, and (outside `NODE_ENV=test`) the console. User actions — `login`, `upload`, `report_download`, `status_change`, `delete_inspection`, `export`, `admin_create_user`, `admin_update_user` — are logged via `logger.logUserAction(action, meta)`. `password`, `passwordHash`, `token`, and similar keys are redacted automatically before anything is written.