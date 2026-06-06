import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./App.css";
import Login from "./pages/Login";
import Upload from "./pages/Upload";
import Processing from "./pages/Processing";
import Results from "./pages/Results";
import History from "./pages/History";
import Help from "./pages/Help";

import Sidebar from "./components/Sidebar";

function Layout() {
  const location = useLocation();

  const hideSidebar =
    location.pathname === "/" ||
    location.pathname === "/login";

  return (
    <div className="app-layout">
      {!hideSidebar && <Sidebar />}

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/results" element={<Results />} />
          <Route path="/history" element={<History />} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;