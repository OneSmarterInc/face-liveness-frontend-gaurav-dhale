import { useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { postInstance } from "../services/apiCall";
import "./VerifyTotp.css";

function VerifyTotp() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const mfaToken = location.state?.mfaToken;

  if (!mfaToken) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!code.trim()) {
      setError("Please enter your 6-digit code.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await postInstance("/auth/verify-totp/", {
        mfa_token: mfaToken,
        code: Number(code.trim()),
      });

      const data = response.data;
      const accessToken = data?.access_token || data?.access;
      const refreshToken = data?.refresh_token || data?.refresh;
      login({ accessToken, refreshToken });

      const redirectTo = location.state?.from?.pathname || "/face-liveness";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const responseData = err.response?.data;
      if (err.response) {
        setError(responseData?.message || responseData?.detail || "Invalid or expired code.");
      } else {
        setError("Unable to reach the server. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="totp-page">
      <form onSubmit={handleSubmit} className="totp-card">
        <div className="totp-icon">🔐</div>

        <div className="totp-heading">
          <h1 className="totp-title">Two-Factor Authentication</h1>
          <p className="totp-subtitle">Enter the 6-digit code from your authenticator app</p>
        </div>

        <div className="totp-field">
          <label htmlFor="code" className="totp-label">
            Authentication Code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="totp-input"
          />
        </div>

        {error && <div className="totp-error">{error}</div>}

        <button type="submit" disabled={isSubmitting} className="totp-button">
          {isSubmitting ? "Verifying..." : "Verify"}
        </button>
      </form>
    </div>
  );
}

export default VerifyTotp;
