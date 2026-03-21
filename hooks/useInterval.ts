import { useEffect, useRef } from "react";

export function useInterval(fn: () => void, delayMs: number | null) {
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => fnRef.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}