import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { type Href, useRouter } from "expo-router";
import { getSettings } from "@/lib/storage";
import { theme } from "@/theme";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkRedirect() {
      const { language, regionId } = await getSettings();
      if (!isMounted) return;

      if (!language) {
        router.replace("/language" as Href);
      } else if (!regionId) {
        router.replace("/location" as Href);
      } else {
        router.replace("/crops" as Href);
      }
    }

    checkRedirect();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});


