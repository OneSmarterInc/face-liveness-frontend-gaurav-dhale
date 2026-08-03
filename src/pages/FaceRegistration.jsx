import { useState } from "react";
import CameraFeed from "../components/Camera/CameraFeed";
import { createSession } from "../services/identityVerification";
import useFaceRecognition from "../hooks/useFaceRecognition";
import { useAuth } from "../context/AuthContext";
import "../css/FaceRegistration.css";

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

function FaceRegistration() {
  const [isVerificationStarted, setIsVerificationStarted] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [verificationSession, setVerificationSession] = useState(null);
  const [error, setError] = useState("");
  const [hasAgreed, setHasAgreed] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 5, label: "Get ready" });
  const { logout } = useAuth();
  const { register: registerFace } = useFaceRecognition();

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

  // Called when the backend rejects a completed session (liveness failed /
  // session not completed). Creates a brand new session the same way the
  // initial "Start Verification" click does. The new session_id is used as
  // CameraFeed's key, so React unmounts the old instance (camera, face
  // mesh, and liveness state machine all torn down) and mounts a fresh one
  // against the new session — same as starting from scratch.
  const handleRetrySession = async () => {
    const session = await createSession();
    setVerificationSession(session);
    setProgress({ current: 0, total: 5, label: "Get ready" });
    return session;
  };

  return (
    <div className="face-reg-root">
      {!isVerificationStarted ? (
        // ----- Pre-registration: split-screen instructions -----
        <div className="face-reg-split">
          {/* Left: instructions */}
          <div className="face-reg-instructions-panel">
            <div className="face-reg-instructions-header">
              <div className="face-reg-header-icon">📋</div>
              <h1 className="face-reg-title">Set Up Face Login</h1>
              <p className="face-reg-subtitle">
                This is a one-time setup. Read the instructions carefully.
              </p>
            </div>

            <div className="face-reg-instructions-list">
              {INSTRUCTIONS.map((item, i) => (
                <InstructionRow key={i} {...item} />
              ))}
            </div>

            <div className="face-reg-consent">
              <label className="face-reg-checkbox-label">
                <input
                  type="checkbox"
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                  className="face-reg-checkbox"
                />
                I have read and understood all the instructions.
              </label>
            </div>
          </div>

          {/* Right: start action */}
          <div className="face-reg-action-panel">
            <div className="face-reg-action-inner">
              <button
                onClick={handleStartVerification}
                disabled={isCreatingSession || !hasAgreed}
                className="face-reg-start-btn"
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
                  : "Register My Face"}
              </button>

              <p className="face-reg-hint">
                {hasAgreed
                  ? "Ready when you are."
                  : "Please confirm you've read the instructions to continue."}
              </p>

              {error && <p className="face-reg-error">{error}</p>}
            </div>
          </div>
        </div>
      ) : (
        // ----- Registration in progress: collapsed sidebar + camera -----
        <div className="face-reg-split">
          <div className="face-reg-sidebar">
            <div>
              <span className="face-reg-step-label">
                Step {progress.current} / {progress.total}
              </span>
              <h2 className="face-reg-step-title">{progress.label}</h2>
            </div>

            <div className="face-reg-progress-track">
              <div
                className="face-reg-progress-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>

            <div className="face-reg-tip">
              💡 Move slowly and keep your face centered in the frame.
            </div>

            <button onClick={handleStopVerification} className="face-reg-cancel-btn">
              Cancel registration
            </button>
          </div>

          <div className="face-reg-camera-panel">
            <CameraFeed
              key={verificationSession?.session_id}
              verificationSession={verificationSession}
              mode="register"
              onSubmit={registerFace}
              onProgressChange={setProgress}
              onRetry={handleRetrySession}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default FaceRegistration;
