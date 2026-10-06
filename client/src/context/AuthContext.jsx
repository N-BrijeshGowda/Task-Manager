import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  const refreshStats = useCallback(async () => {
    try {
      const { data } = await api.get('/stats');
      setStats(data);
    } catch {
      /* the navbar badge is not critical */
    }
  }, []);

  useEffect(() => {
    applyTheme(localStorage.getItem('theme') || 'light');
    if (!localStorage.getItem('token')) return;
    api.get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        applyTheme(data.user.theme);
        if (!data.user.must_change_password) refreshStats();
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, [refreshStats]);

  const startSession = (data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
    applyTheme(data.user.theme);
    if (!data.user.must_change_password) refreshStats();
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    startSession(data);
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    startSession(data);
  };

  // Called after the forced password change succeeds.
  const passwordChanged = () => {
    setUser((u) => (u ? { ...u, must_change_password: false } : u));
    refreshStats();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setStats(null);
  };

  const toggleTheme = async () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setUser((u) => (u ? { ...u, theme: next } : u));
    try {
      await api.patch('/auth/theme', { theme: next });
    } catch {
      /* theme still applied locally */
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, stats, refreshStats, login, register, logout, toggleTheme, passwordChanged }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
