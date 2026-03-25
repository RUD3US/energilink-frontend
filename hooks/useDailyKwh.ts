import { useEffect, useMemo } from "react";
import { DEFAULT_DEVICE, FIELD_POWER } from "../config";
import { useRealtime } from "./useRealtime";

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

const POWER_POINTS_ARE_WATTS = true;

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

function sanitizePoints(points: { time: string; value: number }[]) {
  return points.filter(
    (p) =>
      p &&
      typeof p.time === "string" &&
      typeof p.value === "number" &&
      Number.isFinite(p.value)
  );
}

function toKwh(powerValue: number, hours: number) {
  if (POWER_POINTS_ARE_WATTS) {
    return (powerValue / 1000) * hours;
  }
  return powerValue * hours;
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

export function useDailyKwh(days = 14, months = 12, device = DEFAULT_DEVICE) {
  const powerRT = useRealtime(device, FIELD_POWER);

  const refresh = () => {
    const estimatedDailyPoints = Math.max(days * 48, 500);
    const estimatedMonthlyPoints = Math.max(months * 31 * 48, 500);
    const estimatedPoints = Math.max(estimatedDailyPoints, estimatedMonthlyPoints);
    powerRT.refresh(String(estimatedPoints));
  };

  useEffect(() => {
    refresh();
  }, [days, months, device]);

  const sorted = useMemo(() => {
    return sanitizePoints(powerRT.points)
      .map((p) => ({
        timeMs: toMs(p.time),
        power: p.value,
      }))
      .filter((p) => Number.isFinite(p.timeMs) && Number.isFinite(p.power))
      .sort((a, b) => a.timeMs - b.timeMs);
  }, [powerRT.points]);

  const dailyData = useMemo<DailyKwhBarPoint[]>(() => {
    const now = Date.now();
    const fromMs = startOfDayMs(now - (days - 1) * 24 * 60 * 60 * 1000);

    const buckets = new Map<string, number>();

    for (let i = days - 1; i >= 0; i--) {
      const dayMs = startOfDayMs(now - i * 24 * 60 * 60 * 1000);
      const key = new Date(dayMs).toISOString().slice(0, 10);
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
        if (gapHours > 6) continue;
        if (current.power < 0) continue;

        let cursor = segStart;

        while (cursor < segEnd) {
          const sliceEnd = Math.min(endOfDayMs(cursor) + 1, segEnd);
          const sliceHours = (sliceEnd - cursor) / 1000 / 60 / 60;
          const dayStart = startOfDayMs(cursor);
          const key = new Date(dayStart).toISOString().slice(0, 10);

          if (buckets.has(key)) {
            buckets.set(key, (buckets.get(key) || 0) + toKwh(current.power, sliceHours));
          }

          cursor = sliceEnd;
        }
      }
    }

    return Array.from(buckets.keys()).map((key) => {
      const dayMs = startOfDayMs(new Date(key).getTime());
      return {
        dayKey: key,
        label: dayLabel(dayMs),
        kwh: Number((buckets.get(key) || 0).toFixed(2)),
      };
    });
  }, [sorted, days]);

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
      const key = new Date(monthMs).toISOString().slice(0, 7);
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
        if (gapHours > 6) continue;
        if (current.power < 0) continue;

        let cursor = segStart;

        while (cursor < segEnd) {
          const sliceEnd = Math.min(endOfMonthMs(cursor) + 1, segEnd);
          const sliceHours = (sliceEnd - cursor) / 1000 / 60 / 60;
          const monthStart = startOfMonthMs(cursor);
          const key = new Date(monthStart).toISOString().slice(0, 7);

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

    refresh,
    loading: powerRT.loading,
    error: powerRT.error,
  };
}
