import { useState, useEffect } from 'react';
import { X, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import {
  fetchSettingsTabs,
  createSettingsTab,
  updateSettingsTab,
  deleteSettingsTab,
  reorderSettingsTabs,
} from '@/api/settingsTabs';

/**
 * @typedef {import('@/api/settingsTabs').SettingsTab} SettingsTab
 */

// The "General" tab slug — this tab cannot be deleted
const PROTECTED_SLUGS = ['general'];

/**
 * @param {{ onClose: () => void }} props
 */
export default function ManageTabsModal({ onClose }) {
  /** @type {[SettingsTab[], import('react').Dispatch<import('react').SetStateAction<SettingsTab[]>>]} */
  const [tabs, setTabs] = useState(/** @type {SettingsTab[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newVisible, setNewVisible] = useState(/** @type {'all' | 'super_admin'} */ ('all'));

  // Edit form state
  const [editingId, setEditingId] = useState(/** @type {string|null} */ (null));
  const [editName, setEditName] = useState('');
  const [editVisible, setEditVisible] = useState(/** @type {'all' | 'super_admin'} */ ('all'));

  // Dragged tab index
  const [dragIndex, setDragIndex] = useState(/** @type {number|null} */ (null));

  useEffect(() => {
    loadTabs();
  }, []);

  const loadTabs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = /** @type {SettingsTab[]} */ (await fetchSettingsTabs());
      setTabs(data);
    } catch (/** @type {any} */ err) {
      setError(err.message || 'Failed to load tabs');
    } finally {
      setLoading(false);
    }
  };

  // ---- Create ----
  const handleCreate = async (/** @type {React.FormEvent} */ e) => {
    e.preventDefault();
    setError('');
    try {
      const slug = newSlug.trim() || newName.trim().toLowerCase().replace(/\s+/g, '-');
      await createSettingsTab({ name: newName.trim(), slug, visible_to: newVisible });
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      setNewVisible('all');
      await loadTabs();
    } catch (/** @type {any} */ err) {
      setError(err.message || 'Failed to create tab');
    }
  };

  // ---- Edit ----
  const startEdit = (/** @type {SettingsTab} */ tab) => {
    setEditingId(tab.id);
    setEditName(tab.name);
    setEditVisible(tab.visible_to);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditVisible('all');
  };

  const handleEdit = async (/** @type {string} */ tabId) => {
    setError('');
    try {
      /** @type {{ name?: string; visible_to?: 'all' | 'super_admin' }} */
      const patch = {};
      if (editName.trim()) patch.name = editName.trim();
      patch.visible_to = editVisible;
      await updateSettingsTab(tabId, patch);
      cancelEdit();
      await loadTabs();
    } catch (/** @type {any} */ err) {
      setError(err.message || 'Failed to update tab');
    }
  };

  // ---- Delete ----
  const handleDelete = async (/** @type {string} */ tabId, /** @type {string} */ tabSlug) => {
    if (PROTECTED_SLUGS.includes(tabSlug)) {
      setError('The "General" tab cannot be deleted.');
      return;
    }
    if (!window.confirm('Delete this tab? Sections in this tab will be lost.')) return;
    setError('');
    try {
      await deleteSettingsTab(tabId);
      await loadTabs();
    } catch (/** @type {any} */ err) {
      setError(err.message || 'Failed to delete tab');
    }
  };

  // ---- Reorder (simple drag-to-move) ----
  const handleDragStart = (/** @type {number} */ index) => {
    setDragIndex(index);
  };

  const handleDrop = async (/** @type {number} */ dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }

    const reordered = [...tabs];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setTabs(reordered);
    setDragIndex(null);

    try {
      await reorderSettingsTabs(reordered.map((t) => t.id));
      await loadTabs();
    } catch (/** @type {any} */ err) {
      setError(err.message || 'Failed to reorder tabs');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Manage Tabs</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">Loading tabs…</div>
          ) : (
            <div className="space-y-2">
              {tabs.map((tab, idx) => (
                <div
                  key={tab.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(idx)}
                  className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-2 hover:shadow-sm transition-shadow"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />

                  {editingId === tab.id ? (
                    /* Edit mode */
                    <div className="flex-1 flex flex-col gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 text-sm bg-background border border-border rounded px-2 py-1"
                        placeholder="Tab name"
                      />
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input
                            type="radio"
                            name="edit-visibility"
                            value="all"
                            checked={editVisible === 'all'}
                            onChange={() => setEditVisible('all')}
                          />
                          All
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input
                            type="radio"
                            name="edit-visibility"
                            value="super_admin"
                            checked={editVisible === 'super_admin'}
                            onChange={() => setEditVisible('super_admin')}
                          />
                          Super Admin Only
                        </label>
                        <div className="ml-auto flex gap-1">
                          <button
                            onClick={() => handleEdit(tab.id)}
                            className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{tab.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase ${
                            tab.visible_to === 'super_admin'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          }`}>
                            {tab.visible_to === 'super_admin' ? 'Super Admin' : 'All'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {tab.sections.length} section{tab.sections.length !== 1 ? 's' : ''}
                          {tab.slug === 'general' && ' (protected)'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(tab)}
                          className="p-1.5 hover:bg-accent rounded transition-colors"
                          title="Edit tab"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(tab.id, tab.slug)}
                          disabled={PROTECTED_SLUGS.includes(tab.slug)}
                          className="p-1.5 hover:bg-destructive/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete tab"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Create form */}
          {showCreate ? (
            <form onSubmit={handleCreate} className="bg-accent/30 border border-border rounded-md p-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-sm bg-background border border-border rounded px-2 py-1.5 mt-1"
                  placeholder="e.g. Integrations"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Slug <span className="font-normal">(leave blank to auto-generate)</span>
                </label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  className="w-full text-sm bg-background border border-border rounded px-2 py-1.5 mt-1"
                  placeholder="e.g. integrations"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Visible to</label>
                <div className="flex items-center gap-4 mt-1">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="new-visibility"
                      value="all"
                      checked={newVisible === 'all'}
                      onChange={() => setNewVisible('all')}
                    />
                    All
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="new-visibility"
                      value="super_admin"
                      checked={newVisible === 'super_admin'}
                      onChange={() => setNewVisible('super_admin')}
                    />
                    Super Admin Only
                  </label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setNewName(''); setNewSlug(''); }}
                  className="text-sm px-3 py-1.5 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  Create Tab
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 border border-dashed border-border rounded-md hover:bg-accent/30"
            >
              <Plus className="w-4 h-4" />
              Add Tab
            </button>
          )}
        </div>
      </div>
    </div>
  );
}