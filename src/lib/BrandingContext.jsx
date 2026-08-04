import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchAppBranding } from '@/api/settings';

const BrandingContext = createContext({
  logoUrl: '',
  title: 'KBB Pro',
  hideLogo: false,
  styleTheme: 'current',
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
  const [styleTheme, setStyleTheme] = useState('current');
  const [loading, setLoading] = useState(true);

  const refreshBranding = useCallback(async () => {
    try {
      const { logoUrl: url, title: t, hideLogo: h, styleTheme: st } = await fetchAppBranding();
      setLogoUrl(url);
      setTitle(t || 'KBB Pro');
      setHideLogo(h);
      setStyleTheme(st || 'current');
    } catch {
      // On error, keep defaults
      setLogoUrl('');
      setTitle('KBB Pro');
      setHideLogo(false);
      setStyleTheme('current');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  useEffect(() => {
    document.documentElement.dataset.styleTheme = styleTheme;
  }, [styleTheme]);

  return (
    <BrandingContext.Provider value={{ logoUrl, title, hideLogo, styleTheme, loading, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
