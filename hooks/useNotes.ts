import { useCallback, useMemo, useState } from "react";
import { getNotes } from "../lib/api";

export type NoteRow = {
  id: number;
  time: string;
  text: string;
  author_id?: number;
  anchor_time?: string | null;
  anchor_value?: number | null;
  anchor_field?: string | null;
  verified?: number;
};

export function useNotes(device: string, metric: string) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (limit: number = 1000) => {
      try {
        const n = await getNotes({ device, metric, limit: String(limit) });
        setNotes(Array.isArray(n) ? n : []);
        setError(null);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      }
    },
    [device, metric]
  );

  return { notes, error, refresh };
}

function toTimeMs(value: string | null | undefined): number | null {
  if (!value) return null;

  const ms = new Date(value).getTime();

  if (!Number.isFinite(ms)) return null;

  return ms;
}

/**
 * Notes that fall within the currently visible chart/window.
 *
 * Important:
 * Some APIs return chart points newest-to-oldest.
 * The old code assumed points[0] was oldest and points[last] was newest.
 * This version uses Math.min / Math.max, so it works either way.
 */
export function useNotesInWindow(points: { time: string }[], notes: NoteRow[]) {
  return useMemo(() => {
    const pointTimes = points
      .map((p) => toTimeMs(p.time))
      .filter((v): v is number => typeof v === "number");

    if (!pointTimes.length) return [];

    const tMin = Math.min(...pointTimes);
    const tMax = Math.max(...pointTimes);

    return notes
      .slice()
      .map((n) => ({
        ...n,
        time: n.anchor_time ?? n.time,
      }))
      .sort((a, b) => {
        const ams = toTimeMs(a.time) ?? 0;
        const bms = toTimeMs(b.time) ?? 0;
        return ams - bms;
      })
      .filter((n) => {
        const nt = toTimeMs(n.time);
        if (nt === null) return false;
        return nt >= tMin && nt <= tMax;
      });
  }, [points, notes]);
}
