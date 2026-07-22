import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { calculateYaw } from "../utils/yaw";
import { calculateEAR, calculateEyeAspectRatios } from "../utils/ear";
import { calculatePitch, calculateRoll } from "../utils/headPose";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Detector version reported in the `detector` block of the verification
// payload — kept in sync with the WASM_URL above rather than duplicated.
export const MEDIAPIPE_VERSION =
  WASM_URL.match(/tasks-vision@([\d.]+)/)?.[1] ?? "unknown";

export default function useFaceMesh(videoRef) {
  const canvasRef = useRef(null);

  const faceLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const ctxRef = useRef(null);
  const errorCountRef = useRef(0);
  const hasLoggedFatalRef = useRef(false);


  const latestLandmarksRef = useRef(null);

  const MAX_CONSECUTIVE_ERRORS = 5;

  const [state, setState] = useState({
    faceCount: 0,
    isFaceCentered: false,
    isFaceLargeEnough: false,
    canStartVerification: false,
    yaw: 0,
    ear: null,
    pitch: 0,
    roll: 0,
    earLeft: null,
    earRight: null,
    faceConfidence: 0,
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    mountedRef.current = true;

    async function initialize() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);

        const faceLandmarker = await FaceLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: MODEL_URL,
            },
            runningMode: "VIDEO",
            numFaces: 2,
          }
        );

        if (!mountedRef.current) {
          faceLandmarker.close();
          return;
        }

        faceLandmarkerRef.current = faceLandmarker;

        detect();
      } catch (err) {
        console.error("FaceMesh initialization failed:", err);
        hasLoggedFatalRef.current = true;
        setError(err);
      }
    }

    function detect() {
      if (!mountedRef.current) return;
      if (hasLoggedFatalRef.current) return; // stopped for good, don't reschedule

      animationFrameRef.current = requestAnimationFrame(detect);

      const landmarker = faceLandmarkerRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!landmarker || !video || !canvas) return;

      if (processingRef.current) return;

      if (
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return;
      }

      processingRef.current = true;

      try {
        if (!ctxRef.current) {
          ctxRef.current = canvas.getContext("2d");
        }

        const ctx = ctxRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const results = landmarker.detectForVideo(
          video,
          performance.now()
        );

        const faces = results.faceLandmarks || [];

        if (faces.length === 0) {
          latestLandmarksRef.current = null;
        }

        let nextState = {
          faceCount: faces.length,
          isFaceCentered: false,
          isFaceLargeEnough: false,
          canStartVerification: false,
          yaw: 0,
          ear: null,
          pitch: 0,
          roll: 0,
          earLeft: null,
          earRight: null,
          faceConfidence: 0,
        };

        if (faces.length > 0) {
          ctx.fillStyle = "#00ff00";

          const face = faces[0];

          latestLandmarksRef.current = face;

          let minX = 1;
          let maxX = 0;
          let minY = 1;
          let maxY = 0;

          for (const landmark of face) {
            ctx.beginPath();
            ctx.arc(
              landmark.x * canvas.width,
              landmark.y * canvas.height,
              1.5,
              0,
              Math.PI * 2
            );
            ctx.fill();

            minX = Math.min(minX, landmark.x);
            maxX = Math.max(maxX, landmark.x);
            minY = Math.min(minY, landmark.y);
            maxY = Math.max(maxY, landmark.y);
          }

          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          const faceWidth = maxX - minX;
          const faceHeight = maxY - minY;

          const centered =
            Math.abs(centerX - 0.5) < 0.1 &&
            Math.abs(centerY - 0.5) < 0.12;

          const largeEnough =
            faceWidth > 0.28 &&
            faceHeight > 0.42;

          const earPair = calculateEyeAspectRatios(
            face,
            canvas.width,
            canvas.height,
          );

          // MediaPipe FaceLandmarker doesn't expose a per-frame detection
          // confidence score here (that needs the separate face-detector
          // output / blendshapes, not enabled for this use case). This is
          // a lightweight proxy — 1.0 for a single, centered,
          // appropriately-sized face, decaying as those signals degrade —
          // not a model probability.
          const faceConfidence = Math.max(
            0,
            1 - (centered ? 0 : 0.3) - (largeEnough ? 0 : 0.3),
          );

          nextState = {
            faceCount: faces.length,
            isFaceCentered: centered,
            isFaceLargeEnough: largeEnough,
            canStartVerification:
              faces.length === 1 &&
              centered &&
              largeEnough,
            yaw: calculateYaw(face),
            ear: calculateEAR(face, canvas.width, canvas.height),
            pitch: calculatePitch(face),
            roll: calculateRoll(face),
            earLeft: earPair.left,
            earRight: earPair.right,
            faceConfidence: Number(faceConfidence.toFixed(2)),
          };
        }

        errorCountRef.current = 0;

        setState((prev) => {
          if (
            prev.faceCount === nextState.faceCount &&
            prev.isFaceCentered === nextState.isFaceCentered &&
            prev.isFaceLargeEnough === nextState.isFaceLargeEnough &&
            prev.canStartVerification ===
              nextState.canStartVerification &&
            prev.yaw === nextState.yaw &&
            prev.ear === nextState.ear &&
            prev.pitch === nextState.pitch &&
            prev.roll === nextState.roll &&
            prev.earLeft === nextState.earLeft &&
            prev.earRight === nextState.earRight &&
            prev.faceConfidence === nextState.faceConfidence
          ) {
            return prev;
          }

          return nextState;
        });
      } catch (err) {
        errorCountRef.current += 1;

        if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
          if (!hasLoggedFatalRef.current) {
            hasLoggedFatalRef.current = true;
            console.error(
              "FaceMesh: detection failed repeatedly, stopping. " +
                "This is usually the browser failing to provide a working " +
                "graphics context (GPU/WebGL unavailable or blocklisted) " +
                "rather than a bug in this component. Last error:",
              err
            );
            setError(err);
          }

        } else {
          console.warn(
            `FaceMesh: detection error (${errorCountRef.current}/${MAX_CONSECUTIVE_ERRORS}), retrying:`,
            err
          );
        }
      } finally {
        processingRef.current = false;
      }
    }

    initialize();

    return () => {
      mountedRef.current = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      processingRef.current = false;

      setTimeout(() => {
        try {
          faceLandmarkerRef.current?.close();
        } catch (e) {}

        faceLandmarkerRef.current = null;
      }, 0);
    };
  }, [videoRef]);

  return {
    canvasRef,
    latestLandmarksRef,
    ...state,
    error,
  };
}