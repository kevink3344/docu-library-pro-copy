import { createContext, useContext, useState, useEffect } from 'react';
import { db, getOrgsForUser } from '@/api/db';
import { useAuth } from '@/lib/AuthContext';

const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!user) { setLoading(false); return; }
      try {
        const allOrgs = await getOrgsForUser(user.id, user.role);
        setOrgs(allOrgs);
        const stored = localStorage.getItem('kbb_current_org');
        const found = allOrgs.find(o => o.id === stored);
        const defaultOrg = allOrgs.find(o => o.name === 'Safety Department') || allOrgs[0] || null;
        setCurrentOrg(found || defaultOrg);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user]);

  const handleSetCurrentOrg = (org) => {
    setCurrentOrg(org);
    if (org) localStorage.setItem('kbb_current_org', org.id);
  };

  const refreshOrgs = async () => {
    if (!user) return;
    const allOrgs = await getOrgsForUser(user.id, user.role);
    setOrgs(allOrgs);
    if (currentOrg) {
      const updated = allOrgs.find(o => o.id === currentOrg.id);
      setCurrentOrg(updated || allOrgs[0] || null);
    }
  };

  const isOrgAdmin = (org) => {
    if (!user || !org) return false;
    if (user.role === 'admin') return true;
    return org.admin_user_ids?.includes(user.id);
  };

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, setCurrentOrg: handleSetCurrentOrg, loading, user, refreshOrgs, isOrgAdmin }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}