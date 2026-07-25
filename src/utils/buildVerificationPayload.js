import { getClientInfo } from "./clientInfo";

const challengeTypeMap = {
  CENTER_FACE: "center_face",
  TURN_LEFT: "turn_left",
  TURN_RIGHT: "turn_right",
  HOLD_STILL: "hold_still",
  BLINK: "blink",
};

/**
 * Builds the evidence payload sent to `POST /identity/sessions/:id/complete/`.
 * Matches the backend's expected shape exactly — see the flow doc: client
 * uploads the captured frame + evidence (session/client/camera/detector
 * metadata, the challenge sequence and per-challenge timing, per-frame
 * telemetry, and the captured frame itself); face alignment + InsightFace +
 * embedding generation all happen server-side now.
 */
export function buildVerificationPayload({
  verificationSession,
  completedChallenges,
  telemetry = [],
  capture,
  startedAt,
  completedAt,
  camera = {},
  detector = {},
  client = {},
}) {
  const defaultClient = getClientInfo();

  return {
    session: {
      session_nonce: verificationSession.session_nonce,
      verification_id: verificationSession.verification_id ?? null,
      started_at: startedAt,
      completed_at: completedAt,
    },

    client: {
      platform: client.platform ?? defaultClient.platform,
      app_version: client.app_version ?? defaultClient.app_version,
      browser: client.browser ?? defaultClient.browser,
      os: client.os ?? defaultClient.os,
    },

    camera: {
      resolution: {
        width: camera.width ?? null,
        height: camera.height ?? null,
      },
      fps: camera.fps ?? null,
    },

    detector: {
      provider: detector.provider ?? "MediaPipe",
      version: detector.version ?? null,
    },


    challenge_sequence: verificationSession.challenge_sequence ?? [],

    challenge_events: completedChallenges.map((challenge) => ({
      challenge: challengeTypeMap[challenge.type],
      started_at: challenge.startedAt ?? null,
      completed_at: challenge.completedAt ?? completedAt,
    })),

    telemetry,

    capture: {
      frame_timestamp: capture?.frameTimestamp ?? completedAt,
      quality_score: capture?.qualityScore ?? null,
      sharpness: capture?.sharpness ?? null,
      brightness: capture?.brightness ?? null,

      // Base64-encoded JPEG (no data-URL prefix).
      image: capture?.base64 ?? null,
    },
    "schema_version": "1.0"
  };
}
