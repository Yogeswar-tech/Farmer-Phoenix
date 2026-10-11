import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { FarmerFriendlyHome } from "@/components/FarmerFriendlyHome";
import TerminalScreen from "./terminal";

export default function IndexScreen() {
  const [mode, setMode] = useState<"farmer" | "terminal">("farmer");

  if (mode === "terminal") {
    return <TerminalScreen onSwitchToFarmer={() => setMode("farmer")} />;
  }

  return (
    <View style={styles.container}>
      <FarmerFriendlyHome onSwitchToTerminal={() => setMode("terminal")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF9F1",
  },
});
