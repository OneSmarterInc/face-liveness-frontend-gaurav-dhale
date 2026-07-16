import { LIVENESS_STATES, FAILURE_REASONS } from "./livenessStates";
import { VERIFICATION_TIMEOUT_MS } from "../hooks/useLiveness";

const TIMEOUT_CHECK_BUFFER_MS = 1500;

/**
 * Recomputes the final liveness result from independent signals instead of
 * trusting a single `state === SUCCESS` flag. `state` reaching SUCCESS
 * should already imply most of this (the reducer fails the session the
 * moment any one condition breaks), but re-deriving each condition here
 * means a future bug in the reducer (a loosened guard, a race condition,
 * a new phase that forgets to check something) gets caught by an
 * independent check instead of silently flowing through to "passed".
 *
 * @param {object} input
 * @param {string} input.state - session.state from useLiveness ("SUCCESS", "FAILED", etc).
 * @param {string|null} input.failureReason - session.failureReason from useLiveness.
 * @param {Array<{type: string}>} input.completedChallenges - session.completedChallenges from useLiveness.
 * @param {Array<{type: string}>} input.expectedSequence - the challenge sequence independently
 *   derived from verificationSession.challenge_sequence (not session.sequence, so a bug that
 *   mutates session state can't also fool this check).
 * @param {Set<number>|number[]} input.neutralVisitedSteps - step indices that were observed to
 *   pass through WAIT_FOR_NEUTRAL -> WAIT_FOR_TARGET before being evaluated.
 * @param {object} input.quality - accumulated face-tracking flags for the whole attempt:
 *   { multipleFacesDetected, faceLostDetected, centeredBroke, tooSmallBroke }.
 * @param {string|number|Date} input.startedAt
 * @param {string|number|Date} input.completedAt
 * @param {*} input.capturedImage - the captured frame/image, or null/undefined if capture never completed.
 * @returns {"passed"|"failed"}
 */
export function evaluateLivenessResult({
  state,
  failureReason,
  completedChallenges,
  expectedSequence,
  neutralVisitedSteps,
  quality,
  startedAt,
  completedAt,
  capturedImage,
}) {
  const checks = buildChecks({
    state,
    failureReason,
    completedChallenges,
    expectedSequence,
    neutralVisitedSteps,
    quality,
    startedAt,
    completedAt,
    capturedImage,
  });

  const failed = checks.filter((check) => !check.passed);

  if (failed.length > 0) {

    console.warn(
      "Liveness result computed as FAILED — unmet conditions:",
      failed.map((check) => check.name),
    );
    return "failed";
  }

  return "passed";
}

function buildChecks({
  state,
  failureReason,
  completedChallenges,
  expectedSequence,
  neutralVisitedSteps,
  quality,
  startedAt,
  completedAt,
  capturedImage,
}) {
  const safeCompleted = Array.isArray(completedChallenges)
    ? completedChallenges
    : [];
  const safeExpected = Array.isArray(expectedSequence) ? expectedSequence : [];
  const safeQuality = quality ?? {};
  const visitedSteps = normalizeStepSet(neutralVisitedSteps);

  return [
    {
      name: "Verification reached SUCCESS",
      passed: state === LIVENESS_STATES.SUCCESS,
    },
    {
      name: "Every expected challenge was completed",
      passed:
        safeExpected.length > 0 &&
        safeCompleted.length === safeExpected.length,
    },
    {
      name: "No challenge failed",
      passed: state !== LIVENESS_STATES.FAILED && failureReason == null,
    },
    {
      name: "Challenge order matches the session",
      passed:
        safeExpected.length > 0 &&
        safeExpected.length === safeCompleted.length &&
        safeExpected.every(
          (expected, i) => safeCompleted[i]?.type === expected.type,
        ),
    },
    {
      name: "Session did not timeout",
      passed:
        failureReason !== FAILURE_REASONS.TIMEOUT &&
        isWithinTimeout(startedAt, completedAt),
    },
    {
      name: "Exactly one face was tracked",
      passed:
        !safeQuality.multipleFacesDetected && !safeQuality.faceLostDetected,
    },
    {
      name: "Face remained centered when required",
      passed: !safeQuality.centeredBroke,
    },
    {
      name: "Face remained large enough",
      passed: !safeQuality.tooSmallBroke,
    },
    {
      name: "Returned to neutral between challenges",
      passed:
        safeExpected.length > 0 &&
        safeExpected.every((_, i) => visitedSteps.has(i)),
    },
    {
      name: "Capture was completed",
      passed: Boolean(capturedImage),
    },
  ];
}

function normalizeStepSet(neutralVisitedSteps) {
  if (neutralVisitedSteps instanceof Set) return neutralVisitedSteps;
  if (Array.isArray(neutralVisitedSteps)) return new Set(neutralVisitedSteps);
  return new Set();
}

function isWithinTimeout(startedAt, completedAt) {
  if (!startedAt || !completedAt) return false;

  const elapsedMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  if (Number.isNaN(elapsedMs)) return false;

  return elapsedMs <= VERIFICATION_TIMEOUT_MS + TIMEOUT_CHECK_BUFFER_MS;
}