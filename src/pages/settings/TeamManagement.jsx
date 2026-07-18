import { useState, useEffect } from 'react';
import { db } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { Plus, Users, Pencil, Trash2, UserPlus } from 'lucide-react';

export default function TeamManagement() {
  const { currentOrg } = useOrg();
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', member_user_ids: [] });
  const [saving, setSaving] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState(null);

  const load = async () => {
    const [ts, us] = await Promise.all([
      db.Team.filter({ org_id: currentOrg.id }),
      db.User.list(),
    ]);
    setTeams(ts);
    setAllUsers(us);
  };

  useEffect(() => { if (currentOrg) load(); }, [currentOrg]);

  const openCreate = () => { setForm({ name: '', description: '', member_user_ids: [] }); setEditTeam(null); setShowForm(true); };
  const openEdit = (t) => { setForm({ name: t.name, description: t.description || '', member_user_ids: t.member_user_ids || [] }); setEditTeam(t); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editTeam) {
      await db.Team.update(editTeam.id, form);
    } else {
      await db.Team.create({ ...form, org_id: currentOrg.id });
    }
    await load();
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (t) => {
    if (!confirm(`Delete team "${t.name}"?`)) return;
    await db.Team.delete(t.id);
    await load();
  };

  const toggleMember = (userId) => {
    const ids = form.member_user_ids || [];
    setForm(prev => ({ ...prev, member_user_ids: ids.includes(userId) ? ids.filter(i => i !== userId) : [...ids, userId] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Create teams and assign members. Teams can be used to restrict document visibility.</p>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors" style={{ borderRadius: 2 }}>
          <Plus className="w-3.5 h-3.5" /> New Team
        </button>
      </div>

      {showForm && (
        <div className="kbb-card p-4">
          <h3 className="text-sm font-semibold mb-3">{editTeam ? 'Edit Team' : 'New Team'}</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="field-label block">Team Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="kbb-input w-full" />
              </div>
              <div className="space-y-1.5">
                <label className="field-label block">Description</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="kbb-input w-full" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="field-label block">Members</label>
              <div className="border border-border max-h-48 overflow-y-auto" style={{ borderRadius: 2 }}>
                {allUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-0">
                    <input type="checkbox" checked={form.member_user_ids?.includes(u.id)} onChange={() => toggleMember(u.id)} className="accent-primary" />
                    <div>
                      <p className="text-sm">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono-data">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!form.name.trim() || saving} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors" style={{ borderRadius: 2 }}>
                {saving ? 'Saving...' : 'Save Team'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border text-sm hover:bg-accent transition-colors" style={{ borderRadius: 2 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="kbb-card p-8 text-center">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        </div>
      ) : (
        <div className="kbb-card overflow-hidden">
          {teams.map((team, idx) => {
            const members = allUsers.filter(u => team.member_user_ids?.includes(u.id));
            return (
              <div key={team.id} className={`${idx !== 0 ? 'border-t border-border' : ''}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{team.name}</span>
                      <span className="font-mono-data text-xs text-muted-foreground">{members.length} members</span>
                    </div>
                    {team.description && <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)} className="p-1.5 hover:bg-accent text-muted-foreground" style={{ borderRadius: 2 }}>
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(team)} className="p-1.5 hover:bg-accent text-muted-foreground" style={{ borderRadius: 2 }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(team)} className="p-1.5 hover:bg-destructive/10 text-destructive" style={{ borderRadius: 2 }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {expandedTeam === team.id && (
                  <div className="px-4 pb-3 border-t border-border bg-muted/20">
                    {members.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No members</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {members.map(m => (
                          <span key={m.id} className="text-xs px-2 py-1 bg-card border border-border" style={{ borderRadius: 2 }}>{m.full_name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}