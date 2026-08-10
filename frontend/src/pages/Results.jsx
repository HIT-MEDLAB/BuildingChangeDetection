import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  FaCheckCircle,
  FaDownload,
} from "react-icons/fa";
import api from "../api";
import "./Results.css";

// Backend base URL used for displaying images stored on the server.
// If VITE_API_URL exists, it is used.
// Otherwise, the local backend address is used.
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000";

// Converts an image path returned by the backend into a valid browser URL.
const buildImageUrl = (imagePath) => {
  // Returns an empty string when no image path exists.
  if (!imagePath) {
    return "";
  }

  // If the backend already returned a complete URL,
  // there is no need to add the backend base URL.
  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("blob:") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }

  // Removes a trailing slash from the base URL.
  const normalizedBaseUrl =
    API_BASE_URL.replace(/\/$/, "");

  // Removes a leading slash from the image path.
  const normalizedImagePath =
    imagePath.replace(/^\//, "");

  return `${normalizedBaseUrl}/${normalizedImagePath}`;
};

function Results() {
  // Allows access to information passed from the Processing page.
  const location = useLocation();

  // Allows navigation to another page.
  const navigate = useNavigate();

  // Gets the inspection ID from the page URL.
  const { id } = useParams();

  // Stores the inspection information received from the backend.
  const [inspection, setInspection] =
    useState(null);

  // Indicates whether the inspection data is still loading.
  const [loading, setLoading] =
    useState(true);

  // Stores an error message if loading the inspection fails.
  const [error, setError] = useState("");

  // Indicates whether the PDF report is currently being downloaded.
  const [reportLoading, setReportLoading] =
    useState(false);

  // Stores a separate error message for PDF report downloads.
  const [reportError, setReportError] =
    useState("");

  // Stores the case status selected by the inspector.
  const [
    selectedCaseStatus,
    setSelectedCaseStatus,
  ] = useState("under_review");

  // Stores the inspector's note.
  const [caseNote, setCaseNote] =
    useState("");

  // Stores the last saved inspector's note.
  const [savedCaseNote, setSavedCaseNote] =
    useState("");

  // Indicates whether the case status is currently being saved.
  const [
    caseStatusLoading,
    setCaseStatusLoading,
  ] = useState(false);

  // Stores a success message after updating the case status.
  const [
    caseStatusSuccess,
    setCaseStatusSuccess,
  ] = useState("");

  // Stores an error message if updating the case status fails.
  const [
    caseStatusError,
    setCaseStatusError,
  ] = useState("");

  // Stores the original dimensions of the After image.
  // These dimensions are used to convert bounding-box coordinates
  // from pixels into percentages.
  const [
    afterImageSize,
    setAfterImageSize,
  ] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    // Prevents state updates after the component is removed.
    let isActive = true;

    // Loads the inspection information from the backend.
    const fetchInspection = async () => {
      if (!id) {
        setError(
          "The inspection ID is missing. Please upload the images again."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/api/inspections/${id}`
        );

        if (!isActive) {
          return;
        }

        const inspectionData =
          response.data || {};

        setInspection(inspectionData);

        const savedCaseStatus =
          inspectionData.caseStatus ||
          inspectionData.case_status ||
          "under_review";

        setSelectedCaseStatus(
          savedCaseStatus
        );

        const loadedNote =
          inspectionData.notes || "";

        setCaseNote(loadedNote);
        setSavedCaseNote(loadedNote);
      } catch (err) {
        console.error(
          "Failed to load inspection:",
          err
        );

        if (!isActive) {
          return;
        }

        if (
          err.response?.status === 404
        ) {
          setError(
            "The inspection could not be found."
          );
        } else if (
          err.response?.status === 403
        ) {
          setError(
            "You do not have permission to view this inspection."
          );
        } else {
          setError(
            "We could not load the inspection results. Please try again."
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchInspection();

    return () => {
      isActive = false;
    };
  }, [id]);

  // Updates the case classification in the backend.
  const handleUpdateCaseStatus =
    async () => {
      try {
        setCaseStatusLoading(true);
        setCaseStatusSuccess("");
        setCaseStatusError("");

        const response = await api.patch(
          `/api/inspections/${id}/status`,
          {
            caseStatus:
              selectedCaseStatus,
            note: caseNote,
          }
        );

        const updatedCaseStatus =
          response.data?.caseStatus ||
          response.data?.case_status ||
          selectedCaseStatus;

        const updatedNote =
          response.data?.notes ??
          caseNote;

        setInspection(
          (currentInspection) => ({
            ...currentInspection,
            caseStatus:
              updatedCaseStatus,
            case_status:
              updatedCaseStatus,
            notes: updatedNote,
          })
        );

        setSelectedCaseStatus(
          updatedCaseStatus
        );
        setCaseNote(updatedNote);
        setSavedCaseNote(updatedNote);

        setCaseStatusSuccess(
          "Case status and note updated successfully."
        );
      } catch (err) {
        console.error(
          "Failed to update case status:",
          err
        );

        if (
          err.response?.status === 400
        ) {
          setCaseStatusError(
            "The selected case status is not valid."
          );
        } else if (
          err.response?.status === 403
        ) {
          setCaseStatusError(
            "You do not have permission to update this case."
          );
        } else if (
          err.response?.status === 404
        ) {
          setCaseStatusError(
            "Inspection not found."
          );
        } else {
          setCaseStatusError(
            "Failed to update the case status. Please try again."
          );
        }
      } finally {
        setCaseStatusLoading(false);
      }
    };

  // Downloads the inspection summary report as a PDF file.
  const handleDownloadReport =
    async () => {
      try {
        setReportLoading(true);
        setReportError("");

        const response = await api.get(
          `/api/report/${id}`,
          {
            responseType: "blob",
          }
        );

        const pdfBlob = new Blob(
          [response.data],
          {
            type: "application/pdf",
          }
        );

        const downloadUrl =
          window.URL.createObjectURL(
            pdfBlob
          );

        const link =
          document.createElement("a");

        link.href = downloadUrl;

        link.download =
          `inspection-${id}-summary-report.pdf`;

        document.body.appendChild(link);

        link.click();

        link.remove();

        window.URL.revokeObjectURL(
          downloadUrl
        );
      } catch (err) {
        console.error(
          "Failed to download report:",
          err
        );

        if (
          err.response?.status === 404
        ) {
          setReportError(
            "The report is not available for this inspection."
          );
        } else if (
          err.response?.status === 403
        ) {
          setReportError(
            "You do not have permission to download this report."
          );
        } else {
          setReportError(
            "Failed to download the summary report. Please try again."
          );
        }
      } finally {
        setReportLoading(false);
      }
    };

  // Converts the technical case-status value into a readable label.
  const getCaseStatusLabel = (
    caseStatus
  ) => {
    if (
      caseStatus === "confirmed"
    ) {
      return "Confirmed";
    }

    if (
      caseStatus === "dismissed"
    ) {
      return "Dismissed";
    }

    return "Under Review";
  };

  // Displays a loading message while waiting for the backend.
  if (loading) {
    return (
      <div
        className="results-page"
        data-testid="results-screen"
      >
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
      <div
        className="results-page"
        data-testid="results-screen"
      >
        <h1>Results Screen</h1>

        <p className="upload-error">
          {error}
        </p>

        <button
          type="button"
          onClick={() =>
            navigate("/upload")
          }
        >
          Back to Upload
        </button>
      </div>
    );
  }

  // Handles a missing inspection response safely.
  if (!inspection) {
    return (
      <div
        className="results-page"
        data-testid="results-screen"
      >
        <h1>Results Screen</h1>

        <p className="results-message">
          The inspection information is not available.
        </p>

        <button
          type="button"
          onClick={() =>
            navigate("/history")
          }
        >
          Back to History
        </button>
      </div>
    );
  }

  // Handles an inspection that failed during ML processing.
  if (
    inspection.status === "failed"
  ) {
    return (
      <div
        className="results-page"
        data-testid="results-screen"
      >
        <h1>Results Screen</h1>

        <p className="upload-error">
          The inspection could not be
          completed because the analysis
          failed. Please upload the images
          again.
        </p>

        <button
          type="button"
          onClick={() =>
            navigate("/upload")
          }
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
      <div
        className="results-page"
        data-testid="results-screen"
      >
        <h1>Results Screen</h1>

        <p className="results-message">
          The inspection is still being processed.
        </p>

        <button
          type="button"
          onClick={() =>
            navigate("/history")
          }
        >
          Back to History
        </button>
      </div>
    );
  }

  // Supports result data returned either inside "results"
  // or directly on the inspection object.
  const inspectionResults =
    inspection.results ||
    inspection.result ||
    null;

  // Handles a completed inspection that has no result object.
  if (!inspectionResults) {
    return (
      <div
        className="results-page"
        data-testid="results-screen"
      >
        <h1>Results Screen</h1>

        <p className="results-message">
          No inspection results are available
          because the analysis did not return
          result data.
        </p>

        <button
          type="button"
          onClick={() =>
            navigate("/history")
          }
        >
          Back to History
        </button>
      </div>
    );
  }

  // Supports bounding boxes in both camelCase and snake_case.
  const boundingBoxes =
    inspectionResults.boundingBoxes ||
    inspectionResults.bounding_boxes ||
    [];

  // Uses an empty array if bounding-box data is missing or invalid.
  const detectedChanges =
    Array.isArray(boundingBoxes)
      ? boundingBoxes
      : [];

  // Counts the number of detected areas.
  const numberOfChanges =
    detectedChanges.length;

  // Determines whether at least one change was detected.
  const changesDetected =
    numberOfChanges > 0;

  // Uses the local preview when Results is opened immediately
  // after Processing.
  const beforeImage =
    location.state?.beforePreview ||
    buildImageUrl(
      inspection.images?.before ||
        inspection.image_before_path ||
        inspection.imageBeforePath ||
        inspection.beforeImagePath
    );

  // Uses the local preview when Results is opened immediately
  // after Processing.
  const afterImage =
    location.state?.afterPreview ||
    buildImageUrl(
      inspection.images?.after ||
        inspection.image_after_path ||
        inspection.imageAfterPath ||
        inspection.afterImagePath
    );

  // Loads the server-generated processed image.
  const processedImage =
    buildImageUrl(
      inspection.images?.processed ||
        inspection.processed_image_path ||
        inspection.processedImagePath
    );

  // Prefers the processed image generated by the server.
  const resultImage =
    processedImage || afterImage;

  // Displays a clear message only when neither local previews
  // nor backend image paths are available.
  if (
    !beforeImage ||
    !resultImage
  ) {
    return (
      <div
        className="results-page"
        data-testid="results-screen"
      >
        <h1>Results Screen</h1>

        <p className="results-message">
          The inspection images are not available.
        </p>

        <button
          type="button"
          onClick={() =>
            navigate("/history")
          }
        >
          Back to History
        </button>
      </div>
    );
  }

  // Converts bounding-box coordinates from pixels into percentages.
  // This keeps each box aligned when the image changes size.
  const getBoxStyle = (box) => {
    // Hides the box until the original image dimensions are known.
    if (
      !afterImageSize.width ||
      !afterImageSize.height
    ) {
      return {
        display: "none",
      };
    }

    // Supports both width/height naming styles.
    const boxX =
      Number(box?.x) || 0;

    const boxY =
      Number(box?.y) || 0;

    const boxWidth =
      Number(
        box?.w ?? box?.width
      ) || 0;

    const boxHeight =
      Number(
        box?.h ?? box?.height
      ) || 0;

    return {
      left: `${
        (boxX /
          afterImageSize.width) *
        100
      }%`,
      top: `${
        (boxY /
          afterImageSize.height) *
        100
      }%`,
      width: `${
        (boxWidth /
          afterImageSize.width) *
        100
      }%`,
      height: `${
        (boxHeight /
          afterImageSize.height) *
        100
      }%`,
    };
  };

  // Gets the current saved case status.
  const currentCaseStatus =
    inspection.caseStatus ||
    inspection.case_status ||
    "under_review";

  return (
    <div
      className="results-page"
      data-testid="results-screen"
    >
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
            data-testid="case-status-select"
            value={
              selectedCaseStatus
            }
            onChange={(event) => {
              setSelectedCaseStatus(
                event.target.value
              );
              setCaseStatusSuccess("");
              setCaseStatusError("");
            }}
            disabled={
              caseStatusLoading
            }
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
            data-testid="update-status-button"
            type="button"
            className="update-case-status-button"
            onClick={
              handleUpdateCaseStatus
            }
            disabled={
              caseStatusLoading ||
              (
                selectedCaseStatus ===
                  currentCaseStatus &&
                caseNote ===
                  savedCaseNote
              )
            }
          >
            {caseStatusLoading
              ? "Updating..."
              : "Update Status"}
          </button>
        </div>

        <label
          htmlFor="case-note"
          style={{
            marginTop: "16px",
            display: "block",
          }}
        >
          Case Note
        </label>

        <textarea
          id="case-note"
          data-testid="case-note"
          value={caseNote}
          onChange={(event) => {
            setCaseNote(
              event.target.value
            );
            setCaseStatusSuccess("");
            setCaseStatusError("");
          }}
          rows={3}
          maxLength={300}
          placeholder="Enter a short note..."
          disabled={caseStatusLoading}
          style={{
            width: "100%",
            marginTop: "8px",
            marginBottom: "12px",
          }}
        />

        <p className="current-case-status">
          Current status:{" "}
          <strong>
            {getCaseStatusLabel(
              currentCaseStatus
            )}
          </strong>
        </p>

        {caseStatusSuccess && (
          <p
            className="case-status-success"
            role="status"
          >
            {caseStatusSuccess}
          </p>
        )}

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
          data-testid="download-report-button"
          type="button"
          className="download-report-button"
          onClick={
            handleDownloadReport
          }
          disabled={reportLoading}
        >
          <FaDownload />

          <span>
            {reportLoading
              ? "Preparing Report..."
              : "Download Summary Report"}
          </span>
        </button>

        {reportError && (
          <p
            className="report-error"
            role="alert"
          >
            {reportError}
          </p>
        )}
      </div>

      {/* Displays the Before and After images side by side */}
      <div className="images-grid">
        <div className="image-section">
          <h3>
            Before Image (Old State)
          </h3>

          <img
            data-testid="results-before-image"
            className="result-image"
            src={beforeImage}
            alt="Before inspection"
          />
        </div>

        <div className="image-section">
          <h3>
            {processedImage
              ? "Processed Result Image"
              : "After Image (New State)"}
          </h3>

          <div
            className="after-image-wrapper"
            data-testid="results-overlay"
          >
            <img
              data-testid="results-processed-image"
              className="result-image"
              src={resultImage}
              alt={
                processedImage
                  ? "Processed inspection result"
                  : "After inspection"
              }
              onLoad={(event) => {
                setAfterImageSize({
                  width:
                    event.currentTarget
                      .naturalWidth,
                  height:
                    event.currentTarget
                      .naturalHeight,
                });
              }}
            />

            {/*
              The processed image already contains
              the change markings.
              Bounding boxes are drawn only for older
              inspections without a processed image.
            */}
            {!processedImage &&
              detectedChanges.map(
                (box, index) => (
                  <div
                    key={`${box?.x}-${box?.y}-${index}`}
                    className="red-box"
                    style={
                      getBoxStyle(box)
                    }
                    aria-label={`Detected change ${
                      index + 1
                    }`}
                  >
                    <span className="box-number">
                      {index + 1}
                    </span>
                  </div>
                )
              )}
          </div>
        </div>
      </div>

      {/*
        Displays the browser-overlay legend only when the page
        uses the original After image as a fallback.
      */}
      {changesDetected &&
        !processedImage && (
          <div className="legend">
            <span className="legend-box" />

            <span>
              Detected changes are highlighted in red.
            </span>
          </div>
        )}
    </div>
  );
}

export default Results;