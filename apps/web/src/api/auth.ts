import { api, tokenStorage } from './client';
import type { User } from '../types';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export async function register(email: string, password: string, name: string) {
  const res = await api<AuthResponse>({
    method: 'POST',
    url: '/auth/register',
    data: { email, password, name },
  });
  tokenStorage.set(res.accessToken, res.refreshToken);
  return res.user;
}

export async function login(email: string, password: string) {
  const res = await api<AuthResponse>({
    method: 'POST',
    url: '/auth/login',
    data: { email, password },
  });
  tokenStorage.set(res.accessToken, res.refreshToken);
  return res.user;
}

export async function me() {
  return api<User | null>({ method: 'GET', url: '/auth/me' });
}

export function logout() {
  tokenStorage.clear();
}

export function oauthUrl(provider: 'google' | 'github') {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
  return `${base}/auth/${provider}`;
}
