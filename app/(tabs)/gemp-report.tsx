import React, { useMemo } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { ReportSchedulerCard } from "../../components/ReportSchedulerCard";
import { useGempReport } from "../../hooks/useGempReport";
import { exportGempToDocx } from "../../lib/gempExport";

function safeFixed(value: unknown, digits = 2) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        minWidth: 180,
        flex: 1,
        padding: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        backgroundColor: "#fff",
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>{value}</Text>
    </View>
  );
}

export default function GempReportScreen() {
  const { report, stats, dynamic, loading, error, refresh } = useGempReport();

  const rows = useMemo(() => report.rows ?? [], [report.rows]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "800" }}>GEMP Report (Preview)</Text>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable
          onPress={refresh}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#d1d5db",
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontWeight: "700" }}>
            {loading ? "Refreshing..." : "Refresh dynamic kWh"}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: "red" }}>dynamic kWh error: {error}</Text> : null}

      <View
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: "#eee",
          borderRadius: 12,
          gap: 6,
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontWeight: "800" }}>Header</Text>
        <Text>Year: {report?.header?.year ?? "-"}</Text>
        <Text>Agency: {report?.header?.agency ?? "-"}</Text>
        <Text>Tel: {report?.header?.tel ?? "-"}</Text>
        <Text>Address: {report?.header?.address ?? "-"}</Text>
        <Text>Fax: {report?.header?.fax ?? "-"}</Text>
        <Text>Region: {report?.header?.region ?? "-"}</Text>
      </View>

      <View
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: "#eee",
          borderRadius: 12,
          gap: 10,
          backgroundColor: "#f8fafc",
        }}
      >
        <Text style={{ fontWeight: "800" }}>Dynamic kWh from archived power data</Text>
        <Text style={{ color: "#4b5563" }}>
          The GEMP table uses the current month kWh as a running sum. The hourly average
          is shown below as extra information only.
        </Text>

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <StatBox
            label="Current month kWh sum"
            value={safeFixed(dynamic?.current_month_kwh, 2)}
          />
          <StatBox
            label="Average kWh per hour"
            value={safeFixed(dynamic?.avg_kwh_per_hour_current_month, 4)}
          />
          <StatBox
            label="Last 30 days kWh"
            value={safeFixed(dynamic?.last_30_days_kwh, 2)}
          />
          <StatBox
            label="Average daily kWh (30d)"
            value={safeFixed(dynamic?.avg_daily_kwh_30d, 2)}
          />
        </View>

        <Text style={{ color: "#6b7280" }}>
          Updated at: {dynamic?.updated_at ? new Date(dynamic.updated_at).toLocaleString() : "—"}
        </Text>
        <Text style={{ color: "#6b7280" }}>
          Points used (current month): {dynamic?.points_used_current_month ?? 0}
        </Text>
        <Text style={{ color: "#6b7280" }}>
          Hours represented: {safeFixed(dynamic?.hours_elapsed_current_month, 2)} h
        </Text>
      </View>

      <View
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: "#eee",
          borderRadius: 12,
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontWeight: "800", marginBottom: 10 }}>Monthly Table</Text>

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: "#eee",
          }}
        >
          <Text style={{ width: 90, fontWeight: "800" }}>Month</Text>
          <Text style={{ width: 110, fontWeight: "800" }}>Baseline</Text>
          <Text style={{ width: 130, fontWeight: "800" }}>Building</Text>
          <Text style={{ width: 120, fontWeight: "800" }}>Gross Area</Text>
          <Text style={{ width: 140, fontWeight: "800" }}>Aircon Area</Text>
          <Text style={{ width: 110, fontWeight: "800" }}>Occupants</Text>
          <Text style={{ width: 120, fontWeight: "800" }}>kWh</Text>
        </View>

        {rows.map((r) => (
          <View
            key={r.month}
            style={{
              flexDirection: "row",
              gap: 8,
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: "#fafafa",
              backgroundColor:
                r.month === dynamic?.current_month_label ? "#fef3c7" : "transparent",
            }}
          >
            <Text style={{ width: 90 }}>{r.month}</Text>
            <Text style={{ width: 110 }}>{r.baseline2016 || "-"}</Text>
            <Text style={{ width: 130 }}>{r.buildingDescription || "-"}</Text>
            <Text style={{ width: 120 }}>{r.grossArea || "-"}</Text>
            <Text style={{ width: 140 }}>{r.airconArea || "-"}</Text>
            <Text style={{ width: 110 }}>{r.occupants || "-"}</Text>
            <Text
              style={{
                width: 120,
                fontWeight: r.month === dynamic?.current_month_label ? "800" : "400",
              }}
            >
              {r.kwh || "-"}
            </Text>
          </View>
        ))}

        <View style={{ flexDirection: "row", gap: 8, paddingTop: 10 }}>
          <Text style={{ width: 90, fontWeight: "800" }}>Average</Text>
          <Text style={{ width: 110 }}>{stats?.avgBaseline || "-"}</Text>
          <Text style={{ width: 130 }}>-</Text>
          <Text style={{ width: 120 }}>{stats?.avgGrossArea || "-"}</Text>
          <Text style={{ width: 140 }}>{stats?.avgAirconArea || "-"}</Text>
          <Text style={{ width: 110 }}>{stats?.avgOccupants || "-"}</Text>
          <Text style={{ width: 120 }}>{stats?.avgKwh || "-"}</Text>
        </View>
      </View>

      <Pressable
        onPress={async () => {
          try {
            await exportGempToDocx({
              header: report.header,
              rows: report.rows,
              stats,
            });
          } catch (e: any) {
            Alert.alert("Export failed", String(e?.message ?? e));
          }
        }}
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: "#111",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "900" }}>Export to DOCX (Annex A)</Text>
      </Pressable>

      <ReportSchedulerCard />
    </ScrollView>
  );
}