import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { FaCheckCircle, FaDownload } from "react-icons/fa";
import api from "../api";
import "./Results.css";

function Results() {
  // Allows access to information passed from the Processing page.
  const location = useLocation();

  // Allows navigation to another page.
  const navigate = useNavigate();

  // Gets the inspection ID from the page URL.
  // Example: /results/15
  const { id } = useParams();

  // Stores the inspection information received from the backend.
  const [inspection, setInspection] = useState(null);

  // Indicates whether the inspection data is still loading.
  const [loading, setLoading] = useState(true);

  // Stores an error message if loading the inspection fails.
  const [error, setError] = useState("");

  // Indicates whether the PDF report is currently being downloaded.
  const [reportLoading, setReportLoading] = useState(false);

  // Stores a separate error message for PDF report downloads.
  const [reportError, setReportError] = useState("");

  // Stores the case status selected by the inspector.
  const [selectedCaseStatus, setSelectedCaseStatus] =
    useState("under_review");

  // Indicates whether the case status is currently being saved.
  const [caseStatusLoading, setCaseStatusLoading] =
    useState(false);

  // Stores a success message after updating the case status.
  const [caseStatusSuccess, setCaseStatusSuccess] =
    useState("");

  // Stores an error message if updating the case status fails.
  const [caseStatusError, setCaseStatusError] = useState("");

  // Stores the original dimensions of the After image.
  // These dimensions are used to convert bounding-box coordinates
  // from pixels into percentages.
  const [afterImageSize, setAfterImageSize] = useState({
    width: 0,
    height: 0,
  });

  // Gets the local image previews passed from the Processing page.
  const beforeImage = location.state?.beforePreview;
  const afterImage = location.state?.afterPreview;

  useEffect(() => {
    // Prevents state updates after the component is removed.
    let isActive = true;

    // Loads the inspection information from the backend.
    const fetchInspection = async () => {
      // An inspection ID is required to load the results.
      if (!id) {
        setError(
          "The inspection ID is missing. Please upload the images again."
        );
        setLoading(false);
        return;
      }

      try {
        // Starts the loading state and clears previous errors.
        setLoading(true);
        setError("");

        // Sends a GET request to load the inspection details.
        const response = await api.get(
          `/api/inspections/${id}`
        );

        // Stops if the user left the page while the request was running.
        if (!isActive) {
          return;
        }

        // Uses an empty object if the backend returns no response body.
        const inspectionData = response.data || {};

        // Stores the inspection information.
        setInspection(inspectionData);

        // Displays the saved case status.
        // Uses Under Review as the default value.
        setSelectedCaseStatus(
          inspectionData.caseStatus || "under_review"
        );
      } catch (err) {
        // Logs the full error for development and debugging.
        console.error("Failed to load inspection:", err);

        if (!isActive) {
          return;
        }

        // Uses a backend error message when one is available.
        if (err.response?.status === 404) {
          setError("The inspection could not be found.");
        } else if (err.response?.status === 403) {
          setError(
            "You do not have permission to view this inspection."
          );
        } else {
          setError(
            "We could not load the inspection results. Please try again."
          );
        }
      } finally {
        // Ends the loading state only while the component is active.
        if (isActive) {
          setLoading(false);
        }
      }
    };

    // Loads the inspection whenever its ID changes.
    fetchInspection();

    // Prevents updates after leaving the page.
    return () => {
      isActive = false;
    };
  }, [id]);

  // Updates the case classification in the backend.
  const handleUpdateCaseStatus = async () => {
    try {
      // Starts the saving state and clears previous messages.
      setCaseStatusLoading(true);
      setCaseStatusSuccess("");
      setCaseStatusError("");

      // Sends the selected case status to the backend.
      const response = await api.patch(
        `/api/inspections/${id}/status`,
        {
          caseStatus: selectedCaseStatus,
        }
      );

      // Uses the selected value if the backend does not return it.
      const updatedCaseStatus =
        response.data?.caseStatus || selectedCaseStatus;

      // Updates the local inspection information.
      setInspection((currentInspection) => ({
        ...currentInspection,
        caseStatus: updatedCaseStatus,
      }));

      // Keeps the select value synchronized with the saved value.
      setSelectedCaseStatus(updatedCaseStatus);

      // Displays a success message.
      setCaseStatusSuccess(
        "Case status updated successfully."
      );
    } catch (err) {
      // Logs the error for development and debugging.
      console.error("Failed to update case status:", err);

      // Displays an appropriate message based on the response status.
      if (err.response?.status === 400) {
        setCaseStatusError(
            "The selected case status is not valid."
        );
      } else if (err.response?.status === 403) {
        setCaseStatusError(
          "You do not have permission to update this case."
        );
      } else if (err.response?.status === 404) {
        setCaseStatusError("Inspection not found.");
      } else {
        setCaseStatusError(
          "Failed to update the case status. Please try again."
        );
      }
    } finally {
      // Ends the case-status saving state.
      setCaseStatusLoading(false);
    }
  };

  // Downloads the inspection summary report as a PDF file.
  const handleDownloadReport = async () => {
    try {
      // Starts the download state and clears previous errors.
      setReportLoading(true);
      setReportError("");

      // Requests the PDF report from the backend.
      // The blob response type is required because the response is a file.
      const response = await api.get(`/api/report/${id}`, {
        responseType: "blob",
      });

      // Creates a Blob object that represents the PDF file.
      const pdfBlob = new Blob([response.data], {
        type: "application/pdf",
      });

      // Creates a temporary browser URL for the PDF.
      const downloadUrl =
        window.URL.createObjectURL(pdfBlob);

      // Creates a temporary link element for the download.
      const link = document.createElement("a");

      // Sets the temporary file URL.
      link.href = downloadUrl;

      // Defines the downloaded file name.
      link.download =
        `inspection-${id}-summary-report.pdf`;

      // Adds the temporary link to the page.
      document.body.appendChild(link);

      // Starts the file download.
      link.click();

      // Removes the temporary link from the page.
      link.remove();

      // Releases the temporary URL from browser memory.
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      // Logs the error for development and debugging.
      console.error("Failed to download report:", err);

      // Displays an appropriate download error message.
      if (err.response?.status === 404) {
        setReportError(
          "The report is not available for this inspection."
        );
      } else if (err.response?.status === 403) {
        setReportError(
          "You do not have permission to download this report."
        );
      } else {
        setReportError(
          "Failed to download the summary report. Please try again."
        );
      }
    } finally {
      // Ends the PDF download state.
      setReportLoading(false);
    }
  };

  // Converts the technical case-status value into a readable label.
  const getCaseStatusLabel = (caseStatus) => {
    if (caseStatus === "confirmed") {
      return "Confirmed";
    }

    if (caseStatus === "dismissed") {
      return "Dismissed";
    }

    return "Under Review";
  };

  // Displays a loading message while waiting for the backend.
  if (loading) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>

        <p className="results-message">
          Loading results...
        </p>
      </div>
    );
  }

  // Displays an error if the inspection request failed.
  if (error) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>

        <p className="upload-error">{error}</p>

        <button
          type="button"
          onClick={() => navigate("/upload")}
        >
          Back to Upload
        </button>
      </div>
    );
  }

  // Handles a missing inspection response safely.
  if (!inspection) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>

        <p className="results-message">
          The inspection information is not available.
        </p>

        <button
          type="button"
          onClick={() => navigate("/upload")}
        >
          Back to Upload
        </button>
      </div>
    );
  }

  // Handles an inspection that failed during ML processing.
  // This prevents the page from trying to read missing result data.
  if (inspection.status === "failed") {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>

        <p className="upload-error">
          The inspection could not be completed because the
          analysis failed. Please upload the images again.
        </p>

        <button
          type="button"
          onClick={() => navigate("/upload")}
        >
          Back to Upload
        </button>
      </div>
    );
  }

  // Handles an inspection that is still pending or processing.
  if (
    inspection.status === "pending" ||
    inspection.status === "processing"
  ) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>

        <p className="results-message">
          The inspection is still being processed.
        </p>
      </div>
    );
  }

  // Handles a completed inspection that has no result object.
  // This prevents errors such as reading properties from undefined.
  if (!inspection.results) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>

        <p className="results-message">
          No inspection results are available because the
          analysis did not return result data.
        </p>

        <button
          type="button"
          onClick={() => navigate("/upload")}
        >
          Back to Upload
        </button>
      </div>
    );
  }

  // Uses an empty array if bounding-box data is missing or invalid.
  // This allows the page to display "No changes detected"
  // instead of crashing.
  const detectedChanges = Array.isArray(
    inspection.results.boundingBoxes
  )
    ? inspection.results.boundingBoxes
    : [];

  // Counts the number of detected areas.
  const numberOfChanges = detectedChanges.length;

  // Determines whether at least one change was detected.
  const changesDetected = numberOfChanges > 0;

  // The current view uses image previews passed from Processing.
  // A clear message is displayed if the previews are unavailable.
  if (!beforeImage || !afterImage) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>

        <p className="results-message">
          No image previews are available. Please open the
          results immediately after uploading the images.
        </p>

        <button
          type="button"
          onClick={() => navigate("/upload")}
        >
          Back to Upload
        </button>
      </div>
    );
  }

  // Converts bounding-box coordinates from pixels into percentages.
  // This keeps each box aligned when the image changes size.
  const getBoxStyle = (box) => {
    // Hides the box until the original image dimensions are known.
    if (!afterImageSize.width || !afterImageSize.height) {
      return {
        display: "none",
      };
    }

    // Uses zero as a safe fallback for missing box values.
    const boxX = Number(box?.x) || 0;
    const boxY = Number(box?.y) || 0;
    const boxWidth = Number(box?.w) || 0;
    const boxHeight = Number(box?.h) || 0;

    // Calculates the relative box position and size.
    return {
      left: `${(boxX / afterImageSize.width) * 100}%`,
      top: `${(boxY / afterImageSize.height) * 100}%`,
      width: `${
        (boxWidth / afterImageSize.width) * 100
      }%`,
      height: `${
        (boxHeight / afterImageSize.height) * 100
      }%`,
    };
  };

  return (
    <div className="results-page">
      {/* Page title */}
      <h1>Results Screen</h1>

      {/* Displays a summary of the detected changes */}
      <div
        className={`result-status ${
          changesDetected
            ? "changes-found"
            : "no-changes"
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

      {/* Allows the inspector to classify the case */}
      <div className="case-classification">
        <label htmlFor="case-status">
          Case Status
        </label>

        <div className="case-classification-controls">
          <select
            id="case-status"
            value={selectedCaseStatus}
            onChange={(event) => {
              // Stores the newly selected value.
              setSelectedCaseStatus(event.target.value);

              // Clears previous messages after a new selection.
              setCaseStatusSuccess("");
              setCaseStatusError("");
            }}
            disabled={caseStatusLoading}
          >
            <option value="under_review">
              Under Review
            </option>

            <option value="confirmed">
              Confirmed
            </option>

            <option value="dismissed">
              Dismissed
            </option>
          </select>

          <button
            type="button"
            className="update-case-status-button"
            onClick={handleUpdateCaseStatus}
            disabled={
              caseStatusLoading ||
              selectedCaseStatus ===
                (inspection.caseStatus || "under_review")
            }
          >
            {caseStatusLoading
              ? "Updating..."
              : "Update Status"}
          </button>
        </div>

        {/* Displays the case status currently stored in the backend */}
        <p className="current-case-status">
          Current status:{" "}
          <strong>
            {getCaseStatusLabel(
              inspection.caseStatus
            )}
          </strong>
        </p>

        {/* Displays a success message after updating the status */}
        {caseStatusSuccess && (
          <p
            className="case-status-success"
            role="status"
          >
            {caseStatusSuccess}
          </p>
        )}

        {/* Displays an error if updating the status fails */}
        {caseStatusError && (
          <p
            className="case-status-error"
            role="alert"
          >
            {caseStatusError}
          </p>
        )}
      </div>

      {/* PDF report actions */}
      <div className="report-actions">
        <button
          type="button"
          className="download-report-button"
          onClick={handleDownloadReport}
          disabled={reportLoading}
        >
          <FaDownload />

          <span>
            {reportLoading
              ? "Preparing Report..."
              : "Download Summary Report"}
          </span>
        </button>

        {/* Displays an error only when the report download fails */}
        {reportError && (
          <p className="report-error" role="alert">
            {reportError}
          </p>
        )}
      </div>

      {/* Displays the Before and After images side by side */}
      <div className="images-grid">
        <div className="image-section">
          <h3>Before Image (Old State)</h3>

          <img
            className="result-image"
            src={beforeImage}
            alt="Before inspection"
          />
        </div>

        <div className="image-section">
          <h3>After Image (New State)</h3>

          {/* Relative wrapper used to place boxes over the image */}
          <div className="after-image-wrapper">
            <img
              className="result-image"
              src={afterImage}
              alt="After inspection"
              onLoad={(event) => {
                // Stores the image's original dimensions.
                setAfterImageSize({
                  width:
                    event.currentTarget.naturalWidth,
                  height:
                    event.currentTarget.naturalHeight,
                });
              }}
            />

            {/* Draws one red rectangle for each detected change */}
            {detectedChanges.map((box, index) => (
              <div
                key={`${box?.x}-${box?.y}-${index}`}
                className="red-box"
                style={getBoxStyle(box)}
                aria-label={`Detected change ${
                  index + 1
                }`}
              >
                {/* Displays the number of the detected area */}
                <span className="box-number">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Explains the meaning of the red rectangles */}
      {changesDetected && (
        <div className="legend">
          <span className="legend-box"></span>

          <span>
            Detected changes are highlighted in red.
          </span>
        </div>
      )}
    </div>
  );
}

export default Results;