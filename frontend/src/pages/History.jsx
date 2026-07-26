import { useEffect, useState } from "react";
import { FaDownload } from "react-icons/fa";
import api from "../api";
import "./History.css";

// Backend base URL used for displaying uploaded images.
// If VITE_API_URL exists, it is used; otherwise, localhost is used.
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function History() {
  // Controls the current sorting method.
  // Priority is the default because US-1 requires important cases first.
  const [sortOrder, setSortOrder] = useState("priority");

  // Stores the inspection history returned by the backend.
  const [history, setHistory] = useState([]);

  // Indicates whether inspection history is still loading.
  const [loading, setLoading] = useState(true);

  // Stores a user-friendly loading error.
  const [error, setError] = useState("");

  // Stores the inspection ID whose PDF is currently being prepared.
  const [downloadingReportId, setDownloadingReportId] =
    useState(null);

  // Stores the inspection ID whose report download failed.
  const [reportErrorId, setReportErrorId] = useState(null);

  // Stores the report download error message.
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    // Loads the authenticated user's inspection history.
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/api/inspections");

        // Support both a wrapped inspections array and a direct array.
        const inspections =
          response.data.inspections ||
          (Array.isArray(response.data) ? response.data : []);

        setHistory(inspections);
      } catch (err) {
        console.error("Failed to load inspection history:", err);

        setError(
          "We could not load your inspection history. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  // Downloads a PDF report for a specific inspection.
  const handleDownloadReport = async (inspectionId) => {
    try {
      setDownloadingReportId(inspectionId);
      setReportError("");
      setReportErrorId(null);

      const response = await api.get(
        `/api/report/${inspectionId}`,
        {
          responseType: "blob",
        }
      );

      const pdfBlob = new Blob([response.data], {
        type: "application/pdf",
      });

      const downloadUrl =
        window.URL.createObjectURL(pdfBlob);

      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download =
        `inspection-${inspectionId}-summary-report.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to download report:", err);

      setReportErrorId(inspectionId);

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
          "We could not download the report. Please try again."
        );
      }
    } finally {
      setDownloadingReportId(null);
    }
  };

  // Returns the normalized case status value.
  const getCaseStatus = (item) => {
    return (
      item.caseStatus ||
      item.case_status ||
      "under_review"
    );
  };

  // Converts the stored case status into visible text and a CSS class.
  const getCaseStatusDetails = (item) => {
    const caseStatus = getCaseStatus(item);

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

  // Returns a numeric priority value for an inspection.
  // A lower number means that the inspection is more important.
  const getInspectionPriority = (item) => {
    const caseStatus = getCaseStatus(item);

    // A detected change that still requires inspector review
    // is the highest-priority case.
    if (
      item.changes_detected === true &&
      caseStatus === "under_review"
    ) {
      return 1;
    }

    // Confirmed detected changes remain important,
    // but they have already been reviewed.
    if (
      item.changes_detected === true &&
      caseStatus === "confirmed"
    ) {
      return 2;
    }

    // Inspections still being processed or waiting for a result
    // should remain visible near the top.
    if (
      item.status === "pending" ||
      item.status === "processing"
    ) {
      return 3;
    }

    // Detected changes that were dismissed are already resolved.
    if (
      item.changes_detected === true &&
      caseStatus === "dismissed"
    ) {
      return 4;
    }

    // Inspections without detected changes require less attention.
    if (item.changes_detected === false) {
      return 5;
    }

    // Failed or incomplete records are placed last.
    return 6;
  };

  // Sorts inspections according to the selected sorting method.
  const sortedHistory = [...history].sort((a, b) => {
    const firstDate = a.created_at
      ? new Date(a.created_at).getTime()
      : 0;

    const secondDate = b.created_at
      ? new Date(b.created_at).getTime()
      : 0;

    // Prioritize important cases first.
    // Cases with the same priority are ordered newest first.
    if (sortOrder === "priority") {
      const priorityDifference =
        getInspectionPriority(a) -
        getInspectionPriority(b);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return secondDate - firstDate;
    }

    // Sort only by date when the user selects a chronological option.
    return sortOrder === "newest"
      ? secondDate - firstDate
      : firstDate - secondDate;
  });

  // Displays a loading state while the history request is running.
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
      <h1>Inspection History</h1>

      <p>View all your saved inspection results.</p>

      {error ? (
        <div className="history-error">
          <h3>Unable to load history</h3>

          <p>{error}</p>
        </div>
      ) : history.length === 0 ? (
        <div className="empty-history">
          <h3>No inspections yet</h3>

          <p>Your uploaded inspections will appear here.</p>
        </div>
      ) : (
        <>
          {/* Sorting controls. */}
          <div className="history-sort">
            <button
              type="button"
              onClick={() => setSortOrder("priority")}
              className={
                sortOrder === "priority"
                  ? "active-sort"
                  : ""
              }
            >
              Priority First
            </button>

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

          {/* Allows horizontal scrolling on smaller screens. */}
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
                  // Converts backend result values into plain-language text.
                  const resultText =
                    item.status === "failed"
                      ? "Failed"
                      : item.changes_detected === true
                        ? "Change Detected"
                        : item.changes_detected === false
                          ? "No Change Detected"
                          : item.status || "Pending";

                  // Selects the existing CSS class for the result.
                  const resultClass =
                    resultText === "Change Detected"
                      ? "change"
                      : resultText ===
                          "No Change Detected"
                        ? "no-change"
                        : resultText === "Failed"
                          ? "failed-result"
                          : "pending";

                  const caseStatusDetails =
                    getCaseStatusDetails(item);

                  const isDownloading =
                    downloadingReportId === item.id;

                  const hasReportError =
                    reportErrorId === item.id &&
                    reportError;

                  return (
                    <tr key={item.id}>
                      <td>
                        {item.created_at
                          ? new Date(
                              item.created_at
                            ).toLocaleString()
                          : "No date"}
                      </td>

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

                      <td>
                        <span className={resultClass}>
                          {resultText}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            caseStatusDetails.className
                          }
                        >
                          {caseStatusDetails.text}
                        </span>
                      </td>

                      <td>
                        <div className="report-cell">
                          <button
                            type="button"
                            className="history-report-button"
                            onClick={() =>
                              handleDownloadReport(item.id)
                            }
                            disabled={
                              isDownloading ||
                              item.status === "failed"
                            }
                          >
                            <FaDownload />

                            <span>
                              {isDownloading
                                ? "Preparing..."
                                : "Download PDF"}
                            </span>
                          </button>

                          {hasReportError && (
                            <p
                              className="history-report-error"
                              role="alert"
                            >
                              {reportError}
                            </p>
                          )}

                          {item.status === "failed" && (
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