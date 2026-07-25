import { useEffect, useState } from "react";
import {
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { FaInfoCircle } from "react-icons/fa";
import api from "../api";
import "./Processing.css";

function Processing() {
  // Allows navigation to the Results or Upload page.
  const navigate = useNavigate();

  // Provides access to the image previews passed from Upload.
  const location = useLocation();

  // Gets the inspection ID from the URL.
  const { id } = useParams();

  // Stores the image previews received from the Upload page.
  // The empty object prevents errors when the page is opened directly.
  const images = location.state || {};

  // Controls the visual progress shown to the user.
  const [progress, setProgress] = useState(20);

  // Describes the current processing step.
  const [currentText, setCurrentText] = useState(
    "Uploading images..."
  );

  // Stores a clear, user-friendly processing error.
  const [error, setError] = useState("");

  useEffect(() => {
    // Stores the polling timer so it can be cancelled.
    let pollingTimeout;

    // Prevents state updates after the component is removed.
    let isActive = true;

    // Stops the current polling timer.
    const stopPolling = () => {
      if (pollingTimeout) {
        clearTimeout(pollingTimeout);
      }
    };

    // Checks the current inspection status from the backend.
    const checkStatus = async () => {
      // Stop immediately if the user has already left the page.
      if (!isActive) {
        return;
      }

      // The inspection ID is required to check the status.
      if (!id) {
        setError(
          "The inspection ID is missing. Please upload the images again."
        );
        setCurrentText("Processing stopped.");
        return;
      }

      try {
        const response = await api.get(
          `/api/inspections/${id}`
        );

        const inspection = response.data;

        // Stop if the user left while the request was running.
        if (!isActive) {
          return;
        }

        // Continue to Results after successful completion.
        if (inspection.status === "completed") {
          stopPolling();

          setProgress(100);
          setCurrentText("Preparing results...");

          navigate(`/results/${id}`, {
            state: {
              ...images,
            },
          });

          return;
        }

        // Display a plain-language message when analysis fails.
        if (inspection.status === "failed") {
          stopPolling();

          setError(
            "The inspection could not be completed. Please upload the images again."
          );

          setCurrentText("Processing stopped.");
          return;
        }

        // The inspection is still pending or processing.
        // Increase only the visual progress and keep it below 100%.
        setProgress((previousProgress) =>
          Math.min(previousProgress + 20, 90)
        );

        setCurrentText(
          "Detecting suspected changes..."
        );

        // Check the status again after two seconds.
        pollingTimeout = setTimeout(
          checkStatus,
          2000
        );
      } catch (err) {
        // Keep the full technical error only in the browser console.
        console.error(
          "Failed to check inspection status:",
          err
        );

        stopPolling();

        if (!isActive) {
          return;
        }

        // Display only controlled, user-friendly messages.
        if (err.response?.status === 404) {
          setError(
            "The inspection could not be found. Please upload the images again."
          );
        } else if (err.response?.status === 403) {
          setError(
            "You do not have permission to view this inspection."
          );
        } else {
          setError(
            "We could not check the inspection status. Please try again."
          );
        }

        setCurrentText("Processing stopped.");
      }
    };

    // Begin checking the status immediately.
    checkStatus();

    // Cancel polling and prevent updates after leaving the page.
    return () => {
      isActive = false;
      stopPolling();
    };
  }, [id, navigate, images]);

  return (
    <div className="processing-page">
      <div className="processing-card">
        <h1>
          {error
            ? "Processing Failed"
            : "Processing Images"}
        </h1>

        <p>
          {error
            ? "The inspection could not be completed."
            : "Please wait while we analyze the changes."}
        </p>

        {/* Display the animation only while processing is active. */}
        {!error && (
          <>
            <div
              className="loader-ring"
              style={{
                "--progress": `${progress}%`,
              }}
            >
              <span>{progress}%</span>
            </div>

            <h2>Analyzing...</h2>

            <p className="step-text">
              {currentText}
            </p>

            <div className="progress-bar">
              <div
                style={{
                  width: `${progress}%`,
                }}
              ></div>
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

        {/* Display the error and a clear next step. */}
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