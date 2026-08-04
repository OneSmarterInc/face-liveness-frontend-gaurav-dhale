import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { postInstance } from "../services/apiCall";
import {
  validateName,
  validateEmail,
  validatePassword,
  getPasswordStrength,
} from "../utils/validators";
import "./Login.css";
import "./Signup.css";

const SIGNUP_ROLE = "student";

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    const nameCheck = validateName(name);
    if (!nameCheck.valid) {
      setError(nameCheck.message);
      return;
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.message);
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await postInstance("/auth/register/", {
        name: name.trim(),
        email: email.trim(),
        password,
        role: SIGNUP_ROLE,
      });

      const data = response.data;
      const accessToken = data?.access_token || data?.access;

      if (data?.must_enroll_totp) {
        navigate("/totp-enroll", {
          replace: true,
          state: { accessToken, email: email.trim() },
        });
        return;
      }

      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      const responseData = err.response?.data;
      if (err.response) {
        setError(responseData?.message || responseData?.detail || "Unable to sign up. Please try again.");
      } else {
        setError("Unable to reach the server. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form onSubmit={handleSubmit} className="login-card signup-card">
        <div className="login-heading">
          <h1 className="login-title">Create Account</h1>
          <p className="login-subtitle">Sign up to get started with Face Liveness</p>
        </div>

        <div className="login-field">
          <label htmlFor="name" className="login-label">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            autoComplete="name"
            className="login-input"
          />
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
          <label htmlFor="role" className="login-label">
            Role
          </label>
          <input
            id="role"
            type="text"
            value="Student"
            disabled
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
              placeholder="Create a password"
              autoComplete="new-password"
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
          {password && (
            <div className={`password-strength password-strength-${passwordStrength.score}`}>
              <div className="password-strength-bar">
                <span />
                <span />
                <span />
              </div>
              <span className="password-strength-label">{passwordStrength.label}</span>
            </div>
          )}
          <p className="password-hint">
            Use 8+ characters with uppercase, lowercase, a number, and a symbol.
          </p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={isSubmitting} className="login-button">
          {isSubmitting ? "Signing up..." : "Sign Up"}
        </button>

        <p className="signup-footer-text">
          Already have an account?{" "}
          <Link to="/login" className="signup-link">
            Log In
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;
