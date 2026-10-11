import React, { useState, useMemo } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  Sparkles,
  RefreshCw,
  Mic,
} from "lucide-react-native";
import {
  COMMODITIES_DATA,
  CommodityRecord,
  computeMarketMovers,
  MANDI_LOCATIONS,
  MandiLocation,
} from "@/data/mockMandiData";
import { LocationHeader } from "@/components/LocationHeader";
import { TickerBar } from "@/components/TickerBar";
import { MarketStats } from "@/components/MarketStats";
import { CommodityWatchlist } from "@/components/CommodityWatchlist";
import { CommodityDetailSheet } from "@/components/CommodityDetailSheet";
import { AiAnalystSheet } from "@/components/AiAnalystSheet";
import { terminalColors, terminalFonts } from "@/theme/terminalTheme";

interface TerminalScreenProps {
  onSwitchToFarmer?: () => void;
}

export default function TerminalScreen({ onSwitchToFarmer }: TerminalScreenProps = {}) {
  const router = useRouter();

  // State
  const [activeMandi, setActiveMandi] = useState<MandiLocation>(MANDI_LOCATIONS[0]);
  const [detectedDistanceKm, setDetectedDistanceKm] = useState<number | undefined>(4.2);
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityRecord | null>(null);
  const [aiSheetVisible, setAiSheetVisible] = useState(false);
  const [initialAiPrompt, setInitialAiPrompt] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute market statistics & composite index
  const marketMovers = useMemo(() => {
    return computeMarketMovers(COMMODITIES_DATA);
  }, []);

  const handleSelectMandi = (mandi: MandiLocation, distanceKm?: number) => {
    setActiveMandi(mandi);
    if (distanceKm !== undefined) {
      setDetectedDistanceKm(distanceKm);
    }
  };

  const handleOpenAiWithCommodity = (commodity: CommodityRecord, customPrompt?: string) => {
    setSelectedCommodity(commodity);
    setInitialAiPrompt(customPrompt);
    setAiSheetVisible(true);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleGoToVoiceApp = () => {
    if (onSwitchToFarmer) {
      onSwitchToFarmer();
    } else {
      router.push("/crops" as Href);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Top Location Bar & Brand */}
      <LocationHeader
        activeMandi={activeMandi}
        onSelectMandi={handleSelectMandi}
        detectedDistanceKm={detectedDistanceKm}
      />

      {/* 60fps Infinite Marquee Ticker */}
      <TickerBar
        commodities={COMMODITIES_DATA}
        activeMandiName={activeMandi.name}
        onSelectCommodity={(c) => setSelectedCommodity(c)}
      />

      {/* Main Terminal Body */}
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Sub-header Toolbar */}
        <View style={styles.subToolbar}>
          <View style={styles.liveFeedStatus}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              AGMARKNET FEED: LIVE • 20 VEGETABLES INDEXED
            </Text>
          </View>

          <View style={styles.toolbarButtons}>
            {/* Refresh */}
            <Pressable
              onPress={handleRefresh}
              style={({ pressed }) => [
                styles.toolButton,
                pressed && styles.toolButtonPressed,
              ]}
            >
              <RefreshCw
                size={12}
                color={terminalColors.textSecondary}
              />
              <Text style={styles.toolButtonText}>
                {isRefreshing ? "SYNCING..." : "SYNC"}
              </Text>
            </Pressable>

            {/* AI Copilot Quick Button */}
            <Pressable
              onPress={() => {
                setInitialAiPrompt(undefined);
                setAiSheetVisible(true);
              }}
              style={({ pressed }) => [
                styles.aiToolButton,
                pressed && styles.toolButtonPressed,
              ]}
            >
              <Sparkles size={13} color="#09090b" />
              <Text style={styles.aiToolButtonText}>AI ANALYST</Text>
            </Pressable>

            {/* Farmer Simple Mode Switch */}
            <Pressable
              onPress={handleGoToVoiceApp}
              style={({ pressed }) => [
                styles.voiceModeButton,
                pressed && styles.toolButtonPressed,
              ]}
            >
              <Mic size={13} color={terminalColors.bullish} />
              <Text style={styles.voiceModeButtonText}>
                👨‍🌾 सरल किसान दृश्य (Farmer)
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Top Market Movers (Gainer, Crash, Arrivals, Index) */}
        <MarketStats
          movers={marketMovers}
          onSelectCommodity={(c) => setSelectedCommodity(c)}
        />

        {/* Section Title */}
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionHeadingWrapper}>
            <Text style={styles.sectionTitle}>
              APMC MANDI WATCHLIST & ARBITRAGE MATRIX
            </Text>
            <Text style={styles.sectionSubtitle}>
              Real-time wholesale modal bids, day ranges, volume arrivals & 7-day sparklines
            </Text>
          </View>

          <View style={styles.marketTimeTag}>
            <Text style={styles.marketTimeText}>
              BIDS ACTIVE: 06:00 AM - 02:00 PM IST
            </Text>
          </View>
        </View>

        {/* Mandi Watchlist Table */}
        <CommodityWatchlist
          commodities={COMMODITIES_DATA}
          onSelectCommodity={(c) => setSelectedCommodity(c)}
          selectedCommodityId={selectedCommodity?.id}
        />
      </ScrollView>

      {/* Floating AI Analyst Trigger (Mobile / Desktop) */}
      <Pressable
        onPress={() => {
          setInitialAiPrompt(undefined);
          setAiSheetVisible(true);
        }}
        style={({ pressed }) => [
          styles.floatingAiButton,
          pressed && styles.floatingAiButtonPressed,
        ]}
      >
        <Sparkles size={18} color="#09090b" />
        <Text style={styles.floatingAiButtonText}>Ask AI Analyst</Text>
      </Pressable>

      {/* Commodity Deep-Dive Modal */}
      <CommodityDetailSheet
        commodity={selectedCommodity}
        onClose={() => setSelectedCommodity(null)}
        onAskAi={handleOpenAiWithCommodity}
        activeMandiName={activeMandi.name}
      />

      {/* Vertex AI Copilot Bottom Sheet */}
      <AiAnalystSheet
        visible={aiSheetVisible}
        onClose={() => setAiSheetVisible(false)}
        selectedCommodity={selectedCommodity}
        activeMandiName={activeMandi.name}
        initialPrompt={initialAiPrompt}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: terminalColors.background,
  },
  mainScroll: {
    flex: 1,
    backgroundColor: terminalColors.background,
  },
  mainContent: {
    paddingBottom: 90,
  },
  subToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#0d0d10",
    borderBottomWidth: 1,
    borderBottomColor: terminalColors.borderSubtle,
    flexWrap: "wrap",
    gap: 8,
  },
  liveFeedStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: terminalColors.bullish,
  },
  statusText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    fontWeight: "700",
    color: terminalColors.textSecondary,
    letterSpacing: 0.5,
  },
  toolbarButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#191920",
    borderWidth: 1,
    borderColor: terminalColors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  toolButtonPressed: {
    opacity: 0.7,
  },
  toolButtonText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    fontWeight: "700",
    color: terminalColors.textSecondary,
  },
  aiToolButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: terminalColors.amber,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  aiToolButtonText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    fontWeight: "800",
    color: "#09090b",
  },
  voiceModeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: terminalColors.bullishBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  voiceModeButtonText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    fontWeight: "800",
    color: terminalColors.bullish,
  },
  sectionTitleRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 6,
  },
  sectionHeadingWrapper: {
    flex: 1,
    minWidth: 260,
  },
  sectionTitle: {
    fontFamily: terminalFonts.mono,
    fontSize: 12,
    fontWeight: "900",
    color: terminalColors.text,
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
    marginTop: 2,
  },
  marketTimeTag: {
    backgroundColor: "#18181f",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: terminalColors.borderSubtle,
  },
  marketTimeText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
    fontWeight: "700",
  },
  floatingAiButton: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: terminalColors.amber,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
  },
  floatingAiButtonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  floatingAiButtonText: {
    fontFamily: terminalFonts.mono,
    fontSize: 13,
    fontWeight: "900",
    color: "#09090b",
  },
});
