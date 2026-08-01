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

export const IDENTITY_ERROR = {
  NETWORK: "NETWORK",
  TIMEOUT: "TIMEOUT",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  NO_ENROLLED_FACE: "NO_ENROLLED_FACE",
  MULTIPLE_FACES: "MULTIPLE_FACES",
  POOR_QUALITY: "POOR_QUALITY",
  VERIFICATION_MISMATCH: "VERIFICATION_MISMATCH",
  RATE_LIMITED: "RATE_LIMITED",
  SERVER_ERROR: "SERVER_ERROR",
  UNKNOWN: "UNKNOWN",
};

const CODE_MAP = {
  no_enrolled_face: IDENTITY_ERROR.NO_ENROLLED_FACE,
  face_not_registered: IDENTITY_ERROR.NO_ENROLLED_FACE,
  no_face_enrolled: IDENTITY_ERROR.NO_ENROLLED_FACE,
  multiple_faces: IDENTITY_ERROR.MULTIPLE_FACES,
  multiple_faces_detected: IDENTITY_ERROR.MULTIPLE_FACES,
  poor_image_quality: IDENTITY_ERROR.POOR_QUALITY,
  low_quality: IDENTITY_ERROR.POOR_QUALITY,
  image_quality_too_low: IDENTITY_ERROR.POOR_QUALITY,
  session_expired: IDENTITY_ERROR.SESSION_EXPIRED,
  session_not_completed: IDENTITY_ERROR.SESSION_EXPIRED,
  session_already_consumed: IDENTITY_ERROR.SESSION_EXPIRED,
  face_mismatch: IDENTITY_ERROR.VERIFICATION_MISMATCH,
  verification_failed: IDENTITY_ERROR.VERIFICATION_MISMATCH,
};

const DEFAULT_MESSAGES = {
  [IDENTITY_ERROR.NETWORK]:
    "Unable to reach the server. Check your connection and try again.",
  [IDENTITY_ERROR.TIMEOUT]:
    "The request took too long. Please try again.",
  [IDENTITY_ERROR.SESSION_EXPIRED]:
    "Your verification session has expired. Please start again.",
  [IDENTITY_ERROR.NO_ENROLLED_FACE]:
    "No enrolled face was found for this account.",
  [IDENTITY_ERROR.MULTIPLE_FACES]:
    "Multiple faces were detected in the captured image.",
  [IDENTITY_ERROR.POOR_QUALITY]:
    "The captured image quality was too low to verify.",
  [IDENTITY_ERROR.VERIFICATION_MISMATCH]:
    "We couldn't verify your identity from the captured image.",
  [IDENTITY_ERROR.RATE_LIMITED]:
    "Too many attempts. Please wait a moment and try again.",
  [IDENTITY_ERROR.SERVER_ERROR]:
    "Something went wrong on our end. Please try again.",
  [IDENTITY_ERROR.UNKNOWN]: "Something went wrong. Please try again.",
};

export function classifyIdentityError(err) {
  if (err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "")) {
    return { type: IDENTITY_ERROR.TIMEOUT, message: DEFAULT_MESSAGES[IDENTITY_ERROR.TIMEOUT] };
  }

  if (!err?.response) {
    return { type: IDENTITY_ERROR.NETWORK, message: DEFAULT_MESSAGES[IDENTITY_ERROR.NETWORK] };
  }

  const status = err.response.status;
  const data = err.response.data || {};
  const rawCode = String(data.code || data.error_code || data.reason || "").toLowerCase();
  const mapped = CODE_MAP[rawCode];

  if (mapped) {
    return { type: mapped, message: data.detail || data.message || DEFAULT_MESSAGES[mapped], status };
  }

  if (status === 404 || status === 409 || status === 410) {
    return {
      type: IDENTITY_ERROR.SESSION_EXPIRED,
      message: data.detail || data.message || DEFAULT_MESSAGES[IDENTITY_ERROR.SESSION_EXPIRED],
      status,
    };
  }

  if (status === 429) {
    return { type: IDENTITY_ERROR.RATE_LIMITED, message: DEFAULT_MESSAGES[IDENTITY_ERROR.RATE_LIMITED], status };
  }

  if (status >= 500) {
    return { type: IDENTITY_ERROR.SERVER_ERROR, message: DEFAULT_MESSAGES[IDENTITY_ERROR.SERVER_ERROR], status };
  }

  if (status === 400 || status === 422) {
    return {
      type: IDENTITY_ERROR.VERIFICATION_MISMATCH,
      message: data.detail || data.message || DEFAULT_MESSAGES[IDENTITY_ERROR.VERIFICATION_MISMATCH],
      status,
    };
  }

  return {
    type: IDENTITY_ERROR.UNKNOWN,
    message: data.detail || data.message || DEFAULT_MESSAGES[IDENTITY_ERROR.UNKNOWN],
    status,
  };
}

export async function createSession() {
  try {
    const response = await postInstance("/identity/sessions/");
    return response.data;
  } catch (err) {
    throw toError(err, "Unable to create verification session.");
  }
}

export async function completeSession(sessionId, payload) {
  try {
    const response = await postInstance(
      `/identity/sessions/${sessionId}/complete/`,
      payload,
    );
    return response.data;
  } catch (err) {
    throw toIdentityError(err, "Unable to complete verification session.");
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

function toIdentityError(err, fallbackMessage) {
  const classification = classifyIdentityError(err);
  const error = new Error(classification.message || fallbackMessage);
  error.identityError = classification;
  return error;
}

export async function registerFace(sessionId, base64Image) {
  try {
    const response = await postInstance("/identity/register/", {
      session_id: sessionId,
      capture: { image: base64Image },
    });
    return response.data;
  } catch (err) {
    throw toIdentityError(err, "Unable to register face.");
  }
}


export async function verifyFace(sessionId, base64Image, reason = "VERIFY") {
  try {
    const response = await postInstance("/identity/verify/", {
      session_id: sessionId,
      capture: { image: base64Image },
      reason,
    });
    return response.data;
  } catch (err) {
    throw toIdentityError(err, "Unable to verify face.");
  }
}