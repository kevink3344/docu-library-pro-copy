import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_URL } from '@/api/apiClient';

const SESSION_KEY = 'kbb_session_user_id';
const TOKEN_KEY = 'kbb_token';

const AuthContext = createContext(null);

async function authFetch(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const storedId = localStorage.getItem(SESSION_KEY);
      if (!token && !storedId) {
        setIsLoadingAuth(false);
        return;
      }

      try {
        // Prefer token session; fall back to legacy user-id session via select login
        if (token && storedId) {
          const { db } = await import('@/api/db');
          const u = await db.User.get(storedId);
          if (u) {
            setUser(u);
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
            return;
          }
        }

        if (storedId && !token) {
          // Migrate legacy session: re-issue JWT via select login
          const data = await authFetch('/api/auth/login', { userId: storedId });
          localStorage.setItem(TOKEN_KEY, data.token);
          localStorage.setItem(SESSION_KEY, data.user.id);
          setUser(data.user);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error(err);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    restore();
  }, []);

  const login = async (userId, organizationId) => {
    const data = await authFetch('/api/auth/login', { userId, organizationId });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(SESSION_KEY, data.user.id);
    if (organizationId) localStorage.setItem('kbb_current_org', organizationId);
    setUser(data.user);
    setIsAuthenticated(true);
    return data.user;
  };

  const loginWithPassword = async (email, password) => {
    const data = await authFetch('/api/auth/login-with-password', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(SESSION_KEY, data.user.id);
    setUser(data.user);
    setIsAuthenticated(true);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, login, loginWithPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
