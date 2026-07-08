import { NavLink } from "react-router-dom";
import {
  FaLandmark,
  FaCloudUploadAlt,
  FaRegQuestionCircle,
  FaChartBar,
  FaHistory,
} from "react-icons/fa";

import "./Sidebar.css";

function Sidebar() {
  return (
    <aside className="sidebar">

      {/* System logo and title */}
      <div className="sidebar-logo">
        <FaLandmark />
        <h2>Municipal Illegal Construction Detection System</h2>
      </div>

      {/* Navigation menu */}
      <nav>
        <NavLink to="/upload">
          <FaCloudUploadAlt /> Upload
        </NavLink>

        <NavLink to="/results">
          <FaChartBar /> Results
        </NavLink>

        <NavLink to="/history">
          <FaHistory /> History
        </NavLink>

        <NavLink to="/help">
          <FaRegQuestionCircle /> Help
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;