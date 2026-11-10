import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { Shelf, Track } from "../../sources/types";
import { IconButton } from "../../components/IconButton";
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
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    const el = row.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, shelf.items.length]);

  const page = (dir: 1 | -1) =>
    row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section className={s.shelf}>
      <div className={s.head}>
        <h2 className={s.heading}>{shelf.title}</h2>
        {!(edge.start && edge.end) && (
          <div className={s.arrows}>
            <IconButton
              icon={IconChevronLeft}
              label="Anteriores"
              size={20}
              onClick={() => page(-1)}
              className={edge.start ? s.dim : undefined}
            />
            <IconButton
              icon={IconChevronRight}
              label="Próximos"
              size={20}
              onClick={() => page(1)}
              className={edge.end ? s.dim : undefined}
            />
          </div>
        )}
      </div>
      <div
        className={[s.row, !edge.start && s.fadeStart, !edge.end && s.fadeEnd]
          .filter(Boolean)
          .join(" ")}
        ref={row}
        onScroll={measure}
      >
        {shelf.items.map((item, i) => (
          <ShelfItemView
            key={i}
            item={item}
            index={i}
            onPlay={() => void playItem(item, tracks)}
            onContext={item.kind === "track" ? (e) => menu.open(e, item.track) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
