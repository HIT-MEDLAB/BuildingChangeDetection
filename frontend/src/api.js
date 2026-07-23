import axios from "axios";

// Create a reusable Axios instance for all API requests.
// Convention: VITE_API_URL is the server origin ONLY (no trailing /api) —
// every call site in src/pages/*.jsx already prefixes its path with /api
// (e.g. api.post("/api/auth/login")). Do not add /api to VITE_API_URL, or
// requests resolve to /api/api/... and 404 (see .env.example).
const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:3000",
});

// Attach the JWT token to every outgoing request.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle expired or invalid authentication tokens globally.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("isLoggedIn");

      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;