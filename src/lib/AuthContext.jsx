import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '@/api/db';

const SESSION_KEY = 'kbb_session_user_id';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) { setIsLoadingAuth(false); return; }
    db.User.get(stored)
      .then(u => {
        if (u) { setUser(u); setIsAuthenticated(true); }
      })
      .catch(console.error)
      .finally(() => setIsLoadingAuth(false));
  }, []);

  const login = async (userId) => {
    const u = await db.User.get(userId);
    if (!u) throw new Error('User not found');
    localStorage.setItem(SESSION_KEY, userId);
    setUser(u);
    setIsAuthenticated(true);
    return u;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
