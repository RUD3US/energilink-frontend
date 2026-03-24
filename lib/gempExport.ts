import * as FileSaver from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

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

function cell(text: string, bold = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || "-", bold })],
      }),
    ],
  });
}

export async function exportGempToDocx({
  header,
  rows,
  stats,
}: {
  header: GempHeader;
  rows: GempRow[];
  stats: GempStats;
}) {
  const tableRows = [
    new TableRow({
      children: [
        cell("Month", true),
        cell("Baseline 2025", true),
        cell("Building Description", true),
        cell("Gross Area", true),
        cell("Aircon Area", true),
        cell("Occupants", true),
        cell("kWh", true),
      ],
    }),
    ...rows.map(
      (row) =>
        new TableRow({
          children: [
            cell(row.month),
            cell(row.baseline2025 || "-"),
            cell(row.buildingDesc || "-"),
            cell(row.grossArea || "-"),
            cell(row.airconArea || "-"),
            cell(row.occupants || "-"),
            cell(row.kwh || "-"),
          ],
        })
    ),
    new TableRow({
      children: [
        cell("Average", true),
        cell(stats.avgBaseline || "-"),
        cell("-"),
        cell(stats.avgGrossArea || "-"),
        cell(stats.avgAirconArea || "-"),
        cell(stats.avgOccupants || "-"),
        cell(stats.avgKwh || "-"),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "GEMP Report (Annex A)", bold: true, size: 28 })],
          }),
          new Paragraph({ text: "" }),

          new Paragraph({ children: [new TextRun({ text: `Year: ${header.year || "-"}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Agency: ${header.agency || "-"}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Tel: ${header.tel || "-"}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Address: ${header.address || "-"}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Fax: ${header.fax || "-"}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Region: ${header.region || "-"}` })] }),
          new Paragraph({ text: "" }),

          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: tableRows,
          }),

          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: `Prepared by: ${header.preparedBy || "-"}` })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Prepared by Designation: ${header.preparedByDesignation || "-"}`,
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Noted by: ${header.notedBy || "-"}` })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Noted by Designation: ${header.notedByDesignation || "-"}`,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  FileSaver.saveAs(blob, `GEMP_Report_${header.year || "report"}.docx`);
}
