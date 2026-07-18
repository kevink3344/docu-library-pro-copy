import { useState, useEffect } from 'react';
import { db } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { Plus, Pencil, Trash2, Eye, EyeOff, GripVertical } from 'lucide-react';

const REQUIRED_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'document_id', label: 'Document ID' },
  { key: 'link_url', label: 'Link to Document' },
  { key: 'file', label: 'File Upload' },
  { key: 'tags', label: 'Tags' },
  { key: 'location', label: 'Location' },
  { key: 'department', label: 'Department' },
  { key: 'renew_date', label: 'Renew Date' },
];

const FIELD_TYPES = [
  { value: 'text-short', label: 'Short Text' },
  { value: 'text-paragraph', label: 'Paragraph' },
  { value: 'single-select', label: 'Single Select' },
  { value: 'multi-select', label: 'Multi-Select' },
];

export default function FieldManagement() {
  const { currentOrg } = useOrg();
  const [fieldConfig, setFieldConfig] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editField, setEditField] = useState(null);
  const [form, setForm] = useState({ name: '', input_type: 'text-short', options: [], status: 'active' });
  const [optionInput, setOptionInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState(null);

  const load = async () => {
    const [configs, fields] = await Promise.all([
      db.FieldConfig.filter({ org_id: currentOrg.id }),
      db.CustomField.filter({ org_id: currentOrg.id }, 'display_order'),
    ]);
    const cfg = configs[0] || { org_id: currentOrg.id, hidden_required_fields: [], add_screen_order: [], view_screen_order: [] };
    setFieldConfig(cfg);
    setConfigId(configs[0]?.id || null);
    setCustomFields(fields);
  };

  useEffect(() => { if (currentOrg) load(); }, [currentOrg]);

  const toggleHide = async (key) => {
    const hidden = fieldConfig.hidden_required_fields || [];
    const updated = hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key];
    const newConfig = { ...fieldConfig, hidden_required_fields: updated };
    setFieldConfig(newConfig);
    if (configId) {
      await db.FieldConfig.update(configId, { hidden_required_fields: updated });
    } else {
      const created = await db.FieldConfig.create({ org_id: currentOrg.id, hidden_required_fields: updated, add_screen_order: [], view_screen_order: [] });
      setConfigId(created.id);
    }
  };

  const openCreate = () => { setForm({ name: '', input_type: 'text-short', options: [], status: 'active' }); setEditField(null); setShowForm(true); };
  const openEdit = (f) => { setForm({ name: f.name, input_type: f.input_type, options: f.options || [], status: f.status }); setEditField(f); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editField) {
      await db.CustomField.update(editField.id, form);
    } else {
      await db.CustomField.create({ ...form, org_id: currentOrg.id, display_order: customFields.length });
    }
    await load();
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (f) => {
    if (!confirm(`Delete field "${f.name}"?`)) return;
    await db.CustomField.delete(f.id);
    await load();
  };

  const toggleStatus = async (f) => {
    const newStatus = f.status === 'active' ? 'inactive' : 'active';
    await db.CustomField.update(f.id, { status: newStatus });
    await load();
  };

  const addOption = () => {
    const v = optionInput.trim();
    if (v && !form.options.includes(v)) { setForm(p => ({ ...p, options: [...p.options, v] })); }
    setOptionInput('');
  };

  return (
    <div className="space-y-6">
      {/* Required fields */}
      <div>
        <h2 className="text-sm font-semibold mb-3">System Fields</h2>
        <p className="text-xs text-muted-foreground mb-3">Toggle visibility for your organization. Hidden fields will not appear on any form or view.</p>
        <div className="kbb-card overflow-hidden">
          {REQUIRED_FIELDS.map((field, idx) => {
            const isHidden = fieldConfig?.hidden_required_fields?.includes(field.key);
            return (
              <div key={field.key} className={`flex items-center justify-between px-4 py-3 ${idx !== 0 ? 'border-t border-border' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isHidden ? 'text-muted-foreground line-through' : 'font-medium'}`}>{field.label}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-secondary text-muted-foreground border border-border" style={{ borderRadius: 2 }}>SYSTEM</span>
                </div>
                <button onClick={() => toggleHide(field.key)} className={`p-1.5 transition-colors ${isHidden ? 'text-muted-foreground hover:text-foreground' : 'text-primary'}`} style={{ borderRadius: 2 }}>
                  {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom fields */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Custom Fields</h2>
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors" style={{ borderRadius: 2 }}>
            <Plus className="w-3.5 h-3.5" /> Add Field
          </button>
        </div>

        {showForm && (
          <div className="kbb-card p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3">{editField ? 'Edit Field' : 'New Custom Field'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="field-label block">Field Name</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="kbb-input w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="field-label block">Field Type</label>
                  <select value={form.input_type} onChange={e => setForm(p => ({ ...p, input_type: e.target.value }))} className="kbb-input w-full">
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {(form.input_type === 'single-select' || form.input_type === 'multi-select') && (
                <div className="space-y-1.5">
                  <label className="field-label block">Options</label>
                  <div className="flex gap-2">
                    <input value={optionInput} onChange={e => setOptionInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOption()} className="kbb-input flex-1" placeholder="Type option and press Enter" />
                    <button onClick={addOption} className="px-3 py-2 border border-border text-sm hover:bg-accent transition-colors" style={{ borderRadius: 2 }}>Add</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {form.options.map(o => (
                      <span key={o} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-secondary border border-border" style={{ borderRadius: 2 }}>
                        {o}
                        <button onClick={() => setForm(p => ({ ...p, options: p.options.filter(opt => opt !== o) }))} className="text-muted-foreground hover:text-destructive">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="field-label block">Status</label>
                <div className="flex gap-3">
                  {['active', 'inactive'].map(s => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value={s} checked={form.status === s} onChange={() => setForm(p => ({ ...p, status: s }))} className="accent-primary" />
                      <span className="text-sm capitalize">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={!form.name.trim() || saving} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors" style={{ borderRadius: 2 }}>
                  {saving ? 'Saving...' : 'Save Field'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border text-sm hover:bg-accent transition-colors" style={{ borderRadius: 2 }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {customFields.length === 0 ? (
          <div className="kbb-card p-8 text-center text-sm text-muted-foreground">No custom fields yet.</div>
        ) : (
          <div className="kbb-card overflow-hidden">
            {customFields.map((field, idx) => (
              <div key={field.id} className={`flex items-center gap-3 px-4 py-3 ${idx !== 0 ? 'border-t border-border' : ''} ${field.status === 'inactive' ? 'opacity-50' : ''}`}>
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{field.name}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-secondary text-muted-foreground border border-border font-mono-data" style={{ borderRadius: 2 }}>
                      {FIELD_TYPES.find(t => t.value === field.input_type)?.label}
                    </span>
                    {field.status === 'inactive' && (
                      <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground border border-border" style={{ borderRadius: 2 }}>INACTIVE</span>
                    )}
                  </div>
                  {field.options?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{field.options.join(', ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleStatus(field)} className="p-1.5 hover:bg-accent text-muted-foreground" style={{ borderRadius: 2 }} title={field.status === 'active' ? 'Deactivate' : 'Activate'}>
                    {field.status === 'active' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => openEdit(field)} className="p-1.5 hover:bg-accent text-muted-foreground" style={{ borderRadius: 2 }}><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(field)} className="p-1.5 hover:bg-destructive/10 text-destructive" style={{ borderRadius: 2 }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}