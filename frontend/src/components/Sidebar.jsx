import { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaLandmark,
  FaCloudUploadAlt,
  FaRegQuestionCircle,
  FaHistory,
  FaUsersCog,
  FaSignOutAlt,
} from "react-icons/fa";

import { AuthContext } from "../context/AuthContext";
import "./Sidebar.css";

function Sidebar() {
  // Get the current user and logout function
  // from the authentication context.
  const { user, logout } = useContext(AuthContext);

  // Used to redirect the user after logging out.
  const navigate = useNavigate();

  // Log the user out and return to the login screen.
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

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

        {/* Log the current user out of the system */}
        <button
          type="button"
          className="sidebar-logout"
          onClick={handleLogout}
        >
          <FaSignOutAlt />
          Logout
        </button>
      </nav>
    </aside>
  );
}

export default Sidebar;