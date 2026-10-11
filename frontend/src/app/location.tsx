import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { setRegionId } from "@/lib/storage";
import { resolveRegion } from "@/lib/api";
import { theme } from "@/theme";

const POPULAR_REGIONS = [
  { id: "reg_chennai_01", name: "Chennai / Koyambedu", state: "Tamil Nadu" },
  { id: "reg_dindigul_01", name: "Dindigul / Oddanchatram", state: "Tamil Nadu" },
  { id: "reg_pune_01", name: "Pune APMC", state: "Maharashtra" },
  { id: "reg_nashik_01", name: "Nashik / Lasalgaon", state: "Maharashtra" },
  { id: "reg_kolar_01", name: "Kolar Mandi", state: "Karnataka" },
  { id: "reg_delhi_01", name: "Delhi / Azadpur", state: "Delhi" },
];

export default function LocationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [detecting, setDetecting] = useState(false);

  const handleSelectRegion = async (id: string) => {
    await setRegionId(id);
    router.replace("/crops" as Href);
  };

  const handleAutoDetect = async () => {
    setDetecting(true);
    try {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const res = await resolveRegion(
                position.coords.latitude,
                position.coords.longitude
              );
              await handleSelectRegion(res.region_id);
            } catch {
              await handleSelectRegion("reg_chennai_01");
            } finally {
              setDetecting(false);
            }
          },
          async () => {
            await handleSelectRegion("reg_chennai_01");
            setDetecting(false);
          }
        );
      } else {
        await handleSelectRegion("reg_chennai_01");
        setDetecting(false);
      }
    } catch {
      await handleSelectRegion("reg_chennai_01");
      setDetecting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t("location.title")}</Text>

      <TouchableOpacity
        style={styles.gpsButton}
        onPress={handleAutoDetect}
        disabled={detecting}
        activeOpacity={0.7}
      >
        {detecting ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <>
            <Text style={styles.gpsIcon}>📍</Text>
            <Text style={styles.gpsText}>{t("location.autoDetect")}</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>{t("location.popularRegions")}</Text>

      <View style={styles.list}>
        {POPULAR_REGIONS.map((region) => (
          <TouchableOpacity
            key={region.id}
            style={styles.regionCard}
            onPress={() => handleSelectRegion(region.id)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.regionName}>{region.name}</Text>
              <Text style={styles.regionState}>{region.state}</Text>
            </View>
            <Text style={styles.arrowIcon}>➔</Text>
          </TouchableOpacity>
        ))}
      </View>
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
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
  },
  gpsButton: {
    minHeight: theme.minTouchTarget,
    backgroundColor: theme.colors.surfaceTint,
    borderColor: theme.colors.primaryStrong,
    borderWidth: 2,
    borderRadius: theme.radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  gpsIcon: {
    fontSize: 20,
  },
  gpsText: {
    ...theme.typography.label,
    color: theme.colors.primaryStrong,
  },
  sectionHeader: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  list: {
    gap: theme.spacing.md,
  },
  regionCard: {
    minHeight: theme.minTouchTarget,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  regionName: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  regionState: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  arrowIcon: {
    fontSize: 18,
    color: theme.colors.primaryStrong,
  },
});
