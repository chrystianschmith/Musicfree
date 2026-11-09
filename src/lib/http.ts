import { isTauri } from "./platform";

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** fetch that goes through Rust inside Tauri (no CORS limits), plain fetch in the browser. */
export const httpFetch: FetchFn = async (input, init) => {
  if (isTauri()) {
    const { fetch } = await import("@tauri-apps/plugin-http");
    return fetch(input, init);
  }
  return fetch(input, init);
};
