import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaUser, FaLock } from "react-icons/fa";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  // Username and password entered by the user.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Login request state.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle login request.
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Both fields are required.
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Send username and password to the backend.
      const response = await api.post("/api/auth/login", {
        username,
        password,
      });

      // Save authentication information in the AuthContext.
      login(response.data.token, response.data.user);

      // Redirect the user to the upload page after successful login.
      navigate("/upload");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>
          Municipal Illegal Construction Detection System
        </h1>

        <p className="subtitle">
          AI-powered detection and inspection platform
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            {/* Username icon */}
            <FaUser className="input-icon" />

            <input
              data-testid="login-username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
            />
          </div>

          <div className="input-group">
            {/* Password icon */}
            <FaLock className="input-icon" />

            <input
              data-testid="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />
          </div>

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <button
            data-testid="login-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <Link className="help-link" to="/help">
          Help Center
        </Link>
      </div>
    </div>
  );
}

export default Login;