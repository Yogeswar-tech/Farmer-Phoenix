import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { getHealth } from "@/lib/api";

export default function Home() {
  const [status, setStatus] = useState("checking...");
  useEffect(() => {
    getHealth().then((h) => setStatus(h.status)).catch((e) => setStatus(String(e)));
  }, []);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Kisan Sethu - API: {status}</Text>
    </View>
  );
}
