import { useState } from 'react';
import { ChevronDown, Building2 } from 'lucide-react';
import { useOrg } from '@/lib/OrgContext';

export default function OrgSwitcher() {
  const { currentOrg, setCurrentOrg, orgs } = useOrg();
  const [open, setOpen] = useState(false);

  if (!orgs.length) return (
    <div className="text-sm text-muted-foreground px-2">No organizations</div>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 border border-border bg-background hover:bg-accent text-sm transition-colors"
        style={{ borderRadius: 2 }}
      >
        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="max-w-[140px] truncate">{currentOrg?.name || 'Select Org'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-card border border-border z-50 shadow-sm" style={{ borderRadius: 2 }}>
          {orgs.map(org => (
            <button
              key={org.id}
              onClick={() => { setCurrentOrg(org); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                currentOrg?.id === org.id ? 'text-primary font-medium' : 'text-foreground'
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}