import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Upload.css";

function Upload() {
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [beforePreview, setBeforePreview] = useState("");
  const [afterPreview, setAfterPreview] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleFile = (file, type) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      const base64Image = reader.result;

      if (type === "before") {
        setBeforeImage(file);
        setBeforePreview(base64Image);
      } else {
        setAfterImage(file);
        setAfterPreview(base64Image);
      }

      setError("");
    };

    reader.readAsDataURL(file);
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file, type);
  };

  const handleSubmit = () => {
    if (!beforeImage || !afterImage) {
      setError("Please upload both before and after images");
      return;
    }

    const newInspection = {
      id: Date.now(),
      date: new Date().toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      beforeImage: beforePreview,
      afterImage: afterPreview,
      result: "Change Detected",
    };

    const history =
      JSON.parse(localStorage.getItem("inspectionHistory")) || [];

    localStorage.setItem(
      "inspectionHistory",
      JSON.stringify([newInspection, ...history])
    );

    navigate("/processing", {
      state: {
        beforePreview,
        afterPreview,
      },
    });
  };

  return (
    <div className="upload-page">
      <h1>Upload Inspection Images</h1>

      <p className="upload-subtitle">
        Upload before and after images of the same location to detect changes.
      </p>

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

      <button type="button" className="upload-button" onClick={handleSubmit}>
        Submit Images
      </button>

      <p className="upload-note">
        ℹ Please upload images of the same location from similar angles for best results.
      </p>
    </div>
  );
}

export default Upload;