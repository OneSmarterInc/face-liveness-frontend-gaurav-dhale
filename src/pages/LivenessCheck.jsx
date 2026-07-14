import { useState } from "react";
import CameraFeed from "../components/Camera/CameraFeed";
import { createSession } from "../services/identityVerification";
import { useAuth } from "../context/AuthContext";

function LivenessCheck() {
  const [isVerificationStarted, setIsVerificationStarted] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [verificationSession, setVerificationSession] = useState(null);
  const [error, setError] = useState("");
  const { logout } = useAuth();

  const handleStartVerification = async () => {
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
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#111827",
        flexDirection: "column",
        gap: "20px",
        position: "relative",
      }}
    >
      {/* <button
        onClick={logout}
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          padding: "8px 16px",
          fontSize: "14px",
          cursor: "pointer",
          borderRadius: "8px",
          border: "1px solid #374151",
          background: "#1f2937",
          color: "white",
        }}
      >
        Logout
      </button> */}

      {!isVerificationStarted ? (
        <>
          <button
            onClick={handleStartVerification}
            disabled={isCreatingSession}
            style={{
              padding: "14px 24px",
              fontSize: "18px",
              cursor: isCreatingSession ? "not-allowed" : "pointer",
              borderRadius: "8px",
              border: "none",
              opacity: isCreatingSession ? 0.7 : 1,
            }}
          >
            {isCreatingSession
              ? "Creating Verification Session..."
              : "Start Verification"}
          </button>

          {error && (
            <p
              style={{
                color: "#ef4444",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <CameraFeed verificationSession={verificationSession} />

          <button
            onClick={handleStopVerification}
            style={{
              padding: "14px 24px",
              fontSize: "18px",
              cursor: "pointer",
              borderRadius: "8px",
              border: "none",
            }}
          >
            Stop Verification
          </button>
        </>
      )}
    </div>
  );
}

export default LivenessCheck;