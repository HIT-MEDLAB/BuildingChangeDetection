import { useState } from "react";
import { useLocation } from "react-router-dom";
import { FaCheckCircle, FaSave } from "react-icons/fa";
import "./Results.css";

function Results() {
  const location = useLocation();

  const beforeImage = location.state?.beforePreview;
  const afterImage = location.state?.afterPreview;

  const [savedMessage, setSavedMessage] = useState(false);

  const detectedChanges = [
    { x: 28, y: 12, width: 16, height: 28 },
    { x: 68, y: 18, width: 18, height: 26 },
    { x: 12, y: 58, width: 18, height: 24 },
    { x: 66, y: 62, width: 22, height: 25 },
  ];

  if (!beforeImage || !afterImage) {
    return (
      <div className="results-page">
        <h1>Results Screen</h1>
        <p>No uploaded images found. Please go back to Upload and try again.</p>
      </div>
    );
  }

  const handleSaveToHistory = () => {
    const newInspection = {
      id: Date.now(),
      date: new Date().toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      beforeImage,
      afterImage,
      result: "Change Detected",
    };

    const history =
      JSON.parse(localStorage.getItem("inspectionHistory")) || [];

    const alreadyExists = history.some(
      (item) =>
        item.beforeImage === beforeImage &&
        item.afterImage === afterImage
    );

    if (!alreadyExists) {
      localStorage.setItem(
        "inspectionHistory",
        JSON.stringify([newInspection, ...history])
      );
    }

    setSavedMessage(true);

    setTimeout(() => {
      setSavedMessage(false);
    }, 2000);
  };

  return (
    <div className="results-page">
      <h1>Results Screen</h1>

      <div className="result-status">
        <FaCheckCircle />

        <div>
          <h2>Change Detected</h2>
          <p>Differences were found between the images.</p>
        </div>

        <button onClick={handleSaveToHistory}>
          <FaSave /> Save to History
        </button>
      </div>

      <div className="images-grid">
        <div>
          <h3>Before Image (Old State)</h3>
          <img className="result-image" src={beforeImage} alt="Before" />
        </div>

        <div>
          <h3>After Image (New State) with Detected Changes</h3>

          <div className="after-image-wrapper">
            <img className="result-image" src={afterImage} alt="After" />

            {detectedChanges.map((box, index) => (
              <div
                key={index}
                className="red-box"
                style={{
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.width}%`,
                  height: `${box.height}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="legend">
        <span></span>
        Detected changes are highlighted in red.
      </div>

      {savedMessage && <div className="saved-toast">Saved</div>}
    </div>
  );
}

export default Results;