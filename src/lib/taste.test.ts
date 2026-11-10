import { describe, expect, it } from "vitest";
import type { Track } from "../sources/types";
import {
  applyListen,
  dailyPick,
  emptyTaste,
  seedTracks,
  topArtists,
  topTracks,
  MAX_TRACKS,
} from "./taste";

const tr = (id: string, artist = "A", artistId = `ar-${artist}`): Track => ({
  id,
  title: id.toUpperCase(),
  artists: [{ id: artistId, name: artist }],
  thumbs: [{ url: `u-${id}`, w: 60, h: 60 }],
});
const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

describe("taste profile", () => {
  it("a full listen counts more than a partial one, and an early skip counts against", () => {
    let p = emptyTaste();
    p = applyListen(p, tr("full"), 1, NOW);
    p = applyListen(p, tr("half"), 0.5, NOW);
    p = applyListen(p, tr("skip"), 0.03, NOW);
    expect(topTracks(p, NOW).map((t) => t.id)).toEqual(["full", "half"]);
    expect(p.tracks["skip"].score).toBeLessThan(0);
  });

  it("repeated listens accumulate and rank first", () => {
    let p = emptyTaste();
    p = applyListen(p, tr("a"), 1, NOW);
    for (let i = 0; i < 3; i++) p = applyListen(p, tr("b"), 1, NOW);
    expect(topTracks(p, NOW)[0].id).toBe("b");
  });

  it("old listens decay so recent taste wins", () => {
    let p = emptyTaste();
    for (let i = 0; i < 3; i++) p = applyListen(p, tr("old"), 1, NOW - 120 * DAY);
    p = applyListen(p, tr("new"), 1, NOW);
    p = applyListen(p, tr("new"), 1, NOW);
    expect(topTracks(p, NOW)[0].id).toBe("new");
  });

  it("aggregates artists with a representative thumbnail", () => {
    let p = emptyTaste();
    p = applyListen(p, tr("x1", "Xis"), 1, NOW);
    p = applyListen(p, tr("x2", "Xis"), 1, NOW);
    p = applyListen(p, tr("y1", "Ypsilon"), 1, NOW);
    const top = topArtists(p, NOW);
    expect(top.map((a) => a.name)).toEqual(["Xis", "Ypsilon"]);
    expect(top[0].thumbs.length).toBe(1);
  });

  it("ignores artists without an id and tracks never listened positively", () => {
    let p = emptyTaste();
    p = applyListen(p, { ...tr("n"), artists: [{ name: "Sem id" }] }, 1, NOW);
    p = applyListen(p, tr("s", "Skipped"), 0.01, NOW);
    expect(topArtists(p, NOW)).toEqual([]);
  });

  it("seedTracks spreads across artists", () => {
    let p = emptyTaste();
    for (const id of ["a1", "a2", "a3"])
      for (let i = 0; i < 3; i++) p = applyListen(p, tr(id, "A"), 1, NOW);
    p = applyListen(p, tr("b1", "B"), 1, NOW);
    p = applyListen(p, tr("c1", "C"), 1, NOW);
    expect(seedTracks(p, NOW, 3).map((t) => t.id)).toEqual(["a1", "b1", "c1"]);
  });

  it("keeps the profile bounded", () => {
    let p = emptyTaste();
    for (let i = 0; i < MAX_TRACKS + 50; i++)
      p = applyListen(p, tr(`t${i}`, `A${i % 9}`), 1, NOW + i);
    expect(Object.keys(p.tracks).length).toBeLessThanOrEqual(MAX_TRACKS);
  });

  it("dailyPick is stable within a day and changes across days", () => {
    const xs = Array.from({ length: 30 }, (_, i) => i);
    expect(dailyPick(xs, 10, NOW)).toEqual(dailyPick(xs, 10, NOW + 3600_000));
    expect(dailyPick(xs, 10, NOW)).not.toEqual(dailyPick(xs, 10, NOW + DAY));
    expect(new Set(dailyPick(xs, 10, NOW)).size).toBe(10);
  });
});
