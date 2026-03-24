import React from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useGempReport } from "../../hooks/useGempReport";

function Input({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value?: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: "700" }}>{label}</Text>
      <TextInput
        value={value ?? ""}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 10,
          padding: 10,
          backgroundColor: "#fff",
        }}
      />
    </View>
  );
}

export default function GempInputScreen() {
  const { report, updateHeader, updateRow, applyDefaultsToAllMonths, reset } = useGempReport();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={{ fontSize: 20, fontWeight: "800" }}>GEMP Input (Annex A)</Text>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Header</Text>

        <Input label="Year" value={report.header.year} onChangeText={(t) => updateHeader({ year: t })} placeholder="2026" />
        <Input label="Agency" value={report.header.agency} onChangeText={(t) => updateHeader({ agency: t })} placeholder="Agency name" />
        <Input label="Tel Nos." value={report.header.tel} onChangeText={(t) => updateHeader({ tel: t })} placeholder="(xxx) xxxx-xxxx" />
        <Input label="Address" value={report.header.address} onChangeText={(t) => updateHeader({ address: t })} placeholder="Address" />
        <Input label="Fax Nos." value={report.header.fax} onChangeText={(t) => updateHeader({ fax: t })} placeholder="Fax" />
        <Input label="Region" value={report.header.region} onChangeText={(t) => updateHeader({ region: t })} placeholder="Region" />
      </View>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Defaults (optional)</Text>
        <Text style={{ color: "#666" }}>
          If your building details are the same every month, set defaults and apply them.
        </Text>

        <Input
          label="Default building description"
          value={report.header.defaultBuildingDesc}
          onChangeText={(t) => updateHeader({ defaultBuildingDesc: t })}
          placeholder="e.g., Main office building"
        />
        <Input
          label="Default gross area (sqm)"
          value={report.header.defaultGrossArea}
          onChangeText={(t) => updateHeader({ defaultGrossArea: t })}
          placeholder="e.g., 1200"
        />
        <Input
          label="Default air-conditioned area (sqm)"
          value={report.header.defaultAirconArea}
          onChangeText={(t) => updateHeader({ defaultAirconArea: t })}
          placeholder="e.g., 800"
        />
        <Input
          label="Default occupants"
          value={report.header.defaultOccupants}
          onChangeText={(t) => updateHeader({ defaultOccupants: t })}
          placeholder="e.g., 50"
        />

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pressable
            onPress={applyDefaultsToAllMonths}
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: "#111",
              alignItems: "center",
              flex: 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Apply defaults to all months</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Alert.alert("Reset", "This clears the GEMP form stored in your browser.", [
                { text: "Cancel", style: "cancel" },
                { text: "Reset", style: "destructive", onPress: reset },
              ]);
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
            <Text style={{ fontWeight: "700", color: "#b91c1c" }}>Reset</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Monthly Rows</Text>

        {report.rows.map((r, idx) => (
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
            <Input
              label="Monthly Consumption (kWh)"
              value={r.kwh}
              onChangeText={(t) => updateRow(idx, { kwh: t })}
              placeholder="Enter kWh"
            />
          </View>
        ))}
      </View>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Signatories (optional)</Text>

        <Input
          label="Prepared by (name)"
          value={report.header.preparedBy}
          onChangeText={(t) => updateHeader({ preparedBy: t })}
          placeholder="Name"
        />
        <Input
          label="Prepared by (designation)"
          value={report.header.preparedByDesignation}
          onChangeText={(t) => updateHeader({ preparedByDesignation: t })}
          placeholder="Designation"
        />
        <Input
          label="Noted by (name)"
          value={report.header.notedBy}
          onChangeText={(t) => updateHeader({ notedBy: t })}
          placeholder="Name"
        />
        <Input
          label="Noted by (designation)"
          value={report.header.notedByDesignation}
          onChangeText={(t) => updateHeader({ notedByDesignation: t })}
          placeholder="Designation"
        />
      </View>
    </ScrollView>
  );
}
