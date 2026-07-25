import { useCallback, useEffect, useReducer, useRef } from "react";

import { FAILURE_REASONS, LIVENESS_STATES } from "../utils/livenessStates";
import { ChallengeType, DEFAULT_CHALLENGES } from "../utils/challenges";
const NEUTRAL_THRESHOLD = 8;
const LEFT_THRESHOLD = 20;
const RIGHT_THRESHOLD = -20;

const EAR_CLOSED_THRESHOLD = 0.19;
const EAR_OPEN_THRESHOLD = 0.25;

const BLINK_MIN_CLOSED_FRAMES = 2;

const HISTORY_SIZE = 12;
const TRANSITION_DELAY_MS = 700;

const CAPTURE_SETTLE_FRAMES = 5;

export const VERIFICATION_TIMEOUT_MS = 30000;

const TELEMETRY_SAMPLE_RATE =
  Number(import.meta.env.VITE_TELEMETRY_SAMPLE_RATE) || 15;

const STATIC_CHALLENGE_HOLD_MS =
  Number(import.meta.env.VITE_STATIC_CHALLENGE_HOLD_MS) || 700;

const TELEMETRY_SAMPLE_INTERVAL_MS = 1000 / TELEMETRY_SAMPLE_RATE;

const PHASE = {
  WAIT_FOR_NEUTRAL: "WAIT_FOR_NEUTRAL",
  WAIT_FOR_TARGET: "WAIT_FOR_TARGET",
  TRANSITIONING: "TRANSITIONING",
  WAIT_FOR_CAPTURE: "WAIT_FOR_CAPTURE",
  DONE: "DONE",
};

const initialSession = {
  status: LIVENESS_STATES.IDLE,
  sequence: [],
  currentStep: 0,
  completedChallenges: [],
  phase: PHASE.WAIT_FOR_NEUTRAL,
  failureReason: null,
  currentStepStartedAt: null,
};

function reducer(session, action) {
  switch (action.type) {
    case "START_VERIFICATION":
      console.log("START_VERIFICATION");
      return {
        ...initialSession,
        sequence: action.sequence,
        status: LIVENESS_STATES.PROMPT,
      };

    case "FAIL":
      if (
        session.status === LIVENESS_STATES.SUCCESS ||
        session.status === LIVENESS_STATES.FAILED
      ) {
        return session;
      }
      return {
        ...session,
        status: LIVENESS_STATES.FAILED,
        phase: PHASE.DONE,
        failureReason: action.reason,
      };

    case "NEUTRAL_REACHED":
      if (session.phase !== PHASE.WAIT_FOR_NEUTRAL) return session;
      return {
        ...session,
        phase: PHASE.WAIT_FOR_TARGET,
        currentStepStartedAt: action.timestamp,
      };

    case "COMPLETE_CHALLENGE": {
      console.log("COMPLETE_CHALLENGE", action.challenge.type);
      if (session.phase !== PHASE.WAIT_FOR_TARGET) return session;
      if (action.step !== session.currentStep) return session;

      const completedChallenges = [
        ...session.completedChallenges,
        {
          ...action.challenge,
          startedAt: session.currentStepStartedAt,
          completedAt: action.timestamp,
        },
      ];
      const isLastStep = action.step === session.sequence.length - 1;

      if (isLastStep) {
        return {
          ...session,
          completedChallenges,
          phase: PHASE.WAIT_FOR_CAPTURE,
        };
      }

      return { ...session, completedChallenges, phase: PHASE.TRANSITIONING };
    }

    case "ADVANCE_STEP": {
      console.log("ADVANCE_STEP", session.currentStep);
      if (session.phase !== PHASE.TRANSITIONING) return session;
      if (action.step !== session.currentStep) return session;

      return {
        ...session,
        currentStep: session.currentStep + 1,
        phase: PHASE.WAIT_FOR_NEUTRAL,
      };
    }

    case "CAPTURE_READY": {
      if (session.phase !== PHASE.WAIT_FOR_CAPTURE) return session;

      return {
        ...session,
        status: LIVENESS_STATES.SUCCESS,
        phase: PHASE.DONE,
      };
    }

    default:
      return session;
  }
}

export default function useLiveness(
  canStartVerification,
  yaw,
  ear,
  { challenges, pose } = {},
) {
  const [session, dispatch] = useReducer(reducer, initialSession);

  const yawHistoryRef = useRef([]);
  const telemetryRef = useRef([]);
  const telemetryStartRef = useRef(null);
  const timeoutRef = useRef(null);
  const captureSettleCountRef = useRef(0);

  const lastTelemetrySampleRef = useRef(0);

  const staticChallengeStartedRef = useRef(null);

  const blinkStageRef = useRef("WAITING_FOR_CLOSE");
  const closedFrameCountRef = useRef(0);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetYawHistory = useCallback(() => {
    yawHistoryRef.current = [];
  }, []);

  const resetBlinkDetector = useCallback(() => {
    blinkStageRef.current = "WAITING_FOR_CLOSE";
    closedFrameCountRef.current = 0;
  }, []);

  const resetTelemetry = useCallback(() => {
    telemetryRef.current = [];
    telemetryStartRef.current = null;
    lastTelemetrySampleRef.current = 0;
  }, []);

  useEffect(() => {
    clearPendingTimeout();
    resetYawHistory();
    resetBlinkDetector();
    captureSettleCountRef.current = 0;

    if (!canStartVerification) {
      if (session.status === LIVENESS_STATES.PROMPT) {
        dispatch({
          type: "FAIL",
          reason: FAILURE_REASONS.FACE_LOST,
        });
      }
      return;
    }

    // Don't restart an already running/completed session.
    if (session.status !== LIVENESS_STATES.IDLE) {
      return;
    }

    resetTelemetry();
    staticChallengeStartedRef.current = null;
    dispatch({
      type: "START_VERIFICATION",
      sequence: challenges ?? DEFAULT_CHALLENGES,
    });
  }, [
    canStartVerification,
    challenges,
    session.status,
    clearPendingTimeout,
    resetYawHistory,
    resetBlinkDetector,
    resetTelemetry,
  ]);

  const retry = useCallback(() => {
    clearPendingTimeout();
    resetYawHistory();
    resetBlinkDetector();
    resetTelemetry();
    captureSettleCountRef.current = 0;
    staticChallengeStartedRef.current = null;

    dispatch({
      type: "START_VERIFICATION",
      sequence: challenges ?? DEFAULT_CHALLENGES,
    });
  }, [
    clearPendingTimeout,
    resetYawHistory,
    resetBlinkDetector,
    resetTelemetry,
    challenges,
  ]);

  useEffect(() => {
    if (session.status !== LIVENESS_STATES.PROMPT) return;

    const timeoutId = setTimeout(() => {
      dispatch({ type: "FAIL", reason: FAILURE_REASONS.TIMEOUT });
    }, VERIFICATION_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [session.status]);

  // Records one telemetry sample per processed frame while verification is
  // actively running. `pose` carries the fuller per-frame signal
  // (pitch/roll/per-eye EAR/face confidence) computed by useFaceMesh;
  // yaw/ear are kept as separate args since they're also used directly by
  // the challenge-evaluation logic below.
  useEffect(() => {
    yawHistoryRef.current.push(yaw);

    if (yawHistoryRef.current.length > HISTORY_SIZE) {
      yawHistoryRef.current.shift();
    }

    if (session.status !== LIVENESS_STATES.PROMPT) return;

    if (telemetryStartRef.current == null) {
      telemetryStartRef.current = performance.now();
    }

    const now = performance.now();

    if (
      lastTelemetrySampleRef.current &&
      now - lastTelemetrySampleRef.current < TELEMETRY_SAMPLE_INTERVAL_MS
    ) {
      return;
    }

    lastTelemetrySampleRef.current = now;

    telemetryRef.current.push({
      t: Math.round(now - telemetryStartRef.current),
      yaw,
      pitch: pose?.pitch ?? 0,
      roll: pose?.roll ?? 0,
      ear_left: pose?.earLeft ?? ear ?? null,
      ear_right: pose?.earRight ?? ear ?? null,
      face_detected: canStartVerification,
      face_confidence: pose?.faceConfidence ?? (canStartVerification ? 1 : 0),
    });
  }, [yaw, ear, pose, session.status, canStartVerification]);

  function evaluateChallenge(challenge) {
    console.log(challenge.type);
    switch (challenge.type) {
      case ChallengeType.CENTER_FACE:
        return isNeutral();

      case ChallengeType.TURN_LEFT:
        return yaw > LEFT_THRESHOLD;

      case ChallengeType.TURN_RIGHT:
        return yaw < RIGHT_THRESHOLD;

      case ChallengeType.HOLD_STILL:
        return isNeutral();

      case ChallengeType.BLINK:
        return detectBlinkCompleted();

      default:
        return false;
    }
  }

  function isNeutral() {
    return Math.abs(yaw) <= NEUTRAL_THRESHOLD;
  }

  // Returns true exactly once per full close -> reopen cycle. A single
  // "currently closed" reading is not enough (that doesn't rule out a photo
  // of someone with their eyes shut); this requires the eyes to actually
  // transition shut, stay shut for a couple of frames, then reopen.
  function detectBlinkCompleted() {
    if (typeof ear !== "number") {
      // No reliable eye landmarks this frame (face turned too far, tracking
      // lost, etc.) — don't guess, just wait for a good reading.
      return false;
    }

    if (blinkStageRef.current === "WAITING_FOR_CLOSE") {
      if (ear < EAR_CLOSED_THRESHOLD) {
        closedFrameCountRef.current += 1;

        if (closedFrameCountRef.current >= BLINK_MIN_CLOSED_FRAMES) {
          blinkStageRef.current = "WAITING_FOR_REOPEN";
        }
      } else {
        closedFrameCountRef.current = 0;
      }

      return false;
    }

    // WAITING_FOR_REOPEN
    if (ear > EAR_OPEN_THRESHOLD) {
      blinkStageRef.current = "WAITING_FOR_CLOSE";
      closedFrameCountRef.current = 0;
      return true;
    }

    return false;
  }

  function movedSmoothly() {
    const history = yawHistoryRef.current;

    if (history.length < 6) return false;

    let totalMovement = 0;

    for (let i = 1; i < history.length; i++) {
      totalMovement += Math.abs(history[i] - history[i - 1]);
    }

    return totalMovement > 18;
  }

  useEffect(() => {
    if (!canStartVerification || session.sequence.length === 0) return;

    if (session.phase === PHASE.WAIT_FOR_NEUTRAL) {
      if (session.currentStep >= session.sequence.length) return;

      if (isNeutral()) {
        resetYawHistory();
        resetBlinkDetector();
        staticChallengeStartedRef.current = null;
        dispatch({
          type: "NEUTRAL_REACHED",
          timestamp: new Date().toISOString(),
        });
      }
      return;
    }

    if (session.phase === PHASE.WAIT_FOR_TARGET) {
      if (session.currentStep >= session.sequence.length) return;

      const challenge = session.sequence[session.currentStep];

      const requiresMovement =
        challenge.type === ChallengeType.TURN_LEFT ||
        challenge.type === ChallengeType.TURN_RIGHT;

      if (requiresMovement && !movedSmoothly()) {
        return;
      }

      const isStatic =
        challenge.type === ChallengeType.CENTER_FACE ||
        challenge.type === ChallengeType.HOLD_STILL;

      if (!evaluateChallenge(challenge)) {
        staticChallengeStartedRef.current = null;
        return;
      }

      if (isStatic) {
        const now = performance.now();

        if (staticChallengeStartedRef.current == null) {
          staticChallengeStartedRef.current = now;
          return;
        }

        if (
          now - staticChallengeStartedRef.current <
          STATIC_CHALLENGE_HOLD_MS
        ) {
          return;
        }
      } else {
        staticChallengeStartedRef.current = null;
      }

      dispatch({
        type: "COMPLETE_CHALLENGE",
        step: session.currentStep,
        challenge,
        timestamp: new Date().toISOString(),
      });

      staticChallengeStartedRef.current = null;
      return;
    }

    if (session.phase === PHASE.WAIT_FOR_CAPTURE) {
      if (isNeutral()) {
        captureSettleCountRef.current += 1;

        if (captureSettleCountRef.current >= CAPTURE_SETTLE_FRAMES) {
          resetYawHistory();
          dispatch({ type: "CAPTURE_READY" });
        }
      } else {
        captureSettleCountRef.current = 0;
      }
      return;
    }
  }, [
    yaw,
    ear,
    session.phase,
    session.sequence,
    session.currentStep,
    canStartVerification,
  ]);

  useEffect(() => {
    if (session.phase !== PHASE.TRANSITIONING) return;

    const completedStep = session.currentStep;

    timeoutRef.current = setTimeout(() => {
      dispatch({ type: "ADVANCE_STEP", step: completedStep });
      timeoutRef.current = null;
    }, TRANSITION_DELAY_MS);

    return clearPendingTimeout;
  }, [session.phase, session.currentStep]);

  const currentChallenge =
    (session.phase === PHASE.WAIT_FOR_NEUTRAL ||
      session.phase === PHASE.WAIT_FOR_TARGET) &&
    session.currentStep < session.sequence.length
      ? session.sequence[session.currentStep]
      : null;

  useEffect(() => {
    return () => {
      clearPendingTimeout();
      resetYawHistory();
    };
  }, [clearPendingTimeout, resetYawHistory]);

  return {
    state: session.status,
    sequence: session.sequence,
    currentStep: session.currentStep,
    currentChallenge,
    completedChallenges: session.completedChallenges,
    phase: session.phase,
    failureReason: session.failureReason,
    retry,
    isWaitingForNeutral: session.phase === PHASE.WAIT_FOR_NEUTRAL,
    isWaitingForTarget: session.phase === PHASE.WAIT_FOR_TARGET,
    isWaitingForCapture: session.phase === PHASE.WAIT_FOR_CAPTURE,
    telemetryRef,
  };
}
