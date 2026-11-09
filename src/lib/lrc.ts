export type LrcLine = { t: number; line: string };

const TIME = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

/** Parses LRC text into time-sorted lines. Metadata tags ([ar:], [length:]…) are ignored. */
export function parseLrc(text: string): LrcLine[] {
  const out: LrcLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(TIME)];
    if (!stamps.length) continue;
    const line = raw.replace(TIME, "").trim();
    for (const m of stamps) {
      const sec = Number(m[1]) * 60 + Number(m[2].replace(":", "."));
      if (Number.isFinite(sec)) out.push({ t: sec, line });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Index of the line being sung at `sec` (binary search), or -1 before the first line. */
export function activeLine(lines: LrcLine[], sec: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= sec) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
