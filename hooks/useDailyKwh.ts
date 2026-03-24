import { useEffect, useMemo } from "react";
import { DEFAULT_DEVICE, FIELD_POWER } from "../config";
import { useRealtime } from "./useRealtime";

export type DailyKwhBarPoint = {
  dayKey: string;
  label: string;
  kwh: number;
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

function dayLabel(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
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

export function useDailyKwh(days = 14, device = DEFAULT_DEVICE) {
  const powerRT = useRealtime(device, FIELD_POWER);

  useEffect(() => {
    const estimatedPoints = Math.max(days * 48, 500);
    powerRT.refresh(String(estimatedPoints));
  }, [days, device]);

  const data = useMemo<DailyKwhBarPoint[]>(() => {
    const now = Date.now();
    const fromMs = startOfDayMs(now - (days - 1) * 24 * 60 * 60 * 1000);

    const sorted = sanitizePoints(powerRT.points)
      .map((p) => ({
        timeMs: toMs(p.time),
        power: p.value,
      }))
      .filter((p) => Number.isFinite(p.timeMs) && Number.isFinite(p.power))
      .sort((a, b) => a.timeMs - b.timeMs);

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
  }, [powerRT.points, days]);

  const summary = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.kwh, 0);
    const avg = data.length ? total / data.length : 0;
    const today = data[data.length - 1]?.kwh ?? 0;
    const yesterday = data[data.length - 2]?.kwh ?? 0;

    const peak = data.reduce<DailyKwhBarPoint | null>(
      (best, item) => (!best || item.kwh > best.kwh ? item : best),
      null
    );

    return {
      total: Number(total.toFixed(2)),
      avg: Number(avg.toFixed(2)),
      today: Number(today.toFixed(2)),
      yesterday: Number(yesterday.toFixed(2)),
      peakLabel: peak?.label ?? "—",
      peakKwh: Number((peak?.kwh ?? 0).toFixed(2)),
    };
  }, [data]);

  return {
    data,
    summary,
    refresh: () => {
      const estimatedPoints = Math.max(days * 48, 500);
      powerRT.refresh(String(estimatedPoints));
    },
    loading: powerRT.loading,
    error: powerRT.error,
  };
}
