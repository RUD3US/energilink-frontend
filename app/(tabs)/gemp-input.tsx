import React from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useGempReport } from "../../hooks/useGempReport";

function Input({ label, value, onChangeText, placeholder }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: "700" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10, backgroundColor: "#fff" }}
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

        <Input label="Year" value={report.header.year} onChangeText={(t: string) => updateHeader({ year: t })} placeholder="2026" />
        <Input label="Agency" value={report.header.agency} onChangeText={(t: string) => updateHeader({ agency: t })} placeholder="Agency name" />
        <Input label="Tel Nos." value={report.header.tel} onChangeText={(t: string) => updateHeader({ tel: t })} placeholder="(xxx) xxxx-xxxx" />
        <Input label="Address" value={report.header.address} onChangeText={(t: string) => updateHeader({ address: t })} placeholder="Address" />
        <Input label="Fax Nos." value={report.header.fax} onChangeText={(t: string) => updateHeader({ fax: t })} placeholder="Fax" />
        <Input label="Region" value={report.header.region} onChangeText={(t: string) => updateHeader({ region: t })} placeholder="Region" />
      </View>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Defaults (optional)</Text>
        <Text style={{ color: "#666" }}>
          If your building details are the same every month, set defaults and apply them.
        </Text>

        <Input label="Default building description" value={report.header.defaultBuildingDesc} onChangeText={(t: string) => updateHeader({ defaultBuildingDesc: t })} placeholder="e.g., Main office building" />
        <Input label="Default gross area (sqm)" value={report.header.defaultGrossArea} onChangeText={(t: string) => updateHeader({ defaultGrossArea: t })} placeholder="e.g., 1200" />
        <Input label="Default air-conditioned area (sqm)" value={report.header.defaultAirconArea} onChangeText={(t: string) => updateHeader({ defaultAirconArea: t })} placeholder="e.g., 800" />
        <Input label="Default occupants" value={report.header.defaultOccupants} onChangeText={(t: string) => updateHeader({ defaultOccupants: t })} placeholder="e.g., 50" />

        <Pressable
          onPress={applyDefaultsToAllMonths}
          style={{ padding: 12, borderRadius: 12, backgroundColor: "#111", alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Apply defaults to all months</Text>
        </Pressable>
      </View>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Monthly Rows</Text>
        <Text style={{ color: "#666" }}>
          For now, enter Monthly Consumption (kWh) manually. Later we can auto-compute once current/power is added.
        </Text>

        {report.rows.map((r, idx) => (
          <View key={r.month} style={{ padding: 10, borderWidth: 1, borderColor: "#f1f1f1", borderRadius: 12, gap: 8 }}>
            <Text style={{ fontWeight: "800" }}>{r.month}</Text>

            <Input label="Baseline 2016 (kWh)" value={r.baseline2016} onChangeText={(t: string) => updateRow(idx, { baseline2016: t })} placeholder="(optional)" />
            <Input label="Building description" value={r.buildingDesc} onChangeText={(t: string) => updateRow(idx, { buildingDesc: t })} placeholder="(optional / use defaults)" />
            <Input label="Gross area (sqm)" value={r.grossArea} onChangeText={(t: string) => updateRow(idx, { grossArea: t })} placeholder="(optional / use defaults)" />
            <Input label="Air-conditioned area (sqm)" value={r.airconArea} onChangeText={(t: string) => updateRow(idx, { airconArea: t })} placeholder="(optional / use defaults)" />
            <Input label="Occupants" value={r.occupants} onChangeText={(t: string) => updateRow(idx, { occupants: t })} placeholder="(optional / use defaults)" />
            <Input label="Monthly Consumption (kWh)" value={r.kwh} onChangeText={(t: string) => updateRow(idx, { kwh: t })} placeholder="Enter kWh" />
          </View>
        ))}
      </View>

      <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>Signatories (optional)</Text>
        <Input label="Prepared by (name)" value={report.header.preparedBy} onChangeText={(t: string) => updateHeader({ preparedBy: t })} placeholder="Name" />
        <Input label="Prepared by (designation)" value={report.header.preparedByDesignation} onChangeText={(t: string) => updateHeader({ preparedByDesignation: t })} placeholder="Designation" />
        <Input label="Noted by (name)" value={report.header.notedBy} onChangeText={(t: string) => updateHeader({ notedBy: t })} placeholder="Name" />
        <Input label="Noted by (designation)" value={report.header.notedByDesignation} onChangeText={(t: string) => updateHeader({ notedByDesignation: t })} placeholder="Designation" />
      </View>

      <Pressable
        onPress={() => {
          Alert.alert("Reset", "This clears the GEMP form stored in your browser.", [
            { text: "Cancel", style: "cancel" },
            { text: "Reset", style: "destructive", onPress: reset },
          ]);
        }}
        style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#ddd", alignItems: "center" }}
      >
        <Text style={{ fontWeight: "700" }}>Reset GEMP Form</Text>
      </Pressable>
    </ScrollView>
  );
}