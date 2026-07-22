import { useState, useEffect } from 'react';
import { useOrg } from '@/lib/OrgContext';
import { getPublicSetting, updateSetting, getAppInfo } from '@/api/settings';
import { Loader2 } from 'lucide-react';

const MODES = [
  { key: 'select', label: 'Select User (Test)' },
  { key: 'password', label: 'Password (Production)' },
  { key: 'maintenance', label: 'System Maintenance' },
];

export default function LoginModeManagement() {
  const { user } = useOrg();
  const [loginMode, setLoginMode] = useState('select');
  const [loginModeSaving, setLoginModeSaving] = useState(false);
  const [loginModeError, setLoginModeError] = useState('');
  const [loginModeSaved, setLoginModeSaved] = useState(false);
  const [loginModeOverride, setLoginModeOverride] = useState(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceDraft, setMaintenanceDraft] = useState('');
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState('');
  const [maintenanceSaved, setMaintenanceSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    Promise.all([
      getPublicSetting('login_mode'),
      getPublicSetting('maintenance_message'),
      getAppInfo().catch(() => ({ loginModeOverride: null })),
    ])
      .then(([mode, message, info]) => {
        const normalized = ['select', 'password', 'maintenance'].includes(mode) ? mode : 'select';
        setLoginMode(normalized);
        setMaintenanceMessage(message || '');
        setMaintenanceDraft(message || '');
        setLoginModeOverride(info?.loginModeOverride ?? null);
      })
      .catch((err) => setLoginModeError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (user?.role !== 'admin') {
    return <div className="p-4 text-center text-muted-foreground text-sm">Access restricted to Super Admins.</div>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const locked = !!loginModeOverride;

  const handleLoginModeToggle = async (nextMode) => {
    if (locked || loginModeSaving) return;
    const prev = loginMode;
    setLoginMode(nextMode);
    setLoginModeSaving(true);
    setLoginModeError('');
    setLoginModeSaved(false);
    try {
      await updateSetting('login_mode', nextMode);
      setLoginModeSaved(true);
    } catch (err) {
      setLoginMode(prev);
      setLoginModeError(err.message || 'Failed to update login mode');
    } finally {
      setLoginModeSaving(false);
    }
  };

  const handleSaveMaintenanceMessage = async () => {
    const prev = maintenanceMessage;
    setMaintenanceSaving(true);
    setMaintenanceError('');
    setMaintenanceSaved(false);
    try {
      await updateSetting('maintenance_message', maintenanceDraft);
      setMaintenanceMessage(maintenanceDraft);
      setMaintenanceSaved(true);
    } catch (err) {
      setMaintenanceDraft(prev);
      setMaintenanceError(err.message || 'Failed to save message');
    } finally {
      setMaintenanceSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Controls what the public login page shows. This is a global app setting, not per-organization.
      </p>

      {locked && (
        <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2 text-sm text-amber-900 dark:text-amber-100" style={{ borderRadius: 2 }}>
          Login mode is locked by the <code className="font-mono-data text-xs">LOGIN_MODE</code> environment
          variable (currently <strong>{loginModeOverride}</strong>). Change or remove that env var to unlock
          these controls. Database updates still save, but the login page will keep using the env value.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {MODES.map(({ key, label }) => {
          const active = loginMode === key;
          return (
            <button
              key={key}
              type="button"
              disabled={locked || loginModeSaving}
              onClick={() => handleLoginModeToggle(key)}
              className={`px-3 py-2 text-sm font-medium border transition-colors disabled:opacity-50 ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
              style={{ borderRadius: 2 }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loginModeSaving && <p className="text-xs text-muted-foreground">Saving…</p>}
      {loginModeSaved && !loginModeSaving && <p className="text-xs text-green-700 dark:text-green-400">Login mode saved.</p>}
      {loginModeError && <p className="text-xs text-destructive">{loginModeError}</p>}

      {(loginMode === 'maintenance' || loginModeOverride === 'maintenance') && (
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="field-label block">Maintenance message</label>
          <textarea
            value={maintenanceDraft}
            onChange={(e) => setMaintenanceDraft(e.target.value)}
            rows={3}
            className="kbb-input w-full resize-none"
            disabled={maintenanceSaving}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveMaintenanceMessage}
              disabled={maintenanceSaving || maintenanceDraft === maintenanceMessage}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              style={{ borderRadius: 2 }}
            >
              {maintenanceSaving ? 'Saving…' : 'Save message'}
            </button>
            {maintenanceSaved && !maintenanceSaving && (
              <span className="text-xs text-green-700 dark:text-green-400">Message saved.</span>
            )}
            {maintenanceError && <span className="text-xs text-destructive">{maintenanceError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
