import { useEffect, useState } from "react";
import api from "../api";
import "./History.css";

// Backend API base URL (uses .env if available)
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function History() {
  const [sortOrder, setSortOrder] = useState("newest");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load the user's inspection history from the backend
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/api/inspections");
        setHistory(response.data.inspections || []);
      } catch (err) {
        console.error("Failed to load inspection history:", err);
        setError("Failed to load inspection history");
      } finally {
        // Stop the loading indicator after the request finishes
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  // Sort a copy of the history without changing the original state
  const sortedHistory = [...history].sort((a, b) => {
    const firstDate = new Date(a.created_at).getTime();
    const secondDate = new Date(b.created_at).getTime();

    return sortOrder === "newest"
      ? secondDate - firstDate
      : firstDate - secondDate;
  });

  // Display a loading message while the history is being fetched
  if (loading) {
    return (
      <div className="history-page">
        <h1>Inspection History</h1>
        <p>Loading inspection history...</p>
      </div>
    );
  }

  return (
    <div className="history-page">
      <h1>Inspection History</h1>
      <p>View all your saved inspection results.</p>

      {/* Display an error message if the request failed */}
      {error ? (
        <div className="history-error">
          <h3>Unable to load history</h3>
          <p>{error}. Please try again later.</p>
        </div>
      ) : history.length === 0 ? (
        /* Display an empty state when no inspections exist */
        <div className="empty-history">
          <h3>No inspections yet</h3>
          <p>Your uploaded inspections will appear here.</p>
        </div>
      ) : (
        <>
          {/* Sorting controls */}
          <div className="history-sort">
            <button
              type="button"
              onClick={() => setSortOrder("newest")}
              className={sortOrder === "newest" ? "active-sort" : ""}
            >
              Newest First
            </button>

            <button
              type="button"
              onClick={() => setSortOrder("oldest")}
              className={sortOrder === "oldest" ? "active-sort" : ""}
            >
              Oldest First
            </button>
          </div>

          {/* Display all inspection records */}
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Before Image</th>
                <th>After Image</th>
                <th>Result</th>
              </tr>
            </thead>

            <tbody>
              {sortedHistory.map((item) => {
                // Convert the backend result into a readable status
                const resultText =
                  item.changes_detected === true
                    ? "Change Detected"
                    : item.changes_detected === false
                    ? "No Change Detected"
                    : item.status || "Pending";

                // Select the matching CSS class
                const resultClass =
                  resultText === "Change Detected"
                    ? "change"
                    : resultText === "No Change Detected"
                    ? "no-change"
                    : "pending";

                return (
                  <tr key={item.id}>
                    <td>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
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
                        "No image"
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
                        "No image"
                      )}
                    </td>

                    <td>
                      <span className={resultClass}>{resultText}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default History;