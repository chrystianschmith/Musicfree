import type { ReactNode } from "react";
import { IconArrowsShuffle, IconPlayerPlayFilled } from "@tabler/icons-react";
import type { Thumb, Track } from "../../sources/types";
import { Cover } from "../../components/Cover";
import { IconButton } from "../../components/IconButton";
import { TrackList } from "../tracks/TrackList";
import { usePlayer } from "../../store/player";
import { formatTime } from "../../lib/format";
import { TopBar } from "../../app/TopBar";
import s from "./Collection.module.css";

type Props = {
  kind: string;
  title: string;
  subtitle?: ReactNode;
  thumbs: Thumb[];
  tracks: Track[];
  round?: boolean;
  actions?: ReactNode;
  showAlbum?: boolean;
  onRemove?(i: number): void;
  emptyText?: string;
  icon?: ReactNode;
};

export function CollectionView({
  kind,
  title,
  subtitle,
  thumbs,
  tracks,
  round,
  actions,
  showAlbum = true,
  onRemove,
  emptyText,
  icon,
}: Props) {
  const p = usePlayer();
  const total = tracks.reduce((a, t) => a + (t.durationMs ?? 0), 0) / 1000;
  const playAll = (shuffle: boolean) => {
    if (!tracks.length) return;
    p.setShuffle(shuffle);
    p.playTracks(tracks, shuffle ? Math.floor(Math.random() * tracks.length) : 0);
  };
  return (
    <div>
      <TopBar />
      <header className={s.header}>
        {icon ?? <Cover thumbs={thumbs} size={200} round={round} radius={14} />}
        <div className={s.info}>
          <span className={s.kind}>{kind}</span>
          <h1 className={s.title}>{title}</h1>
          <div className={s.sub}>
            {subtitle}
            {tracks.length > 0 && (
              <span>
                {subtitle ? " · " : ""}
                {tracks.length} {tracks.length === 1 ? "música" : "músicas"}
                {total > 0 && `, ${formatTime(total)}`}
              </span>
            )}
          </div>
        </div>
      </header>
      <div className={s.actions}>
        <IconButton
          icon={IconPlayerPlayFilled}
          label="Tocar"
          size={44}
          strong
          onClick={() => playAll(false)}
          className={s.bigPlay}
        />
        <IconButton
          icon={IconArrowsShuffle}
          label="Aleatório"
          size={24}
          onClick={() => playAll(true)}
        />
        {actions}
      </div>
      {tracks.length ? (
        <TrackList
          tracks={tracks}
          onPlay={(i) => p.playTracks(tracks, i)}
          showAlbum={showAlbum}
          onRemove={onRemove}
        />
      ) : (
        <p className={s.empty}>{emptyText ?? "Nada por aqui ainda."}</p>
      )}
    </div>
  );
}
