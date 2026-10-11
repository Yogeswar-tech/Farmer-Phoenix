import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/theme";

interface SpeakerButtonProps {
  textToSpeak: string;
}

export function SpeakerButton({ textToSpeak }: SpeakerButtonProps) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSpeak = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
    } else {
      // Toggle play indicator for native devices if tts not loaded
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, isPlaying ? styles.activeButton : null]}
      onPress={handleSpeak}
      accessibilityRole="button"
      accessibilityLabel={t("price.listen")}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{isPlaying ? "⏹️" : "🔊"}</Text>
      <Text style={[styles.label, isPlaying ? styles.activeLabel : null]}>
        {isPlaying ? t("common.cancel") : t("price.listen")}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: theme.minTouchTarget,
    minWidth: theme.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceTint,
    borderColor: theme.colors.primaryStrong,
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  activeButton: {
    backgroundColor: theme.colors.primary,
  },
  icon: {
    fontSize: 20,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.primaryStrong,
    fontWeight: "600",
  },
  activeLabel: {
    color: theme.colors.onPrimary,
  },
});
