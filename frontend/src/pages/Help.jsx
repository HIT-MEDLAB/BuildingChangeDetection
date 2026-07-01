import {
  FaBookOpen,
  FaLightbulb,
  FaExclamationTriangle,
  FaHeadset,
  FaInfoCircle,
  FaUpload,
  FaPaperPlane,
  FaSpinner,
  FaChartBar,
} from "react-icons/fa";
import "./Help.css";

function Help() {
  return (
    <div className="help-page">
      {/* Main page title */}
      <h1 className="help-title">Help</h1>

      <main className="help-content">
        <h2>Help & Instructions</h2>
        <p className="help-subtitle">
          Find information and guidance to use the system effectively.
        </p>

        {/* User workflow explanation */}
        <section className="help-card wide-card">
          <div className="circle blue">
            <FaBookOpen />
          </div>

          <div>
            <h3 className="blue-text">1. How to Use the System</h3>
            <p>① Upload a "Before" image (old state).</p>
            <p>② Upload an "After" image (new state).</p>
            <p>③ Click "Submit" to start processing.</p>
            <p>④ Wait for the system to analyze the images.</p>
            <p>⑤ View the detected changes in the results screen.</p>
          </div>

          {/* Visual representation of the workflow */}
          <div className="steps">
            <Step icon={<FaUpload />} text="Upload Before Image" />
            <span>→</span>
            <Step icon={<FaUpload />} text="Upload After Image" />
            <span>→</span>
            <Step icon={<FaPaperPlane />} text="Submit" />
            <span>→</span>
            <Step icon={<FaSpinner />} text="Processing" />
            <span>→</span>
            <Step icon={<FaChartBar />} text="View Results" />
          </div>
        </section>

        {/* Tips and common issues section */}
        <div className="help-grid">
          <section className="help-card green-card">
            <div className="circle green">
              <FaLightbulb />
            </div>

            <div>
              <h3 className="green-text">2. Tips for Better Results</h3>
              <p>✓ Use images of the same location.</p>
              <p>✓ Try to upload images from similar angles.</p>
              <p>✓ Higher quality images give better results.</p>
            </div>
          </section>

          <section className="help-card orange-card">
            <div className="circle orange">
              <FaExclamationTriangle />
            </div>

            <div>
              <h3 className="orange-text">3. Common Issues</h3>
              <p>
                ● <b>Images are not similar:</b> Results may be inaccurate.
              </p>
              <p>
                ● <b>Upload failed:</b> Try again with a supported file
                (JPG/PNG).
              </p>
              <p>
                ● <b>No changes detected:</b> The system may not detect small
                differences.
              </p>
            </div>
          </section>
        </div>

        {/* Contact information */}
        <section className="help-card purple-card">
          <div className="circle purple">
            <FaHeadset />
          </div>

          <div>
            <h3 className="purple-text">4. Contact Support</h3>
            <p>
              If you need further assistance or encounter any issues, please
              contact your system administrator.
            </p>
          </div>
        </section>

        {/* Additional information */}
        <div className="info-box">
          <FaInfoCircle />
          <span>
            For more information about the system and its capabilities, please
            refer to the user manual or contact support.
          </span>
        </div>
      </main>
    </div>
  );
}

/* Reusable component that displays a single step in the workflow */
function Step({ icon, text }) {
  return (
    <div className="help-step-box">
      <div>{icon}</div>
      <p>{text}</p>
    </div>
  );
}

export default Help;