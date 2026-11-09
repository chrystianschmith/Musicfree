import { useQuery } from "@tanstack/react-query";
import { getSource } from ".";
import type { SearchFilter } from "./types";

const src = () => getSource();

export const useHome = (mood?: string) =>
  useQuery({ queryKey: ["home", mood ?? ""], queryFn: () => src().home(mood) });
export const useExplore = () => useQuery({ queryKey: ["explore"], queryFn: () => src().explore() });
export const useSearch = (q: string, filter: SearchFilter) =>
  useQuery({
    queryKey: ["search", q, filter],
    queryFn: () => src().search(q, filter),
    enabled: q.trim().length > 0,
  });
export const useSuggestions = (q: string) =>
  useQuery({
    queryKey: ["sugg", q],
    queryFn: () => src().suggestions(q),
    enabled: q.trim().length > 0,
    staleTime: 60_000,
  });
export const useArtist = (id: string) =>
  useQuery({ queryKey: ["artist", id], queryFn: () => src().artist(id) });
export const useAlbum = (id: string) =>
  useQuery({ queryKey: ["album", id], queryFn: () => src().album(id) });
export const usePlaylistRemote = (id: string, enabled = true) =>
  useQuery({ queryKey: ["playlist", id], queryFn: () => src().playlist(id), enabled });
export const useRelated = (id?: string) =>
  useQuery({ queryKey: ["related", id], queryFn: () => src().related(id!), enabled: !!id });
