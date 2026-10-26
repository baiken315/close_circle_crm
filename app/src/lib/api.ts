import { getToken, clearToken } from './auth';
import type { ApiResponse, ApiError } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

class ApiClient {
  private getHeaders(includeAuth = true): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (includeAuth) {
      const token = getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      clearToken();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response: ${text.slice(0, 100)}`);
    }

    if (!response.ok) {
      const error = json as ApiError;
      throw new Error(error.error ?? `HTTP ${response.status}`);
    }

    return (json as ApiResponse<T>).data;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown, noAuth = false): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: this.getHeaders(!noAuth),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  // SSE streaming for chat
  streamChatMessage(
    sessionId: string,
    content: string,
    onEvent: (data: Record<string, unknown>) => void,
    onDone: () => void,
    onError: (err: Error) => void
  ): AbortController {
    const controller = new AbortController();
    const token = getToken();

    fetch(`${BASE_URL}/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const dataLine = line.trim();
            if (dataLine.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;
                onEvent(parsed);
                if (parsed['type'] === 'done') {
                  onDone();
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          onError(err);
        }
      });

    return controller;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    const response = await fetch(`${BASE_URL}/api/users/me/password`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    return this.handleResponse<{ success: boolean }>(response);
  }
}

export const api = new ApiClient();
