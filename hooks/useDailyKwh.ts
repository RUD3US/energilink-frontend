import { useEffect, useMemo, useState } from "react";
import { DEFAULT_DEVICE, API_BASE_URL } from "../config";

export type DailyKwhBarPoint = {
  dayKey: string;
  label: string;
  kwh: number;
};

export type MonthlyKwhBarPoint = {
  monthKey: string;
  label: string;
  kwh: number;
};

export type KwhSummary = {
  current: number;
  previous: number;
  avg: number;
  total: number;
  peakLabel: string;
  peakKwh: number;
};

type HistoryPoint = {
  time: string;
  rms_voltage: number | null;
  rms_current: number | null;
  power: number | null;
  power_factor: number | null;
  note?: string | null;
};

const MAX_GAP_HOURS = 6;
const API_HISTORY_LIMIT = 5000;

function toMs(iso: string) {
  return new Date(iso).getTime();
}

function startOfDayMs(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDayMs(ms: number) {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function startOfMonthMs(ms: number) {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfMonthMs(ms: number) {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() + 1);
  return d.getTime() - 1;
}

function dayLabel(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function monthLabel(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function localDayKey(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localMonthKey(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function toKwh(powerWatts: number, hours: number) {
  return (powerWatts / 1000) * hours;
}

function buildSummary<T extends { label: string; kwh: number }>(data: T[]): KwhSummary {
  const total = data.reduce((sum, d) => sum + d.kwh, 0);
  const avg = data.length ? total / data.length : 0;
  const current = data[data.length - 1]?.kwh ?? 0;
  const previous = data[data.length - 2]?.kwh ?? 0;

  const peak = data.reduce<T | null>(
    (best, item) => (!best || item.kwh > best.kwh ? item : best),
    null
  );

  return {
    current: Number(current.toFixed(2)),
    previous: Number(previous.toFixed(2)),
    avg: Number(avg.toFixed(2)),
    total: Number(total.toFixed(2)),
    peakLabel: peak?.label ?? "—",
    peakKwh: Number((peak?.kwh ?? 0).toFixed(2)),
  };
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getBatchRange(now: Date) {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const todayDay = now.getDate();
  const daysInMonth = getDaysInMonth(year, monthIndex);

  let batchStartDay = 1;
  let batchEndDay = Math.min(14, daysInMonth);

  if (todayDay >= 15 && todayDay <= 28) {
    batchStartDay = 15;
    batchEndDay = Math.min(28, daysInMonth);
  } else if (todayDay >= 29) {
    batchStartDay = 29;
    batchEndDay = daysInMonth;
  }

  return {
    year,
    monthIndex,
    todayDay,
    daysInMonth,
    batchStartDay,
    batchEndDay,
  };
}

function buildRangeLabel(year: number, monthIndex: number, startDay: number, endDay: number) {
  const start = new Date(year, monthIndex, startDay);
  const end = new Date(year, monthIndex, endDay);
  const month = start.toLocaleDateString(undefined, { month: "short" });
  return `${month} ${start.getDate()}-${end.getDate()}`;
}

function isValidHistoryPoint(p: HistoryPoint) {
  if (!p) return false;
  if (typeof p.time !== "string") return false;
  if (typeof p.power !== "number" || !Number.isFinite(p.power)) return false;
  if (typeof p.rms_voltage !== "number" || !Number.isFinite(p.rms_voltage)) return false;
  if (typeof p.rms_current !== "number" || !Number.isFinite(p.rms_current)) return false;
  if (p.power < 0) return false;

  if (p.rms_voltage === 0 && p.rms_current === 0) return false;

  return true;
}

export function useDailyKwh(days = 14, months = 12, device = DEFAULT_DEVICE) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);

      const base = String(API_BASE_URL || "").replace(/\/+$/, "");
      const url = `${base}/public/history?device=${encodeURIComponent(device)}&limit=${API_HISTORY_LIMIT}`;

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setPoints(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load kWh history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [days, months, device]);

  const sorted = useMemo(() => {
    return points
      .filter(isValidHistoryPoint)
      .map((p) => ({
        timeMs: toMs(p.time),
        power: p.power as number,
      }))
      .filter((p) => Number.isFinite(p.timeMs) && Number.isFinite(p.power))
      .sort((a, b) => a.timeMs - b.timeMs);
  }, [points]);

  const batchInfo = useMemo(() => {
    const range = getBatchRange(new Date());
    return {
      ...range,
      batchLabel: buildRangeLabel(
        range.year,
        range.monthIndex,
        range.batchStartDay,
        range.batchEndDay
      ),
      visibleLabel: buildRangeLabel(
        range.year,
        range.monthIndex,
        range.batchStartDay,
        range.todayDay
      ),
    };
  }, [sorted.length]);

  const dailyData = useMemo<DailyKwhBarPoint[]>(() => {
    const { year, monthIndex, todayDay, batchStartDay } = batchInfo;

    const fromMs = new Date(year, monthIndex, batchStartDay, 0, 0, 0, 0).getTime();
    const toMsLimit = new Date(year, monthIndex, todayDay, 23, 59, 59, 999).getTime();

    const buckets = new Map<string, number>();

    for (let day = batchStartDay; day <= todayDay; day++) {
      const dayMs = new Date(year, monthIndex, day, 0, 0, 0, 0).getTime();
      buckets.set(localDayKey(dayMs), 0);
    }

    if (sorted.length >= 2) {
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        if (next.timeMs <= fromMs) continue;

        const segStart = Math.max(current.timeMs, fromMs);
        const segEnd = Math.min(next.timeMs, toMsLimit + 1);

        if (segEnd <= segStart) continue;

        const gapHours = (segEnd - segStart) / 1000 / 60 / 60;
        if (gapHours > MAX_GAP_HOURS) continue;

        let cursor = segStart;

        while (cursor < segEnd) {
          const sliceEnd = Math.min(endOfDayMs(cursor) + 1, segEnd);
          const sliceHours = (sliceEnd - cursor) / 1000 / 60 / 60;
          const dayStart = startOfDayMs(cursor);
          const key = localDayKey(dayStart);

          if (buckets.has(key)) {
            buckets.set(key, (buckets.get(key) || 0) + toKwh(current.power, sliceHours));
          }

          cursor = sliceEnd;
        }
      }
    }

    return Array.from(buckets.keys()).map((key) => {
      const dayMs = new Date(`${key}T00:00:00`).getTime();
      return {
        dayKey: key,
        label: dayLabel(dayMs),
        kwh: Number((buckets.get(key) || 0).toFixed(2)),
      };
    });
  }, [sorted, batchInfo]);

  const monthlyData = useMemo<MonthlyKwhBarPoint[]>(() => {
    const now = Date.now();
    const from = new Date(now);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    from.setMonth(from.getMonth() - (months - 1));
    const fromMs = from.getTime();

    const buckets = new Map<string, number>();

    for (let i = months - 1; i >= 0; i--) {
      const monthMs = new Date(now);
      monthMs.setDate(1);
      monthMs.setHours(0, 0, 0, 0);
      monthMs.setMonth(monthMs.getMonth() - i);
      const key = localMonthKey(monthMs.getTime());
      buckets.set(key, 0);
    }

    if (sorted.length >= 2) {
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        if (next.timeMs <= fromMs) continue;

        const segStart = Math.max(current.timeMs, fromMs);
        const segEnd = next.timeMs;

        if (segEnd <= segStart) continue;

        const gapHours = (segEnd - segStart) / 1000 / 60 / 60;
        if (gapHours > MAX_GAP_HOURS) continue;

        let cursor = segStart;

        while (cursor < segEnd) {
          const sliceEnd = Math.min(endOfMonthMs(cursor) + 1, segEnd);
          const sliceHours = (sliceEnd - cursor) / 1000 / 60 / 60;
          const monthStart = startOfMonthMs(cursor);
          const key = localMonthKey(monthStart);

          if (buckets.has(key)) {
            buckets.set(key, (buckets.get(key) || 0) + toKwh(current.power, sliceHours));
          }

          cursor = sliceEnd;
        }
      }
    }

    return Array.from(buckets.keys()).map((key) => {
      const monthMs = new Date(`${key}-01T00:00:00`).getTime();
      return {
        monthKey: key,
        label: monthLabel(monthMs),
        kwh: Number((buckets.get(key) || 0).toFixed(2)),
      };
    });
  }, [sorted, months]);

  const dailySummary = useMemo(() => buildSummary(dailyData), [dailyData]);
  const monthlySummary = useMemo(() => buildSummary(monthlyData), [monthlyData]);

  return {
    data: dailyData,
    summary: {
      today: dailySummary.current,
      yesterday: dailySummary.previous,
      avg: dailySummary.avg,
      total: dailySummary.total,
      peakLabel: dailySummary.peakLabel,
      peakKwh: dailySummary.peakKwh,
    },

    dailyData,
    monthlyData,
    dailySummary,
    monthlySummary,
    batchLabel: batchInfo.batchLabel,
    visibleLabel: batchInfo.visibleLabel,
    batchStartDay: batchInfo.batchStartDay,
    batchEndDay: batchInfo.batchEndDay,
    todayDay: batchInfo.todayDay,
    daysInMonth: batchInfo.daysInMonth,

    refresh,
    loading,
    error,
  };
}
