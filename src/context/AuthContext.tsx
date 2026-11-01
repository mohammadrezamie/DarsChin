// ============================================================================
// DARSCHYN (درس‌چین) - Authentication Context (Mobile Number + Password)
// ============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '../types';
import { apiRequest, getStoredToken, setStoredToken } from '../utils/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (mobile: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (
    mobile: string,
    password: string,
    name: string,
    recoveryKey?: string
  ) => Promise<{ success: boolean; error?: string; recoveryKey?: string }>;
  recoverPassword: (
    mobile: string,
    recoveryKey: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => void;
  switchDemoRole: (role: UserRole) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  recoverPassword: async () => ({ success: false }),
  changePassword: async () => ({ success: false }),
  logout: () => {},
  switchDemoRole: async () => {},
  refreshUser: async () => {},
});


function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const token = getStoredToken();
    if (token) {
      const claims = decodeJwt(token);
      if (claims) {
        return {
          id: claims.id,
          mobile: claims.mobile,
          name: claims.name,
          roles: claims.roles || ['student'],
          permissions: claims.permissions || [],
        } as User;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(!getStoredToken());

  const fetchCurrentUser = async () => {
    setIsLoading(true);
    const res = await apiRequest<User & { token?: string }>('/api/auth/me');
    if (res.success && res.data) {
      if (res.data.token) {
        setStoredToken(res.data.token);
      }
      setUser(res.data);
    } else {
      setUser(null);
      setStoredToken(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (mobile: string, password: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ mobile, password }),
    });
    if (res.success && res.data) {
      setStoredToken(res.data.token);
      setUser(res.data.user);
      return { success: true, user: res.data.user };
    }
    return { success: false, error: res.error || 'خطا در ورود به حساب کاربری.' };
  };

  const register = async (mobile: string, password: string, name: string, recoveryKey?: string) => {
    const res = await apiRequest<{ token: string; user: User & { recoveryKey?: string } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ mobile, password, name, recoveryKey }),
    });
    if (res.success && res.data) {
      setStoredToken(res.data.token);
      setUser(res.data.user);
      return { success: true, recoveryKey: res.data.user.recoveryKey };
    }
    return { success: false, error: res.error || 'خطا در ثبت‌نام حساب کاربری.' };
  };

  const recoverPassword = async (mobile: string, recoveryKey: string, newPassword: string) => {
    const res = await apiRequest<{ message: string }>('/api/auth/recover-password', {
      method: 'POST',
      body: JSON.stringify({ mobile, recoveryKey, newPassword }),
    });
    if (res.success) {
      return { success: true, message: res.data?.message || 'رمز عبور با موفقیت بازنشانی شد.' };
    }
    return { success: false, error: res.error || 'خطا در بازنشانی رمز عبور.' };
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await apiRequest<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.success) {
      return { success: true, message: res.data?.message || 'رمز عبور با موفقیت تغییر یافت.' };
    }
    return { success: false, error: res.error || 'خطا در تغییر رمز عبور.' };
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
  };

  const switchDemoRole = async (role: UserRole) => {
    setIsLoading(true);
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    if (res.success && res.data) {
      setStoredToken(res.data.token);
      setUser(res.data.user);
    }
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        recoverPassword,
        changePassword,
        logout,
        switchDemoRole,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
