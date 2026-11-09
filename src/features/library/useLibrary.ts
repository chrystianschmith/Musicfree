import type { Track } from "../../sources/types";
import { useLibraryActions, useLikedIds } from "./usePlaylists";

export function useLike(t: Track | undefined) {
  const ids = useLikedIds();
  const actions = useLibraryActions();
  return { liked: !!t && ids.has(t.id), toggle: () => t && void actions.toggleLike(t) };
}
