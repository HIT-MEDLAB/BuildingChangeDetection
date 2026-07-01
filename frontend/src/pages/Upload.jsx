import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./Upload.css";

function Upload() {
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [beforePreview, setBeforePreview] = useState("");
  const [afterPreview, setAfterPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Validates the selected file and creates a local preview for the user
  const handleFile = (file, type) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
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

    reader.readAsDataURL(file);
  };

  // Handles drag and drop upload
  const handleDrop = (e, type) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0], type);
  };

  // Sends both images to the backend as multipart/form-data
  const handleSubmit = async () => {
    if (!beforeImage || !afterImage) {
      setError("Please upload both before and after images");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const formData = new FormData();

      // Field names must match Yair's multer configuration in the backend
      formData.append("imageBefore", beforeImage);
      formData.append("imageAfter", afterImage);

      const response = await api.post("/api/inspections/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Backend returns inspectionId after creating the inspection record
      const inspectionId = response.data.inspectionId || response.data.id;

      navigate(`/processing/${inspectionId}`, {
        state: {
          inspectionId,
          beforePreview,
          afterPreview,
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Upload failed. Please try again."
      );
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

      {/* Visual progress steps for the inspection flow */}
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
        <div>
          <h2>1. Upload Before Image</h2>

          <div
            className="upload-box"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, "before")}
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
                    onChange={(e) =>
                      handleFile(e.target.files[0], "before")
                    }
                  />
                </label>

                <small>JPG, PNG up to 10MB</small>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2>2. Upload After Image</h2>

          <div
            className="upload-box"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, "after")}
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
                    onChange={(e) =>
                      handleFile(e.target.files[0], "after")
                    }
                  />
                </label>

                <small>JPG, PNG up to 10MB</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="upload-error">{error}</p>}

      <button
        type="button"
        className="upload-button"
        onClick={handleSubmit}
        disabled={loading}
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