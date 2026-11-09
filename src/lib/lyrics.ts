import type { Track } from "../sources/types";
import { getSource } from "../sources";
import { MockMusicSource } from "../sources/mock/MockMusicSource";
import { getRepo } from "../db";
import { httpFetch, type FetchFn } from "./http";
import { parseLrc, type LrcLine } from "./lrc";

export type Lyrics = { synced?: LrcLine[]; plain?: string };
type LrclibRecord = {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
};

const BASE = "https://lrclib.net/api";
const HEADERS = { "Lrclib-Client": "Musicfree (https://github.com/chrystianschmith/Musicfree)" };

function toLyrics(r: LrclibRecord | undefined): Lyrics | null {
  if (!r || r.instrumental) return null;
  const synced = r.syncedLyrics ? parseLrc(r.syncedLyrics) : [];
  const plain = r.plainLyrics?.trim() || undefined;
  if (!synced.length && !plain) return null;
  return { synced: synced.length ? synced : undefined, plain };
}

/** Looks a track up on LRCLIB: exact match first, then free search. */
export async function fetchLrclib(t: Track, f: FetchFn = httpFetch): Promise<Lyrics | null> {
  const artist = t.artists[0]?.name ?? "";
  const get = new URL(`${BASE}/get`);
  get.searchParams.set("track_name", t.title);
  get.searchParams.set("artist_name", artist);
  if (t.album?.title) get.searchParams.set("album_name", t.album.title);
  if (t.durationMs) get.searchParams.set("duration", String(Math.round(t.durationMs / 1000)));
  const r1 = await f(get, { headers: HEADERS });
  if (r1.ok) {
    const rec = (await r1.json()) as LrclibRecord;
    if (rec.instrumental) return null;
    const hit = toLyrics(rec);
    if (hit) return hit;
  }
  const search = new URL(`${BASE}/search`);
  search.searchParams.set("track_name", t.title);
  search.searchParams.set("artist_name", artist);
  const r2 = await f(search, { headers: HEADERS });
  if (!r2.ok) return null;
  const list = (await r2.json()) as unknown;
  if (!Array.isArray(list)) return null;
  const recs = list as LrclibRecord[];
  const best = recs.find((x) => x.syncedLyrics) ?? recs.find((x) => x.plainLyrics);
  return toLyrics(best);
}

function mockLyrics(t: Track): Lyrics {
  const verses = [
    "Atravessei a avenida",
    "sem olhar pra trás",
    "o neon refletia",
    "tudo o que é capaz",
    "",
    "e a cidade acordava",
    "no compasso do mar",
    "cada luz que apagava",
    "me ensinava a voltar",
    "",
    `${t.title.toLowerCase()}, de novo`,
    "a noite inteira em mim",
    "um refrão que não termina",
    "um começo sem fim",
  ];
  return { synced: verses.map((line, i) => ({ t: 2 + i * 4.5, line })) };
}

/** Lyrics with a persistent cache (misses are cached for a day to avoid hammering LRCLIB). */
export async function fetchLyrics(t: Track): Promise<Lyrics | null> {
  if (getSource() instanceof MockMusicSource) return mockLyrics(t);
  const repo = await getRepo();
  const key = `lyrics:${t.id}`;
  const cached = await repo.getSetting<{ at: number; v: Lyrics | null }>(key);
  if (cached && (cached.v || Date.now() - cached.at < 86_400_000)) return cached.v;
  const v = await fetchLrclib(t);
  await repo.setSetting(key, { at: Date.now(), v });
  return v;
}
