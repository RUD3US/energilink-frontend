import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { ReportSchedulerCard } from "../../components/ReportSchedulerCard";
import { useGempReport } from "../../hooks/useGempReport";
import { exportGempToPdf } from "../../lib/gempExport";
import { saveGempReportConfig } from "../../lib/api";

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

async function confirmAction(title: string, message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      return window.confirm(`${title}\n\n${message}`);
    }
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: "Continue",
        style: "destructive",
        onPress: () => resolve(true),
      },
    ]);
  });
}

export default function GempReportScreen() {
  const { report, stats, dynamic, loading, error, refresh, reset, version } = useGempReport();
  const rows = useMemo(() => report.rows ?? [], [report.rows, version]);

  const [saveBusy, setSaveBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  async function syncReportForScheduler(showAlert = false) {
    try {
      setSaveBusy(true);
      setSaveStatus("Saving latest GEMP data for scheduler/test...");

      const result = await saveGempReportConfig({
        header: report.header,
        rows: report.rows,
        stats,
      });

      const updatedAt = result?.updated_at
        ? new Date(result.updated_at).toLocaleString()
        : "just now";

      setSaveStatus(`Saved for scheduler/test at ${updatedAt}.`);

      if (showAlert) {
        Alert.alert("Saved", `Latest GEMP data saved for scheduler/test.\n\nUpdated at: ${updatedAt}`);
      }
    } catch (e: any) {
      const message = String(e?.message ?? e);
      setSaveStatus(`Save failed: ${message}`);
      throw e;
    } finally {
      setSaveBusy(false);
    }
  }

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

        <Pressable
          onPress={async () => {
            const ok = await confirmAction(
              "Reset Manual Inputs",
              "This clears manual GEMP entries. The current month kWh remains from live dynamic data."
            );
            if (ok) {
              reset();
            }
          }}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#ef4444",
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontWeight: "700", color: "#b91c1c" }}>Reset Manual Inputs</Text>
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
        <Text>Year: {report.header.year || "-"}</Text>
        <Text>Agency: {report.header.agency || "-"}</Text>
        <Text>Tel: {report.header.tel || "-"}</Text>
        <Text>Address: {report.header.address || "-"}</Text>
        <Text>Fax: {report.header.fax || "-"}</Text>
        <Text>Region: {report.header.region || "-"}</Text>
        <Text>Prepared by: {report.header.preparedBy || "-"}</Text>
        <Text>Prepared by designation: {report.header.preparedByDesignation || "-"}</Text>
        <Text>Noted by: {report.header.notedBy || "-"}</Text>
        <Text>Noted by designation: {report.header.notedByDesignation || "-"}</Text>
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

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <StatBox label="Current month kWh sum" value={safeFixed(dynamic?.current_month_kwh, 2)} />
          <StatBox
            label="Average kWh per hour"
            value={safeFixed(dynamic?.avg_kwh_per_hour_current_month, 4)}
          />
          <StatBox label="Last 30 days kWh" value={safeFixed(dynamic?.last_30_days_kwh, 2)} />
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
        key={version}
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: "#eee",
          borderRadius: 12,
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontWeight: "800", marginBottom: 10 }}>Monthly Table</Text>
        <Text style={{ color: "#6b7280", marginBottom: 10 }}>
          Manual fields reset to blank, but the current month kWh remains dynamic by design.
        </Text>

        <ScrollView horizontal>
          <View style={{ minWidth: 980 }}>
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
              <Text style={{ width: 140, fontWeight: "800" }}>Baseline kWh in 2025</Text>
              <Text style={{ width: 180, fontWeight: "800" }}>Building Description</Text>
              <Text style={{ width: 120, fontWeight: "800" }}>Gross Area</Text>
              <Text style={{ width: 140, fontWeight: "800" }}>Aircon Area</Text>
              <Text style={{ width: 110, fontWeight: "800" }}>Occupants</Text>
              <Text style={{ width: 140, fontWeight: "800" }}>Monthly kWh</Text>
            </View>

            {rows.map((r) => {
              const isCurrentMonth = r.month === dynamic?.current_month_label;

              return (
                <View
                  key={`${version}-${r.month}`}
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: "#fafafa",
                    backgroundColor: isCurrentMonth ? "#fef3c7" : "transparent",
                  }}
                >
                  <Text style={{ width: 90 }}>{r.month}</Text>
                  <Text style={{ width: 140 }}>
                    {r.baseline2025 !== undefined && r.baseline2025 !== null && r.baseline2025 !== ""
                      ? String(r.baseline2025)
                      : "-"}
                  </Text>
                  <Text style={{ width: 180 }}>{r.buildingDesc || "-"}</Text>
                  <Text style={{ width: 120 }}>
                    {r.grossArea !== undefined && r.grossArea !== null && r.grossArea !== ""
                      ? String(r.grossArea)
                      : "-"}
                  </Text>
                  <Text style={{ width: 140 }}>
                    {r.airconArea !== undefined && r.airconArea !== null && r.airconArea !== ""
                      ? String(r.airconArea)
                      : "-"}
                  </Text>
                  <Text style={{ width: 110 }}>
                    {r.occupants !== undefined && r.occupants !== null && r.occupants !== ""
                      ? String(r.occupants)
                      : "-"}
                  </Text>
                  <Text style={{ width: 140, fontWeight: isCurrentMonth ? "800" : "400" }}>
                    {r.kwh !== undefined && r.kwh !== null && r.kwh !== "" ? String(r.kwh) : "-"}
                  </Text>
                </View>
              );
            })}

            <View style={{ flexDirection: "row", gap: 8, paddingTop: 10 }}>
              <Text style={{ width: 90, fontWeight: "800" }}>Average</Text>
              <Text style={{ width: 140 }}>
                {stats.avgBaseline !== undefined && stats.avgBaseline !== null && stats.avgBaseline !== ""
                  ? String(stats.avgBaseline)
                  : "-"}
              </Text>
              <Text style={{ width: 180 }}>-</Text>
              <Text style={{ width: 120 }}>
                {stats.avgGrossArea !== undefined && stats.avgGrossArea !== null && stats.avgGrossArea !== ""
                  ? String(stats.avgGrossArea)
                  : "-"}
              </Text>
              <Text style={{ width: 140 }}>
                {stats.avgAirconArea !== undefined &&
                stats.avgAirconArea !== null &&
                stats.avgAirconArea !== ""
                  ? String(stats.avgAirconArea)
                  : "-"}
              </Text>
              <Text style={{ width: 110 }}>
                {stats.avgOccupants !== undefined &&
                stats.avgOccupants !== null &&
                stats.avgOccupants !== ""
                  ? String(stats.avgOccupants)
                  : "-"}
              </Text>
              <Text style={{ width: 140 }}>
                {stats.avgKwh !== undefined && stats.avgKwh !== null && stats.avgKwh !== ""
                  ? String(stats.avgKwh)
                  : "-"}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={{ gap: 8 }}>
        <Pressable
          onPress={async () => {
            try {
              await syncReportForScheduler(true);
            } catch (e: any) {
              Alert.alert("Save failed", String(e?.message ?? e));
            }
          }}
          disabled={saveBusy}
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#111",
            alignItems: "center",
            backgroundColor: saveBusy ? "#f3f4f6" : "#fff",
          }}
        >
          <Text style={{ color: "#111", fontWeight: "900" }}>
            {saveBusy ? "Saving..." : "Save for Scheduler / Test"}
          </Text>
        </Pressable>

        {saveStatus ? (
          <Text style={{ color: "#065f46", fontWeight: "600" }}>{saveStatus}</Text>
        ) : null}
      </View>

      <Pressable
        onPress={async () => {
          try {
            await exportGempToPdf({
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
        <Text style={{ color: "#fff", fontWeight: "900" }}>Export to PDF (Annex A)</Text>
      </Pressable>

      <Text style={{ color: "#6b7280" }}>
        Scheduled email and test email use the latest saved snapshot from this page.
      </Text>

      <ReportSchedulerCard
        onBeforeSendTest={async () => {
          await syncReportForScheduler(false);
        }}
      />
    </ScrollView>
  );
}
