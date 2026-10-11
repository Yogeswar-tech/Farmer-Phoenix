import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react-native";
import { CommodityRecord } from "@/data/mockMandiData";
import { MiniSparkline } from "./MiniSparkline";
import { terminalColors, terminalFonts } from "@/theme/terminalTheme";

interface CommodityWatchlistProps {
  commodities: CommodityRecord[];
  onSelectCommodity: (commodity: CommodityRecord) => void;
  selectedCommodityId?: string;
}

type SortField = "name" | "price" | "change" | "volume";
type SortOrder = "asc" | "desc";

const CATEGORIES = ["All", "Essentials", "Greens", "Spices", "Gourds", "Roots"] as const;

export const CommodityWatchlist: React.FC<CommodityWatchlistProps> = ({
  commodities,
  onSelectCommodity,
  selectedCommodityId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortField, setSortField] = useState<SortField>("change");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let result = commodities.filter((c) => {
      const matchesCategory =
        selectedCategory === "All" || c.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        c.hindiName.toLowerCase().includes(q) ||
        c.variety.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });

    result = [...result].sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "price") {
        comparison = a.modalPriceKg - b.modalPriceKg;
      } else if (sortField === "change") {
        comparison = a.change24h - b.change24h;
      } else if (sortField === "volume") {
        comparison = a.arrivalTons - b.arrivalTons;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [commodities, searchQuery, selectedCategory, sortField, sortOrder]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={11} color={terminalColors.textMuted} />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={11} color={terminalColors.amber} />
    ) : (
      <ArrowDown size={11} color={terminalColors.amber} />
    );
  };

  const renderItem = ({ item }: { item: CommodityRecord }) => {
    const isSelected = selectedCommodityId === item.id;
    const isGain = item.change24h >= 0;

    // Day Range position %
    const rangeSpan = item.maxPriceKg - item.minPriceKg || 1;
    const progressPercent = Math.min(
      100,
      Math.max(
        0,
        ((item.modalPriceKg - item.minPriceKg) / rangeSpan) * 100
      )
    );

    return (
      <Pressable
        onPress={() => onSelectCommodity(item)}
        style={({ pressed }) => [
          styles.row,
          isSelected && styles.rowSelected,
          pressed && styles.rowPressed,
        ]}
      >
        {/* Col 1: Commodity & Variety */}
        <View style={styles.colCommodity}>
          <Text style={styles.commodityIcon}>{item.icon}</Text>
          <View style={styles.commodityTextGroup}>
            <View style={styles.nameHeaderRow}>
              <Text style={styles.commodityName}>{item.name}</Text>
              <Text style={styles.hindiName}>({item.hindiName})</Text>
            </View>
            <Text style={styles.varietyText} numberOfLines={1}>
              {item.variety}
            </Text>
          </View>
        </View>

        {/* Col 2: Price (₹/kg & ₹/qtl) */}
        <View style={styles.colPrice}>
          <Text style={styles.priceKg}>₹{item.modalPriceKg}</Text>
          <Text style={styles.priceQtl}>₹{item.modalPriceQtl.toLocaleString()}/qtl</Text>
        </View>

        {/* Col 3: 24h Change */}
        <View style={styles.colChange}>
          <View style={[styles.changePill, isGain ? styles.gainPill : styles.lossPill]}>
            <Text
              style={[
                styles.changePillText,
                isGain ? styles.gainText : styles.lossText,
              ]}
            >
              {isGain ? "+" : ""}
              {item.change24h}%
            </Text>
          </View>
          <Text style={styles.changeSubText}>
            {isGain ? "+" : ""}₹{item.changeAmount}
          </Text>
        </View>

        {/* Col 4: Day Range Progress */}
        <View style={styles.colRange}>
          <View style={styles.rangeLabelsRow}>
            <Text style={styles.rangeLimitText}>₹{item.minPriceKg}</Text>
            <Text style={styles.rangeLimitText}>₹{item.maxPriceKg}</Text>
          </View>
          <View style={styles.rangeTrack}>
            <View
              style={[
                styles.rangeFill,
                { width: `${progressPercent}%` },
              ]}
            />
            <View
              style={[
                styles.rangeMarker,
                { left: `${progressPercent}%` },
              ]}
            />
          </View>
        </View>

        {/* Col 5: 7-Day Sparkline */}
        <View style={styles.colSparkline}>
          <MiniSparkline data={item.sparkline7d} width={76} height={26} />
        </View>

        {/* Col 6: Supply Arrivals */}
        <View style={styles.colArrival}>
          <Text style={styles.arrivalTonsText}>{item.arrivalTons} T</Text>
          <Text style={styles.arrivalStatusText}>{item.volumeStatus}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Control Bar: Search & Category Chips */}
      <View style={styles.controlBar}>
        <View style={styles.searchBox}>
          <Search size={14} color={terminalColors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search 20 vegetables by name or variety..."
            placeholderTextColor={terminalColors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.catPill,
                selectedCategory === cat && styles.catPillActive,
              ]}
            >
              <Text
                style={[
                  styles.catPillText,
                  selectedCategory === cat && styles.catPillTextActive,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Table Container with Horizontal Scroll for narrow viewports */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tableInner}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Pressable
              onPress={() => handleSort("name")}
              style={[styles.headerCell, styles.colCommodity]}
            >
              <Text style={styles.headerText}>COMMODITY / VARIETY</Text>
              {renderSortIcon("name")}
            </Pressable>

            <Pressable
              onPress={() => handleSort("price")}
              style={[styles.headerCell, styles.colPrice]}
            >
              <Text style={styles.headerText}>MODAL (₹/KG)</Text>
              {renderSortIcon("price")}
            </Pressable>

            <Pressable
              onPress={() => handleSort("change")}
              style={[styles.headerCell, styles.colChange]}
            >
              <Text style={styles.headerText}>24H CHANGE</Text>
              {renderSortIcon("change")}
            </Pressable>

            <View style={[styles.headerCell, styles.colRange]}>
              <Text style={styles.headerText}>DAY RANGE (MIN-MAX)</Text>
            </View>

            <View style={[styles.headerCell, styles.colSparkline]}>
              <Text style={styles.headerText}>7D TREND</Text>
            </View>

            <Pressable
              onPress={() => handleSort("volume")}
              style={[styles.headerCell, styles.colArrival]}
            >
              <Text style={styles.headerText}>ARRIVALS</Text>
              {renderSortIcon("volume")}
            </Pressable>
          </View>

          {/* Table Body */}
          <FlatList
            data={filteredAndSortedData}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            scrollEnabled={false} // Managed by outer screen scroll
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </ScrollView>

      {/* Footer stats bar */}
      <View style={styles.footerBar}>
        <Text style={styles.footerText}>
          Showing {filteredAndSortedData.length} of {commodities.length} commodities
        </Text>
        <Text style={styles.footerSource}>
          Source: AGMARKNET Daily Returns • Live WebSocket Synced
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: terminalColors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: terminalColors.border,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  controlBar: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: terminalColors.border,
    gap: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#19191e",
    borderWidth: 1,
    borderColor: terminalColors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: terminalFonts.sans,
    fontSize: 13,
    color: terminalColors.text,
  },
  categoryScroll: {
    maxHeight: 32,
  },
  categoryContent: {
    gap: 6,
  },
  catPill: {
    backgroundColor: "#18181c",
    borderWidth: 1,
    borderColor: terminalColors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  catPillActive: {
    backgroundColor: terminalColors.amberBg,
    borderColor: terminalColors.amber,
  },
  catPillText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    color: terminalColors.textMuted,
  },
  catPillTextActive: {
    color: terminalColors.amber,
    fontWeight: "700",
  },
  tableInner: {
    minWidth: 760, // Ensure wide tabular layout on both desktop web & scrollable mobile
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#141418",
    borderBottomWidth: 1,
    borderBottomColor: terminalColors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  headerCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    fontWeight: "800",
    color: terminalColors.textMuted,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowSelected: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  rowPressed: {
    backgroundColor: "#1c1c22",
  },
  separator: {
    height: 1,
    backgroundColor: terminalColors.borderSubtle,
  },
  // Column sizing
  colCommodity: {
    width: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commodityIcon: {
    fontSize: 20,
  },
  commodityTextGroup: {
    flex: 1,
  },
  nameHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commodityName: {
    fontFamily: terminalFonts.sans,
    fontSize: 13,
    fontWeight: "700",
    color: terminalColors.text,
  },
  hindiName: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    color: terminalColors.textMuted,
  },
  varietyText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
  },
  colPrice: {
    width: 110,
    alignItems: "flex-end",
    paddingRight: 16,
  },
  priceKg: {
    fontFamily: terminalFonts.mono,
    fontSize: 14,
    fontWeight: "800",
    color: terminalColors.text,
  },
  priceQtl: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
  },
  colChange: {
    width: 100,
    alignItems: "flex-end",
    paddingRight: 16,
  },
  changePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gainPill: {
    backgroundColor: terminalColors.bullishBg,
  },
  lossPill: {
    backgroundColor: terminalColors.bearishBg,
  },
  changePillText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    fontWeight: "800",
  },
  gainText: {
    color: terminalColors.bullish,
  },
  lossText: {
    color: terminalColors.bearish,
  },
  changeSubText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
    marginTop: 1,
  },
  colRange: {
    width: 130,
    paddingRight: 16,
  },
  rangeLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  rangeLimitText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
  },
  rangeTrack: {
    height: 4,
    backgroundColor: "#26262d",
    borderRadius: 2,
    position: "relative",
  },
  rangeFill: {
    height: 4,
    backgroundColor: terminalColors.amber,
    borderRadius: 2,
  },
  rangeMarker: {
    position: "absolute",
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: terminalColors.text,
    marginLeft: -4,
  },
  colSparkline: {
    width: 100,
    alignItems: "center",
  },
  colArrival: {
    width: 110,
    alignItems: "flex-end",
    paddingRight: 8,
  },
  arrivalTonsText: {
    fontFamily: terminalFonts.mono,
    fontSize: 12,
    fontWeight: "700",
    color: terminalColors.cyan,
  },
  arrivalStatusText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
  },
  footerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#111114",
    borderTopWidth: 1,
    borderTopColor: terminalColors.border,
    flexWrap: "wrap",
    gap: 6,
  },
  footerText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
  },
  footerSource: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.textMuted,
  },
});
