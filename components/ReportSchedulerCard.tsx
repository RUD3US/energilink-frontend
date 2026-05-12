import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
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
        style: "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

export function ReportSchedulerCard({
  onBeforeSendTest,
}: {
  onBeforeSendTest?: () => Promise<void>;
}) {
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
  const [sendingTest, setSendingTest] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [sendStatus, setSendStatus] = useState("");

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
      setSaveBusy(true);

      const rawSendTime = schedule.send_time.trim();
      const sendTimeMatch = rawSendTime.match(/^(\d{1,2}):(\d{1,2})$/);

      if (!sendTimeMatch) {
        Alert.alert("Invalid time", "Send time must use HH:MM format, for example 08:00.");
        return;
      }

      const hour = Number(sendTimeMatch[1]);
      const minute = Number(sendTimeMatch[2]);
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

      const sendTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

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

      const saved = await updateReportSchedule({
        frequency: schedule.frequency,
        send_time: sendTime,
        day_of_week: schedule.frequency === "weekly" ? schedule.day_of_week ?? 0 : null,
        day_of_month: schedule.frequency === "monthly" ? parsedDayOfMonth : null,
        enabled: schedule.enabled,
      });

      setSchedule(saved);
      setDayOfMonthInput(saved.day_of_month != null ? String(saved.day_of_month) : "");
      setSendStatus(`Schedule saved: ${saved.frequency} at ${saved.send_time}`);
      await loadAll();
      Alert.alert("Saved", "Report schedule saved.");
    } catch (e: any) {
      const message = String(e?.message ?? e);
      setSendStatus(`Schedule save failed: ${message}`);
      Alert.alert("Save failed", message);
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleSendTest() {
    const targetRecipients = recipients
      .filter((r) => r.is_active)
      .map((r) => r.email)
      .join(", ");

    const ok = await confirmAction(
      "Send test email",
      targetRecipients
        ? `Send a test GEMP PDF email to:\n\n${targetRecipients}`
        : "No saved recipients found. The backend will try to use configured recipients if available.\n\nDo you want to continue?"
    );

    if (!ok) return;

    try {
      setSendingTest(true);
      setSendStatus("Preparing latest GEMP data...");

      if (onBeforeSendTest) {
        await onBeforeSendTest();
      }

      setSendStatus("Sending test email...");
      const result = await sendTestGempReport();

      const sentTo = Array.isArray(result?.sent_to) ? result.sent_to.join(", ") : "";
      const successMessage = sentTo
        ? `Test email sent successfully to:\n\n${sentTo}`
        : "Test email sent successfully.";

      setSendStatus("Test email sent successfully.");
      Alert.alert("Test sent", successMessage);
    } catch (e: any) {
      const message = String(e?.message ?? e);
      setSendStatus(`Send failed: ${message}`);
      Alert.alert("Test send failed", message);
    } finally {
      setSendingTest(false);
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
        Supports weekly or monthly sending only. The backend service sends the PDF automatically.
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
          disabled={saveBusy}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            backgroundColor: saveBusy ? "#9ca3af" : "#111",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {saveBusy ? "Saving..." : "Save schedule"}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSendTest}
          disabled={sendingTest}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: sendingTest ? "#9ca3af" : "#111",
            alignItems: "center",
            backgroundColor: sendingTest ? "#f3f4f6" : "#fff",
          }}
        >
          <Text style={{ color: "#111", fontWeight: "900" }}>
            {sendingTest ? "Sending..." : "Send test now"}
          </Text>
        </Pressable>
      </View>

      {sendStatus ? (
        <Text
          style={{
            color: sendStatus.toLowerCase().includes("failed") ? "#b91c1c" : "#065f46",
            fontWeight: "600",
          }}
        >
          {sendStatus}
        </Text>
      ) : null}

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
