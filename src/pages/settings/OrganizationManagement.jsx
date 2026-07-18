import { useState, useEffect } from 'react';
import { db } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';

export default function OrganizationManagement() {
  const { orgs, refreshOrgs, user } = useOrg();
  const [allUsers, setAllUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', admin_user_ids: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    db.User.list().then(setAllUsers).catch(() => {});
  }, [user]);

  if (user?.role !== 'admin') {
    return <div className="p-4 text-center text-muted-foreground text-sm">Access restricted to Super Admins.</div>;
  }

  const openCreate = () => { setForm({ name: '', description: '', admin_user_ids: [] }); setEditOrg(null); setShowForm(true); };
  const openEdit = (org) => { setForm({ name: org.name, description: org.description || '', admin_user_ids: org.admin_user_ids || [] }); setEditOrg(org); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editOrg) {
      await db.Organization.update(editOrg.id, form);
    } else {
      await db.Organization.create({ ...form, is_active: true });
    }
    await refreshOrgs();
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (org) => {
    if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return;
    await db.Organization.delete(org.id);
    await refreshOrgs();
  };

  const toggleAdmin = (userId) => {
    const ids = form.admin_user_ids || [];
    setForm(prev => ({ ...prev, admin_user_ids: ids.includes(userId) ? ids.filter(i => i !== userId) : [...ids, userId] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors" style={{ borderRadius: 2 }}>
          <Plus className="w-4 h-4" /> New Organization
        </button>
      </div>

      {showForm && (
        <div className="kbb-card p-5">
          <h2 className="text-sm font-semibold mb-4">{editOrg ? 'Edit Organization' : 'Create New Organization'}</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="field-label block">Organization Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="kbb-input w-full" placeholder="e.g. Safety Department" />
            </div>
            <div className="space-y-1.5">
              <label className="field-label block">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="kbb-input w-full resize-none" rows={2} />
            </div>
            <div className="space-y-2">
              <label className="field-label block">Org Admins</label>
              <div className="border border-border max-h-48 overflow-y-auto" style={{ borderRadius: 2 }}>
                {allUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">No users found</p>
                ) : allUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-0">
                    <input type="checkbox" checked={form.admin_user_ids?.includes(u.id)} onChange={() => toggleAdmin(u.id)} className="accent-primary" />
                    <div>
                      <p className="text-sm">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono-data">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={!form.name.trim() || saving} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors" style={{ borderRadius: 2 }}>
                {saving ? 'Saving...' : editOrg ? 'Update' : 'Create'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border text-sm hover:bg-accent transition-colors" style={{ borderRadius: 2 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {orgs.length === 0 ? (
        <div className="kbb-card p-12 text-center">
          <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No organizations yet.</p>
        </div>
      ) : (
        <div className="kbb-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 field-label">Name</th>
                <th className="text-left px-4 py-2.5 field-label hidden sm:table-cell">Description</th>
                <th className="text-left px-4 py-2.5 field-label">Admins</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {orgs.map((org, idx) => (
                <tr key={org.id} className={`border-b border-border last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{org.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{org.description || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono-data text-sm">{org.admin_user_ids?.length || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(org)} className="p-1.5 hover:bg-accent rounded text-muted-foreground" style={{ borderRadius: 2 }}><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(org)} className="p-1.5 hover:bg-destructive/10 rounded text-destructive" style={{ borderRadius: 2 }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
