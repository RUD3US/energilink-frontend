import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  API_BASE,
  DEFAULT_DEVICE,
  FIELD_CURRENT,
  FIELD_POWER,
  FIELD_POWER_FACTOR,
  FIELD_VOLTAGE,
} from "../../config";
import { useInterval } from "../../hooks/useInterval";
import { useRealtime } from "../../hooks/useRealtime";

type NoteRow = {
  id: number;
  time: string;
  text: string;
  anchor_time?: string | null;
};

type Row = {
  time: string;
  voltage: number | null;
  current: number | null;
  powerKw: number | null;
  pf: number | null;
  note: string | null;
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

function nearestNoteAtTime(notes: NoteRow[], targetMs: number, toleranceMs: number) {
  let bestDt = Number.POSITIVE_INFINITY;
  let bestText: string | null = null;

  for (const n of notes) {
    const refTime = n.anchor_time || n.time;
    const dt = Math.abs(toMs(refTime) - targetMs);
    if (dt < bestDt) {
      bestDt = dt;
      bestText = n.text;
    }
  }

  if (bestText === null || bestDt > toleranceMs) return null;
  return bestText;
}

function buildRows(
  voltagePoints: { time: string; value: number }[],
  currentPoints: { time: string; value: number }[],
  powerKwPoints: { time: string; value: number }[],
  pfPoints: { time: string; value: number }[],
  notes: NoteRow[]
): Row[] {
  const matchToleranceMs = 30_000;

  const rawRows = voltagePoints
    .map((v) => {
      const targetMs = toMs(v.time);

      const i = nearestValueAtTime(currentPoints, targetMs, matchToleranceMs);
      const measuredPowerKw = nearestValueAtTime(powerKwPoints, targetMs, matchToleranceMs);
      const measuredPf = nearestValueAtTime(pfPoints, targetMs, matchToleranceMs);
      const note = nearestNoteAtTime(notes, targetMs, matchToleranceMs);

      const derivedPowerKw = i == null ? null : (v.value * i) / 1000;
      const powerKw = measuredPowerKw ?? derivedPowerKw;

      const apparentVA = i == null ? null : v.value * i;
      const powerWForPf = powerKw == null ? null : powerKw * 1000;

      const derivedPf =
        powerWForPf == null || apparentVA == null || apparentVA <= 0
          ? null
          : Math.max(0, Math.min(1, powerWForPf / apparentVA));

      return {
        time: v.time,
        voltage: v.value,
        current: i,
        powerKw,
        pf: measuredPf ?? derivedPf,
        note,
      };
    })
    .sort((a, b) => toMs(b.time) - toMs(a.time));

  const seen = new Set<string>();
  const deduped: Row[] = [];

  for (const row of rawRows) {
    if (seen.has(row.time)) continue;
    seen.add(row.time);
    deduped.push(row);
  }

  return deduped;
}

function downloadCsv(rows: Row[]) {
  const header = "time,voltage_V,current_A,power_kW,power_factor,note";
  const body = rows
    .map(
      (r) =>
        `${r.time},${r.voltage ?? ""},${r.current ?? ""},${r.powerKw ?? ""},${r.pf ?? ""},"${(r.note ?? "").replace(/"/g, '""')}"`
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
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [notesError, setNotesError] = useState("");
  const [showLoadMore, setShowLoadMore] = useState(false);

  const voltageRT = useRealtime(DEFAULT_DEVICE, FIELD_VOLTAGE);
  const currentRT = useRealtime(DEFAULT_DEVICE, FIELD_CURRENT);
  const powerRT = useRealtime(DEFAULT_DEVICE, FIELD_POWER);
  const pfRT = useRealtime(DEFAULT_DEVICE, FIELD_POWER_FACTOR);

  const refreshNotes = async (requestedLimit: number) => {
    try {
      setNotesError("");

      const qs = new URLSearchParams({
        device: DEFAULT_DEVICE,
        metric: "real_power",
        limit: String(requestedLimit),
      }).toString();

      const res = await fetch(`${API_BASE}/public/notes?${qs}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }

      const json = (await res.json()) as NoteRow[];
      setNotes(json);
    } catch (e: any) {
      setNotesError(String(e?.message ?? e));
    }
  };

  const refreshAll = (requestedLimit: number) => {
    const l = String(requestedLimit);
    voltageRT.refresh(l);
    currentRT.refresh(l);
    powerRT.refresh(l);
    pfRT.refresh(l);
    refreshNotes(requestedLimit);
  };

  const handleLoadMore = () => {
    const nextLimit = limit + 100;
    setLimit(nextLimit);
    refreshAll(nextLimit);
  };

  const handleVerticalScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 140;
    setShowLoadMore(nearBottom);
  };

  useInterval(() => {
    refreshAll(limit);
  }, 10000);

  useEffect(() => {
    refreshAll(limit);
  }, []);

  const rows = useMemo(
    () => buildRows(voltageRT.points, currentRT.points, powerRT.points, pfRT.points, notes),
    [voltageRT.points, currentRT.points, powerRT.points, pfRT.points, notes]
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        onScroll={handleVerticalScroll}
        scrollEventThrottle={16}
      >
        <Text style={{ fontSize: 22, fontWeight: "700" }}>History Table</Text>

        <Text style={{ color: "#555" }}>
          Loaded rows: {rows.length}. New data refreshes automatically every 10 seconds.
        </Text>

        <Text style={{ color: "#555" }}>
          Scroll to the bottom of the table to load 100 older rows.
        </Text>

        {notesError ? <Text style={{ color: "red" }}>Notes error: {notesError}</Text> : null}

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pressable
            onPress={() => downloadCsv(rows)}
            style={{ padding: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 10 }}
          >
            <Text>Export loaded CSV</Text>
          </Pressable>
        </View>

        <ScrollView horizontal>
          <View style={{ minWidth: 1150 }}>
            <View
              style={{
                flexDirection: "row",
                borderBottomWidth: 1,
                borderColor: "#ddd",
                paddingBottom: 8,
              }}
            >
              <Text style={{ width: 260, fontWeight: "700" }}>Time</Text>
              <Text style={{ width: 140, fontWeight: "700" }}>Voltage (V)</Text>
              <Text style={{ width: 140, fontWeight: "700" }}>Current (A)</Text>
              <Text style={{ width: 140, fontWeight: "700" }}>Power (kW)</Text>
              <Text style={{ width: 140, fontWeight: "700" }}>Power Factor</Text>
              <Text style={{ width: 320, fontWeight: "700" }}>Note</Text>
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
                <Text style={{ width: 140 }}>{r.voltage != null ? r.voltage.toFixed(2) : "—"}</Text>
                <Text style={{ width: 140 }}>{r.current != null ? r.current.toFixed(3) : "—"}</Text>
                <Text style={{ width: 140 }}>{r.powerKw != null ? r.powerKw.toFixed(3) : "—"}</Text>
                <Text style={{ width: 140 }}>{r.pf != null ? r.pf.toFixed(3) : "—"}</Text>
                <Text style={{ width: 320 }}>{r.note || "—"}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {showLoadMore ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
          }}
        >
          <Pressable
            onPress={handleLoadMore}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: "#111",
              alignItems: "center",
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>↓ Load 100 more data</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
