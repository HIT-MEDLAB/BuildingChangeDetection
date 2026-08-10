# Frontend Development

## 1. Frontend Overview

The frontend of the Municipal Illegal Construction Detection System is implemented with React and Vite.

Its main responsibility is to provide municipal inspectors with a clear workflow for uploading inspection images, waiting for AI analysis, reviewing detected changes, classifying cases, viewing inspection history, and downloading reports.

The frontend communicates with the backend through REST API requests and presents the returned inspection data in a user-friendly interface.

---

## 2. Screen Flow

The main inspector flow is:

Login → Upload → Processing → Results → History

The main screens are:

- Login
- Upload
- Processing
- Results
- History
- Help

Administrator users can also access:

- Admin / User Management

The application uses protected routes so that authenticated users can access the inspection screens, while administrator-only functionality is restricted according to the user's role.

---

## 3. Upload Wizard

The upload process is presented as a four-step wizard:

1. Before
2. After
3. Processing
4. Results

### Step 1 – Before Image

The inspector uploads an image representing the previous state of the inspected location.

The frontend validates the selected file before continuing.

Supported file types:

- JPG
- PNG
- TIFF

Maximum file size:

- 10 MB

### Step 2 – After Image

The inspector uploads an image of the same location after the suspected change.

The interface allows the user to return to the previous step and replace the selected image if necessary.

### Submission

After both images are selected, the frontend sends them to the backend as multipart/form-data.

The backend creates the inspection and returns an inspection ID.

The frontend then navigates to the Processing screen.

---

## 4. Processing Screen

The Processing screen provides visual feedback while the inspection is being analyzed.

The frontend periodically requests the current inspection status from the backend.

The polling request is performed every two seconds.

Possible states include:

- pending
- processing
- completed
- failed

While the inspection is still being processed, the interface displays a visual progress indicator and processing message.

When the inspection status becomes completed, the user is automatically redirected to the Results screen.

If processing fails, the interface displays a controlled error message and allows the user to return to the Upload screen.

---

## 5. Detection Results Presentation

The Results screen presents the output of the inspection.

It includes:

- Number of detected changes
- Before image
- Processed result image
- Detected change bounding boxes
- Case status
- Case note
- PDF report download

The processed result image visually highlights suspicious areas detected by the AI service.

The inspector remains responsible for reviewing the AI-assisted result and making the final case decision.

Available case statuses include:

- Under Review
- Confirmed
- Dismissed

The inspector can also add a short case note and save both the status and note to the backend.

---

## 6. Pixel-to-Percentage Overlay

The AI service returns detected regions as bounding-box coordinates.

Each bounding box contains pixel-based values:

- x
- y
- width
- height

The frontend converts these coordinates into percentage-based positions relative to the original image dimensions.

For example:

- left percentage = x / image width × 100
- top percentage = y / image height × 100
- width percentage = box width / image width × 100
- height percentage = box height / image height × 100

Using percentages allows the bounding boxes to remain correctly aligned when the displayed image is resized.

This makes the overlay responsive instead of depending on one fixed image size.

---

## 7. Error and Empty States

The frontend provides controlled messages for common failure conditions.

### Upload Errors

Examples include:

- Unsupported file type
- File larger than 10 MB
- Upload failure
- Invalid server response

### Processing Errors

Examples include:

- Inspection not found
- Permission denied
- Analysis failure
- Network or server failure

### Results Errors

The Results screen handles:

- Failure to load inspection data
- Incomplete inspections
- Failed analysis
- Report download failure
- Missing bounding boxes

### History Empty State

When no inspections are available, the History screen displays a clear empty-state message instead of an empty table.

This helps users understand that there is currently no inspection history rather than assuming that the page failed to load.

---

## 8. Inspection History

The History screen displays saved inspections in a structured table.

Each inspection includes:

- Date
- Before image
- After image
- Detection result
- Case status
- Link to Results
- PDF report action

The default ordering is Priority First.

Users can also sort inspections by:

- Newest First
- Oldest First

Priority ordering helps inspectors focus first on inspections that require attention.

---

## 9. Admin View

The Admin screen is available only to users with the admin role.

The administrator can:

- View system users
- Create new users
- Assign Inspector or Admin roles
- View account status
- Disable user accounts

The Admin navigation item is hidden from non-admin users.

This keeps administrative functionality separate from the normal inspector workflow.

---

## 10. Help Screen

The Help screen provides guidance for users of the system.

It includes:

- How to use the system
- Upload and processing workflow
- Tips for better image comparison results
- Common issues
- Contact support information

The Help screen is designed to reduce the need for external instructions during normal use.

---

## 11. Design Decisions

The interface was designed around a clear and simple municipal inspection workflow.

### Consistent Navigation

A fixed sidebar is used across the main application screens so inspectors can quickly access Upload, History, Help, and Admin when permitted.

### Step-by-Step Upload

The upload process is divided into clear steps instead of presenting the entire workflow on one screen.

This reduces user mistakes and makes the process easier to understand.

### Visual Feedback

Processing progress, detected-change indicators, case statuses, and error messages provide immediate feedback about the system state.

### Human-in-the-Loop Decision Making

AI detection is presented as decision support rather than as a final enforcement decision.

The inspector reviews detected changes and explicitly assigns the final case status.

### Responsive Detection Overlay

Bounding boxes use percentage-based positioning so they remain aligned with the processed image across different display sizes.

### Consistent Visual Identity

The application uses a consistent navy and blue visual identity across screens and project documentation.

---

## 12. Stable E2E Selectors

End-to-end tests should use stable selectors that do not depend on CSS classes, layout structure, or visible text.

The preferred approach is to use `data-testid` attributes for elements that the E2E scenario needs to interact with.

Recommended selectors:

### Login

- `login-email`
- `login-password`
- `login-submit`

### Upload

- `upload-before-input`
- `upload-before-next`
- `upload-after-input`
- `upload-submit`

### Processing

- `processing-screen`
- `processing-progress`

### Results

- `results-screen`
- `results-before-image`
- `results-processed-image`
- `results-overlay`
- `case-status-select`
- `case-note`
- `update-status-button`
- `download-report-button`

### History

- `history-screen`
- `history-row`
- `open-results-button`
- `history-download-report-button`

### Admin

- `admin-screen`
- `admin-name-input`
- `admin-email-input`
- `admin-password-input`
- `admin-role-select`
- `create-user-button`

These selectors allow the E2E test to interact with the application reliably even if styling, CSS class names, or visual layout change.