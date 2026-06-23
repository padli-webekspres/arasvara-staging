import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getClientApiSecret } from "@/lib/api-secret";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const secret = getClientApiSecret();
  if (secret) {
    config.headers["x-api-secret"] = secret;
  }
  return config;
});

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "/api"}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: getClientApiSecret()
            ? { "x-api-secret": getClientApiSecret() }
            : {},
        },
      );
      return Boolean(data?.success);
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function isAuthRefreshUrl(url?: string): boolean {
  if (!url) return false;
  return url.includes("/auth/login") || url.includes("/auth/refresh");
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retry ||
      isAuthRefreshUrl(config.url)
    ) {
      return Promise.reject(error);
    }

    config._retry = true;
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return api(config);
    }

    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
      const redirect = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.href = `/login?redirect=${redirect}`;
    }

    return Promise.reject(error);
  },
);

export default api;
