import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useDailyKwh, type KwhSummary } from "../hooks/useDailyKwh";

type KwhTab = "period14" | "compare14" | "monthly";

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
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | undefined>(undefined);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(-1);

  const scrollRef = useRef<ScrollView | null>(null);

  const result = useDailyKwh(days, months, selectedMonthKey, selectedPeriodIndex);
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

  useEffect(() => {
    if (!selectedMonthKey && result.selectedMonthKey) {
      setSelectedMonthKey(result.selectedMonthKey);
    }
  }, [selectedMonthKey, result.selectedMonthKey]);

  const monthlyBars = useMemo<ChartBar[]>(() => {
    const rows = Array.isArray(result.monthlyData) ? result.monthlyData : [];
    const monthsWithData = rows.filter(
      (row) => Number.isFinite(row.kwh) && row.kwh > 0
    );
    const latestMonthKey = monthsWithData[monthsWithData.length - 1]?.monthKey ?? "";

    return monthsWithData.map((row) => ({
      key: row.monthKey,
      label: shortMonthLabel(row.label),
      fullLabel: row.label,
      kwh: Number(row.kwh.toFixed(2)),
      isCurrent: row.monthKey === latestMonthKey,
    }));
  }, [result.monthlyData]);

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

    return dailyData.map((item) => ({
      key: item.dayKey,
      label: item.label,
      fullLabel: item.label,
      kwh: item.kwh,
      isCurrent: false,
    }));
  }, [activeTab, monthlyBars, dailyData]);

  const activeSummary = activeTab === "monthly" ? monthlySummary : dailySummary;

  const compareTotalMax = Math.max(
    compare14Summary.currentTotal,
    compare14Summary.previousTotal,
    1
  );

  const max = Math.max(...activeBars.map((d) => d.kwh), 1);
  const chartHeight = 220;

  const currentMonthIndex = result.availableMonths.findIndex(
    (m) => m.monthKey === result.selectedMonthKey
  );

  const canGoPrevMonth =
    currentMonthIndex >= 0 && currentMonthIndex < result.availableMonths.length - 1;
  const canGoNextMonth = currentMonthIndex > 0;

  const canGoPrevPeriod = result.selectedPeriodIndex > 0;
  const canGoNextPeriod =
    result.selectedPeriodIndex < Math.max(result.availablePeriods.length - 1, 0);

  function handlePrevMonth() {
    if (!canGoPrevMonth) return;
    const nextMonth = result.availableMonths[currentMonthIndex + 1];
    if (!nextMonth) return;
    setSelectedMonthKey(nextMonth.monthKey);
    setSelectedPeriodIndex(-1);
  }

  function handleNextMonth() {
    if (!canGoNextMonth) return;
    const nextMonth = result.availableMonths[currentMonthIndex - 1];
    if (!nextMonth) return;
    setSelectedMonthKey(nextMonth.monthKey);
    setSelectedPeriodIndex(-1);
  }

  function handlePrevPeriod() {
    if (!canGoPrevPeriod) return;
    setSelectedPeriodIndex(result.selectedPeriodIndex - 1);
  }

  function handleNextPeriod() {
    if (!canGoNextPeriod) return;
    setSelectedPeriodIndex(result.selectedPeriodIndex + 1);
  }

  const title =
    activeTab === "period14"
      ? "14-Day Period Daily kWh"
      : activeTab === "compare14"
      ? "14-Day Period Comparison"
      : "Monthly kWh Bar Graph";

  const subtitle =
    activeTab === "period14"
      ? `${result.selectedMonthLabel} • ${result.selectedPeriodLabel}`
      : activeTab === "compare14"
      ? result.compareHasPrevious
        ? `Current: ${result.compareCurrentLabel} • Previous: ${result.comparePreviousLabel}`
        : `Choose a later period in ${result.selectedMonthLabel} to compare with the earlier one.`
      : "Monthly totals are calculated from history data. Only months with data are included.";

  const currentLabel = activeTab === "period14" ? "Latest day kWh" : "Latest data month kWh";
  const previousLabel = activeTab === "period14" ? "Previous day kWh" : "Previous data month kWh";
  const avgLabel = activeTab === "period14" ? "Average / day" : "Average / data month";
  const totalLabel =
    activeTab === "period14"
      ? `Total (${result.selectedPeriodDayCount}d)`
      : "Total data-month kWh";
  const peakLabelTitle = activeTab === "period14" ? "Peak day" : "Peak data month";

  const combinedLoading = result.loading;
  const combinedError = result.error;

  function handleRefresh() {
    result.refresh();
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    });

    return () => cancelAnimationFrame(id);
  }, [activeTab, activeBars.length, result.selectedPeriodIndex, result.selectedMonthKey]);

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
          label="14-Day"
          active={activeTab === "period14"}
          onPress={() => setActiveTab("period14")}
        />
        <TabButton
          label="Compare"
          active={activeTab === "compare14"}
          onPress={() => setActiveTab("compare14")}
        />
        <TabButton
          label="Monthly"
          active={activeTab === "monthly"}
          onPress={() => setActiveTab("monthly")}
        />
      </View>

      {(activeTab === "period14" || activeTab === "compare14") && (
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Pressable
            disabled={!canGoPrevMonth}
            onPress={handlePrevMonth}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#fff",
              opacity: canGoPrevMonth ? 1 : 0.5,
            }}
          >
            <Text style={{ fontWeight: "700" }}>Prev Month</Text>
          </Pressable>

          <View
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#f8fafc",
            }}
          >
            <Text style={{ fontWeight: "700" }}>{result.selectedMonthLabel}</Text>
          </View>

          <Pressable
            disabled={!canGoNextMonth}
            onPress={handleNextMonth}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#fff",
              opacity: canGoNextMonth ? 1 : 0.5,
            }}
          >
            <Text style={{ fontWeight: "700" }}>Next Month</Text>
          </Pressable>
        </View>
      )}

      {(activeTab === "period14" || activeTab === "compare14") && (
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Pressable
            disabled={!canGoPrevPeriod}
            onPress={handlePrevPeriod}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#fff",
              opacity: canGoPrevPeriod ? 1 : 0.5,
            }}
          >
            <Text style={{ fontWeight: "700" }}>Prev Period</Text>
          </Pressable>

          <View
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#f8fafc",
            }}
          >
            <Text style={{ fontWeight: "700" }}>{result.selectedPeriodLabel}</Text>
          </View>

          <Pressable
            disabled={!canGoNextPeriod}
            onPress={handleNextPeriod}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#fff",
              opacity: canGoNextPeriod ? 1 : 0.5,
            }}
          >
            <Text style={{ fontWeight: "700" }}>Next Period</Text>
          </Pressable>
        </View>
      )}

      {combinedError ? (
        <Text style={{ color: "red" }}>kWh error: {combinedError}</Text>
      ) : null}

      {activeTab === "compare14" ? (
        result.compareHasPrevious ? (
          <>
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <SummaryBox
                label={`Current (${result.compareCurrentLabel})`}
                value={compare14Summary.currentTotal.toFixed(2)}
              />
              <SummaryBox
                label={`Previous (${result.comparePreviousLabel})`}
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
                value={`${compare14Summary.currentPeakLabel} (${compare14Summary.currentPeakKwh.toFixed(
                  2
                )})`}
              />
              <SummaryBox
                label="Previous peak day"
                value={`${compare14Summary.previousPeakLabel} (${compare14Summary.previousPeakKwh.toFixed(
                  2
                )})`}
              />
            </View>

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
                    Previous Period
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
                    Current Period
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
          </>
        ) : (
          <Text style={{ color: "#666" }}>
            This is the first period for {result.selectedMonthLabel}. Move to the next period
            to compare it with the earlier one.
          </Text>
        )
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <SummaryBox label={currentLabel} value={activeSummary.current.toFixed(2)} />
            <SummaryBox label={previousLabel} value={activeSummary.previous.toFixed(2)} />
            <SummaryBox label={avgLabel} value={activeSummary.avg.toFixed(2)} />
            <SummaryBox label={totalLabel} value={activeSummary.total.toFixed(2)} />
            <SummaryBox label={peakLabelTitle} value={activeSummary.peakLabel} />
            <SummaryBox label="Peak kWh" value={activeSummary.peakKwh.toFixed(2)} />
          </View>

          {!activeBars.length ? (
            <Text style={{ color: "#666" }}>
              {activeTab === "period14"
                ? "No period data available yet."
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
                        width: activeTab === "period14" ? 70 : 78,
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
                          width: activeTab === "period14" ? 26 : 44,
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
                        {activeTab === "period14" && index % 2 !== 0 ? "" : item.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </>
      )}

      <Text style={{ color: "#6b7280", fontSize: 12 }}>
        {activeTab === "period14"
          ? `This tab shows the selected month-anchored period starting from day 1 of ${result.selectedMonthLabel}.`
          : activeTab === "compare14"
          ? "This tab compares the selected period against the previous period in the same month."
          : "Monthly average and previous/latest values only use months that actually have history data."}
      </Text>

      <Text style={{ color: "#6b7280", fontSize: 12 }}>
        Highest bar in this window:{" "}
        {(activeTab === "compare14" ? compareTotalMax : max).toFixed(2)} kWh
      </Text>
    </View>
  );
}
