"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiRequestError } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<User>;
  register: (data: { name: string; email: string; password: string; phone?: string; locale?: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(initialUser === null);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Re-validate the session on mount only when the server did not provide a user
    // but a cookie might exist (e.g. after a refresh).
    if (initialUser === null && typeof document !== "undefined" && /(^|;\s*)(access_token|refresh_token)=/.test(document.cookie)) {
      void refresh();
    } else {
      setLoading(false);
    }
  }, [initialUser, refresh]);

  const login = useCallback(async (email: string, password: string, remember = true) => {
    const res = await api.post<AuthResponse>("/auth/login", { email, password, remember });
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data: { name: string; email: string; password: string; phone?: string; locale?: string }) => {
    const res = await api.post<AuthResponse>("/auth/register", data);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      isEditor: user?.role === "admin" || user?.role === "editor",
      login,
      register,
      logout,
      refresh,
      setUser,
    }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Extract a user-friendly message (and field errors) from an API error. */
export function errorMessage(e: unknown, fallback = "Something went wrong"): { message: string; fields?: Record<string, string> } {
  if (e instanceof ApiRequestError) return { message: e.message || fallback, fields: e.fields };
  if (e instanceof Error) return { message: e.message || fallback };
  return { message: fallback };
}
