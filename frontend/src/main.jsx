import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.jsx";
import AuthProvider from "./context/AuthContext";

// Render the React application
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* Provides authentication state to the entire application */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);