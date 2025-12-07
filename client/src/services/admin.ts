import axios from 'axios';
import { AdminLoginResponse, OcrHistoryEntry, Transaction } from '@/types';
import { API_BASE_URL } from './config';

const ADMIN_TOKEN_KEY = 'ai-reporting-admin-token';
const ADMIN_USER_KEY = 'ai-reporting-admin-user';
const USER_TOKEN_KEY = 'ai-reporting-token';
const USER_KEY = 'ai-reporting-user';

const getStored = (key: string) => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
};

const setStored = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
};

const removeStored = (key: string) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
};

const syncChatSession = (token: string, user: { id?: number; username?: string; chat_user_id?: number }) => {
  if (typeof window === 'undefined') return;
  const chatUserId = user.chat_user_id || user.id;
  if (!chatUserId) return;

  localStorage.setItem(USER_TOKEN_KEY, token);
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      id: chatUserId,
      username: user.username || 'admin',
    })
  );
};

export const adminAuth = {
  async login(username: string, password: string): Promise<AdminLoginResponse> {
    const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || data?.message || 'Admin login failed');
    }

    if (!data?.token || !data?.user) {
      throw new Error('Admin login response incomplete.');
    }

    setStored(ADMIN_TOKEN_KEY, data.token);
    setStored(ADMIN_USER_KEY, JSON.stringify(data.user));

    // Mirror session to chatbot auth so admin can access bot features
    syncChatSession(data.token, data.user);
    return data as AdminLoginResponse;
  },
  logout() {
    removeStored(ADMIN_TOKEN_KEY);
    removeStored(ADMIN_USER_KEY);
    removeStored(USER_TOKEN_KEY);
    removeStored(USER_KEY);
  },
  getToken(): string | null {
    return getStored(ADMIN_TOKEN_KEY);
  },
  getUser() {
    const raw = getStored(ADMIN_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  ensureChatSession() {
    const adminToken = getStored(ADMIN_TOKEN_KEY);
    const adminUserRaw = getStored(ADMIN_USER_KEY);
    if (!adminToken || !adminUserRaw) return;

    const existingUserToken = getStored(USER_TOKEN_KEY);
    const existingUser = getStored(USER_KEY);
    if (existingUserToken && existingUser) return;

    try {
      const parsed = JSON.parse(adminUserRaw);
      syncChatSession(adminToken, parsed);
    } catch {
      return;
    }
  },
  isAuthenticated(): boolean {
    return Boolean(getStored(ADMIN_TOKEN_KEY));
  },
};

const buildHeaders = (extra: HeadersInit = {}): HeadersInit => {
  const token = adminAuth.getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};

export const adminService = {
  async listTransactions(): Promise<Transaction[]> {
    const response = await fetch(`${API_BASE_URL}/api/admin/transactions`, {
      headers: buildHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to load transactions');
    }
    return data?.data || [];
  },

  async createTransaction(payload: Partial<Transaction>): Promise<Transaction> {
    const response = await fetch(`${API_BASE_URL}/api/admin/transactions`, {
      method: 'POST',
      headers: { ...buildHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to create transaction');
    }
    return data?.data;
  },

  async updateTransaction(id: string, payload: Partial<Transaction>): Promise<Transaction> {
    const response = await fetch(`${API_BASE_URL}/api/admin/transactions/${id}`, {
      method: 'PUT',
      headers: { ...buildHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to update transaction');
    }
    return data?.data;
  },

  async deleteTransaction(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/transactions/${id}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to delete transaction');
    }
  },

  async uploadDocument(
    file: File,
    targetId?: string,
    onProgress?: (payload: { percent: number; stage: 'uploading' | 'processing' | 'success' | 'failed' }) => void
  ): Promise<{ transaction: Transaction; history?: OcrHistoryEntry | null }> {
    const formData = new FormData();
    formData.append('file', file);
    if (targetId) formData.append('id_transaksi', targetId);

    const response = await axios.post(`${API_BASE_URL}/api/admin/transactions/upload`, formData, {
      headers: buildHeaders(),
      onUploadProgress: (evt) => {
        if (!onProgress) return;
        const total = evt.total || file.size || 1;
        const percent = Math.min(99, Math.round((evt.loaded / total) * 100));
        onProgress({ percent, stage: 'uploading' });
      },
    });

    const data = response.data || {};
    if (response.status < 200 || response.status >= 300) {
      throw new Error(data?.error || 'Failed to extract document');
    }

    onProgress?.({ percent: 100, stage: 'processing' });

    const result = {
      transaction: data?.data as Transaction,
      history: (data?.history as OcrHistoryEntry) || null,
    };

    onProgress?.({ percent: 100, stage: 'success' });
    return result;
  },

  async listOcrHistory(limit = 30): Promise<OcrHistoryEntry[]> {
    const response = await fetch(`${API_BASE_URL}/api/admin/ocr-history?limit=${limit}`, {
      headers: buildHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to load OCR history');
    }
    return data?.data || [];
  },
};
