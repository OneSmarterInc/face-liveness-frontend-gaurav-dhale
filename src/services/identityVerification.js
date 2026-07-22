import { getInstance, postInstance } from "./apiCall";

function toError(err, fallbackMessage) {
  const data = err.response?.data;

  if (!err.response) {
    return new Error("Unable to reach the server. Please try again.");
  }

  switch (err.response.status) {
    case 400:
      return new Error(data?.detail || "Invalid verification request.");
    case 401:
      return new Error("Authentication required.");
    case 403:
      return new Error("Permission denied.");
    case 404:
      return new Error("Verification session not found.");
    case 413:
      return new Error("Captured image is too large.");
    case 415:
      return new Error("Unsupported image format.");
    case 429:
      return new Error("Too many requests. Please try again later.");
    case 500:
      return new Error("Internal server error.");
    default:
      return new Error(data?.detail || data?.message || fallbackMessage);
  }
}

export async function createSession() {
  try {
    const response = await postInstance("/identity/sessions/");
    return response.data;
  } catch (err) {
    throw toError(err, "Unable to create verification session.");
  }
}

/**
 * Completes a verification session.
 *
 * New architecture: the client uploads a single JSON body containing the
 * captured frame (base64 JPEG, in `payload.capture.image`) plus the full
 * evidence bundle (session/client/camera/detector metadata, challenge
 * timing, telemetry). Face alignment, InsightFace, embedding generation,
 * and compare/register all happen server-side.
 */
export async function completeSession(sessionId, payload) {
  try {
    const response = await postInstance(
      `/identity/sessions/${sessionId}/complete/`,
      payload,
    );
    return response.data;
  } catch (err) {
    throw toError(err, "Unable to complete verification session.");
  }
}

export async function getSession(sessionId) {
  try {
    const response = await getInstance(`/identity/sessions/${sessionId}/`);
    return response.data;
  } catch (err) {
    throw toError(err, "Unable to fetch verification session.");
  }
}
