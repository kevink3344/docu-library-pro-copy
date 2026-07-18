import { useState, useEffect } from 'react';
import { db } from '@/api/db';
import { useOrg } from '@/lib/OrgContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Save, Plus, Trash2, ToggleLeft } from 'lucide-react';

const REQUIRED_FIELDS = [
  { key: 'title', label: 'Product Name' },
  { key: 'description', label: 'Description' },
  { key: 'document_id', label: 'Document ID' },
  { key: 'link_url', label: 'Link to Document' },
  { key: 'file', label: 'File Upload' },
  { key: 'tags', label: 'Tags' },
  { key: 'location', label: 'Site' },
  { key: 'department', label: 'Department' },
  { key: 'renew_date', label: 'Renew Date' },
];

// Multi-select fields where "display totals vs values" toggle makes sense
const MULTI_VALUE_KEYS = new Set(['location', 'department', 'tags']);

// All available columns (system + custom added dynamically)
const SYSTEM_COLUMN_OPTIONS = [
  { key: 'title', label: 'Product Name', isMulti: false },
  { key: 'document_id', label: 'Document ID', isMulti: false },
  { key: 'location', label: 'Sites', isMulti: true },
  { key: 'department', label: 'Departments', isMulti: true },
  { key: 'tags', label: 'Tags', isMulti: true },
  { key: 'renew_date', label: 'Renew Date', isMulti: false },
];

const DEFAULT_COLUMNS = [
  { key: 'title', label: 'Product Name', display_mode: 'values' },
  { key: 'document_id', label: 'Document ID', display_mode: 'values' },
  { key: 'location', label: 'Sites', display_mode: 'total' },
  { key: 'department', label: 'Departments', display_mode: 'total' },
];

export default function LayoutCustomization() {
  const { currentOrg } = useOrg();
  const [fieldConfig, setFieldConfig] = useState(null);
  const [configId, setConfigId] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [addOrder, setAddOrder] = useState([]);
  const [viewOrder, setViewOrder] = useState([]);
  const [dashboardColumns, setDashboardColumns] = useState(DEFAULT_COLUMNS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    const load = async () => {
      const [configs, cFields] = await Promise.all([
        db.FieldConfig.filter({ org_id: currentOrg.id }),
        db.CustomField.filter({ org_id: currentOrg.id }),
      ]);
      const cfg = configs[0] || {};
      setFieldConfig(cfg);
      setConfigId(configs[0]?.id || null);
      const activeCustom = cFields.filter(f => f.status === 'active');
      setCustomFields(activeCustom);

      const hidden = cfg.hidden_required_fields || [];
      const allKeys = [
        ...REQUIRED_FIELDS.filter(f => !hidden.includes(f.key)).map(f => f.key),
        ...activeCustom.map(f => `custom_${f.id}`)
      ];

      const buildOrder = (saved) => {
        if (saved?.length) {
          const ordered = saved.filter(k => allKeys.includes(k));
          allKeys.forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
          return ordered;
        }
        return allKeys;
      };

      setAddOrder(buildOrder(cfg.add_screen_order));
      setViewOrder(buildOrder(cfg.view_screen_order));

      if (cfg.dashboard_columns?.length) {
        setDashboardColumns(cfg.dashboard_columns);
      }
    };
    load();
  }, [currentOrg]);

  const getLabel = (key) => {
    if (key.startsWith('custom_')) {
      const id = key.replace('custom_', '');
      return customFields.find(f => f.id === id)?.name || key;
    }
    return REQUIRED_FIELDS.find(f => f.key === key)?.label || key;
  };

  // All available column options (system + active custom fields)
  const allColumnOptions = [
    ...SYSTEM_COLUMN_OPTIONS,
    ...customFields.map(f => ({ key: `custom_${f.id}`, label: f.name, isMulti: f.input_type === 'multi-select' })),
  ];

  const usedKeys = new Set(dashboardColumns.map(c => c.key));

  const addColumn = (option) => {
    setDashboardColumns(prev => [...prev, { key: option.key, label: option.label, display_mode: option.isMulti ? 'total' : 'values' }]);
  };

  const removeColumn = (key) => {
    setDashboardColumns(prev => prev.filter(c => c.key !== key));
  };

  const toggleDisplayMode = (key) => {
    setDashboardColumns(prev => prev.map(c => c.key === key
      ? { ...c, display_mode: c.display_mode === 'total' ? 'values' : 'total' }
      : c
    ));
  };

  const onDragEndDashboard = (result) => {
    if (!result.destination) return;
    const cols = [...dashboardColumns];
    const [moved] = cols.splice(result.source.index, 1);
    cols.splice(result.destination.index, 0, moved);
    setDashboardColumns(cols);
  };

  const onDragEnd = (result, type) => {
    if (!result.destination) return;
    const order = type === 'add' ? [...addOrder] : [...viewOrder];
    const [moved] = order.splice(result.source.index, 1);
    order.splice(result.destination.index, 0, moved);
    if (type === 'add') setAddOrder(order);
    else setViewOrder(order);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { add_screen_order: addOrder, view_screen_order: viewOrder, dashboard_columns: dashboardColumns };
    if (configId) {
      await db.FieldConfig.update(configId, payload);
    } else {
      const created = await db.FieldConfig.create({ org_id: currentOrg.id, hidden_required_fields: [], ...payload });
      setConfigId(created.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const OrderList = ({ order, type }) => (
    <DragDropContext onDragEnd={(r) => onDragEnd(r, type)}>
      <Droppable droppableId={type}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
            {order.map((key, idx) => (
              <Draggable key={key} draggableId={key} index={idx}>
                {(prov, snapshot) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    className={`flex items-center gap-3 px-3 py-2.5 border border-border bg-card transition-colors ${snapshot.isDragging ? 'bg-primary/5 border-primary/30 shadow-sm' : 'hover:bg-accent/40'}`}
                    style={{ ...prov.draggableProps.style, borderRadius: 2 }}
                  >
                    <div {...prov.dragHandleProps} className="text-muted-foreground cursor-grab">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <span className="font-mono-data text-xs text-muted-foreground w-5">{idx + 1}</span>
                    <span className="text-sm">{getLabel(key)}</span>
                    {key.startsWith('custom_') && (
                      <span className="ml-auto text-xs text-muted-foreground border border-border px-1.5 py-0.5" style={{ borderRadius: 2 }}>custom</span>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );

  const isMultiCol = (key) => {
    if (key.startsWith('custom_')) {
      const id = key.replace('custom_', '');
      const cf = customFields.find(f => f.id === id);
      return cf?.input_type === 'multi-select';
    }
    return MULTI_VALUE_KEYS.has(key);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Configure columns, field order, and visibility.</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          style={{ borderRadius: 2 }}
        >
          <Save className="w-3.5 h-3.5" />
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Layout'}
        </button>
      </div>

      {/* Dashboard Columns */}
      <div>
        <h2 className="text-sm font-semibold mb-1">Dashboard Columns</h2>
        <p className="text-xs text-muted-foreground mb-3">Choose which columns appear in the dashboard list. For multi-value fields, pick whether to show all values or just the total count.</p>

        <DragDropContext onDragEnd={onDragEndDashboard}>
          <Droppable droppableId="dashboard-cols">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1 mb-3">
                {dashboardColumns.map((col, idx) => {
                  const multi = isMultiCol(col.key);
                  return (
                    <Draggable key={col.key} draggableId={col.key} index={idx}>
                      {(prov, snapshot) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className={`flex items-center gap-3 px-3 py-2.5 border border-border bg-card transition-colors ${snapshot.isDragging ? 'bg-primary/5 border-primary/30 shadow-sm' : 'hover:bg-accent/40'}`}
                          style={{ ...prov.draggableProps.style, borderRadius: 2 }}
                        >
                          <div {...prov.dragHandleProps} className="text-muted-foreground cursor-grab">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <span className="font-mono-data text-xs text-muted-foreground w-5">{idx + 1}</span>
                          <span className="text-sm flex-1">{col.label}</span>

                          {multi && (
                            <button
                              onClick={() => toggleDisplayMode(col.key)}
                              className={`inline-flex items-center gap-1 text-xs px-2 py-1 border transition-colors ${col.display_mode === 'total' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-secondary text-muted-foreground border-border hover:bg-accent'}`}
                              style={{ borderRadius: 2 }}
                              title="Toggle between showing all values or just the total count"
                            >
                              <ToggleLeft className="w-3 h-3" />
                              {col.display_mode === 'total' ? 'Display total' : 'Display values'}
                            </button>
                          )}

                          <button
                            onClick={() => removeColumn(col.key)}
                            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            style={{ borderRadius: 2 }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add column picker */}
        <div className="flex flex-wrap gap-2">
          {allColumnOptions.filter(o => !usedKeys.has(o.key)).map(option => (
            <button
              key={option.key}
              onClick={() => addColumn(option)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
              style={{ borderRadius: 2 }}
            >
              <Plus className="w-3 h-3" /> {option.label}
            </button>
          ))}
          {allColumnOptions.filter(o => !usedKeys.has(o.key)).length === 0 && (
            <p className="text-xs text-muted-foreground">All available columns are added.</p>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-6 grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold mb-3">Add Item Screen</h2>
          <OrderList order={addOrder} type="add" />
        </div>
        <div>
          <h2 className="text-sm font-semibold mb-3">View Details Screen</h2>
          <OrderList order={viewOrder} type="view" />
        </div>
      </div>
    </div>
  );
}