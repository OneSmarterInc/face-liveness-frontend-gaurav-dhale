import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useCamera from "../../hooks/useCamera";
import useFaceMesh, { MEDIAPIPE_VERSION } from "../../hooks/useFaceMesh";
import FaceGuide from "./FaceGuide";
import useLiveness from "../../hooks/useLiveness";
import StatusIndicator from "../UI/StatusIndicator";
import {
  VERIFICATION_STEP,
  VERIFICATION_STEP_LABELS,
  REQUIRES_NEW_SESSION_STEPS,
} from "../../utils/verificationStatus";
import { getFailureMessage } from "../../utils/livenessStates";
import { mapBackendChallenges } from "../../utils/challengeMapper";
import { getChallengeInstruction } from "../../utils/Challengeinstructions";
import { buildVerificationPayload } from "../../utils/buildVerificationPayload";
import { evaluateLivenessResult } from "../../utils/evaluateLivenessResult";
import {
  completeSession,
  IDENTITY_ERROR,
} from "../../services/identityVerification";
import { useAuth } from "../../context/AuthContext";

const FAILURE_DETAILS = {
  [VERIFICATION_STEP.VERIFY_FAILED]:
    "We couldn't match the captured image to your enrolled face. Please try again with good lighting and no obstructions.",
  [VERIFICATION_STEP.MULTIPLE_FACES_DETECTED]:
    "Make sure only your face is visible to the camera, then try again.",
  [VERIFICATION_STEP.POOR_IMAGE_QUALITY]:
    "The captured image was too blurry or too dark. Try again in better lighting, holding the camera steady.",
  [VERIFICATION_STEP.SESSION_EXPIRED]:
    "This verification session is no longer valid. Start a new one to continue.",
  [VERIFICATION_STEP.CONNECTION_ERROR]:
    "We couldn't reach the server. Check your connection and try again.",
  [VERIFICATION_STEP.REGISTRATION_FAILED]:
    "We couldn't save your face registration. You can retry with the same capture.",
};

const VERIFY_FAILURE_STEP_FOR_ERROR = {
  [IDENTITY_ERROR.MULTIPLE_FACES]: VERIFICATION_STEP.MULTIPLE_FACES_DETECTED,
  [IDENTITY_ERROR.POOR_QUALITY]: VERIFICATION_STEP.POOR_IMAGE_QUALITY,
  [IDENTITY_ERROR.SESSION_EXPIRED]: VERIFICATION_STEP.SESSION_EXPIRED,
  [IDENTITY_ERROR.NETWORK]: VERIFICATION_STEP.CONNECTION_ERROR,
  [IDENTITY_ERROR.TIMEOUT]: VERIFICATION_STEP.CONNECTION_ERROR,
  [IDENTITY_ERROR.SERVER_ERROR]: VERIFICATION_STEP.CONNECTION_ERROR,
  [IDENTITY_ERROR.RATE_LIMITED]: VERIFICATION_STEP.CONNECTION_ERROR,
};

function CameraFeed({ verificationSession, onRetry, mode, onSubmit }) {
  const isRegisterMode = mode === "register";

  const startStep = isRegisterMode
    ? VERIFICATION_STEP.REGISTRATION_STARTED
    : VERIFICATION_STEP.VERIFY_STARTED;
  const completeStep = isRegisterMode
    ? VERIFICATION_STEP.REGISTRATION_COMPLETE
    : VERIFICATION_STEP.VERIFY_COMPLETE;
  const failedStep = isRegisterMode
    ? VERIFICATION_STEP.REGISTRATION_FAILED
    : VERIFICATION_STEP.VERIFY_FAILED;

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
  const [isRetryingSubmit, setIsRetryingSubmit] = useState(false);
  const navigate = useNavigate();
  const hasCapturedRef = useRef(false);
  const bufferCanvasRef = useRef(document.createElement("canvas"));
  const verificationStartedAtRef = useRef(null);
  const lastCapturedImageRef = useRef(null);

  const isProcessingRef = useRef(false);

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

  const handleRetrySubmit = () => {
    if (!lastCapturedImageRef.current || isRetryingSubmit) return;
    submitCapturedImage(lastCapturedImageRef.current, { manual: true });
  };

  const submitCapturedImage = async (image, { manual = false } = {}) => {
    if (manual) setIsRetryingSubmit(true);
    setVerificationStep(startStep);

    try {
      const submitResponse = await onSubmit(verificationSession.session_id, image);

      setVerificationStep(completeStep);
      completeLiveness();
      stopCamera();

      navigate("/home", {
        replace: true,
        state: {
          [isRegisterMode ? "registration" : "recognition"]: submitResponse,
        },
      });
    } catch (err) {
      console.error(`Face ${mode} failed:`, err);

      if (isRegisterMode) {
        // Registration failures stay on this screen so the same capture can
        // be retried without redoing liveness.
        setVerificationStep(failedStep);
        stopCamera();
      } else {
        const classification = err.identityError || {};
        failWithNewSessionRequired(
          VERIFY_FAILURE_STEP_FOR_ERROR[classification.type] || failedStep,
        );
      }
    } finally {
      if (manual) setIsRetryingSubmit(false);
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

  const failWithNewSessionRequired = (step) => {
    setVerificationStep(step);
    stopCamera();
    setVerificationStatus("failed");
    hasCapturedRef.current = false;
    clearFrameBuffer();
    clearCapture();
    resetLivenessEvidence();
  };

  useEffect(() => {
    if (state !== "SUCCESS") {
      hasCapturedRef.current = false;
      return;
    }

    if (hasCapturedRef.current) return;
    if (isProcessingRef.current) return;

    hasCapturedRef.current = true;
    isProcessingRef.current = true;

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

        let response;
        try {
          response = await completeSession(
            verificationSession.session_id,
            payload,
          );
        } catch (completeError) {
          console.error("Failed to complete verification session:", completeError);
          const classification = completeError.identityError || {};
          const step =
            classification.type === IDENTITY_ERROR.SESSION_EXPIRED
              ? VERIFICATION_STEP.SESSION_EXPIRED
              : VERIFICATION_STEP.CONNECTION_ERROR;
          failWithNewSessionRequired(step);
          return;
        }

        console.log("✅ Backend Response", response);

        const livenessPassed =
          String(response?.liveness_result ?? "").toLowerCase() === "passed";

        const sessionCompleted =
          String(response?.status ?? "").toLowerCase() === "completed";

        if (!(livenessPassed && sessionCompleted)) {
          console.warn("❌ Backend rejected liveness.", response);
          failWithNewSessionRequired(VERIFICATION_STEP.LIVENESS_FAILED);
          return;
        }

        setVerificationStatus("passed");
        setVerificationStep(VERIFICATION_STEP.LIVENESS_COMPLETE);

        const capturedImage = payload.capture.image;
        lastCapturedImageRef.current = capturedImage;

        await submitCapturedImage(capturedImage);
      } catch (error) {
        console.error(error);
        failWithNewSessionRequired(VERIFICATION_STEP.CONNECTION_ERROR);
      } finally {
        isProcessingRef.current = false;
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
    const title =
      VERIFICATION_STEP_LABELS[verificationStep] || "Verification failed.";
    const detail =
      FAILURE_DETAILS[verificationStep] || "Please try again.";
    const needsNewSession = REQUIRES_NEW_SESSION_STEPS.has(verificationStep);

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
          {title}
        </p>
        <p style={{ fontSize: "14px", color: "#9ca3af", marginTop: "8px" }}>
          {detail}
        </p>

        {retryError && (
          <p style={{ fontSize: "13px", color: "#f87171", marginTop: "10px" }}>
            {retryError}
          </p>
        )}

        {needsNewSession && (
          <button
            onClick={handleBackendRetry}
            disabled={isRetrying}
            style={{
              marginTop: "16px",
              padding: "10px 20px",
              fontSize: "16px",
              fontWeight: 600,
              cursor: isRetrying ? "not-allowed" : "pointer",
              borderRadius: "8px",
              border: "none",
              opacity: isRetrying ? 0.7 : 1,
            }}
          >
            {isRetrying ? "Starting new session..." : "Try Again"}
          </button>
        )}
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
            objectFit: "cover",
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

              {verificationStep === failedStep && (
                <button
                  onClick={handleRetrySubmit}
                  disabled={isRetryingSubmit}
                  style={{
                    marginTop: "16px",
                    padding: "10px 20px",
                    fontSize: "16px",
                    fontWeight: 600,
                    cursor: isRetryingSubmit ? "not-allowed" : "pointer",
                    borderRadius: "8px",
                    border: "none",
                    opacity: isRetryingSubmit ? 0.7 : 1,
                  }}
                >
                  {isRetryingSubmit ? "Retrying…" : "Retry"}
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