import { getRepo } from "../../db";
import { applyLike, applyListen, emptyTaste, type Taste } from "../../lib/taste";
import type { Track } from "../../sources/types";

const KEY = "taste";
let cached: Promise<Taste> | undefined;

export function loadTaste(): Promise<Taste> {
  cached ??= getRepo()
    .then((r) => r.getSetting<Taste>(KEY))
    .then((t) => (t && typeof t === "object" && t.tracks ? t : emptyTaste()))
    .catch(() => emptyTaste());
  return cached;
}

async function update(fn: (t: Taste) => Taste) {
  const next = fn(await loadTaste());
  cached = Promise.resolve(next);
  await (await getRepo()).setSetting(KEY, next);
}

/** `fraction` of the track that was actually heard (0..1). */
export const recordListen = (t: Track, fraction: number) =>
  update((p) => applyListen(p, t, fraction, Date.now()));
export const recordLike = (t: Track) => update((p) => applyLike(p, t, Date.now()));
