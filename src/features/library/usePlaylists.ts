import { useMutation, useQuery } from "@tanstack/react-query";

/** Temporary stub; replaced by the SQLite-backed implementation in Task 8. */
export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: async () => [] as { id: string; name: string; count: number }[],
  });
}
export function useCreatePlaylist() {
  return useMutation({ mutationFn: async () => undefined });
}
