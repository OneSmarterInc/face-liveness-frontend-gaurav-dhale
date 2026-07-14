export const LIVENESS_STATES = {
  IDLE: "IDLE",
  READY: "READY",
  PROMPT: "PROMPT",
  VERIFYING: "VERIFYING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
};

export const FAILURE_REASONS = {
  TIMEOUT: "TIMEOUT",
  FACE_LOST: "FACE_LOST",
};

export const FAILURE_MESSAGES = {
  [FAILURE_REASONS.TIMEOUT]:
    "Verification timed out. Please try again and follow the prompts.",
  [FAILURE_REASONS.FACE_LOST]:
    "We lost track of your face. Please stay centered in the frame.",
};

export function getFailureMessage(reason) {
  return FAILURE_MESSAGES[reason] || "Verification failed. Please try again.";
}