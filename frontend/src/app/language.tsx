import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from "@/i18n";
import { setLanguage } from "@/lib/storage";
import { theme } from "@/theme";

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  async function handleSelectLanguage(code: SupportedLanguageCode) {
    await setLanguage(code);
    await i18n.changeLanguage(code);
    router.replace("/location" as Href);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("screens.language")}</Text>

      <View style={styles.optionsList}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isSelected = i18n.language === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.optionButton,
                isSelected ? styles.selectedOptionButton : null,
              ]}
              onPress={() => handleSelectLanguage(lang.code)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected ? styles.selectedOptionText : null,
                ]}
              >
                {lang.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
    textAlign: "center",
  },
  optionsList: {
    width: "100%",
    maxWidth: 360,
    gap: theme.spacing.md,
  },
  optionButton: {
    minHeight: theme.minTouchTarget,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedOptionButton: {
    backgroundColor: theme.colors.surfaceTint,
    borderColor: theme.colors.primaryStrong,
    borderWidth: 2,
  },
  optionText: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  selectedOptionText: {
    color: theme.colors.primaryStrong,
  },
});
