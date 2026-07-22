import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Loader2 } from 'lucide-react';
import { db } from '@/api/db';
import { getPublicSetting } from '@/api/settings';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const { login, loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const adminOverride = new URLSearchParams(location.search).get('admin') === '1';

  const [loginMode, setLoginMode] = useState(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    'The system is currently undergoing maintenance. Please try again later.'
  );

  const [orgs, setOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [stats, setStats] = useState({ teams: 0, documents: 0, locations: 0 });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    Promise.all([
      getPublicSetting('login_mode').catch(() => 'select'),
      getPublicSetting('maintenance_message').catch(() => null),
    ])
      .then(([mode, message]) => {
        const normalized = ['select', 'password', 'maintenance'].includes(mode) ? mode : 'select';
        setLoginMode(normalized);
        if (message) setMaintenanceMessage(message);
      })
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    const showSelect = loginMode === 'select' || loginMode === null;
    if (!showSelect) return;
    db.Organization.list()
      .then((list) => {
        setOrgs(list);
        if (list[0]) setSelectedOrgId(list[0].id);
      })
      .catch((e) => setError(e.message));
  }, [loginMode]);

  useEffect(() => {
    if (!selectedOrgId) return;
    if (loginMode !== 'select' && loginMode !== null) return;
    setSelectedUserId('');

    Promise.all([
      db.OrgMember.filter({ org_id: selectedOrgId }),
      db.Team.filter({ org_id: selectedOrgId }),
      db.KBBDocument.filter({ org_id: selectedOrgId }),
      db.Location.filter({ org_id: selectedOrgId }),
    ]).then(async ([members, teams, docs, locs]) => {
      let validUsers = [];
      if (members.length > 0) {
        const memberUsers = await Promise.all(
          members.map((m) => db.User.get(m.user_id).catch(() => null))
        );
        validUsers = memberUsers.filter(Boolean);
      }
      if (validUsers.length === 0) {
        validUsers = await db.User.list();
      }
      setUsers(validUsers);
      if (validUsers[0]) setSelectedUserId(validUsers[0].id);
      setStats({
        teams: teams.length,
        documents: docs.filter((d) => !d.is_archived).length,
        locations: locs.length,
      });
    }).catch((e) => setError(e.message));
  }, [selectedOrgId, loginMode]);

  const handleSelectSignIn = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError('');
    try {
      localStorage.setItem('kbb_current_org', selectedOrgId);
      await login(selectedUserId, selectedOrgId);
      navigate('/');
    } catch (e) {
      setError(e.message || 'Sign in failed');
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await loginWithPassword(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Sign in failed');
      setLoading(false);
    }
  };

  const showMaintenance = loginMode === 'maintenance' && !adminOverride;
  const showSelect = loginMode === 'select' || loginMode === null;
  const showPassword =
    loginMode === 'password' ||
    loginMode === null ||
    (loginMode === 'maintenance' && adminOverride);

  if (initializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#1a2744] text-white flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 flex items-center justify-center rounded-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-sm font-semibold tracking-widest text-blue-300 uppercase mb-4">
            KBB Pro &mdash; Document Library
          </p>
          <h1 className="text-5xl font-extrabold leading-tight mb-6">
            Sign in to<br />KBB Pro
          </h1>
          <p className="text-blue-200 text-base max-w-xs leading-relaxed">
            {showMaintenance
              ? 'Access is temporarily unavailable while maintenance is in progress.'
              : showPassword && !showSelect
                ? 'Sign in with your email and password.'
                : 'Choose a test user and sign in instantly. The correct organization context will be applied automatically.'}
          </p>
        </div>

        {showSelect && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: stats.teams, label: 'Teams' },
              { value: stats.documents, label: 'Documents' },
              { value: stats.locations, label: 'Locations' },
            ].map(({ value, label }) => (
              <div key={label} className="border border-white/20 rounded-sm p-4">
                <div className="text-3xl font-bold">{value}</div>
                <div className="text-xs font-semibold tracking-widest text-blue-300 uppercase mt-1">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-sm">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">KBB Pro</span>
          </div>

          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-1">
            Authentication
          </p>
          <h2 className="text-3xl font-bold text-foreground mb-2">Sign In</h2>

          {showMaintenance ? (
            <div className="mt-6 p-4 border border-border bg-muted/30 text-sm text-muted-foreground whitespace-pre-wrap" style={{ borderRadius: 2 }}>
              {maintenanceMessage}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-8">
                {showSelect && showPassword
                  ? 'Loading sign-in options…'
                  : showPassword
                    ? 'Enter your email and password to continue.'
                    : 'Select a test user from the directory and create a session without entering a password.'}
              </p>

              {error && (
                <div className="mb-4 p-3 rounded bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {showSelect && (
                <div className="space-y-5 mb-8">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                      Organization
                    </label>
                    <select
                      className="w-full h-11 px-3 border border-border bg-background text-foreground text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      disabled={orgs.length === 0}
                    >
                      {orgs.length === 0 && <option>No organizations found</option>}
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                      Test User
                    </label>
                    <select
                      className="w-full h-11 px-3 border border-border bg-background text-foreground text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      disabled={users.length === 0}
                    >
                      {users.length === 0 && <option>No members in this org</option>}
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.email}
                          {u.role === 'admin' ? ' (Admin)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleSelectSignIn}
                    disabled={!selectedUserId || loading}
                    className="w-full h-12 bg-primary text-primary-foreground text-sm font-bold tracking-widest uppercase rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Sign In as Selected User
                  </button>
                </div>
              )}

              {showPassword && (
                <form onSubmit={handlePasswordSignIn} className="space-y-5">
                  {showSelect && (
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">or password</span>
                      </div>
                    </div>
                  )}
                  {adminOverride && loginMode === 'maintenance' && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Admin bypass active — password sign-in is available during maintenance.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                      Email
                    </label>
                    <input
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 px-3 border border-border bg-background text-foreground text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                      Password
                    </label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-11 px-3 border border-border bg-background text-foreground text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email.trim() || !password}
                    className="w-full h-12 bg-primary text-primary-foreground text-sm font-bold tracking-widest uppercase rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Sign In
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
