import { useEffect, useRef, useState } from "react";
import { computeImageQuality } from "../utils/quality";

const MAX_BUFFER_SIZE = 5;

export default function useCamera() {
  const videoRef = useRef(null);
  const frameBufferRef = useRef([]);
  const cameraSettingsRef = useRef({ width: null, height: null, fps: null });
  const [error, setError] = useState(null);
  const [capture, setCapture] = useState(null);

  useEffect(() => {
    let stream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings?.() ?? {};

        cameraSettingsRef.current = {
          width: settings.width ?? null,
          height: settings.height ?? null,
          fps: settings.frameRate ? Math.round(settings.frameRate) : null,
        };
      } catch (err) {
        setError(err.message);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);


  function finalizeCapture(canvas) {
    const quality = computeImageQuality(canvas);
    const frameTimestamp = new Date().toISOString();


    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const base64 = dataUrl.split(",")[1] ?? null;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);

          const imageUrl = URL.createObjectURL(blob);

          const captured = {
            blob,
            base64,
            url: imageUrl,
            type: blob.type,
            size: blob.size,
            width: canvas.width,
            height: canvas.height,
            frameTimestamp,
            qualityScore: quality.quality_score,
            sharpness: quality.sharpness,
            brightness: quality.brightness,
          };

          setCapture(captured);

          resolve(captured);
        },
        "image/jpeg",
        0.95,
      );
    });
  }

  const captureFrame = () => {
    if (frameBufferRef.current.length > 0) {
      const bestFrame = frameBufferRef.current.reduce((best, current) =>
        current.score > best.score ? current : best,
      );

      return finalizeCapture(bestFrame.canvas);
    }

    if (
      !videoRef.current ||
      videoRef.current.videoWidth === 0 ||
      videoRef.current.videoHeight === 0
    ) {
      return null;
    }

    const video = videoRef.current;
    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    return finalizeCapture(canvas);
  };

  const addFrameToBuffer = (sourceCanvas, score) => {
    const snapshot = document.createElement("canvas");

    snapshot.width = sourceCanvas.width;
    snapshot.height = sourceCanvas.height;

    const ctx = snapshot.getContext("2d");

    ctx.drawImage(sourceCanvas, 0, 0);

    frameBufferRef.current.push({
      canvas: snapshot,
      score,
      timestamp: Date.now(),
    });

    if (frameBufferRef.current.length > MAX_BUFFER_SIZE) {
      frameBufferRef.current.shift();
    }
  };
  const clearFrameBuffer = () => {
    frameBufferRef.current = [];
  };
  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;

    if (!stream) return;

    stream.getTracks().forEach((track) => track.stop());

    videoRef.current.srcObject = null;
  };

  const clearCapture = () => {
    if (capture?.url) {
      URL.revokeObjectURL(capture.url);
    }

    setCapture(null);
  };

  return {
    videoRef,
    error,
    capture,
    captureFrame,
    stopCamera,
    clearCapture,
    frameBufferRef,
    addFrameToBuffer,
    clearFrameBuffer,
    cameraSettingsRef,
  };
}
