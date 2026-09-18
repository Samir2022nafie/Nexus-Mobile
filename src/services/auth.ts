/**
 * Auth Service — Maps to POST /auth/* endpoints
 */
import api from './api';
import {
  AuthResponse,
  RegisterDto,
  LoginDto,
  VerifyPhoneDto,
  ConfirmPhoneDto,
  OAuthLoginDto,
  OAuthProvider,
  LinkExternalDto,
} from '../types';

export const authService = {
  /** POST /auth/register */
  register(dto: RegisterDto): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/register', dto, false);
  },

  /** POST /auth/login */
  login(dto: LoginDto): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/login', dto, false);
  },

  /** POST /auth/logout */
  logout(): Promise<{ success: true }> {
    return api.post<{ success: true }>('/auth/logout');
  },

  /** POST /auth/verify-phone — Request OTP */
  requestPhoneOtp(dto: VerifyPhoneDto): Promise<{ success: true; message: string }> {
    return api.post<{ success: true; message: string }>('/auth/verify-phone', dto);
  },

  /** POST /auth/verify-phone/confirm — Confirm OTP */
  confirmPhoneOtp(dto: ConfirmPhoneDto): Promise<{ success: true }> {
    return api.post<{ success: true }>('/auth/verify-phone/confirm', dto);
  },

  /** POST /auth/oauth/:provider */
  oauthLogin(provider: OAuthProvider, dto: OAuthLoginDto): Promise<AuthResponse> {
    return api.post<AuthResponse>(`/auth/oauth/${provider}`, dto, false);
  },

  /** POST /auth/link-external */
  linkExternal(dto: LinkExternalDto): Promise<{ linkedProviders: string[] }> {
    return api.post<{ linkedProviders: string[] }>('/auth/link-external', dto);
  },
};
