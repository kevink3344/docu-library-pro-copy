import { useState, useEffect } from 'react';
import { db } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { Plus, Trash2, Building2, Pin, PinOff, Pencil, Check, X } from 'lucide-react';

export default function DepartmentManagement() {
  const { currentOrg } = useOrg();
  const [departments, setDepartments] = useState([]);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const load = async () => {
    if (!currentOrg) return;
    const depts = await db.Department.filter({ org_id: currentOrg.id });
    depts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.name.localeCompare(b.name);
    });
    setDepartments(depts);
  };

  useEffect(() => { if (currentOrg) load(); }, [currentOrg]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !currentOrg) return;
    setAdding(true);
    await db.Department.create({ org_id: currentOrg.id, name, is_active: true });
    setNewName('');
    await load();
    setAdding(false);
  };

  const handleTogglePin = async (dept) => {
    await db.Department.update(dept.id, { pinned: !dept.pinned });
    await load();
  };

  const handleDelete = async (dept) => {
    if (!confirm(`Delete department "${dept.name}"?`)) return;
    await db.Department.delete(dept.id);
    await load();
  };

  const handleEdit = (dept) => { setEditingId(dept.id); setEditingName(dept.name); };
  const handleEditSave = async (dept) => {
    const name = editingName.trim();
    if (!name) return;
    await db.Department.update(dept.id, { name });
    setEditingId(null);
    await load();
  };
  const handleEditCancel = () => setEditingId(null);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> Departments ({departments.length})</h2>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add department name..."
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

        {departments.length === 0 ? (
          <div className="kbb-card p-8 text-center text-sm text-muted-foreground">No departments yet. Add one above.</div>
        ) : (
          <div className="kbb-card overflow-hidden">
            {departments.map((dept, idx) => (
              <div key={dept.id} className={`flex items-center justify-between px-4 py-3 ${idx !== 0 ? 'border-t border-border' : ''} ${dept.pinned ? 'bg-primary/5' : ''}`}>
                {editingId === dept.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSave(dept); if (e.key === 'Escape') handleEditCancel(); }}
                      className="kbb-input flex-1 text-sm"
                      autoFocus
                    />
                    <button onClick={() => handleEditSave(dept)} className="p-1.5 text-primary hover:bg-primary/10 transition-colors" style={{ borderRadius: 2 }}><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={handleEditCancel} className="p-1.5 text-muted-foreground hover:bg-accent transition-colors" style={{ borderRadius: 2 }}><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {dept.pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                      <span className="text-sm">{dept.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(dept)} className="p-1.5 text-muted-foreground hover:bg-accent transition-colors" style={{ borderRadius: 2 }} title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleTogglePin(dept)} className={`p-1.5 transition-colors ${dept.pinned ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-accent'}`} style={{ borderRadius: 2 }} title={dept.pinned ? 'Unpin' : 'Pin to top'}>
                        {dept.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handleDelete(dept)} className="p-1.5 hover:bg-destructive/10 text-destructive transition-colors" style={{ borderRadius: 2 }}><Trash2 className="w-3.5 h-3.5" /></button>
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