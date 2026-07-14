import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import GuestRoute from "./routes/GuestRoute";
import Home from "./pages/Home";
import LivenessCheck from "./pages/LivenessCheck";
import Login from "./pages/Login";
import VerifyTotp from "./pages/VerifyTotp";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/face-liveness" replace />} />
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />
          <Route path="/verify-totp" element={<VerifyTotp />} />
          <Route
            path="/face-liveness"
            element={
              <ProtectedRoute>
                <LivenessCheck />
              </ProtectedRoute>
            }
          />

          <Route
            path="/home"
            element={
              <ProtectedRoute requireLiveness>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
