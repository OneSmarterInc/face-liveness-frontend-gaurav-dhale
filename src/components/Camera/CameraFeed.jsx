import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useCamera from "../../hooks/useCamera";
import useFaceMesh from "../../hooks/useFaceMesh";
import FaceGuide from "./FaceGuide";
import useLiveness from "../../hooks/useLiveness";
import useFaceRecognition from "../../hooks/useFaceRecognition";
import { getFailureMessage } from "../../utils/livenessStates";
import { mapBackendChallenges } from "../../utils/challengeMapper";
import { getChallengeInstruction } from "../../utils/Challengeinstructions";
import { buildVerificationPayload } from "../../utils/buildVerificationPayload";
import { evaluateLivenessResult } from "../../utils/evaluateLivenessResult";
import { completeSession } from "../../services/identityVerification";
import { useAuth } from "../../context/AuthContext";
function CameraFeed({ verificationSession }) {
  const {
    videoRef,
    error,
    capturedImage,
    captureFrame,
    stopCamera,
    clearCapture,
    addFrameToBuffer,
    clearFrameBuffer,
  } = useCamera();
  const navigate = useNavigate();
  const hasCapturedRef = useRef(false);
  const bufferCanvasRef = useRef(document.createElement("canvas"));
  const [verificationPayload, setVerificationPayload] = useState(null);
  const verificationStartedAtRef = useRef(null);

  
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
  const { generateEmbedding, isModelReady: isFaceModelReady } = useFaceRecognition();
  const {
    canvasRef,
    latestLandmarksRef,
    faceCount,
    isFaceCentered,
    isFaceLargeEnough,
    canStartVerification,
    yaw,
    ear,
  } = useFaceMesh(videoRef);

  const challenges = useMemo(
    () => mapBackendChallenges(verificationSession.challenge_sequence),
    [verificationSession.challenge_sequence],
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
  } = useLiveness(canStartVerification, yaw, ear, { challenges });

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

  useEffect(() => {
    console.log("Verification Session Created");
    console.log(verificationSession);
  }, [verificationSession]);

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
    setVerificationPayload(null);
    verificationStartedAtRef.current = null;
    resetLivenessEvidence();
    retry();
  };

  // Track whether the face conditions ever broke while verification was
  // actively running. Only recorded while PROMPT is active — this isn't
  // meant to flag the brief pre-start state before a face is even found.
  useEffect(() => {
    if (state !== "PROMPT") return;

    if (faceCount > 1) qualityRef.current.multipleFacesDetected = true;
    if (faceCount === 0) qualityRef.current.faceLostDetected = true;
    if (faceCount === 1 && !isFaceCentered) qualityRef.current.centeredBroke = true;
    if (faceCount === 1 && !isFaceLargeEnough) qualityRef.current.tooSmallBroke = true;
  }, [state, faceCount, isFaceCentered, isFaceLargeEnough]);

  // Record, per step index, that WAIT_FOR_NEUTRAL -> WAIT_FOR_TARGET was
  // actually observed before that step's challenge was evaluated — i.e. the
  // user genuinely returned to neutral, not just that the reducer's phase
  // field currently claims so.
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
        const capture = await captureFrame();
        const capturedLandmarks = latestLandmarksRef.current;
        const completedAt = new Date().toISOString();

        // Best-effort: a failed/slow embedding should not block submission
        // of the liveness result itself, so this never throws out of here.
        let faceEmbedding = null;
        try {
          const blob = capture?.blob ?? capture;
          console.log("blob",blob)
          if (blob) {
            const bitmap = await createImageBitmap(blob);
            console.log("bitmap",bitmap)
            try {
              faceEmbedding = await generateEmbedding(bitmap, capturedLandmarks);
            } finally {
              bitmap.close?.();
            }
          }
        } catch (embeddingError) {
          console.error("❌ Face embedding generation failed:", embeddingError);
        }

        const computedResult = evaluateLivenessResult({
          state,
          failureReason,
          completedChallenges,
          expectedSequence: challenges,
          neutralVisitedSteps: neutralVisitedStepsRef.current,
          quality: qualityRef.current,
          startedAt: verificationStartedAtRef.current,
          completedAt,
          capturedImage: capture,
        });

        const payload = buildVerificationPayload({
          verificationSession,
          completedChallenges,
          startedAt: verificationStartedAtRef.current,
          completedAt,
          computedResult,
          faceEmbedding,
        });

        console.log("🚀 Verification Payload");

        const response = await completeSession(
          verificationSession.session_id,
          payload,
        );
        completeLiveness();

        navigate("/home", {
          replace: true,
          state: {
            verification: response,
          },
        });

        console.log("✅ Backend Response");
        console.log(response);

        setVerificationPayload(response);

        stopCamera();

        navigate("/home", {
          replace: true,
          state: {
            verification: response,
          },
        });
      } catch (error) {
        console.error("❌ Verification submission failed");
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
    generateEmbedding,
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
      {!isFaceModelReady && (
        <div
          style={{
            marginTop: "4px",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          Loading face recognition model…
        </div>
      )}
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
              {capturedImage && (
                <div
                  style={{
                    marginTop: "20px",
                    textAlign: "center",
                  }}
                >
                  <img
                    src={capturedImage.url}
                    alt="Captured Face"
                    style={{
                      width: "220px",
                      borderRadius: "12px",
                      border: "2px solid #22c55e",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CameraFeed;