import { isTauri } from "./platform";

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/**
 * Headers for a request leaving the desktop app. Inside the webview, libraries assume the browser
 * sets `Origin`, `Referer` and `User-Agent`; the Tauri HTTP plugin would instead send
 * `Origin: http://tauri.localhost` and `User-Agent: tauri-plugin-http`, which YouTube answers
 * with 403. We fill them in as a same-origin browser request would, keeping anything already set.
 */
export function browserLikeHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const isRequest = typeof Request !== "undefined" && input instanceof Request;
  const url = new URL(isRequest ? input.url : String(input));
  const headers = new Headers(isRequest ? input.headers : undefined);
  new Headers(init?.headers).forEach((v, k) => headers.set(k, v));
  if (!headers.has("Origin")) headers.set("Origin", url.origin);
  if (!headers.has("Referer")) headers.set("Referer", `${url.origin}/`);
  if (!headers.has("User-Agent")) headers.set("User-Agent", BROWSER_UA);
  return headers;
}

/** fetch that goes through Rust inside Tauri (no CORS limits), plain fetch in the browser. */
export const httpFetch: FetchFn = async (input, init) => {
  if (isTauri()) {
    const { fetch } = await import("@tauri-apps/plugin-http");
    return fetch(input, { ...init, headers: browserLikeHeaders(input, init) });
  }
  return fetch(input, init);
};

/** Range request for media through the app's HTTP client, with only the headers given (no Origin). */
export async function fetchRange(
  url: string,
  userAgent: string,
  start: number,
  end: number,
): Promise<Response> {
  const headers = { Range: `bytes=${start}-${end}`, "User-Agent": userAgent, Origin: "" };
  if (isTauri()) {
    const { fetch } = await import("@tauri-apps/plugin-http");
    return fetch(url, { headers });
  }
  return fetch(url, { headers: { Range: headers.Range } });
}
