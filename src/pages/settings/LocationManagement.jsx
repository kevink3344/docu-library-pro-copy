import { useState, useEffect } from 'react';
import { db } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { Plus, Trash2, RefreshCw, MapPin, Pin, PinOff, Pencil, Check, X } from 'lucide-react';

export default function LocationManagement() {
  const { currentOrg } = useOrg();
  const [locations, setLocations] = useState([]);
  const [newName, setNewName] = useState('');
  const [jsonUrl, setJsonUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const load = async () => {
    if (!currentOrg) return;
    const locs = await db.Location.filter({ org_id: currentOrg.id });
    // Pinned first, then alphabetical
    locs.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.name.localeCompare(b.name);
    });
    setLocations(locs);
  };

  useEffect(() => { if (currentOrg) load(); }, [currentOrg]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !currentOrg) return;
    setAdding(true);
    await db.Location.create({ org_id: currentOrg.id, name, is_active: true });
    setNewName('');
    await load();
    setAdding(false);
  };

  const handleTogglePin = async (loc) => {
    await db.Location.update(loc.id, { pinned: !loc.pinned });
    await load();
  };

  const handleDelete = async (loc) => {
    if (!confirm(`Delete location "${loc.name}"?`)) return;
    await db.Location.delete(loc.id);
    await load();
  };

  const handleEdit = (loc) => { setEditingId(loc.id); setEditingName(loc.name); };
  const handleEditSave = async (loc) => {
    const name = editingName.trim();
    if (!name) return;
    await db.Location.update(loc.id, { name });
    setEditingId(null);
    await load();
  };
  const handleEditCancel = () => setEditingId(null);

  const handleSync = async () => {
    if (!jsonUrl.trim()) return;
    setSyncing(true);
    setSyncError('');
    try {
      const res = await fetch(jsonUrl.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (res.data?.error) throw new Error(res.data.error);

      // Support plain array, GeoJSON FeatureCollection, or object with a data array
      const items = Array.isArray(raw) ? raw : Array.isArray(raw?.features) ? raw.features : [];
      const names = items
        .map(item => typeof item === 'string' ? item : (item?.properties?.NAME ?? item?.NAME))
        .filter(Boolean);

      if (names.length === 0) throw new Error('No location names found in JSON.');

      // Delete all existing, then bulk create
      await Promise.all(locations.map(l => db.Location.delete(l.id)));
      await Promise.all(names.map(name => db.Location.create({ org_id: currentOrg.id, name, is_active: true })));
      await load();
    } catch (e) {
      setSyncError(e.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* JSON Sync */}
      <div className="kbb-card p-4">
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Sync from JSON URL</h2>
        <p className="text-xs text-muted-foreground mb-3">Paste a URL that returns a JSON array of site names (or objects with a <span className="font-mono-data">name</span> field). This will replace all current sites.</p>
        <div className="flex gap-2">
          <input
            value={jsonUrl}
            onChange={e => setJsonUrl(e.target.value)}
            placeholder="https://example.com/locations.json"
            className="kbb-input flex-1"
          />
          <button
            onClick={handleSync}
            disabled={!jsonUrl.trim() || syncing}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            style={{ borderRadius: 2 }}
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
        {syncError && <p className="text-xs text-destructive mt-2">{syncError}</p>}
      </div>

      {/* Manual add */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Sites ({locations.length})</h2>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add site name..."
            className="kbb-input flex-1"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || adding}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            style={{ borderRadius: 2 }}
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {locations.length === 0 ? (
          <div className="kbb-card p-8 text-center text-sm text-muted-foreground">No sites yet. Add one manually or sync from a JSON URL.</div>
        ) : (
          <div className="kbb-card overflow-hidden">
            {locations.map((loc, idx) => (
              <div key={loc.id} className={`flex items-center justify-between px-4 py-3 ${idx !== 0 ? 'border-t border-border' : ''} ${loc.pinned ? 'bg-primary/5' : ''}`}>
                {editingId === loc.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSave(loc); if (e.key === 'Escape') handleEditCancel(); }}
                      className="kbb-input flex-1 text-sm"
                      autoFocus
                    />
                    <button onClick={() => handleEditSave(loc)} className="p-1.5 text-primary hover:bg-primary/10 transition-colors" style={{ borderRadius: 2 }}><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={handleEditCancel} className="p-1.5 text-muted-foreground hover:bg-accent transition-colors" style={{ borderRadius: 2 }}><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {loc.pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                      <span className="text-sm">{loc.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(loc)} className="p-1.5 text-muted-foreground hover:bg-accent transition-colors" style={{ borderRadius: 2 }} title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleTogglePin(loc)} className={`p-1.5 transition-colors ${loc.pinned ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-accent'}`} style={{ borderRadius: 2 }} title={loc.pinned ? 'Unpin' : 'Pin to top'}>
                        {loc.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handleDelete(loc)} className="p-1.5 hover:bg-destructive/10 text-destructive transition-colors" style={{ borderRadius: 2 }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}