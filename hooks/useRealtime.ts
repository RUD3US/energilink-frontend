// hooks/useRealtime.ts

import { useCallback, useState } from "react";
import { getRealtime } from "../lib/api";

export function useRealtime(device: string, field: string) {
  const [points, setPoints] = useState<Array<{ time: string; value: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (limit: string = "200") => {
      setLoading(true);

      try {
        const rt = await getRealtime({ device, field, limit });
        setPoints(Array.isArray(rt) ? rt : []);
        setError(null);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    },
    [device, field]
  );

  return { points, error, loading, refresh };
}
