import { useState, type FC, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import type { Language, NavigationTab } from '../types';
import { translations } from '../data/i18n';
import {
  Home,
  TrendingUp,
  CloudSun,
  Leaf,
  Menu,
  Truck,
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
    { id: 'home', label: t.tabHome, icon: <Home size={20} color={activeTab === 'home' ? '#2D5A27' : '#64748B'} /> },
    { id: 'rates', label: t.tabRates, icon: <TrendingUp size={20} color={activeTab === 'rates' ? '#2D5A27' : '#64748B'} /> },
    { id: 'climate', label: t.tabClimate.split(' ')[0], icon: <CloudSun size={20} color={activeTab === 'climate' ? '#2D5A27' : '#64748B'} /> },
    { id: 'advisory', label: currentLang === 'hi' ? 'डॉक्टर' : currentLang === 'te' ? 'డాక్టర్' : 'Doctor', icon: <Leaf size={20} color={activeTab === 'advisory' ? '#2D5A27' : '#64748B'} /> },
  ];

  const moreItems: { id: NavigationTab; label: string; icon: ReactNode }[] = [
    { id: 'logistics', label: t.tabLogistics, icon: <Truck size={22} color={activeTab === 'logistics' ? '#2D5A27' : '#334155'} /> },
    { id: 'soildoctor', label: t.tabSoilDoctor, icon: <TestTube2 size={22} color={activeTab === 'soildoctor' ? '#2D5A27' : '#334155'} /> },
    { id: 'schemes', label: t.tabSchemes, icon: <Landmark size={22} color={activeTab === 'schemes' ? '#2D5A27' : '#334155'} /> },
    { id: 'storage', label: t.tabStorage, icon: <Warehouse size={22} color={activeTab === 'storage' ? '#2D5A27' : '#334155'} /> },
  ];

  const isMoreActive = moreItems.some((item) => item.id === activeTab);

  return (
    <>
      {/* React Native Mobile Bottom Bar */}
      <View style={styles.bottomBar} role="navigation" aria-label="Bottom Navigation">
        {mainTabs.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                onSelectTab(item.id);
                setIsMoreOpen(false);
              }}
              style={styles.tabBtn}
              activeOpacity={0.7}
              accessibilityRole="link"
              role="link"
              aria-label={item.label}
              accessibilityLabel={item.label}
            >
              <View style={styles.iconWrap}>{item.icon}</View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {item.label}
              </Text>
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}

        {/* More Drawer Button */}
        <TouchableOpacity
          onPress={() => setIsMoreOpen(!isMoreOpen)}
          style={styles.tabBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          role="button"
          aria-label={currentLang === 'hi' ? 'अन्य विकल्प' : currentLang === 'te' ? 'మరిన్ని ఎంపికలు' : 'More menu options'}
          accessibilityLabel={currentLang === 'hi' ? 'अन्य विकल्प' : currentLang === 'te' ? 'మరిన్ని ఎంపికలు' : 'More menu options'}
        >
          <View style={styles.iconWrap}>
            <Menu size={20} color={isMoreActive || isMoreOpen ? '#2D5A27' : '#64748B'} />
          </View>
          <Text style={[styles.tabLabel, (isMoreActive || isMoreOpen) && styles.tabLabelActive]}>
            {currentLang === 'hi' ? 'अन्य' : currentLang === 'te' ? 'మరిన్ని' : 'More'}
          </Text>
          {(isMoreActive || isMoreOpen) && <View style={styles.activeDot} />}
        </TouchableOpacity>
      </View>

      {/* Modal Drawer for Additional Modules */}
      <Modal
        visible={isMoreOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsMoreOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsMoreOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>{t.moreTools}</Text>
              <TouchableOpacity
                onPress={() => setIsMoreOpen(false)}
                style={styles.closeBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                role="button"
                aria-label="Close menu drawer"
                accessibilityLabel="Close menu drawer"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.drawerGrid}>
              {moreItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      onSelectTab(item.id);
                      setIsMoreOpen(false);
                    }}
                    style={[styles.gridItem, isActive && styles.gridItemActive]}
                    activeOpacity={0.7}
                    accessibilityRole="link"
                    role="link"
                    aria-label={item.label}
                    accessibilityLabel={item.label}
                  >
                    <View style={styles.gridIcon}>{item.icon}</View>
                    <Text style={[styles.gridLabel, isActive && styles.gridLabelActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bottomBar: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    flexShrink: 0,
    zIndex: 100,
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)' as any,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    position: 'relative',
    minHeight: 48,
    minWidth: 48,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#2D5A27',
    fontWeight: '800',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2D5A27',
    marginTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  closeBtn: {
    padding: 12,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '30%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 48,
  },
  gridItemActive: {
    backgroundColor: '#EFF7EE',
    borderColor: '#2D5A27',
  },
  gridIcon: {
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  gridLabelActive: {
    color: '#2D5A27',
  },
});
