import { useShallow } from "zustand/react/shallow";
import { usePlayer } from "../../store/player";
import { TrackList } from "../tracks/TrackList";

export function QueueView() {
  const { current, upcoming } = usePlayer(
    useShallow((p) => ({ current: p.current(), upcoming: p.upcoming() })),
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
