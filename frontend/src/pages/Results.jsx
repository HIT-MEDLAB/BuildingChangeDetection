import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";
import api from "../api";
import "./Results.css";

function Results() {
  const location = useLocation();
  const { id } = useParams();

  // Inspection data and request states
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Original dimensions of the after image
  // Used to convert pixel coordinates into percentages
  const [afterImageSize, setAfterImageSize] = useState({
    width: 0,
    height: 0,
  });

  // Local image previews received from the Processing page
  const beforeImage = location.state?.beforePreview;
  const afterImage = location.state?.afterPreview;

  useEffect(() => {
    // Load the completed inspection from the backend
    const fetchInspection = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(`/api/inspections/${id}`);
        setInspection(response.data);
      } catch (err) {
        console.error("Failed to load inspection:", err);
        setError("Failed to load inspection results.");
      } finally {
        setLoading(false);
      }
    };

    fetchInspection();
  }, [id]);

  // Display a loading state while waiting for the backend
  if (loading) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>
        <p>Loading results...</p>
      </div>
    );
  }

  // Display a clear error message if the request failed
  if (error) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>
        <p className="upload-error">{error}</p>
      </div>
    );
  }

  // Handle inspections that failed during processing
  if (inspection?.status === "failed") {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>
        <p className="upload-error">
          Inspection failed. Please upload the images again.
        </p>
      </div>
    );
  }

  // Handle inspections that do not have result data yet
  if (!inspection?.results) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>
        <p>No inspection results are available yet.</p>
      </div>
    );
  }

  // The image previews are required to display the comparison
  if (!beforeImage || !afterImage) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>
        <p>
          No image previews available. Please open results after uploading
          images.
        </p>
      </div>
    );
  }

  // Bounding boxes returned by the backend in pixel coordinates
  const detectedChanges = inspection.results.boundingBoxes || [];
  const numberOfChanges = detectedChanges.length;
  const changesDetected = numberOfChanges > 0;

  // Convert each bounding box from image pixels to relative percentages
  // This keeps the boxes aligned when the image is resized in the browser
  const getBoxStyle = (box) => {
    if (!afterImageSize.width || !afterImageSize.height) {
      return { display: "none" };
    }

    return {
      left: `${(box.x / afterImageSize.width) * 100}%`,
      top: `${(box.y / afterImageSize.height) * 100}%`,
      width: `${(box.w / afterImageSize.width) * 100}%`,
      height: `${(box.h / afterImageSize.height) * 100}%`,
    };
  };

  return (
    <div className="results-page">
      <h1>Results Screen</h1>

      {/* Display a clear summary of the detected changes */}
      <div
        className={`result-status ${
          changesDetected ? "changes-found" : "no-changes"
        }`}
      >
        <FaCheckCircle />

        <div>
          <h2>
            {changesDetected
              ? `Changes detected: ${numberOfChanges}`
              : "No changes detected"}
          </h2>

          <p>
            {changesDetected
              ? "Suspicious areas are highlighted in red on the after image."
              : "No significant differences were found between the images."}
          </p>
        </div>
      </div>

      <div className="images-grid">
        <div>
          <h3>Before Image (Old State)</h3>

          <img
            className="result-image"
            src={beforeImage}
            alt="Before inspection"
          />
        </div>

        <div>
          <h3>After Image (New State)</h3>

          <div className="after-image-wrapper">
            <img
              className="result-image"
              src={afterImage}
              alt="After inspection"
              onLoad={(event) => {
                // Save the original image dimensions after it loads
                setAfterImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
            />

            {/* Draw every detected bounding box over the after image */}
            {detectedChanges.map((box, index) => (
              <div
                key={`${box.x}-${box.y}-${index}`}
                className="red-box"
                style={getBoxStyle(box)}
                aria-label={`Detected change ${index + 1}`}
              >
                <span className="box-number">{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Explain the meaning of the red overlay */}
      {changesDetected && (
        <div className="legend">
          <span className="legend-box"></span>
          Detected changes are highlighted in red.
        </div>
      )}
    </div>
  );
}

export default Results;