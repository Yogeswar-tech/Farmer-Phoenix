import { useState, type FC } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Language } from '../types';
import { translations } from '../data/i18n';
import { Info, X, Check } from 'lucide-react';

interface GovtLagNoticeProps {
  currentLang: Language;
}

export const GovtLagNotice: FC<GovtLagNoticeProps> = ({ currentLang }) => {
  const [dismissed, setDismissed] = useState(false);
  const t = translations[currentLang];

  if (dismissed) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <Info color="#B45309" size={18} />
        <Text style={styles.text}>
          <Text style={styles.title}>{t.govLagTitle}: </Text>
          {t.govLagDesc}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        style={styles.closeBtn}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t.gotIt}
      >
        <Check size={14} color="#B45309" />
        <Text style={styles.closeText}>{t.gotIt}</Text>
        <X size={14} color="#B45309" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  title: {
    fontWeight: '700',
    color: '#78350F',
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDE68A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78350F',
  },
});
