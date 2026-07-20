import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

function AdminRoute({ children }) {
  const { isLoggedIn, user } = useContext(AuthContext);

  // Redirect unauthenticated users to the login page.
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  // Restrict access to users with the admin role.
  if (user?.role !== "admin") {
    return <Navigate to="/upload" replace />;
  }

  return children;
}

export default AdminRoute;