import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useDailyKwh, type KwhSummary } from "../hooks/useDailyKwh";
import { useGempReport } from "../hooks/useGempReport";

type KwhTab = "daily" | "compare14" | "monthly";

type ChartBar = {
  key: string;
  label: string;
  fullLabel: string;
  kwh: number;
  isCurrent?: boolean;
};

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
      <Text style={{ color: active ? "#fff" : "#111", fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function toNumber(value: unknown) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  return Number.isFinite(n) ? n : 0;
}

function normalizeMonthLabel(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function shortMonthLabel(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 3 ? trimmed.slice(0, 3) : trimmed;
}

function buildSummary(data: Array<{ label: string; kwh: number }>): KwhSummary {
  const total = data.reduce((sum, item) => sum + item.kwh, 0);
  const avg = data.length ? total / data.length : 0;
  const current = data[data.length - 1]?.kwh ?? 0;
  const previous = data[data.length - 2]?.kwh ?? 0;

  const peak = data.reduce<{ label: string; kwh: number } | null>(
    (best, item) => (!best || item.kwh > best.kwh ? item : best),
    null
  );

  return {
    current: Number(current.toFixed(2)),
    previous: Number(previous.toFixed(2)),
    avg: Number(avg.toFixed(2)),
    total: Number(total.toFixed(2)),
    peakLabel: peak?.label ?? "—",
    peakKwh: Number((peak?.kwh ?? 0).toFixed(2)),
  };
}

export default function DailyKwhBarCard({
  days = 14,
  months = 12,
}: {
  days?: number;
  months?: number;
}) {
  const [activeTab, setActiveTab] = useState<KwhTab>("monthly");
  const [compareOffsetBlocks, setCompareOffsetBlocks] = useState(0);

  const scrollRef = useRef<ScrollView | null>(null);

  const result = useDailyKwh(days, months, compareOffsetBlocks);
  const gemp = useGempReport();

  const dailyData = Array.isArray(result.dailyData) ? result.dailyData : result.data ?? [];

  const dailySummary = result.dailySummary ?? {
    current: result.summary?.today ?? 0,
    previous: result.summary?.yesterday ?? 0,
    avg: result.summary?.avg ?? 0,
    total: result.summary?.total ?? 0,
    peakLabel: result.summary?.peakLabel ?? "—",
    peakKwh: result.summary?.peakKwh ?? 0,
  };

  const compare14Summary = result.compare14Summary ?? {
    currentTotal: 0,
    previousTotal: 0,
    deltaKwh: 0,
    deltaPercent: null as number | null,
    currentPeakLabel: "—",
    currentPeakKwh: 0,
    previousPeakLabel: "—",
    previousPeakKwh: 0,
  };

  const currentMonthLabel = String(gemp.dynamic?.current_month_label ?? "").trim();
  const normalizedCurrentMonth = normalizeMonthLabel(currentMonthLabel);

  const monthlyBars = useMemo<ChartBar[]>(() => {
    const rows = Array.isArray(gemp.report?.rows) ? gemp.report.rows : [];

    if (!rows.length) return [];

    let usableRows = rows;

    if (normalizedCurrentMonth) {
      const currentMonthIndex = rows.findIndex(
        (row) => normalizeMonthLabel(row?.month) === normalizedCurrentMonth
      );

      if (currentMonthIndex >= 0) {
        usableRows = rows.slice(0, currentMonthIndex + 1);
      }
    } else {
      const rowsWithValues = rows.filter((row) => {
        const raw = row?.kwh;
        return raw !== undefined && raw !== null && String(raw).trim() !== "";
      });

      if (rowsWithValues.length) {
        usableRows = rowsWithValues;
      }
    }

    return usableRows.map((row, index) => {
      const fullLabel = String(row?.month ?? `Month ${index + 1}`);
      const kwh = toNumber(row?.kwh);

      return {
        key: `${index}-${fullLabel}`,
        label: shortMonthLabel(fullLabel),
        fullLabel,
        kwh: Number(kwh.toFixed(2)),
        isCurrent: normalizeMonthLabel(fullLabel) === normalizedCurrentMonth,
      };
    });
  }, [gemp.report?.rows, normalizedCurrentMonth]);

  const monthlySummary = useMemo(() => {
    return buildSummary(
      monthlyBars.map((item) => ({
        label: item.fullLabel,
        kwh: item.kwh,
      }))
    );
  }, [monthlyBars]);

  const activeBars = useMemo(() => {
    if (activeTab === "monthly") {
      return monthlyBars;
    }

    if (activeTab === "daily") {
      return dailyData.map((item) => ({
        key: item.dayKey,
        label: item.label,
        fullLabel: item.label,
        kwh: item.kwh,
        isCurrent: false,
      }));
    }

    return [];
  }, [activeTab, monthlyBars, dailyData]);

  const activeSummary = activeTab === "monthly" ? monthlySummary : dailySummary;

  const compareTotalMax = Math.max(
    compare14Summary.currentTotal,
    compare14Summary.previousTotal,
    1
  );

  const max = Math.max(...activeBars.map((d) => d.kwh), 1);
  const chartHeight = 220;

  const title =
    activeTab === "daily"
      ? "Daily kWh Bar Graph"
      : activeTab === "compare14"
      ? "Compare 14-Day Totals"
      : "Monthly kWh Bar Graph";

  const subtitle =
    activeTab === "daily"
      ? `${result.batchLabel}. ${result.visibleLabel}`
      : activeTab === "compare14"
      ? "Simple 14-day pair comparison. Use Older Pair / Newer Pair to browse succeeding 14-day windows."
      : "Current month bar is synced with the GEMP dynamic table and OLED month kWh.";

  const currentLabel = activeTab === "daily" ? "Latest day kWh" : "Current month kWh";
  const previousLabel = activeTab === "daily" ? "Previous day kWh" : "Previous month kWh";
  const avgLabel = activeTab === "daily" ? "Average / day" : "Average / month";
  const totalLabel = activeTab === "daily" ? "Visible 14d kWh" : "Total period kWh";
  const peakLabelTitle = activeTab === "daily" ? "Peak day" : "Peak month";

  const combinedLoading = result.loading || gemp.loading;
  const combinedError = result.error || gemp.error;

  function handleRefresh() {
    result.refresh();
    gemp.refresh();
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    });

    return () => cancelAnimationFrame(id);
  }, [activeTab, activeBars.length, compareOffsetBlocks]);

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
          onPress={handleRefresh}
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
            {combinedLoading ? "Refreshing..." : "Refresh kWh graph"}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <TabButton
          label="Daily"
          active={activeTab === "daily"}
          onPress={() => setActiveTab("daily")}
        />
        <TabButton
          label="Compare 14d"
          active={activeTab === "compare14"}
          onPress={() => setActiveTab("compare14")}
        />
        <TabButton
          label="Monthly"
          active={activeTab === "monthly"}
          onPress={() => setActiveTab("monthly")}
        />
      </View>

      {combinedError ? (
        <Text style={{ color: "red" }}>kWh error: {combinedError}</Text>
      ) : null}

      {activeTab === "compare14" ? (
        <>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Pressable
              onPress={() => setCompareOffsetBlocks((v) => v + 1)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#d1d5db",
                backgroundColor: "#fff",
              }}
            >
              <Text style={{ fontWeight: "700" }}>Older Pair</Text>
            </Pressable>

            <Pressable
              disabled={!result.compareCanGoNewer}
              onPress={() => setCompareOffsetBlocks((v) => Math.max(0, v - 1))}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#d1d5db",
                backgroundColor: "#fff",
                opacity: result.compareCanGoNewer ? 1 : 0.5,
              }}
            >
              <Text style={{ fontWeight: "700" }}>Newer Pair</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <SummaryBox
              label={`Current 14d kWh (${result.compareCurrentLabel})`}
              value={compare14Summary.currentTotal.toFixed(2)}
            />
            <SummaryBox
              label={`Previous 14d kWh (${result.comparePreviousLabel})`}
              value={compare14Summary.previousTotal.toFixed(2)}
            />
            <SummaryBox label="Delta kWh" value={compare14Summary.deltaKwh.toFixed(2)} />
            <SummaryBox
              label="Delta %"
              value={
                compare14Summary.deltaPercent === null
                  ? "—"
                  : `${compare14Summary.deltaPercent.toFixed(2)}%`
              }
            />
            <SummaryBox
              label="Current peak day"
              value={`${compare14Summary.currentPeakLabel} (${compare14Summary.currentPeakKwh.toFixed(2)})`}
            />
            <SummaryBox
              label="Previous peak day"
              value={`${compare14Summary.previousPeakLabel} (${compare14Summary.previousPeakKwh.toFixed(2)})`}
            />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <SummaryBox label={currentLabel} value={activeSummary.current.toFixed(2)} />
          <SummaryBox label={previousLabel} value={activeSummary.previous.toFixed(2)} />
          <SummaryBox label={avgLabel} value={activeSummary.avg.toFixed(2)} />
          <SummaryBox label={totalLabel} value={activeSummary.total.toFixed(2)} />
          <SummaryBox label={peakLabelTitle} value={activeSummary.peakLabel} />
          <SummaryBox label="Peak kWh" value={activeSummary.peakKwh.toFixed(2)} />
        </View>
      )}

      {activeTab === "compare14" ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({ animated: false });
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 40,
              minHeight: chartHeight + 90,
              paddingTop: 16,
              paddingBottom: 8,
              paddingHorizontal: 8,
            }}
          >
            <View
              style={{
                width: 160,
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#6b7280" }}>
                  {compare14Summary.previousTotal.toFixed(2)}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  height: chartHeight,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: Math.max(
                      (compare14Summary.previousTotal / compareTotalMax) * chartHeight,
                      compare14Summary.previousTotal > 0 ? 14 : 0
                    ),
                    borderRadius: 10,
                    backgroundColor: "#9ca3af",
                  }}
                />
              </View>

              <Text
                style={{
                  fontSize: 13,
                  color: "#374151",
                  textAlign: "center",
                  fontWeight: "700",
                }}
              >
                Previous 14d
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  textAlign: "center",
                }}
              >
                {result.comparePreviousLabel}
              </Text>
            </View>

            <View
              style={{
                width: 160,
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#2563eb" }}>
                  {compare14Summary.currentTotal.toFixed(2)}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  height: chartHeight,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: Math.max(
                      (compare14Summary.currentTotal / compareTotalMax) * chartHeight,
                      compare14Summary.currentTotal > 0 ? 14 : 0
                    ),
                    borderRadius: 10,
                    backgroundColor: "#2563eb",
                  }}
                />
              </View>

              <Text
                style={{
                  fontSize: 13,
                  color: "#374151",
                  textAlign: "center",
                  fontWeight: "700",
                }}
              >
                Current 14d
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  textAlign: "center",
                }}
              >
                {result.compareCurrentLabel}
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : !activeBars.length ? (
        <Text style={{ color: "#666" }}>
          {activeTab === "daily"
            ? "No daily kWh data available yet."
            : "No monthly kWh data available yet."}
        </Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({ animated: false });
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 14,
              minHeight: chartHeight + 70,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            {activeBars.map((item, index) => {
              const barHeight = Math.max((item.kwh / max) * chartHeight, 10);
              const isCurrentMonthlyBar = activeTab === "monthly" && item.isCurrent;

              return (
                <View
                  key={item.key}
                  style={{
                    width: activeTab === "daily" ? 70 : 78,
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: isCurrentMonthlyBar ? "#1d4ed8" : "#111",
                    }}
                  >
                    {item.kwh.toFixed(2)}
                  </Text>

                  <View
                    style={{
                      width: activeTab === "daily" ? 26 : 44,
                      height: barHeight,
                      borderRadius: 8,
                      backgroundColor: isCurrentMonthlyBar ? "#2563eb" : "#111",
                    }}
                  />

                  <Text
                    style={{
                      fontSize: 11,
                      color: isCurrentMonthlyBar ? "#1d4ed8" : "#666",
                      textAlign: "center",
                      fontWeight: isCurrentMonthlyBar ? "800" : "400",
                    }}
                  >
                    {activeTab === "daily" && index % 2 !== 0 ? "" : item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Text style={{ color: "#6b7280", fontSize: 12 }}>
        {activeTab === "daily"
          ? `Daily tab shows a rolling ${days}-day window (${result.visibleLabel}).`
          : activeTab === "compare14"
          ? "Compare tab shows total Previous 14d vs Current 14d. Use Older Pair / Newer Pair to browse succeeding 14-day pairs."
          : "Monthly totals still include the full current month."}
      </Text>

      <Text style={{ color: "#6b7280", fontSize: 12 }}>
        Highest bar in this window: {(activeTab === "compare14" ? compareTotalMax : max).toFixed(2)} kWh
      </Text>
    </View>
  );
}
