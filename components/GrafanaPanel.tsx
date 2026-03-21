import React from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";

export function GrafanaPanel({ url }: { url: string }) {
  const open = async () => {
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      await Linking.openURL(url);
    }
  };

  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: "700" }}>Grafana Cloud</Text>

      <Pressable
        onPress={open}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#111", alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Open Grafana</Text>
      </Pressable>

      {Platform.OS === "web" ? (
        <iframe
          src={url}
          style={{ width: "100%", height: 520, border: 0, borderRadius: 12 }}
          title="Grafana Cloud"
        />
      ) : null}
    </View>
  );
}