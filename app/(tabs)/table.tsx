import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { API_BASE, DEFAULT_DEVICE } from "../../config";
import { saveHistoryNote } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { AuthPanel } from "../../components/AuthPanel";

type HistoryRow = {
  time: string;
  rms_voltage: number | null;
  rms_current: number | null;
  power: number | null;
  power_factor: number | null;
  note_id?: number | null;
  note?: string | null;
};

type HistoryMonth = {
  month_key: string;
  year: number;
  month: number;
  label: string;
  rows: number;
};

const HISTORY_FETCH_LIMIT = 100000;

function formatValue(
  value: number | null | undefined,
  decimals: number,
  unit?: string
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

function formatTime(value: string) {
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return value;
  }

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

    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
  }

  return null;
}

function escapeCsvValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

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

function monthKeyFromTime(value: string) {
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");

  return `${y}-${m}`;
}

function monthLabelFromKey(key: string) {
  const [year, month] = key.split("-").map(Number);

  if (!year || !month) {
    return key;
  }

  const d = new Date(year, month - 1, 1);

  return d.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function shiftMonthKey(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);

  if (!year || !month) {
    return key;
  }

  const d = new Date(year, month - 1, 1);
  d.setMonth(d.getMonth() + offset);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");

  return `${y}-${m}`;
}

function EditableNoteCell({
  token,
  row,
  onSaved,
}: {
  token: string;
  row: HistoryRow;
  onSaved: (time: string, note: string | null, noteId: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.note ?? "");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(row.note ?? "");
  }, [row.note]);

  async function handleSave() {
    try {
      setSaving(true);
      setLocalError(null);

      const result = await saveHistoryNote(token, {
        device: DEFAULT_DEVICE,
        time: row.time,
        text: draft,
        anchor_field: "power",
      });

      onSaved(row.time, result.note ?? null, result.note_id ?? null);
      setDraft(result.note ?? "");
      setEditing(false);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setLocalError(msg);
      Alert.alert("Save failed", msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      setSaving(true);
      setLocalError(null);

      const result = await saveHistoryNote(token, {
        device: DEFAULT_DEVICE,
        time: row.time,
        text: "",
        anchor_field: "power",
      });

      onSaved(row.time, result.note ?? null, result.note_id ?? null);
      setDraft("");
      setEditing(false);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setLocalError(msg);
      Alert.alert("Delete failed", msg);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <View style={{ width: 320, gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type note for this row"
          multiline
          style={{
            minHeight: 44,
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 10,
            padding: 8,
            backgroundColor: "#fff",
            color: "#111827",
          }}
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Pressable
            disabled={saving}
            onPress={handleSave}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: "#111827",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {saving ? "Saving..." : "Save"}
            </Text>
          </Pressable>

          <Pressable
            disabled={saving}
            onPress={() => {
              setDraft(row.note ?? "");
              setEditing(false);
              setLocalError(null);
            }}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#d1d5db",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text style={{ fontWeight: "700" }}>Cancel</Text>
          </Pressable>
        </View>

        {localError ? (
          <Text style={{ color: "red", fontSize: 12 }}>
            {localError}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ width: 320, gap: 6 }}>
      <Text style={{ color: row.note?.trim() ? "#111827" : "#9ca3af" }}>
        {row.note?.trim() ? row.note : "—"}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Pressable
          disabled={saving}
          onPress={() => {
            setDraft(row.note ?? "");
            setEditing(true);
            setLocalError(null);
          }}
          style={{
            alignSelf: "flex-start",
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#d1d5db",
            backgroundColor: "#fff",
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ fontWeight: "700" }}>
            {row.note?.trim() ? "Edit" : "Add Note"}
          </Text>
        </Pressable>

        {row.note?.trim() ? (
          <Pressable
            disabled={saving}
            onPress={handleDelete}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 7,
              paddingHorizontal: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#fecaca",
              backgroundColor: "#fef2f2",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#b91c1c", fontWeight: "700" }}>
              {saving ? "Deleting..." : "Delete"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {localError ? (
        <Text style={{ color: "red", fontSize: 12 }}>
          {localError}
        </Text>
      ) : null}
    </View>
  );
}

export default function TableScreen() {
  const auth = useAuth();
  const token = auth.token;

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [historyMonths, setHistoryMonths] = useState<HistoryMonth[]>([]);

  const fetchAvailableMonths = useCallback(async () => {
    const qs = new URLSearchParams({
      device: DEFAULT_DEVICE,
    }).toString();

    const res = await fetch(`${API_BASE}/public/history/months?${qs}`);
    const text = await res.text();

    if (!res.ok) {
      throw new Error(`Month list failed (${res.status}): ${text.slice(0, 160)}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        `History months endpoint did not return JSON. Response starts with: ${text.slice(
          0,
          120
        )}`
      );
    }

    const nextMonths = Array.isArray(parsed) ? (parsed as HistoryMonth[]) : [];
    setHistoryMonths(nextMonths);

    if (!selectedMonth && nextMonths.length > 0) {
      setSelectedMonth(nextMonths[0].month_key);
    }

    return nextMonths;
  }, [selectedMonth]);

  const fetchHistory = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        if (!selectedMonth) {
          setRows([]);
          return;
        }

        const [year, month] = selectedMonth.split("-").map(Number);

        const qs = new URLSearchParams({
          device: DEFAULT_DEVICE,
          limit: String(HISTORY_FETCH_LIMIT),
        });

        if (year && month) {
          qs.set("year", String(year));
          qs.set("month", String(month));
        }

        const res = await fetch(`${API_BASE}/public/history?${qs.toString()}`);
        const text = await res.text();

        if (!res.ok) {
          throw new Error(
            `Request failed (${res.status}): ${text.slice(0, 160)}`
          );
        }

        let parsed: unknown;

        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(
            `History endpoint did not return JSON. Response starts with: ${text.slice(
              0,
              120
            )}`
          );
        }

        const nextRows = Array.isArray(parsed) ? (parsed as HistoryRow[]) : [];
        setRows(nextRows);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedMonth]
  );

  useEffect(() => {
    fetchAvailableMonths().catch((e: any) => {
      setError(String(e?.message ?? e));
      setLoading(false);
    });
  }, [fetchAvailableMonths]);

  useEffect(() => {
    fetchHistory(false);
  }, [fetchHistory]);

  const availableMonths = useMemo(() => {
    return historyMonths.map((item) => item.month_key);
  }, [historyMonths]);

  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const filteredRows = useMemo(() => {
    if (!selectedMonth) {
      return rows;
    }

    return rows.filter((row) => monthKeyFromTime(row.time) === selectedMonth);
  }, [rows, selectedMonth]);

  const exportToCSV = useCallback(() => {
    if (!filteredRows.length) {
      return;
    }

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

    const csvRows = filteredRows.map((row) => [
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
    const stamp = selectedMonth || new Date().toISOString().slice(0, 7);

    link.href = url;
    link.download = `history-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredRows, selectedMonth]);

  const handleNoteSaved = useCallback(
    (time: string, note: string | null, noteId: number | null) => {
      setRows((prev) =>
        prev.map((row) =>
          row.time === time
            ? {
                ...row,
                note,
                note_id: noteId,
              }
            : row
        )
      );
    },
    []
  );

  const latestVoltage = useMemo(
    () => latestNonNull(filteredRows, "rms_voltage"),
    [filteredRows]
  );

  const latestCurrent = useMemo(
    () => latestNonNull(filteredRows, "rms_current"),
    [filteredRows]
  );

  const latestPower = useMemo(
    () => latestNonNull(filteredRows, "power"),
    [filteredRows]
  );

  const latestPf = useMemo(
    () => latestNonNull(filteredRows, "power_factor"),
    [filteredRows]
  );

  const selectedMonthLabel = selectedMonth
    ? monthLabelFromKey(selectedMonth)
    : "Current Month";

  const canGoPrev = selectedMonth
    ? availableMonths.includes(shiftMonthKey(selectedMonth, -1))
    : false;

  const canGoNext = selectedMonth
    ? availableMonths.includes(shiftMonthKey(selectedMonth, 1))
    : false;

  if (!token) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>
          Login Required
        </Text>

        <Text style={{ color: "#555", lineHeight: 20 }}>
          You must log in first before you can manually edit notes in the
          History Table.
        </Text>

        <AuthPanel
          token={auth.token}
          busy={auth.busy}
          status={auth.status}
          onLogin={async (email, password) => {
            await auth.doLogin(email, password);
          }}
          onSignup={async (email, password) => {
            await auth.doSignup(email, password);
          }}
          onLogout={auth.logout}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            await fetchAvailableMonths();
            await fetchHistory(true);
          }}
        />
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
        <Text style={{ fontSize: 20, fontWeight: "700" }}>
          History Table
        </Text>

        <Text style={{ color: "#555" }}>
          This table shows archived monthly history from the database, including voltage, current, power, power factor, and editable
          notes per row.
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Pressable
            disabled={!canGoPrev}
            onPress={() => setSelectedMonth((prev) => shiftMonthKey(prev, -1))}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#fff",
              opacity: canGoPrev ? 1 : 0.5,
            }}
          >
            <Text style={{ fontWeight: "700" }}>Prev Month</Text>
          </Pressable>

          <View
            style={{
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#f8fafc",
            }}
          >
            <Text style={{ fontWeight: "700" }}>{selectedMonthLabel}</Text>
          </View>

          <Pressable
            disabled={!canGoNext}
            onPress={() => setSelectedMonth((prev) => shiftMonthKey(prev, 1))}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d1d5db",
              backgroundColor: "#fff",
              opacity: canGoNext ? 1 : 0.5,
            }}
          >
            <Text style={{ fontWeight: "700" }}>Next Month</Text>
          </Pressable>
        </View>

        {historyMonths.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "700", color: "#374151" }}>Previous Data</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {historyMonths.map((item) => (
                <Pressable
                  key={item.month_key}
                  onPress={() => setSelectedMonth(item.month_key)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selectedMonth === item.month_key ? "#111827" : "#d1d5db",
                    backgroundColor: selectedMonth === item.month_key ? "#111827" : "#fff",
                  }}
                >
                  <Text
                    style={{
                      color: selectedMonth === item.month_key ? "#fff" : "#111827",
                      fontWeight: "700",
                    }}
                  >
                    {item.label} ({item.rows})
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

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
            <Text
              style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}
            >
              Latest Voltage
            </Text>

            <Text
              style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}
            >
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
            <Text
              style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}
            >
              Latest Current
            </Text>

            <Text
              style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}
            >
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
            <Text
              style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}
            >
              Latest Power
            </Text>

            <Text
              style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}
            >
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
            <Text
              style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}
            >
              Latest PF
            </Text>

            <Text
              style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}
            >
              {formatValue(latestPf, 3)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Pressable
            onPress={async () => {
              await fetchAvailableMonths();
              await fetchHistory(true);
            }}
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
              opacity: filteredRows.length ? 1 : 0.6,
            }}
          >
            <Text style={{ fontWeight: "700", color: "#1d4ed8" }}>
              Export {selectedMonthLabel} CSV
            </Text>
          </Pressable>
        </View>

        {error ? (
          <Text style={{ color: "red" }}>
            history error: {error}
          </Text>
        ) : null}
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
          <View style={{ minWidth: 1060 }}>
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
              <Text
                style={{ width: 220, fontWeight: "800", color: "#111827" }}
              >
                Time
              </Text>

              <Text
                style={{ width: 130, fontWeight: "800", color: "#111827" }}
              >
                Voltage
              </Text>

              <Text
                style={{ width: 130, fontWeight: "800", color: "#111827" }}
              >
                Current
              </Text>

              <Text
                style={{ width: 130, fontWeight: "800", color: "#111827" }}
              >
                Power
              </Text>

              <Text
                style={{ width: 110, fontWeight: "800", color: "#111827" }}
              >
                PF
              </Text>

              <Text
                style={{ width: 320, fontWeight: "800", color: "#111827" }}
              >
                Note
              </Text>
            </View>

            {loading ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: "#555" }}>
                  Loading history...
                </Text>
              </View>
            ) : filteredRows.length === 0 ? (
              <View style={{ padding: 20 }}>
                <Text style={{ color: "#555" }}>
                  No rows found for {selectedMonthLabel}.
                </Text>
              </View>
            ) : (
              filteredRows.map((row, idx) => (
                <View
                  key={`${row.time}-${idx}`}
                  style={{
                    flexDirection: "row",
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderBottomWidth:
                      idx === filteredRows.length - 1 ? 0 : 1,
                    borderBottomColor: "#f3f4f6",
                    backgroundColor: idx % 2 === 0 ? "#fff" : "#fcfcfd",
                  }}
                >
                  <Text style={{ width: 220, color: "#111827" }}>
                    {formatTime(row.time)}
                  </Text>

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

                  <EditableNoteCell
                    token={token}
                    row={row}
                    onSaved={handleNoteSaved}
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      <Text style={{ color: "#6b7280", fontSize: 12 }}>
        Voltage, current, power, and power factor are sensor readings. Only the
        note column is manually editable.
      </Text>
    </ScrollView>
  );
}
