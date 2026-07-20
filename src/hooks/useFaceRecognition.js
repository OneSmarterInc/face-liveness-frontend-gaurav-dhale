import { useCallback, useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";
import { alignFaceTo112 } from "../utils/faceAlignment";

const RECOGNITION_MODEL_URL = "/models/w600k_r50.onnx";

// Match this to the onnxruntime-web version in package.json.
ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";

function preprocess(alignedCanvas) {
  const ctx = alignedCanvas.getContext("2d");
  const { data } = ctx.getImageData(0, 0, 112, 112);

  const planeSize = 112 * 112;
  const floatData = new Float32Array(3 * planeSize);

  // HWC RGBA -> CHW RGB, normalized to [-1, 1] (InsightFace convention).
  for (let i = 0; i < planeSize; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    floatData[i] = (r - 127.5) / 128.0;
    floatData[planeSize + i] = (g - 127.5) / 128.0;
    floatData[2 * planeSize + i] = (b - 127.5) / 128.0;
  }

  return new ort.Tensor("float32", floatData, [1, 3, 112, 112]);
}

function l2Normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1e-10;
  return vec.map((v) => v / norm);
}

// NOTE: this hook used to load its own second @mediapipe/tasks-vision
// FaceLandmarker (a separate WASM runtime, fetched/instantiated on mount)
// purely to re-detect landmarks that useFaceMesh had already computed for
// the exact same video feed a moment earlier. That duplicate model load
// sitting in memory alongside useFaceMesh's live per-frame loop was the
// likely source of the "mesh lags 1-2s" slowdown reported after wiring in
// recognition - not the embedding call itself, which already only ran
// once (see CameraFeed's SUCCESS-gated effect).
//
// Fix: this hook now takes the landmarks as an argument instead of
// detecting them itself. Callers should pass the ref from useFaceMesh
// (e.g. `latestLandmarksRef.current`) captured as close as possible to
// the moment the embedding frame was captured.
export default function useFaceRecognition() {
  const sessionRef = useRef(null);
  const initPromiseRef = useRef(null);

  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    initPromiseRef.current = (async () => {
      try {
        console.log("Creating ONNX session...");
        const session = await ort.InferenceSession.create(
          RECOGNITION_MODEL_URL,
          {
            executionProviders: ["wasm"],
          },
        );
        console.log("ONNX session created");

        if (cancelled) return;

        sessionRef.current = session;
        setIsModelReady(true);
      } catch (err) {
        console.error("useFaceRecognition: model initialization failed:", err);
        setError(err);
        throw err;
      }
    })();

    return () => {
      cancelled = true;
      sessionRef.current = null;
    };
  }, []);

  /**
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} image - still
   *   frame to embed (e.g. the best captured liveness frame).
   * @param {Array<{x:number,y:number}>} landmarks - full MediaPipe
   *   (468/478-point, normalized 0-1) landmark list for that same frame,
   *   e.g. `latestLandmarksRef.current` from useFaceMesh. Passed in
   *   rather than re-detected so this hook doesn't need its own
   *   FaceLandmarker/WASM runtime.
   * @returns {Promise<number[]>} 512-d L2-normalized embedding.
   */
  const generateEmbedding = useCallback(async (image, landmarks) => {
    // Make sure init has finished (and re-throw if it failed) before using
    // the model, regardless of whether isModelReady state has flushed to
    // this closure yet.
    if (initPromiseRef.current) {
      await initPromiseRef.current;
    }

    const session = sessionRef.current;

    if (!session) {
      throw new Error("Face recognition model is not loaded yet.");
    }

    if (!Array.isArray(landmarks) || landmarks.length === 0) {
      throw new Error(
        "generateEmbedding: no landmarks available for the captured frame.",
      );
    }

    const width = image.videoWidth ?? image.width;
    const height = image.videoHeight ?? image.height;

    if (!width || !height) {
      throw new Error(
        "generateEmbedding: could not determine image dimensions.",
      );
    }

    const aligned = alignFaceTo112(image, landmarks, width, height);
    const inputTensor = preprocess(aligned);

    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];

    const results = await session.run({ [inputName]: inputTensor });
    const embedding = Array.from(results[outputName].data);

    return l2Normalize(embedding);
  }, []);

  return { generateEmbedding, isModelReady, error };
}