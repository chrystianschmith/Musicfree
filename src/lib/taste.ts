/**
 * Local listening profile: what the user actually plays, kept on their computer only.
 * Pure functions; persistence lives in features/recs.
 */
import type { Thumb, Track } from "../sources/types";

export type TasteEntry = { track: Track; score: number; at: number };
export type Taste = { tracks: Record<string, TasteEntry> };
export type TasteArtist = { id: string; name: string; thumbs: Thumb[]; score: number };

export const MAX_TRACKS = 400;
const HALF_LIFE_MS = 30 * 86_400_000;

export const emptyTaste = (): Taste => ({ tracks: {} });

const decayed = (e: TasteEntry, now: number) =>
  e.score * Math.pow(0.5, Math.max(0, now - e.at) / HALF_LIFE_MS);

/** How much one listen is worth: finished ≈ 1, partial = fraction heard, skipped right away counts against. */
export function listenWeight(fraction: number): number {
  if (fraction >= 0.8) return 1;
  if (fraction >= 0.3) return fraction;
  if (fraction < 0.1) return -0.5;
  return 0;
}

function bump(p: Taste, t: Track, delta: number, now: number): Taste {
  if (delta === 0) return p;
  const prev = p.tracks[t.id];
  const tracks = {
    ...p.tracks,
    [t.id]: { track: t, score: (prev ? decayed(prev, now) : 0) + delta, at: now },
  };
  const ids = Object.keys(tracks);
  if (ids.length > MAX_TRACKS) {
    ids
      .sort((a, b) => decayed(tracks[a], now) - decayed(tracks[b], now))
      .slice(0, ids.length - MAX_TRACKS)
      .forEach((id) => delete tracks[id]);
  }
  return { tracks };
}

/** Records that `fraction` (0..1) of a track was heard. */
export const applyListen = (p: Taste, t: Track, fraction: number, now: number) =>
  bump(p, t, listenWeight(fraction), now);
/** Liking a track is a strong signal. */
export const applyLike = (p: Taste, t: Track, now: number) => bump(p, t, 2, now);

function ranked(p: Taste, now: number): { track: Track; score: number }[] {
  return Object.values(p.tracks)
    .map((e) => ({ track: e.track, score: decayed(e, now) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);
}

export const topTracks = (p: Taste, now: number, n = 20): Track[] =>
  ranked(p, now)
    .slice(0, n)
    .map((e) => e.track);

export function topArtists(p: Taste, now: number, n = 10): TasteArtist[] {
  const by = new Map<string, TasteArtist>();
  for (const { track, score } of ranked(p, now)) {
    const a = track.artists[0];
    if (!a?.id) continue;
    const cur = by.get(a.id);
    if (cur) cur.score += score;
    else by.set(a.id, { id: a.id, name: a.name, thumbs: track.thumbs, score });
  }
  return [...by.values()].sort((a, b) => b.score - a.score).slice(0, n);
}

/** Best tracks to seed recommendations with, at most one per artist. */
export function seedTracks(p: Taste, now: number, n = 3): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const { track } of ranked(p, now)) {
    const key = track.artists[0]?.id ?? track.artists[0]?.name ?? track.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(track);
    if (out.length === n) break;
  }
  return out;
}

/** Deterministic pick of `n` items that stays the same all day and changes the next day. */
export function dailyPick<T>(xs: T[], n: number, now: number): T[] {
  let seed = Math.floor(now / 86_400_000) + 1;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
