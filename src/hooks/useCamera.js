import { useEffect, useRef, useState } from "react";
const MAX_BUFFER_SIZE = 5;

export default function useCamera() {
  const videoRef = useRef(null);
  const frameBufferRef = useRef([]);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

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

  const captureFrame = () => {
    if (
      !videoRef.current ||
      videoRef.current.videoWidth === 0 ||
      videoRef.current.videoHeight === 0
    ) {
      return null;
    }

    if (frameBufferRef.current.length > 0) {
      console.log("📦 Buffer Content");

      console.table(
        frameBufferRef.current.map((frame, index) => ({
          index,
          score: frame.score,
          timestamp: frame.timestamp,
        })),
      );
      const bestFrame = frameBufferRef.current.reduce((best, current) =>
        current.score > best.score ? current : best,
      );
      console.log("🏆 Selected Best Frame", {
        score: bestFrame.score,
        timestamp: bestFrame.timestamp,
      });

      return new Promise((resolve) => {
        bestFrame.canvas.toBlob(
          (blob) => {
            if (!blob) return;

            const imageUrl = URL.createObjectURL(blob);

            const capture = {
              blob,
              url: imageUrl,
              type: blob.type,
              size: blob.size,
              width: bestFrame.canvas.width,
              height: bestFrame.canvas.height,
              capturedAt: new Date().toISOString(),
            };

            setCapturedImage(capture);

            resolve(capture);
          },
          "image/jpeg",
          0.95,
        );
      });
    }

    const video = videoRef.current;

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return;

          const imageUrl = URL.createObjectURL(blob);

          setCapturedImage({
            blob,
            url: imageUrl,
          });

          resolve(blob);
        },
        "image/jpeg",
        0.95,
      );
    });
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
    console.log("📸 Frame Buffered", {
      score,
      totalFrames: frameBufferRef.current.length + 1,
      resolution: `${snapshot.width}x${snapshot.height}`,
    });

    if (frameBufferRef.current.length > MAX_BUFFER_SIZE) {
      frameBufferRef.current.shift();
      console.log("🗑 Removed oldest buffered frame");
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
    if (capturedImage?.url) {
      URL.revokeObjectURL(capturedImage.url);
    }

    setCapturedImage(null);
  };

  return {
    videoRef,
    error,
    capturedImage,
    captureFrame,
    stopCamera,
    clearCapture,
    frameBufferRef,
    addFrameToBuffer,
    clearFrameBuffer,
  };
}
