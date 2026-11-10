import { getSource, type StreamInfo } from "../sources";
import { isTauri } from "./platform";
import { fetchRange } from "./http";

const cache = new Map<string, Promise<StreamInfo>>();
const SAFETY_MS = 60_000;

/** Resolves (and caches until shortly before expiry) the direct stream for a track. */
export function resolveCached(id: string, force = false): Promise<StreamInfo> {
  const hit = cache.get(id);
  if (hit && !force) {
    return hit.then((info) =>
      info.expiresAt - SAFETY_MS > Date.now() ? info : resolveCached(id, true),
    );
  }
  const p = getSource().resolveStream(id);
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}

/**
 * Returns the URL the <audio> element should load.
 * In Tauri the Rust proxy (`mf-stream://`) serves the bytes; we hand it the resolved URL first.
 */
export async function playableUrl(id: string, force = false): Promise<string> {
  const info = await resolveCached(id, force);
  if (!isTauri() || !info.url.startsWith("http")) return info.url;
  if (info.viaFetch) return downloadAsBlobUrl(id, info);
  const { invoke, convertFileSrc } = await import("@tauri-apps/api/core");
  await invoke("stream_set_url", {
    videoId: id,
    url: info.url,
    expiresAt: info.expiresAt,
    userAgent: info.userAgent ?? null,
  });
  return convertFileSrc(id, "mf-stream");
}

/** Warm the next track so switching is instant. Errors are ignored (retried on play). */
export function prefetch(id: string | undefined) {
  if (id) void playableUrl(id).catch(() => undefined);
}

let bridged = false;

/** In Tauri, answer the proxy's requests for fresh URLs (expired or rejected streams). */
export async function initStreamBridge() {
  if (bridged || !isTauri()) return;
  bridged = true;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<{ videoId: string }>("stream:need-url", (e) => {
    void playableUrl(e.payload.videoId, true).catch((err) =>
      console.error("re-resolve failed", err),
    );
  });
}

const blobs = new Map<string, Promise<string>>();
const PART = 1024 * 1024;

/**
 * Fallback when the Rust proxy can't reach the media server: download the whole track
 * (a few MB) in parallel 1 MiB ranges through the app's HTTP client and play it from memory.
 */
function downloadAsBlobUrl(id: string, info: StreamInfo): Promise<string> {
  const hit = blobs.get(id);
  if (hit) return hit;
  const p = (async () => {
    const ua = info.userAgent ?? "";
    const first = await fetchRange(info.url, ua, 0, PART - 1);
    if (!first.ok) throw new Error(`media HTTP ${first.status}`);
    const total =
      Number(first.headers.get("content-range")?.split("/")[1]) ||
      Number(new URL(info.url).searchParams.get("clen")) ||
      0;
    const parts: ArrayBuffer[] = [await first.arrayBuffer()];
    const starts: number[] = [];
    for (let s = PART; s < total; s += PART) starts.push(s);
    for (let i = 0; i < starts.length; i += 4) {
      const batch = await Promise.all(
        starts.slice(i, i + 4).map(async (s) => {
          const r = await fetchRange(info.url, ua, s, Math.min(s + PART, total) - 1);
          if (!r.ok) throw new Error(`media HTTP ${r.status}`);
          return r.arrayBuffer();
        }),
      );
      parts.push(...batch);
    }
    return URL.createObjectURL(new Blob(parts, { type: info.mime }));
  })();
  blobs.set(id, p);
  p.catch(() => blobs.delete(id));
  // Keep only a few tracks in memory.
  if (blobs.size > 4) {
    const oldest = blobs.keys().next().value!;
    void blobs
      .get(oldest)
      ?.then((u) => URL.revokeObjectURL(u))
      .catch(() => undefined);
    blobs.delete(oldest);
  }
  return p;
}
