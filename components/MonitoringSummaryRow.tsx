import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useDailyKwh } from "../hooks/useDailyKwh";

function formatValue(value: number | null, decimals: number, unit?: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <View
      style={{
        width: 185,
        padding: 14,
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 16,
        backgroundColor: "#f8fafc",
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>{title}</Text>
      <Text style={{ fontSize: 28, fontWeight: "800", color: "#111827" }}>{value}</Text>
      <Text style={{ fontSize: 11, color: "#6b7280" }}>{subtitle}</Text>
    </View>
  );
}

export default function MonitoringSummaryRow({
  voltage,
  current,
  intervaledPower,
  realtimePower,
  kwhDays = 14,
}: {
  voltage: number | null;
  current: number | null;
  intervaledPower: number | null;
  realtimePower: number | null;
  kwhDays?: number;
}) {
  const { summary, loading, error } = useDailyKwh(kwhDays);

  const totalKwhText = error
  ? `Err: ${error}`
  : loading && summary.total === 0
  ? "..."
  : `${summary.total.toFixed(2)} kWh`;

  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 16,
        backgroundColor: "#fff",
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: "700" }}>Monitoring Summary</Text>
        <Text style={{ color: "#555" }}></Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 12, paddingRight: 4 }}>
          <SummaryCard
            title="Voltage"
            value={formatValue(voltage, 2, "V")}
            subtitle="Latest archived value"
          />

          <SummaryCard
            title="Current"
            value={formatValue(current, 3, "A")}
            subtitle="Latest archived value"
          />

          <SummaryCard
            title="Intervaled Power"
            value={formatValue(intervaledPower, 2, "W")}
            subtitle="Latest archived power"
          />

          <SummaryCard
            title="Realtime Power"
            value={formatValue(realtimePower, 2, "W")}
            subtitle="Latest realtime power"
          />

          <SummaryCard
            title={`Total kWh (${kwhDays}d)`}
            value={totalKwhText}
            subtitle="Same period as daily kWh graph"
          />
        </View>
      </ScrollView>
    </View>
  );
}
