import { useCallback, useState } from "react";
import { registerFace } from "../services/identityVerification";

export const RECOGNITION_STATE = {
  IDLE: "IDLE",
  REGISTERING: "REGISTERING",
  REGISTERED: "REGISTERED",
  FAILED: "FAILED",
};

export default function useFaceRecognition() {
  const [state, setState] = useState(RECOGNITION_STATE.IDLE);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const register = useCallback(async (sessionId, base64Image) => {
    setState(RECOGNITION_STATE.REGISTERING);
    setError(null);

    try {
      const response = await registerFace(sessionId, base64Image);
      setResult(response);
      setState(RECOGNITION_STATE.REGISTERED);
      return response;
    } catch (err) {
      setError(err);
      setState(RECOGNITION_STATE.FAILED);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState(RECOGNITION_STATE.IDLE);
    setError(null);
    setResult(null);
  }, []);

  return { state, error, result, register, reset };
}