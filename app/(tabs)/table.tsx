import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { API_BASE, DEFAULT_DEVICE } from "../../config";

type HistoryRow = {
  time: string;
  rms_voltage: number | null;
  rms_current: number | null;
  power: number | null;
  power_factor: number | null;
  note?: string | null;
};

function formatValue(
  value: number | null | undefined,
  decimals: number,
  unit?: string
) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function latestNonNull(
  rows: HistoryRow[],
  key: keyof Pick<
    HistoryRow,
    "rms_voltage" | "rms_current" | "power" | "power_factor"
  >
) {
  for (const row of rows) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function escapeCsvValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export default function TableScreen() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const qs = new URLSearchParams({
        device: DEFAULT_DEVICE,
        limit: "200",
      }).toString();

      const res = await fetch(`${API_BASE}/public/history?${qs}`);
      if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          detail = String(data?.detail ?? data?.message ?? detail);
        } catch {}
        throw new Error(detail);
      }

      const data = (await res.json()) as HistoryRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(false);
  }, [fetchHistory]);

  const exportToCSV = useCallback(() => {
    if (!rows.length) return;

    if (typeof document === "undefined") {
      setError("CSV export is only available on web.");
      return;
    }

    const headers = [
      "Time",
      "Voltage (V)",
      "Current (A)",
      "Power (W)",
      "Power Factor",
      "Note",
    ];

    const csvRows = rows.map((row) => [
      formatTime(row.time),
      row.rms_voltage ?? "",
      row.rms_current ?? "",
      row.power ?? "",
      row.power_factor ?? "",
      row.note ?? "",
    ]);

    const csvContent = [headers, ...csvRows]
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    link.href = url;
    link.download = `history-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [rows]);

  const latestVoltage = useMemo(() => latestNonNull(rows, "rms_voltage"), [rows]);
  const latestCurrent = useMemo(() => latestNonNull(rows, "rms_current"), [rows]);
  const latestPower = useMemo(() => latestNonNull(rows, "power"), [rows]);
  const latestPf = useMemo(() => latestNonNull(rows, "power_factor"), [rows]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(true)} />
      }
    >
      <View
        style={{
          gap: 8,
          padding: 16,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          borderRadius: 16,
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "700" }}>History Table</Text>
        <Text style={{ color: "#555" }}>
          This table uses the backend history endpoint directly, so voltage,
          current, power, and PF come from the same archived row source.
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <View
            style={{
              minWidth: 140,
              padding: 12,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              backgroundColor: "#f8fafc",
            }}
          >
            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>
              Latest Voltage
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>
              {formatValue(latestVoltage, 2, "V")}
            </Text>
          </View>

          <View
            style={{
              minWidth: 140,
              padding: 12,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              backgroundColor: "#f8fafc",
            }}
          >
            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>
              Latest Current
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>
              {formatValue(latestCurrent, 3, "A")}
            </Text>
          </View>

          <View
            style={{
              minWidth: 140,
              padding: 12,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              backgroundColor: "#f8fafc",
            }}
          >
            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>
              Latest Power
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>
              {formatValue(latestPower, 2, "W")}
            </Text>
          </View>

          <View
            style={{
              minWidth: 140,
              padding: 12,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              backgroundColor: "#f8fafc",
            }}
          >
            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>
              Latest PF
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>
              {formatValue(latestPf, 3)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Pressable
            onPress={() => fetchHistory(true)}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#fff",
            }}
          >
            <Text style={{ fontWeight: "700" }}>
              {refreshing ? "Refreshing..." : "Refresh table"}
            </Text>
          </Pressable>

          <Pressable
            onPress={exportToCSV}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#bfdbfe",
              backgroundColor: "#eff6ff",
              opacity: rows.length ? 1 : 0.6,
            }}
          >
            <Text style={{ fontWeight: "700", color: "#1d4ed8" }}>Export CSV</Text>
          </Pressable>
        </View>

        {error ? <Text style={{ color: "red" }}>history error: {error}</Text> : null}
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: "#e5e7eb",
          borderRadius: 16,
          backgroundColor: "#fff",
          overflow: "hidden",
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 980 }}>
            <View
              style={{
                flexDirection: "row",
                paddingVertical: 12,
                paddingHorizontal: 12,
                backgroundColor: "#f8fafc",
                borderBottomWidth: 1,
                borderBottomColor: "#e5e7eb",
              }}
            >
              <Text style={{ width: 220, fontWeight: "800", color: "#111827" }}>Time</Text>
              <Text style={{ width: 130, fontWeight: "800", color: "#111827" }}>Voltage</Text>
              <Text style={{ width: 130, fontWeight: "800", color: "#111827" }}>Current</Text>
              <Text style={{ width: 130, fontWeight: "800", color: "#111827" }}>Power</Text>
              <Text style={{ width: 110, fontWeight: "800", color: "#111827" }}>PF</Text>
              <Text style={{ width: 260, fontWeight: "800", color: "#111827" }}>Note</Text>
            </View>

            {loading ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: "#555" }}>Loading history...</Text>
              </View>
            ) : rows.length === 0 ? (
              <View style={{ padding: 20 }}>
                <Text style={{ color: "#555" }}>No history rows yet.</Text>
              </View>
            ) : (
              rows.map((row, idx) => (
                <View
                  key={`${row.time}-${idx}`}
                  style={{
                    flexDirection: "row",
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
                    borderBottomColor: "#f3f4f6",
                    backgroundColor: idx % 2 === 0 ? "#fff" : "#fcfcfd",
                  }}
                >
                  <Text style={{ width: 220, color: "#111827" }}>{formatTime(row.time)}</Text>
                  <Text style={{ width: 130, color: "#111827" }}>
                    {formatValue(row.rms_voltage, 2, "V")}
                  </Text>
                  <Text style={{ width: 130, color: "#111827" }}>
                    {formatValue(row.rms_current, 3, "A")}
                  </Text>
                  <Text style={{ width: 130, color: "#111827" }}>
                    {formatValue(row.power, 2, "W")}
                  </Text>
                  <Text style={{ width: 110, color: "#111827" }}>
                    {formatValue(row.power_factor, 3)}
                  </Text>
                  <Text style={{ width: 260, color: "#111827" }}>
                    {row.note?.trim() ? row.note : "—"}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      <Text style={{ color: "#6b7280", fontSize: 12 }}>
        This table uses archived grouped history rows, so it avoids the frontend
        nearest-match issue that was making voltage, current, and PF go empty.
      </Text>
    </ScrollView>
  );
}
