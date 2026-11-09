import { useMutation, useQuery } from "@tanstack/react-query";
import type { Track } from "../../sources/types";

/** Temporary stubs; replaced by the SQLite-backed implementation in Task 8. */
export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: async () => [] as { id: string; name: string; count: number }[],
  });
}
export function useCreatePlaylist() {
  return useMutation({ mutationFn: async () => undefined });
}
export function useLibraryActions() {
  return {
    toggleLike: (_t: Track) => void _t,
    addToPlaylist: (_id: string, _t: Track) => void [_id, _t],
    createPlaylistWith: (_t: Track) => void _t,
  };
}
export function useLikedIds(): Set<string> {
  return new Set();
}
export function useRecentSearches() {
  return { list: [] as string[], add: (_q: string) => void _q };
}
export function useSavedAlbum(_a: unknown) {
  void _a;
  return { saved: false, toggle: () => undefined };
}
export function useSavedArtist(_a: unknown) {
  void _a;
  return { saved: false, toggle: () => undefined };
}
