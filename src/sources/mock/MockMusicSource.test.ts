import { describe, expect, it } from "vitest";
import { MockMusicSource } from "./MockMusicSource";

const src = new MockMusicSource({ latencyMs: 0 });

describe("MockMusicSource", () => {
  it("finds songs by query", async () => {
    const r = await src.search("noite");
    expect(r.songs.length).toBeGreaterThan(0);
  });
  it("returns home shelves and moods", async () => {
    const h = await src.home();
    expect(h.shelves.length).toBeGreaterThanOrEqual(3);
    expect(h.moods).toContain("Relax");
  });
  it("returns an artist with at least 5 top tracks", async () => {
    const h = await src.search("Noite Clara", "artists");
    const a = await src.artist(h.artists[0].id);
    expect(a.topTracks.length).toBeGreaterThanOrEqual(5);
  });
  it("builds a radio that starts with the seed track", async () => {
    const { songs } = await src.search("luzes");
    const radio = await src.radio(songs[0].id);
    expect(radio[0].id).toBe(songs[0].id);
    expect(radio.length).toBeGreaterThan(5);
  });
  it("rejects unknown ids", async () => {
    await expect(src.album("nope")).rejects.toThrow();
  });
});
