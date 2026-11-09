import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IconHeartFilled,
  IconHistory,
  IconPencil,
  IconPlaylist,
  IconTrash,
} from "@tabler/icons-react";
import { CollectionView } from "../collection/CollectionView";
import { IconButton } from "../../components/IconButton";
import { ShelfItemView } from "../shelf/ShelfItemView";
import { playItem } from "../shelf/ShelfRow";
import { TopBar } from "../../app/TopBar";
import {
  useHistory,
  useLiked,
  useLibraryActions,
  useLocalPlaylistTracks,
  usePlaylists,
  useSavedAlbums,
  useSavedArtists,
} from "./usePlaylists";

const bigIcon = (I: typeof IconPlaylist, color = "var(--accent)") => (
  <span
    style={{
      width: 200,
      height: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "none",
    }}
  >
    <I size={120} stroke={1} color={color} aria-hidden />
  </span>
);

export function LikedPage() {
  const q = useLiked();
  return (
    <CollectionView
      kind="Playlist"
      title="Curtidas"
      thumbs={[]}
      icon={bigIcon(IconHeartFilled)}
      tracks={q.data ?? []}
      emptyText="As músicas que você curtir aparecem aqui. Toque no coração de qualquer faixa."
    />
  );
}

export function HistoryPage() {
  const q = useHistory();
  return (
    <CollectionView
      kind="Biblioteca"
      title="Histórico"
      thumbs={[]}
      icon={bigIcon(IconHistory)}
      tracks={q.data ?? []}
      emptyText="O que você ouvir vai aparecer aqui."
    />
  );
}

export function LocalPlaylistPage() {
  const { id = "" } = useParams();
  const { data: lists = [] } = usePlaylists();
  const tracks = useLocalPlaylistTracks(id);
  const lib = useLibraryActions();
  const nav = useNavigate();
  const [editing, setEditing] = useState<string | null>(null);
  const meta = lists.find((p) => p.id === id);
  if (!meta) return <TopBar />;

  const title =
    editing !== null ? (
      <input
        autoFocus
        value={editing}
        aria-label="Nome da playlist"
        onChange={(e) => setEditing(e.target.value)}
        onBlur={() => {
          if (editing.trim()) void lib.renamePlaylist(id, editing.trim());
          setEditing(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(null);
        }}
        style={{
          background: "none",
          border: "none",
          outline: "none",
          font: "inherit",
          color: "inherit",
          width: "100%",
          userSelect: "text",
          boxShadow: "inset 0 -2px 0 var(--accent)",
        }}
      />
    ) : (
      meta.name
    );

  return (
    <CollectionView
      kind="Playlist"
      title={title}
      thumbs={tracks.data?.[0]?.thumbs ?? []}
      icon={tracks.data?.length ? undefined : bigIcon(IconPlaylist, "var(--text-3)")}
      tracks={tracks.data ?? []}
      onRemove={(i) => void lib.removeFromPlaylist(id, i)}
      onMove={(from, to) => void lib.movePlaylistTrack(id, from, to)}
      emptyText="Playlist vazia. Clique com o botão direito em qualquer música e escolha “Adicionar à playlist”."
      actions={
        <>
          <IconButton
            icon={IconPencil}
            label="Renomear"
            size={22}
            onClick={() => setEditing(meta.name)}
          />
          <IconButton
            icon={IconTrash}
            label="Excluir playlist"
            size={22}
            onClick={() => {
              if (window.confirm(`Excluir “${meta.name}”?`))
                void lib.deletePlaylist(id).then(() => nav("/"));
            }}
          />
        </>
      }
    />
  );
}

function Grid({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <TopBar />
      <h1 style={{ fontSize: 30, fontWeight: 650, margin: "0 0 22px" }}>{title}</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 24,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function SavedAlbumsPage() {
  const { data = [] } = useSavedAlbums();
  return (
    <Grid title="Álbuns">
      {data.length === 0 && (
        <p style={{ color: "var(--text-2)" }}>Salve álbuns com o coração na página do álbum.</p>
      )}
      {data.map((a) => {
        const item = { kind: "album" as const, album: a };
        return (
          <ShelfItemView key={a.id} item={item} size={160} onPlay={() => void playItem(item, [])} />
        );
      })}
    </Grid>
  );
}

export function SavedArtistsPage() {
  const { data = [] } = useSavedArtists();
  return (
    <Grid title="Artistas">
      {data.length === 0 && (
        <p style={{ color: "var(--text-2)" }}>Siga artistas para vê-los aqui.</p>
      )}
      {data.map((a) => {
        const item = { kind: "artist" as const, artist: a };
        return (
          <ShelfItemView key={a.id} item={item} size={160} onPlay={() => void playItem(item, [])} />
        );
      })}
    </Grid>
  );
}
