import type { Thumb } from "../sources/types";

/** "1:05", "1:02:05"; "—" for missing or invalid values. */
export function formatTime(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec) || sec < 0) return "—";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Smallest thumbnail whose width is >= `size`, else the largest one. */
export function pickThumb(thumbs: Thumb[], size: number): string | undefined {
  if (!thumbs.length) return undefined;
  const sorted = [...thumbs].sort((a, b) => a.w - b.w);
  return (sorted.find((t) => t.w >= size) ?? sorted[sorted.length - 1]).url;
}
