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

function dayKeyFromMs(ms: number) {
  return new Date(startOfDayMs(ms)).toISOString().slice(0, 10);
}

function monthKeyFromMs(ms: number) {
  return new Date(startOfMonthMs(ms)).toISOString().slice(0, 7);
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
  const total = data.reduce((sum, item) => sum + item.kwh, 0);
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

  useEffect(() => {
    const estimatedDailyPoints = Math.max(days * 48, 500);
    const estimatedMonthlyPoints = Math.max(months * 31 * 48, 500);
    const estimatedPoints = Math.max(estimatedDailyPoints, estimatedMonthlyPoints);
    powerRT.refresh(String(estimatedPoints));
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
      buckets.set(dayKeyFromMs(dayMs), 0);
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
          const key = dayKeyFromMs(cursor);

          if (buckets.has(key)) {
            buckets.set(key, (buckets.get(key) || 0) + toKwh(current.power, sliceHours));
          }

          cursor = sliceEnd;
        }
      }
    }

    return Array.from(buckets.keys()).map((key) => {
      const ms = new Date(`${key}T00:00:00`).getTime();
      return {
        dayKey: key,
        label: dayLabel(ms),
        kwh: Number((buckets.get(key) || 0).toFixed(2)),
      };
    });
  }, [sorted, days]);

  const monthlyData = useMemo<MonthlyKwhBarPoint[]>(() => {
    const now = Date.now();
    const firstMonth = new Date(now);
    firstMonth.setDate(1);
    firstMonth.setHours(0, 0, 0, 0);
    firstMonth.setMonth(firstMonth.getMonth() - (months - 1));
    const fromMs = firstMonth.getTime();

    const buckets = new Map<string, number>();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      d.setMonth(d.getMonth() - i);
      buckets.set(monthKeyFromMs(d.getTime()), 0);
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
          const key = monthKeyFromMs(cursor);

          if (buckets.has(key)) {
            buckets.set(key, (buckets.get(key) || 0) + toKwh(current.power, sliceHours));
          }

          cursor = sliceEnd;
        }
      }
    }

    return Array.from(buckets.keys()).map((key) => {
      const ms = new Date(`${key}-01T00:00:00`).getTime();
      return {
        monthKey: key,
        label: monthLabel(ms),
        kwh: Number((buckets.get(key) || 0).toFixed(2)),
      };
    });
  }, [sorted, months]);

  const dailySummary = useMemo(() => buildSummary(dailyData), [dailyData]);
  const monthlySummary = useMemo(() => buildSummary(monthlyData), [monthlyData]);

  return {
    dailyData,
    monthlyData,
    dailySummary,
    monthlySummary,
    refresh: () => {
      const estimatedDailyPoints = Math.max(days * 48, 500);
      const estimatedMonthlyPoints = Math.max(months * 31 * 48, 500);
      const estimatedPoints = Math.max(estimatedDailyPoints, estimatedMonthlyPoints);
      powerRT.refresh(String(estimatedPoints));
    },
    loading: powerRT.loading,
    error: powerRT.error,
  };
}
