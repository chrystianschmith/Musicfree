import { describe, expect, it } from "vitest";
import type { Track } from "../../sources/types";
import { mixBuckets, type Buckets } from "./mix";

let n = 0;
const tr = (title: string, artist: string): Track => ({
  id: `v${++n}`,
  title,
  artists: [{ id: artist, name: artist }],
  thumbs: [],
});
const many = (artist: string, count: number, prefix = artist) =>
  Array.from({ length: count }, (_, i) => tr(`${prefix} song ${i}`, artist));

const empty: Buckets = { album: [], artist: [], similar: [], related: [], radio: [] };

describe("mixBuckets", () => {
  it("drops other versions of the same song, keeping the first one", () => {
    const original = tr("Evidências", "chitaozinho");
    const out = mixBuckets(
      {
        ...empty,
        album: [original],
        related: [tr("Evidências (Ao Vivo)", "outro"), tr("Evidencias - Cover", "canal")],
      },
      { limit: 10 },
    );
    expect(out.map((t) => t.id)).toEqual([original.id]);
  });

  it("drops songs the listener already heard, by title", () => {
    const out = mixBuckets(
      { ...empty, similar: [tr("Yellow", "outro"), tr("Clocks", "coldplay")] },
      { limit: 10, heardKeys: new Set(["yellow"]) },
    );
    expect(out.map((t) => t.title)).toEqual(["Clocks"]);
  });

  it("drops covers, karaoke and tracks without an artist", () => {
    const noArtist: Track = { id: "x", title: "Something", artists: [], thumbs: [] };
    const out = mixBuckets(
      { ...empty, related: [tr("Song (Karaoke)", "k"), noArtist, tr("Real", "a")] },
      { limit: 10 },
    );
    expect(out.map((t) => t.title)).toEqual(["Real"]);
  });

  it("interleaves album, artist and similar-style tracks", () => {
    const out = mixBuckets(
      {
        ...empty,
        album: many("a", 6, "alb"),
        artist: many("a", 6, "top"),
        similar: [...many("b", 4), ...many("c", 4)],
        related: many("d", 4),
      },
      { limit: 10 },
    );
    expect(out).toHaveLength(10);
    const artists = new Set(out.map((t) => t.artists[0].id));
    expect(artists.size).toBeGreaterThanOrEqual(3);
  });

  it("never plays three in a row by the same artist and caps each artist at three", () => {
    const out = mixBuckets(
      {
        ...empty,
        album: many("a", 10, "alb"),
        artist: many("a", 10, "top"),
        similar: many("b", 10),
      },
      { limit: 12 },
    );
    const ids = out.map((t) => t.artists[0].id);
    for (let i = 2; i < ids.length; i++)
      expect(ids[i] === ids[i - 1] && ids[i] === ids[i - 2]).toBe(false);
    expect(ids.filter((a) => a === "a").length).toBeLessThanOrEqual(3);
  });

  it("uses the radio only to fill what the other sources could not", () => {
    const radio = many("r", 5);
    expect(mixBuckets({ ...empty, similar: many("b", 3), radio }, { limit: 4 })).toHaveLength(4);
    const full = mixBuckets(
      { ...empty, similar: [...many("b", 3), ...many("c", 3)], radio },
      { limit: 4 },
    );
    expect(full.some((t) => t.artists[0].id === "r")).toBe(false);
  });
});
