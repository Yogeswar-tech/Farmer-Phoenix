import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SpeakerButton } from "@/components/SpeakerButton";
import { getInsight } from "@/lib/api";
import { getSettings } from "@/lib/storage";
import { FarmerEnvelope } from "@/lib/types";
import { theme } from "@/theme";

export default function PriceDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { cropId } = useLocalSearchParams<{ cropId: string }>();

  const [insight, setInsight] = useState<FarmerEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPriceData() {
      if (!cropId) return;
      try {
        setLoading(true);
        setError(false);
        const { regionId } = await getSettings();
        const data = await getInsight(cropId, regionId || "Chennai", i18n.language);
        if (isMounted) {
          setInsight(data);
        }
      } catch {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPriceData();
    return () => {
      isMounted = false;
    };
  }, [cropId, i18n.language]);

  const handleAskAboutCrop = () => {
    router.push({
      pathname: "/ask",
      params: { crop: cropId },
    } as unknown as Href);
  };

  const cropTitle = cropId ? cropId.charAt(0).toUpperCase() + cropId.slice(1) : "Crop";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{cropTitle}</Text>

      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.colors.primaryStrong} />
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{t("common.error")}</Text>
        </View>
      )}

      {!loading && insight && (
        <View style={styles.cardContainer}>
          {/* Stale offline notice if cached */}
          {insight.freshness.stale && (
            <View style={styles.staleBanner}>
              <Text style={styles.staleText}>⚠️ {t("price.staleWarning")}</Text>
            </View>
          )}

          {/* Main Price Card */}
          <View style={styles.insightCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeadline}>{insight.card.headline}</Text>
              <SpeakerButton
                textToSpeak={`${insight.card.headline}. ${insight.card.bullets.join(". ")}`}
              />
            </View>

            {/* Price Numbers Highlight */}
            {insight.numbers && (
              <View style={styles.priceRow}>
                {insight.numbers.mandi_modal_kg !== undefined && (
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>{t("price.mandiPrice")}</Text>
                    <Text style={styles.priceValue}>
                      ₹{insight.numbers.mandi_modal_kg}/kg
                    </Text>
                  </View>
                )}

                {insight.numbers.retail_kg !== undefined && (
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>{t("price.retailPrice")}</Text>
                    <Text style={styles.retailValue}>
                      ₹{insight.numbers.retail_kg}/kg
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Bullets & Insights */}
            <View style={styles.bulletsList}>
              {insight.card.bullets.map((bullet, idx) => (
                <View key={idx} style={styles.bulletItem}>
                  <Text style={styles.bulletIcon}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Ask About Crop Action Button */}
          <TouchableOpacity
            style={styles.askButton}
            onPress={handleAskAboutCrop}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.askButtonIcon}>💬</Text>
            <Text style={styles.askButtonText}>{t("price.askAboutCrop")}</Text>
          </TouchableOpacity>

          {/* Provenance & Sources */}
          {insight.provenance.length > 0 && (
            <View style={styles.provenanceBox}>
              <Text style={styles.provenanceTitle}>{t("price.provenance")}:</Text>
              {insight.provenance.map((prov, i) => (
                <Text key={i} style={styles.provenanceItem}>
                  {prov.label} ({prov.source}) - {t("common.lastUpdated", { time: prov.as_of })}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  centerBox: {
    padding: theme.spacing.xxl,
    alignItems: "center",
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.danger,
  },
  cardContainer: {
    gap: theme.spacing.md,
  },
  staleBanner: {
    backgroundColor: theme.colors.surfaceTint,
    borderColor: theme.colors.warning,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
  },
  staleText: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    fontWeight: "600",
  },
  insightCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  cardHeadline: {
    ...theme.typography.heading,
    color: theme.colors.text,
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    justifyContent: "space-around",
  },
  priceItem: {
    alignItems: "center",
  },
  priceLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  priceValue: {
    ...theme.typography.price,
    color: theme.colors.primaryStrong,
    marginTop: theme.spacing.xs,
  },
  retailValue: {
    ...theme.typography.price,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  bulletsList: {
    gap: theme.spacing.sm,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.xs,
  },
  bulletIcon: {
    fontSize: 18,
    color: theme.colors.primaryStrong,
    lineHeight: 24,
  },
  bulletText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  askButton: {
    minHeight: theme.minTouchTarget,
    backgroundColor: theme.colors.primaryStrong,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  askButtonIcon: {
    fontSize: 20,
  },
  askButtonText: {
    ...theme.typography.label,
    color: theme.colors.surface,
  },
  provenanceBox: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderColor: theme.colors.border,
    borderWidth: 1,
    gap: theme.spacing.xs,
  },
  provenanceTitle: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  provenanceItem: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
});
