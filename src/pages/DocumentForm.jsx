import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, uploadKBBDocumentFile } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { ArrowLeft, Upload, Link as LinkIcon, X, Archive } from 'lucide-react';
import CustomFieldInput from '@/components/documents/CustomFieldInput';
import TagInput from '@/components/documents/TagInput';
import MultiSelectInput from '@/components/documents/MultiSelectInput';
import LocationSelectInput from '@/components/documents/LocationSelectInput';
import DepartmentSelectInput from '@/components/documents/DepartmentSelectInput';

const REQUIRED_FIELDS = [
  { key: 'title', label: 'Product Name', type: 'text-short' },
  { key: 'description', label: 'Description', type: 'text-paragraph' },
  { key: 'document_id', label: 'Document ID', type: 'text-short', mono: true },
  { key: 'link_url', label: 'Link to Document', type: 'url' },
  { key: 'file', label: 'File Upload', type: 'file' },
  { key: 'tags', label: 'Tags', type: 'tags' },
  { key: 'location', label: 'Site', type: 'multi-text' },
  { key: 'department', label: 'Department', type: 'multi-text' },
];

export default function DocumentForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { currentOrg, user } = useOrg();

  const [form, setForm] = useState({ tags: [], location: [], department: [], custom_field_values: {}, visibility: 'everyone', allowed_team_ids: [], file_url: '', file_type: '' });
  const [fieldConfig, setFieldConfig] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [teams, setTeams] = useState([]);
  const [orderedFields, setOrderedFields] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [fileObj, setFileObj] = useState(null);

  useEffect(() => {
    if (!currentOrg) return;
    const load = async () => {
      const [configs, cFields, orgTeams] = await Promise.all([
        db.FieldConfig.filter({ org_id: currentOrg.id }),
        db.CustomField.filter({ org_id: currentOrg.id }),
        db.Team.filter({ org_id: currentOrg.id }),
      ]);
      const cfg = configs[0] || {};
      setFieldConfig(cfg);
      const activeCustom = cFields.filter(f => f.status === 'active').sort((a, b) => a.display_order - b.display_order);
      setCustomFields(activeCustom);
      setTeams(orgTeams);

      const hidden = cfg.hidden_required_fields || [];
      const allFields = [
        ...REQUIRED_FIELDS.filter(f => !hidden.includes(f.key)),
        ...activeCustom.map(f => ({ key: `custom_${f.id}`, label: f.name, type: f.input_type, options: f.options, customId: f.id }))
      ];

      if (cfg.add_screen_order?.length) {
        const ordered = [];
        cfg.add_screen_order.forEach(fk => {
          const found = allFields.find(f => f.key === fk);
          if (found) ordered.push(found);
        });
        allFields.forEach(f => { if (!ordered.find(o => o.key === f.key)) ordered.push(f); });
        setOrderedFields(ordered);
      } else {
        setOrderedFields(allFields);
      }

      if (isEdit) {
        const doc = await db.KBBDocument.filter({ id });
        if (doc[0]) setForm({ ...doc[0], custom_field_values: doc[0].custom_field_values || {} });
      }
    };
    load();
  }, [currentOrg, id]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleFileUpload = async (file) => {
    setUploading(true);
    const ext = file.name.split('.').pop().toLowerCase();
    const fileType = ext === 'pdf' ? 'pdf' : ['doc', 'docx'].includes(ext) ? 'word' : ['xls', 'xlsx'].includes(ext) ? 'excel' : 'file';
    set('file_url', file.name);
    set('file_type', fileType);
    setFileObj(file);
    setUploading(false);
  };

  const handleArchive = async () => {
    if (!confirm(`${form.is_archived ? 'Unarchive' : 'Archive'} this item?`)) return;
    setArchiving(true);
    await db.KBBDocument.update(id, { is_archived: !form.is_archived });
    setArchiving(false);
    navigate('/');
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const payload = {
      ...form,
      org_id: currentOrg.id,
      creator_user_id: user?.id,
      ...(form.file_url ? {} : { file_blob: null }),
    };

    let docId = id;
    if (isEdit) {
      await db.KBBDocument.update(id, payload);
    } else {
      const doc = await db.KBBDocument.create(payload);
      docId = doc.id;
    }

    if (fileObj) {
      await uploadKBBDocumentFile(docId, fileObj);
    }

    setSaving(false);
    navigate('/');
  };

  const renderField = (field) => {
    const isCustom = field.key.startsWith('custom_');
    const val = isCustom ? (form.custom_field_values?.[field.customId] || '') : form[field.key];
    const setVal = (v) => {
      if (isCustom) {
        set('custom_field_values', { ...form.custom_field_values, [field.customId]: v });
      } else {
        set(field.key, v);
      }
    };

    if (field.type === 'file') {
      return (
        <div key={field.key} className="space-y-1.5">
          <label className="field-label block">{field.label}</label>
          <div className="border border-dashed border-border p-4 text-center hover:bg-accent/40 transition-colors cursor-pointer" style={{ borderRadius: 2 }}>
            <input type="file" className="hidden" id="file-upload" accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
            <label htmlFor="file-upload" className="cursor-pointer">
              {uploading ? (
                <p className="text-sm text-muted-foreground">Uploading...</p>
              ) : form.file_url ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-primary truncate max-w-[200px]">{fileObj?.name || 'File uploaded'}</span>
                  <button type="button" onClick={(e) => { e.preventDefault(); set('file_url', ''); set('file_type', ''); setFileObj(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload PDF, Word, or Excel</span>
                </div>
              )}
            </label>
          </div>
        </div>
      );
    }

    if (field.type === 'url') return (
      <div key={field.key} className="space-y-1.5">
        <label className="field-label block">{field.label}</label>
        <div className="relative">
          <input value={val || ''} onChange={e => setVal(e.target.value)} placeholder="https://" className="kbb-input w-full pr-8" />
          <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
    );

    if (field.type === 'tags') return (
      <div key={field.key} className="space-y-1.5">
        <label className="field-label block">{field.label}</label>
        <TagInput value={form.tags || []} onChange={v => set('tags', v)} />
      </div>
    );

    if (field.type === 'multi-text') {
      if (field.key === 'location') return (
        <div key={field.key} className="space-y-1.5">
          <label className="field-label block">{field.label}</label>
          <LocationSelectInput value={form.location || []} onChange={v => set('location', v)} />
        </div>
      );
      if (field.key === 'department') return (
        <div key={field.key} className="space-y-1.5">
          <label className="field-label block">{field.label}</label>
          <DepartmentSelectInput value={form.department || []} onChange={v => set('department', v)} />
        </div>
      );
      return (
        <div key={field.key} className="space-y-1.5">
          <label className="field-label block">{field.label}</label>
          <TagInput value={form[field.key] || []} onChange={v => set(field.key, v)} placeholder={`Add ${field.label}...`} />
        </div>
      );
    }

    if (field.type === 'date') return (
      <div key={field.key} className="space-y-1.5">
        <label className="field-label block">{field.label} <span className="normal-case font-normal">(optional — leave blank if no renewal needed)</span></label>
        <input type="date" value={val || ''} onChange={e => setVal(e.target.value)} className="kbb-input w-full sm:w-48 font-mono-data" />
      </div>
    );

    if (field.type === 'text-paragraph') return (
      <div key={field.key} className="space-y-1.5">
        <label className="field-label block">{field.label}</label>
        <textarea value={val || ''} onChange={e => setVal(e.target.value)} rows={4} className="kbb-input w-full resize-none" />
      </div>
    );

    if (field.type === 'single-select') return (
      <div key={field.key} className="space-y-1.5">
        <label className="field-label block">{field.label}</label>
        <select value={val || ''} onChange={e => setVal(e.target.value)} className="kbb-input w-full">
          <option value="">— Select —</option>
          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );

    if (field.type === 'multi-select') return (
      <div key={field.key} className="space-y-1.5">
        <label className="field-label block">{field.label}</label>
        <MultiSelectInput options={field.options || []} value={Array.isArray(val) ? val : []} onChange={setVal} />
      </div>
    );

    return (
      <div key={field.key} className="space-y-1.5">
        <label className="field-label block">{field.label}</label>
        <input
          value={val || ''}
          onChange={e => setVal(e.target.value)}
          className={`kbb-input w-full ${field.mono ? 'font-mono-data' : ''}`}
        />
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-accent rounded text-muted-foreground" style={{ borderRadius: 2 }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold">{isEdit ? 'Edit SDS Item' : 'Add New SDS Item'}</h1>
      </div>

      <div className="space-y-5">
        {orderedFields.map(renderField)}

        {/* Permissions */}
        <div className="space-y-3 pt-4 border-t border-border">
          <label className="field-label block">Visibility & Permissions</label>
          <div className="flex gap-3">
            {['everyone', 'teams'].map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="visibility" value={opt} checked={form.visibility === opt} onChange={() => set('visibility', opt)} className="accent-primary" />
                <span className="text-sm capitalize">{opt === 'everyone' ? 'Everyone (Default)' : 'Specific Teams'}</span>
              </label>
            ))}
          </div>
          {form.visibility === 'teams' && teams.length > 0 && (
            <div className="space-y-2">
              {teams.map(team => (
                <label key={team.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowed_team_ids?.includes(team.id)}
                    onChange={e => {
                      const ids = form.allowed_team_ids || [];
                      set('allowed_team_ids', e.target.checked ? [...ids, team.id] : ids.filter(i => i !== team.id));
                    }}
                    className="accent-primary"
                  />
                  <span className="text-sm">{team.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={!form.title || saving}
            className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            style={{ borderRadius: 2 }}
          >
            {saving ? 'Saving...' : 'Save Item'}
          </button>
          {isEdit && user?.role === 'admin' && (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="inline-flex items-center gap-1.5 px-5 py-2 border border-border text-sm hover:bg-accent disabled:opacity-50 transition-colors"
              style={{ borderRadius: 2 }}
            >
              <Archive className="w-4 h-4" />
              {archiving ? '...' : form.is_archived ? 'Unarchive' : 'Archive'}
            </button>
          )}
          <button onClick={() => navigate(-1)} className="px-5 py-2 border border-border text-sm hover:bg-accent transition-colors" style={{ borderRadius: 2 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}