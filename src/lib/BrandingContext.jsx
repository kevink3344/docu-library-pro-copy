import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchAppBranding } from '@/api/settings';

const BrandingContext = createContext({
  logoUrl: '',
  title: 'KBB Pro',
  hideLogo: false,
  loading: true,
  refreshBranding: () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }) {
  const [logoUrl, setLogoUrl] = useState('');
  const [title, setTitle] = useState('KBB Pro');
  const [hideLogo, setHideLogo] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshBranding = useCallback(async () => {
    try {
      const { logoUrl: url, title: t, hideLogo: h } = await fetchAppBranding();
      setLogoUrl(url);
      setTitle(t || 'KBB Pro');
      setHideLogo(h);
    } catch {
      // On error, keep defaults
      setLogoUrl('');
      setTitle('KBB Pro');
      setHideLogo(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  return (
    <BrandingContext.Provider value={{ logoUrl, title, hideLogo, loading, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
