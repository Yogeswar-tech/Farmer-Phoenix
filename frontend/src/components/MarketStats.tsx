import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  TrendingUp,
  TrendingDown,
  Truck,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react-native";
import { CommodityRecord, MarketMoversData } from "@/data/mockMandiData";
import { terminalColors, terminalFonts } from "@/theme/terminalTheme";

interface MarketStatsProps {
  movers: MarketMoversData;
  onSelectCommodity?: (commodity: CommodityRecord) => void;
}

export const MarketStats: React.FC<MarketStatsProps> = ({
  movers,
  onSelectCommodity,
}) => {
  const { topGainer, topCrash, highestArrival, compositeIndex } = movers;

  return (
    <View style={styles.gridContainer}>
      {/* 1. TOP GAINER */}
      <Pressable
        onPress={() => onSelectCommodity?.(topGainer)}
        style={({ pressed }) => [
          styles.kpiCard,
          styles.cardGainerBorder,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.badgeGainer}>
            <TrendingUp size={12} color={terminalColors.bullish} />
            <Text style={styles.badgeGainerText}>TOP GAINER</Text>
          </View>
          <ArrowUpRight size={14} color={terminalColors.bullish} />
        </View>

        <View style={styles.commodityRow}>
          <Text style={styles.commodityIcon}>{topGainer.icon}</Text>
          <View style={styles.commodityDetails}>
            <Text style={styles.commodityName}>{topGainer.name}</Text>
            <Text style={styles.varietyText} numberOfLines={1}>
              {topGainer.variety}
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceMain}>
              ₹{topGainer.modalPriceKg}
              <Text style={styles.priceUnit}>/kg</Text>
            </Text>
            <Text style={styles.subPrice}>₹{topGainer.modalPriceQtl}/qtl</Text>
          </View>
          <View style={styles.pillGain}>
            <Text style={styles.pillGainText}>+{topGainer.change24h}%</Text>
          </View>
        </View>
      </Pressable>

      {/* 2. TOP DROP / CRASH */}
      <Pressable
        onPress={() => onSelectCommodity?.(topCrash)}
        style={({ pressed }) => [
          styles.kpiCard,
          styles.cardCrashBorder,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.badgeCrash}>
            <TrendingDown size={12} color={terminalColors.bearish} />
            <Text style={styles.badgeCrashText}>TOP DROP</Text>
          </View>
          <ArrowDownRight size={14} color={terminalColors.bearish} />
        </View>

        <View style={styles.commodityRow}>
          <Text style={styles.commodityIcon}>{topCrash.icon}</Text>
          <View style={styles.commodityDetails}>
            <Text style={styles.commodityName}>{topCrash.name}</Text>
            <Text style={styles.varietyText} numberOfLines={1}>
              {topCrash.variety}
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceMain}>
              ₹{topCrash.modalPriceKg}
              <Text style={styles.priceUnit}>/kg</Text>
            </Text>
            <Text style={styles.subPrice}>₹{topCrash.modalPriceQtl}/qtl</Text>
          </View>
          <View style={styles.pillLoss}>
            <Text style={styles.pillLossText}>{topCrash.change24h}%</Text>
          </View>
        </View>
      </Pressable>

      {/* 3. SUPPLY ARRIVAL LEADER */}
      <Pressable
        onPress={() => onSelectCommodity?.(highestArrival)}
        style={({ pressed }) => [
          styles.kpiCard,
          styles.cardArrivalBorder,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.badgeArrival}>
            <Truck size={12} color={terminalColors.cyan} />
            <Text style={styles.badgeArrivalText}>PEAK ARRIVALS</Text>
          </View>
          <Text style={styles.arrivalStatusTag}>HEAVY SUPPLY</Text>
        </View>

        <View style={styles.commodityRow}>
          <Text style={styles.commodityIcon}>{highestArrival.icon}</Text>
          <View style={styles.commodityDetails}>
            <Text style={styles.commodityName}>{highestArrival.name}</Text>
            <Text style={styles.varietyText}>
              ₹{highestArrival.modalPriceKg}/kg (stable)
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceCyan}>
              {highestArrival.arrivalTons}
              <Text style={styles.priceUnit}> Tons</Text>
            </Text>
            <Text style={styles.subPrice}>
              {highestArrival.arrivalQuintals.toLocaleString()} Quintals
            </Text>
          </View>
          <View style={styles.pillArrival}>
            <Text style={styles.pillArrivalText}>#1 Volume</Text>
          </View>
        </View>
      </Pressable>

      {/* 4. MANDI PRODUCE INDEX */}
      <View style={[styles.kpiCard, styles.cardIndexBorder]}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeIndex}>
            <Activity size={12} color={terminalColors.amber} />
            <Text style={styles.badgeIndexText}>{compositeIndex.name}</Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>REALTIME</Text>
          </View>
        </View>

        <View style={styles.indexMainRow}>
          <View>
            <Text style={styles.indexPrice}>
              ₹{compositeIndex.value}
              <Text style={styles.priceUnit}> avg/kg</Text>
            </Text>
            <Text style={styles.subPrice}>
              Weighted basket of 20 veggies
            </Text>
          </View>
          <View
            style={[
              styles.pillBase,
              compositeIndex.change24h >= 0 ? styles.pillGain : styles.pillLoss,
            ]}
          >
            <Text
              style={[
                styles.indexDeltaText,
                compositeIndex.change24h >= 0
                  ? styles.pillGainText
                  : styles.pillLossText,
              ]}
            >
              {compositeIndex.change24h >= 0 ? "+" : ""}
              {compositeIndex.change24h}%
            </Text>
          </View>
        </View>

        <View style={styles.indexFooter}>
          <Text style={styles.indexFooterText}>
            Market Vol: {compositeIndex.totalArrivalTons} Tons across India
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: terminalColors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: terminalColors.border,
    padding: 12,
    justifyContent: "space-between",
  },
  cardPressed: {
    backgroundColor: "#191920",
  },
  cardGainerBorder: {
    borderLeftWidth: 3,
    borderLeftColor: terminalColors.bullish,
  },
  cardCrashBorder: {
    borderLeftWidth: 3,
    borderLeftColor: terminalColors.bearish,
  },
  cardArrivalBorder: {
    borderLeftWidth: 3,
    borderLeftColor: terminalColors.cyan,
  },
  cardIndexBorder: {
    borderLeftWidth: 3,
    borderLeftColor: terminalColors.amber,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeGainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: terminalColors.bullishBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGainerText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    fontWeight: "700",
    color: terminalColors.bullish,
  },
  badgeCrash: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: terminalColors.bearishBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCrashText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    fontWeight: "700",
    color: terminalColors.bearish,
  },
  badgeArrival: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: terminalColors.cyanBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeArrivalText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    fontWeight: "700",
    color: terminalColors.cyan,
  },
  badgeIndex: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: terminalColors.amberBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeIndexText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    fontWeight: "700",
    color: terminalColors.amber,
  },
  arrivalStatusTag: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
    fontWeight: "600",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: terminalColors.amber,
  },
  liveText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.amber,
    fontWeight: "700",
  },
  commodityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  commodityIcon: {
    fontSize: 22,
  },
  commodityDetails: {
    flex: 1,
  },
  commodityName: {
    fontFamily: terminalFonts.sans,
    fontSize: 14,
    fontWeight: "700",
    color: terminalColors.text,
  },
  varietyText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 6,
  },
  priceMain: {
    fontFamily: terminalFonts.mono,
    fontSize: 16,
    fontWeight: "800",
    color: terminalColors.text,
  },
  priceCyan: {
    fontFamily: terminalFonts.mono,
    fontSize: 16,
    fontWeight: "800",
    color: terminalColors.cyan,
  },
  priceUnit: {
    fontSize: 11,
    color: terminalColors.textMuted,
    fontWeight: "500",
  },
  subPrice: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
    marginTop: 1,
  },
  pillBase: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pillGain: {
    backgroundColor: terminalColors.bullishBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pillGainText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    fontWeight: "800",
    color: terminalColors.bullish,
  },
  pillLoss: {
    backgroundColor: terminalColors.bearishBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pillLossText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    fontWeight: "800",
    color: terminalColors.bearish,
  },
  pillArrival: {
    backgroundColor: terminalColors.cyanBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pillArrivalText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    fontWeight: "800",
    color: terminalColors.cyan,
  },
  indexMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 4,
  },
  indexPrice: {
    fontFamily: terminalFonts.mono,
    fontSize: 16,
    fontWeight: "800",
    color: terminalColors.amber,
  },
  indexDeltaText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    fontWeight: "800",
  },
  indexFooter: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: terminalColors.borderSubtle,
    paddingTop: 4,
  },
  indexFooterText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
  },
});
