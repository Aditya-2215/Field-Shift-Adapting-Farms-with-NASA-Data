import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, setAccessToken } from '../services/api';
import type { UserProfile } from '../../shared/types/agri';

interface AuthContextValue {
  user: UserProfile | null;
  firebaseUser: UserProfile | null; // Backwards compatibility alias
  profile: UserProfile | null;
  authReady: boolean;
  isDemoMode: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (fullName: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  loginWithGoogleCredential: (credential: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  enterDemoMode: () => void;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; resetToken?: string }>;
  resetPassword: (token: string, password: string, confirmPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  updateUserProfile: (patch: { name?: string; preferredLanguage?: string; location?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const DEMO_PROFILE: UserProfile = {
  uid: 'demo_user',
  name: 'Demonstration Farmer (UP)',
  email: 'demo@agrishift.local',
  role: 'farmer',
  preferredLanguage: 'English',
  location: 'Barabanki, Uttar Pradesh, India',
  createdAt: '2026-01-10T08:00:00.000Z',
  updatedAt: '2026-10-15T08:00:00.000Z'
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Attempt silent refresh via HttpOnly cookie on application startup
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const token = await apiClient.refresh();
        if (token) {
          const me = await apiClient.getMe();
          if (isMounted) {
            setUser(me);
            setIsDemoMode(false);
          }
        } else {
          if (isMounted) {
            setUser(null);
            setIsDemoMode(true);
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setIsDemoMode(true);
        }
      } finally {
        if (isMounted) {
          setAuthReady(true);
        }
      }
    }

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    setAuthError(null);
    try {
      const res = await apiClient.login({ email, password, rememberMe });
      setAccessToken(res.accessToken);
      setUser(res.user);
      setIsDemoMode(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setAuthError(msg);
      throw err;
    }
  };

  const register = async (fullName: string, email: string, password: string, confirmPassword: string) => {
    setAuthError(null);
    try {
      const res = await apiClient.register({ fullName, email, password, confirmPassword });
      setAccessToken(res.accessToken);
      setUser(res.user);
      setIsDemoMode(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setAuthError(msg);
      throw err;
    }
  };

  const loginWithGoogleCredential = async (credential: string) => {
    setAuthError(null);
    try {
      const res = await apiClient.verifyGoogleCredential(credential);
      setAccessToken(res.accessToken);
      setUser(res.user);
      setIsDemoMode(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setAuthError(msg);
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    // Redirect to backend OAuth2 flow
    window.location.href = '/api/auth/google';
  };

  const enterDemoMode = () => {
    setAuthError(null);
    setIsDemoMode(true);
    setUser(null);
  };

  const logout = async () => {
    setAuthError(null);
    try {
      await apiClient.logout();
    } catch {
      // Ignored
    } finally {
      setAccessToken(null);
      setUser(null);
      setIsDemoMode(true);
    }
  };

  const logoutAll = async () => {
    setAuthError(null);
    try {
      await apiClient.logoutAll();
    } catch {
      // Ignored
    } finally {
      setAccessToken(null);
      setUser(null);
      setIsDemoMode(true);
    }
  };

  const forgotPassword = async (email: string) => {
    setAuthError(null);
    return apiClient.forgotPassword(email);
  };

  const resetPassword = async (token: string, password: string, confirmPassword: string) => {
    setAuthError(null);
    await apiClient.resetPassword({ token, password, confirmPassword });
  };

  const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    setAuthError(null);
    await apiClient.changePassword({ currentPassword, newPassword, confirmPassword });
  };

  const updateUserProfile = async (patch: { name?: string; preferredLanguage?: string; location?: string }) => {
    if (!user || isDemoMode) {
      throw new Error('Sign in with your account to edit and save profile preferences. Demonstration mode is read-only.');
    }
    const updated = await apiClient.updateProfile(patch);
    setUser(updated);
  };

  const activeProfile = isDemoMode || !user ? DEMO_PROFILE : user;

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser: user, // Alias so existing components referencing firebaseUser work seamlessly
        profile: activeProfile,
        authReady,
        isDemoMode,
        authError,
        setAuthError,
        login,
        register,
        loginWithGoogleCredential,
        signInWithGoogle,
        enterDemoMode,
        logout,
        logoutAll,
        forgotPassword,
        resetPassword,
        changePassword,
        updateUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
