import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaInfoCircle } from "react-icons/fa";
import "./Processing.css";

function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const images = location.state;

  const [progress, setProgress] = useState(0);

  const steps = [
    "Uploading images...",
    "Validating image format...",
    "Comparing before and after images...",
    "Detecting suspected changes...",
    "Preparing results..."
  ];

  const currentStep = Math.min(Math.floor(progress / 20), steps.length - 1);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);

          setTimeout(() => {
            navigate("/results", {
              state: images,
            });
          }, 700);

          return 100;
        }

        return prev + 5;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [navigate, images]);

  return (
    <div className="processing-page">
      <div className="processing-card">
        <h1>Processing Images</h1>
        <p>Please wait while we analyze the changes.</p>

        <div className="loader-ring" style={{ "--progress": `${progress}%` }}>
          <span>{progress}%</span>
        </div>

        <h2>Analyzing...</h2>
        <p className="step-text">{steps[currentStep]}</p>

        <div className="progress-bar">
          <div style={{ width: `${progress}%` }}></div>
        </div>

        <div className="processing-info">
          <FaInfoCircle />
          <span>You will be redirected to the results screen automatically.</span>
        </div>
      </div>
    </div>
  );
}

export default Processing;