import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Copy, Check } from "lucide-react";
import QRCode from "qrcode";
import { postInstance } from "../services/apiCall";
import "./VerifyTotp.css";
import "./TotpEnroll.css";

function formatSecret(secret) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

function TotpEnroll() {
  const location = useLocation();
  const navigate = useNavigate();

  const accessToken = location.state?.accessToken;

  const [step, setStep] = useState("loading");
  const [secret, setSecret] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    const startEnrollment = async () => {
      try {
        const response = await postInstance(
          "/auth/totp/enroll/",
          {},
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        setSecret(response.data?.secret || "");

        const provisioningUri = response.data?.provisioning_uri;
        if (provisioningUri) {
          try {
            const dataUrl = await QRCode.toDataURL(provisioningUri, {
              width: 200,
              margin: 1,
              color: { dark: "#0b1120", light: "#f9fafb" },
            });
            setQrCodeUrl(dataUrl);
          } catch {
            // QR generation is a convenience; the secret text still works for manual entry.
          }
        }

        setStep("setup");
      } catch (err) {
        const responseData = err.response?.data;
        setError(
          err.response
            ? responseData?.message || responseData?.detail || "Unable to start TOTP enrollment."
            : "Unable to reach the server. Please try again.",
        );
        setStep("error");
      }
    };

    startEnrollment();
  }, [accessToken]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied; user can still select and copy the text manually.
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();

    if (!code.trim()) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await postInstance(
        "/auth/totp/verify-enrollment/",
        { code: code.trim() },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      navigate("/login", { replace: true, state: { registered: true } });
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
    <div className="totp-page totp-enroll-page">
      <div className="totp-card totp-enroll-card">
        <div className="totp-icon">🔐</div>

        <div className="totp-heading">
          <h1 className="totp-title">Set Up Two-Factor Authentication</h1>
          <p className="totp-subtitle">Secure your account with an authenticator app</p>
        </div>

        {step === "loading" && <p className="totp-status">Preparing your enrollment...</p>}

        {step === "error" && (
          <>
            {error && <div className="totp-error">{error}</div>}
          </>
        )}

        {step === "setup" && (
          <form onSubmit={handleConfirm} className="totp-enroll-form">
            <div className="totp-enroll-columns">
              <div className="totp-enroll-col-left">
                {qrCodeUrl && (
                  <div className="totp-qr-box">
                    <img src={qrCodeUrl} alt="TOTP QR code" className="totp-qr-image" />
                  </div>
                )}
                <div className="totp-secret-box">
                  <span className="totp-secret-text">{formatSecret(secret)}</span>
                  <button
                    type="button"
                    className="totp-copy-btn"
                    onClick={handleCopySecret}
                    aria-label="Copy secret key"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="totp-enroll-col-right">
                <div className="totp-enroll-instructions">
                  <p>1. Open your authenticator app (Google Authenticator, Authy, etc.).</p>
                  <p>2. Scan the QR code, or use manual entry with the secret key.</p>
                </div>

                <div className="totp-field">
                  <label htmlFor="enroll-code" className="totp-label">
                    3. Enter the 6-digit code shown in the app
                  </label>
                  <input
                    id="enroll-code"
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
                  {isSubmitting ? "Verifying..." : "Verify & Enable"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default TotpEnroll;
