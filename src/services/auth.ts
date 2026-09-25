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
  ForgotPasswordDto,
  ResetPasswordDto,
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
    return api.post<{ success: true; message: string }>('/auth/verify-phone', dto, false);
  },

  /** POST /auth/verify-phone/confirm — Confirm OTP */
  confirmPhoneOtp(dto: ConfirmPhoneDto): Promise<{ success: true }> {
    return api.post<{ success: true }>('/auth/verify-phone/confirm', dto);
  },

  /** POST /auth/resend-otp — Resend phone OTP */
  resendOtp(dto: VerifyPhoneDto): Promise<{ success: true; message: string }> {
    return api.post<{ success: true; message: string }>('/auth/resend-otp', dto, false);
  },

  /** POST /auth/forgot-password — Initiate password reset */
  forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true; message: string }> {
    return api.post<{ success: true; message: string }>('/auth/forgot-password', dto, false);
  },

  /** POST /auth/reset-password — Confirm password reset with token */
  resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    return api.post<{ success: true }>('/auth/reset-password', dto, false);
  },

  /** POST /auth/oauth/:provider */
  oauthLogin(provider: OAuthProvider, dto: OAuthLoginDto): Promise<AuthResponse> {
    return api.post<AuthResponse>(`/auth/oauth/${provider}`, dto, false);
  },

  /** POST /auth/link-external */
  linkExternal(dto: LinkExternalDto): Promise<{ linkedProviders: string[] }> {
    return api.post<{ linkedProviders: string[] }>('/auth/link-external', dto);
  },

  /** POST /auth/change-password */
  changePassword(dto: { newPassword: string; currentPassword?: string; ticket?: string }): Promise<{ success: true; message: string }> {
    return api.post<{ success: true; message: string }>('/auth/change-password', dto);
  },

  /** POST /auth/security/send-code */
  requestSecurityCode(dto: {
    action: 'change-password' | 'delete-account';
    method: 'email' | 'phone';
    identifier: string;
  }): Promise<{ success: true; message: string }> {
    return api.post<{ success: true; message: string }>('/auth/security/send-code', dto);
  },

  /** POST /auth/security/verify-code */
  verifySecurityCode(dto: {
    action: 'change-password' | 'delete-account';
    otp: string;
  }): Promise<{ success: true; ticket: string }> {
    return api.post<{ success: true; ticket: string }>('/auth/security/verify-code', dto);
  },
};

export default authService;
