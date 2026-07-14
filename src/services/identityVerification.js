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
    case 429:
      return new Error("Too many requests. Please try again later.");
    case 500:
      return new Error("Internal server error.");
    default:
      return new Error(
        data?.detail || data?.message || fallbackMessage
      );
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

export async function completeSession(sessionId, payload) {
  try {
    const response = await postInstance(
      `/identity/sessions/${sessionId}/complete/`,
      payload
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
