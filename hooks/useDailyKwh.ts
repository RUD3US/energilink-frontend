import { useEffect, useMemo, useState } from "react";
import { API_BASE, DEFAULT_DEVICE } from "../config";

export type DailyKwhBarPoint = {
  dayKey: string;
  label: string;
  kwh: number;
};

export type Compare14DayPoint = {
  slotKey: string;
  label: string;
  currentKwh: number;
  previousKwh: number;
  currentFullLabel: string;
  previousFullLabel: string;
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

export type Compare14Summary = {
  currentTotal: number;
  previousTotal: number;
  deltaKwh: number;
  deltaPercent: number | null;
  currentPeakLabel: string;
  currentPeakKwh: number;
  previousPeakLabel: string;
  previousPeakKwh: number;
};

type HistoryPoint = {
  time: string;
  rms_voltage: number | null;
  rms_current: number | null;
  power: number | null;
  power_factor: number | null;
  note?: string | null;
};

const API_HISTORY_LIMIT = 5000;
const MAX_GAP_HOURS = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function fullDayLabel(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function buildCompare14Summary(
  currentData: DailyKwhBarPoint[],
  previousData: DailyKwhBarPoint[]
): Compare14Summary {
  const currentSummary = buildSummary(currentData);
  const previousSummary = buildSummary(previousData);

  const deltaKwh = Number((currentSummary.total - previousSummary.total).toFixed(2));
  const deltaPercent =
    previousSummary.total > 0
      ? Number(
          (
            ((currentSummary.total - previousSummary.total) / previousSummary.total) *
            100
          ).toFixed(2)
        )
      : null;

  return {
    currentTotal: currentSummary.total,
    previousTotal: previousSummary.total,
    deltaKwh,
    deltaPercent,
    currentPeakLabel: currentSummary.peakLabel,
    currentPeakKwh: currentSummary.peakKwh,
    previousPeakLabel: previousSummary.peakLabel,
    previousPeakKwh: previousSummary.peakKwh,
  };
}

function isValidHistoryPoint(p: HistoryPoint) {
  if (!p) return false;
  if (typeof p.time !== "string") return false;
  if (typeof p.power !== "number" || !Number.isFinite(p.power)) return false;
  if (typeof p.rms_voltage !== "number" || !Number.isFinite(p.rms_voltage)) return false;
  if (typeof p.rms_current !== "number" || !Number.isFinite(p.rms_current)) return false;
  if (typeof p.power_factor !== "number" || !Number.isFinite(p.power_factor)) return false;

  if (p.power < 0) return false;
  if (p.rms_voltage === 0 && p.rms_current === 0) return false;
  if (p.power_factor <= 0.001 && p.power > 50) return false;

  return true;
}

function buildDailyWindowData(
  sorted: Array<{ timeMs: number; power: number }>,
  startMs: number,
  endMs: number
): DailyKwhBarPoint[] {
  const buckets = new Map<string, number>();

  for (
    let cursor = startOfDayMs(startMs);
    cursor <= endMs;
    cursor += DAY_MS
  ) {
    buckets.set(localDayKey(cursor), 0);
  }

  if (sorted.length >= 2) {
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      if (next.timeMs <= startMs) continue;

      const segStart = Math.max(current.timeMs, startMs);
      const segEnd = Math.min(next.timeMs, endMs + 1);

      if (segEnd <= segStart) continue;

      const gapHours = (segEnd - segStart) / 1000 / 60 / 60;
      if (gapHours > MAX_GAP_HOURS) continue;
      if (current.power < 0) continue;

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
}

function buildRangeLabelFromMs(startMs: number, endMs: number) {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const startText = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endText = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${startText}-${endText}`;
}

export function useDailyKwh(
  days = 14,
  months = 12,
  compareOffsetBlocks = 0,
  device = DEFAULT_DEVICE
) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);

      const qs = new URLSearchParams({
        device,
        limit: String(API_HISTORY_LIMIT),
      }).toString();

      const res = await fetch(`${API_BASE}/public/history?${qs}`);
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(
          `History endpoint did not return JSON. Response starts with: ${text.slice(0, 120)}`
        );
      }

      setPoints(Array.isArray(parsed) ? (parsed as HistoryPoint[]) : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [days, months, compareOffsetBlocks, device]);

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
    const now = new Date();
    const endMs = endOfDayMs(now.getTime());
    const startDate = new Date(endMs);
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);
    const startMs = startDate.getTime();

    return {
      startMs,
      endMs,
      batchLabel: `Last ${days} days`,
      visibleLabel: buildRangeLabelFromMs(startMs, endMs),
      todayDay: now.getDate(),
      daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    };
  }, [days, sorted.length]);

  const dailyData = useMemo<DailyKwhBarPoint[]>(() => {
    return buildDailyWindowData(sorted, batchInfo.startMs, batchInfo.endMs);
  }, [sorted, batchInfo]);

  const compareInfo = useMemo(() => {
    const anchorEndBase = endOfDayMs(Date.now());
    const shiftedEnd = anchorEndBase - compareOffsetBlocks * days * DAY_MS;

    const currentEndMs = endOfDayMs(shiftedEnd);
    const currentStartMs = startOfDayMs(currentEndMs - (days - 1) * DAY_MS);

    const previousEndMs = endOfDayMs(currentStartMs - 1);
    const previousStartMs = startOfDayMs(previousEndMs - (days - 1) * DAY_MS);

    const earliestMs = sorted[0]?.timeMs ?? null;

    return {
      currentStartMs,
      currentEndMs,
      previousStartMs,
      previousEndMs,
      currentLabel: buildRangeLabelFromMs(currentStartMs, currentEndMs),
      previousLabel: buildRangeLabelFromMs(previousStartMs, previousEndMs),
      canGoNewer: compareOffsetBlocks > 0,
      canGoOlder: earliestMs !== null ? earliestMs <= previousStartMs : false,
    };
  }, [sorted, days, compareOffsetBlocks]);

  const compareCurrentWindow = useMemo<DailyKwhBarPoint[]>(() => {
    return buildDailyWindowData(
      sorted,
      compareInfo.currentStartMs,
      compareInfo.currentEndMs
    );
  }, [sorted, compareInfo]);

  const comparePreviousWindow = useMemo<DailyKwhBarPoint[]>(() => {
    return buildDailyWindowData(
      sorted,
      compareInfo.previousStartMs,
      compareInfo.previousEndMs
    );
  }, [sorted, compareInfo]);

  const compare14Data = useMemo<Compare14DayPoint[]>(() => {
    const maxLen = Math.max(compareCurrentWindow.length, comparePreviousWindow.length);

    return Array.from({ length: maxLen }).map((_, index) => {
      const currentItem = compareCurrentWindow[index];
      const previousItem = comparePreviousWindow[index];

      return {
        slotKey: `slot-${index}`,
        label: currentItem?.label ?? previousItem?.label ?? `Day ${index + 1}`,
        currentKwh: Number((currentItem?.kwh ?? 0).toFixed(2)),
        previousKwh: Number((previousItem?.kwh ?? 0).toFixed(2)),
        currentFullLabel: currentItem
          ? fullDayLabel(new Date(`${currentItem.dayKey}T00:00:00`).getTime())
          : "—",
        previousFullLabel: previousItem
          ? fullDayLabel(new Date(`${previousItem.dayKey}T00:00:00`).getTime())
          : "—",
      };
    });
  }, [compareCurrentWindow, comparePreviousWindow]);

  const compare14Summary = useMemo(() => {
    return buildCompare14Summary(compareCurrentWindow, comparePreviousWindow);
  }, [compareCurrentWindow, comparePreviousWindow]);

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
        if (current.power < 0) continue;

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
    compare14Data,
    compare14Summary,
    compareCurrentLabel: compareInfo.currentLabel,
    comparePreviousLabel: compareInfo.previousLabel,
    compareCanGoOlder: compareInfo.canGoOlder,
    compareCanGoNewer: compareInfo.canGoNewer,
    monthlyData,
    dailySummary,
    monthlySummary,
    batchLabel: batchInfo.batchLabel,
    visibleLabel: batchInfo.visibleLabel,
    todayDay: batchInfo.todayDay,
    daysInMonth: batchInfo.daysInMonth,

    refresh,
    loading,
    error,
  };
}
