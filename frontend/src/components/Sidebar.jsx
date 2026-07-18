import { NavLink } from "react-router-dom";
import {
  FaLandmark,
  FaCloudUploadAlt,
  FaRegQuestionCircle,
  FaHistory,
} from "react-icons/fa";

import "./Sidebar.css";

function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Display the system logo and product name */}
      <div className="sidebar-logo">
        <FaLandmark />

        <h2>Municipal Illegal Construction Detection System</h2>
      </div>

      {/* Main navigation for pages that can be opened directly */}
      <nav>
        <NavLink to="/upload">
          <FaCloudUploadAlt />
          Upload
        </NavLink>

        <NavLink to="/history">
          <FaHistory />
          History
        </NavLink>

        <NavLink to="/help">
          <FaRegQuestionCircle />
          Help
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;