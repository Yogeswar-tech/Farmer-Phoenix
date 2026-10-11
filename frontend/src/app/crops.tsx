import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getCrops } from "@/lib/api";
import { Crop } from "@/lib/types";
import { theme } from "@/theme";

const CROP_ICONS: Record<string, string> = {
  tomato: "🍅",
  onion: "🧅",
  potato: "🥔",
  brinjal: "🍆",
  chilli: "🌶️",
  cabbage: "🥬",
  cauliflower: "🥦",
  carrot: "🥕",
  garlic: "🧄",
  ginger: "🫚",
  bhindi: "🌱",
  matar: "🫛",
  capsicum: "🫑",
  cucumber: "🥒",
  bottlegourd: "🍈",
  bittergourd: "🥒",
  palak: "🍃",
  lemon: "🍋",
  coriander: "🌿",
  beetroot: "🫐",
};

export default function CropsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchCrops() {
      try {
        setLoading(true);
        setError(false);
        const data = await getCrops(i18n.language);
        if (isMounted) {
          setCrops(data);
        }
      } catch {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchCrops();
    return () => {
      isMounted = false;
    };
  }, [i18n.language]);

  const handleSelectCrop = (cropId: string) => {
    router.push(`/price/${cropId}` as Href);
  };

  const handleOpenAsk = () => {
    router.push("/ask" as Href);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Ask Mandi Mitra Prominent Banner */}
      <TouchableOpacity
        style={styles.askBanner}
        onPress={handleOpenAsk}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <View style={styles.askBannerContent}>
          <Text style={styles.askIcon}>🤖</Text>
          <View style={styles.askBannerTextWrapper}>
            <Text style={styles.askBannerTitle}>{t("crops.askBanner")}</Text>
            <Text style={styles.askBannerButtonText}>{t("crops.askButton")} ➔</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Terminal Mode Switch Banner */}
      <TouchableOpacity
        style={styles.terminalBanner}
        onPress={() => router.push("/terminal" as Href)}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <View style={styles.terminalBannerContent}>
          <Text style={styles.terminalIcon}>📊</Text>
          <View style={styles.terminalBannerTextWrapper}>
            <Text style={styles.terminalBannerTitle}>Trading Terminal View</Text>
            <Text style={styles.terminalBannerSub}>Live 20-Crop Ticker, Sparklines & Arbitrage ➔</Text>
          </View>
        </View>
      </TouchableOpacity>

      <Text style={styles.title}>{t("crops.title")}</Text>

      {loading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryStrong} />
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{t("common.error")}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => setCrops([])}
            activeOpacity={0.7}
          >
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <View style={styles.grid}>
          {crops.map((crop) => (
            <TouchableOpacity
              key={crop.id}
              style={styles.cropCard}
              onPress={() => handleSelectCrop(crop.id)}
              activeOpacity={0.7}
            >
              {crop.image ? (
                <Image
                  source={{ uri: crop.image }}
                  style={styles.cropImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.cropIconFallback}>
                  <Text style={styles.cropEmoji}>
                    {CROP_ICONS[crop.id.toLowerCase()] || "🌱"}
                  </Text>
                </View>
              )}
              <View style={styles.cropInfo}>
                <Text style={styles.cropName}>{crop.name}</Text>
                <Text style={styles.viewPriceLink}>{t("screens.price")} ➔</Text>
              </View>
            </TouchableOpacity>
          ))}
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
  askBanner: {
    backgroundColor: theme.colors.surfaceTint,
    borderColor: theme.colors.primaryStrong,
    borderWidth: 1.5,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  askBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  askIcon: {
    fontSize: 32,
  },
  askBannerTextWrapper: {
    flex: 1,
  },
  askBannerTitle: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.onPrimary,
  },
  askBannerButtonText: {
    ...theme.typography.label,
    color: theme.colors.primaryStrong,
    marginTop: theme.spacing.xs,
  },
  terminalBanner: {
    minHeight: theme.minTouchTarget,
    backgroundColor: "#18181b",
    borderColor: "#27272a",
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  terminalBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  terminalIcon: {
    fontSize: 28,
  },
  terminalBannerTextWrapper: {
    flex: 1,
  },
  terminalBannerTitle: {
    fontFamily: theme.fontFamily,
    fontSize: 16,
    fontWeight: "700",
    color: "#f59e0b",
  },
  terminalBannerSub: {
    fontFamily: theme.fontFamily,
    fontSize: 13,
    color: "#a1a1aa",
    marginTop: 2,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  grid: {
    gap: theme.spacing.md,
  },
  cropCard: {
    minHeight: theme.minTouchTarget,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cropImage: {
    width: 80,
    height: 80,
  },
  cropIconFallback: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cropEmoji: {
    fontSize: 36,
  },
  cropInfo: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    justifyContent: "center",
  },
  cropName: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  viewPriceLink: {
    ...theme.typography.caption,
    color: theme.colors.primaryStrong,
    marginTop: theme.spacing.xs,
    fontWeight: "600",
  },
  centerContainer: {
    padding: theme.spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.danger,
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    minHeight: theme.minTouchTarget,
    backgroundColor: theme.colors.primaryStrong,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  retryText: {
    ...theme.typography.label,
    color: theme.colors.surface,
  },
});
