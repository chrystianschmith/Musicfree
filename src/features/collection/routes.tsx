import { Link, useParams } from "react-router-dom";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { useAlbum, usePlaylistRemote } from "../../sources/queries";
import { CollectionView } from "./CollectionView";
import { SectionError, Skeleton } from "../../components/States";
import { IconButton } from "../../components/IconButton";
import { useSavedAlbum } from "../library/usePlaylists";

function Loading() {
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "flex-end", paddingTop: 54 }}>
      <Skeleton w={200} h={200} />
      <Skeleton w={320} h={48} />
    </div>
  );
}

export function AlbumRoute() {
  const { id = "" } = useParams();
  const q = useAlbum(id);
  const saved = useSavedAlbum(q.data);
  if (q.isPending) return <Loading />;
  if (q.isError) return <SectionError onRetry={() => q.refetch()} />;
  const a = q.data;
  return (
    <CollectionView
      kind={a.kind === "single" ? "Single" : a.kind === "ep" ? "EP" : "Álbum"}
      title={a.title}
      thumbs={a.thumbs}
      tracks={a.tracks}
      showAlbum={false}
      subtitle={
        <>
          {a.artists.map((ar, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {ar.id ? <Link to={`/artist/${ar.id}`}>{ar.name}</Link> : ar.name}
            </span>
          ))}
          {a.year && ` · ${a.year}`}
        </>
      }
      actions={
        <IconButton
          icon={saved.saved ? IconHeartFilled : IconHeart}
          label={saved.saved ? "Remover da biblioteca" : "Salvar na biblioteca"}
          active={saved.saved}
          size={26}
          onClick={saved.toggle}
        />
      }
    />
  );
}

export function PlaylistRoute() {
  const { id = "" } = useParams();
  const q = usePlaylistRemote(id);
  if (q.isPending) return <Loading />;
  if (q.isError) return <SectionError onRetry={() => q.refetch()} />;
  const p = q.data;
  return (
    <CollectionView
      kind="Playlist"
      title={p.title}
      thumbs={p.thumbs}
      tracks={p.tracks}
      subtitle={p.author}
    />
  );
}
