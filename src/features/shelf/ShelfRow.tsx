import type { Shelf, Track } from "../../sources/types";
import { ShelfItemView } from "./ShelfItemView";
import { usePlayer } from "../../store/player";
import { getSource } from "../../sources";
import { useTrackMenu } from "../../components/ContextMenu";
import s from "./Shelf.module.css";

/** Plays a collection-type shelf item by fetching its tracks first. */
export async function playItem(item: Shelf["items"][number], siblings: Track[]) {
  const play = usePlayer.getState().playTracks;
  const src = getSource();
  switch (item.kind) {
    case "track":
      return play(
        siblings,
        Math.max(
          0,
          siblings.findIndex((t) => t.id === item.track.id),
        ),
      );
    case "album":
      return play((item.album.tracks.length ? item.album : await src.album(item.album.id)).tracks);
    case "playlist":
      return play(
        (item.playlist.tracks.length ? item.playlist : await src.playlist(item.playlist.id)).tracks,
      );
    case "artist":
      return play((await src.artist(item.artist.id)).topTracks);
  }
}

export function ShelfRow({ shelf }: { shelf: Shelf }) {
  const tracks = shelf.items.flatMap((i) => (i.kind === "track" ? [i.track] : []));
  const menu = useTrackMenu();
  return (
    <section className={s.shelf}>
      <h2 className={s.heading}>{shelf.title}</h2>
      <div className={s.row}>
        {shelf.items.map((item, i) => (
          <ShelfItemView
            key={i}
            item={item}
            onPlay={() => void playItem(item, tracks)}
            onContext={item.kind === "track" ? (e) => menu.open(e, item.track) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
