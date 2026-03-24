import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import {
  API_BASE,
  DEFAULT_DEVICE,
  FIELD_CURRENT,
  FIELD_POWER,
  FIELD_POWER_FACTOR,
  FIELD_VOLTAGE,
  GRAFANA_PUBLIC_DASHBOARD_URL,
  METRIC_POWER,
} from "../../config";

import { useAuth } from "../../hooks/useAuth";
import { useInterval } from "../../hooks/useInterval";
import { useNotes, useNotesInWindow } from "../../hooks/useNotes";
import { useRealtime } from "../../hooks/useRealtime";
import { createNote, deleteNote } from "../../lib/api";

import { AuthPanel } from "../../components/AuthPanel";
import DailyKwhBarCard from "../../components/DailyKwhBarCard";
import { NotesBelowGraph } from "../../components/NotesBelowGraph";
import { SimpleLineChart } from "../../components/SimpleLineChart";

type Point = {
  time: string;
  value: number;
};

type ChartNote = {
  id: number;
  time: string;
  text: string;
};

type NoteBelow = {
  id: number;
  time: string;
  text: string;
  valueAtNote: number | null;
};

type PowerNoteMode = "intervaled" | "realtime";

const FIELD_REALTIME_POWER = "power_realtime";

const ARCHIVE_LIMIT = "500";
const REALTIME_POWER_LIMIT = "2000";

const ARCHIVE_REFRESH_MS = 30 * 60 * 1000;
const REALTIME_POWER_REFRESH_MS = 30 * 1000;
const NOTES_REFRESH_MS = 15 * 1000;

const PAGE_PADDING = 16;
const CARD_GAP = 14;

function toMs(iso: string) {
  return new Date(iso).getTime();
}

function valueNearTime(points: Point[], iso: string, toleranceSec = 120): number | null {
  if (!points.length) return null;

  const target = toMs(iso);
  let bestDt = Number.POSITIVE_INFINITY;
  let bestValue: number | null = null;

  for (const p of points) {
    const dt = Math.abs(toMs(p.time) - target);
    if (dt < bestDt) {
      bestDt = dt;
      bestValue = p.value;
    }
  }

  if (bestValue === null || bestDt > toleranceSec * 1000) return null;
  return bestValue;
}

function sanitizePoints(points: Point[]): Point[] {
  return points.filter(
    (p) =>
      p &&
      typeof p.time === "string" &&
      typeof p.value === "number" &&
      Number.isFinite(p.value)
  );
}

function latestValue(points: Point[]): number | null {
  const clean = sanitizePoints(points);
  return clean.length ? clean[clean.length - 1].value : null;
}

function formatLatestValue(value: number | null, decimals: number, unit?: string) {
  if (value === null) return "—";
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

function LatestValueBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
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
      <Text style={{ fontSize: 26, fontWeight: "800", color: "#111827" }}>{value}</Text>
    </View>
  );
}

function ChartCard({
  title,
  latestLabel,
  latestValueText,
  minHeight = 400,
  children,
}: {
  title: string;
  latestLabel: string;
  latestValueText: string;
  minHeight?: number;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        gap: 12,
        minHeight,
        padding: 16,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 16,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700" }}>{title}</Text>
      <LatestValueBox label={latestLabel} value={latestValueText} />
      {children}
    </View>
  );
}

function normalizeTimestampInput(s: string): string | null {
  const raw = s.trim();
  if (!raw) return null;

  const normalized = raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw;
  const d = new Date(normalized);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d.toISOString();
}

export default function TabOneScreen() {
  const { width } = useWindowDimensions();

  const showPairsSideBySide = width >= 760;
  const pairDirection = showPairsSideBySide ? "row" : "column";

  const pairCardWidth = showPairsSideBySide
    ? (width - PAGE_PADDING * 2 - CARD_GAP) / 2
    : width - PAGE_PADDING * 2;

  const voltageRT = useRealtime(DEFAULT_DEVICE, FIELD_VOLTAGE);
  const currentRT = useRealtime(DEFAULT_DEVICE, FIELD_CURRENT);
  const powerRT = useRealtime(DEFAULT_DEVICE, FIELD_POWER);
  const pfRT = useRealtime(DEFAULT_DEVICE, FIELD_POWER_FACTOR);
  const realtimePowerRT = useRealtime(DEFAULT_DEVICE, FIELD_REALTIME_POWER);

  const voltagePoints = useMemo(() => sanitizePoints(voltageRT.points), [voltageRT.points]);
  const currentPoints = useMemo(() => sanitizePoints(currentRT.points), [currentRT.points]);
  const intervaledPowerPoints = useMemo(() => sanitizePoints(powerRT.points), [powerRT.points]);
  const pfPoints = useMemo(() => sanitizePoints(pfRT.points), [pfRT.points]);
  const realtimePowerPoints = useMemo(
    () => sanitizePoints(realtimePowerRT.points),
    [realtimePowerRT.points]
  );

  const powerNotesQ = useNotes(DEFAULT_DEVICE, METRIC_POWER);

  const intervaledPowerNotesRaw = useMemo(
    () =>
      powerNotesQ.notes
        .filter((n: any) => n.anchor_field === FIELD_POWER)
        .map((n: any) => ({
          ...n,
          time: n.anchor_time ?? n.time,
        })),
    [powerNotesQ.notes]
  );

  const realtimePowerNotesRaw = useMemo(
    () =>
      powerNotesQ.notes
        .filter((n: any) => n.anchor_field === FIELD_REALTIME_POWER)
        .map((n: any) => ({
          ...n,
          time: n.anchor_time ?? n.time,
        })),
    [powerNotesQ.notes]
  );

  const intervaledPowerNotesInView = useNotesInWindow(intervaledPowerPoints, intervaledPowerNotesRaw);
  const realtimePowerNotesInView = useNotesInWindow(realtimePowerPoints, realtimePowerNotesRaw);

  const { token, busy, status, doLogin, doSignup, logout } = useAuth();

  const [noteText, setNoteText] = useState("");
  const [noteMode, setNoteMode] = useState<PowerNoteMode>("intervaled");
  const [manualTimestamp, setManualTimestamp] = useState("");

  const [selectedIntervaledPowerNoteId, setSelectedIntervaledPowerNoteId] = useState<number | null>(null);
  const [selectedRealtimePowerNoteId, setSelectedRealtimePowerNoteId] = useState<number | null>(null);

  const [selectedIntervaledPowerPoint, setSelectedIntervaledPowerPoint] = useState<Point | null>(null);
  const [selectedRealtimePowerPoint, setSelectedRealtimePowerPoint] = useState<Point | null>(null);

  const manualTimestampPreview = useMemo(
    () => normalizeTimestampInput(manualTimestamp),
    [manualTimestamp]
  );

  useInterval(() => voltageRT.refresh(ARCHIVE_LIMIT), ARCHIVE_REFRESH_MS);
  useInterval(() => currentRT.refresh(ARCHIVE_LIMIT), ARCHIVE_REFRESH_MS);
  useInterval(() => powerRT.refresh(ARCHIVE_LIMIT), ARCHIVE_REFRESH_MS);
  useInterval(() => pfRT.refresh(ARCHIVE_LIMIT), ARCHIVE_REFRESH_MS);

  useInterval(() => realtimePowerRT.refresh(REALTIME_POWER_LIMIT), REALTIME_POWER_REFRESH_MS);
  useInterval(() => powerNotesQ.refresh(200), NOTES_REFRESH_MS);

  useEffect(() => {
    voltageRT.refresh(ARCHIVE_LIMIT);
    currentRT.refresh(ARCHIVE_LIMIT);
    powerRT.refresh(ARCHIVE_LIMIT);
    pfRT.refresh(ARCHIVE_LIMIT);
    realtimePowerRT.refresh(REALTIME_POWER_LIMIT);
    powerNotesQ.refresh(200);
  }, []);

  const latestVoltage = latestValue(voltagePoints);
  const latestCurrent = latestValue(currentPoints);
  const latestIntervaledPower = latestValue(intervaledPowerPoints);
  const latestRealtimePower = latestValue(realtimePowerPoints);
  const latestPF = latestValue(pfPoints);

  const intervaledPowerChartNotes = useMemo<ChartNote[]>(
    () => intervaledPowerNotesInView.map((n: any) => ({ id: n.id, time: n.time, text: n.text })),
    [intervaledPowerNotesInView]
  );

  const realtimePowerChartNotes = useMemo<ChartNote[]>(
    () => realtimePowerNotesInView.map((n: any) => ({ id: n.id, time: n.time, text: n.text })),
    [realtimePowerNotesInView]
  );

  const intervaledPowerNotesBelow = useMemo<NoteBelow[]>(
    () =>
      intervaledPowerNotesInView.map((n: any) => ({
        id: n.id,
        time: n.time,
        text: n.text,
        valueAtNote:
          typeof n.anchor_value === "number"
            ? n.anchor_value
            : valueNearTime(intervaledPowerPoints, n.time, 1900),
      })),
    [intervaledPowerNotesInView, intervaledPowerPoints]
  );

  const realtimePowerNotesBelow = useMemo<NoteBelow[]>(
    () =>
      realtimePowerNotesInView.map((n: any) => ({
        id: n.id,
        time: n.time,
        text: n.text,
        valueAtNote:
          typeof n.anchor_value === "number"
            ? n.anchor_value
            : valueNearTime(realtimePowerPoints, n.time, 120),
      })),
    [realtimePowerNotesInView, realtimePowerPoints]
  );

  function getActiveField() {
    return noteMode === "intervaled" ? FIELD_POWER : FIELD_REALTIME_POWER;
  }

  function getActivePoint() {
    return noteMode === "intervaled" ? selectedIntervaledPowerPoint : selectedRealtimePowerPoint;
  }

  function handleManualTimestampChange(value: string) {
    setManualTimestamp(value);
    setSelectedIntervaledPowerPoint(null);
    setSelectedRealtimePowerPoint(null);
  }

  async function openGrafanaDashboard() {
    try {
      await Linking.openURL(GRAFANA_PUBLIC_DASHBOARD_URL);
    } catch (e: any) {
      Alert.alert("Open dashboard failed", String(e?.message ?? e));
    }
  }

  async function addNote() {
    if (!token) {
      Alert.alert("Login required", "Please login to add notes.");
      return;
    }

    if (!noteText.trim()) {
      Alert.alert("Missing note", "Please write a note first.");
      return;
    }

    const selectedPoint = getActivePoint();
    const normalizedManualTimestamp = manualTimestampPreview;

    if (!selectedPoint && !normalizedManualTimestamp) {
      Alert.alert(
        "Choose timestamp",
        "Tap a numbered point on a power graph, use the quick picker below the graph, or manually enter a timestamp."
      );
      return;
    }

    const anchorField = getActiveField();
    const anchorTime = selectedPoint?.time ?? normalizedManualTimestamp!;
    const anchorValue = selectedPoint?.value ?? null;

    try {
      await createNote(token, {
        device: DEFAULT_DEVICE,
        metric: METRIC_POWER,
        text: noteText.trim(),
        time: anchorTime,
        anchor_time: anchorTime,
        anchor_value: anchorValue,
        anchor_field: anchorField,
      });

      setNoteText("");
      setManualTimestamp("");
      setSelectedIntervaledPowerPoint(null);
      setSelectedRealtimePowerPoint(null);
      await powerNotesQ.refresh(200);
    } catch (e: any) {
      Alert.alert("Add note failed", String(e?.message ?? e));
    }
  }

  async function handleDeleteNote(noteId: number) {
    if (!token) {
      Alert.alert("Login required", "Please login to delete notes.");
      return;
    }

    try {
      await deleteNote(token, noteId);
      await powerNotesQ.refresh(200);
      setSelectedIntervaledPowerNoteId((prev) => (prev === noteId ? null : prev));
      setSelectedRealtimePowerNoteId((prev) => (prev === noteId ? null : prev));
    } catch (e: any) {
      Alert.alert("Delete note failed", String(e?.message ?? e));
    }
  }

  const activeSelectedPoint = getActivePoint();

  return (
    <ScrollView contentContainerStyle={{ padding: PAGE_PADDING, gap: CARD_GAP }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>EnergiLink Live Monitoring</Text>
      <Text style={{ color: "#555" }}>API_BASE: {API_BASE}</Text>

      {voltageRT.error ? <Text style={{ color: "red" }}>voltage error: {voltageRT.error}</Text> : null}
      {currentRT.error ? <Text style={{ color: "red" }}>current error: {currentRT.error}</Text> : null}
      {powerRT.error ? <Text style={{ color: "red" }}>intervaled power error: {powerRT.error}</Text> : null}
      {realtimePowerRT.error ? (
        <Text style={{ color: "red" }}>realtime power error: {realtimePowerRT.error}</Text>
      ) : null}
      {pfRT.error ? <Text style={{ color: "red" }}>power factor error: {pfRT.error}</Text> : null}

      <Pressable
        onPress={() => {
          voltageRT.refresh(ARCHIVE_LIMIT);
          currentRT.refresh(ARCHIVE_LIMIT);
          powerRT.refresh(ARCHIVE_LIMIT);
          pfRT.refresh(ARCHIVE_LIMIT);
          realtimePowerRT.refresh(REALTIME_POWER_LIMIT);
          powerNotesQ.refresh(200);
        }}
        style={{
          padding: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#ddd",
          alignSelf: "flex-start",
        }}
      >
        <Text>Refresh now</Text>
      </Pressable>

      <View style={{ flexDirection: pairDirection, gap: CARD_GAP, alignItems: "flex-start" }}>
        <View style={{ width: pairCardWidth }}>
          <ChartCard
            title="Voltage (30-minute archive)"
            latestLabel="Latest voltage"
            latestValueText={formatLatestValue(latestVoltage, 2, "V")}
            minHeight={390}
          >
            <SimpleLineChart
              points={voltagePoints}
              unit="V"
              decimals={2}
              height={240}
              hoursBeforeLatest={3}
              hoursAfterLatest={2}
            />
          </ChartCard>
        </View>

        <View style={{ width: pairCardWidth }}>
          <ChartCard
            title="Current (30-minute archive)"
            latestLabel="Latest current"
            latestValueText={formatLatestValue(latestCurrent, 3, "A")}
            minHeight={390}
          >
            <SimpleLineChart
              points={currentPoints}
              unit="A"
              decimals={3}
              height={240}
              hoursBeforeLatest={3}
              hoursAfterLatest={2}
            />
          </ChartCard>
        </View>
      </View>

      <DailyKwhBarCard days={14} />

      <View style={{ flexDirection: pairDirection, gap: CARD_GAP, alignItems: "flex-start" }}>
        <View style={{ width: pairCardWidth }}>
          <ChartCard
            title="Intervaled Power Graph (30-minute archive)"
            latestLabel="Latest archived power"
            latestValueText={formatLatestValue(latestIntervaledPower, 2, "W")}
            minHeight={470}
          >
            <Text style={{ color: "#555" }}>
              Numbered points always follow the current visible graph. If a selected point leaves the graph, it is cleared automatically.
            </Text>
            <Text style={{ color: "#555" }}>
              notes total: {intervaledPowerNotesRaw.length} | notes in window: {intervaledPowerNotesInView.length}
            </Text>

            <SimpleLineChart
              points={intervaledPowerPoints}
              notes={intervaledPowerChartNotes}
              unit="W"
              decimals={2}
              height={230}
              hoursBeforeLatest={3}
              hoursAfterLatest={2}
              selectedNoteId={selectedIntervaledPowerNoteId}
              selectedPointTime={selectedIntervaledPowerPoint?.time ?? null}
              onSelectNoteId={(id) => setSelectedIntervaledPowerNoteId(id)}
              onSelectPoint={(point) => {
                setNoteMode("intervaled");
                setSelectedIntervaledPowerPoint(point);
                setManualTimestamp("");
              }}
              onSelectedPointInvalid={() => setSelectedIntervaledPowerPoint(null)}
              numberedPointSelection={true}
              maxNumberedPoints={8}
              showPointChooser={true}
            />
          </ChartCard>
        </View>

        <View style={{ width: pairCardWidth }}>
          <ChartCard
            title="Realtime Power Graph (30 seconds)"
            latestLabel="Latest realtime power"
            latestValueText={formatLatestValue(latestRealtimePower, 2, "W")}
            minHeight={470}
          >
            <Text style={{ color: "#555" }}>
              Numbered points always follow the current visible graph. If a selected point leaves the graph, it is cleared automatically.
            </Text>
            <Text style={{ color: "#555" }}>
              notes total: {realtimePowerNotesRaw.length} | notes in window: {realtimePowerNotesInView.length}
            </Text>

            <SimpleLineChart
              points={realtimePowerPoints}
              notes={realtimePowerChartNotes}
              unit="W"
              decimals={2}
              height={230}
              hoursBeforeLatest={3}
              hoursAfterLatest={2}
              selectedNoteId={selectedRealtimePowerNoteId}
              selectedPointTime={selectedRealtimePowerPoint?.time ?? null}
              onSelectNoteId={(id) => setSelectedRealtimePowerNoteId(id)}
              onSelectPoint={(point) => {
                setNoteMode("realtime");
                setSelectedRealtimePowerPoint(point);
                setManualTimestamp("");
              }}
              onSelectedPointInvalid={() => setSelectedRealtimePowerPoint(null)}
              numberedPointSelection={true}
              maxNumberedPoints={10}
              showPointChooser={true}
            />
          </ChartCard>
        </View>
      </View>

      <View style={{ flexDirection: pairDirection, gap: CARD_GAP, alignItems: "flex-start" }}>
        <View style={{ width: pairCardWidth }}>
          <NotesBelowGraph
            notes={intervaledPowerNotesBelow}
            selectedNoteId={selectedIntervaledPowerNoteId}
            onSelectNoteId={(id) => setSelectedIntervaledPowerNoteId(id)}
            onClear={() => setSelectedIntervaledPowerNoteId(null)}
            valueLabel="Intervaled power at note"
            unit="W"
            decimals={2}
            canDelete={!!token}
            onDelete={(id) => handleDeleteNote(id)}
          />
        </View>

        <View style={{ width: pairCardWidth }}>
          <NotesBelowGraph
            notes={realtimePowerNotesBelow}
            selectedNoteId={selectedRealtimePowerNoteId}
            onSelectNoteId={(id) => setSelectedRealtimePowerNoteId(id)}
            onClear={() => setSelectedRealtimePowerNoteId(null)}
            valueLabel="Realtime power at note"
            unit="W"
            decimals={2}
            canDelete={!!token}
            onDelete={(id) => handleDeleteNote(id)}
          />
        </View>
      </View>

      <View>
        <ChartCard
          title="Power Factor (30-minute archive)"
          latestLabel="Latest power factor"
          latestValueText={formatLatestValue(latestPF, 3)}
          minHeight={390}
        >
          <SimpleLineChart
            points={pfPoints}
            unit="PF"
            decimals={3}
            height={240}
            hoursBeforeLatest={3}
            hoursAfterLatest={2}
          />
        </ChartCard>
      </View>

      <AuthPanel
        token={token}
        busy={busy}
        status={status}
        onLogin={async (email, password) => {
          await doLogin(email, password);
        }}
        onSignup={async (email, password) => {
          await doSignup(email, password);
        }}
        onLogout={logout}
      />

      {token ? (
        <View
          style={{
            gap: 8,
            padding: 12,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 14,
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontWeight: "700" }}>Add note to power graph</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              onPress={() => setNoteMode("intervaled")}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: noteMode === "intervaled" ? "#111" : "#ddd",
                backgroundColor: noteMode === "intervaled" ? "#111" : "#fff",
              }}
            >
              <Text style={{ color: noteMode === "intervaled" ? "#fff" : "#111", fontWeight: "600" }}>
                Intervaled Power
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setNoteMode("realtime")}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: noteMode === "realtime" ? "#111" : "#ddd",
                backgroundColor: noteMode === "realtime" ? "#111" : "#fff",
              }}
            >
              <Text style={{ color: noteMode === "realtime" ? "#fff" : "#111", fontWeight: "600" }}>
                Realtime Power
              </Text>
            </Pressable>
          </View>

          <Text style={{ color: "#555" }}>
            Selected point:{" "}
            {activeSelectedPoint
              ? `${new Date(activeSelectedPoint.time).toLocaleString()} | ${activeSelectedPoint.value.toFixed(2)} W`
              : "None"}
          </Text>

          <Text style={{ color: "#555" }}>
            Manual timestamp:{" "}
            {manualTimestampPreview
              ? new Date(manualTimestampPreview).toLocaleString()
              : "None"}
          </Text>

          <Text style={{ color: "#555" }}>
            If a selected numbered point leaves the visible graph, it is cleared automatically so you do not save an old hidden point by mistake.
          </Text>

          <TextInput
            value={manualTimestamp}
            onChangeText={handleManualTimestampChange}
            placeholder="Optional timestamp (example: 2026-03-15 14:30 or 2026-03-15T14:30:00)"
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 10,
              backgroundColor: "#fff",
            }}
          />

          <Text style={{ color: "#555" }}>
            Typing a manual timestamp clears any selected graph point.
          </Text>

          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Write a power note..."
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 10,
              backgroundColor: "#fff",
            }}
          />

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => {
                setManualTimestamp("");
                setSelectedIntervaledPowerPoint(null);
                setSelectedRealtimePowerPoint(null);
              }}
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#ddd",
                alignItems: "center",
              }}
            >
              <Text>Clear time selection</Text>
            </Pressable>

            <Pressable
              onPress={addNote}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: "#111",
                alignItems: "center",
                flex: 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                Add Power note
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View
        style={{
          gap: 8,
          padding: 12,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          borderRadius: 14,
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontWeight: "700" }}>Grafana public dashboard</Text>
        <Text style={{ color: "#555" }}>
          This opens the single Grafana public dashboard that contains all of your Grafana panels.
        </Text>

        <Pressable
          onPress={openGrafanaDashboard}
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: "#111",
            alignItems: "center",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Open Grafana dashboard</Text>
        </Pressable>

        <Text selectable style={{ color: "#2563eb" }}>
          {GRAFANA_PUBLIC_DASHBOARD_URL}
        </Text>
      </View>
    </ScrollView>
  );
}
