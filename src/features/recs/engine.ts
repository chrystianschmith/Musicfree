import { getSource } from "../../sources";
import type { MusicSource, Track } from "../../sources/types";
import { mixBuckets, type Buckets } from "./mix";
import { titleKey } from "./titles";

export type RecommendOptions = {
  limit: number;
  /** Tracks the listener already knows; neither they nor other versions of them are suggested. */
  heard?: Track[];
  maxPerArtist?: number;
};

/** How many similar artists stand in for the seed's style. */
const SIMILAR_ARTISTS = 3;

/** Round-robin merge, so no single list dominates the front. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) if (l[i] !== undefined) out.push(l[i]);
  return out;
}

/**
 * Recommendations by style: the seed's album, its artist, artists YouTube considers similar
 * and the song's Related tab, mixed by `mixBuckets`. YouTube's radio only fills the gaps.
 */
export function createRecommender(source: MusicSource) {
  const cache = new Map<string, Promise<unknown>>();
  function cached<T>(key: string, load: () => Promise<T>): Promise<T | undefined> {
    let p = cache.get(key) as Promise<T> | undefined;
    if (!p) {
      p = load();
      cache.set(key, p);
      p.catch(() => cache.delete(key));
    }
    return p.catch((e) => {
      console.warn(`[recs] ${key} failed`, e);
      return undefined;
    });
  }

  async function bucketsFor(seed: Track): Promise<Omit<Buckets, "radio">> {
    const artistId = seed.artists[0]?.id;
    const [album, artist, related] = await Promise.all([
      seed.album?.id
        ? cached(`album:${seed.album.id}`, () => source.album(seed.album!.id!))
        : undefined,
      artistId ? cached(`artist:${artistId}`, () => source.artist(artistId)) : undefined,
      cached(`related:${seed.id}`, () => source.related(seed.id)),
    ]);
    const similarArtists = (artist?.related ?? []).slice(0, SIMILAR_ARTISTS);
    const similar = await Promise.all(
      similarArtists.map((a) => cached(`artist:${a.id}`, () => source.artist(a.id))),
    );
    return {
      album: album?.tracks ?? [],
      artist: artist?.topTracks ?? [],
      similar: interleave(similar.map((a) => a?.topTracks ?? [])),
      related: related ?? [],
    };
  }

  async function recommendFor(seeds: Track[], opts: RecommendOptions): Promise<Track[]> {
    if (!seeds.length) return [];
    const heardKeys = new Set([...seeds, ...(opts.heard ?? [])].map((t) => titleKey(t.title)));
    const perSeed = await Promise.all(seeds.map(bucketsFor));
    const merged = (k: keyof Omit<Buckets, "radio">) => interleave(perSeed.map((b) => b[k]));
    const buckets: Buckets = {
      album: merged("album"),
      artist: merged("artist"),
      similar: merged("similar"),
      related: merged("related"),
      radio: [],
    };
    const mixOpts = { limit: opts.limit, heardKeys, maxPerArtist: opts.maxPerArtist };
    const first = mixBuckets(buckets, mixOpts);
    if (first.length >= opts.limit) return first;
    const radios = await Promise.all(
      seeds.map((s) => cached(`radio:${s.id}`, () => source.radio(s.id))),
    );
    return mixBuckets({ ...buckets, radio: interleave(radios.map((r) => r ?? [])) }, mixOpts);
  }

  return { recommendFor };
}

let shared: ReturnType<typeof createRecommender> | undefined;
/** Session-wide recommender over the active music source. */
export const recommender = () => (shared ??= createRecommender(getSource()));
