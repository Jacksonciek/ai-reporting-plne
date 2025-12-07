import { API_BASE_URL } from './config';

const TOKEN_KEY = 'ai-reporting-token';
const USER_KEY = 'ai-reporting-user';

export interface AuthUser {
  id: number;
  username: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
  message?: string;
}

const saveSession = (token: string, user: AuthUser) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

const getStoredUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const authService = {
  async login(username: string, password: string): Promise<LoginResult> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error || data?.message || 'Login failed, please check your credentials.';
      throw new Error(message);
    }

    const token: string | undefined = data.token || data?.data?.token;
    const user: AuthUser | undefined = data.user || data?.data?.user;

    if (!token || !user?.id) {
      throw new Error('Login response incomplete. Token or user data is missing.');
    }

    saveSession(token, user);
    return { token, user, message: data.message };
  },

  logout() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async register(username: string, password: string): Promise<LoginResult> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error || data?.message || 'Registration failed, please try again.';
      throw new Error(message);
    }

    const token: string | undefined = data.token || data?.data?.token;
    const user: AuthUser | undefined = data.user || data?.data?.user;

    if (!token || !user?.id) {
      throw new Error('Register response incomplete. Token or user data is missing.');
    }

    saveSession(token, user);
    return { token, user, message: data.message };
  },

  getToken(): string | null {
    return getStoredToken();
  },

  getUser(): AuthUser | null {
    return getStoredUser();
  },

  isAuthenticated(): boolean {
    return Boolean(getStoredToken());
  },
};
