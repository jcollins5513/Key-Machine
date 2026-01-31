import React from 'react';

export type TabId =
  | 'checkout'
  | 'read-tag'
  | 'add-user'
  | 'add-vehicle'
  | 'sell-vehicle'
  | 'users'
  | 'inventory'
  | 'logout'
  | 'license';

type TabDef = {
  id: TabId;
  label: string;
  icon: string;
  adminOnly: boolean;
};

const TABS: TabDef[] = [
  { id: 'checkout', label: 'Check Out Key', icon: '🔑', adminOnly: false },
  { id: 'read-tag', label: 'Read Tag', icon: '📖', adminOnly: false },
  { id: 'add-user', label: 'Add User', icon: '👤', adminOnly: true },
  { id: 'add-vehicle', label: 'Add Vehicle', icon: '🚗', adminOnly: true },
  { id: 'sell-vehicle', label: 'Sell Vehicle', icon: '💰', adminOnly: true },
  { id: 'users', label: 'Current Users', icon: '👥', adminOnly: true },
  { id: 'inventory', label: 'Inventory', icon: '📋', adminOnly: false },
  { id: 'license', label: 'License', icon: '📜', adminOnly: false },
  { id: 'logout', label: 'Log Out', icon: '🚪', adminOnly: false },
] as const;

type SidebarProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isAdmin: boolean;
  userName: string;
};

export const Sidebar = ({ activeTab, onTabChange, isAdmin, userName }: SidebarProps) => {
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">Key Machine</h1>
        <p className="sidebar-user">{userName}</p>
      </div>
      <nav className="sidebar-nav">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="sidebar-tab-icon">{tab.icon}</span>
            <span className="sidebar-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};
