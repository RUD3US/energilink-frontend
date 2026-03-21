import { useCallback, useMemo, useState } from "react";
import { getNotes } from "../lib/api";

export type NoteRow = { id: number; time: string; text: string; author_id: number };

export function useNotes(device: string, metric: string) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (limit: number = 200) => {
      try {
        const n = await getNotes({ device, metric, limit: String(limit) });
        setNotes(n);
        setError(null);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      }
    },
    [device, metric]
  );

  return { notes, error, refresh };
}

// Notes that fall within the currently visible chart window
export function useNotesInWindow(points: { time: string }[], notes: NoteRow[]) {
  return useMemo(() => {
    if (!points.length) return [];
    const tMin = new Date(points[0].time).getTime();
    const tMax = new Date(points[points.length - 1].time).getTime();

    return notes
      .slice()
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .filter((n) => {
        const nt = new Date(n.time).getTime();
        return nt >= tMin && nt <= tMax;
      });
  }, [points, notes]);
}