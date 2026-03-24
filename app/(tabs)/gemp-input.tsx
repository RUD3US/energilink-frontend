import React from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useGempReport } from "../../hooks/useGempReport";

function Input({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
}: {
  label: string;
  value?: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: "700" }}>{label}</Text>
      <TextInput
        value={value ?? ""}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={editable}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 10,
          padding: 10,
          backgroundColor: editable ? "#fff" : "#f3f4f6",
        }}
      />
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

export default function GempInputScreen() {
  const {
    form,
    dynamic,
    updateHeader,
    updateRow,
    applyDefaultsToAllMonths,
    reset,
  } = useGempReport();

  const currentMonth = dynamic?.current_month_label;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={{ fontSize: 20, fontWeight: "800" }}>GEMP Input (Annex A)</Text>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Header</Text>

        <Input label="Year" value={form.header.year} onChangeText={(t) => updateHeader({ year: t })} placeholder="2026" />
        <Input label="Agency" value={form.header.agency} onChangeText={(t) => updateHeader({ agency: t })} placeholder="Agency name" />
        <Input label="Tel Nos." value={form.header.tel} onChangeText={(t) => updateHeader({ tel: t })} placeholder="(xxx) xxxx-xxxx" />
        <Input label="Address" value={form.header.address} onChangeText={(t) => updateHeader({ address: t })} placeholder="Address" />
        <Input label="Fax Nos." value={form.header.fax} onChangeText={(t) => updateHeader({ fax: t })} placeholder="Fax" />
        <Input label="Region" value={form.header.region} onChangeText={(t) => updateHeader({ region: t })} placeholder="Region" />
      </View>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Defaults</Text>
        <Text style={{ color: "#666" }}>
          You can apply defaults only to empty months, or override all month details.
        </Text>

        <Input
          label="Default building description"
          value={form.header.defaultBuildingDesc}
          onChangeText={(t) => updateHeader({ defaultBuildingDesc: t })}
          placeholder="e.g., Main office building"
        />
        <Input
          label="Default gross area (sqm)"
          value={form.header.defaultGrossArea}
          onChangeText={(t) => updateHeader({ defaultGrossArea: t })}
          placeholder="e.g., 1200"
        />
        <Input
          label="Default air-conditioned area (sqm)"
          value={form.header.defaultAirconArea}
          onChangeText={(t) => updateHeader({ defaultAirconArea: t })}
          placeholder="e.g., 800"
        />
        <Input
          label="Default occupants"
          value={form.header.defaultOccupants}
          onChangeText={(t) => updateHeader({ defaultOccupants: t })}
          placeholder="e.g., 50"
        />

        <View style={{ gap: 8 }}>
          <Pressable
            onPress={() => applyDefaultsToAllMonths(false)}
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: "#111",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              Apply defaults to empty months
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              const ok = await confirmAction(
                "Override all month details",
                "This will replace all monthly building details, gross area, air-conditioned area, and occupants with the current default values."
              );
              if (ok) {
                applyDefaultsToAllMonths(true);
              }
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#f59e0b",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "700", color: "#b45309" }}>
              Override all month details with defaults
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              const ok = await confirmAction(
                "Reset Manual Inputs",
                "This clears the manual GEMP form values. The current month kWh in the report remains dynamic."
              );
              if (ok) {
                reset();
              }
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#ef4444",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "700", color: "#b91c1c" }}>Reset Manual Inputs</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Monthly Rows</Text>

        {form.rows.map((r, idx) => {
          const isCurrentMonth = r.month === currentMonth;

          return (
            <View key={r.month} style={{ padding: 10, borderWidth: 1, borderColor: "#f1f1f1", borderRadius: 12, gap: 8 }}>
              <Text style={{ fontWeight: "800" }}>{r.month}</Text>

              <Input
                label="Baseline 2025 (kWh)"
                value={r.baseline2025}
                onChangeText={(t) => updateRow(idx, { baseline2025: t })}
                placeholder="(optional)"
              />
              <Input
                label="Building description"
                value={r.buildingDesc}
                onChangeText={(t) => updateRow(idx, { buildingDesc: t })}
                placeholder="(optional / use defaults)"
              />
              <Input
                label="Gross area (sqm)"
                value={r.grossArea}
                onChangeText={(t) => updateRow(idx, { grossArea: t })}
                placeholder="(optional / use defaults)"
              />
              <Input
                label="Air-conditioned area (sqm)"
                value={r.airconArea}
                onChangeText={(t) => updateRow(idx, { airconArea: t })}
                placeholder="(optional / use defaults)"
              />
              <Input
                label="Occupants"
                value={r.occupants}
                onChangeText={(t) => updateRow(idx, { occupants: t })}
                placeholder="(optional / use defaults)"
              />

              {isCurrentMonth ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontWeight: "700" }}>Monthly Consumption (kWh)</Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#ddd",
                      borderRadius: 10,
                      padding: 10,
                      backgroundColor: "#fef3c7",
                    }}
                  >
                    <Text style={{ color: "#92400e", fontWeight: "600" }}>
                      Current month kWh in the report is dynamic and comes from backend archived power data.
                    </Text>
                    <Text style={{ marginTop: 6 }}>
                      Manual fallback value: {r.kwh || "—"}
                    </Text>
                  </View>
                </View>
              ) : (
                <Input
                  label="Monthly Consumption (kWh)"
                  value={r.kwh}
                  onChangeText={(t) => updateRow(idx, { kwh: t })}
                  placeholder="Enter kWh"
                />
              )}
            </View>
          );
        })}
      </View>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Signatories (optional)</Text>

        <Input
          label="Prepared by (name)"
          value={form.header.preparedBy}
          onChangeText={(t) => updateHeader({ preparedBy: t })}
          placeholder="Name"
        />
        <Input
          label="Prepared by (designation)"
          value={form.header.preparedByDesignation}
          onChangeText={(t) => updateHeader({ preparedByDesignation: t })}
          placeholder="Designation"
        />
        <Input
          label="Noted by (name)"
          value={form.header.notedBy}
          onChangeText={(t) => updateHeader({ notedBy: t })}
          placeholder="Name"
        />
        <Input
          label="Noted by (designation)"
          value={form.header.notedByDesignation}
          onChangeText={(t) => updateHeader({ notedByDesignation: t })}
          placeholder="Designation"
        />
      </View>
    </ScrollView>
  );
}
