import { useEffect, useState } from "react";
import api from "../api";
import "./History.css";

function History() {
  // Stores the selected sorting order
  const [sortOrder, setSortOrder] = useState("newest");

  // Stores the inspections received from the backend
  const [history, setHistory] = useState([]);

  // Stores an error message if an API request fails
  const [error, setError] = useState("");

  // Load inspection history when the page opens
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get("/api/inspections");
        setHistory(response.data.inspections || response.data || []);
      } catch (err) {
        setError("Failed to load inspection history");
      }
    };

    fetchHistory();
  }, []);

  // Delete an inspection from the backend and update the UI
  const deleteInspection = async (id) => {
    try {
      await api.delete(`/api/inspections/${id}`);
      setHistory(history.filter((item) => item.id !== id));
    } catch (err) {
      setError("Failed to delete inspection");
    }
  };

  // Sort inspections by date
  const sortedHistory = [...history].sort((a, b) => {
    const first = new Date(a.date || a.createdAt).getTime();
    const second = new Date(b.date || b.createdAt).getTime();

    return sortOrder === "newest" ? second - first : first - second;
  });

  return (
    <div className="history-page">
      <h1>Inspection History</h1>
      <p>View all your saved inspection results.</p>

      {error && <p className="upload-error">{error}</p>}

      {/* Sorting buttons */}
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

      {/* History table */}
      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Before Image</th>
            <th>After Image</th>
            <th>Result</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {sortedHistory.map((item) => (
            <tr key={item.id}>
              <td>{item.date || item.createdAt}</td>

              <td>
                <img
                  src={item.beforeImage || item.beforeImageUrl}
                  alt="Before"
                  className="thumb"
                />
              </td>

              <td>
                <img
                  src={item.afterImage || item.afterImageUrl}
                  alt="After"
                  className="thumb"
                />
              </td>

              <td>
                <span
                  className={
                    item.result === "Change Detected"
                      ? "change"
                      : "no-change"
                  }
                >
                  {item.result || item.status || "Pending"}
                </span>
              </td>

              <td className="actions">
                <button className="view-btn">👁 View Details</button>

                <button
                  className="delete-btn"
                  onClick={() => deleteInspection(item.id)}
                >
                  🗑 Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default History;