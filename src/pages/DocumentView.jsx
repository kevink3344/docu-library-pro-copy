import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db, downloadKBBDocumentFile } from '@/api/db';
import { API_URL } from '@/api/apiClient';
import { useOrg } from '@/lib/OrgContext';
import { ArrowLeft, Pencil, Trash2, ExternalLink, FileText, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import RenewBadge from '@/components/documents/RenewBadge';
import DocumentPreview from '@/components/documents/DocumentPreview';

const REQUIRED_FIELD_MAP = {
  title: 'Product Name', description: 'Description', document_id: 'Document ID',
  link_url: 'Link', file: 'File', tags: 'Tags', location: 'Site',
  department: 'Department',
};

export default function DocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrg, user, isOrgAdmin } = useOrg();
  const [doc, setDoc] = useState(null);
  const [fieldConfig, setFieldConfig] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [orderedFields, setOrderedFields] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const load = async () => {
      const [docs, configs, cFields] = await Promise.all([
        db.KBBDocument.filter({ id }),
        currentOrg ? db.FieldConfig.filter({ org_id: currentOrg?.id }) : Promise.resolve([]),
        currentOrg ? db.CustomField.filter({ org_id: currentOrg?.id }) : Promise.resolve([]),
      ]);
      const document = docs[0];
      if (!document) { navigate('/'); return; }

      // Guests may only view non-archived, everyone-visible docs in the public org
      if (!user) {
        const wrongOrg = currentOrg && document.org_id && document.org_id !== currentOrg.id;
        if (document.is_archived || document.visibility !== 'everyone' || wrongOrg) {
          navigate('/');
          return;
        }
      }

      setDoc(document);

      const cfg = configs[0] || {};
      setFieldConfig(cfg);
      const active = cFields.filter(f => f.status === 'active');
      setCustomFields(active);

      const hidden = cfg.hidden_required_fields || [];
      const allFields = [
        ...Object.keys(REQUIRED_FIELD_MAP).filter(k => !hidden.includes(k)).map(k => ({ key: k, label: REQUIRED_FIELD_MAP[k], type: 'required' })),
        ...active.map(f => ({ key: `custom_${f.id}`, label: f.name, type: 'custom', customId: f.id }))
      ];

      if (cfg.view_screen_order?.length) {
        const ordered = [];
        cfg.view_screen_order.forEach(fk => {
          const found = allFields.find(f => f.key === fk);
          if (found) ordered.push(found);
        });
        allFields.forEach(f => { if (!ordered.find(o => o.key === f.key)) ordered.push(f); });
        setOrderedFields(ordered);
      } else {
        setOrderedFields(allFields);
      }
      setLoading(false);
    };
    load();
  }, [id, currentOrg, user, navigate]);

  const handleDelete = async () => {
    if (!confirm('Delete this document?')) return;
    await db.KBBDocument.delete(id);
    navigate('/');
  };

  const openPreview = async () => {
    if (!id) return;
    setShowPreview(true);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const blob = await downloadKBBDocumentFile(id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setPreviewError(err.message || 'Failed to load file');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewError(null);
    setShowPreview(false);
  };

  const canEdit = user?.role === 'admin' || currentOrg?.admin_user_ids?.includes(user?.id) || doc?.creator_user_id === user?.id;

  const renderFieldValue = (field) => {
    if (field.type === 'custom') {
      const val = doc?.custom_field_values?.[field.customId];
      if (Array.isArray(val)) {
        return val.length ? (
          <div className="flex flex-wrap gap-1">
            {val.map(v => <span key={v} className="text-xs px-1.5 py-0.5 bg-secondary border border-border" style={{ borderRadius: 2 }}>{v}</span>)}
          </div>
        ) : <span className="text-muted-foreground">—</span>;
      }
      return <span className="text-sm">{val || <span className="text-muted-foreground">—</span>}</span>;
    }

    switch (field.key) {
      case 'title': return <span className="text-base font-semibold">{doc?.title}</span>;
      case 'description': return <p className="text-sm leading-relaxed whitespace-pre-wrap">{doc?.description || <span className="text-muted-foreground">—</span>}</p>;
      case 'document_id': return <span className="font-mono-data">{doc?.document_id || <span className="text-muted-foreground">—</span>}</span>;
      case 'renew_date': return doc?.renew_date ? (
        <div className="flex items-center gap-2">
          <span className="font-mono-data text-sm">{format(parseISO(doc.renew_date), 'MMMM d, yyyy')}</span>
          {!fieldConfig?.hidden_required_fields?.includes('renew_date') && <RenewBadge renewDate={doc.renew_date} />}
        </div>
      ) : <span className="text-muted-foreground text-sm">No renewal required</span>;
      case 'tags': return doc?.tags?.length ? (
        <div className="flex flex-wrap gap-1">
          {doc.tags.map(t => <span key={t} className="text-xs px-1.5 py-0.5 bg-primary/8 text-primary border border-primary/20" style={{ borderRadius: 2 }}>{t}</span>)}
        </div>
      ) : <span className="text-muted-foreground text-sm">—</span>;
      case 'location': case 'department': return doc?.[field.key]?.length ? (
        <div className="flex flex-wrap gap-1">
          {doc[field.key].map(v => <span key={v} className="text-xs px-1.5 py-0.5 bg-secondary border border-border" style={{ borderRadius: 2 }}>{v}</span>)}
        </div>
      ) : <span className="text-muted-foreground text-sm">—</span>;
      case 'link_url': return doc?.link_url ? (
        <a href={doc.link_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline flex items-center gap-1.5 truncate max-w-xs">
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />{doc.link_url}
        </a>
      ) : <span className="text-muted-foreground text-sm">—</span>;
      case 'file': return doc?.file_url ? (
        <button onClick={openPreview} className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline">
          <Eye className="w-3.5 h-3.5" /> Preview File
        </button>
      ) : <span className="text-muted-foreground text-sm">—</span>;
      default: return <span className="text-muted-foreground text-sm">—</span>;
    }
  };

  if (loading) return (
    <div className="p-6 max-w-3xl mx-auto space-y-3">
      {[...Array(6)].map((_, i) => <div key={i} className="kbb-card p-4 animate-pulse"><div className="h-3 bg-muted rounded w-1/4 mb-2" /><div className="h-4 bg-muted rounded w-1/2" /></div>)}
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-accent rounded text-muted-foreground" style={{ borderRadius: 2 }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold truncate">{doc?.title}</h1>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`/documents/${id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm hover:bg-accent transition-colors" style={{ borderRadius: 2 }}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Link>
            <button onClick={handleDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-destructive/30 text-destructive text-sm hover:bg-destructive/5 transition-colors" style={{ borderRadius: 2 }}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="kbb-card overflow-hidden">
        {orderedFields.filter(f => f.key !== 'file').map((field, idx) => (
          <div key={field.key} className={`flex gap-4 px-4 py-3.5 ${idx !== 0 ? 'border-t border-border' : ''}`}>
            <div className="w-32 shrink-0">
              <span className="field-label">{field.label}</span>
            </div>
            <div className="flex-1 min-w-0">{renderFieldValue(field)}</div>
          </div>
        ))}

        {/* File row */}
        {!fieldConfig?.hidden_required_fields?.includes('file') && (
          <div className="flex gap-4 px-4 py-3.5 border-t border-border">
            <div className="w-32 shrink-0"><span className="field-label">File</span></div>
            <div className="flex-1">{renderFieldValue({ key: 'file', type: 'required' })}</div>
          </div>
        )}

        {/* Permissions row */}
        <div className="flex gap-4 px-4 py-3.5 border-t border-border">
          <div className="w-32 shrink-0"><span className="field-label">Visibility</span></div>
          <div className="flex-1">
            <span className={`text-xs px-2 py-0.5 font-medium border ${doc?.visibility === 'everyone' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`} style={{ borderRadius: 2 }}>
              {doc?.visibility === 'everyone' ? 'Everyone' : 'Restricted to Teams'}
            </span>
          </div>
        </div>

        <div className="flex gap-4 px-4 py-3.5 border-t border-border bg-muted/20">
          <div className="w-32 shrink-0"><span className="field-label">Created</span></div>
          <div className="flex-1"><span className="font-mono-data text-sm text-muted-foreground">{doc?.created_date ? format(new Date(doc.created_date), 'MMM d, yyyy') : '—'}</span></div>
        </div>
      </div>

      {showPreview && doc?.file_url && (
        <DocumentPreview
          url={previewUrl}
          downloadUrl={`${API_URL}/api/kbb_documents/${id}/file`}
          fileName={doc.file_url}
          fileType={doc.file_type}
          loading={previewLoading}
          error={previewError}
          onClose={closePreview}
        />
      )}
    </div>
  );
}