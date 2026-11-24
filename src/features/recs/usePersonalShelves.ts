import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Shelf, Track } from "../../sources/types";
import { dailyPick, seedTracks, topArtists, topTracks } from "../../lib/taste";
import { loadTaste } from "./store";
import { recommender } from "./engine";

const asTracks = (title: string, tracks: Track[]): Shelf => ({
  title,
  items: tracks.map((track) => ({ kind: "track", track })),
});

/** Builds the "made from what you listen to" shelves. Empty until there is some history. */
export async function buildPersonalShelves(now = Date.now()): Promise<Shelf[]> {
  const taste = await loadTaste();
  const top = topTracks(taste, now, 10);
  if (top.length < 2) return [];
  // Rotate the seeds day by day among the listener's favourites so the mix changes daily.
  const favourites = seedTracks(taste, now, 5);
  const seeds = dailyPick(favourites, 3, now);
  const favourite = favourites[0];
  const heard = Object.values(taste.tracks).map((e) => e.track);
  const rec = recommender();
  const [mix, because] = await Promise.all([
    rec.recommendFor(seeds, { limit: 12, heard }),
    rec.recommendFor([favourite], { limit: 10, heard }),
  ]);
  const shelves: Shelf[] = [];
  if (mix.length >= 4) shelves.push(asTracks("Seu mix de hoje", mix));

  shelves.push(asTracks("Voltar a ouvir", top.slice(0, 8)));

  if (because.length >= 3) shelves.push(asTracks(`Porque você ouviu ${favourite.title}`, because));

  const artists = topArtists(taste, now, 8);
  if (artists.length >= 2)
    shelves.push({
      title: "Seus artistas mais tocados",
      items: artists.map((a) => ({
        kind: "artist",
        artist: {
          id: a.id,
          name: a.name,
          thumbs: a.thumbs,
          topTracks: [],
          albums: [],
          singles: [],
          related: [],
        },
      })),
    });
  return shelves;
}

export function usePersonalShelves() {
  const [day] = useState(() => Math.floor(Date.now() / 86_400_000));
  // Rebuilt whenever Home is opened; the previous shelves stay visible meanwhile.
  return useQuery({
    queryKey: ["personal-shelves", day],
    queryFn: () => buildPersonalShelves(),
    staleTime: 0,
    refetchOnMount: "always",
    placeholderData: (prev) => prev,
  });
}
