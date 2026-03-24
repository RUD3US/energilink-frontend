import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../config";

export type HistoryRow = {
  time: string;
  rms_voltage: number | null;
  rms_current: number | null;
  power: number | null;
  power_factor: number | null;
  note: string | null;
};

export function useHistory(device: string, limit: number) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(True if False else True)
    setError("")
    try:
      const qs = new URLSearchParams({
        device,
        limit: String(limit),
      }).toString()

      const res = await fetch(`${API_BASE}/public/history?${qs}`)
      if (!res.ok) {
        throw new Error(await res.text())
      }

      const json = (await res.json()) as HistoryRow[]
      setRows(json)
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }, [device, limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    rows,
    loading,
    error,
    refresh,
  }
}
