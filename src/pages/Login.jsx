import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { postInstance } from "../services/apiCall";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await postInstance("/auth/login/", {
        email: email.trim(),
        password,
      });

      const data = response.data;

      if (data?.totp_required && !data?.must_enroll_totp && data?.mfa_token) {
        navigate("/verify-totp", {
          replace: true,
          state: { mfaToken: data.mfa_token, from: location.state?.from },
        });
        return;
      }

      const accessToken = data?.access_token || data?.access;
      const refreshToken = data?.refresh_token || data?.refresh;
      login({ accessToken, refreshToken });

      const redirectTo = location.state?.from?.pathname || "/face-liveness";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const responseData = err.response?.data;
      if (err.response) {
        setError(responseData?.message || responseData?.detail || "Invalid email or password.");
      } else {
        setError("Unable to reach the server. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form onSubmit={handleSubmit} className="login-card">
        <div className="login-icon">🔒</div>

        <div className="login-heading">
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to continue to Face Liveness</p>
        </div>

        <div className="login-field">
          <label htmlFor="email" className="login-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            className="login-input"
          />
        </div>

        <div className="login-field">
          <label htmlFor="password" className="login-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            className="login-input"
          />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={isSubmitting} className="login-button">
          {isSubmitting ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}

export default Login;
