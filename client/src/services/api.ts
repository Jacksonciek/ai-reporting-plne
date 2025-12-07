// api.ts
import {
  MessagesResponse,
  RoomsResponse,
  CreateRoomResponse,
  MessagePairResponse,
  GetRoomsParams,
  Room,
  Message,
  WeeklyActivity,
} from '@/types';
import { authService } from './auth';
import { API_BASE_URL } from './config';

class ApiService {
  private buildHeaders(extraHeaders: HeadersInit = {}): HeadersInit {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    };
  }

  private getUserId(): number {
    const user = authService.getUser();
    if (!user?.id) {
      throw new Error('User is not authenticated.');
    }
    return user.id;
  }

  private async fetchWithErrorHandling<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: this.buildHeaders(options.headers || {}),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      authService.logout();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      throw new Error(
        data.message || data.error || `HTTP error! status: ${response.status}`
      );
    }

    return data as T;
  }

  async getRooms(params: GetRoomsParams = {}): Promise<RoomsResponse> {
    const userId = this.getUserId();
    const limit = params.limit || 10;
    const page = params.page && params.page > 0 ? params.page : 1;
    const offset = (page - 1) * limit;
    const url = `${API_BASE_URL}/api/${userId}/rooms?limit=${limit}&offset=${offset}`;

    const response = await this.fetchWithErrorHandling<any>(url);

    if (response.data && Array.isArray(response.data)) {
      const rooms: Room[] = response.data.map((room: any) => ({
        room_id: room.room_id,
        room_name: room.room_name || 'New chat',
        created_at: room.created_at,
        updated_at: room.updated_at || room.created_at,
        user_id: room.user_id || userId,
      }));

      return {
        data: rooms,
        total: response.total_count || rooms.length,
        hasMore: offset + limit < (response.total_count || 0),
      };
    }

    return { data: [], total: 0, hasMore: false };
  }

  async createRoom(name?: string): Promise<CreateRoomResponse> {
    const userId = this.getUserId();
    const url = `${API_BASE_URL}/api/new_room`;
    const body = {
      room_name: name || 'New chat',
      user_id: userId,
    };

    const response = await this.fetchWithErrorHandling<any>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      room_id: response.room_id || Date.now(),
      room_name: response.room_name || name || 'New chat',
      created_at: response.created_at || new Date().toISOString(),
    };
  }

  async getMessages(roomId: string): Promise<MessagesResponse> {
    const url = `${API_BASE_URL}/api/rooms/${roomId}/messages`;

    try {
      const response = await this.fetchWithErrorHandling<any>(url);
      const pairs = response.data && Array.isArray(response.data) ? response.data : [];

      const messages: Message[] = [];
      pairs.forEach((pair: any, index: number) => {
        if (pair.user?.text) {
          messages.push({
            id: `user-${roomId}-${index}`,
            room_id: roomId,
            content: pair.user.text,
            role: 'user',
            created_at: new Date(
              Date.now() - (pairs.length - index) * 1000
            ).toISOString(),
          });
        }

        if (pair.bot?.text) {
          messages.push({
            id: `bot-${roomId}-${index}`,
            room_id: roomId,
            content: pair.bot.text,
            role: 'assistant',
            created_at: new Date(
              Date.now() - (pairs.length - index - 0.5) * 1000
            ).toISOString(),
            image: pair.bot.image,
            document: pair.bot.document,
            excel: pair.bot.excel,
          });
        }
      });

      messages.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return { messages };
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      return { messages: [] };
    }
  }

  async sendMessageToBot(
    roomId: string,
    message: string
  ): Promise<MessagePairResponse> {
    const userId = this.getUserId();
    const url = `${API_BASE_URL}/api/rooms/${roomId}/messages/bot`;
    const body = {
      user_prompt: message,
      user_id: userId,
    };

    try {
      const response = await this.fetchWithErrorHandling<any>(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const botPayload = response.data ?? response.bot ?? {};
      const botText =
        botPayload?.text ||
        response.response ||
        response.message ||
        'No response received';
      const botImage =
        botPayload?.image ||
        botPayload?.image_url ||
        response.image ||
        response.image_url;
      const botDocument =
        botPayload?.document ||
        botPayload?.document_url ||
        response.document ||
        response.document_url;
      const botExcel =
        botPayload?.excel ||
        botPayload?.excel_url ||
        response.excel ||
        response.excel_url;

      return {
        user: { text: message },
        bot: {
          text: botText,
          image: botImage,
          document: botDocument,
          excel: botExcel,
        },
        response: response.response || response.message,
      };
    } catch (error) {
      console.error('Failed to send message to bot:', error);
      return {
        user: { text: message },
        bot: {
          text:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred while contacting the bot',
        },
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const userId = this.getUserId();
      await this.fetchWithErrorHandling(`${API_BASE_URL}/api/${userId}/rooms`);
      return true;
    } catch {
      return false;
    }
  }

  async getWeeklyActivity(): Promise<WeeklyActivity[]> {
    try {
      const response = await this.fetchWithErrorHandling<any>(
        `${API_BASE_URL}/api/analytics/weekly_activity`
      );
      if (response.data && Array.isArray(response.data)) {
        return response.data.map((item: any) => ({
          day: item.day,
          total: Number(item.total) || 0,
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch weekly activity:', error);
      return [];
    }
  }
}

export const apiService = new ApiService();
