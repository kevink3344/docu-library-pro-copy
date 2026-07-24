import { useState, useEffect } from 'react';
import { useBranding } from '@/lib/BrandingContext';
import { updateSetting } from '@/api/settings';
import { Palette, Loader2, X } from 'lucide-react';

const URL_REGEX = /^(https?:\/\/.+|data:image\/(svg\+xml|png|jpeg|gif|webp);base64,.+|)$/;

export default function BrandingManagement() {
  const { logoUrl, title, hideLogo, refreshBranding } = useBranding();

  const [logoUrlDraft, setLogoUrlDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [hideLogoDraft, setHideLogoDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setLogoUrlDraft(logoUrl);
    setTitleDraft(title);
    setHideLogoDraft(hideLogo);
    setPreviewError(false);
  }, [logoUrl, title, hideLogo]);

  const hasChanges =
    logoUrlDraft !== logoUrl ||
    titleDraft !== title ||
    hideLogoDraft !== hideLogo;

  const isUrlValid = URL_REGEX.test(logoUrlDraft);

  const handleSave = async () => {
    if (!isUrlValid) {
      setError('Logo URL must be a valid http/https URL or a data URI, or empty.');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await Promise.all([
        updateSetting('app_logo_url', logoUrlDraft),
        updateSetting('app_title', titleDraft),
        updateSetting('hide_logo', hideLogoDraft ? 'true' : 'false'),
      ]);
      setSaved(true);
      await refreshBranding();
    } catch (err) {
      setError(err.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customize the application logo and title shown in the header and on the login page.
        This is a global app setting, not per-organization.
      </p>

      {/* Logo URL */}
      <div className="space-y-1.5">
        <label className="field-label block">Logo URL</label>
        <div className="flex gap-2">
          <input
            value={logoUrlDraft}
            onChange={(e) => {
              setLogoUrlDraft(e.target.value);
              setPreviewError(false);
            }}
            placeholder="https://example.com/logo.svg or data:image/..."
            className="kbb-input flex-1 font-mono-data text-xs"
          />
          {logoUrlDraft && (
            <button
              onClick={() => {
                setLogoUrlDraft('');
                setPreviewError(false);
              }}
              className="p-2 hover:bg-accent text-muted-foreground transition-colors"
              style={{ borderRadius: 2 }}
              title="Clear logo URL"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {logoUrlDraft && !isUrlValid && (
          <p className="text-xs text-destructive">Invalid URL format. Use http/https or a valid data URI.</p>
        )}
      </div>

      {/* Logo Preview */}
      {logoUrlDraft && isUrlValid && (
        <div className="space-y-1.5">
          <label className="field-label block text-xs">Preview</label>
          <div className="border border-border rounded-sm p-4 bg-background inline-flex items-center justify-center min-h-[60px] min-w-[60px]">
            {previewError ? (
              <span className="text-xs text-muted-foreground">Image failed to load</span>
            ) : (
              <img
                src={logoUrlDraft}
                alt="Logo preview"
                className="h-10 w-auto max-w-[180px] object-contain"
                onError={() => setPreviewError(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* App Title */}
      <div className="space-y-1.5">
        <label className="field-label block">App Title</label>
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          placeholder="KBB Pro"
          maxLength={60}
          className="kbb-input w-full"
        />
        <p className="text-xs text-muted-foreground">{titleDraft.length}/60 characters</p>
      </div>

      {/* Hide Logo Checkbox */}
      <div className="flex items-center gap-2.5 pt-1">
        <input
          type="checkbox"
          id="hide_logo"
          checked={hideLogoDraft}
          onChange={(e) => setHideLogoDraft(e.target.checked)}
          className="accent-primary"
        />
        <label htmlFor="hide_logo" className="text-sm">
          Hide logo in header (show title only)
        </label>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving || (logoUrlDraft !== '' && !isUrlValid)}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          style={{ borderRadius: 2 }}
        >
          {saving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin" /> Saving…
            </span>
          ) : (
            'Save Branding'
          )}
        </button>
        {saved && !saving && (
          <span className="text-xs text-green-700 dark:text-green-400">Branding saved.</span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}