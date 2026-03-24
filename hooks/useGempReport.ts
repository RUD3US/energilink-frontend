import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, DEFAULT_DEVICE, FIELD_POWER } from "../config";

export type GempHeader = {
  year?: string;
  agency?: string;
  tel?: string;
  address?: string;
  fax?: string;
  region?: string;
};

export type GempRow = {
  month: string;
  baseline2016?: string;
  buildingDescription?: string;
  grossArea?: string;
  airconArea?: string;
  occupants?: string;
  kwh?: string;
};

export type GempStats = {
  avgBaseline?: string;
  avgGrossArea?: string;
  avgAirconArea?: string;
  avgOccupants?: string;
  avgKwh?: string;
};

export type GempDynamic = {
  device: string;
  field: string;
  archive_interval_hours: number;
  current_month_label: string;
  current_month_days: number;
  points_used_last_30_days: number;
  points_used_current_month: number;
  hours_elapsed_current_month: number;
  last_30_days_kwh: number;
  avg_daily_kwh_30d: number;
  current_month_kwh: number;
  avg_kwh_per_hour_current_month: number;
  projected_month_kwh: number;
  updated_at: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STATIC_HEADER: GempHeader = {
  year: String(new Date().getFullYear()),
  agency: "GEMP Agency Name",
  tel: "",
  address: "",
  fax: "",
  region: "",
};

const STATIC_GEMP_ROWS: GempRow[] = MONTHS.map((month) => ({
  month,
  baseline2016: "",
  buildingDescription: "",
  grossArea: "",
  airconArea: "",
  occupants: "",
  kwh: "",
}));

function parseNum(v?: string) {
  if (!v) return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function averageString(values: Array<number | null>, decimals = 2) {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return "";
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return avg.toFixed(decimals);
}

export function useGempReport() {
  const [dynamic, setDynamic] = useState<GempDynamic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams({
        device: DEFAULT_DEVICE,
        field: FIELD_POWER,
      }).toString();

      const res = await fetch(`${API_BASE}/reports/gemp/dynamic?${qs}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }

      const json = (await res.json()) as GempDynamic;
      setDynamic(json);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const id = setInterval(() => {
      refresh();
    }, 60 * 1000);

    return () => clearInterval(id);
  }, [refresh]);

  const report = useMemo(() => {
    const currentYear = String(new Date().getFullYear());
    const currentMonth = dynamic?.current_month_label ?? MONTHS[new Date().getMonth()];
    const dynamicCurrentMonthKwh = dynamic ? dynamic.current_month_kwh.toFixed(2) : "";

    const rows = STATIC_GEMP_ROWS.map((row) => {
      if (row.month === currentMonth) {
        return {
          ...row,
          kwh: dynamicCurrentMonthKwh || row.kwh || "",
        };
      }
      return row;
    });

    return {
      header: {
        ...STATIC_HEADER,
        year: currentYear,
      },
      rows,
    };
  }, [dynamic]);

  const stats = useMemo<GempStats>(() => {
    return {
      avgBaseline: averageString(report.rows.map((r) => parseNum(r.baseline2016)), 2),
      avgGrossArea: averageString(report.rows.map((r) => parseNum(r.grossArea)), 2),
      avgAirconArea: averageString(report.rows.map((r) => parseNum(r.airconArea)), 2),
      avgOccupants: averageString(report.rows.map((r) => parseNum(r.occupants)), 2),
      avgKwh: averageString(report.rows.map((r) => parseNum(r.kwh)), 2),
    };
  }, [report.rows]);

  return {
    report,
    stats,
    dynamic,
    loading,
    error,
    refresh,
  };
}
