import { useState, useEffect, type FC } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import type { Language } from '../types';
import { KisanSethuApi } from '../services/api';
import { Play, Clock } from 'lucide-react';

interface DemoVideoSectionProps {
  currentLang: Language;
}

export const DemoVideoSection: FC<DemoVideoSectionProps> = ({ currentLang }) => {
  const [videos, setVideos] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  useEffect(() => {
    KisanSethuApi.getDemoVideos().then(setVideos).catch(() => {});
  }, []);

  if (!videos || videos.length === 0) return null;

  const title =
    currentLang === 'hi' ? '📹 डेमो वीडियो — कैसे उपयोग करें' :
    currentLang === 'te' ? '📹 డెమో వీడియో — ఎలా వాడాలి' :
    '📹 Demo Video — How to Use Kisan Sethu';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {videos.map((v) => (
        <View key={v.id} style={styles.videoCard}>
          {v.video_url && activeVideo === v.id.toString() ? (
            <View style={styles.videoEmbed}>
              <iframe
                src={v.video_url}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
                allow="autoplay; fullscreen"
                title={v.title}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.thumbnailWrap}
              onPress={() => v.video_url ? setActiveVideo(v.id.toString()) : null}
              activeOpacity={0.85}
            >
              {v.thumbnail_url ? (
                <Image source={{ uri: v.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Text style={styles.placeholderEmoji}>🌾</Text>
                </View>
              )}
              <View style={styles.playOverlay}>
                {v.video_url ? (
                  <View style={styles.playBtn}>
                    <Play size={28} color="#FFFFFF" fill="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>
                      {currentLang === 'hi' ? 'जल्द आ रहा है' : currentLang === 'te' ? 'త్వరలో వస్తుంది' : 'Video Coming Soon'}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          <View style={styles.videoMeta}>
            <Text style={styles.videoTitle}>{v.title}</Text>
            {v.description && <Text style={styles.videoDesc}>{v.description}</Text>}
            {v.duration_seconds > 0 && (
              <View style={styles.durationRow}>
                <Clock size={12} color="#64748B" />
                <Text style={styles.durationText}>{Math.floor(v.duration_seconds / 60)}:{String(v.duration_seconds % 60).padStart(2, '0')} min</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginVertical: 12, marginHorizontal: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  videoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden' as any,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    marginBottom: 12,
  },
  thumbnailWrap: { position: 'relative', aspectRatio: 16 / 9, overflow: 'hidden' as any },
  thumbnail: { width: '100%' as any, height: '100%' as any },
  thumbnailPlaceholder: {
    width: '100%' as any, height: 200, backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderEmoji: { fontSize: 48 },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#2D5A27',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(45,90,39,0.85)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 24,
  },
  comingSoonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  videoEmbed: { width: '100%' as any, height: 240 },
  videoMeta: { padding: 14 },
  videoTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  videoDesc: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  durationText: { fontSize: 11, color: '#64748B' },
});
