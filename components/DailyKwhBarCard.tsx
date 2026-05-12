import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useDailyKwh, type KwhSummary } from "../hooks/useDailyKwh";
import { useGempReport } from "../hooks/useGempReport";

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

function roundKwh(value: number, decimals = 3) {
  return Number(value.toFixed(decimals));
}

function formatKwh(value: number, maxDecimals = 3) {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

function buildSummary(data: Array<{ label: string; kwh: number }>): KwhSummary {
  // Monthly fallback uses the same calculation rule as the daily hook:
  // summary boxes are derived from the same bars rendered below.
  const total = data.reduce((sum, item) => sum + item.kwh, 0);
  const avg = data.length ? total / data.length : 0;
  const current = data[data.length - 1]?.kwh ?? 0;
  const previous = data[data.length - 2]?.kwh ?? 0;

  const peak = data.reduce<{ label: string; kwh: number } | null>(
    (best, item) => (!best || item.kwh > best.kwh ? item : best),
    null
  );

  return {
    current: roundKwh(current),
    previous: roundKwh(previous),
    avg: roundKwh(avg),
    total: roundKwh(total),
    peakLabel: peak?.label ?? "—",
    peakKwh: roundKwh(peak?.kwh ?? 0),
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

  useEffect(() => {
    if (!selectedMonthKey && result.selectedMonthKey) {
      setSelectedMonthKey(result.selectedMonthKey);
    }
  }, [selectedMonthKey, result.selectedMonthKey]);

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
      : "Current month bar is synced with the GEMP dynamic table and OLED month kWh.";

  const currentLabel = activeTab === "period14" ? "Latest day kWh" : "Current month kWh";
  const previousLabel = activeTab === "period14" ? "Previous day kWh" : "Previous month kWh";
  const avgLabel = activeTab === "period14" ? "Average / day" : "Average / month";
  const totalLabel =
    activeTab === "period14"
      ? `Visible ${result.selectedPeriodDayCount}d kWh`
      : "Total period kWh";
  const peakLabelTitle = activeTab === "period14" ? "Peak day" : "Peak month";

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
                value={formatKwh(compare14Summary.currentTotal, 3)}
              />
              <SummaryBox
                label={`Previous (${result.comparePreviousLabel})`}
                value={formatKwh(compare14Summary.previousTotal, 3)}
              />
              <SummaryBox label="Delta kWh" value={formatKwh(compare14Summary.deltaKwh, 3)} />
              <SummaryBox
                label="Delta %"
                value={
                  compare14Summary.deltaPercent === null
                    ? "—"
                    : `${formatKwh(compare14Summary.deltaPercent, 2)}%`
                }
              />
              <SummaryBox
                label="Current peak day"
                value={`${compare14Summary.currentPeakLabel} (${formatKwh(
                  compare14Summary.currentPeakKwh,
                  3
                )})`}
              />
              <SummaryBox
                label="Previous peak day"
                value={`${compare14Summary.previousPeakLabel} (${formatKwh(
                  compare14Summary.previousPeakKwh,
                  3
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
                      {formatKwh(compare14Summary.previousTotal, 3)}
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
                      {formatKwh(compare14Summary.currentTotal, 3)}
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
            <SummaryBox label={currentLabel} value={formatKwh(activeSummary.current, 2)} />
            <SummaryBox label={previousLabel} value={formatKwh(activeSummary.previous, 2)} />
            <SummaryBox label={avgLabel} value={formatKwh(activeSummary.avg, 3)} />
            <SummaryBox label={totalLabel} value={formatKwh(activeSummary.total, 3)} />
            <SummaryBox label={peakLabelTitle} value={activeSummary.peakLabel} />
            <SummaryBox label="Peak kWh" value={formatKwh(activeSummary.peakKwh, 3)} />
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
                        {formatKwh(item.kwh, 3)}
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
          : "Monthly totals still include the full current month."}
      </Text>

      <Text style={{ color: "#6b7280", fontSize: 12 }}>
        Highest bar in this window:{" "}
        {formatKwh(activeTab === "compare14" ? compareTotalMax : max, 3)} kWh
      </Text>
    </View>
  );
}
