import { useNavigate } from "react-router-dom";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import type { ShelfItem } from "../../sources/types";
import { artistNames } from "../../sources/types";
import { Cover } from "../../components/Cover";
import s from "./Shelf.module.css";

type Props = {
  index?: number;
  item: ShelfItem;
  size?: number;
  onPlay?: () => void;
  onContext?: (e: React.MouseEvent) => void;
};

export function itemInfo(item: ShelfItem) {
  switch (item.kind) {
    case "track":
      return {
        title: item.track.title,
        sub: artistNames(item.track),
        thumbs: item.track.thumbs,
        to: undefined,
      };
    case "album":
      return {
        title: item.album.title,
        sub: [item.album.year, artistNames(item.album)].filter(Boolean).join(" · "),
        thumbs: item.album.thumbs,
        to: `/album/${item.album.id}`,
      };
    case "playlist":
      return {
        title: item.playlist.title,
        sub: item.playlist.author ?? "Playlist",
        thumbs: item.playlist.thumbs,
        to: `/playlist/${item.playlist.id}`,
      };
    case "artist":
      return {
        title: item.artist.name,
        sub: "Artista",
        thumbs: item.artist.thumbs,
        to: `/artist/${item.artist.id}`,
      };
  }
}

export function ShelfItemView({ item, size = 168, onPlay, onContext, index = 0 }: Props) {
  const nav = useNavigate();
  const info = itemInfo(item);
  const round = item.kind === "artist";
  const open = () => (info.to ? nav(info.to) : onPlay?.());
  return (
    <div
      className={s.item}
      style={{ width: size, "--i": Math.min(index, 10) } as React.CSSProperties}
      onContextMenu={onContext}
    >
      <button className={s.coverWrap} onClick={open} aria-label={info.title}>
        <Cover thumbs={info.thumbs} size={size} round={round} />
        {onPlay && (
          <span
            className={s.play}
            role="button"
            aria-label={`Tocar ${info.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
          >
            <IconPlayerPlayFilled size={30} aria-hidden />
          </span>
        )}
      </button>
      <button className={[s.title, round && s.center].filter(Boolean).join(" ")} onClick={open}>
        {info.title}
      </button>
      <div className={[s.sub, round && s.center].filter(Boolean).join(" ")}>{info.sub}</div>
    </div>
  );
}
