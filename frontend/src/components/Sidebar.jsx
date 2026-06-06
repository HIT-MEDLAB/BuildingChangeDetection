import { NavLink } from "react-router-dom";
import {
  FaLandmark,
  FaCloudUploadAlt,
  FaRegQuestionCircle,
  FaChartBar,
  FaHistory,
} from "react-icons/fa";
import "./Sidebar.css";

const hideSidebar =
  location.pathname === "/" ||
  location.pathname === "/login" ||
  location.pathname === "/processing";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <FaLandmark />
        <h2>Municipal Illegal Construction Detection System</h2>
      </div>

      <nav>
        <NavLink to="/upload"><FaCloudUploadAlt /> Upload</NavLink>
        <NavLink to="/results"><FaChartBar /> Results</NavLink>
        <NavLink to="/history"><FaHistory /> History</NavLink>
        <NavLink to="/help"><FaRegQuestionCircle /> Help</NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;