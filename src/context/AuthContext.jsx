import { createContext, useContext, useState } from "react";
import { setCookie, getCookie, removeCookie } from "../utils/cookies";

const AuthContext = createContext(null);

const AUTH_FLAG_COOKIE = "kormic_auth";
const TOKEN_COOKIE = "kormic_auth_token";
const REFRESH_COOKIE = "kormic_refresh_token";
const LIVENESS_COOKIE = "kormic_liveness";

export function AuthProvider({ children }) {
  const [isLivenessVerified, setIsLivenessVerified] = useState(
    () => getCookie(LIVENESS_COOKIE) === "true",
  );

  const completeLiveness = () => {
    setCookie(LIVENESS_COOKIE, "true");
    setIsLivenessVerified(true);
  };
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => getCookie(AUTH_FLAG_COOKIE) === "true",
  );

  const login = ({ accessToken, refreshToken } = {}) => {
    setCookie(AUTH_FLAG_COOKIE, "true");
    if (accessToken) {
      setCookie(TOKEN_COOKIE, accessToken);
    }
    if (refreshToken) {
      setCookie(REFRESH_COOKIE, refreshToken, 7);
    }
    setIsAuthenticated(true);
  };

  const logout = () => {
  removeCookie(AUTH_FLAG_COOKIE);
  removeCookie(TOKEN_COOKIE);
  removeCookie(REFRESH_COOKIE);
  removeCookie(LIVENESS_COOKIE);

  setIsAuthenticated(false);
  setIsLivenessVerified(false);
};

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLivenessVerified,
        completeLiveness,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
