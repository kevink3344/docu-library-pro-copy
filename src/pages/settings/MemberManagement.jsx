import { useState, useEffect } from 'react';
import { useOrg } from '@/lib/OrgContext';
import {
  getOrgMembersWithUsers,
  addOrgMember,
  addExistingUserToOrg,
  updateOrgMemberRole,
  removeOrgMember,
} from '@/api/db';
import { Plus, Trash2, Pencil, Check, X, UserPlus, UserCheck } from 'lucide-react';

const ROLES = [
  { value: 'org_admin', label: 'Org Admin' },
  { value: 'team_member', label: 'Team Member' },
  { value: 'standard_user', label: 'Standard User' },
];

export default function MemberManagement() {
  const { currentOrg } = useOrg();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', role: 'standard_user' });
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState('');

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const data = await getOrgMembersWithUsers(currentOrg.id);
      setMembers(data);
    } catch (e) {
      console.error('Failed to load members', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentOrg]);

  const openCreate = () => {
    setForm({ full_name: '', email: '', role: 'standard_user' });
    setError('');
    setShowForm(true);
  };

  const handleAdd = async () => {
    if (!form.full_name.trim() || !form.email.trim()) return;
    setSaving(true);
    setError('');
    try {
      await addOrgMember(currentOrg.id, form);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  const handleAddExisting = async (user) => {
    try {
      await addExistingUserToOrg(currentOrg.id, user.id, 'standard_user');
      await load();
    } catch (e) {
      setError(e.message || 'Failed to add user to organization');
    }
  };

  const handleRemove = async (member) => {
    if (!confirm(`Remove "${member.full_name}" from this organization?`)) return;
    await removeOrgMember(member.member_id);
    await load();
  };

  const startEdit = (member) => {
    setEditingId(member.member_id);
    setEditRole(member.org_role);
  };

  const handleEditSave = async (member) => {
    if (!editRole) return;
    await updateOrgMemberRole(member.member_id, editRole);
    setEditingId(null);
    await load();
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditRole('');
  };

  const isMember = (user) => !!user.member_id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Manage users and their roles in this organization.</p>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          style={{ borderRadius: 2 }}
        >
          <Plus className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      {showForm && (
        <div className="kbb-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Add User</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div className="space-y-1.5">
              <label className="field-label block">Full Name</label>
              <input
                value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                className="kbb-input w-full"
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <label className="field-label block">Email</label>
              <input
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="kbb-input w-full"
                placeholder="jane@example.com"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <label className="field-label block">Org Role</label>
              <select
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="kbb-input w-full"
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-destructive mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!form.full_name.trim() || !form.email.trim() || saving}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              style={{ borderRadius: 2 }}
            >
              {saving ? 'Saving...' : 'Save User'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border text-sm hover:bg-accent transition-colors"
              style={{ borderRadius: 2 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : members.length === 0 ? (
        <div className="kbb-card p-8 text-center text-sm text-muted-foreground">No users found.</div>
      ) : (
        <div className="kbb-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 field-label">Name</th>
                <th className="text-left px-4 py-2.5 field-label">Email</th>
                <th className="text-left px-4 py-2.5 field-label">Status / Role</th>
                <th className="text-left px-4 py-2.5 field-label w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(user => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.full_name || 'Unnamed'}</span>
                      {user.role === 'admin' && (
                        <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/30" style={{ borderRadius: 2 }}>Super Admin</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email || '-'}</td>
                  <td className="px-4 py-3">
                    {isMember(user) ? (
                      editingId === user.member_id ? (
                        <select
                          value={editRole}
                          onChange={e => setEditRole(e.target.value)}
                          className="kbb-input w-full text-sm py-1"
                        >
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      ) : (
                        <span>{ROLES.find(r => r.value === user.org_role)?.label || user.org_role}</span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">Not a member of this org</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {isMember(user) ? (
                        editingId === user.member_id ? (
                          <>
                            <button onClick={() => handleEditSave(user)} className="p-1.5 text-primary hover:bg-primary/10 transition-colors" style={{ borderRadius: 2 }}><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={handleEditCancel} className="p-1.5 text-muted-foreground hover:bg-accent transition-colors" style={{ borderRadius: 2 }}><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(user)} className="p-1.5 text-muted-foreground hover:bg-accent transition-colors" style={{ borderRadius: 2 }}><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleRemove(user)} className="p-1.5 hover:bg-destructive/10 text-destructive transition-colors" style={{ borderRadius: 2 }}><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )
                      ) : (
                        <button
                          onClick={() => handleAddExisting(user)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                          style={{ borderRadius: 2 }}
                        >
                          <UserCheck className="w-3 h-3" /> Add to org
                        </button>
                      )}
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
