import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  BookOpen, Building2, Settings, Menu, X,
  LogOut, Sun, Moon, LogIn
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const location = useLocation();

  const toggleDark = () => {
    const isDark = !dark;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  };

  const navItems = [
    { to: '/', label: 'Knowledge Base', icon: BookOpen },
    { to: '/organizations', label: 'Organizations', icon: Building2, superAdminOnly: true },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-primary flex items-center justify-center" style={{ borderRadius: 2 }}>
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm hidden sm:block">KBB Pro</span>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-2 ml-auto">
          <NotificationBell user={user} />
          <button
            onClick={toggleDark}
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ borderRadius: 2 }}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {user ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                {user.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm hidden sm:block text-foreground">{user.full_name}</span>
              <button
                onClick={() => logout()}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Sign in"
              style={{ borderRadius: 2 }}
            >
              <LogIn className="w-4 h-4" />
            </Link>
          )}
          <button
            className="md:hidden p-1.5 hover:bg-accent rounded"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - desktop */}
        <aside className="hidden md:flex flex-col w-52 border-r border-border bg-card shrink-0">
          <nav className="flex-1 p-3 space-y-0.5">
            {navItems.map(({ to, label, icon: Icon, superAdminOnly }) => {
              if (superAdminOnly && user?.role !== 'admin') return null;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                    isActive(to)
                      ? 'bg-primary/8 text-primary font-medium border-l-2 border-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  style={{ borderRadius: 2 }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-border">
            <p className="text-xs text-muted-foreground font-mono-data">v1.0.0</p>
          </div>
        </aside>

        {/* Mobile nav overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-black/20" onClick={() => setMobileOpen(false)}>
            <aside
              className="w-64 h-full bg-card border-r border-border p-3"
              onClick={e => e.stopPropagation()}
            >
              <nav className="space-y-0.5">
                {navItems.map(({ to, label, icon: Icon, superAdminOnly }) => {
                  if (superAdminOnly && user?.role !== 'admin') return null;
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                        isActive(to)
                          ? 'bg-primary/8 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                      style={{ borderRadius: 2 }}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}