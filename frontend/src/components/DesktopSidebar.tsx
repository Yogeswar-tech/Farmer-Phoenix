import type { FC, ReactNode } from 'react';
import type { Language, NavigationTab } from '../types';
import { translations } from '../data/i18n';
import {
  Home,
  Truck,
  TrendingUp,
  CloudSun,
  Leaf,
  FlaskConical,
  TestTube2,
  Landmark,
  Warehouse,
  PhoneCall
} from 'lucide-react';

interface DesktopSidebarProps {
  currentLang: Language;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenHelpline: (num: string) => void;
}

export const DesktopSidebar: FC<DesktopSidebarProps> = ({
  currentLang,
  activeTab,
  onSelectTab,
  onOpenHelpline
}) => {
  const t = translations[currentLang];

  const menuItems: { id: NavigationTab; label: string; icon: ReactNode; badge?: string }[] = [
    { id: 'home', label: t.tabHome, icon: <Home size={18} /> },
    { id: 'logistics', label: t.tabLogistics, icon: <Truck size={18} />, badge: 'ROI' },
    { id: 'rates', label: t.tabRates, icon: <TrendingUp size={18} />, badge: 'Live' },
    { id: 'climate', label: t.tabClimate, icon: <CloudSun size={18} /> },
    { id: 'advisory', label: t.tabAdvisory, icon: <Leaf size={18} /> },
    { id: 'pesticides', label: t.tabPesticides, icon: <FlaskConical size={18} /> },
    { id: 'soildoctor', label: t.tabSoilDoctor, icon: <TestTube2 size={18} /> },
    { id: 'schemes', label: t.tabSchemes, icon: <Landmark size={18} /> },
    { id: 'storage', label: t.tabStorage, icon: <Warehouse size={18} /> }
  ];

  return (
    <aside className="desktop-sidebar-nav" aria-label="Desktop Navigation">
      <div className="sidebar-inner">
        <div className="sidebar-menu-header">
          <span className="sidebar-section-title">
            {currentLang === 'hi' ? 'कृषि सेवाएं (Agri Modules)' : currentLang === 'te' ? 'సేవలు (Services)' : 'Agri Command Center'}
          </span>
        </div>

        <nav className="sidebar-nav-list">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <div className="item-icon-wrap">{item.icon}</div>
                <span className="item-label">{item.label}</span>
                {item.badge && <span className="item-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* Quick Sidebar Help Card */}
        <div className="sidebar-helpline-box">
          <div className="box-title">
            <PhoneCall size={14} />
            <span>{t.kisanCallCenter}</span>
          </div>
          <p className="box-sub">1551 ({t.tollFreeTag})</p>
          <button
            type="button"
            onClick={() => onOpenHelpline('1551')}
            className="sidebar-call-btn"
          >
            {t.freeCallBtn}
          </button>
        </div>
      </div>
    </aside>
  );
};
