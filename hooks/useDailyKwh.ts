import { useEffect, useMemo } from "react";
import { DEFAULT_DEVICE, FIELD_POWER } from "../config";
import { useRealtime } from "./useRealtime";

export type DailyKwhPoint = {
  dayKey: string;
  label: string;
  kwh: number;
};

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

function dayLabelFromMs(ms: number) {
  const d = new Date(ms);
  const month = d.toLocaleString(undefined, { month: "short" });
  return `${month} ${d.getDate()}`;
}

function addEnergyAcrossDays(
  buckets: Map<string, number>,
  startMs: number,
  endMs: number,
  kw: number
) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;
  if (!Number.isFinite(kw) || kw < 0) return;

  let cursor = startMs;

  while (cursor < endMs) {
    const dayEnd = Math.min(endOfDayMs(cursor) + 1, endMs);
    const hours = (dayEnd - cursor) / 1000 / 60 / 60;

    const dayStart = startOfDayMs(cursor);
    const key = new Date(dayStart).toISOString().slice(0, 10);

    buckets.set(key, (buckets.get(key) || 0) + kw * hours);
    cursor = dayEnd;
  }
}

export function useDailyKwh(days = 14, device = DEFAULT_DEVICE) {
  const powerRT = useRealtime(device, FIELD_POWER);

  useEffect(() => {
    const estimatedPoints = Math.max(days * 24 * 4, 500);
    powerRT.refresh(String(estimatedPoints));
  }, [days, device]);

  const data = useMemo<DailyKwhPoint[]>(() => {
    const raw = Array.isArray(powerRT.points) ? powerRT.points : [];
    if (!raw.length) return [];

    const now = Date.now();
    const fromMs = now - days * 24 * 60 * 60 * 1000;

    const sorted = raw
      .map((p) => ({
        timeMs: new Date(p.time).getTime(),
        kw: Number(p.value),
      }))
      .filter((p) => Number.isFinite(p.timeMs) && Number.isFinite(p.kw))
      .sort((a, b) => a.timeMs - b.timeMs);

    if (sorted.length < 2) return [];

    const buckets = new Map<string, number>();

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      if (current.timeMs < fromMs && next.timeMs < fromMs) continue;

      const segStart = Math.max(current.timeMs, fromMs);
      const segEnd = next.timeMs;

      if (segEnd <= segStart) continue;

      const dtHours = (segEnd - segStart) / 1000 / 60 / 60;

      // Skip unrealistic gaps so one stale point does not create fake energy.
      if (dtHours > 6) continue;

      addEnergyAcrossDays(buckets, segStart, segEnd, current.kw);
    }

    const out: DailyKwhPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayMs = startOfDayMs(now - i * 24 * 60 * 60 * 1000);
      const key = new Date(dayMs).toISOString().slice(0, 10);

      out.push({
        dayKey: key,
        label: dayLabelFromMs(dayMs),
        kwh: Number((buckets.get(key) || 0).toFixed(2)),
      });
    }

    return out;
  }, [powerRT.points, days]);

  return {
    data,
    refresh: () => {
      const estimatedPoints = Math.max(days * 24 * 4, 500);
      powerRT.refresh(String(estimatedPoints));
    },
  };
}
