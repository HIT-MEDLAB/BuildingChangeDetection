import { useEffect, useState } from "react";
import api from "../api";
import "./History.css";

function History() {
  const [sortOrder, setSortOrder] = useState("newest");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await api.get("/api/inspections");
        setHistory(response.data.inspections || []);
      } catch (err) {
        setError("Failed to load inspection history");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const sortedHistory = [...history].sort((a, b) => {
    const first = new Date(a.created_at).getTime();
    const second = new Date(b.created_at).getTime();

    return sortOrder === "newest" ? second - first : first - second;
  });

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

      {error && <p className="upload-error">{error}</p>}

      {history.length === 0 && !error ? (
        <div className="empty-history">
          <h3>No inspections yet</h3>
          <p>Your uploaded inspections will appear here.</p>
        </div>
      ) : (
        <>
          <div className="history-sort">
            <button
              onClick={() => setSortOrder("newest")}
              className={sortOrder === "newest" ? "active-sort" : ""}
            >
              Newest First
            </button>

            <button
              onClick={() => setSortOrder("oldest")}
              className={sortOrder === "oldest" ? "active-sort" : ""}
            >
              Oldest First
            </button>
          </div>

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
                const resultText =
                  item.changes_detected === true
                    ? "Change Detected"
                    : item.changes_detected === false
                    ? "No Change Detected"
                    : item.status || "Pending";

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
                          src={`http://localhost:3000/${item.image_before_path}`}
                          alt="Before"
                          className="thumb"
                        />
                      ) : (
                        "No image"
                      )}
                    </td>

                    <td>
                      {item.image_after_path ? (
                        <img
                          src={`http://localhost:3000/${item.image_after_path}`}
                          alt="After"
                          className="thumb"
                        />
                      ) : (
                        "No image"
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          resultText === "Change Detected"
                            ? "change"
                            : "no-change"
                        }
                      >
                        {resultText}
                      </span>
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