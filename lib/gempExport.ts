import { Platform } from "react-native";
import { API_BASE } from "../config";

type GempHeader = {
  year?: string | number;
  agency?: string;
  tel?: string;
  address?: string;
  fax?: string;
  region?: string;
  preparedBy?: string;
  preparedByDesignation?: string;
  notedBy?: string;
  notedByDesignation?: string;
};

type GempRow = {
  month: string;
  baseline2025?: string | number | null;
  buildingDesc?: string | null;
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

function buildBackendPayload(payload: GempReportPayload) {
  return {
    header: {
      year: payload.header?.year ?? "",
      agency: payload.header?.agency ?? "",
      tel: payload.header?.tel ?? "",
      address: payload.header?.address ?? "",
      fax: payload.header?.fax ?? "",
      region: payload.header?.region ?? "",
      preparedBy: payload.header?.preparedBy ?? "",
      preparedByDesignation: payload.header?.preparedByDesignation ?? "",
      notedBy: payload.header?.notedBy ?? "",
      notedByDesignation: payload.header?.notedByDesignation ?? "",
    },
    rows: (payload.rows || []).map((row) => ({
      month: row.month,
      baseline2025: row.baseline2025 ?? "",
      buildingDesc: row.buildingDesc ?? "",
      grossArea: row.grossArea ?? "",
      airconArea: row.airconArea ?? "",
      occupants: row.occupants ?? "",
      kwh: row.kwh ?? "",
    })),
    stats: {
      avgBaseline: payload.stats?.avgBaseline ?? "",
      avgGrossArea: payload.stats?.avgGrossArea ?? "",
      avgAirconArea: payload.stats?.avgAirconArea ?? "",
      avgOccupants: payload.stats?.avgOccupants ?? "",
      avgKwh: payload.stats?.avgKwh ?? "",
    },
  };
}

export async function exportGempToPdf(payload: GempReportPayload) {
  const backendPayload = buildBackendPayload(payload);

  const res = await fetch(`${API_BASE}/reports/gemp/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(backendPayload),
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
    a.download = `gemp-annex-a-${year}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
    return;
  }

  const [{ Buffer }, FileSystem, Sharing] = await Promise.all([
    import("buffer"),
    import("expo-file-system"),
    import("expo-sharing"),
  ]);

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const fileUri = `${FileSystem.cacheDirectory}gemp-annex-a-${year}.pdf`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error(`PDF saved to ${fileUri}, but sharing is not available on this device.`);
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/pdf",
    dialogTitle: "Export GEMP Report",
    UTI: "com.adobe.pdf",
  });
}
