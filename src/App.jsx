import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import GuestRoute from "./routes/GuestRoute";
import Home from "./pages/Home";
import FaceRegistration from "./pages/FaceRegistration";
import FaceVerification from "./pages/FaceVerification";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TotpEnroll from "./pages/TotpEnroll";
import VerifyTotp from "./pages/VerifyTotp";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <GuestRoute>
                <Signup />
              </GuestRoute>
            }
          />
          <Route path="/verify-totp" element={<VerifyTotp />} />
          <Route path="/totp-enroll" element={<TotpEnroll />} />

          <Route
            path="/face-registration"
            element={
              <ProtectedRoute>
                <FaceRegistration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/face-verification"
            element={
              <ProtectedRoute>
                <FaceVerification />
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