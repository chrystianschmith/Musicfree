/**
 * Live smoke test against the real YouTube Music API. Not part of `pnpm test`.
 * Run with: pnpm smoke  (needs internet; YouTube may block datacenter IPs, so CI allows failure)
 */
import { describe, expect, it } from "vitest";
import { YouTubeMusicSource } from "../src/sources/youtube/YouTubeMusicSource";
import { browserLikeHeaders } from "../src/lib/http";

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
  });
});

/**
 * Reproduces what the Tauri webview sends. There youtubei.js leaves Origin/User-Agent to the
 * "browser", and the HTTP plugin fills in `http://tauri.localhost` and `tauri-plugin-http`.
 */
describe("desktop webview headers (live)", { timeout: 60_000 }, () => {
  const webviewFetch =
    (fix: boolean): typeof fetch =>
    async (input, init) => {
      const req = new Request(input as RequestInfo, init);
      const h = new Headers(req.headers);
      h.delete("User-Agent");
      h.delete("Origin");
      const headers = fix ? browserLikeHeaders(req.url, { headers: h }) : h;
      if (!headers.has("Origin")) headers.set("Origin", "http://tauri.localhost");
      if (!headers.has("User-Agent")) headers.set("User-Agent", "tauri-plugin-http/2.8.3");
      const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();
      return fetch(req.url, { method: req.method, headers, body });
    };

  const homeStatus = async (fix: boolean) => {
    const { Innertube } = await import("youtubei.js");
    const yt = await Innertube.create({
      fetch: webviewFetch(fix),
      retrieve_player: false,
      generate_session_locally: true,
    });
    try {
      const feed = await yt.music.getHomeFeed();
      return `ok:${feed.sections?.length ?? 0}`;
    } catch (e) {
      return `error:${e instanceof Error ? e.message : e}`;
    }
  };

  it("plugin defaults are rejected by YouTube (documents the 0.1.1 bug)", async () => {
    const r = await homeStatus(false);
    console.log("without fix →", r);
    expect(r).toMatch(/403/);
  });

  it("browserLikeHeaders makes the same request succeed", async () => {
    const r = await homeStatus(true);
    console.log("with fix →", r);
    expect(r).toMatch(/^ok:/);
  });
});
