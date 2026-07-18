import { useState, useEffect, useRef } from 'react';
import { db } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { X, ChevronDown } from 'lucide-react';

export default function DepartmentSelectInput({ value = [], onChange }) {
  const { currentOrg } = useOrg();
  const [departments, setDepartments] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!currentOrg) return;
    db.Department.filter({ org_id: currentOrg.id }).then(depts => {
      depts.sort((a, b) => a.name.localeCompare(b.name));
      setDepartments(depts);
    });
  }, [currentOrg]);

  useEffect(() => {
    const handleClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = departments.filter(d =>
    !value.includes(d.name) &&
    d.name.toLowerCase().includes(query.toLowerCase())
  );

  const select = (name) => {
    onChange([...value, name]);
    setQuery('');
    setOpen(false);
  };

  const remove = (name) => onChange(value.filter(v => v !== name));

  return (
    <div ref={ref} className="relative">
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
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search departments..."
          className="kbb-input w-full pr-8"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border shadow-lg max-h-52 overflow-y-auto" style={{ borderRadius: 2 }}>
          {filtered.map(d => (
            <button
              key={d.id}
              type="button"
              onMouseDown={() => select(d.name)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border shadow-sm px-3 py-2 text-sm text-muted-foreground" style={{ borderRadius: 2 }}>
          No matching departments found.
        </div>
      )}
    </div>
  );
}