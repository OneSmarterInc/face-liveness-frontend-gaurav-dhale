import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const FACE_ROUTE_FOR_STAGE = {
  FACE_REGISTRATION: "/face-registration",
  FACE_VERIFICATION: "/face-verification",
};

function ProtectedRoute({ children, requireLiveness = false }) {
  const { isAuthenticated, isLivenessVerified, faceStage } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireLiveness && !isLivenessVerified) {
    const target = FACE_ROUTE_FOR_STAGE[faceStage] || "/login";
    return <Navigate to={target} replace />;
  }

  return children;
}

export default ProtectedRoute;