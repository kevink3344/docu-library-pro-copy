import { useState } from 'react';
import { useOrg } from '@/lib/OrgContext';
import { Layers, Layout, Users, User, MapPin, Building2, Building, KeyRound, Palette, BookOpen, ChevronDown } from 'lucide-react';
import OrgSwitcher from '@/components/layout/OrgSwitcher';
import FieldManagement from '@/pages/settings/FieldManagement';
import LayoutCustomization from '@/pages/settings/LayoutCustomization';
import TeamManagement from '@/pages/settings/TeamManagement';
import LocationManagement from '@/pages/settings/LocationManagement';
import DepartmentManagement from '@/pages/settings/DepartmentManagement';
import MemberManagement from '@/pages/settings/MemberManagement';
import OrganizationManagement from '@/pages/settings/OrganizationManagement';
import LoginModeManagement from '@/pages/settings/LoginModeManagement';
import BrandingManagement from '@/pages/settings/BrandingManagement';
import ApiDocs from '@/pages/settings/ApiDocs';

const sections = [
  { key: 'apiDocs', label: 'API Docs', icon: BookOpen, Component: ApiDocs },
  { key: 'branding', label: 'Branding', icon: Palette, Component: BrandingManagement },
  { key: 'fields', label: 'Field Management', icon: Layers, Component: FieldManagement },
  { key: 'layout', label: 'Layout', icon: Layout, Component: LayoutCustomization },
  { key: 'teams', label: 'Teams', icon: Users, Component: TeamManagement },
  { key: 'locations', label: 'Sites', icon: MapPin, Component: LocationManagement },
  { key: 'departments', label: 'Departments', icon: Building2, Component: DepartmentManagement },
  { key: 'members', label: 'Users', icon: User, Component: MemberManagement },
  { key: 'organizations', label: 'Organizations', icon: Building, Component: OrganizationManagement },
  { key: 'loginMode', label: 'Login Mode', icon: KeyRound, Component: LoginModeManagement },
];

export default function Settings() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const [open, setOpen] = useState(new Set());

  if (!currentOrg) return <div className="p-8 text-center text-muted-foreground text-sm">No organization selected.</div>;
  if (!isOrgAdmin(currentOrg)) return <div className="p-8 text-center text-muted-foreground text-sm">Access restricted to Org Admins.</div>;

  const toggle = (key) => {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">Settings</h1>
          <OrgSwitcher />
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{currentOrg?.name}</p>
      </div>

      <div className="kbb-card overflow-hidden">
        {sections.map(({ key, label, icon: Icon, Component }, idx) => {
          const isOpen = open.has(key);
          return (
            <div key={key} className={idx !== 0 ? 'border-t border-border' : ''}>
              <button
                onClick={() => toggle(key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4">
                  <Component />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
