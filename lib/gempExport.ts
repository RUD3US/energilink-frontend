import { Alert, Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type GempHeader = {
  year?: string;
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
  baseline2025?: string;
  buildingDesc?: string;
  grossArea?: string;
  airconArea?: string;
  occupants?: string;
  kwh?: string;
};

type GempStats = {
  avgBaseline?: string;
  avgGrossArea?: string;
  avgAirconArea?: string;
  avgOccupants?: string;
  avgKwh?: string;
};

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function show(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? esc(text) : "&mdash;";
}

function buildGempHtml({
  header,
  rows,
  stats,
}: {
  header: GempHeader;
  rows: GempRow[];
  stats: GempStats;
}) {
  const rowsHtml = rows
    .map(
      (r) => `
        <tr>
          <td>${show(r.month)}</td>
          <td>${show(r.baseline2025)}</td>
          <td>${show(r.buildingDesc)}</td>
          <td>${show(r.grossArea)}</td>
          <td>${show(r.airconArea)}</td>
          <td>${show(r.occupants)}</td>
          <td>${show(r.kwh)}</td>
        </tr>
      `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>GEMP Annex A</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 18px;
      }

      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #111;
        font-size: 10px;
        margin: 0;
      }

      .title {
        text-align: center;
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 4px;
      }

      .subtitle {
        text-align: center;
        font-size: 11px;
        margin-bottom: 14px;
      }

      .section {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 12px;
      }

      .section-title {
        font-weight: 700;
        font-size: 11px;
        margin-bottom: 8px;
      }

      .header-grid {
        width: 100%;
        border-collapse: collapse;
      }

      .header-grid td {
        padding: 4px 6px;
        vertical-align: top;
      }

      .label {
        width: 130px;
        font-weight: 700;
      }

      table.report {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      table.report th,
      table.report td {
        border: 1px solid #d1d5db;
        padding: 6px;
        vertical-align: top;
        word-wrap: break-word;
      }

      table.report th {
        background: #f3f4f6;
        text-align: left;
        font-weight: 700;
      }

      .avg-row td {
        font-weight: 700;
        background: #f9fafb;
      }

      .sign-row {
        width: 100%;
        margin-top: 16px;
        border-collapse: collapse;
      }

      .sign-row td {
        width: 50%;
        vertical-align: top;
        padding-right: 20px;
      }

      .line {
        margin-top: 28px;
        border-top: 1px solid #111;
        padding-top: 4px;
      }
    </style>
  </head>
  <body>
    <div class="title">GEMP Report</div>
    <div class="subtitle">Annex A</div>

    <div class="section">
      <div class="section-title">Header Information</div>
      <table class="header-grid">
        <tr>
          <td class="label">Year</td>
          <td>${show(header.year)}</td>
          <td class="label">Agency</td>
          <td>${show(header.agency)}</td>
        </tr>
        <tr>
          <td class="label">Tel Nos.</td>
          <td>${show(header.tel)}</td>
          <td class="label">Fax Nos.</td>
          <td>${show(header.fax)}</td>
        </tr>
        <tr>
          <td class="label">Address</td>
          <td>${show(header.address)}</td>
          <td class="label">Region</td>
          <td>${show(header.region)}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Monthly Table</div>
      <table class="report">
        <thead>
          <tr>
            <th style="width: 10%;">Month</th>
            <th style="width: 14%;">Baseline kWh in 2025</th>
            <th style="width: 22%;">Building Description</th>
            <th style="width: 14%;">Gross Area (sqm)</th>
            <th style="width: 16%;">Air-conditioned Area (sqm)</th>
            <th style="width: 10%;">Occupants</th>
            <th style="width: 14%;">Monthly Consumption (kWh)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="avg-row">
            <td>Average</td>
            <td>${show(stats.avgBaseline)}</td>
            <td>&mdash;</td>
            <td>${show(stats.avgGrossArea)}</td>
            <td>${show(stats.avgAirconArea)}</td>
            <td>${show(stats.avgOccupants)}</td>
            <td>${show(stats.avgKwh)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <table class="sign-row">
      <tr>
        <td>
          <div><strong>Prepared by</strong></div>
          <div class="line">${show(header.preparedBy)}</div>
          <div>${show(header.preparedByDesignation)}</div>
        </td>
        <td>
          <div><strong>Noted by</strong></div>
          <div class="line">${show(header.notedBy)}</div>
          <div>${show(header.notedByDesignation)}</div>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}

export async function exportGempToPdf({
  header,
  rows,
  stats,
}: {
  header: GempHeader;
  rows: GempRow[];
  stats: GempStats;
}) {
  const html = buildGempHtml({ header, rows, stats });

  if (Platform.OS === "web") {
    await Print.printToFileAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(uri, {
      UTI: ".pdf",
      mimeType: "application/pdf",
    });
    return;
  }

  Alert.alert("PDF created", `Saved PDF at: ${uri}`);
}
