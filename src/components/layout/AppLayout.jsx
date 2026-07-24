import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useBranding } from '@/lib/BrandingContext';
import {
  BookOpen, Settings, Menu, X,
  LogOut, Sun, Moon, LogIn
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';

const DARK_KEY = 'kbb_dark_mode';

function readDarkPreference() {
  try {
    const stored = localStorage.getItem(DARK_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch { /* ignore */ }
  return document.documentElement.classList.contains('dark');
}

export default function AppLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  const { logoUrl, title, hideLogo } = useBranding();
  const [logoError, setLogoError] = useState(false);
  const isGuest = !isAuthenticated;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(readDarkPreference);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(DARK_KEY, dark ? '1' : '0');
    } catch { /* ignore */ }
  }, [dark]);

  const toggleDark = () => setDark((d) => !d);

  const navItems = [
    { to: '/', label: 'Knowledge Base', icon: BookOpen },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          {!hideLogo && logoUrl && !logoError ? (
            <img
              src={logoUrl}
              alt={title || 'KBB Pro'}
              className="h-7 w-auto max-w-[120px] object-contain"
              onError={() => setLogoError(true)}
            />
          ) : !hideLogo ? (
            <div className="w-7 h-7 bg-primary flex items-center justify-center" style={{ borderRadius: 2 }}>
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
          ) : null}
          <span className="font-semibold text-sm hidden sm:block">{title || 'KBB Pro'}</span>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-2 ml-auto">
          {!isGuest && <NotificationBell user={user} />}
          <button
            onClick={toggleDark}
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ borderRadius: 2 }}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {isGuest ? (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm hover:bg-accent transition-colors"
              title="Sign in"
              style={{ borderRadius: 2 }}
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm hidden sm:block text-foreground">{user?.full_name}</span>
              <button
                onClick={() => logout()}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          {!isGuest && (
            <button
              className="md:hidden p-1.5 hover:bg-accent rounded"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Open menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        {!isGuest && (
          <aside className="hidden md:flex flex-col w-52 border-r border-border bg-card shrink-0">
            <nav className="flex-1 p-3 space-y-0.5">
              {navItems.map(({ to, label, icon: Icon }) => (
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
              ))}
            </nav>
            <div className="p-3 border-t border-border">
              <p className="text-xs text-muted-foreground font-mono-data">v1.0.0</p>
            </div>
          </aside>
        )}

        {!isGuest && mobileOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-black/20" onClick={() => setMobileOpen(false)}>
            <aside
              className="w-64 h-full bg-card border-r border-border p-3"
              onClick={e => e.stopPropagation()}
            >
              <nav className="space-y-0.5">
                {navItems.map(({ to, label, icon: Icon }) => (
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
                ))}
              </nav>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
