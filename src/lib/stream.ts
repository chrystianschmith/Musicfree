import { getSource, type StreamInfo } from "../sources";
import { isTauri } from "./platform";

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
