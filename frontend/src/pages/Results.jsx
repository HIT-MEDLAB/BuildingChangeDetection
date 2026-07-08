import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";
import api from "../api";
import "./Results.css";

function Results() {
  const location = useLocation();
  const { id } = useParams();

  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const beforeImage = location.state?.beforePreview;
  const afterImage = location.state?.afterPreview;

  useEffect(() => {
    const fetchInspection = async () => {
      try {
        const response = await api.get(`/api/inspections/${id}`);
        setInspection(response.data);
      } catch (err) {
        setError("Failed to load inspection results.");
      } finally {
        setLoading(false);
      }
    };

    fetchInspection();
  }, [id]);

  if (loading) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>
        <p>Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>
        <p className="upload-error">{error}</p>
      </div>
    );
  }

  if (!beforeImage || !afterImage) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>
        <p>No image previews available. Please open results after uploading images.</p>
      </div>
    );
  }

  const changesDetected = inspection?.results?.changesDetected;
  const detectedChanges = inspection?.results?.boundingBoxes || [];

  return (
    <div className="results-page">
      <h1>Results Screen</h1>

      <div className="result-status">
        <FaCheckCircle />
        <div>
          <h2>{changesDetected ? "Change Detected" : "No Change Detected"}</h2>
          <p>
            {changesDetected
              ? "Differences were found between the images."
              : "No significant differences were found between the images."}
          </p>
        </div>
      </div>

      <div className="images-grid">
        <div>
          <h3>Before Image (Old State)</h3>
          <img className="result-image" src={beforeImage} alt="Before" />
        </div>

        <div>
          <h3>After Image (New State)</h3>
          <div className="after-image-wrapper">
            <img className="result-image" src={afterImage} alt="After" />

            {detectedChanges.map((box, index) => (
              <div
                key={index}
                className="red-box"
                style={{
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.width}%`,
                  height: `${box.height}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {detectedChanges.length > 0 && (
        <div className="legend">
          <span></span>
          Detected changes are highlighted in red.
        </div>
      )}
    </div>
  );
}

export default Results;