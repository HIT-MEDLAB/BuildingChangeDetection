import { useEffect, useState } from "react";
import { FaDownload } from "react-icons/fa";
import api from "../api";
import "./History.css";

// Backend base URL.
// If VITE_API_URL exists in the .env file, it will be used.
// Otherwise, the local backend server on port 3000 will be used.
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function History() {
  // Controls the sorting order of the inspection history.
  // The default order displays the newest inspections first.
  const [sortOrder, setSortOrder] = useState("newest");

  // Stores the inspection history received from the backend.
  const [history, setHistory] = useState([]);

  // Indicates whether the inspection history is still loading.
  const [loading, setLoading] = useState(true);

  // Stores an error message if loading the history fails.
  const [error, setError] = useState("");

  // Stores the ID of the inspection whose report is being downloaded.
  const [downloadingReportId, setDownloadingReportId] =
    useState(null);

  // Stores the ID of the inspection whose report download failed.
  const [reportErrorId, setReportErrorId] = useState(null);

  // Stores the PDF report download error message.
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    // Prevents state updates after the component is removed.
    let isActive = true;

    // Loads the inspection history from the backend.
    const fetchHistory = async () => {
      try {
        // Starts the loading state and clears previous errors.
        setLoading(true);
        setError("");

        // Sends a GET request for the user's inspections.
        const response = await api.get("/api/inspections");

        // Supports both possible backend response structures:
        // { inspections: [...] } or a direct array response.
        const inspections = Array.isArray(
          response.data?.inspections
        )
          ? response.data.inspections
          : Array.isArray(response.data)
            ? response.data
            : [];

        // Stops if the user left the page while the request was running.
        if (!isActive) {
          return;
        }

        // Stores the inspection history.
        setHistory(inspections);
      } catch (err) {
        // Logs the complete error for development and debugging.
        console.error(
          "Failed to load inspection history:",
          err
        );

        if (!isActive) {
          return;
        }

        // Uses the backend error message when available.
        const backendMessage =
          err.response?.data?.message ||
          err.response?.data?.error;

        // Displays a clear error message to the user.
        setError(
          backendMessage ||
            "Failed to load inspection history"
        );
      } finally {
        // Ends the loading state only if the page is still active.
        if (isActive) {
          setLoading(false);
        }
      }
    };

    // Loads the history when the page opens.
    fetchHistory();

    // Prevents state updates after leaving the page.
    return () => {
      isActive = false;
    };
  }, []);

  // Downloads the PDF report for a specific inspection.
  const handleDownloadReport = async (inspectionId) => {
    try {
      // Starts the download state and clears previous errors.
      setDownloadingReportId(inspectionId);
      setReportError("");
      setReportErrorId(null);

      // Requests the PDF report from the backend.
      // Blob is required because the response is a file.
      const response = await api.get(
        `/api/report/${inspectionId}`,
        {
          responseType: "blob",
        }
      );

      // Creates a Blob object that represents the PDF file.
      const pdfBlob = new Blob([response.data], {
        type: "application/pdf",
      });

      // Creates a temporary browser URL for the file.
      const downloadUrl =
        window.URL.createObjectURL(pdfBlob);

      // Creates a temporary link element.
      const link = document.createElement("a");

      // Sets the temporary file URL.
      link.href = downloadUrl;

      // Defines the downloaded PDF file name.
      link.download =
        `inspection-${inspectionId}-summary-report.pdf`;

      // Adds the temporary link to the page.
      document.body.appendChild(link);

      // Starts the download automatically.
      link.click();

      // Removes the temporary link from the page.
      link.remove();

      // Releases the temporary browser URL from memory.
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      // Logs the error for development and debugging.
      console.error("Failed to download report:", err);

      // Stores the ID of the row where the error occurred.
      setReportErrorId(inspectionId);

      // Displays an appropriate message based on the response status.
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
          "Failed to download the report. Please try again."
        );
      }
    } finally {
      // Ends the report download state.
      setDownloadingReportId(null);
    }
  };

  // Converts the case status into readable text
  // and returns the matching CSS class.
  const getCaseStatusDetails = (item) => {
    // Supports both camelCase and snake_case backend fields.
    const caseStatus =
      item.caseStatus ||
      item.case_status ||
      "under_review";

    if (caseStatus === "confirmed") {
      return {
        text: "Confirmed",
        className: "case-status-confirmed",
      };
    }

    if (caseStatus === "dismissed") {
      return {
        text: "Dismissed",
        className: "case-status-dismissed",
      };
    }

    return {
      text: "Under Review",
      className: "case-status-under-review",
    };
  };

  // Converts the inspection result into readable text.
  const getResultDetails = (item) => {
    // A failed inspection must always be displayed as Failed.
    // This check happens before checking changes_detected.
    if (item.status === "failed") {
      return {
        text: "Failed",
        className: "failed-result",
      };
    }

    // Displays detected changes for a completed inspection.
    if (item.changes_detected === true) {
      return {
        text: "Change Detected",
        className: "change",
      };
    }

    // Displays no changes for a completed inspection.
    if (item.changes_detected === false) {
      return {
        text: "No Change Detected",
        className: "no-change",
      };
    }

    // Displays the current processing status if results are not ready.
    if (
      item.status === "pending" ||
      item.status === "processing"
    ) {
      return {
        text:
          item.status === "processing"
            ? "Processing"
            : "Pending",
        className: "pending",
      };
    }

    // Provides a safe fallback for missing result information.
    return {
      text: item.status || "Pending",
      className: "pending",
    };
  };

  // Creates a copy of the history array and sorts it by date.
  const sortedHistory = [...history].sort((a, b) => {
    // Uses zero as a fallback if a creation date is missing.
    const firstDate = a.created_at
      ? new Date(a.created_at).getTime()
      : 0;

    const secondDate = b.created_at
      ? new Date(b.created_at).getTime()
      : 0;

    // Sorts from newest to oldest or from oldest to newest.
    return sortOrder === "newest"
      ? secondDate - firstDate
      : firstDate - secondDate;
  });

  // Displays a loading message while waiting for the backend.
  if (loading) {
    return (
      <div className="history-page">
        <h1>Inspection History</h1>

        <p className="history-message">
          Loading inspection history...
        </p>
      </div>
    );
  }

  return (
    <div className="history-page">
      {/* Page title */}
      <h1>Inspection History</h1>

      <p>View all your saved inspection results.</p>

      {/* Displays an error if loading the history failed */}
      {error ? (
        <div className="history-error">
          <h3>Unable to load history</h3>

          <p>{error}. Please try again later.</p>
        </div>
      ) : history.length === 0 ? (
        // Displays an empty state if no inspections exist.
        <div className="empty-history">
          <h3>No inspections yet</h3>

          <p>
            Your uploaded inspections will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Date sorting buttons */}
          <div className="history-sort">
            <button
              type="button"
              onClick={() => setSortOrder("newest")}
              className={
                sortOrder === "newest"
                  ? "active-sort"
                  : ""
              }
            >
              Newest First
            </button>

            <button
              type="button"
              onClick={() => setSortOrder("oldest")}
              className={
                sortOrder === "oldest"
                  ? "active-sort"
                  : ""
              }
            >
              Oldest First
            </button>
          </div>

          {/* Allows horizontal scrolling on smaller screens */}
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Before Image</th>
                  <th>After Image</th>
                  <th>Result</th>
                  <th>Case Status</th>
                  <th>Report</th>
                </tr>
              </thead>

              <tbody>
                {sortedHistory.map((item) => {
                  // Gets the readable inspection result and CSS class.
                  const resultDetails =
                    getResultDetails(item);

                  // Gets the readable case status and CSS class.
                  const caseStatusDetails =
                    getCaseStatusDetails(item);

                  // Checks whether this row's report is downloading.
                  const isDownloading =
                    downloadingReportId === item.id;

                  // Checks whether the report error belongs to this row.
                  const hasReportError =
                    reportErrorId === item.id &&
                    Boolean(reportError);

                  // A failed inspection cannot generate a valid report.
                  const isFailed =
                    item.status === "failed";

                  return (
                    <tr key={item.id}>
                      {/* Inspection creation date */}
                      <td>
                        {item.created_at
                          ? new Date(
                              item.created_at
                            ).toLocaleString()
                          : "No date"}
                      </td>

                      {/* Before image */}
                      <td>
                        {item.image_before_path ? (
                          <img
                            src={`${API_BASE_URL}/${item.image_before_path}`}
                            alt="Before inspection"
                            className="thumb"
                          />
                        ) : (
                          <span className="missing-data">
                            No image
                          </span>
                        )}
                      </td>

                      {/* After image */}
                      <td>
                        {item.image_after_path ? (
                          <img
                            src={`${API_BASE_URL}/${item.image_after_path}`}
                            alt="After inspection"
                            className="thumb"
                          />
                        ) : (
                          <span className="missing-data">
                            No image
                          </span>
                        )}
                      </td>

                      {/* AI inspection result */}
                      <td>
                        <span
                          className={
                            resultDetails.className
                          }
                        >
                          {resultDetails.text}
                        </span>
                      </td>

                      {/* Case status selected by the inspector */}
                      <td>
                        <span
                          className={
                            caseStatusDetails.className
                          }
                        >
                          {caseStatusDetails.text}
                        </span>
                      </td>

                      {/* PDF report download action */}
                      <td>
                        <div className="report-cell">
                          <button
                            type="button"
                            className="history-report-button"
                            onClick={() =>
                              handleDownloadReport(
                                item.id
                              )
                            }
                            disabled={
                              isDownloading || isFailed
                            }
                          >
                            <FaDownload />

                            <span>
                              {isDownloading
                                ? "Preparing..."
                                : "Download PDF"}
                            </span>
                          </button>

                          {/* Displays an error only in the relevant row */}
                          {hasReportError && (
                            <p
                              className="history-report-error"
                              role="alert"
                            >
                              {reportError}
                            </p>
                          )}

                          {/* Failed inspections do not have reports */}
                          {isFailed && (
                            <p className="report-unavailable">
                              Report unavailable
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default History;