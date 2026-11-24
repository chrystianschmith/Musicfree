import { describe, expect, it, vi } from "vitest";
import type { Album, Artist, MusicSource, Track } from "../../sources/types";
import { createRecommender } from "./engine";

let n = 0;
const tr = (title: string, artist: string, album?: string): Track => ({
  id: `v${++n}`,
  title,
  artists: [{ id: artist, name: artist }],
  album: album ? { id: album, title: album } : undefined,
  thumbs: [],
});
const artistPage = (id: string, top: Track[], related: string[]): Artist => ({
  id,
  name: id,
  thumbs: [],
  topTracks: top,
  albums: [],
  singles: [],
  related: related.map((r) => ({
    id: r,
    name: r,
    thumbs: [],
    topTracks: [],
    albums: [],
    singles: [],
    related: [],
  })),
});

function fakeSource(): MusicSource & { calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  const count = (k: string) => (calls[k] = (calls[k] ?? 0) + 1);
  const artists: Record<string, Artist> = {
    coldplay: artistPage(
      "coldplay",
      [tr("Yellow", "coldplay"), tr("Clocks", "coldplay")],
      ["keane", "snowpatrol"],
    ),
    keane: artistPage(
      "keane",
      [tr("Somewhere Only We Know", "keane"), tr("Everybody's Changing", "keane")],
      [],
    ),
    snowpatrol: artistPage(
      "snowpatrol",
      [tr("Chasing Cars", "snowpatrol"), tr("Run", "snowpatrol")],
      [],
    ),
  };
  const album: Album = {
    id: "parachutes",
    title: "Parachutes",
    artists: [{ id: "coldplay", name: "coldplay" }],
    thumbs: [],
    tracks: [tr("Shiver", "coldplay", "parachutes"), tr("Trouble", "coldplay", "parachutes")],
  };
  return {
    calls,
    artist: vi.fn(async (id: string) => (count(`artist:${id}`), artists[id])),
    album: vi.fn(async () => (count("album"), album)),
    related: vi.fn(
      async () => (
        count("related"),
        [tr("Fix You (Cover)", "randomchannel"), tr("The Scientist", "coldplay")]
      ),
    ),
    radio: vi.fn(
      async () => (
        count("radio"),
        [tr("Yellow (Ao Vivo)", "someone"), tr("Radio Song", "radiohead")]
      ),
    ),
  } as unknown as MusicSource & { calls: Record<string, number> };
}

const seed = tr("Yellow", "coldplay", "parachutes");

describe("recommendFor", () => {
  it("suggests the album, the artist and artists of the same style, without the same song", async () => {
    const rec = createRecommender(fakeSource());
    const out = await rec.recommendFor([seed], { limit: 8 });
    const titles = out.map((t) => t.title);
    expect(titles).toEqual(
      expect.arrayContaining(["Shiver", "Clocks", "Chasing Cars", "Somewhere Only We Know"]),
    );
    expect(titles).not.toContain("Yellow");
    expect(titles).not.toContain("Yellow (Ao Vivo)");
    expect(titles).not.toContain("Fix You (Cover)");
  });

  it("only asks for the radio when the other sources are not enough", async () => {
    const src = fakeSource();
    await createRecommender(src).recommendFor([seed], { limit: 6 });
    expect(src.calls.radio).toBeUndefined();
    await createRecommender(src).recommendFor([seed], { limit: 30, maxPerArtist: 10 });
    expect(src.calls.radio).toBe(1);
  });

  it("caches artist and album lookups for the session", async () => {
    const src = fakeSource();
    const rec = createRecommender(src);
    await rec.recommendFor([seed], { limit: 6 });
    await rec.recommendFor([seed], { limit: 6 });
    expect(src.calls["artist:coldplay"]).toBe(1);
    expect(src.calls.album).toBe(1);
  });

  it("keeps going when a source fails", async () => {
    const src = fakeSource();
    (src.album as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    const out = await createRecommender(src).recommendFor([seed], { limit: 6 });
    expect(out.length).toBeGreaterThan(0);
  });
});
