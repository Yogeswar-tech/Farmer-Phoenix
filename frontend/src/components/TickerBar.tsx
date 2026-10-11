import React, { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { CommodityRecord } from "@/data/mockMandiData";
import { terminalColors, terminalFonts } from "@/theme/terminalTheme";

interface TickerBarProps {
  commodities: CommodityRecord[];
  activeMandiName: string;
  onSelectCommodity?: (commodity: CommodityRecord) => void;
}

export const TickerBar: React.FC<TickerBarProps> = ({
  commodities,
  activeMandiName,
  onSelectCommodity,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const scrollX = useSharedValue(0);

  // Approximate width per ticker item
  const itemWidth = 240;
  const totalWidth = commodities.length * itemWidth;

  useEffect(() => {
    if (!isPaused) {
      scrollX.value = 0;
      scrollX.value = withRepeat(
        withTiming(-totalWidth, {
          duration: 35000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      cancelAnimation(scrollX);
    }

    return () => {
      cancelAnimation(scrollX);
    };
  }, [isPaused, totalWidth, scrollX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrollX.value }],
  }));

  const handlePressIn = () => {
    setIsPaused(true);
  };

  const handlePressOut = () => {
    setIsPaused(false);
  };

  // We repeat the array twice for seamless continuous looping
  const displayItems = [...commodities, ...commodities];

  return (
    <View style={styles.container}>
      <View style={styles.liveTagContainer}>
        <View style={styles.pulseDot} />
        <Text style={styles.liveTagText}>MANDI FEED</Text>
      </View>

      <View
        style={styles.marqueeViewport}
        // @ts-expect-error - web hover support
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <Animated.View style={[styles.tickerTrack, animatedStyle]}>
          {displayItems.map((item, index) => {
            const isPositive = item.change24h >= 0;
            return (
              <Pressable
                key={`${item.id}-${index}`}
                onPress={() => onSelectCommodity?.(item)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={({ pressed }) => [
                  styles.tickerItem,
                  pressed && styles.tickerItemPressed,
                ]}
              >
                <Text style={styles.commodityIcon}>{item.icon}</Text>
                <Text style={styles.commodityName}>{item.name.toUpperCase()}</Text>
                <Text style={styles.priceText}>
                  ₹{item.modalPriceKg}
                  <Text style={styles.unitText}>/kg</Text>
                </Text>
                <View
                  style={[
                    styles.changeBadge,
                    isPositive ? styles.gainBadge : styles.lossBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.changeText,
                      isPositive ? styles.gainText : styles.lossText,
                    ]}
                  >
                    {isPositive ? "▲" : "▼"} {Math.abs(item.change24h)}%
                  </Text>
                </View>
                <Text style={styles.mandiTag}>
                  {activeMandiName.split(" ")[0]}
                </Text>
                <Text style={styles.divider}>|</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    backgroundColor: terminalColors.card,
    borderBottomWidth: 1,
    borderBottomColor: terminalColors.border,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  liveTagContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: "100%",
    backgroundColor: "#16161a",
    borderRightWidth: 1,
    borderRightColor: terminalColors.border,
    zIndex: 10,
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: terminalColors.bullish,
  },
  liveTagText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    fontWeight: "700",
    color: terminalColors.textSecondary,
    letterSpacing: 0.8,
  },
  marqueeViewport: {
    flex: 1,
    height: "100%",
    overflow: "hidden",
    justifyContent: "center",
  },
  tickerTrack: {
    flexDirection: "row",
    alignItems: "center",
  },
  tickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  tickerItemPressed: {
    opacity: 0.7,
  },
  commodityIcon: {
    fontSize: 14,
  },
  commodityName: {
    fontFamily: terminalFonts.mono,
    fontSize: 12,
    fontWeight: "600",
    color: terminalColors.text,
  },
  priceText: {
    fontFamily: terminalFonts.mono,
    fontSize: 12,
    fontWeight: "700",
    color: terminalColors.text,
  },
  unitText: {
    fontSize: 10,
    color: terminalColors.textMuted,
    fontWeight: "400",
  },
  changeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  gainBadge: {
    backgroundColor: terminalColors.bullishBg,
  },
  lossBadge: {
    backgroundColor: terminalColors.bearishBg,
  },
  changeText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    fontWeight: "700",
  },
  gainText: {
    color: terminalColors.bullish,
  },
  lossText: {
    color: terminalColors.bearish,
  },
  mandiTag: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
  },
  divider: {
    color: terminalColors.border,
    fontSize: 12,
    marginLeft: 6,
  },
});
