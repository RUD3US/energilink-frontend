import { useCallback, useState } from "react";
import { getRealtime } from "../lib/api";

export function useRealtime(device: string, field: string) {
  const [points, setPoints] = useState<Array<{ time: string; value: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (limit: string = "200") => {
      try {
        const rt = await getRealtime({ device, field, limit });
        setPoints(rt);
        setError(null);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      }
    },
    [device, field]
  );

  return { points, error, refresh };
}