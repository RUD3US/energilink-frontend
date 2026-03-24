import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { DEFAULT_DEVICE } from "../../config";
import { useInterval } from "../../hooks/useInterval";
import { useHistory } from "../../hooks/useHistory";

type Row = {
  time: string;
  rms_voltage: number | null;
  rms_current: number | null;
  power: number | null;
  power_factor: number | null;
  note: string | null;
};

function downloadCsv(rows: Row[]) {
  const header = "time,voltage_V,current_A,power_W,power_factor,note";
  const body = rows
    .map(
      (r) =>
        `${r.time},${r.rms_voltage ?? ""},${r.rms_current ?? ""},${r.power ?? ""},${r.power_factor ?? ""},"${(r.note ?? "").replace(/"/g, '""')}"`
    )
    .join("\n");
  const csv = `${header}\n${body}`;

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `power-history-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  Alert.alert("Export", "CSV export is available on web.");
}

export default function TableScreen() {
  const [limit, setLimit] = useState(100);
  const history = useHistory(DEFAULT_DEVICE, limit);

  useInterval(history.refresh, 10000);

  const rows = history.rows;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>History Table</Text>
      <Text style={{ color: "#555" }}>
        Loaded rows: {rows.length}. Click Load more for older data, or export loaded rows to CSV.
      </Text>

      {history.error ? <Text style={{ color: "red" }}>History error: {history.error}</Text> : null}

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable
          onPress={history.refresh}
          style={{ padding: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 10 }}
        >
          <Text>{history.loading ? "Refreshing..." : "Refresh"}</Text>
        </Pressable>

        <Pressable
          onPress={() => setLimit((x) => x + 100)}
          style={{ padding: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 10 }}
        >
          <Text>Load more (+100)</Text>
        </Pressable>

        <Pressable
          onPress={() => downloadCsv(rows)}
          style={{ padding: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 10 }}
        >
          <Text>Export loaded CSV</Text>
        </Pressable>
      </View>

      <ScrollView horizontal>
        <View style={{ minWidth: 1080 }}>
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderColor: "#ddd",
              paddingBottom: 8,
            }}
          >
            <Text style={{ width: 260, fontWeight: "700" }}>Time</Text>
            <Text style={{ width: 130, fontWeight: "700" }}>Voltage (V)</Text>
            <Text style={{ width: 130, fontWeight: "700" }}>Current (A)</Text>
            <Text style={{ width: 130, fontWeight: "700" }}>Power (W)</Text>
            <Text style={{ width: 130, fontWeight: "700" }}>Power Factor</Text>
            <Text style={{ width: 300, fontWeight: "700" }}>Note</Text>
          </View>

          {rows.map((r, idx) => (
            <View
              key={`${r.time}-${idx}`}
              style={{
                flexDirection: "row",
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderColor: "#f0f0f0",
              }}
            >
              <Text style={{ width: 260 }}>{new Date(r.time).toLocaleString()}</Text>
              <Text style={{ width: 130 }}>{r.rms_voltage != null ? r.rms_voltage.toFixed(2) : "—"}</Text>
              <Text style={{ width: 130 }}>{r.rms_current != null ? r.rms_current.toFixed(3) : "—"}</Text>
              <Text style={{ width: 130 }}>{r.power != null ? r.power.toFixed(2) : "—"}</Text>
              <Text style={{ width: 130 }}>{r.power_factor != null ? r.power_factor.toFixed(3) : "—"}</Text>
              <Text style={{ width: 300 }}>{r.note || "—"}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}
