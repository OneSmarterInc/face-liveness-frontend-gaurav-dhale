import axios from "axios";
import { getCookie, setCookie, removeCookie } from "../utils/cookies";

const BASE_URL = "http://127.0.0.1:8000/api";

const AUTH_FLAG_COOKIE = "kormic_auth";
const TOKEN_COOKIE = "kormic_auth_token";
const REFRESH_COOKIE = "kormic_refresh_token";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    timeout: 20000,
    headers: {
        "Content-Type": "application/json",
    },
});

const isTokenExpired = (token) => {
    try {
        const payloadBase64 = token.split(".")[1];
        const payload = JSON.parse(atob(payloadBase64));
        const currentTime = Math.floor(Date.now() / 1000);
        return payload.exp < currentTime;
    } catch (error) {
        console.error("Invalid token:", error);
        return true;
    }
};

const clearSession = () => {
    removeCookie(AUTH_FLAG_COOKIE);
    removeCookie(TOKEN_COOKIE);
    removeCookie(REFRESH_COOKIE);

    if (window.location.pathname !== "/login") {
        window.location.href = "/login";
    }
};

axiosInstance.interceptors.request.use(async (config) => {
    let accessToken = getCookie(TOKEN_COOKIE);

    if (accessToken && isTokenExpired(accessToken)) {
        const refreshToken = getCookie(REFRESH_COOKIE);

        if (!refreshToken) {
            clearSession();
            return config;
        }

        try {
            const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, {
                refresh: refreshToken,
            });

            accessToken = data.access;
            setCookie(TOKEN_COOKIE, accessToken);
            if (data.refresh) {
                setCookie(REFRESH_COOKIE, data.refresh, 7);
            }
        } catch (error) {
            console.error("Failed to refresh token:", error);
            clearSession();
            return Promise.reject(error);
        }
    }

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            clearSession();
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;