import { LIVENESS_STATES, FAILURE_REASONS } from "./livenessStates";
import { VERIFICATION_TIMEOUT_MS } from "../hooks/useLiveness";

const TIMEOUT_CHECK_BUFFER_MS = 1500;

/**
 * Client-side validation only.
 *
 * IMPORTANT:
 * The backend is the source of truth for liveness.
 * This function should only prevent obviously invalid submissions
 * (timeout, reducer failure, missing capture, etc.).
 * It should NOT recompute the liveness verdict from challenge evidence.
 */

export function evaluateLivenessResult({
  state,
  failureReason,
  startedAt,
  completedAt,
  capturedImage,
}) {
  if (state === LIVENESS_STATES.FAILED) {
    console.warn("Liveness failed:", failureReason);
    return "failed";
  }

  if (
    failureReason === FAILURE_REASONS.TIMEOUT ||
    !isWithinTimeout(startedAt, completedAt)
  ) {
    console.warn("Liveness timed out.");
    return "failed";
  }

  if (!capturedImage) {
    console.warn("No capture available.");
    return "failed";
  }

  if (state !== LIVENESS_STATES.SUCCESS) {
    console.warn("Session did not reach SUCCESS.");
    return "failed";
  }


  return "passed";
}

function isWithinTimeout(startedAt, completedAt) {
  if (!startedAt || !completedAt) {
    return false;
  }

  const elapsedMs =
    new Date(completedAt).getTime() -
    new Date(startedAt).getTime();

  if (Number.isNaN(elapsedMs)) {
    return false;
  }

  return (
    elapsedMs <=
    VERIFICATION_TIMEOUT_MS + TIMEOUT_CHECK_BUFFER_MS
  );
}