import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

import "./App.css";

import Login from "./pages/Login";
import Upload from "./pages/Upload";
import Processing from "./pages/Processing";
import Results from "./pages/Results";
import History from "./pages/History";
import Help from "./pages/Help";
import Admin from "./pages/Admin";

import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

function Layout() {
  const location = useLocation();

  // Hide the sidebar on the Login and Processing pages.
  const hideSidebar =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname.startsWith("/processing/");

  return (
    <div className="app-layout">
      {!hideSidebar && <Sidebar />}

      <main className="app-main">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/help" element={<Help />} />

          {/* Protected routes */}
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            }
          />

          <Route
            path="/processing/:id"
            element={
              <ProtectedRoute>
                <Processing />
              </ProtectedRoute>
            }
          />

          <Route
            path="/results/:id"
            element={
              <ProtectedRoute>
                <Results />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />

          {/* Route accessible only to administrators */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

// Main application component.
function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;