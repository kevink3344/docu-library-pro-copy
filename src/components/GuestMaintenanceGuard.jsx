import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getPublicSetting } from '@/api/settings';

/**
 * Layout route for public KB pages. When login_mode is maintenance and the
 * visitor is not authenticated, redirect to /login (whole-site guest lock).
 */
export default function GuestMaintenanceGuard() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [loginMode, setLoginMode] = useState(null);

  useEffect(() => {
    if (isAuthenticated) return;
    getPublicSetting('login_mode')
      .then((mode) => {
        setLoginMode(['select', 'password', 'maintenance'].includes(mode) ? mode : 'select');
      })
      .catch(() => setLoginMode('select'));
  }, [isAuthenticated]);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" style={{ borderRadius: '50%' }} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Outlet />;
  }

  if (loginMode === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" style={{ borderRadius: '50%' }} />
      </div>
    );
  }

  if (loginMode === 'maintenance') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
