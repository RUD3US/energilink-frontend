import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getMonthlyBillingSummary,
  saveMonthlyBillingRate,
  type MonthlyBillingRow,
} from "../lib/api";

type Props = {
  token?: string | null;
  device?: string;
  field?: string;
};

type DraftRateMap = Record<string, string>;

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
        minWidth: 150,
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
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>{value}</Text>
    </View>
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

function safeMoney(value: unknown) {
  const n = toNumber(value);
  return `Php ${n.toFixed(2)}`;
}

function makeDraftKey(year: number, month: number) {
  return `${year}-${month}`;
}

export default function MonthlyBillingCard({
  token = null,
  device = "pi4",
  field = "power",
}: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<MonthlyBillingRow[]>([]);
  const [draftRates, setDraftRates] = useState<DraftRateMap>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getMonthlyBillingSummary({
        year,
        device,
        field,
      });

      const normalized = Array.isArray(result) ? result : [];
      setRows(normalized);

      setDraftRates((prev) => {
        const next = { ...prev };

        for (const row of normalized) {
          const key = makeDraftKey(row.year, row.month);
          next[key] =
            row.cost_per_kwh !== null && row.cost_per_kwh !== undefined
              ? String(row.cost_per_kwh)
              : "";
        }

        return next;
      });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [year, device, field]);

  useEffect(() => {
    setStatus("");
    refresh();
  }, [refresh]);

  const displayRows = useMemo(() => {
    return rows.map((row) => {
      const key = makeDraftKey(row.year, row.month);
      const rawDraft = draftRates[key] ?? "";
      const parsedRate =
        rawDraft.trim() !== ""
          ? Number(rawDraft)
          : row.cost_per_kwh ?? null;

      const finalRate =
        parsedRate !== null && Number.isFinite(parsedRate) && Number(parsedRate) > 0
          ? Number(parsedRate)
          : null;

      const billPhp =
        finalRate !== null ? Number((row.kwh * finalRate).toFixed(2)) : null;

      return {
        ...row,
        display_rate: finalRate,
        display_bill_php: billPhp,
        draft_key: key,
      };
    });
  }, [rows, draftRates]);

  const now = new Date();
  const currentMonth = year === now.getFullYear() ? now.getMonth() + 1 : null;

  const currentMonthRow = useMemo(() => {
    if (!currentMonth) return null;
    return displayRows.find((row) => row.month === currentMonth) ?? null;
  }, [displayRows, currentMonth]);

  const yearTotalBill = useMemo(() => {
    return displayRows.reduce((sum, row) => sum + (row.display_bill_php ?? 0), 0);
  }, [displayRows]);

  const yearTotalKwh = useMemo(() => {
    return displayRows.reduce((sum, row) => sum + (row.kwh ?? 0), 0);
  }, [displayRows]);

  async function handleSave(row: MonthlyBillingRow) {
    const key = makeDraftKey(row.year, row.month);
    const raw = draftRates[key] ?? "";
    const parsed = Number(raw);

    if (!token) {
      Alert.alert(
        "Login required",
        "Billing rate saving needs a logged-in account."
      );
      return;
    }

    if (raw.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      Alert.alert("Invalid value", "Please enter a valid Php/kWh value.");
      return;
    }

    try {
      setSavingKey(key);
      setStatus("");

      await saveMonthlyBillingRate(
        token,
        {
          year: row.year,
          month: row.month,
          cost_per_kwh: parsed,
        },
        {
          device,
          field,
        }
      );

      setStatus(`Saved ${row.month_label} ${row.year} billing record.`);
      await refresh();
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message ?? e));
    } finally {
      setSavingKey(null);
    }
  }

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
          <Text style={{ fontSize: 16, fontWeight: "700" }}>
            Monthly Cost Calculator
          </Text>
          <Text style={{ color: "#555" }}>
            Saves kWh, Php/kWh, and bill per exact month and year.
          </Text>
        </View>

        <Pressable
          onPress={refresh}
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
            {loading ? "Refreshing..." : "Refresh billing"}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Pressable
          onPress={() => setYear((prev) => prev - 1)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#d1d5db",
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontWeight: "700" }}>Prev Year</Text>
        </Pressable>

        <View
          style={{
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#d1d5db",
            backgroundColor: "#f8fafc",
          }}
        >
          <Text style={{ fontWeight: "800" }}>{year}</Text>
        </View>

        <Pressable
          onPress={() => setYear((prev) => prev + 1)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#d1d5db",
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontWeight: "700" }}>Next Year</Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: "red" }}>billing error: {error}</Text> : null}
      {status ? <Text style={{ color: "#065f46", fontWeight: "600" }}>{status}</Text> : null}

      {!token ? (
        <Text style={{ color: "#b45309", fontWeight: "600" }}>
          You can view the monthly bill summary here, but saving Php/kWh needs a logged-in account.
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <SummaryBox
          label="Current month kWh"
          value={currentMonthRow ? currentMonthRow.kwh.toFixed(2) : "0.00"}
        />
        <SummaryBox
          label="Current rate (Php/kWh)"
          value={
            currentMonthRow?.display_rate != null
              ? currentMonthRow.display_rate.toFixed(4)
              : "—"
          }
        />
        <SummaryBox
          label="Current month bill"
          value={
            currentMonthRow?.display_bill_php != null
              ? safeMoney(currentMonthRow.display_bill_php)
              : "—"
          }
        />
        <SummaryBox label="Year total kWh" value={yearTotalKwh.toFixed(2)} />
        <SummaryBox label="Year total bill" value={safeMoney(yearTotalBill)} />
      </View>

      {loading && !rows.length ? (
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: 760 }}>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: "#e5e7eb",
            }}
          >
            <Text style={{ width: 110, fontWeight: "800" }}>Month</Text>
            <Text style={{ width: 110, fontWeight: "800" }}>kWh</Text>
            <Text style={{ width: 170, fontWeight: "800" }}>Cost / kWh (Php)</Text>
            <Text style={{ width: 140, fontWeight: "800" }}>Bill (Php)</Text>
            <Text style={{ width: 120, fontWeight: "800" }}>Action</Text>
          </View>

          {displayRows.map((row) => {
            const isCurrent = currentMonth === row.month;
            const isSaving = savingKey === row.draft_key;

            return (
              <View
                key={row.draft_key}
                style={{
                  flexDirection: "row",
                  gap: 8,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: "#f3f4f6",
                  backgroundColor: isCurrent ? "#eff6ff" : "transparent",
                  alignItems: "center",
                }}
              >
                <Text style={{ width: 110, fontWeight: isCurrent ? "800" : "400" }}>
                  {row.month_label}
                </Text>

                <Text style={{ width: 110 }}>{row.kwh.toFixed(2)}</Text>

                <View style={{ width: 170 }}>
                  <TextInput
                    value={draftRates[row.draft_key] ?? ""}
                    onChangeText={(text) =>
                      setDraftRates((prev) => ({
                        ...prev,
                        [row.draft_key]: text,
                      }))
                    }
                    keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                    placeholder="e.g. 12.4500"
                    style={{
                      borderWidth: 1,
                      borderColor: "#d1d5db",
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: token ? "#fff" : "#f3f4f6",
                      color: token ? "#111827" : "#6b7280",
                    }}
                    editable={!!token}
                  />
                </View>

                <Text style={{ width: 140 }}>
                  {row.display_bill_php != null ? safeMoney(row.display_bill_php) : "—"}
                </Text>

                <View style={{ width: 120 }}>
                  <Pressable
                    onPress={() => handleSave(row)}
                    disabled={!token || isSaving}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: !token ? "#d1d5db" : "#111827",
                      backgroundColor: !token ? "#f3f4f6" : "#fff",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "800",
                        color: !token ? "#9ca3af" : "#111827",
                      }}
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Text style={{ color: "#6b7280", fontSize: 12 }}>
        Past months stay saved. The current live month keeps updating until the month changes.
      </Text>
    </View>
  );
}
