import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import {
  MapPin,
  ChevronDown,
  Navigation,
  Check,
  Search,
  X,
  Building2,
} from "lucide-react-native";
import {
  findClosestMandi,
  MANDI_LOCATIONS,
  MandiLocation,
} from "@/data/mockMandiData";
import { terminalColors, terminalFonts } from "@/theme/terminalTheme";

interface LocationHeaderProps {
  activeMandi: MandiLocation;
  onSelectMandi: (mandi: MandiLocation, distanceKm?: number) => void;
  detectedDistanceKm?: number;
}

export const LocationHeader: React.FC<LocationHeaderProps> = ({
  activeMandi,
  onSelectMandi,
  detectedDistanceKm,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("All");

  // Extract unique states for cascading filter
  const allStates = ["All", ...Array.from(new Set(MANDI_LOCATIONS.map((m) => m.state)))];

  const handleDetectGPS = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { mandi, distanceKm } = findClosestMandi(
          position.coords.latitude,
          position.coords.longitude
        );
        onSelectMandi(mandi, distanceKm);
      } else {
        // Fallback default coordinates (Hyderabad)
        const { mandi, distanceKm } = findClosestMandi(17.4728, 78.4842);
        onSelectMandi(mandi, distanceKm);
      }
    } catch {
      // Browser or device permission refused or unavailable
      const { mandi, distanceKm } = findClosestMandi(17.4728, 78.4842);
      onSelectMandi(mandi, distanceKm);
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function initLocation() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (isMounted) {
            const { mandi, distanceKm } = findClosestMandi(
              position.coords.latitude,
              position.coords.longitude
            );
            onSelectMandi(mandi, distanceKm);
          }
        }
      } catch {
        // Safe silent fallback
      }
    }
    initLocation();
    return () => {
      isMounted = false;
    };
  }, [onSelectMandi]);

  const filteredMandis = MANDI_LOCATIONS.filter((m) => {
    const matchesState = selectedState === "All" || m.state === selectedState;
    const matchesQuery =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.state.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesState && matchesQuery;
  });

  return (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.branding}>
          <Text style={styles.brandTerminal}>KISAN<Text style={styles.brandAccent}>SETHU</Text></Text>
          <View style={styles.terminalBadge}>
            <Text style={styles.terminalBadgeText}>TERMINAL v2.4</Text>
          </View>
        </View>

        <View style={styles.locationSelectorContainer}>
          <Pressable
            onPress={() => setModalVisible(true)}
            style={({ pressed }) => [
              styles.locationPill,
              pressed && styles.locationPillPressed,
            ]}
          >
            <MapPin size={14} color={terminalColors.amber} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>ACTIVE APMC MANDI</Text>
              <Text style={styles.activeMandiName} numberOfLines={1}>
                {activeMandi.name}, {activeMandi.district}
              </Text>
            </View>
            {detectedDistanceKm !== undefined && (
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceBadgeText}>~{detectedDistanceKm} km</Text>
              </View>
            )}
            <ChevronDown size={14} color={terminalColors.textSecondary} />
          </Pressable>

          <Pressable
            onPress={handleDetectGPS}
            disabled={locating}
            style={({ pressed }) => [
              styles.gpsButton,
              pressed && styles.gpsButtonPressed,
            ]}
          >
            {locating ? (
              <ActivityIndicator size="small" color={terminalColors.bullish} />
            ) : (
              <Navigation size={14} color={terminalColors.bullish} />
            )}
            <Text style={styles.gpsButtonText}>
              {locating ? "LOCATING..." : "GPS"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Mandi Selector Modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Building2 size={18} color={terminalColors.amber} />
                <Text style={styles.modalTitle}>Select Mandi / Rythu Bazar</Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={18} color={terminalColors.textSecondary} />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Search size={16} color={terminalColors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by mandi name, district, state..."
                placeholderTextColor={terminalColors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <X size={14} color={terminalColors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* State filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.stateFilterScroll}
              contentContainerStyle={styles.stateFilterContent}
            >
              {allStates.map((st) => (
                <Pressable
                  key={st}
                  onPress={() => setSelectedState(st)}
                  style={[
                    styles.stateChip,
                    selectedState === st && styles.stateChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stateChipText,
                      selectedState === st && styles.stateChipTextActive,
                    ]}
                  >
                    {st}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Mandi List */}
            <ScrollView style={styles.mandiList} showsVerticalScrollIndicator={false}>
              {filteredMandis.map((mandi) => {
                const isSelected = activeMandi.id === mandi.id;
                return (
                  <Pressable
                    key={mandi.id}
                    onPress={() => {
                      onSelectMandi(mandi);
                      setModalVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.mandiListItem,
                      isSelected && styles.mandiListItemSelected,
                      pressed && styles.mandiListItemPressed,
                    ]}
                  >
                    <View style={styles.mandiItemInfo}>
                      <View style={styles.mandiNameRow}>
                        <Text style={styles.mandiItemName}>{mandi.name}</Text>
                        <View style={styles.mandiTypeTag}>
                          <Text style={styles.mandiTypeTagText}>{mandi.type}</Text>
                        </View>
                      </View>
                      <Text style={styles.mandiItemLocation}>
                        {mandi.district}, {mandi.state}
                      </Text>
                    </View>

                    {isSelected ? (
                      <View style={styles.checkIconWrapper}>
                        <Check size={16} color={terminalColors.bullish} />
                      </View>
                    ) : (
                      <Text style={styles.selectActionText}>Switch</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: terminalColors.card,
    borderBottomWidth: 1,
    borderBottomColor: terminalColors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  branding: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandTerminal: {
    fontFamily: terminalFonts.mono,
    fontSize: 17,
    fontWeight: "900",
    color: terminalColors.text,
    letterSpacing: 1.2,
  },
  brandAccent: {
    color: terminalColors.bullish,
  },
  terminalBadge: {
    backgroundColor: terminalColors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  terminalBadgeText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    fontWeight: "700",
    color: terminalColors.amber,
  },
  locationSelectorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c21",
    borderWidth: 1,
    borderColor: terminalColors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    maxWidth: 320,
  },
  locationPillPressed: {
    borderColor: terminalColors.amber,
  },
  locationInfo: {
    flexShrink: 1,
  },
  locationLabel: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  activeMandiName: {
    fontFamily: terminalFonts.sans,
    fontSize: 13,
    fontWeight: "700",
    color: terminalColors.text,
  },
  distanceBadge: {
    backgroundColor: terminalColors.bullishBg,
    borderWidth: 1,
    borderColor: terminalColors.bullishBorder,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  distanceBadgeText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    color: terminalColors.bullish,
    fontWeight: "700",
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161d19",
    borderWidth: 1,
    borderColor: terminalColors.bullishBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  gpsButtonPressed: {
    opacity: 0.7,
  },
  gpsButtonText: {
    fontFamily: terminalFonts.mono,
    fontSize: 10,
    fontWeight: "800",
    color: terminalColors.bullish,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: terminalColors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: terminalColors.border,
    width: "100%",
    maxWidth: 520,
    maxHeight: "85%",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontFamily: terminalFonts.sans,
    fontSize: 16,
    fontWeight: "700",
    color: terminalColors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181d",
    borderWidth: 1,
    borderColor: terminalColors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: terminalColors.text,
    fontFamily: terminalFonts.sans,
    fontSize: 13,
  },
  stateFilterScroll: {
    maxHeight: 34,
    marginBottom: 12,
  },
  stateFilterContent: {
    gap: 6,
    paddingVertical: 2,
  },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#18181d",
    borderWidth: 1,
    borderColor: terminalColors.border,
  },
  stateChipActive: {
    backgroundColor: terminalColors.amberBg,
    borderColor: terminalColors.amber,
  },
  stateChipText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    color: terminalColors.textSecondary,
  },
  stateChipTextActive: {
    color: terminalColors.amber,
    fontWeight: "700",
  },
  mandiList: {
    maxHeight: 360,
  },
  mandiListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: terminalColors.borderSubtle,
    borderRadius: 6,
  },
  mandiListItemSelected: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderLeftWidth: 3,
    borderLeftColor: terminalColors.bullish,
  },
  mandiListItemPressed: {
    backgroundColor: "#202026",
  },
  mandiItemInfo: {
    flex: 1,
    gap: 2,
  },
  mandiNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mandiItemName: {
    fontFamily: terminalFonts.sans,
    fontSize: 14,
    fontWeight: "600",
    color: terminalColors.text,
  },
  mandiTypeTag: {
    backgroundColor: "#26262e",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  mandiTypeTagText: {
    fontFamily: terminalFonts.mono,
    fontSize: 9,
    color: terminalColors.textMuted,
  },
  mandiItemLocation: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    color: terminalColors.textSecondary,
  },
  checkIconWrapper: {
    padding: 4,
  },
  selectActionText: {
    fontFamily: terminalFonts.mono,
    fontSize: 11,
    color: terminalColors.amber,
    fontWeight: "700",
  },
});
