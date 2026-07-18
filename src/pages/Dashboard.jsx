import { useState, useEffect, useCallback } from 'react';
import { db } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, LayoutGrid, List, Archive, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import RenewBadge from '@/components/documents/RenewBadge';

export default function Dashboard() {
  const { currentOrg, user, isOrgAdmin } = useOrg();
  const [documents, setDocuments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [customFields, setCustomFields] = useState([]);
  const [dashboardColumns, setDashboardColumns] = useState(null);
  const [showRenewBadge, setShowRenewBadge] = useState(true);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'card' : 'table'
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentOrg) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const [docs, myTeams, locs, depts, cFields, fieldConfigs] = await Promise.all([
        db.KBBDocument.filter({ org_id: currentOrg.id }, '-created_date', 200),
        db.Team.filter({ org_id: currentOrg.id }),
        db.Location.filter({ org_id: currentOrg.id }),
        db.Department.filter({ org_id: currentOrg.id }),
        db.CustomField.filter({ org_id: currentOrg.id }),
        db.FieldConfig.filter({ org_id: currentOrg.id }),
      ]);
      setCustomFields(cFields.filter(f => f.status === 'active'));
      const cfg = fieldConfigs[0];
      if (cfg?.dashboard_columns?.length) {
        setDashboardColumns(cfg.dashboard_columns);
      } else {
        setDashboardColumns([
          { key: 'title', label: 'Product Name', display_mode: 'values' },
          { key: 'document_id', label: 'Document ID', display_mode: 'values' },
          { key: 'location', label: 'Sites', display_mode: 'total' },
          { key: 'department', label: 'Departments', display_mode: 'total' },
        ]);
      }
      setShowRenewBadge(!(cfg?.hidden_required_fields?.includes('renew_date')));
      setTeams(myTeams);
      locs.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.name.localeCompare(b.name);
      });
      setLocations(locs);
      depts.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.name.localeCompare(b.name);
      });
      setDepartments(depts);

      const userTeamIds = myTeams
        .filter(t => t.member_user_ids?.includes(user?.id))
        .map(t => t.id);

      const isAdmin = user?.role === 'admin' || currentOrg.admin_user_ids?.includes(user?.id);
      const visible = docs.filter(doc => {
        if (doc.is_archived && !isAdmin) return false;
        if (doc.visibility === 'everyone') return true;
        if (isAdmin) return true;
        return doc.allowed_team_ids?.some(tid => userTeamIds.includes(tid));
      });
      setDocuments(visible);
      setLoading(false);
    };
    load();
  }, [currentOrg, user]);



  const isAdmin = user?.role === 'admin' || currentOrg?.admin_user_ids?.includes(user?.id);

  const filtered = documents.filter(doc => {
    if (!showArchived && doc.is_archived) return false;
    if (showArchived && !doc.is_archived) return false;
    if (search) {
      const q = search.toLowerCase();
      const customFieldMatch = customFields.some(cf => {
        const val = doc.custom_field_values?.[cf.id];
        if (!val) return false;
        if (Array.isArray(val)) return val.some(v => v.toLowerCase().includes(q));
        return String(val).toLowerCase().includes(q);
      });
      const matchesSearch = (
        doc.title?.toLowerCase().includes(q) ||
        doc.description?.toLowerCase().includes(q) ||
        doc.document_id?.toLowerCase().includes(q) ||
        doc.tags?.some(t => t.toLowerCase().includes(q)) ||
        doc.department?.some(d => d.toLowerCase().includes(q)) ||
        doc.location?.some(l => l.toLowerCase().includes(q)) ||
        customFieldMatch
      );
      if (!matchesSearch) return false;
    }
    if (locationFilter) {
      const hasAllLocations = doc.location?.includes('All Sites') || doc.location?.includes('All Locations') || doc.location?.length === 0 && doc.visibility === 'everyone';
      if (!hasAllLocations && !doc.location?.includes(locationFilter)) return false;
    }
    if (departmentFilter && !doc.department?.includes(departmentFilter)) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ['Product Name', 'Document ID', 'Description', 'Sites', 'Departments', 'Tags', 'Renew Date'];
    const rows = filtered.map(doc => [
      doc.title || '',
      doc.document_id || '',
      doc.description || '',
      doc.location?.join('; ') || '',
      doc.department?.join('; ') || '',
      doc.tags?.join('; ') || '',
      doc.renew_date || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SDS-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderDashboardCell = (doc, col) => {
    const { key, display_mode } = col;

    if (key.startsWith('custom_')) {
      const cfId = key.replace('custom_', '');
      const val = doc.custom_field_values?.[cfId];
      if (!val || (Array.isArray(val) && val.length === 0)) return <span className="text-sm text-muted-foreground">—</span>;
      if (Array.isArray(val)) {
        if (display_mode === 'total') return <span className="text-sm text-muted-foreground">{val.length}</span>;
        return (
          <div className="flex gap-1 flex-wrap">
            {val.slice(0, 3).map(v => <span key={v} className="text-xs px-1.5 py-0.5 bg-secondary border border-border" style={{ borderRadius: 2 }}>{v}</span>)}
            {val.length > 3 && <span className="text-xs text-muted-foreground">+{val.length - 3}</span>}
          </div>
        );
      }
      return <span className="text-sm">{val}</span>;
    }

    switch (key) {
      case 'title':
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate max-w-[180px]">{doc.title}</span>
            {showRenewBadge && <RenewBadge renewDate={doc.renew_date} compact />}
          </div>
        );
      case 'document_id':
        return <span className="font-mono-data text-muted-foreground">{doc.document_id || '—'}</span>;
      case 'location':
        if (!doc.location?.length) return <span className="text-sm text-muted-foreground">—</span>;
        if (display_mode === 'total') return <span className="text-sm text-muted-foreground">{doc.location.length} site{doc.location.length !== 1 ? 's' : ''}</span>;
        return (
          <div className="flex gap-1 flex-wrap">
            {doc.location.slice(0, 3).map(v => <span key={v} className="text-xs px-1.5 py-0.5 bg-secondary border border-border" style={{ borderRadius: 2 }}>{v}</span>)}
            {doc.location.length > 3 && <span className="text-xs text-muted-foreground">+{doc.location.length - 3}</span>}
          </div>
        );
      case 'department':
        if (!doc.department?.length) return <span className="text-sm text-muted-foreground">—</span>;
        if (display_mode === 'total') return <span className="text-sm text-muted-foreground">{doc.department.length} dept{doc.department.length !== 1 ? 's' : ''}</span>;
        return (
          <div className="flex gap-1 flex-wrap">
            {doc.department.slice(0, 3).map(v => <span key={v} className="text-xs px-1.5 py-0.5 bg-secondary border border-border" style={{ borderRadius: 2 }}>{v}</span>)}
            {doc.department.length > 3 && <span className="text-xs text-muted-foreground">+{doc.department.length - 3}</span>}
          </div>
        );
      case 'tags':
        if (!doc.tags?.length) return <span className="text-sm text-muted-foreground">—</span>;
        if (display_mode === 'total') return <span className="text-sm text-muted-foreground">{doc.tags.length} tag{doc.tags.length !== 1 ? 's' : ''}</span>;
        return (
          <div className="flex gap-1 flex-wrap">
            {doc.tags.slice(0, 3).map(tag => <span key={tag} className="text-xs px-1.5 py-0.5 bg-primary/8 text-primary border border-primary/20" style={{ borderRadius: 2 }}>{tag}</span>)}
            {doc.tags.length > 3 && <span className="text-xs text-muted-foreground">+{doc.tags.length - 3}</span>}
          </div>
        );
      case 'renew_date':
        return doc.renew_date ? <RenewBadge renewDate={doc.renew_date} compact /> : <span className="text-sm text-muted-foreground">—</span>;
      default:
        return <span className="text-sm text-muted-foreground">—</span>;
    }
  };

  if (!currentOrg) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">No organization selected. Create one to get started.</p>
        {user?.role === 'admin' && (
          <Link to="/organizations" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors" style={{ borderRadius: 2 }}>
            Manage Organizations
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="pb-24 sm:px-6 sm:pb-6 md:p-6 max-w-6xl mx-auto">
      {/* Header — iOS large title style on mobile */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 sm:px-0 sm:pt-0 sm:mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-xl font-bold sm:font-semibold tracking-tight">{currentOrg.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Safety Data Sheets (SDS)</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 border text-sm transition-colors ${showArchived ? 'bg-accent border-primary text-primary' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              style={{ borderRadius: 2 }}
            >
              <Archive className="w-4 h-4" />
              {showArchived ? 'Archived' : 'Archived'}
            </button>
          )}
          {!showArchived && (
            <Link
              to="/documents/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              style={{ borderRadius: 2 }}
            >
              <Plus className="w-4 h-4" />
              Add Item
            </Link>
          )}
        </div>
      </div>

      {/* Search + View Toggle — iOS-style rounded search on mobile */}
      <div className="flex gap-2 mb-4 px-4 sm:px-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-secondary text-foreground placeholder:text-muted-foreground text-[15px] sm:text-sm py-2 pr-3 border-0 sm:border sm:border-border sm:bg-background focus:outline-none focus:ring-0"
            style={{ paddingLeft: '2.25rem', borderRadius: 10, ...(window.innerWidth >= 640 ? { borderRadius: 2 } : {}) }}
          />
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-border text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          style={{ borderRadius: 2 }}
          title="Export CSV"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </button>
        <div className="flex border border-border" style={{ borderRadius: 2 }}>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2.5 flex items-center transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            title="Table view"
            style={{ borderRadius: '2px 0 0 2px' }}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`px-2.5 flex items-center border-l border-border transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            title="Card view"
            style={{ borderRadius: '0 2px 2px 0' }}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 px-4 sm:px-0">
        <select
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          className="kbb-input text-sm"
          style={{ minWidth: 150 }}
        >
          <option value="">Site</option>
          {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
        </select>
        <select
          value={departmentFilter}
          onChange={e => setDepartmentFilter(e.target.value)}
          className="kbb-input text-sm"
          style={{ minWidth: 150 }}
        >
          <option value="">Department</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        {(locationFilter || departmentFilter) && (
          <button
            onClick={() => { setLocationFilter(''); setDepartmentFilter(''); }}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 border border-border hover:bg-accent transition-colors"
            style={{ borderRadius: 2 }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Document list */}
      <div className="px-4 sm:px-0">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="kbb-card p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="kbb-card p-12 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {showArchived ? 'No archived items.' : search || locationFilter || departmentFilter ? 'No documents match your filters.' : 'No documents yet. Add the first one.'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="kbb-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {dashboardColumns?.map((col, i) => (
                    <th key={col.key} className={`text-left px-4 py-2.5 field-label ${i > 0 ? 'hidden sm:table-cell' : ''} ${i > 2 ? 'hidden lg:table-cell' : i > 1 ? 'hidden md:table-cell' : ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, idx) => (
                  <tr
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className={`border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                  >
                    {dashboardColumns?.map((col, i) => (
                      <td key={col.key} className={`px-4 py-3 ${i > 0 ? 'hidden sm:table-cell' : ''} ${i > 2 ? 'hidden lg:table-cell' : i > 1 ? 'hidden md:table-cell' : ''}`}>
                        {renderDashboardCell(doc, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Card view — iOS-style list rows on mobile, grid on desktop */
          <div className="sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 space-y-0 sm:space-y-0">
            {filtered.map((doc, idx) => (
              <div
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}`)}
                className={`
                  sm:kbb-card sm:p-4 sm:rounded cursor-pointer transition-colors flex flex-col gap-1
                  sm:hover:bg-accent/40
                  bg-card px-4 py-3.5
                  ${idx !== 0 ? 'border-t border-border' : ''}
                  active:bg-accent/60
                `}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[15px] sm:text-sm leading-snug flex-1 min-w-0 truncate">{doc.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {showRenewBadge && <RenewBadge renewDate={doc.renew_date} compact />}
                    <span className="sm:hidden text-muted-foreground/40 text-lg leading-none">›</span>
                  </div>
                </div>
                {doc.description && (
                  <p className="text-[13px] text-muted-foreground line-clamp-1 sm:line-clamp-2">{doc.description}</p>
                )}
                <div className="flex items-center gap-3 mt-0.5 sm:mt-0 sm:pt-2 sm:border-t sm:border-border flex-wrap">
                  {doc.document_id && (
                    <span className="font-mono-data text-xs text-muted-foreground">{doc.document_id}</span>
                  )}
                  {doc.location?.length > 0 && (
                    <span className="text-xs text-muted-foreground">{doc.location.length} site{doc.location.length !== 1 ? 's' : ''}</span>
                  )}
                  {doc.department?.length > 0 && (
                    <span className="text-xs text-muted-foreground">{doc.department.length} dept{doc.department.length !== 1 ? 's' : ''}</span>
                  )}

                  {doc.tags?.length > 0 && (
                    <div className="hidden sm:flex gap-1 flex-wrap mt-1">
                      {doc.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-primary/8 text-primary border border-primary/20" style={{ borderRadius: 2 }}>
                          {tag}
                        </span>
                      ))}
                      {doc.tags.length > 4 && <span className="text-xs text-muted-foreground">+{doc.tags.length - 4}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button — mobile only, iOS-style */}
      {!showArchived && (
        <Link
          to="/documents/new"
          className="sm:hidden fixed bottom-6 right-5 w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ borderRadius: '50%', boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}
          aria-label="Add Item"
        >
          <Plus className="w-6 h-6" />
        </Link>
      )}
    </div>
  );
}