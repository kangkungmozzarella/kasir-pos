"use client";

import { useEffect, useState } from "react";

/** Hitung mundur ke `until` (ISO string). Label "m:ss"; `done` bila sudah lewat. */
export function useCountdown(until: string | null) {
  const target = until ? new Date(until).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (target === null) return { seconds: 0, label: "", done: false };
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return { seconds, label, done: seconds === 0 };
}
