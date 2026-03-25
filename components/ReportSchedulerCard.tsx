import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import {
  addReportRecipient,
  deleteReportRecipient,
  getReportRecipients,
  getReportSchedule,
  ReportRecipient,
  ReportSchedule,
  sendTestGempReport,
  updateReportSchedule,
} from "../lib/api";

const WEEKDAYS = [
  { label: "Mon", value: 0 },
  { label: "Tue", value: 1 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 3 },
  { label: "Fri", value: 4 },
  { label: "Sat", value: 5 },
  { label: "Sun", value: 6 },
];

export function ReportSchedulerCard() {
  const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [schedule, setSchedule] = useState<ReportSchedule>({
    id: 1,
    frequency: "weekly",
    send_time: "08:00",
    day_of_week: 0,
    day_of_month: 1,
    enabled: 0,
    updated_at: "",
  });
  const [dayOfMonthInput, setDayOfMonthInput] = useState("1");
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    setBusy(true);
    try {
      const [r, s] = await Promise.all([getReportRecipients(), getReportSchedule()]);
      setRecipients(r);
      setSchedule(s);
      setDayOfMonthInput(s.day_of_month != null ? String(s.day_of_month) : "");
    } catch (e: any) {
      Alert.alert("Load failed", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAddRecipient() {
    if (!newEmail.trim()) return;

    try {
      await addReportRecipient(newEmail.trim());
      setNewEmail("");
      await loadAll();
    } catch (e: any) {
      Alert.alert("Add recipient failed", String(e?.message ?? e));
    }
  }

  async function handleDeleteRecipient(id: number) {
    try {
      await deleteReportRecipient(id);
      await loadAll();
    } catch (e: any) {
      Alert.alert("Delete recipient failed", String(e?.message ?? e));
    }
  }

  async function handleSaveSchedule() {
    try {
      const sendTime = schedule.send_time.trim();

      if (!/^\d{2}:\d{2}$/.test(sendTime)) {
        Alert.alert("Invalid time", "Send time must use HH:MM format.");
        return;
      }

      const [hour, minute] = sendTime.split(":").map(Number);
      if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minute) ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
      ) {
        Alert.alert("Invalid time", "Please enter a valid time from 00:00 to 23:59.");
        return;
      }

      let parsedDayOfMonth: number | null = null;

      if (schedule.frequency === "monthly") {
        const cleaned = dayOfMonthInput.trim();

        if (!cleaned) {
          Alert.alert("Invalid day", "Please enter a day of month from 1 to 28.");
          return;
        }

        parsedDayOfMonth = Number(cleaned);

        if (
          !Number.isInteger(parsedDayOfMonth) ||
          parsedDayOfMonth < 1 ||
          parsedDayOfMonth > 28
        ) {
          Alert.alert("Invalid day", "Day of month must be from 1 to 28.");
          return;
        }
      }

      await updateReportSchedule({
        frequency: schedule.frequency,
        send_time: sendTime,
        day_of_week: schedule.frequency === "weekly" ? schedule.day_of_week ?? 0 : null,
        day_of_month: schedule.frequency === "monthly" ? parsedDayOfMonth : null,
        enabled: schedule.enabled,
      });

      await loadAll();
      Alert.alert("Saved", "Report schedule saved.");
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message ?? e));
    }
  }

  async function handleSendTest() {
    try {
      const result = await sendTestGempReport();
      Alert.alert("Test sent", `Sent to: ${result.sent_to.join(", ")}`);
    } catch (e: any) {
      Alert.alert("Test send failed", String(e?.message ?? e));
    }
  }

  return (
    <View
      style={{
        gap: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 14,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "800" }}>Scheduled GEMP Email</Text>
      <Text style={{ color: "#555" }}>
        Supports weekly or monthly sending only. The backend service sends the DOCX automatically.
      </Text>

      <Text style={{ fontWeight: "700" }}>Recipients</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="name@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 10,
            padding: 10,
            backgroundColor: "#fff",
          }}
        />
        <Pressable
          onPress={handleAddRecipient}
          style={{
            paddingHorizontal: 14,
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: "#111",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Add</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        {recipients.length ? (
          recipients.map((r) => (
            <View
              key={r.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 10,
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 10,
              }}
            >
              <Text>{r.email}</Text>
              <Pressable onPress={() => handleDeleteRecipient(r.id)}>
                <Text style={{ color: "#b91c1c", fontWeight: "700" }}>Remove</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={{ color: "#666" }}>No recipients yet.</Text>
        )}
      </View>

      <Text style={{ fontWeight: "700" }}>Frequency</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["weekly", "monthly"] as const).map((freq) => (
          <Pressable
            key={freq}
            onPress={() => setSchedule((s) => ({ ...s, frequency: freq }))}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: schedule.frequency === freq ? "#111" : "#ddd",
              backgroundColor: schedule.frequency === freq ? "#111" : "#fff",
            }}
          >
            <Text
              style={{
                color: schedule.frequency === freq ? "#fff" : "#111",
                fontWeight: "700",
              }}
            >
              {freq}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontWeight: "700" }}>Send time (HH:MM)</Text>
      <TextInput
        value={schedule.send_time}
        onChangeText={(v) => setSchedule((s) => ({ ...s, send_time: v }))}
        placeholder="08:00"
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 10,
          padding: 10,
          backgroundColor: "#fff",
        }}
      />

      {schedule.frequency === "weekly" ? (
        <>
          <Text style={{ fontWeight: "700" }}>Day of week</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {WEEKDAYS.map((d) => (
              <Pressable
                key={d.value}
                onPress={() => setSchedule((s) => ({ ...s, day_of_week: d.value }))}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: schedule.day_of_week === d.value ? "#111" : "#ddd",
                  backgroundColor: schedule.day_of_week === d.value ? "#111" : "#fff",
                }}
              >
                <Text
                  style={{
                    color: schedule.day_of_week === d.value ? "#fff" : "#111",
                    fontWeight: "700",
                  }}
                >
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={{ fontWeight: "700" }}>Day of month (1–28)</Text>
          <TextInput
            value={dayOfMonthInput}
            onChangeText={(v) => setDayOfMonthInput(v.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="1"
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 10,
              backgroundColor: "#fff",
            }}
          />
        </>
      )}

      <Text style={{ fontWeight: "700" }}>Status</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => setSchedule((s) => ({ ...s, enabled: 1 }))}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: schedule.enabled ? "#111" : "#ddd",
            backgroundColor: schedule.enabled ? "#111" : "#fff",
          }}
        >
          <Text style={{ color: schedule.enabled ? "#fff" : "#111", fontWeight: "700" }}>
            Enabled
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setSchedule((s) => ({ ...s, enabled: 0 }))}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: !schedule.enabled ? "#111" : "#ddd",
            backgroundColor: !schedule.enabled ? "#111" : "#fff",
          }}
        >
          <Text style={{ color: !schedule.enabled ? "#fff" : "#111", fontWeight: "700" }}>
            Disabled
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={handleSaveSchedule}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            backgroundColor: "#111",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Save schedule</Text>
        </Pressable>

        <Pressable
          onPress={handleSendTest}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#111",
            alignItems: "center",
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ color: "#111", fontWeight: "900" }}>Send test now</Text>
        </Pressable>
      </View>

      <Text style={{ color: "#666" }}>
        {busy
          ? "Loading..."
          : `Updated at: ${
              schedule.updated_at ? new Date(schedule.updated_at).toLocaleString() : "—"
            }`}
      </Text>
    </View>
  );
}
