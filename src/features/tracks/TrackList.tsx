import { Link } from "react-router-dom";
import {
  IconClock,
  IconHeart,
  IconHeartFilled,
  IconPlayerPlayFilled,
  IconX,
} from "@tabler/icons-react";
import type { Track } from "../../sources/types";
import { usePlayer } from "../../store/player";
import { Cover } from "../../components/Cover";
import { formatTime } from "../../lib/format";
import { useTrackMenu } from "../../components/ContextMenu";
import { useLikedIds, useLibraryActions } from "../library/usePlaylists";
import s from "./TrackList.module.css";

type Props = {
  tracks: Track[];
  onPlay(i: number): void;
  numbered?: boolean;
  showAlbum?: boolean;
  showCover?: boolean;
  onRemove?(i: number): void;
  header?: boolean;
};

export function TrackList({
  tracks,
  onPlay,
  numbered = true,
  showAlbum = true,
  showCover = true,
  onRemove,
  header = true,
}: Props) {
  const currentId = usePlayer((p) => p.current()?.id);
  const playing = usePlayer((p) => p.playing);
  const menu = useTrackMenu();
  const liked = useLikedIds();
  const lib = useLibraryActions();
  const cols = [s.row, showAlbum ? s.withAlbum : s.noAlbum].join(" ");

  return (
    <div role="list" className={s.list}>
      {header && (
        <div className={[cols, s.header].join(" ")} aria-hidden>
          <span className={s.num}>#</span>
          <span>Título</span>
          {showAlbum && <span>Álbum</span>}
          <span />
          <span className={s.dur}>
            <IconClock size={15} stroke={1.6} />
          </span>
        </div>
      )}
      {tracks.map((t, i) => {
        const isCur = t.id === currentId;
        const isLiked = liked.has(t.id);
        return (
          <div
            key={`${t.id}-${i}`}
            role="listitem"
            className={[cols, isCur && s.current].filter(Boolean).join(" ")}
            onDoubleClick={() => onPlay(i)}
            onContextMenu={(e) => menu.open(e, t)}
          >
            <span className={s.num}>
              {numbered && (
                <span className={s.index}>
                  {isCur && playing ? <span className={s.eq} aria-label="Tocando" /> : i + 1}
                </span>
              )}
              <button
                className={s.playBtn}
                aria-label={`Tocar ${t.title}`}
                onClick={() => onPlay(i)}
              >
                <IconPlayerPlayFilled size={15} aria-hidden />
              </button>
            </span>
            <span className={s.main}>
              {showCover && <Cover thumbs={t.thumbs} size={40} radius={6} />}
              <span className={s.texts}>
                <span className={s.title}>
                  {t.title}
                  {t.explicit && <span className={s.explicit}>E</span>}
                </span>
                <span className={s.artists}>
                  {t.artists.map((a, j) => (
                    <span key={j}>
                      {j > 0 && ", "}
                      {a.id ? <Link to={`/artist/${a.id}`}>{a.name}</Link> : a.name}
                    </span>
                  ))}
                </span>
              </span>
            </span>
            {showAlbum && (
              <span className={s.album}>
                {t.album?.id ? (
                  <Link to={`/album/${t.album.id}`}>{t.album.title}</Link>
                ) : (
                  (t.album?.title ?? "")
                )}
              </span>
            )}
            <span className={s.actions}>
              <button
                className={[s.like, isLiked && s.liked].filter(Boolean).join(" ")}
                aria-label={isLiked ? "Remover das curtidas" : "Curtir"}
                onClick={() => lib.toggleLike(t)}
              >
                {isLiked ? <IconHeartFilled size={16} /> : <IconHeart size={16} stroke={1.6} />}
              </button>
              {onRemove && (
                <button className={s.like} aria-label="Remover" onClick={() => onRemove(i)}>
                  <IconX size={16} stroke={1.6} />
                </button>
              )}
            </span>
            <span className={s.dur}>
              {formatTime(t.durationMs !== undefined ? t.durationMs / 1000 : undefined)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
