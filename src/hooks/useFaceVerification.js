import { useCallback, useState } from "react";
import { verifyFace } from "../services/identityVerification";

export const VERIFICATION_STATE = {
  IDLE: "IDLE",
  VERIFYING: "VERIFYING",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
};

export default function useFaceVerification() {
  const [state, setState] = useState(VERIFICATION_STATE.IDLE);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const verify = useCallback(async (sessionId, base64Image, reason = "LOGIN") => {
    setState(VERIFICATION_STATE.VERIFYING);
    setError(null);

    try {
      const response = await verifyFace(sessionId, base64Image, reason);
      setResult(response);
      setState(VERIFICATION_STATE.VERIFIED);
      return response;
    } catch (err) {
      setError(err);
      setState(VERIFICATION_STATE.FAILED);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState(VERIFICATION_STATE.IDLE);
    setError(null);
    setResult(null);
  }, []);

  return { state, error, result, verify, reset };
}
