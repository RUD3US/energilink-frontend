import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useDailyKwh } from "../hooks/useDailyKwh";

function SummaryBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 140,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 14,
        backgroundColor: "#f8fafc",
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 24, fontWeight: "800", color: "#111827" }}>{value}</Text>
    </View>
  );
}

export default function DailyKwhBarCard({
  days = 14,
}: {
  days?: number;
}) {
  const { data, summary, refresh, loading, error } = useDailyKwh(days);

  const max = Math.max(...data.map((d) => d.kwh), 1);
  const chartHeight = 220;

  return (
    <View
      style={{
        gap: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 16,
        backgroundColor: "#fff",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>
            Daily kWh Bar Graph ({days} days)
          </Text>
          <Text style={{ color: "#555" }}>
            Separate daily energy usage computed from archived power history.
          </Text>
        </View>

        <Pressable
          onPress={refresh}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#ddd",
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontWeight: "700" }}>
            {loading ? "Refreshing..." : "Refresh kWh graph"}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: "red" }}>daily kWh error: {error}</Text> : null}

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <SummaryBox label="Today kWh" value={summary.today.toFixed(2)} />
        <SummaryBox label="Yesterday kWh" value={summary.yesterday.toFixed(2)} />
        <SummaryBox label="Average / day" value={summary.avg.toFixed(2)} />
        <SummaryBox label="Total period kWh" value={summary.total.toFixed(2)} />
        <SummaryBox label="Peak day" value={summary.peakLabel} />
        <SummaryBox label="Peak kWh" value={summary.peakKwh.toFixed(2)} />
      </View>

      {!data.length ? (
        <Text style={{ color: "#666" }}>No daily kWh data available yet.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 18,
              minHeight: chartHeight + 70,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            {data.map((item) => {
              const barHeight = Math.max((item.kwh / max) * chartHeight, 10);

              return (
                <View
                  key={item.dayKey}
                  style={{
                    width: 62,
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700" }}>
                    {item.kwh.toFixed(2)}
                  </Text>

                  <View
                    style={{
                      width: 38,
                      height: barHeight,
                      borderRadius: 8,
                      backgroundColor: "#111",
                    }}
                  />

                  <Text
                    style={{
                      fontSize: 11,
                      color: "#666",
                      textAlign: "center",
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Text style={{ color: "#6b7280", fontSize: 12 }}>
        Highest bar in this window: {max.toFixed(2)} kWh
      </Text>
    </View>
  );
}
