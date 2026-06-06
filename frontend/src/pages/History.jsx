import { useState } from "react";
import "./History.css";

function History() {
    const [sortOrder, setSortOrder] = useState("newest");
  const [history, setHistory] = useState(
    JSON.parse(localStorage.getItem("inspectionHistory")) || []
  );

  const deleteInspection = (id) => {
    const updatedHistory = history.filter((item) => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem("inspectionHistory", JSON.stringify(updatedHistory));
  };
  const sortedHistory = [...history].sort((a, b) => {
    if (sortOrder === "newest") {
      return b.id - a.id;
    }
    return a.id - b.id;
  });

  return (
    <div className="history-page">
      <h1>Inspection History</h1>
      <p>View all your saved inspection results.</p>

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
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {sortedHistory.map((item) => (
            <tr key={item.id}>
              <td>{item.date}</td>

              <td>
                <img
                  src={item.beforeImage}
                  alt="Before"
                  className="thumb"
                />
              </td>

              <td>
                <img
                  src={item.afterImage}
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
                  {item.result}
                </span>
              </td>

              <td className="actions">
                <button className="view-btn">
                  👁 View Details
                </button>

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

      <p>
      </p>
    </div>
  );
}

export default History;