import axios, { AxiosError } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

const client = axios.create({ baseURL: API_BASE_URL });

const ACCESS_TOKEN_KEY = 'rpa_access_token';
const REFRESH_TOKEN_KEY = 'rpa_refresh_token';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

client.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: newRefresh } = res.data.data;
    tokenStorage.set(accessToken, newRefresh);
    return accessToken;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken();
      const newToken = await refreshPromise;
      refreshPromise = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/** Unwraps the platform's { success, data, message } envelope. */
export async function api<T>(config: Parameters<typeof client.request>[0]): Promise<T> {
  const res = await client.request<{ success: boolean; data: T }>(config);
  return res.data.data;
}

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    return data?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export default client;
