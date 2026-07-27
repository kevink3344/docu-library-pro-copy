import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '@/lib/OrgContext';
import { useAuth } from '@/lib/AuthContext';
import { Layers, Layout, Users, User, MapPin, Building2, Building, KeyRound, Palette, BookOpen, Megaphone, ChevronDown, Settings2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import OrgSwitcher from '@/components/layout/OrgSwitcher';
import FieldManagement from '@/pages/settings/FieldManagement';
import LayoutCustomization from '@/pages/settings/LayoutCustomization';
import TeamManagement from '@/pages/settings/TeamManagement';
import LocationManagement from '@/pages/settings/LocationManagement';
import DepartmentManagement from '@/pages/settings/DepartmentManagement';
import MemberManagement from '@/pages/settings/MemberManagement';
import OrganizationManagement from '@/pages/settings/OrganizationManagement';
import LoginModeManagement from '@/pages/settings/LoginModeManagement';
import BrandingManagement from '@/pages/settings/BrandingManagement';
import SystemMessagesManagement from '@/pages/settings/SystemMessagesManagement';
import ApiDocs from '@/pages/settings/ApiDocs';
import ManageTabsModal from '@/pages/settings/ManageTabsModal';
import { fetchSettingsTabs, updateTabSections } from '@/api/settingsTabs';

/**
 * @typedef {import('@/api/settingsTabs').SettingsTab} SettingsTab
 * @typedef {import('@/api/settingsTabs').SettingsTabSection} SettingsTabSection
 */

/** Maps section keys to their metadata and components */
const SECTION_DEFS = {
  apiDocs: { label: 'API Docs', icon: BookOpen, Component: ApiDocs },
  branding: { label: 'Branding', icon: Palette, Component: BrandingManagement },
  systemMessages: { label: 'System Messages', icon: Megaphone, Component: SystemMessagesManagement },
  fields: { label: 'Field Management', icon: Layers, Component: FieldManagement },
  layout: { label: 'Layout', icon: Layout, Component: LayoutCustomization },
  teams: { label: 'Teams', icon: Users, Component: TeamManagement },
  locations: { label: 'Sites', icon: MapPin, Component: LocationManagement },
  departments: { label: 'Departments', icon: Building2, Component: DepartmentManagement },
  members: { label: 'Users', icon: User, Component: MemberManagement },
  organizations: { label: 'Organizations', icon: Building, Component: OrganizationManagement },
  loginMode: { label: 'Login Mode', icon: KeyRound, Component: LoginModeManagement },
};

/** Prefix used for droppable IDs representing tab names in the bar */
const TAB_BAR_DROPPABLE_PREFIX = 'tab-bar-';

export default function Settings() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { user } = useAuth();
  const isSuperAdmin = /** @type {boolean} */ (user?.role === 'admin');

  /** @type {[SettingsTab[], Function]} */
  const [tabs, setTabs] = useState(/** @type {SettingsTab[]} */ ([]));
  const [activeTabId, setActiveTabId] = useState('');
  const [loadingTabs, setLoadingTabs] = useState(true);
  const [openSections, setOpenSections] = useState(/** @type {Set<string>} */ (new Set()));
  const [showManageTabs, setShowManageTabs] = useState(false);
  const [sectionError, setSectionError] = useState('');

  // ---- Load tabs ----
  const loadTabs = useCallback(async () => {
    setLoadingTabs(true);
    try {
      const data = /** @type {SettingsTab[]} */ (await fetchSettingsTabs());
      setTabs(data);
      if (data.length > 0) {
        setActiveTabId((prev) => (data.some((t) => t.id === prev) ? prev : data[0].id));
      }
    } catch (/** @type {any} */ err) {
      console.error('Failed to load settings tabs', err);
      const defaultTabs = /** @type {SettingsTab[]} */ (createDefaultTabs(isSuperAdmin));
      setTabs(defaultTabs);
      if (defaultTabs.length > 0 && !activeTabId) {
        setActiveTabId(defaultTabs[0].id);
      }
    } finally {
      setLoadingTabs(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadTabs();
  }, [loadTabs]);

  if (!currentOrg) return <div className="p-8 text-center text-muted-foreground text-sm">No organization selected.</div>;
  if (!isOrgAdmin(currentOrg)) return <div className="p-8 text-center text-muted-foreground text-sm">Access restricted to Org Admins.</div>;

  // ---- Accordion toggle ----
  const toggleSection = (/** @type {string} */ key) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ---- Drag-and-drop handlers ----
  const handleDragEnd = async (/** @type {any} */ result) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceDroppableId = /** @type {string} */ (source.droppableId);
    const destDroppableId = /** @type {string} */ (destination.droppableId);

    // Determine if destination is a tab bar droppable (moving between tabs)
    const isDestTabBar = destDroppableId.startsWith(TAB_BAR_DROPPABLE_PREFIX);

    // Resolve actual tab IDs
    const sourceTabId = sourceDroppableId;
    const destTabId = isDestTabBar
      ? destDroppableId.slice(TAB_BAR_DROPPABLE_PREFIX.length)
      : destDroppableId;

    // If dropped in the same position within the same tab, nothing to do
    if (sourceTabId === destTabId && source.index === destination.index && !isDestTabBar) return;

    setSectionError('');

    // Deep-clone sections for immutability
    const newTabs = tabs.map((tab) => ({
      ...tab,
      sections: tab.sections.map((s) => ({ ...s })),
    }));

    const sourceTab = newTabs.find((t) => t.id === sourceTabId);
    const destTab = newTabs.find((t) => t.id === destTabId);

    if (!sourceTab || !destTab) return;

    // Remove from source
    const [movedSection] = sourceTab.sections.splice(source.index, 1);
    if (!movedSection) return;

    // Determine destination index
    let destIndex;
    if (isDestTabBar) {
      // Dropped on a tab name — append to the end of that tab
      destIndex = destTab.sections.length;
    } else {
      destIndex = destination.index;
    }

    // Insert into destination
    destTab.sections.splice(destIndex, 0, movedSection);

    // Update local state immediately for responsiveness
    setTabs(newTabs);

    // If moving between tabs or within a tab, persist both (or the single tab)
    const tabsToPersist = new Set([sourceTabId]);
    if (sourceTabId !== destTabId) tabsToPersist.add(destTabId);

    for (const tabId of tabsToPersist) {
      await persistTabSections(tabId, newTabs);
    }

    // If dragging to a different tab, switch the active view to that tab
    if (sourceTabId !== destTabId) {
      setActiveTabId(destTabId);
    }
  };

  const persistTabSections = async (/** @type {string} */ tabId, /** @type {SettingsTab[]} */ updatedTabs) => {
    const tab = updatedTabs.find((t) => t.id === tabId);
    if (!tab) return;
    try {
      await updateTabSections(tabId, tab.sections.map((s) => s.section_key));
    } catch (/** @type {any} */ err) {
      setSectionError(`Failed to save section order for "${tab.name}": ${err.message}`);
      loadTabs();
    }
  };

  // ---- Tab bar ----
  const renderTabBar = () => (
    <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isGeneral = tab.slug === 'general';
        const tabBarDroppableId = `${TAB_BAR_DROPPABLE_PREFIX}${tab.id}`;

        return (
          <Droppable key={tab.id} droppableId={tabBarDroppableId} isDropDisabled={isActive}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                onClick={() => setActiveTabId(tab.id)}
                className={`relative px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-primary text-foreground'
                    : snapshot.isDraggingOver
                      ? 'border-primary/60 text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.name}
                {tab.visible_to === 'super_admin' && (
                  <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 uppercase">
                    SA
                  </span>
                )}
                {/* Drop indicator bar for inactive tabs when dragging over */}
                {!isActive && snapshot.isDraggingOver && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 bg-primary rounded-full" />
                )}
                {!isActive && snapshot.isDraggingOver && (
                  <span className="ml-2 text-[10px] text-primary animate-pulse">
                    + drop here
                  </span>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        );
      })}
      {isSuperAdmin && (
        <button
          onClick={() => setShowManageTabs(true)}
          className="ml-auto px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0"
          title="Manage Tabs"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Manage</span>
        </button>
      )}
    </div>
  );

  // ---- Active tab sections ----
  const renderActiveTabContent = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab) return null;
    const sections = activeTab.sections;

    // Helper to find which tab a section key belongs to
    const findTabNameBySectionKey = (/** @type {string} */ sectionKey) => {
      for (const t of tabs) {
        if (t.sections.some((s) => s.section_key === sectionKey)) return t.name;
      }
      return null;
    };

    if (sections.length === 0) {
      return (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No sections in this tab.{' '}
          {isSuperAdmin && 'Drag sections here from other tabs by clicking and dragging their drag handle onto a tab name above.'}
        </div>
      );
    }

    return (
      <Droppable droppableId={activeTabId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`kbb-card overflow-hidden transition-colors ${
              snapshot.isDraggingOver ? 'bg-accent/20 ring-2 ring-primary/20' : ''
            }`}
          >
            {sections.map((section, idx) => {
              const def = SECTION_DEFS[/** @type {keyof typeof SECTION_DEFS} */ (section.section_key)];
              if (!def) return null;
              const { label, icon: Icon, Component } = def;
              const isOpen = openSections.has(section.section_key);

              return (
                <Draggable key={section.id} draggableId={section.id} index={idx}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`${idx !== 0 ? 'border-t border-border' : ''} ${
                        snapshot.isDragging ? 'bg-accent shadow-lg rounded-md opacity-80' : ''
                      }`}
                    >
                      <button
                        onClick={() => toggleSection(section.section_key)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing p-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" className="text-muted-foreground">
                              <circle cx="3" cy="2" r="1" fill="currentColor" />
                              <circle cx="9" cy="2" r="1" fill="currentColor" />
                              <circle cx="3" cy="6" r="1" fill="currentColor" />
                              <circle cx="9" cy="6" r="1" fill="currentColor" />
                              <circle cx="3" cy="10" r="1" fill="currentColor" />
                              <circle cx="9" cy="10" r="1" fill="currentColor" />
                            </svg>
                          </div>
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4">
                          <Component />
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold">Settings</h1>
            <OrgSwitcher />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{currentOrg?.name}</p>
        </div>

        {sectionError && (
          <div className="mb-4 bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md">
            {sectionError}
          </div>
        )}

        {/* Tab bar — each inactive tab name is a drop target */}
        {renderTabBar()}

        {/* Active tab content */}
        <div className="mt-4">
          {loadingTabs ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading settings…</div>
          ) : tabs.length > 0 && activeTabId ? (
            renderActiveTabContent()
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No settings tabs available.</div>
          )}
        </div>

        {/* Manage Tabs Modal */}
        {showManageTabs && (
          <ManageTabsModal
            onClose={() => {
              setShowManageTabs(false);
              loadTabs();
            }}
          />
        )}
      </div>
    </DragDropContext>
  );
}

/**
 * Creates default tab structure as a fallback when the API is unavailable.
 * @param {boolean} isSuperAdmin
 * @returns {import('@/api/settingsTabs').SettingsTab[]}
 */
function createDefaultTabs(isSuperAdmin) {
  const generalId = 'default-general';
  const configId = 'default-config';
  const storageId = 'default-storage';
  const privateId = 'default-private';
  const now = new Date().toISOString();

  /** @type {import('@/api/settingsTabs').SettingsTab[]} */
  const allTabs = [
    {
      id: generalId,
      name: 'General',
      slug: 'general',
      sort_order: 0,
      visible_to: 'all',
      created_at: now,
      updated_at: now,
      sections: [
        { id: 's-apiDocs', tab_id: generalId, section_key: 'apiDocs', sort_order: 0 },
        { id: 's-branding', tab_id: generalId, section_key: 'branding', sort_order: 1 },
        { id: 's-systemMessages', tab_id: generalId, section_key: 'systemMessages', sort_order: 2 },
      ],
    },
    {
      id: configId,
      name: 'Configuration',
      slug: 'configuration',
      sort_order: 1,
      visible_to: 'all',
      created_at: now,
      updated_at: now,
      sections: [
        { id: 's-fields', tab_id: configId, section_key: 'fields', sort_order: 0 },
        { id: 's-layout', tab_id: configId, section_key: 'layout', sort_order: 1 },
        { id: 's-teams', tab_id: configId, section_key: 'teams', sort_order: 2 },
        { id: 's-loginMode', tab_id: configId, section_key: 'loginMode', sort_order: 3 },
      ],
    },
    {
      id: storageId,
      name: 'Storage',
      slug: 'storage',
      sort_order: 2,
      visible_to: 'all',
      created_at: now,
      updated_at: now,
      sections: [
        { id: 's-locations', tab_id: storageId, section_key: 'locations', sort_order: 0 },
        { id: 's-departments', tab_id: storageId, section_key: 'departments', sort_order: 1 },
        { id: 's-members', tab_id: storageId, section_key: 'members', sort_order: 2 },
        { id: 's-organizations', tab_id: storageId, section_key: 'organizations', sort_order: 3 },
      ],
    },
  ];

  if (isSuperAdmin) {
    allTabs.push({
      id: privateId,
      name: 'Private',
      slug: 'private',
      sort_order: 3,
      visible_to: 'super_admin',
      created_at: now,
      updated_at: now,
      sections: [],
    });
  }

  return allTabs;
}