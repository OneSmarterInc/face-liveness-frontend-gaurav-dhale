import { useState } from "react";
import CameraFeed from "../components/Camera/CameraFeed";
import { createSession } from "../services/identityVerification";
import useFaceRecognition from "../hooks/useFaceRecognition";
import { useAuth } from "../context/AuthContext";

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 14px",
        background: "#1a2332",
        borderRadius: "10px",
        marginBottom: "10px",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: "30px",
          height: "30px",
          borderRadius: "8px",
          background: "#243244",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          color: ACCENT,
        }}
      >
        {icon}
      </div>
      <span style={{ color: "#d1d5db", fontSize: "14px" }}>{text}</span>
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#111827",
        position: "relative",
      }}
    >
      {!isVerificationStarted ? (
        // ----- Pre-registration: split-screen instructions -----
        <div
          style={{
            display: "flex",
            width: "100%",
            minHeight: "100vh",
            flexWrap: "wrap",
          }}
        >
          {/* Left: instructions */}
          <div
            style={{
              flex: "1 1 380px",
              maxWidth: "480px",
              display: "flex",
              flexDirection: "column",
              borderRight: "1px solid #1f2937",
            }}
          >
            <div style={{ padding: "28px 24px 20px", textAlign: "center" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: ACCENT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  margin: "0 auto 14px",
                }}
              >
                📋
              </div>
              <h1
                style={{
                  color: "#f9fafb",
                  fontSize: "19px",
                  fontWeight: 700,
                  margin: "0 0 6px",
                }}
              >
                Set Up Face Login
              </h1>
              <p style={{ color: ACCENT, fontSize: "13px", fontWeight: 600, margin: 0 }}>
                This is a one-time setup. Read the instructions carefully.
              </p>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px" }}>
              {INSTRUCTIONS.map((item, i) => (
                <InstructionRow key={i} {...item} />
              ))}
            </div>

            <div
              style={{
                padding: "16px 20px 24px",
                borderTop: "1px solid #1f2937",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "#f3f4f6",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                  style={{
                    width: "17px",
                    height: "17px",
                    accentColor: ACCENT,
                  }}
                />
                I have read and understood all the instructions.
              </label>
            </div>
          </div>

          {/* Right: start action */}
          <div
            style={{
              flex: "2 1 500px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0d1420",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <button
                onClick={handleStartVerification}
                disabled={isCreatingSession || !hasAgreed}
                style={{
                  padding: "16px 36px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor:
                    isCreatingSession || !hasAgreed ? "not-allowed" : "pointer",
                  borderRadius: "10px",
                  border: "none",
                  background: hasAgreed ? ACCENT : "#4b5563",
                  color: hasAgreed ? "#ffffff" : "#9ca3af",
                  opacity: isCreatingSession ? 0.7 : 1,
                  transition: "background 0.15s ease",
                }}
              >
                {isCreatingSession
                  ? "Creating verification session..."
                  : "Register My Face"}
              </button>

              <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "14px" }}>
                {hasAgreed
                  ? "Ready when you are."
                  : "Please confirm you've read the instructions to continue."}
              </p>

              {error && (
                <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "10px" }}>
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ----- Registration in progress: collapsed sidebar + camera -----
        <div
          style={{
            display: "flex",
            width: "100%",
            minHeight: "100vh",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "1 1 260px",
              maxWidth: "300px",
              padding: "24px 20px",
              borderRight: "1px solid #1f2937",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div>
              <span
                style={{
                  color: ACCENT,
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Step {progress.current} / {progress.total}
              </span>
              <h2
                style={{
                  color: "#f9fafb",
                  fontSize: "18px",
                  fontWeight: 700,
                  margin: "6px 0 0",
                }}
              >
                {progress.label}
              </h2>
            </div>

            <div
              style={{
                height: "6px",
                borderRadius: "999px",
                background: "#1f2937",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(progress.current / progress.total) * 100}%`,
                  background: ACCENT,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div style={{ color: "#9ca3af", fontSize: "13px", lineHeight: 1.6 }}>
              💡 Move slowly and keep your face centered in the frame.
            </div>

            <button
              onClick={handleStopVerification}
              style={{
                marginTop: "auto",
                padding: "12px 20px",
                fontSize: "15px",
                cursor: "pointer",
                borderRadius: "8px",
                border: "1px solid #374151",
                background: "transparent",
                color: "#e5e7eb",
              }}
            >
              Cancel registration
            </button>
          </div>

          <div
            style={{
              flex: "2 1 500px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0d1420",
            }}
          >
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
