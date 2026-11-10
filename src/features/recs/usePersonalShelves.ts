import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSource } from "../../sources";
import type { Shelf, Track } from "../../sources/types";
import { dailyPick, seedTracks, topArtists, topTracks } from "../../lib/taste";
import { loadTaste } from "./store";

const asTracks = (title: string, tracks: Track[]): Shelf => ({
  title,
  items: tracks.map((track) => ({ kind: "track", track })),
});

/** Builds the "made from what you listen to" shelves. Empty until there is some history. */
export async function buildPersonalShelves(now = Date.now()): Promise<Shelf[]> {
  const taste = await loadTaste();
  const top = topTracks(taste, now, 10);
  if (top.length < 2) return [];
  const seeds = seedTracks(taste, now, 3);
  const radios = await Promise.all(
    seeds.map((s) =>
      getSource()
        .radio(s.id)
        .catch(() => [] as Track[]),
    ),
  );
  const heard = new Set(Object.keys(taste.tracks));
  const shelves: Shelf[] = [];

  // Interleave the radios so the mix is not one artist after another, then keep unheard tracks.
  const pool: Track[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 25; i++)
    for (const r of radios) {
      const t = r[i];
      if (t && !seen.has(t.id) && !heard.has(t.id)) {
        seen.add(t.id);
        pool.push(t);
      }
    }
  if (pool.length >= 4) shelves.push(asTracks("Seu mix de hoje", dailyPick(pool, 12, now)));

  shelves.push(asTracks("Voltar a ouvir", top.slice(0, 8)));

  const because = (radios[0] ?? []).filter((t) => t.id !== seeds[0].id).slice(0, 10);
  if (because.length >= 3) shelves.push(asTracks(`Porque você ouviu ${seeds[0].title}`, because));

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
