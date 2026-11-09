import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  IconArrowsShuffle,
  IconBroadcast,
  IconPlayerPlayFilled,
  IconUserCheck,
  IconUserPlus,
} from "@tabler/icons-react";
import { useArtist } from "../../sources/queries";
import { Cover } from "../../components/Cover";
import { IconButton } from "../../components/IconButton";
import { TrackList } from "../tracks/TrackList";
import { ShelfRow } from "../shelf/ShelfRow";
import { usePlayer } from "../../store/player";
import { startRadio } from "../../components/ContextMenu";
import { SectionError, Skeleton } from "../../components/States";
import { TopBar } from "../../app/TopBar";
import { useSavedArtist } from "../library/usePlaylists";
import s from "../collection/Collection.module.css";

export function ArtistPage() {
  const { id = "" } = useParams();
  const q = useArtist(id);
  const [more, setMore] = useState(false);
  const p = usePlayer();
  const saved = useSavedArtist(q.data);
  if (q.isPending)
    return (
      <div style={{ display: "flex", gap: 28, alignItems: "flex-end", paddingTop: 54 }}>
        <Skeleton w={200} h={200} round />
        <Skeleton w={320} h={48} />
      </div>
    );
  if (q.isError) return <SectionError onRetry={() => q.refetch()} />;
  const a = q.data;
  const top = a.topTracks;
  return (
    <div>
      <TopBar />
      <header className={s.header}>
        <Cover thumbs={a.thumbs} size={200} round />
        <div className={s.info}>
          <span className={s.kind}>Artista</span>
          <h1 className={s.title}>{a.name}</h1>
          {a.subtitle && <div className={s.sub}>{a.subtitle}</div>}
        </div>
      </header>
      <div className={s.actions}>
        <IconButton
          icon={IconPlayerPlayFilled}
          label="Tocar"
          size={44}
          strong
          className={s.bigPlay}
          onClick={() => p.playTracks(top)}
        />
        <IconButton
          icon={IconArrowsShuffle}
          label="Aleatório"
          size={24}
          onClick={() => {
            p.setShuffle(true);
            p.playTracks(top, Math.floor(Math.random() * top.length));
          }}
        />
        <IconButton
          icon={IconBroadcast}
          label="Iniciar rádio do artista"
          size={24}
          onClick={() => top[0] && void startRadio(top[0])}
        />
        <IconButton
          icon={saved.saved ? IconUserCheck : IconUserPlus}
          label={saved.saved ? "Deixar de seguir" : "Seguir"}
          active={saved.saved}
          size={24}
          onClick={saved.toggle}
        />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>Populares</h2>
      <TrackList
        tracks={top.slice(0, more ? 10 : 5)}
        onPlay={(i) => p.playTracks(top, i)}
        header={false}
      />
      {top.length > 5 && (
        <button
          style={{ color: "var(--text-2)", margin: "8px 10px 34px", fontSize: 13 }}
          onClick={() => setMore((m) => !m)}
        >
          {more ? "Mostrar menos" : "Mostrar mais"}
        </button>
      )}
      {a.albums.length > 0 && (
        <ShelfRow
          shelf={{ title: "Álbuns", items: a.albums.map((al) => ({ kind: "album", album: al })) }}
        />
      )}
      {a.singles.length > 0 && (
        <ShelfRow
          shelf={{
            title: "Singles e EPs",
            items: a.singles.map((al) => ({ kind: "album", album: al })),
          }}
        />
      )}
      {a.related.length > 0 && (
        <ShelfRow
          shelf={{
            title: "Os fãs também curtem",
            items: a.related.map((r) => ({ kind: "artist", artist: r })),
          }}
        />
      )}
    </div>
  );
}
