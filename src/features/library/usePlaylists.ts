import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getRepo } from "../../db";
import type { Album, Artist, Track } from "../../sources/types";
import { useUI } from "../../store/ui";
import { recordLike } from "../recs/store";

export const libKeys = {
  playlists: ["lib", "playlists"] as const,
  playlist: (id: string) => ["lib", "playlist", id] as const,
  liked: ["lib", "liked"] as const,
  likedIds: ["lib", "likedIds"] as const,
  albums: ["lib", "albums"] as const,
  artists: ["lib", "artists"] as const,
  history: ["lib", "history"] as const,
  setting: (k: string) => ["lib", "setting", k] as const,
};

export const usePlaylists = () =>
  useQuery({ queryKey: libKeys.playlists, queryFn: async () => (await getRepo()).playlists() });
export const useLocalPlaylistTracks = (id: string) =>
  useQuery({
    queryKey: libKeys.playlist(id),
    queryFn: async () => (await getRepo()).playlistTracks(id),
  });
export const useLiked = () =>
  useQuery({ queryKey: libKeys.liked, queryFn: async () => (await getRepo()).liked() });
export const useSavedAlbums = () =>
  useQuery({ queryKey: libKeys.albums, queryFn: async () => (await getRepo()).savedAlbums() });
export const useSavedArtists = () =>
  useQuery({ queryKey: libKeys.artists, queryFn: async () => (await getRepo()).savedArtists() });
export const useHistory = () =>
  useQuery({ queryKey: libKeys.history, queryFn: async () => (await getRepo()).history(200) });

export function useLikedIds(): Set<string> {
  const q = useQuery({
    queryKey: libKeys.likedIds,
    queryFn: async () => new Set(await (await getRepo()).likedIds()),
  });
  return q.data ?? EMPTY;
}
const EMPTY = new Set<string>();

async function nextPlaylistName() {
  const lists = await (await getRepo()).playlists();
  return `Minha playlist nº ${lists.length + 1}`;
}

export function useLibraryActions() {
  const qc = useQueryClient();
  const toast = useUI((u) => u.toast);
  const inv = (...keys: readonly (readonly string[])[]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  return {
    async toggleLike(t: Track) {
      const liked = await (await getRepo()).toggleLike(t);
      inv(libKeys.liked, libKeys.likedIds);
      if (liked) void recordLike(t);
      toast(liked ? "Adicionada às curtidas" : "Removida das curtidas");
      return liked;
    },
    async addToPlaylist(id: string, t: Track) {
      await (await getRepo()).addToPlaylist(id, t);
      inv(libKeys.playlists, libKeys.playlist(id));
      toast("Adicionada à playlist");
    },
    async createPlaylistWith(t?: Track) {
      const repo = await getRepo();
      const id = await repo.createPlaylist(await nextPlaylistName());
      if (t) await repo.addToPlaylist(id, t);
      inv(libKeys.playlists);
      return id;
    },
    async removeFromPlaylist(id: string, pos: number) {
      await (await getRepo()).removeFromPlaylist(id, pos);
      inv(libKeys.playlists, libKeys.playlist(id));
    },
    async movePlaylistTrack(id: string, from: number, to: number) {
      await (await getRepo()).movePlaylistTrack(id, from, to);
      inv(libKeys.playlist(id));
    },
    async renamePlaylist(id: string, name: string) {
      await (await getRepo()).renamePlaylist(id, name);
      inv(libKeys.playlists);
    },
    async deletePlaylist(id: string) {
      await (await getRepo()).deletePlaylist(id);
      inv(libKeys.playlists);
    },
  };
}

export function useCreatePlaylist() {
  const actions = useLibraryActions();
  const nav = useNavigate();
  return useMutation({
    mutationFn: () => actions.createPlaylistWith(),
    onSuccess: (id) => nav(`/library/playlist/${id}`),
  });
}

export function useSavedAlbum(a: Album | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lib", "albumSaved", a?.id],
    queryFn: async () => (await getRepo()).isAlbumSaved(a!.id),
    enabled: !!a,
  });
  return {
    saved: !!q.data,
    async toggle() {
      if (!a) return;
      const repo = await getRepo();
      if (q.data) await repo.unsaveAlbum(a.id);
      else await repo.saveAlbum(a);
      qc.invalidateQueries({ queryKey: ["lib", "albumSaved", a.id] });
      qc.invalidateQueries({ queryKey: libKeys.albums });
    },
  };
}

export function useSavedArtist(a: Artist | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lib", "artistSaved", a?.id],
    queryFn: async () => (await getRepo()).isArtistSaved(a!.id),
    enabled: !!a,
  });
  return {
    saved: !!q.data,
    async toggle() {
      if (!a) return;
      const repo = await getRepo();
      if (q.data) await repo.unsaveArtist(a.id);
      else await repo.saveArtist(a);
      qc.invalidateQueries({ queryKey: ["lib", "artistSaved", a.id] });
      qc.invalidateQueries({ queryKey: libKeys.artists });
    },
  };
}

const RECENT_KEY = "recentSearches";
export function useRecentSearches() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: libKeys.setting(RECENT_KEY),
    queryFn: async () => (await (await getRepo()).getSetting<string[]>(RECENT_KEY)) ?? [],
  });
  return {
    list: q.data ?? [],
    async add(term: string) {
      const repo = await getRepo();
      const cur = (await repo.getSetting<string[]>(RECENT_KEY)) ?? [];
      const next = [term, ...cur.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(
        0,
        10,
      );
      await repo.setSetting(RECENT_KEY, next);
      qc.setQueryData(libKeys.setting(RECENT_KEY), next);
    },
  };
}
