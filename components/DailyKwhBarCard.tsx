import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useDailyKwh } from "../hooks/useDailyKwh";

type KwhTab = "daily" | "monthly";

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

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? "#111" : "#d1d5db",
        backgroundColor: active ? "#111" : "#fff",
      }}
    >
      <Text style={{ color: active ? "#fff" : "#111", fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export default function DailyKwhBarCard({
  days = 14,
  months = 12,
}: {
  days?: number;
  months?: number;
}) {
  const [activeTab, setActiveTab] = useState<KwhTab>("daily");

  const {
    dailyData,
    monthlyData,
    dailySummary,
    monthlySummary,
    refresh,
    loading,
    error,
  } = useDailyKwh(days, months);

  const activeBars = useMemo(() => {
    if (activeTab === "daily") {
      return dailyData.map((item) => ({
        key: item.dayKey,
        label: item.label,
        kwh: item.kwh,
      }));
    }

    return monthlyData.map((item) => ({
      key: item.monthKey,
      label: item.label,
      kwh: item.kwh,
    }));
  }, [activeTab, dailyData, monthlyData]);

  const activeSummary = activeTab === "daily" ? dailySummary : monthlySummary;
  const max = Math.max(...activeBars.map((d) => d.kwh), 1);
  const chartHeight = 220;

  const title =
    activeTab === "daily"
      ? `kWh Bar Graph - Daily (${days} days)`
      : `kWh Bar Graph - Monthly (${months} months)`;

  const subtitle =
    activeTab === "daily"
      ? "Separate daily energy usage computed from archived power history."
      : "Separate monthly energy usage computed from archived power history.";

  const currentLabel = activeTab === "daily" ? "Today kWh" : "This month kWh";
  const previousLabel = activeTab === "daily" ? "Yesterday kWh" : "Last month kWh";
  const avgLabel = activeTab === "daily" ? "Average / day" : "Average / month";
  const peakLabelTitle = activeTab === "daily" ? "Peak day" : "Peak month";
  const highestBarText =
    activeTab === "daily"
      ? `Highest daily bar in this window: ${max.toFixed(2)} kWh`
      : `Highest monthly bar in this window: ${max.toFixed(2)} kWh`;

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
          <Text style={{ fontSize: 16, fontWeight: "700" }}>{title}</Text>
          <Text style={{ color: "#555" }}>{subtitle}</Text>
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

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <TabButton
          label="Daily"
          active={activeTab === "daily"}
          onPress={() => setActiveTab("daily")}
        />
        <TabButton
          label="Monthly"
          active={activeTab === "monthly"}
          onPress={() => setActiveTab("monthly")}
        />
      </View>

      {error ? <Text style={{ color: "red" }}>kWh error: {error}</Text> : null}

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <SummaryBox label={currentLabel} value={activeSummary.current.toFixed(2)} />
        <SummaryBox label={previousLabel} value={activeSummary.previous.toFixed(2)} />
        <SummaryBox label={avgLabel} value={activeSummary.avg.toFixed(2)} />
        <SummaryBox label="Total period kWh" value={activeSummary.total.toFixed(2)} />
        <SummaryBox label={peakLabelTitle} value={activeSummary.peakLabel} />
        <SummaryBox label="Peak kWh" value={activeSummary.peakKwh.toFixed(2)} />
      </View>

      {!activeBars.length ? (
        <Text style={{ color: "#666" }}>
          {activeTab === "daily"
            ? "No daily kWh data available yet."
            : "No monthly kWh data available yet."}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: activeTab === "daily" ? 18 : 14,
              minHeight: chartHeight + 70,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            {activeBars.map((item) => {
              const barHeight = Math.max((item.kwh / max) * chartHeight, 10);

              return (
                <View
                  key={item.key}
                  style={{
                    width: activeTab === "daily" ? 62 : 78,
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
                      width: activeTab === "daily" ? 38 : 44,
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

      <Text style={{ color: "#6b7280", fontSize: 12 }}>{highestBarText}</Text>
    </View>
  );
}
