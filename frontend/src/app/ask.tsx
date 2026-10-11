import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { SpeakerButton } from "@/components/SpeakerButton";
import { askText } from "@/lib/api";
import { getSettings } from "@/lib/storage";
import { FarmerEnvelope } from "@/lib/types";
import { theme } from "@/theme";

const QUICK_QUESTIONS = [
  "What is the modal price today?",
  "Which nearby mandi pays the highest?",
  "Should I sell now or hold my harvest?",
  "How do prices compare to last week?",
];

export default function AskScreen() {
  const { t, i18n } = useTranslation();
  const { crop } = useLocalSearchParams<{ crop?: string }>();

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<FarmerEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (queryText?: string) => {
    const textToSubmit = queryText || question;
    if (!textToSubmit.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const { regionId } = await getSettings();
      const res = await askText(
        textToSubmit,
        crop || "tomato",
        regionId || "Chennai",
        i18n.language
      );
      setResponse(res);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t("screens.ask")}</Text>

      {/* Input Box */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.textInput}
          placeholder={t("ask.placeholder")}
          placeholderTextColor={theme.colors.textMuted}
          value={question}
          onChangeText={setQuestion}
          multiline
        />
        <TouchableOpacity
          style={[styles.submitButton, loading ? styles.disabledButton : null]}
          onPress={() => handleAsk()}
          disabled={loading || !question.trim()}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.surface} />
          ) : (
            <Text style={styles.submitButtonText}>{t("ask.submit")} ➔</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Question Chips */}
      <View style={styles.quickSection}>
        <Text style={styles.quickHeader}>{t("ask.quickQuestions")}:</Text>
        <View style={styles.chipsRow}>
          {QUICK_QUESTIONS.map((q, i) => (
            <TouchableOpacity
              key={i}
              style={styles.chip}
              onPress={() => {
                setQuestion(q);
                handleAsk(q);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.chipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Response Display */}
      {response && (
        <View style={styles.responseContainer}>
          <View style={styles.responseCard}>
            <View style={styles.responseHeaderRow}>
              <Text style={styles.responseHeadline}>{response.card.headline}</Text>
              <SpeakerButton
                textToSpeak={`${response.card.headline}. ${response.card.bullets.join(". ")}`}
              />
            </View>

            <View style={styles.bulletsList}>
              {response.card.bullets.map((bullet, idx) => (
                <View key={idx} style={styles.bulletItem}>
                  <Text style={styles.bulletIcon}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Provenance & Sources */}
          {response.provenance && response.provenance.length > 0 && (
            <View style={styles.sourcesBox}>
              <Text style={styles.sourcesTitle}>{t("ask.sources")}:</Text>
              {response.provenance.map((src, idx) => (
                <Text key={idx} style={styles.sourceItem}>
                  ✓ {src.label} ({src.source}) - {t("common.lastUpdated", { time: src.as_of })}
                </Text>
              ))}
            </View>
          )}
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
    gap: theme.spacing.lg,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  inputWrapper: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1.5,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  textInput: {
    ...theme.typography.body,
    color: theme.colors.text,
    minHeight: 70,
    textAlignVertical: "top",
  },
  submitButton: {
    minHeight: theme.minTouchTarget,
    backgroundColor: theme.colors.primaryStrong,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...theme.typography.label,
    color: theme.colors.surface,
  },
  quickSection: {
    gap: theme.spacing.sm,
  },
  quickHeader: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  chip: {
    minHeight: theme.minTouchTarget,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    justifyContent: "center",
  },
  chipText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: "500",
  },
  errorBox: {
    backgroundColor: theme.colors.surfaceTint,
    borderColor: theme.colors.danger,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.danger,
  },
  responseContainer: {
    gap: theme.spacing.md,
  },
  responseCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primaryStrong,
    borderWidth: 1.5,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  responseHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  responseHeadline: {
    ...theme.typography.heading,
    color: theme.colors.text,
    flex: 1,
  },
  bulletsList: {
    gap: theme.spacing.sm,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.xs,
  },
  bulletIcon: {
    fontSize: 18,
    color: theme.colors.primaryStrong,
    lineHeight: 24,
  },
  bulletText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  sourcesBox: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  sourcesTitle: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
  },
  sourceItem: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
});
