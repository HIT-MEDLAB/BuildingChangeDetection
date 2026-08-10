import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./Upload.css";

// Maximum image size allowed by the backend: 10 MB.
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// File types supported by the upload requirement and backend.
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/tiff",
];

function Upload() {
  // Controls the active wizard step:
  // 1 = Before image
  // 2 = After image
  // 3 = Uploading and processing
  // Step 4 is displayed on the Results page.
  const [currentStep, setCurrentStep] =
    useState(1);

  // Stores the original image files that will be sent to the backend.
  const [beforeImage, setBeforeImage] =
    useState(null);

  const [afterImage, setAfterImage] =
    useState(null);

  // Stores local image previews shown before submission.
  const [beforePreview, setBeforePreview] =
    useState("");

  const [afterPreview, setAfterPreview] =
    useState("");

  // Stores a user-friendly validation or upload error.
  const [error, setError] = useState("");

  // Prevents duplicate requests while the upload is running.
  const [loading, setLoading] =
    useState(false);

  const navigate = useNavigate();

  /**
   * Returns whether a progress step should appear active.
   * Completed steps and the current step receive the active style.
   */
  const isStepActive = (stepNumber) =>
    currentStep >= stepNumber;

  /**
   * Validates a selected file before saving it.
   */
  const validateFile = (file) => {
    if (!file) {
      return "Please choose an image.";
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return "Only JPG, PNG, and TIFF image files are allowed.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "The selected image must be 10MB or smaller.";
    }

    return "";
  };

  /**
   * Saves a selected image and creates a local preview.
   *
   * type may be:
   * - "before"
   * - "after"
   */
  const handleFile = (file, type) => {
    const validationError =
      validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      if (type === "before") {
        setBeforeImage(file);
        setBeforePreview(reader.result);
      } else {
        setAfterImage(file);
        setAfterPreview(reader.result);
      }

      setError("");
    };

    reader.onerror = () => {
      setError(
        "The selected image could not be read. Please try another file."
      );
    };

    reader.readAsDataURL(file);
  };

  /**
   * Supports dragging and dropping an image into the upload area.
   */
  const handleDrop = (event, type) => {
    event.preventDefault();

    const droppedFile =
      event.dataTransfer.files?.[0];

    handleFile(droppedFile, type);
  };

  /**
   * Moves from the Before step to the After step.
   */
  const handleNextStep = () => {
    if (!beforeImage) {
      setError(
        "Please upload the Before image before continuing."
      );
      return;
    }

    setError("");
    setCurrentStep(2);
  };

  /**
   * Returns from the After step to the Before step.
   * The previously selected images are preserved.
   */
  const handlePreviousStep = () => {
    if (loading) {
      return;
    }

    setError("");
    setCurrentStep(1);
  };

  /**
   * Sends both selected images to the backend.
   */
  const handleSubmit = async () => {
    // Submission remains blocked until both required images exist.
    if (
      !beforeImage ||
      !afterImage ||
      loading
    ) {
      setError(
        "Please upload both images before submitting."
      );
      return;
    }

    setError("");
    setLoading(true);

    // Move the wizard to the Processing step while the request is running.
    setCurrentStep(3);

    try {
      const formData = new FormData();

      // These field names must match the Multer fields in the backend.
      formData.append(
        "imageBefore",
        beforeImage
      );

      formData.append(
        "imageAfter",
        afterImage
      );

      const response = await api.post(
        "/api/inspections/upload",
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

      // Support either API field until the response naming is finalized.
      const inspectionId =
        response.data.inspectionId ||
        response.data.id;

      if (!inspectionId) {
        throw new Error(
          "The server did not return an inspection ID."
        );
      }

      // Continue to the existing Processing page.
      // That page polls the inspection status and later opens Results.
      navigate(
        `/processing/${inspectionId}`,
        {
          state: {
            inspectionId,
            beforePreview,
            afterPreview,
          },
        }
      );
    } catch (err) {
      if (err.response?.status === 413) {
        setError(
          "One or both images are too large."
        );
      } else if (
        err.response?.status === 415
      ) {
        setError(
          "Please upload JPG, PNG, or TIFF image files."
        );
      } else {
        setError(
          "We could not upload the images. Please try again."
        );
      }

      // Return to the After step so the user can retry or replace an image.
      setCurrentStep(2);
      setLoading(false);
    }
  };

  /**
   * Renders the shared image upload area.
   *
   * The file input receives a stable data-testid
   * based on whether it represents the Before or After image.
   */
  const renderUploadBox = ({
    type,
    preview,
    altText,
  }) => {
    const inputTestId =
      type === "before"
        ? "upload-before-input"
        : "upload-after-input";

    return (
      <div
        className="upload-box"
        onDragOver={(event) =>
          event.preventDefault()
        }
        onDrop={(event) =>
          handleDrop(event, type)
        }
      >
        {preview ? (
          <div className="selected-image-container">
            <img
              src={preview}
              alt={altText}
            />

            <label className="replace-file-button">
              Replace Image

              <input
                data-testid={inputTestId}
                type="file"
                accept=".jpg,.jpeg,.png,.tif,.tiff,image/jpeg,image/png,image/tiff"
                onChange={(event) =>
                  handleFile(
                    event.target.files?.[0],
                    type
                  )
                }
              />
            </label>
          </div>
        ) : (
          <div className="upload-placeholder">
            <div className="upload-icon">
              ☁
            </div>

            <p>Drag & drop image here</p>

            <span>or</span>

            <label>
              Choose File

              <input
                data-testid={inputTestId}
                type="file"
                accept=".jpg,.jpeg,.png,.tif,.tiff,image/jpeg,image/png,image/tiff"
                onChange={(event) =>
                  handleFile(
                    event.target.files?.[0],
                    type
                  )
                }
              />
            </label>

            <small>
              JPG, PNG or TIFF up to 10MB
            </small>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="upload-page">
      <h1>Upload Inspection Images</h1>

      <p className="upload-subtitle">
        Upload before and after images of the same
        location to detect changes.
      </p>

      {/* Four-step wizard indicator required by REQ-UI-01. */}
      <div className="upload-steps">
        <div
          className={`step ${
            isStepActive(1)
              ? "active"
              : ""
          }`}
        >
          1
        </div>

        <div
          className={`line ${
            currentStep > 1
              ? "active"
              : ""
          }`}
        />

        <div
          className={`step ${
            isStepActive(2)
              ? "active"
              : ""
          }`}
        >
          2
        </div>

        <div
          className={`line ${
            currentStep > 2
              ? "active"
              : ""
          }`}
        />

        <div
          className={`step ${
            isStepActive(3)
              ? "active"
              : ""
          }`}
        >
          3
        </div>

        <div className="line" />

        <div className="step">
          4
        </div>
      </div>

      <div className="step-labels">
        <span>Before</span>
        <span>After</span>
        <span>Processing</span>
        <span>Results</span>
      </div>

      {/* Step 1: Before image. */}
      {currentStep === 1 && (
        <section className="wizard-content">
          <h2>1. Upload Before Image</h2>

          <p className="wizard-description">
            Select an image showing the location
            before the suspected change.
          </p>

          {renderUploadBox({
            type: "before",
            preview: beforePreview,
            altText: "Before preview",
          })}

          {error && (
            <p className="upload-error">
              {error}
            </p>
          )}

          <div className="wizard-actions single-action">
            <button
              data-testid="upload-before-next"
              type="button"
              className="upload-button"
              onClick={handleNextStep}
              disabled={!beforeImage}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* Step 2: After image. */}
      {currentStep === 2 && (
        <section className="wizard-content">
          <h2>2. Upload After Image</h2>

          <p className="wizard-description">
            Select an image showing the same
            location after the suspected change.
          </p>

          {renderUploadBox({
            type: "after",
            preview: afterPreview,
            altText: "After preview",
          })}

          {error && (
            <p className="upload-error">
              {error}
            </p>
          )}

          <div className="wizard-actions">
            <button
              type="button"
              className="back-button"
              onClick={handlePreviousStep}
              disabled={loading}
            >
              Back
            </button>

            <button
              data-testid="upload-submit"
              type="button"
              className="upload-button"
              onClick={handleSubmit}
              disabled={
                !beforeImage ||
                !afterImage ||
                loading
              }
            >
              {loading
                ? "Uploading..."
                : "Submit Images"}
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Temporary loading state before navigation. */}
      {currentStep === 3 && (
        <section className="wizard-content">
          <h2>Uploading Images</h2>

          <p className="wizard-description">
            Please wait while the inspection is
            created.
          </p>
        </section>
      )}

      <p className="upload-note">
        ℹ Please upload images of the same location
        from similar angles for best results.
      </p>
    </div>
  );
}

export default Upload;