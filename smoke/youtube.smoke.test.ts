/**
 * Live smoke test against the real YouTube Music API. Not part of `pnpm test`.
 * Run with: pnpm smoke  (needs internet; YouTube may block datacenter IPs, so CI allows failure)
 */
import { describe, expect, it } from "vitest";
import { YouTubeMusicSource } from "../src/sources/youtube/YouTubeMusicSource";

const src = new YouTubeMusicSource();

describe("YouTube Music (live)", { timeout: 60_000 }, () => {
  it("searches songs", async () => {
    const r = await src.search("Tom Jobim Garota de Ipanema");
    expect(r.songs.length).toBeGreaterThan(0);
    console.log(
      "first song:",
      r.songs[0].title,
      "-",
      r.songs[0].artists.map((a) => a.name).join(", "),
    );
  });

  it("loads the home feed", async () => {
    const h = await src.home();
    expect(h.shelves.length).toBeGreaterThan(0);
  });

  it("resolves a playable audio stream", async () => {
    const r = await src.search("Garota de Ipanema", "songs");
    const info = await src.resolveStream(r.songs[0].id);
    expect(info.url).toMatch(/^https:\/\/.*googlevideo\.com\//);
    const res = await fetch(info.url, {
      headers: { Range: "bytes=0-1023", "User-Agent": info.userAgent ?? "" },
    });
    expect([200, 206]).toContain(res.status);
  });
});
