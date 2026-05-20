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

| Status | Body                                        | When                       |
|--------|---------------------------------------------|----------------------------|
| 400    | `{ "error": "Email and password required" }`| Missing fields             |
| 401    | `{ "error": "Invalid credentials" }`        | Wrong email or password    |

<!-- TODO: Decide on token expiration time -->
<!-- TODO: Add POST /api/auth/register if self-registration is needed (check PRD) -->

---

## Inspections

> All inspection endpoints require authentication. Include the JWT token:
> `Authorization: Bearer <token>`

### POST /api/inspections/upload

Upload two images for change-detection comparison.

**Request:** `multipart/form-data`

| Field         | Type   | Required | Description                        |
|---------------|--------|----------|------------------------------------|
| `imageBefore` | file   | Yes      | The earlier (baseline) image       |
| `imageAfter`  | file   | Yes      | The later (current) image          |
| `buildingId`  | string | TBD      | Identifier for the building        |
| `notes`       | string | No       | Inspector's notes about this pair  |

<!-- TODO: Decide on accepted image formats (JPEG, PNG?) and max file size -->
<!-- TODO: Decide if buildingId is required or auto-generated -->

**Success Response (201):**

```json
{
  "inspectionId": 42,
  "status": "processing",
  "message": "Images uploaded. Processing will begin shortly."
}
```

**Error Responses:**

| Status | Body                                         | When                          |
|--------|----------------------------------------------|-------------------------------|
| 400    | `{ "error": "Both images are required" }`    | Missing one or both files     |
| 401    | `{ "error": "Unauthorized" }`                | Missing or invalid JWT        |
| 413    | `{ "error": "File too large" }`              | Exceeds max file size (TBD)   |

---

### GET /api/inspections/:id

Retrieve a single inspection with its results.

**URL Parameters:**

| Param | Type   | Description          |
|-------|--------|----------------------|
| `id`  | number | The inspection ID    |

**Success Response (200):**

```json
{
  "id": 42,
  "buildingId": "TBD",
  "status": "completed",
  "createdAt": "2025-12-01T10:30:00Z",
  "notes": "Annual inspection",
  "images": {
    "before": "/uploads/before-42.jpg",
    "after": "/uploads/after-42.jpg"
  },
  "results": {
    "changesDetected": true,
    "boundingBoxes": [
      { "x": 120, "y": 85, "w": 200, "h": 150 }
    ]
  }
}
```

<!-- TODO: Define all possible status values (pending, processing, completed, failed?) -->
<!-- TODO: Decide how bounding box coordinates relate to image dimensions (pixels? percentages?) -->

**Error Responses:**

| Status | Body                                    | When                    |
|--------|-----------------------------------------|-------------------------|
| 401    | `{ "error": "Unauthorized" }`           | Missing or invalid JWT  |
| 404    | `{ "error": "Inspection not found" }`   | Invalid ID              |

---

### GET /api/inspections/history

Retrieve a paginated list of past inspections for the authenticated user.

**Query Parameters:**

| Param      | Type   | Default | Description                              |
|------------|--------|---------|------------------------------------------|
| `page`     | number | 1       | Page number                              |
| `limit`    | number | 20      | Items per page                           |
| `buildingId` | string | —     | Filter by building (optional)            |
| `status`   | string | —       | Filter by status (optional)              |

<!-- TODO: Add date range filtering? Sort options? -->

**Success Response (200):**

```json
{
  "inspections": [
    {
      "id": 42,
      "buildingId": "TBD",
      "status": "completed",
      "createdAt": "2025-12-01T10:30:00Z",
      "changesDetected": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

**Error Responses:**

| Status | Body                           | When                   |
|--------|--------------------------------|------------------------|
| 401    | `{ "error": "Unauthorized" }`  | Missing or invalid JWT |

---

## ML Service (Internal)

> This endpoint is called by the backend only. It is NOT exposed to the frontend.

### POST http://localhost:8000/predict

**Request:** `multipart/form-data`

| Field          | Type | Required | Description          |
|----------------|------|----------|----------------------|
| `image_before` | file | Yes      | Baseline image       |
| `image_after`  | file | Yes      | Current image        |

**Success Response (200):**

```json
{
  "changes_detected": true,
  "bounding_boxes": [
    { "x": 120, "y": 85, "w": 200, "h": 150 }
  ],
  "confidence": 0.87
}
```

<!-- TODO: Define the exact output format of the Tiny-CD model -->
<!-- TODO: Decide if we return a change mask image or just bounding boxes -->
