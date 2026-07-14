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
}) {
  return {
    session_nonce: verificationSession.session_nonce,

    started_at: startedAt,

    completed_at: completedAt,

    detector_provider: "MediaPipe",

    platform: "android",

    app_version: "1.0.0",

    final_liveness_result: "passed",

    challenge_results: completedChallenges.map((challenge) => ({
      challenge: challengeTypeMap[challenge.type],
      passed: true,
      completed_at: completedAt,
    })),
  };
}