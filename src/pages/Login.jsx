import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { postInstance } from "../services/apiCall";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, setFaceStage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const FACE_ROUTE_FOR_STEP = {
    FACE_REGISTRATION: "/face-registration",
    FACE_VERIFICATION: "/face-verification",
  };

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

      const nextStep = data?.next_step;
      setFaceStage(nextStep);

      const redirectTo = FACE_ROUTE_FOR_STEP[nextStep] || "/face-verification";
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
          <div className="password-field-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="login-input password-input"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {location.state?.registered && !error && (
          <div className="login-success">Account created. Please log in to continue.</div>
        )}

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={isSubmitting} className="login-button">
          {isSubmitting ? "Logging in..." : "Log In"}
        </button>

        <p className="signup-footer-text">
          Don't have an account?{" "}
          <Link to="/signup" className="signup-link">
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Login;