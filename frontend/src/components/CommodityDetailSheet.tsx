import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Polyline,
  Polygon,
  Stop,
  Circle,
  Line,
} from "react-native-svg";
import {
  X,
  TrendingUp,
  TrendingDown,
  Sparkles,
  MapPin,
} from "lucide-react-native";
import { CommodityRecord } from "@/data/mockMandiData";
import { terminalColors, terminalFonts } from "@/theme/terminalTheme";

interface CommodityDetailSheetProps {
  commodity: CommodityRecord | null;
  onClose: () => void;
  onAskAi: (commodity: CommodityRecord, customPrompt?: string) => void;
  activeMandiName: string;
}

type Timeframe = "7D" | "14D" | "30D";

export const CommodityDetailSheet: React.FC<CommodityDetailSheetProps> = ({
  commodity,
  onClose,
  onAskAi,
  activeMandiName,
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>("14D");

  if (!commodity) return null;

  const isUp = commodity.change24h >= 0;

  // Chart data based on timeframe
  const historyData =
    timeframe === "7D"
      ? commodity.history14d.slice(-7)
      : timeframe === "14D"
      ? commodity.history14d
      : commodity.history30d;

  const prices = historyData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // Chart geometry
  const chartWidth = 460;
  const chartHeight = 160;
  const paddingX = 20;
  const paddingY = 24;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;

  const points = historyData.map((d, i) => {
    const x = paddingX + (i / (historyData.length - 1)) * plotWidth;
    const y =
      chartHeight -
      paddingY -
      ((d.price - minPrice) / priceRange) * plotHeight;
    return `${x},${y}`;
  });

  const pointsString = points.join(" ");
  const areaString = `${paddingX},${chartHeight} ${pointsString} ${chartWidth - paddingX},${chartHeight}`;

  return (
    <Modal
      visible={!!commodity}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleGroup}>
              <Text style={styles.commodityIcon}>{commodity.icon}</Text>
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.commodityName}>{commodity.name}</Text>
                  <Text style={styles.hindiName}>({commodity.hindiName})</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {commodity.category}
                    </Text>
                  </View>
                </View>
                <Text style={styles.varietySubtitle}>
                  Variety: {commodity.variety} • Active: {activeMandiName}
                </Text>
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={20} color={terminalColors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Price Banner */}
            <View style={styles.priceBanner}>
              <View>
                <Text style={styles.currentRateLabel}>MODAL APMC RATE</Text>
                <View style={styles.modalRateRow}>
                  <Text style={styles.priceBig}>₹{commodity.modalPriceKg}</Text>
                  <Text style={styles.priceBigUnit}>/kg</Text>
                  <View
                    style={[
                      styles.deltaBadge,
                      isUp ? styles.deltaBadgeUp : styles.deltaBadgeDown,
                    ]}
                  >
                    {isUp ? (
                      <TrendingUp size={13} color={terminalColors.bullish} />
                    ) : (
                      <TrendingDown size={13} color={terminalColors.bearish} />
                    )}
                    <Text
                      style={[
                        styles.deltaText,
                        isUp ? styles.deltaTextUp : styles.deltaTextDown,
                      ]}
                    >
                      {isUp ? "+" : ""}
                      {commodity.change24h}% (₹{commodity.changeAmount}/kg)
                    </Text>
                  </View>
                </View>
                <Text style={styles.qtlSubtitle}>
                  ₹{commodity.modalPriceQtl.toLocaleString()} per Quintal
                </Text>
              </View>

              <Pressable
                onPress={() => onAskAi(commodity)}
                style={styles.askAiButton}
              >
                <Sparkles size={14} color="#09090b" />
                <Text style={styles.askAiButtonText}>Ask AI Analyst</Text>
              </Pressable>
            </View>

            {/* Timeframe Selector & Chart Panel */}
            <View style={styles.chartPanel}>
              <View style={styles.chartControlsRow}>
                <View style={styles.chartTitleRow}>
                  <Text style={styles.chartTitle}>PRICE OSCILLATOR</Text>
                  <Text style={styles.chartRangeTag}>
                    High: ₹{maxPrice} | Low: ₹{minPrice}
                  </Text>
                </View>

                <View style={styles.timeframeTabs}>
                  {(["7D", "14D", "30D"] as Timeframe[]).map((tf) => (
                    <Pressable
                      key={tf}
                      onPress={() => setTimeframe(tf)}
                      style={[
                        styles.timeframeTab,
                        timeframe === tf && styles.timeframeTabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeframeTabText,
                          timeframe === tf && styles.timeframeTabTextActive,
                        ]}
                      >
                        {tf}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Chart SVG */}
              <View style={styles.svgWrapper}>
                <Svg
                  width="100%"
                  height={chartHeight}
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                >
                  <Defs>
                    <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop
                        offset="0%"
                        stopColor={isUp ? terminalColors.bullish : terminalColors.bearish}
                        stopOpacity="0.3"
                      />
                      <Stop
                        offset="100%"
                        stopColor={isUp ? terminalColors.bullish : terminalColors.bearish}
                        stopOpacity="0.0"
                      />
                    </LinearGradient>
                  </Defs>

                  {/* Horizontal grid guide lines */}
                  <Line
                    x1={paddingX}
                    y1={paddingY}
                    x2={chartWidth - paddingX}
                    y2={paddingY}
                    stroke={terminalColors.borderSubtle}
                    strokeDasharray="4 4"
                  />
                  <Line
                    x1={paddingX}
                    y1={chartHeight / 2}
                    x2={chartWidth - paddingX}
                    y2={chartHeight / 2}
                    stroke={terminalColors.borderSubtle}
                    strokeDasharray="4 4"
                  />
                  <Line
                    x1={paddingX}
                    y1={chartHeight - paddingY}
                    x2={chartWidth - paddingX}
                    y2={chartHeight - paddingY}
                    stroke={terminalColors.borderSubtle}
                    strokeDasharray="4 4"
                  />

                  {/* Area gradient */}
                  <Polygon points={areaString} fill="url(#chartGrad)" />

                  {/* Main line */}
                  <Polyline
                    points={pointsString}
                    fill="none"
                    stroke={isUp ? terminalColors.bullish : terminalColors.bearish}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data point dots */}
                  {points.map((pt, idx) => {
                    const [px, py] = pt.split(",").map(Number);
                    return (
                      <Circle
                        key={idx}
                        cx={px}
                        cy={py}
                        r={idx === points.length - 1 ? 4 : 2}
                        fill={isUp ? terminalColors.bullish : terminalColors.bearish}
                      />
                    );
                  })}
                </Svg>
              </View>

              {/* Date ticks */}
              <View style={styles.dateTicksRow}>
                <Text style={styles.dateTickText}>{historyData[0]?.date}</Text>
                <Text style={styles.dateTickText}>
                  {historyData[Math.floor(historyData.length / 2)]?.date}
                </Text>
                <Text style={styles.dateTickText}>
                  {historyData[historyData.length - 1]?.date} (Today)
                </Text>
              </View>
            </View>

            {/* Key Market Metrics 4-Box */}
            <View style={styles.metricsBox}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>24H LOW / HIGH</Text>
                <Text style={styles.metricVal}>
                  ₹{commodity.minPriceKg} - ₹{commodity.maxPriceKg}
                  <Text style={styles.metricValUnit}>/kg</Text>
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>MARKET ARRIVALS</Text>
                <Text style={styles.metricValCyan}>
                  {commodity.arrivalTons} Tons
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>SUPPLY VOLUME</Text>
                <Text style={styles.metricValAmber}>
                  {commodity.volumeStatus}
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>LAST REPORTED</Text>
                <Text style={styles.metricValMuted}>{commodity.asOf}</Text>
              </View>
            </View>

            {/* Neighbouring Mandis Price Arbitrage Comparison */}
            <View style={styles.nearbySection}>
              <View style={styles.nearbyHeaderRow}>
                <MapPin size={15} color={terminalColors.amber} />
                <Text style={styles.nearbySectionTitle}>
                  REGIONAL MANDI PRICE ARBITRAGE (SAME VEGETABLE)
                </Text>
              </View>
              <Text style={styles.nearbySectionSub}>
                Price comparison across closest district APMC yards & Rythu Bazars
              </Text>

              <View style={styles.nearbyTable}>
                {commodity.nearbyMandis.map((nm, idx) => {
                  const isCheaper = nm.spread < 0;
                  return (
                    <View key={idx} style={styles.nearbyRow}>
                      <View style={styles.nearbyMandiInfo}>
                        <Text style={styles.nearbyMandiName}>
                          {nm.mandiName}
                        </Text>
                        <Text style={styles.nearbyDist}>
                          {nm.district} • ~{nm.distKm} km away
                        </Text>
                      </View>

                      <View style={styles.nearbyPriceGroup}>
                        <Text style={styles.nearbyPriceKg}>
                          ₹{nm.pricePerKg}
                          <Text style={styles.nearbyPriceUnit}>/kg</Text>
                        </Text>
                        <View
                          style={[
                            styles.spreadBadge,
                            isCheaper ? styles.spreadCheaper : styles.spreadCostlier,
                          ]}
                        >
                          <Text
                            style={[
                              styles.spreadText,
                              isCheaper ? styles.spreadTextCheaper : styles.spreadTextCostlier,
                            ]}
                          >
                            {isCheaper
                              ? `₹${Math.abs(nm.spread)} cheaper`
                              : nm.spread === 0
                              ? "same price"
                              : `₹${nm.spread} higher`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Quick AI Prompts */}
            <View style={styles.aiPromptsSection}>
              <Text style={styles.aiPromptsTitle}>
                INSTANT AI MARKET QUESTIONS FOR {commodity.name.toUpperCase()}
              </Text>
              <View style={styles.aiChipsList}>
                <Pressable
                  onPress={() =>
                    onAskAi(
                      commodity,
                      `Why did ${commodity.name} prices change by ${commodity.change24h}% today?`
                    )
                  }
                  style={styles.promptChip}
                >
                  <Text style={styles.promptChipText}>
                    Why did {commodity.name} price shift today? ➔
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    onAskAi(
                      commodity,
                      `Where can I buy ${commodity.name} cheapest near ${activeMandiName}?`
                    )
                  }
                  style={styles.promptChip}
                >
                  <Text style={styles.promptChipText}>
                    Find cheapest {commodity.name} within 50 km ➔
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    onAskAi(
                      commodity,
                      `Forecast 3-day supply arrival & price trend for ${commodity.name}.`
                    )
                  }
                  style={styles.promptChip}
                >
                  <Text style={styles.promptChipText}>
                    Forecast 3-day supply and price trend ➔
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: terminalColors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: terminalColors.border,
    maxHeight: "90%",
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: terminalColors.border,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  commodityIcon: {
    fontSize: 28,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  commodityName: {
    fontFamily: terminalFonts.sans,
    fontSize: 18,
    fontWeight: "800",
    color: terminalColors.text,
  },
  hindiName: {
    fontFamily: terminalFonts.mono,
    fontSize: 14,
    color: terminalColors.textMuted,
  },
  categoryBadge: {
    backgroundColor: "#202028",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.amber,
    fontWeight: "700",
  },
  varietySubtitle: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    color: terminalColors.textMuted,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    backgroundColor: "#1c1c22",
    borderRadius: 20,
  },
  sheetBody: {
    padding: 16,
  },
  priceBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#16161b",
    borderWidth: 1,
    borderColor: terminalColors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 10,
  },
  currentRateLabel: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  modalRateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  priceBig: {
    fontFamily: terminalFonts.mono,
    fontSize: 26,
    fontWeight: "900",
    color: terminalColors.text,
  },
  priceBigUnit: {
    fontFamily: terminalFonts.mono,
    fontSize: 14,
    color: terminalColors.textMuted,
  },
  deltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  deltaBadgeUp: {
    backgroundColor: terminalColors.bullishBg,
  },
  deltaBadgeDown: {
    backgroundColor: terminalColors.bearishBg,
  },
  deltaText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    fontWeight: "800",
  },
  deltaTextUp: {
    color: terminalColors.bullish,
  },
  deltaTextDown: {
    color: terminalColors.bearish,
  },
  qtlSubtitle: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    color: terminalColors.textMuted,
    marginTop: 2,
  },
  askAiButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: terminalColors.amber,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  askAiButtonText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    fontWeight: "800",
    color: "#09090b",
  },
  chartPanel: {
    backgroundColor: "#141418",
    borderWidth: 1,
    borderColor: terminalColors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  chartControlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  chartTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chartTitle: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    fontWeight: "800",
    color: terminalColors.textSecondary,
    letterSpacing: 0.5,
  },
  chartRangeTag: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
  },
  timeframeTabs: {
    flexDirection: "row",
    backgroundColor: "#1b1b22",
    borderRadius: 4,
    padding: 2,
    gap: 2,
  },
  timeframeTab: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  timeframeTabActive: {
    backgroundColor: terminalColors.amber,
  },
  timeframeTabText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
    fontWeight: "700",
  },
  timeframeTabTextActive: {
    color: "#09090b",
  },
  svgWrapper: {
    width: "100%",
    alignItems: "center",
    overflow: "hidden",
  },
  dateTicksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: terminalColors.borderSubtle,
    paddingTop: 4,
  },
  dateTickText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
  },
  metricsBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#16161b",
    borderWidth: 1,
    borderColor: terminalColors.border,
    borderRadius: 6,
    padding: 10,
  },
  metricLabel: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
    fontWeight: "700",
  },
  metricVal: {
    fontFamily: terminalFonts.mono,
    fontSize: 14,
    fontWeight: "800",
    color: terminalColors.text,
    marginTop: 2,
  },
  metricValUnit: {
    fontSize: 10,
    color: terminalColors.textMuted,
  },
  metricValCyan: {
    fontFamily: terminalFonts.mono,
    fontSize: 14,
    fontWeight: "800",
    color: terminalColors.cyan,
    marginTop: 2,
  },
  metricValAmber: {
    fontFamily: terminalFonts.mono,
    fontSize: 14,
    fontWeight: "800",
    color: terminalColors.amber,
    marginTop: 2,
  },
  metricValMuted: {
    fontFamily: terminalFonts.mono,
    fontSize: 12,
    color: terminalColors.textSecondary,
    marginTop: 2,
  },
  nearbySection: {
    backgroundColor: "#141418",
    borderWidth: 1,
    borderColor: terminalColors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  nearbyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nearbySectionTitle: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    fontWeight: "800",
    color: terminalColors.amber,
    letterSpacing: 0.5,
  },
  nearbySectionSub: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
    marginTop: 2,
    marginBottom: 10,
  },
  nearbyTable: {
    gap: 8,
  },
  nearbyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#191920",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: terminalColors.borderSubtle,
  },
  nearbyMandiInfo: {
    flex: 1,
  },
  nearbyMandiName: {
    fontFamily: terminalFonts.sans,
    fontSize: 13,
    fontWeight: "600",
    color: terminalColors.text,
  },
  nearbyDist: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
  },
  nearbyPriceGroup: {
    alignItems: "flex-end",
  },
  nearbyPriceKg: {
    fontFamily: terminalFonts.mono,
    fontSize: 14,
    fontWeight: "800",
    color: terminalColors.text,
  },
  nearbyPriceUnit: {
    fontSize: 10,
    color: terminalColors.textMuted,
  },
  spreadBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  spreadCheaper: {
    backgroundColor: terminalColors.bullishBg,
  },
  spreadCostlier: {
    backgroundColor: terminalColors.bearishBg,
  },
  spreadText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    fontWeight: "700",
  },
  spreadTextCheaper: {
    color: terminalColors.bullish,
  },
  spreadTextCostlier: {
    color: terminalColors.bearish,
  },
  aiPromptsSection: {
    backgroundColor: "#16161b",
    borderWidth: 1,
    borderColor: terminalColors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  aiPromptsTitle: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    fontWeight: "800",
    color: terminalColors.cyan,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  aiChipsList: {
    gap: 6,
  },
  promptChip: {
    backgroundColor: "#1e1e26",
    borderWidth: 1,
    borderColor: terminalColors.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  promptChipText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    color: terminalColors.text,
  },
});
