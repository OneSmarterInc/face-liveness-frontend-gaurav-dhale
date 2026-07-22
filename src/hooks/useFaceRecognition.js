import { useCallback, useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";
import { alignFaceTo112 } from "../utils/faceAlignment";

const RECOGNITION_MODEL_URL = "/models/w600k_r50.onnx";

/**
 * Temporary feature flag.
 *
 * Current Architecture:
 *      Backend generates the face embedding.
 *
 * Future Architecture:
 *      Enable this flag to restore client-side InsightFace inference
 *      without rewriting the implementation.
 */
const ENABLE_CLIENT_FACE_RECOGNITION = false;

ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";

function preprocess(alignedCanvas) {
  const ctx = alignedCanvas.getContext("2d");
  const { data } = ctx.getImageData(0, 0, 112, 112);

  const planeSize = 112 * 112;
  const floatData = new Float32Array(3 * planeSize);

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

export default function useFaceRecognition() {
  const sessionRef = useRef(null);
  const initPromiseRef = useRef(null);

  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ENABLE_CLIENT_FACE_RECOGNITION) {
      console.info(
        "[FaceRecognition] Client-side InsightFace is temporarily disabled. Backend is responsible for embedding generation.",
      );

      setIsModelReady(false);
      return;
    }

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

        if (cancelled) return;

        sessionRef.current = session;
        setIsModelReady(true);

        console.log("ONNX session created.");
      } catch (err) {
        console.error(
          "useFaceRecognition: model initialization failed:",
          err,
        );

        setError(err);
      }
    })();

    return () => {
      cancelled = true;
      sessionRef.current = null;
    };
  }, []);

  /**
   * Client-side embedding generation.
   *
   * Currently unused.
   *
   * The implementation is intentionally preserved so that
   * client-side recognition can be re-enabled in future
   * by simply changing ENABLE_CLIENT_FACE_RECOGNITION=true.
   */
  const generateEmbedding = useCallback(async (image, landmarks) => {
    if (!ENABLE_CLIENT_FACE_RECOGNITION) {
      console.warn(
        "[FaceRecognition] generateEmbedding() skipped. Backend generates embeddings.",
      );

      return null;
    }

    if (initPromiseRef.current) {
      await initPromiseRef.current;
    }

    const session = sessionRef.current;

    if (!session) {
      throw new Error("Face recognition model is not loaded.");
    }

    if (!Array.isArray(landmarks) || landmarks.length === 0) {
      throw new Error("No landmarks supplied.");
    }

    const width = image.videoWidth ?? image.width;
    const height = image.videoHeight ?? image.height;

    if (!width || !height) {
      throw new Error("Unable to determine image dimensions.");
    }

    const aligned = alignFaceTo112(
      image,
      landmarks,
      width,
      height,
    );

    const inputTensor = preprocess(aligned);

    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];

    const results = await session.run({
      [inputName]: inputTensor,
    });

    const embedding = Array.from(results[outputName].data);

    return l2Normalize(embedding);
  }, []);

  return {
    generateEmbedding,
    isModelReady,
    error,
    isClientRecognitionEnabled: ENABLE_CLIENT_FACE_RECOGNITION,
  };
}