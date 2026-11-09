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
