import { useState } from 'react';
import { useOrg } from '@/lib/OrgContext';
import { Link, Routes, Route, useLocation, Outlet, Navigate } from 'react-router-dom';
import { Settings as SettingsIcon, Layers, Layout, Users, MapPin, Building2 } from 'lucide-react';
import OrgSwitcher from '@/components/layout/OrgSwitcher';

const tabs = [
  { to: '/settings/fields', label: 'Field Management', icon: Layers },
  { to: '/settings/layout', label: 'Layout', icon: Layout },
  { to: '/settings/teams', label: 'Teams', icon: Users },
  { to: '/settings/locations', label: 'Sites', icon: MapPin },
  { to: '/settings/departments', label: 'Departments', icon: Building2 },
];

export default function Settings() {
  const { currentOrg, user, isOrgAdmin } = useOrg();
  const location = useLocation();

  if (!currentOrg) return <div className="p-8 text-center text-muted-foreground text-sm">No organization selected.</div>;
  if (!isOrgAdmin(currentOrg)) return <div className="p-8 text-center text-muted-foreground text-sm">Access restricted to Org Admins.</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">Settings</h1>
          <OrgSwitcher />
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{currentOrg?.name}</p>
      </div>

      <div className="flex gap-0 border-b border-border mb-6">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors -mb-px ${
              location.pathname.startsWith(to)
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </div>

      <Outlet />
    </div>
  );
}