// Shared constants for @mediapipe/tasks-vision consumers.
// Kept in one place so useFaceMesh (liveness) and useFaceRecognition
// (embedding) always resolve the same wasm/model versions.

export const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

export const FACE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";