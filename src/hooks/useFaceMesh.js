import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { calculateYaw } from "../utils/yaw";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export default function useFaceMesh(videoRef) {
  const canvasRef = useRef(null);

  const faceLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const ctxRef = useRef(null);
  const errorCountRef = useRef(0);
  const hasLoggedFatalRef = useRef(false);

  const MAX_CONSECUTIVE_ERRORS = 5;

  const [state, setState] = useState({
    faceCount: 0,
    isFaceCentered: false,
    isFaceLargeEnough: false,
    canStartVerification: false,
    yaw: 0,
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

        let nextState = {
          faceCount: faces.length,
          isFaceCentered: false,
          isFaceLargeEnough: false,
          canStartVerification: false,
          yaw: 0,
        };

        if (faces.length > 0) {
          ctx.fillStyle = "#00ff00";

          const face = faces[0];

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

          nextState = {
            faceCount: faces.length,
            isFaceCentered: centered,
            isFaceLargeEnough: largeEnough,
            canStartVerification:
              faces.length === 1 &&
              centered &&
              largeEnough,
            yaw: calculateYaw(face),
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
            prev.yaw === nextState.yaw
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
    ...state,
    error,
  };
}