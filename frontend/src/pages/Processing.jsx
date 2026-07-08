import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaInfoCircle } from "react-icons/fa";
import api from "../api";
import "./Processing.css";

function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  // Images and inspectionId received from the Upload page
  const images = location.state;

  const [progress, setProgress] = useState(20);
  const [currentText, setCurrentText] = useState("Uploading images...");

  useEffect(() => {
    // Polling: ask the backend for the inspection status every 2 seconds
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/api/inspections/${id}`);
        const inspection = response.data;

        if (inspection.status === "completed") {
          clearInterval(interval);
          setProgress(100);
          setCurrentText("Preparing results...");

          navigate("/results", {
            state: {
              ...images,
              result: inspection.results?.changesDetected
                ? "Change Detected"
                : "No Change Detected",
              detectedChanges: inspection.results?.boundingBoxes || [],
            },
          });
        } else {
          setProgress((prev) => Math.min(prev + 20, 90));
          setCurrentText("Detecting suspected changes...");
        }
      } catch (err) {
        clearInterval(interval);
        setCurrentText("Processing failed. Please try again.");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [id, navigate, images]);

  return (
    <div className="processing-page">
      <div className="processing-card">
        <h1>Processing Images</h1>
        <p>Please wait while we analyze the changes.</p>

        <div className="loader-ring" style={{ "--progress": `${progress}%` }}>
          <span>{progress}%</span>
        </div>

        <h2>Analyzing...</h2>
        <p className="step-text">{currentText}</p>

        <div className="progress-bar">
          <div style={{ width: `${progress}%` }}></div>
        </div>

        <div className="processing-info">
          <FaInfoCircle />
          <span>You will be redirected to the results screen automatically.</span>
        </div>
      </div>
    </div>
  );
}

export default Processing;