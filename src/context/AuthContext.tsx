/**
 * Auth Context — Global authentication state with SecureStore persistence.
 * Manages user session, token storage, and provides login/register/logout methods.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { authService } from '../services/auth';
import { usersService } from '../services/users';
import { User, RegisterDto, LoginDto } from '../types';
import { ApiRequestError } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<{ phone?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  /** On mount: try to rehydrate session from SecureStore */
  useEffect(() => {
    const rehydrate = async () => {
      try {
        const storedToken = await api.getToken();
        if (storedToken) {
          // Validate token by fetching user profile
          const user = await usersService.getMyProfile();
          setState({
            user,
            token: storedToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        // Token invalid/expired — clear it
        await api.clearToken();
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    rehydrate();
  }, []);

  /** Register 401 handler to auto-logout */
  useEffect(() => {
    api.setOnUnauthorized(() => {
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    });
  }, []);

  /** Login with email/phone + password */
  const login = useCallback(async (dto: LoginDto) => {
    const result = await authService.login(dto);
    await api.setToken(result.token);
    setState({
      user: result.user,
      token: result.token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  /** Register new account — returns phone for OTP flow if provided */
  const register = useCallback(async (dto: RegisterDto): Promise<{ phone?: string }> => {
    const result = await authService.register(dto);
    await api.setToken(result.token);
    setState({
      user: result.user,
      token: result.token,
      isAuthenticated: true,
      isLoading: false,
    });
    return { phone: dto.phoneNumber };
  }, []);

  /** Logout and clear session */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore errors during logout (token may already be invalid)
    }
    await api.clearToken();
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  /** Refresh user data from backend */
  const refreshUser = useCallback(async () => {
    try {
      const user = await usersService.getMyProfile();
      setState((prev) => ({ ...prev, user }));
    } catch {
      // Silently fail
    }
  }, []);

  /** Update user state locally (e.g., after profile edit) */
  const updateUser = useCallback((user: User) => {
    setState((prev) => ({ ...prev, user }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
