import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./Upload.css";

function Upload() {
  // Stores the selected image files.
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);

  // Stores local preview URLs for the selected images.
  const [beforePreview, setBeforePreview] = useState("");
  const [afterPreview, setAfterPreview] = useState("");

  // Stores a user-friendly error message.
  const [error, setError] = useState("");

  // Prevents multiple submissions while the upload request is running.
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // The submit button stays disabled until both images are selected.
  // It also remains disabled while the upload request is running.
  const isSubmitDisabled = !beforeImage || !afterImage || loading;

  // Validates the selected file and creates a local preview for the user.
  const handleFile = (file, type) => {
    if (!file) return;

    // Reject files that are not images.
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }

    const reader = new FileReader();

    // Save the selected file and its preview after reading is complete.
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

    reader.readAsDataURL(file);
  };

  // Handles image files dropped into an upload area.
  const handleDrop = (event, type) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files[0], type);
  };

  // Sends both images to the backend as multipart/form-data.
  const handleSubmit = async () => {
    // Safety check - this should never happen because
    // the Submit button stays disabled until both images are selected.
    if (!beforeImage || !afterImage) {
     return;
   }

    setError("");
    setLoading(true);

    try {
      const formData = new FormData();

      // Field names must match the Multer configuration in the backend.
      formData.append("imageBefore", beforeImage);
      formData.append("imageAfter", afterImage);

      const response = await api.post(
        "/api/inspections/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // The backend returns the inspection ID after creating the record.
      const inspectionId =
        response.data.inspectionId || response.data.id;

      // Continue to the processing step after a successful upload.
      navigate(`/processing/${inspectionId}`, {
        state: {
          inspectionId,
          beforePreview,
          afterPreview,
        },
      });
    } catch (err) {
      // Display a plain-language message instead of a technical error.
      if (err.response?.status === 413) {
        setError("One or both images are too large.");
      } else if (err.response?.status === 415) {
        setError("Please upload a supported image file.");
      } else {
        setError(
          "We could not upload the images. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-page">
      <h1>Upload Inspection Images</h1>

      <p className="upload-subtitle">
        Upload before and after images of the same location to detect changes.
      </p>

      {/* Visual progress steps for the inspection flow. */}
      <div className="upload-steps">
        <div className="step active">1</div>
        <div className="line"></div>
        <div className="step">2</div>
        <div className="line"></div>
        <div className="step">3</div>
      </div>

      <div className="step-labels">
        <span>Upload Images</span>
        <span>Processing</span>
        <span>Results</span>
      </div>

      <div className="upload-grid">
        {/* Before-image upload area. */}
        <div>
          <h2>1. Upload Before Image</h2>

          <div
            className="upload-box"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, "before")}
          >
            {beforePreview ? (
              <img src={beforePreview} alt="Before preview" />
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon">☁</div>
                <p>Drag & drop image here</p>
                <span>or</span>

                <label>
                  Choose File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      handleFile(event.target.files[0], "before")
                    }
                  />
                </label>

                <small>JPG, PNG up to 10MB</small>
              </div>
            )}
          </div>
        </div>

        {/* After-image upload area. */}
        <div>
          <h2>2. Upload After Image</h2>

          <div
            className="upload-box"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, "after")}
          >
            {afterPreview ? (
              <img src={afterPreview} alt="After preview" />
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon">☁</div>
                <p>Drag & drop image here</p>
                <span>or</span>

                <label>
                  Choose File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      handleFile(event.target.files[0], "after")
                    }
                  />
                </label>

                <small>JPG, PNG up to 10MB</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show an error only when one exists. */}
      {error && <p className="upload-error">{error}</p>}

      {/* The button is unavailable until both images are selected. */}
      <button
        type="button"
        className="upload-button"
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
      >
        {loading ? "Uploading..." : "Submit Images"}
      </button>

      <p className="upload-note">
        ℹ Please upload images of the same location from similar angles for best
        results.
      </p>
    </div>
  );
}

export default Upload;