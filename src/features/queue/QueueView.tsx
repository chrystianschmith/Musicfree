import { useMemo } from "react";
import { usePlayer } from "../../store/player";
import { TrackList } from "../tracks/TrackList";

export function QueueView() {
  // Select raw state and derive locally: selectors that build new arrays re-render forever.
  const queue = usePlayer((p) => p.queue);
  const order = usePlayer((p) => p.order);
  const index = usePlayer((p) => p.index);
  const current = index >= 0 ? queue[order[index]] : undefined;
  const upcoming = useMemo(
    () => (index >= 0 ? order.slice(index + 1).map((i) => queue[i]) : []),
    [queue, order, index],
  );
  const jump = usePlayer((p) => p.jumpToUpcoming);
  const remove = usePlayer((p) => p.removeUpcoming);
  const move = usePlayer((p) => p.moveUpcoming);
  if (!current) return <p style={{ color: "var(--text-2)" }}>A fila está vazia.</p>;
  return (
    <div>
      <h3 style={{ fontSize: 15, color: "var(--text-2)", fontWeight: 500, margin: "0 0 8px" }}>
        Tocando agora
      </h3>
      <TrackList
        tracks={[current]}
        onPlay={() => undefined}
        header={false}
        showAlbum={false}
        numbered={false}
      />
      <h3 style={{ fontSize: 15, color: "var(--text-2)", fontWeight: 500, margin: "24px 0 8px" }}>
        A seguir
      </h3>
      {upcoming.length ? (
        <TrackList
          tracks={upcoming}
          onPlay={jump}
          onRemove={remove}
          onMove={move}
          header={false}
          showAlbum={false}
        />
      ) : (
        <p style={{ color: "var(--text-2)", padding: "0 10px" }}>
          Nada na fila. Use “Tocar a seguir” ou “Adicionar à fila” no menu de qualquer música.
        </p>
      )}
    </div>
  );
}
