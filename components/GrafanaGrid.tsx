import React from "react";
import { Linking, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";

function Card({ title, url }: { title: string; url: string }) {
  const open = async () => {
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      await Linking.openURL(url);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        gap: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 14,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700" }}>{title}</Text>

      <Pressable
        onPress={open}
        style={{ padding: 10, borderRadius: 10, backgroundColor: "#111", alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Open Grafana</Text>
      </Pressable>

      {Platform.OS === "web" ? (
        <iframe
          src={url}
          style={{ width: "100%", height: 360, border: 0, borderRadius: 12 }}
          title={title}
        />
      ) : null}
    </View>
  );
}

export function GrafanaGrid({
  voltageUrl,
  currentUrl,
  powerUrl,
  pfUrl,
}: {
  voltageUrl: string;
  currentUrl: string;
  powerUrl: string;
  pfUrl: string;
}) {
  const { width } = useWindowDimensions();
  const twoCols = width >= 1100;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: twoCols ? "row" : "column", gap: 12 }}>
        <Card title="Grafana Voltage" url={voltageUrl} />
        <Card title="Grafana Current" url={currentUrl} />
      </View>

      <View style={{ flexDirection: twoCols ? "row" : "column", gap: 12 }}>
        <Card title="Grafana Power" url={powerUrl} />
        <Card title="Grafana Power Factor" url={pfUrl} />
      </View>
    </View>
  );
}