import { useState, useEffect, useRef } from 'react';
import { db } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { X, ChevronDown } from 'lucide-react';

export default function LocationSelectInput({ value = [], onChange }) {
  const { currentOrg } = useOrg();
  const [locations, setLocations] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!currentOrg) return;
    db.Location.filter({ org_id: currentOrg.id }).then(locs => {
      locs.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.name.localeCompare(b.name);
      });
      setLocations(locs);
    });
  }, [currentOrg]);

  useEffect(() => {
    const handleClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = locations.filter(loc =>
    !value.includes(loc.name) &&
    loc.name.toLowerCase().includes(query.toLowerCase())
  );

  const select = (name) => {
    onChange([...value, name]);
    setQuery('');
    setOpen(false);
  };

  const remove = (name) => onChange(value.filter(v => v !== name));

  return (
    <div ref={ref} className="relative">
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(v => (
            <span key={v} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20" style={{ borderRadius: 2 }}>
              {v}
              <button type="button" onClick={() => remove(v)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search locations..."
          className="kbb-input w-full pr-8"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border shadow-lg max-h-52 overflow-y-auto" style={{ borderRadius: 2 }}>
          {filtered.map(loc => (
            <button
              key={loc.id}
              type="button"
              onMouseDown={() => select(loc.name)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              {loc.name}
            </button>
          ))}
        </div>
      )}

      {open && query && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border shadow-sm px-3 py-2 text-sm text-muted-foreground" style={{ borderRadius: 2 }}>
          No matching locations found.
        </div>
      )}
    </div>
  );
}