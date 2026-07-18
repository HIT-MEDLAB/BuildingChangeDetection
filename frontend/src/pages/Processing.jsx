import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaInfoCircle } from "react-icons/fa";
import api from "../api";
import "./Processing.css";

function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  // Images received from the Upload page
  const images = location.state;

  // Progress bar and processing status
  const [progress, setProgress] = useState(20);
  const [currentText, setCurrentText] = useState("Uploading images...");
  const [error, setError] = useState("");

  useEffect(() => {
    let interval;

    // Poll the backend every 2 seconds until the inspection is completed
    const checkStatus = async () => {
      try {
        const response = await api.get(`/api/inspections/${id}`);
        const inspection = response.data;

        // Inspection finished successfully
        if (inspection.status === "completed") {
          clearInterval(interval);
          setProgress(100);
          setCurrentText("Preparing results...");

          navigate(`/results/${id}`, {
            state: {
              ...images,
            },
          });

          return;
        }

        // Stop polling if the inspection failed
        if (inspection.status === "failed") {
          clearInterval(interval);
          setError("Inspection failed. Please upload the images again.");
          setCurrentText("Processing stopped.");
          return;
        }

        // Update the progress while the inspection is still running
        setProgress((previousProgress) =>
          Math.min(previousProgress + 20, 90)
        );
        setCurrentText("Detecting suspected changes...");
      } catch (err) {
        console.error("Failed to check inspection status:", err);

        // Stop polling if the backend cannot be reached
        clearInterval(interval);
        setError("Unable to check the inspection status. Please try again.");
        setCurrentText("Processing stopped.");
      }
    };

    // Start polling immediately and continue every 2 seconds
    checkStatus();
    interval = setInterval(checkStatus, 2000);

    // Clean up the polling interval when leaving the page
    return () => clearInterval(interval);
  }, [id, navigate, images]);

  return (
    <div className="processing-page">
      <div className="processing-card">
        <h1>{error ? "Processing Failed" : "Processing Images"}</h1>

        <p>
          {error
            ? "The inspection could not be completed."
            : "Please wait while we analyze the changes."}
        </p>

        {/* Show the progress indicator only while processing */}
        {!error && (
          <>
            <div
              className="loader-ring"
              style={{ "--progress": `${progress}%` }}
            >
              <span>{progress}%</span>
            </div>

            <h2>Analyzing...</h2>

            <p className="step-text">{currentText}</p>

            <div className="progress-bar">
              <div style={{ width: `${progress}%` }}></div>
            </div>

            <div className="processing-info">
              <FaInfoCircle />
              <span>
                You will be redirected to the results screen automatically.
              </span>
            </div>
          </>
        )}

        {/* Show an error message and allow the user to retry */}
        {error && (
          <div className="processing-error">
            <p>{error}</p>

            <button type="button" onClick={() => navigate("/upload")}>
              Back to Upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Processing;