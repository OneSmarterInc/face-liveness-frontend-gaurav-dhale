import { useState } from "react";
import CameraFeed from "../components/Camera/CameraFeed";
import { createSession } from "../services/identityVerification";
import useFaceVerification from "../hooks/useFaceVerification";
import { useAuth } from "../context/AuthContext";
import "../css/FaceVerification.css";

const ACCENT = "#3b82f6";

const INSTRUCTIONS = [
  { icon: "☀️", text: "Good lighting — face the camera directly." },
  { icon: "🚫", text: "No sunglasses or hats. Glasses are fine." },
  { icon: "🎯", text: "Center your face and hold steady." },
  { icon: "📋", text: "Follow on-screen prompts one at a time." },
  { icon: "✥", text: "Move slowly and naturally." },
  { icon: "✓", text: "Do each action once, not repeatedly." },
  { icon: "🕐", text: "Wait — steps advance automatically." },
  { icon: "↺", text: "Didn't register? Hold position and retry." },
  { icon: "⏱", text: "Takes under a minute to complete." },
];

function InstructionRow({ icon, text }) {
  return (
    <div className="instruction-row">
      <div className="instruction-icon">{icon}</div>
      <span className="instruction-text">{text}</span>
    </div>
  );
}

function FaceVerification() {
  const [isVerificationStarted, setIsVerificationStarted] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [verificationSession, setVerificationSession] = useState(null);
  const [error, setError] = useState("");
  const [hasAgreed, setHasAgreed] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 5, label: "Get ready" });
  const { logout } = useAuth();
  const { verify: verifyFace } = useFaceVerification();

  const handleStartVerification = async () => {
    if (!hasAgreed) return;

    setError("");
    setIsCreatingSession(true);

    try {
      const session = await createSession();

      setVerificationSession(session);
      setIsVerificationStarted(true);
    } catch (err) {
      console.error("Failed to create verification session:", err);
      setError(err.message || "Unable to create verification session.");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleStopVerification = () => {
    setIsVerificationStarted(false);
    setVerificationSession(null);
    setError("");
    setProgress({ current: 0, total: 5, label: "Get ready" });
  };

  const handleRetrySession = async () => {
    const session = await createSession();
    setVerificationSession(session);
    setProgress({ current: 0, total: 5, label: "Get ready" });
    return session;
  };

  const submitVerify = (sessionId, image) => verifyFace(sessionId, image, "LOGIN");

  return (
    <div className="face-verify-root">
      {!isVerificationStarted ? (
        <div className="face-verify-split">
          <div className="face-verify-instructions-panel">
            <div className="face-verify-instructions-header">
              <div className="face-verify-header-icon">📋</div>
              <h1 className="face-verify-title">Before You Begin</h1>
              <p className="face-verify-subtitle">
                First, read all the instructions carefully.
              </p>
            </div>

            <div className="face-verify-instructions-list">
              {INSTRUCTIONS.map((item, i) => (
                <InstructionRow key={i} {...item} />
              ))}
            </div>

            <div className="face-verify-consent">
              <label className="face-verify-checkbox-label">
                <input
                  type="checkbox"
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                  className="face-verify-checkbox"
                />
                I have read and understood all the instructions.
              </label>
            </div>
          </div>

          {/* Right: start action */}
          <div className="face-verify-action-panel">
            <div className="face-verify-action-inner">
              <button
                onClick={handleStartVerification}
                disabled={isCreatingSession || !hasAgreed}
                className="face-verify-start-btn"
                style={{
                  cursor:
                    isCreatingSession || !hasAgreed ? "not-allowed" : "pointer",
                  background: hasAgreed ? ACCENT : "#4b5563",
                  color: hasAgreed ? "#ffffff" : "#9ca3af",
                  opacity: isCreatingSession ? 0.7 : 1,
                }}
              >
                {isCreatingSession
                  ? "Creating verification session..."
                  : "Start Verification"}
              </button>

              <p className="face-verify-hint">
                {hasAgreed
                  ? "Ready when you are."
                  : "Please confirm you've read the instructions to continue."}
              </p>

              {error && <p className="face-verify-error">{error}</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="face-verify-split">
          <div className="face-verify-sidebar">
            <div>
              <span className="face-verify-step-label">
                Step {progress.current} / {progress.total}
              </span>
              <h2 className="face-verify-step-title">{progress.label}</h2>
            </div>

            <div className="face-verify-progress-track">
              <div
                className="face-verify-progress-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>

            <div className="face-verify-tip">
              💡 Move slowly and keep your face centered in the frame.
            </div>

            <button onClick={handleStopVerification} className="face-verify-stop-btn">
              Stop verification
            </button>
          </div>

          <div className="face-verify-camera-panel">
            <CameraFeed
              key={verificationSession?.session_id}
              verificationSession={verificationSession}
              mode="verify"
              onSubmit={submitVerify}
              onProgressChange={setProgress}
              onRetry={handleRetrySession}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default FaceVerification;
