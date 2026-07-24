import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '@/lib/OrgContext';
import {
  getActiveMessages,
  createMessage,
  updateMessage,
  deleteMessage,
} from '@/api/system-messages';
import { RefreshCw, Plus, X, Check, AlertCircle } from 'lucide-react';

const PASTEL_COLORS = [
  '#FFD6D6', // Soft Pink
  '#FFE4C4', // Warm Peach
  '#FFFACD', // Pale Yellow
  '#D4EDDA', // Mint Green
  '#E8F4FD', // Baby Blue
  '#E6E6FA', // Lavender
  '#F5E6CC', // Warm Beige
  '#F0E6FF', // Soft Purple
];

const EMPTY_FORM = {
  title: '',
  text: '',
  pastel_color: '#E8F4FD',
  is_dismissable: true,
  is_active: true,
};

export default function SystemMessagesManagement() {
  const { currentOrg } = useOrg() || {};
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, org_id: null });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const orgId = currentOrg?.id;

  // Fetch all messages for this org
  const fetchMessages = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Use the public endpoint to get active messages.
      // For admin view we want all messages (including inactive).
      // We'll fetch via the public endpoint for now; the admin-only
      // full-list endpoint is not needed since admins can toggle is_active.
      const data = await getActiveMessages(orgId);
      setMessages(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Reset form for new message
  const handleAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, org_id: orgId });
    setShowForm(true);
    setError('');
  };

  // Populate form for editing
  const handleEdit = (msg) => {
    setEditingId(msg.id);
    setForm({
      title: msg.title || '',
      text: msg.text || '',
      pastel_color: msg.pastel_color || '#E8F4FD',
      is_dismissable: msg.is_dismissable === 1 || msg.is_dismissable === true,
      is_active: msg.is_active === 1 || msg.is_active === true,
      org_id: msg.org_id,
    });
    setShowForm(true);
    setError('');
  };

  // Cancel form
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError('');
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateMessage(editingId, {
          title: form.title.trim(),
          text: form.text,
          pastel_color: form.pastel_color,
          is_dismissable: form.is_dismissable,
          is_active: form.is_active,
        });
      } else {
        await createMessage({
          org_id: orgId,
          title: form.title.trim(),
          text: form.text,
          pastel_color: form.pastel_color,
          is_dismissable: form.is_dismissable,
        });
      }
      handleCancel();
      await fetchMessages();
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Delete (soft-delete)
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this system message? It will be hidden from all users.')) {
      return;
    }
    try {
      await deleteMessage(id);
      await fetchMessages();
    } catch (err) {
      setError(err?.message || 'Failed to delete');
    }
  };

  if (!currentOrg) {
    return <p className="text-sm text-muted-foreground">No organization selected.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          System Messages
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMessages}
            disabled={loading}
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            style={{ borderRadius: 2 }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Message
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive text-xs" style={{ borderRadius: 2 }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Form (Add/Edit) */}
      {showForm && (
        <div className="border border-border bg-muted/20 p-3 space-y-3" style={{ borderRadius: 2 }}>
          <p className="text-xs font-semibold text-foreground">
            {editingId ? 'Edit Message' : 'New Message'}
          </p>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="System maintenance notice"
              maxLength={200}
              className="w-full h-9 px-2.5 border border-border bg-background text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Text</label>
            <textarea
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              placeholder="The system will be down for maintenance from 8 PM to 10 PM."
              maxLength={2000}
              rows={2}
              className="w-full px-2.5 py-2 border border-border bg-background text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Background Color</label>
            <div className="flex gap-2 flex-wrap items-center">
              {PASTEL_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, pastel_color: color }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    form.pastel_color === color
                      ? 'border-primary scale-110'
                      : 'border-border hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <input
                type="color"
                value={form.pastel_color}
                onChange={e => setForm(f => ({ ...f, pastel_color: e.target.value }))}
                className="w-7 h-7 cursor-pointer border border-border rounded"
                title="Custom color"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_dismissable}
                onChange={e => setForm(f => ({ ...f, is_dismissable: e.target.checked }))}
                className="w-3.5 h-3.5 rounded-sm border-border"
              />
              <span className="text-xs text-muted-foreground">Dismissable (users can close)</span>
            </label>

            {editingId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded-sm border-border"
                />
                <span className="text-xs text-muted-foreground">Active</span>
              </label>
            )}
          </div>

          {form.pastel_color && (
            <div className="p-2 text-sm border border-border/50" style={{ backgroundColor: form.pastel_color, borderRadius: 2 }}>
              <span className="font-semibold">{form.title || 'Preview Title'}</span>
              <span className="ml-2 text-muted-foreground">{form.text || 'Preview text...'}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              style={{ borderRadius: 2 }}
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              style={{ borderRadius: 2 }}
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Message list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse" style={{ borderRadius: 2 }} />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No system messages yet. Click "Add Message" to create one.
        </p>
      ) : (
        <div className="space-y-1.5">
          {messages.map(msg => {
            const isActive = msg.is_active === 1 || msg.is_active === true;
            const isDismissable = msg.is_dismissable === 1 || msg.is_dismissable === true;
            return (
              <div
                key={msg.id}
                className="flex items-center gap-3 px-3 py-2 border border-border text-sm"
                style={{
                  backgroundColor: isActive ? msg.pastel_color : undefined,
                  opacity: isActive ? 1 : 0.5,
                  borderRadius: 2,
                }}
              >
                {/* Color swatch */}
                <div
                  className="w-4 h-4 rounded-full shrink-0 border border-border/30"
                  style={{ backgroundColor: msg.pastel_color }}
                />

                {/* Title + text */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-xs">{msg.title}</span>
                  {msg.text && (
                    <span className="text-xs text-muted-foreground ml-1 truncate">
                      — {msg.text.length > 60 ? msg.text.slice(0, 60) + '…' : msg.text}
                    </span>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isDismissable ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-background/60 border border-border/50" style={{ borderRadius: 2 }}>
                      Dismissable
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 bg-background/60 border border-border/50" style={{ borderRadius: 2 }}>
                      Sticky
                    </span>
                  )}
                  {!isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive border border-destructive/20" style={{ borderRadius: 2 }}>
                      Inactive
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(msg)}
                    className="p-1 hover:bg-background/60 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="p-1 hover:bg-background/60 rounded text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}