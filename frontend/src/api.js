import axios from "axios";

// Create a reusable Axios instance for all API requests
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

// Attach the JWT token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Handle global API errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the token is invalid or expired, log the user out
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;