import type { Track } from "../../sources/types";

/** Temporary stub; replaced by the SQLite-backed implementation in Task 8. */
export function useLike(_t: Track | undefined) {
  void _t;
  return { liked: false, toggle: () => undefined };
}
