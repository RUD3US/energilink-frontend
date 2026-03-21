import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";

import {
    DEFAULT_DEVICE,
    FIELD_CURRENT,
    FIELD_POWER,
    FIELD_POWER_FACTOR,
    FIELD_VOLTAGE,
} from "../../config";
import { useInterval } from "../../hooks/useInterval";
import { useRealtime } from "../../hooks/useRealtime";

type Row = {
  time: string;
  voltage: number | null;
  current: number | null;
  powerW: number | null;
  pf: number | null;
};

function toMs(iso: string) {
  return new Date(iso).getTime();
}

function nearestValueAtTime(
  points: { time: string; value: number }[],
  targetMs: number,
  toleranceMs: number
) {
  let bestDt = Number.POSITIVE_INFINITY;
  let bestValue: number | null = null;

  for (const p of points) {
    const dt = Math.abs(toMs(p.time) - targetMs);
    if (dt < bestDt) {
      bestDt = dt;
      bestValue = p.value;
    }
  }

  if (bestValue === null || bestDt > toleranceMs) return null;
  return bestValue;
}

function buildRows(
  voltagePoints: { time: string; value: number }[],
  currentPoints: { time: string; value: number }[],
  powerKwPoints: { time: string; value: number }[],
  pfPoints: { time: string; value: number }[]
): Row[] {
  const matchToleranceMs = 30_000;

  return voltagePoints
    .map((v) => {
      const targetMs = toMs(v.time);
      const i = nearestValueAtTime(currentPoints, targetMs, matchToleranceMs);
      const measuredPowerW = nearestValueAtTime(powerKwPoints, targetMs, matchToleranceMs);
      const measuredPf = nearestValueAtTime(pfPoints, targetMs, matchToleranceMs);

      const derivedPowerW = i == null ? null : v.value * i;
      const powerW = derivedPowerW ?? (measuredPowerW == null ? null : measuredPowerW * 1000);

      const apparentVA = i == null ? null : v.value * i;
      const derivedPf =
        powerW == null || apparentVA == null || apparentVA <= 0
          ? null
          : Math.max(0, Math.min(1, powerW / apparentVA));

      return {
        time: v.time,
        voltage: v.value,
        current: i,
        powerW,
        pf: derivedPf ?? measuredPf,
      };
    })
    .sort((a, b) => toMs(b.time) - toMs(a.time));
}

function downloadCsv(rows: Row[]) {
  const header = "time,voltage_V,current_A,power_W,power_factor";
  const body = rows
    .map(
      (r) =>
        `${r.time},${r.voltage ?? ""},${r.current ?? ""},${r.powerW ?? ""},${r.pf ?? ""}`
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

  Alert.alert("Export", "CSV export is available on web. Use load more to browse history here.");
}

export default function TableScreen() {
  const [limit, setLimit] = useState(100);

  const voltageRT = useRealtime(DEFAULT_DEVICE, FIELD_VOLTAGE);
  const currentRT = useRealtime(DEFAULT_DEVICE, FIELD_CURRENT);
  const powerRT = useRealtime(DEFAULT_DEVICE, FIELD_POWER);
  const pfRT = useRealtime(DEFAULT_DEVICE, FIELD_POWER_FACTOR);

  const refreshAll = () => {
    const l = String(limit);
    voltageRT.refresh(l);
    currentRT.refresh(l);
    powerRT.refresh(l);
    pfRT.refresh(l);
  };

  useInterval(refreshAll, 10000);

  React.useEffect(() => {
    refreshAll();
  }, [limit]);

  const rows = useMemo(
    () => buildRows(voltageRT.points, currentRT.points, powerRT.points, pfRT.points),
    [voltageRT.points, currentRT.points, powerRT.points, pfRT.points]
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>History Table</Text>
      <Text style={{ color: "#555" }}>
        Loaded rows: {rows.length}. Click Load more for older data, or export loaded rows to CSV.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable
          onPress={refreshAll}
          style={{ padding: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 10 }}
        >
          <Text>Refresh</Text>
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
        <View style={{ minWidth: 900 }}>
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#ddd", paddingBottom: 8 }}>
            <Text style={{ width: 280, fontWeight: "700" }}>Time</Text>
            <Text style={{ width: 140, fontWeight: "700" }}>Voltage (V)</Text>
            <Text style={{ width: 140, fontWeight: "700" }}>Current (A)</Text>
            <Text style={{ width: 140, fontWeight: "700" }}>Power (W)</Text>
            <Text style={{ width: 140, fontWeight: "700" }}>Power Factor</Text>
          </View>

          {rows.map((r, idx) => (
            <View
              key={`${r.time}-${idx}`}
              style={{ flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderColor: "#f0f0f0" }}
            >
              <Text style={{ width: 280 }}>{new Date(r.time).toLocaleString()}</Text>
              <Text style={{ width: 140 }}>{r.voltage != null ? r.voltage.toFixed(2) : "—"}</Text>
              <Text style={{ width: 140 }}>{r.current != null ? r.current.toFixed(3) : "—"}</Text>
              <Text style={{ width: 140 }}>{r.powerW != null ? r.powerW.toFixed(1) : "—"}</Text>
              <Text style={{ width: 140 }}>{r.pf != null ? r.pf.toFixed(3) : "—"}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}