import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children, requireLiveness = false }) {
  const { isAuthenticated, isLivenessVerified } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireLiveness && !isLivenessVerified) {
    return <Navigate to="/face-liveness" replace />;
  }

  return children;
}

export default ProtectedRoute;
