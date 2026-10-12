import { useState, type FC, type ReactNode } from 'react';
import type { Language, NavigationTab } from '../types';
import { translations } from '../data/i18n';
import {
  Home,
  TrendingUp,
  CloudSun,
  Leaf,
  Menu,
  Truck,
  FlaskConical,
  TestTube2,
  Landmark,
  Warehouse,
  X
} from 'lucide-react';

interface MobileBottomNavProps {
  currentLang: Language;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const MobileBottomNav: FC<MobileBottomNavProps> = ({
  currentLang,
  activeTab,
  onSelectTab
}) => {
  const t = translations[currentLang];
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainTabs: { id: NavigationTab; label: string; icon: ReactNode }[] = [
    { id: 'home', label: t.tabHome, icon: <Home size={19} /> },
    { id: 'rates', label: t.tabRates, icon: <TrendingUp size={19} /> },
    { id: 'climate', label: t.tabClimate.split(' ')[0], icon: <CloudSun size={19} /> },
    { id: 'advisory', label: t.tabAdvisory.split(' ')[0], icon: <Leaf size={19} /> },
  ];

  const moreItems: { id: NavigationTab; label: string; icon: ReactNode }[] = [
    { id: 'logistics', label: t.tabLogistics, icon: <Truck size={20} /> },
    { id: 'pesticides', label: t.tabPesticides, icon: <FlaskConical size={20} /> },
    { id: 'soildoctor', label: t.tabSoilDoctor, icon: <TestTube2 size={20} /> },
    { id: 'schemes', label: t.tabSchemes, icon: <Landmark size={20} /> },
    { id: 'storage', label: t.tabStorage, icon: <Warehouse size={20} /> },
  ];

  const isMoreActive = moreItems.some(item => item.id === activeTab);

  return (
    <>
      {/* Mobile Bottom Bar (56px) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <div className="bottom-nav-inner">
          {mainTabs.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setIsMoreOpen(false);
                }}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              >
                <div className="nav-icon-wrap">{item.icon}</div>
                <span className="nav-label">{item.label}</span>
                {isActive && <span className="active-dot" />}
              </button>
            );
          })}

          {/* More Drawer Button */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`nav-tab-btn ${isMoreActive || isMoreOpen ? 'active' : ''}`}
          >
            <div className="nav-icon-wrap">
              <Menu size={19} />
            </div>
            <span className="nav-label">{currentLang === 'hi' ? 'अन्य' : currentLang === 'te' ? 'మరిన్ని' : 'More'}</span>
            {(isMoreActive || isMoreOpen) && <span className="active-dot" />}
          </button>
        </div>
      </nav>

      {/* Slide-Up Drawer for Additional Modules */}
      {isMoreOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setIsMoreOpen(false)}>
          <div className="mobile-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <span className="drawer-title">{t.moreTools}</span>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="drawer-close-btn"
              >
                <X size={18} />
              </button>
            </div>
            <div className="drawer-grid">
              {moreItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setIsMoreOpen(false);
                    }}
                    className={`drawer-item-btn ${isActive ? 'active' : ''}`}
                  >
                    <div className="drawer-icon">{item.icon}</div>
                    <span className="drawer-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
