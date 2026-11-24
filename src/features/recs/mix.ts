import type { Track } from "../../sources/types";
import { isAltVersion, titleKey } from "./titles";

/** Candidate tracks by where they came from. */
export type Buckets = {
  /** Other tracks of the seed's album. */
  album: Track[];
  /** The seed artist's top tracks. */
  artist: Track[];
  /** Top tracks of similar artists: the style. */
  similar: Track[];
  /** The song's "Related" tab. */
  related: Track[];
  /** YouTube's automix radio: only fills what the others could not. */
  radio: Track[];
};

export type MixOptions = {
  limit: number;
  /** Title keys (see `titleKey`) of songs the listener already knows; never suggested again. */
  heardKeys?: Set<string>;
  maxPerArtist?: number;
};

/**
 * One round of the mix: album 2, artist 2, similar 4, related 2, spread out so tracks by the
 * seed's own artist (album and artist buckets) are not stacked back to back.
 */
const ROUND: (keyof Buckets)[] = [
  "album",
  "similar",
  "artist",
  "similar",
  "related",
  "album",
  "similar",
  "artist",
  "similar",
  "related",
];

const artistOf = (t: Track) => t.artists[0]?.id ?? t.artists[0]?.name ?? "";

/**
 * Balanced mix of the buckets: one version of each song, no covers or re-uploads, nothing
 * already heard, at most two tracks in a row (and `maxPerArtist` overall) by one artist.
 */
export function mixBuckets(b: Buckets, opts: MixOptions): Track[] {
  const { limit, heardKeys = new Set<string>(), maxPerArtist = 3 } = opts;
  const out: Track[] = [];
  const keys = new Set(heardKeys);
  const ids = new Set<string>();
  const perArtist = new Map<string, number>();
  const queues = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, [...v]])) as Record<
    keyof Buckets,
    Track[]
  >;

  const rejected = (t: Track) =>
    !t.artists.length ||
    ids.has(t.id) ||
    keys.has(titleKey(t.title)) ||
    isAltVersion(t.title) ||
    (perArtist.get(artistOf(t)) ?? 0) >= maxPerArtist;
  const thirdInARow = (t: Track) =>
    out.length >= 2 &&
    artistOf(out[out.length - 1]) === artistOf(t) &&
    artistOf(out[out.length - 2]) === artistOf(t);

  /** Takes the next acceptable track from a bucket; tracks that would break a run wait. */
  const take = (name: keyof Buckets): boolean => {
    const q = queues[name];
    for (let i = 0; i < q.length; i++) {
      const t = q[i];
      if (rejected(t)) {
        q.splice(i--, 1);
        continue;
      }
      if (thirdInARow(t)) continue;
      q.splice(i, 1);
      out.push(t);
      ids.add(t.id);
      keys.add(titleKey(t.title));
      perArtist.set(artistOf(t), (perArtist.get(artistOf(t)) ?? 0) + 1);
      return true;
    }
    return false;
  };

  let progress = true;
  while (out.length < limit && progress) {
    progress = false;
    for (const name of ROUND) if (out.length < limit && take(name)) progress = true;
  }
  while (out.length < limit && take("radio"));
  return out;
}
