import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useCamera from "../../hooks/useCamera";
import useFaceMesh, { MEDIAPIPE_VERSION } from "../../hooks/useFaceMesh";
import FaceGuide from "./FaceGuide";
import useLiveness from "../../hooks/useLiveness";
import useFaceRecognition from "../../hooks/useFaceRecognition";
import StatusIndicator from "../UI/StatusIndicator";
import { VERIFICATION_STEP } from "../../utils/verificationStatus";
import { getFailureMessage } from "../../utils/livenessStates";
import { mapBackendChallenges } from "../../utils/challengeMapper";
import { getChallengeInstruction } from "../../utils/Challengeinstructions";
import { buildVerificationPayload } from "../../utils/buildVerificationPayload";
import { evaluateLivenessResult } from "../../utils/evaluateLivenessResult";
import { completeSession } from "../../services/identityVerification";
import { useAuth } from "../../context/AuthContext";

function CameraFeed({ verificationSession, onRetry }) {
  const {
    videoRef,
    error,
    capture,
    captureFrame,
    stopCamera,
    clearCapture,
    addFrameToBuffer,
    clearFrameBuffer,
    cameraSettingsRef,
  } = useCamera();
  const [verificationStatus, setVerificationStatus] = useState("running");
  const [verificationStep, setVerificationStep] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const navigate = useNavigate();
  const hasCapturedRef = useRef(false);
  const bufferCanvasRef = useRef(document.createElement("canvas"));
  const verificationStartedAtRef = useRef(null);
  const lastCapturedImageRef = useRef(null);

  const { register: registerFaceRecognition } = useFaceRecognition();

  const qualityRef = useRef({
    multipleFacesDetected: false,
    faceLostDetected: false,
    centeredBroke: false,
    tooSmallBroke: false,
  });
  const neutralVisitedStepsRef = useRef(new Set());

  function resetLivenessEvidence() {
    qualityRef.current = {
      multipleFacesDetected: false,
      faceLostDetected: false,
      centeredBroke: false,
      tooSmallBroke: false,
    };
    neutralVisitedStepsRef.current = new Set();
  }
  const { completeLiveness } = useAuth();
  const {
    canvasRef,
    faceCount,
    isFaceCentered,
    isFaceLargeEnough,
    canStartVerification,
    yaw,
    ear,
    pitch,
    roll,
    earLeft,
    earRight,
    faceConfidence,
  } = useFaceMesh(videoRef);

  const challenges = useMemo(
    () => mapBackendChallenges(verificationSession.challenge_sequence),
    [verificationSession.challenge_sequence],
  );

  const pose = useMemo(
    () => ({ pitch, roll, earLeft, earRight, faceConfidence }),
    [pitch, roll, earLeft, earRight, faceConfidence],
  );

  const {
    state,
    sequence,
    currentStep,
    currentChallenge,
    completedChallenges,
    phase,
    failureReason,
    retry,
    telemetryRef,
  } = useLiveness(canStartVerification, yaw, ear, { challenges, pose });

  if (!verificationSession) {
    return (
      <div
        style={{
          color: "#facc15",
          textAlign: "center",
          fontSize: "18px",
        }}
      >
        No verification session available.
      </div>
    );
  }

  const getStatus = () => {
    if (faceCount === 0) return "No Face Detected";

    if (faceCount > 1) return "Multiple Faces Detected";

    if (!isFaceLargeEnough) return "Move Closer";

    if (!isFaceCentered) return "Center Your Face";

    return "Ready";
  };

  const handleRetry = () => {
    clearFrameBuffer();
    clearCapture();
    hasCapturedRef.current = false;
    verificationStartedAtRef.current = null;
    resetLivenessEvidence();
    retry();
  };

  const handleBackendRetry = async () => {
    setRetryError("");
    setIsRetrying(true);

    try {
      await onRetry();
    } catch (err) {
      console.error("Failed to start a new verification session:", err);
      setRetryError(err.message || "Unable to start a new verification session.");
      setIsRetrying(false);
    }
  };


  const handleRetryRegistration = async () => {
    if (!lastCapturedImageRef.current) return;

    setVerificationStep(VERIFICATION_STEP.REGISTRATION_STARTED);

    try {
      const response = await registerFaceRecognition(
        verificationSession.session_id,
        lastCapturedImageRef.current,
      );

      setVerificationStep(VERIFICATION_STEP.REGISTRATION_COMPLETE);
      completeLiveness();
      stopCamera();

      navigate("/home", {
        replace: true,
        state: { verification: response },
      });
    } catch (err) {
      console.error("Face registration retry failed:", err);
      setVerificationStep(VERIFICATION_STEP.REGISTRATION_FAILED);
    }
  };

  useEffect(() => {
    if (state !== "PROMPT") return;

    if (faceCount > 1) qualityRef.current.multipleFacesDetected = true;
    if (faceCount === 0) qualityRef.current.faceLostDetected = true;
    if (faceCount === 1 && !isFaceCentered)
      qualityRef.current.centeredBroke = true;
    if (faceCount === 1 && !isFaceLargeEnough)
      qualityRef.current.tooSmallBroke = true;
  }, [state, faceCount, isFaceCentered, isFaceLargeEnough]);

  useEffect(() => {
    if (phase === "WAIT_FOR_TARGET") {
      neutralVisitedStepsRef.current.add(currentStep);
    }
  }, [phase, currentStep]);

  useEffect(() => {
    if (state === "PROMPT" && !verificationStartedAtRef.current) {
      verificationStartedAtRef.current = new Date().toISOString();
    }
  }, [state]);

  useEffect(() => {
    if (state !== "SUCCESS") {
      hasCapturedRef.current = false;
      return;
    }

    if (hasCapturedRef.current) return;

    hasCapturedRef.current = true;

    async function submitVerification() {
      try {
        setVerificationStep(VERIFICATION_STEP.LIVENESS_CHECKING);

        const capturedFrame = await captureFrame();
        const completedAt = new Date().toISOString();

        const computedResult = evaluateLivenessResult({
          state,
          failureReason,
          completedChallenges,
          expectedSequence: challenges,
          neutralVisitedSteps: neutralVisitedStepsRef.current,
          quality: qualityRef.current,
          startedAt: verificationStartedAtRef.current,
          completedAt,
          capturedImage: capturedFrame,
        });

        if (computedResult !== "passed") {
          return;
        }

        const payload = buildVerificationPayload({
          verificationSession,
          completedChallenges,
          telemetry: telemetryRef.current,
          capture: capturedFrame,
          startedAt: verificationStartedAtRef.current,
          completedAt,
          camera: cameraSettingsRef.current,
          detector: { provider: "MediaPipe", version: MEDIAPIPE_VERSION },
        });

        setVerificationStatus("submitting");
        const response = await completeSession(
          verificationSession.session_id,
          payload,
        );

        console.log("✅ Backend Response", response);

        const livenessPassed =
          String(response?.liveness_result ?? "").toLowerCase() === "passed";

        const sessionCompleted =
          String(response?.status ?? "").toLowerCase() === "completed";

        if (!(livenessPassed && sessionCompleted)) {
          // Backend says liveness failed (or the session otherwise didn't
          // complete): turn the camera off immediately and surface the
          // retry popup — retrying from here creates a brand new session.
          console.warn("❌ Backend rejected liveness.", response);

          setVerificationStep(VERIFICATION_STEP.LIVENESS_FAILED);

          stopCamera();

          setVerificationStatus("failed");

          hasCapturedRef.current = false;

          clearFrameBuffer();
          clearCapture();
          resetLivenessEvidence();

          return;
        }

        setVerificationStatus("passed");
        setVerificationStep(VERIFICATION_STEP.LIVENESS_COMPLETE);

        lastCapturedImageRef.current = payload.capture.image;
        setVerificationStep(VERIFICATION_STEP.REGISTRATION_STARTED);

        try {
          const registrationResponse = await registerFaceRecognition(
            verificationSession.session_id,
            payload.capture.image,
          );

          setVerificationStep(VERIFICATION_STEP.REGISTRATION_COMPLETE);

          completeLiveness();
          stopCamera();

          navigate("/home", {
            replace: true,
            state: {
              verification: response,
              registration: registrationResponse,
            },
          });
        } catch (registrationError) {
          console.error("Face registration failed:", registrationError);
          setVerificationStep(VERIFICATION_STEP.REGISTRATION_FAILED);
          stopCamera();
        }
      } catch (error) {
        console.error(error);
      }
    }

    submitVerification();
  }, [
    state,
    failureReason,
    completedChallenges,
    challenges,
    captureFrame,
    stopCamera,
    verificationSession,
    navigate,
    telemetryRef,
    cameraSettingsRef,
    completeLiveness,
    registerFaceRecognition,
  ]);

  useEffect(() => {
    if (phase !== "WAIT_FOR_CAPTURE") return;

    if (!canStartVerification) return;

    if (Math.abs(yaw) > 8) return;

    if (faceCount !== 1) return;

    if (!isFaceCentered) return;

    if (!isFaceLargeEnough) return;

    if (!videoRef.current) return;

    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = bufferCanvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0);

    // Simple MVP score
    const score = 100 - Math.abs(yaw);

    addFrameToBuffer(canvas, score);
  }, [
    phase,
    yaw,
    faceCount,
    isFaceCentered,
    isFaceLargeEnough,
    canStartVerification,
  ]);

  if (error) {
    return (
      <div style={{ textAlign: "center", color: "#f87171" }}>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "12px",
            padding: "10px 20px",
            fontSize: "16px",
            cursor: "pointer",
            borderRadius: "8px",
            border: "none",
          }}
        >
          Reload
        </button>
      </div>
    );
  }

  if (verificationStatus === "failed") {
    return (
      <div
        style={{
          textAlign: "center",
          color: "#f87171",
          maxWidth: "360px",
          padding: "24px",
          borderRadius: "12px",
          background: "#1a2332",
        }}
      >
        <p style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>
          Liveness verification failed.
        </p>
        <p style={{ fontSize: "14px", color: "#9ca3af", marginTop: "8px" }}>
          Please try again.
        </p>

        {retryError && (
          <p style={{ fontSize: "13px", color: "#f87171", marginTop: "10px" }}>
            {retryError}
          </p>
        )}

        <button
          onClick={handleBackendRetry}
          disabled={isRetrying}
          style={{
            marginTop: "16px",
            padding: "10px 20px",
            fontSize: "16px",
            cursor: isRetrying ? "not-allowed" : "pointer",
            borderRadius: "8px",
            border: "none",
            opacity: isRetrying ? 0.7 : 1,
          }}
        >
          {isRetrying ? "Starting new session..." : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "500px",
          aspectRatio: "4 / 3",
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover", // or "contain", but canvas must match
            display: "block",
            borderRadius: "12px",
          }}
        />

        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />

        <FaceGuide />
      </div>

      <div
        style={{
          marginTop: "12px",
          textAlign: "center",
          fontSize: "18px",
          fontWeight: "bold",
          color: canStartVerification ? "#22c55e" : "#facc15",
        }}
      >
        {state === "SUCCESS" ? "Liveness Passed" : getStatus()}
      </div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "13px",
          color: "#9ca3af",
        }}
      >
        Session: {verificationSession.session_id}
      </div>
      {state !== "SUCCESS" && (
        <div
          style={{
            marginTop: "8px",
            textAlign: "center",
            fontSize: "16px",
            color: "#ffffff",
          }}
        >
          Yaw: {yaw}°
        </div>
      )}
      {state === "FAILED" && (
        <div
          style={{
            marginTop: "16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              color: "#f87171",
              fontWeight: "bold",
              maxWidth: "360px",
            }}
          >
            {getFailureMessage(failureReason)}
          </div>
          <button
            onClick={handleRetry}
            style={{
              marginTop: "12px",
              padding: "10px 20px",
              fontSize: "16px",
              cursor: "pointer",
              borderRadius: "8px",
              border: "none",
            }}
          >
            Retry
          </button>
        </div>
      )}
      {canStartVerification && state !== "FAILED" && sequence.length > 0 && (
        <>
          {state !== "SUCCESS" && currentChallenge && (
            <>
              <div
                style={{
                  marginTop: "10px",
                  textAlign: "center",
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#60a5fa",
                }}
              >
                {phase === "WAIT_FOR_NEUTRAL"
                  ? "Face Forward"
                  : currentChallenge?.label}
              </div>
              {phase !== "WAIT_FOR_NEUTRAL" && (
                <div
                  style={{
                    marginTop: "4px",
                    textAlign: "center",
                    fontSize: "14px",
                    color: "#9ca3af",
                  }}
                >
                  {getChallengeInstruction(currentChallenge?.type)}
                </div>
              )}
            </>
          )}

          {state !== "SUCCESS" && completedChallenges.length > 0 && (
            <div
              style={{
                marginTop: "10px",
                textAlign: "center",
                fontSize: "16px",
                color: "#22c55e",
              }}
            >
              Completed: {completedChallenges.map((c) => c.label).join(" → ")}
            </div>
          )}

          {state === "SUCCESS" && (
            <div
              style={{
                marginTop: "20px",
                fontSize: "24px",
                fontWeight: "bold",
                color: "#22c55e",
              }}
            >
              ✅ Liveness Passed
              {capture && (
                <div
                  style={{
                    marginTop: "20px",
                    textAlign: "center",
                  }}
                >
                  <img
                    src={capture.url}
                    alt="Captured Face"
                    style={{
                      width: "220px",
                      borderRadius: "12px",
                      border: "2px solid #22c55e",
                    }}
                  />
                </div>
              )}

              <StatusIndicator step={verificationStep} />

              {verificationStep === VERIFICATION_STEP.REGISTRATION_FAILED && (
                <button
                  onClick={handleRetryRegistration}
                  style={{
                    marginTop: "16px",
                    padding: "10px 20px",
                    fontSize: "16px",
                    fontWeight: 600,
                    cursor: "pointer",
                    borderRadius: "8px",
                    border: "none",
                  }}
                >
                  Retry Registration
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CameraFeed;