import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaInfoCircle } from "react-icons/fa";
import api from "../api";
import "./Processing.css";

function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  // Images received from the Upload page.
  // The empty object prevents errors if the page was opened directly.
  const images = location.state || {};

  // Controls the simulated visual progress shown to the user.
  const [progress, setProgress] = useState(20);

  // Describes the current processing step.
  const [currentText, setCurrentText] = useState(
    "Uploading images..."
  );

  // Stores a clear message when processing fails.
  const [error, setError] = useState("");

  useEffect(() => {
    // Stores the next polling timer so it can be cancelled.
    let pollingTimeout;

    // Prevents state updates after the user leaves the page.
    let isActive = true;

    // Stops the polling timer completely.
    const stopPolling = () => {
      if (pollingTimeout) {
        clearTimeout(pollingTimeout);
      }
    };

    // Checks the current inspection status from the backend.
    const checkStatus = async () => {
      // Do not continue if the component is no longer active.
      if (!isActive) {
        return;
      }

      // An inspection ID is required in order to request its status.
      if (!id) {
        setError(
          "The inspection ID is missing. Please upload the images again."
        );
        setCurrentText("Processing stopped.");
        return;
      }

      try {
        const response = await api.get(`/api/inspections/${id}`);
        const inspection = response.data;

        // Stop if the user left the page while the request was running.
        if (!isActive) {
          return;
        }

        // The inspection was completed successfully.
        if (inspection.status === "completed") {
          stopPolling();

          setProgress(100);
          setCurrentText("Preparing results...");

          // Move to the Results page and preserve the uploaded previews.
          navigate(`/results/${id}`, {
            state: {
              ...images,
            },
          });

          return;
        }

        // The ML service or inspection process failed.
        if (inspection.status === "failed") {
          stopPolling();

          setError(
            inspection.error ||
              inspection.error_message ||
              "The analysis failed because the AI service is currently unavailable. Please try uploading the images again."
          );

          setCurrentText("Processing stopped.");
          return;
        }

        // The inspection is still pending or processing.
        // Increase only the visual progress and never reach 100% here.
        setProgress((previousProgress) =>
          Math.min(previousProgress + 20, 90)
        );

        setCurrentText("Detecting suspected changes...");

        // Run the next status check after two seconds.
        pollingTimeout = setTimeout(checkStatus, 2000);
      } catch (err) {
        console.error("Failed to check inspection status:", err);

        // Stop polling when the backend request itself fails.
        stopPolling();

        if (!isActive) {
          return;
        }

        // Use the backend message when available.
        const backendMessage =
          err.response?.data?.message ||
          err.response?.data?.error;

        setError(
          backendMessage ||
            "Unable to check the inspection status. Please try again."
        );

        setCurrentText("Processing stopped.");
      }
    };

    // Begin checking immediately when the page opens.
    checkStatus();

    // Clean up the timer when leaving the page.
    return () => {
      isActive = false;
      stopPolling();
    };
  }, [id, navigate]);

  return (
    <div className="processing-page">
      <div className="processing-card">
        <h1>
          {error ? "Processing Failed" : "Processing Images"}
        </h1>

        <p>
          {error
            ? "The inspection could not be completed."
            : "Please wait while we analyze the changes."}
        </p>

        {/* Display the processing animation only while there is no error. */}
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
                You will be redirected to the results screen
                automatically.
              </span>
            </div>
          </>
        )}

        {/* Display a clear failure message and a way forward. */}
        {error && (
          <div className="processing-error">
            <p>{error}</p>

            <button
              type="button"
              onClick={() => navigate("/upload")}
            >
              Back to Upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Processing;