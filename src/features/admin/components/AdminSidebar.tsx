// ============================================
// AdminSidebar Component
// ============================================
// Grouped sidebar navigation for admin panel
// Desktop: collapsible sidebar with groups
// Mobile: sticky bar + Sheet bottom sheet

'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  FolderOpen,
  Users,
  Trophy,
  Video,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import {
  TabType,
  TAB_LABELS,
  getSidebarCollapsed,
  saveSidebarCollapsed,
} from '@/features/admin/stores/adminPreferencesStore';
import { Sheet } from '@/shared/components/Sheet';

// ---- Tab group definitions ----

interface TabItem {
  id: TabType;
  icon: React.ComponentType<{ className?: string }>;
}

interface TabGroup {
  label: string;
  items: TabItem[];
}

const TAB_GROUPS: TabGroup[] = [
  {
    label: 'Metricas',
    items: [
      { id: 'analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Usuarios',
    items: [
      { id: 'users', icon: Users },
    ],
  },
  {
    label: 'Configuracion',
    items: [
      { id: 'categories', icon: FolderOpen },
      { id: 'leaderboard', icon: Trophy },
      { id: 'video', icon: Video },
    ],
  },
];

// Helper to find icon for a tab
function getTabIcon(tabId: TabType): React.ComponentType<{ className?: string }> {
  for (const group of TAB_GROUPS) {
    const item = group.items.find((i) => i.id === tabId);
    if (item) return item.icon;
  }
  return BarChart3;
}

// ---- Props ----

interface AdminSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

// ---- Desktop Sidebar ----

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCollapsed(getSidebarCollapsed());
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveSidebarCollapsed(next);
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <aside
      className={`glass-panel rounded-xl sticky top-20 transition-all duration-200 flex flex-col ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <nav className="flex-1 py-2 overflow-y-auto">
        {TAB_GROUPS.map((group) => {
          const isGroupCollapsed = collapsedGroups.has(group.label);

          return (
            <div key={group.label} className="mb-1">
              {/* Group header */}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-foreground transition-colors"
                >
                  {isGroupCollapsed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  {group.label}
                </button>
              )}

              {/* Group items */}
              {(!isGroupCollapsed || collapsed) &&
                group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      title={collapsed ? TAB_LABELS[item.id] : undefined}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        isActive
                          ? 'bg-primary/15 text-primary border-l-2 border-primary font-medium'
                          : 'text-muted hover:text-foreground hover:bg-accent/50 border-l-2 border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && (
                        <span className="truncate">{TAB_LABELS[item.id]}</span>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-xs text-muted hover:text-foreground border-t border-border transition-colors"
        title={collapsed ? 'Expandir' : 'Colapsar'}
      >
        {collapsed ? (
          <PanelLeft className="w-4 h-4" />
        ) : (
          <>
            <PanelLeftClose className="w-4 h-4" />
            <span>Colapsar</span>
          </>
        )}
      </button>
    </aside>
  );
}

// ---- Mobile Nav ----

interface AdminMobileNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function AdminMobileNav({ activeTab, onTabChange }: AdminMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ActiveIcon = getTabIcon(activeTab);

  const handleSelect = (tab: TabType) => {
    onTabChange(tab);
    setIsOpen(false);
  };

  return (
    <>
      {/* Sticky bar showing current tab */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2.5 w-full px-4 py-3 glass-panel rounded-xl text-sm font-medium text-foreground"
      >
        <ActiveIcon className="w-4 h-4 text-primary" />
        <span className="flex-1 text-left">{TAB_LABELS[activeTab]}</span>
        <ChevronDown className="w-4 h-4 text-muted" />
      </button>

      {/* Bottom sheet with all tabs */}
      <Sheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Admin Panel">
        <div className="px-2 py-2">
          {TAB_GROUPS.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-foreground hover:bg-accent/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{TAB_LABELS[item.id]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
