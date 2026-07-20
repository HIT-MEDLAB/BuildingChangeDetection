import { useContext } from "react";
import { NavLink } from "react-router-dom";
import {
  FaLandmark,
  FaCloudUploadAlt,
  FaRegQuestionCircle,
  FaHistory,
  FaUsersCog,
} from "react-icons/fa";

import { AuthContext } from "../context/AuthContext";
import "./Sidebar.css";

function Sidebar() {
  const { user } = useContext(AuthContext);

  return (
    <aside className="sidebar">
      {/* Display the system logo and application name */}
      <div className="sidebar-logo">
        <FaLandmark />

        <h2>Municipal Illegal Construction Detection System</h2>
      </div>

      {/* Main navigation menu */}
      <nav>
        <NavLink to="/upload">
          <FaCloudUploadAlt />
          Upload
        </NavLink>

        <NavLink to="/history">
          <FaHistory />
          History
        </NavLink>

        {/* Display the Admin page only for users with the admin role */}
        {user?.role === "admin" && (
          <NavLink to="/admin">
            <FaUsersCog />
            Admin
          </NavLink>
        )}

        <NavLink to="/help">
          <FaRegQuestionCircle />
          Help
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;