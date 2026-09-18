/**
 * Nexus API Client
 * Centralized HTTP client with auth token injection and error handling.
 * Base URL: http://localhost:3000/api/v1 (configurable via EXPO_PUBLIC_API_URL)
 */
import * as SecureStore from 'expo-secure-store';
import { ApiResponse, ApiError } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'nexus_auth_token';

class ApiClient {
  private baseUrl: string;
  private onUnauthorized?: () => void;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** Register a callback for 401 responses (used by AuthContext to redirect to login) */
  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  /** Get the stored auth token */
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /** Store auth token */
  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }

  /** Remove stored auth token */
  async clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }

  /** Build headers with optional auth token */
  private async buildHeaders(includeAuth: boolean = true): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (includeAuth) {
      const token = await this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /** Core request method */
  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: any;
      params?: Record<string, any>;
      auth?: boolean;
    } = {}
  ): Promise<T> {
    const { body, params, auth = true } = options;

    // Build URL with query params
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers = await this.buildHeaders(auth);

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);

      // Handle 401 — token expired or invalid
      if (response.status === 401) {
        await this.clearToken();
        this.onUnauthorized?.();
        const errorData = await response.json().catch(() => ({}));
        throw new ApiRequestError(
          errorData?.error?.message || 'Unauthorized',
          'UNAUTHORIZED',
          401
        );
      }

      // Handle other error responses
      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          success: false,
          error: { code: 'UNKNOWN', message: `Request failed with status ${response.status}` },
        }));
        throw new ApiRequestError(
          errorData.error?.message || 'Request failed',
          errorData.error?.code || 'UNKNOWN',
          response.status,
          errorData.error?.details
        );
      }

      // Parse success response
      const data: ApiResponse<T> = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw error;
      }
      // Network error
      throw new ApiRequestError(
        'Network error. Please check your connection.',
        'NETWORK_ERROR',
        0
      );
    }
  }

  /** Convenience methods */
  async get<T>(path: string, params?: Record<string, any>, auth: boolean = true): Promise<T> {
    return this.request<T>('GET', path, { params, auth });
  }

  async post<T>(path: string, body?: any, auth: boolean = true): Promise<T> {
    return this.request<T>('POST', path, { body, auth });
  }

  async patch<T>(path: string, body?: any, auth: boolean = true): Promise<T> {
    return this.request<T>('PATCH', path, { body, auth });
  }

  async delete<T>(path: string, auth: boolean = true): Promise<T> {
    return this.request<T>('DELETE', path, { auth });
  }
}

/** Custom error class for API errors */
export class ApiRequestError extends Error {
  code: string;
  statusCode: number;
  details?: Array<{ code: string; message: string; path: string[] }>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Array<{ code: string; message: string; path: string[] }>
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** Singleton API client instance */
export const api = new ApiClient(BASE_URL);
export default api;
