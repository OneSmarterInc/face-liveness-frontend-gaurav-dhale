const challengeTypeMap = {
  CENTER_FACE: "center_face",
  TURN_LEFT: "turn_left",
  TURN_RIGHT: "turn_right",
  HOLD_STILL: "hold_still",
  BLINK: "blink",
};

export function buildVerificationPayload({
  verificationSession,
  completedChallenges,
  startedAt,
  completedAt,
  computedResult,
}) {
  return {
    session_nonce: verificationSession.session_nonce,

    started_at: startedAt,

    completed_at: completedAt,

    detector_provider: "MediaPipe",

    platform: "web",

    app_version: __APP_VERSION__,

    final_liveness_result: computedResult,

    challenge_results: completedChallenges.map((challenge) => ({
      challenge: challengeTypeMap[challenge.type],
      passed: true,
      completed_at: completedAt,
    })),
  };
}