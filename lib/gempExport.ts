import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { API_BASE } from "../config";

type GempHeader = {
  year?: string | number;
  agency?: string;
  tel?: string;
  address?: string;
  fax?: string;
  region?: string;
};

type GempRow = {
  month: string;
  baseline2016?: string | number | null;
  buildingDescription?: string | null;
  grossArea?: string | number | null;
  airconArea?: string | number | null;
  occupants?: string | number | null;
  kwh?: string | number | null;
};

type GempStats = {
  avgBaseline?: string | number | null;
  avgGrossArea?: string | number | null;
  avgAirconArea?: string | number | null;
  avgOccupants?: string | number | null;
  avgKwh?: string | number | null;
};

type GempReportPayload = {
  header: GempHeader;
  rows: GempRow[];
  stats: GempStats;
};

export async function exportGempToDocx(payload: GempReportPayload) {
  const res = await fetch(`${API_BASE}/reports/gemp/docx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const year = String(payload.header?.year ?? "report");

  if (Platform.OS === "web") {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `gemp-annex-a-${year}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
    return;
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const fileUri = `${FileSystem.cacheDirectory}gemp-annex-a-${year}.docx`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error(`DOCX saved to ${fileUri}, but sharing is not available on this device.`);
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    dialogTitle: "Export GEMP Report",
    UTI: "org.openxmlformats.wordprocessingml.document",
  });
}