import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCity, FaEnvelope, FaLock } from "react-icons/fa";
import { AuthContext } from "../context/AuthContext";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleLogin = (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setError("");
    setLoading(true);

    setTimeout(() => {
      login();
      setLoading(false);
      navigate("/upload");
    }, 1200);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="icon-circle">
          <FaCity className="city-icon" />
        </div>

        <h1>Municipal Illegal Construction</h1>
        <h2>Detection System</h2>

        <p className="subtitle">
          AI-powered detection and inspection platform
        </p>

        <form onSubmit={handleLogin}>
          <div className="input-box">
            <FaEnvelope className="input-icon" />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-box">
            <FaLock className="input-icon" />
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={loading}>
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