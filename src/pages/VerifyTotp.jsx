import { useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { postInstance } from "../services/apiCall";
import { validateOtpCode } from "../utils/validators";
import "./VerifyTotp.css";

function VerifyTotp() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, setFaceStage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [transitionData, setTransitionData] = useState(null);

  const getTransitionMessage = (nextStep) => {
  switch (nextStep) {
    case "FACE_REGISTRATION":
      return {
        title: "Setting Up Facial Authentication",
        description:
          "This is your first login. We'll securely register your face so you can use facial verification during future logins.",
        redirectLabel: "Redirecting to Face Registration...",
      };

    case "FACE_VERIFICATION":
      return {
        title: "Verifying Your Identity",
        description:
          "Your face is already registered. We'll perform a quick facial verification before granting access.",
        redirectLabel: "Redirecting to Face Verification...",
      };

    default:
      return {
        title: "Preparing",
        description: "Please wait while we prepare your session.",
        redirectLabel: "Redirecting...",
      };
  }
};

  const FACE_ROUTE_FOR_STEP = {
    FACE_REGISTRATION: "/face-registration",
    FACE_VERIFICATION: "/face-verification",
  };

  const mfaToken = location.state?.mfaToken;

  if (!mfaToken) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const codeCheck = validateOtpCode(code);
    if (!codeCheck.valid) {
      setError(codeCheck.message);
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
      const nextStep = data?.next_step;
      setFaceStage(nextStep);

      const message = getTransitionMessage(data.next_step);

      setTransitionData({
        nextStep: data.next_step,
        ...message,
      });

      setTimeout(() => {
        navigate(FACE_ROUTE_FOR_STEP[data.next_step], {
          replace: true,
        });
      }, 3000);
    } catch (err) {
      const responseData = err.response?.data;
      if (err.response) {
        setError(
          responseData?.message ||
            responseData?.detail ||
            "Invalid or expired code.",
        );
      } else {
        setError("Unable to reach the server. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  if (transitionData) {
  return (
    <div className="totp-page">
      <div className="totp-card transition-card">

        <div className="transition-icon">
          ✓
        </div>

        <h2 className="transition-title">
          {transitionData.title}
        </h2>

        <p className="transition-description">
          {transitionData.description}
        </p>

        <div className="transition-loading">
          <div className="transition-spinner"></div>

          <span>
            {transitionData.redirectLabel}
          </span>
        </div>

        <div className="transition-progress">
          <div className="transition-progress-fill"></div>
        </div>

      </div>
    </div>
  );
}
  return (
    <div className="totp-page">
      <form onSubmit={handleSubmit} className="totp-card">
        <div className="totp-icon">🔐</div>

        <div className="totp-heading">
          <h1 className="totp-title">Two-Factor Authentication</h1>
          <p className="totp-subtitle">
            Enter the 6-digit code from your authenticator app
          </p>
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
