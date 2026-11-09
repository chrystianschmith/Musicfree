import { Link } from "react-router-dom";
import { usePlayer } from "../../store/player";
import { useUI } from "../../store/ui";
import { Cover } from "../../components/Cover";
import s from "./RightPanel.module.css";

export function RightPanel() {
  const cur = usePlayer((p) => p.current());
  const open = useUI((u) => u.openNowPlaying);
  if (!cur) {
    return (
      <aside className={s.panel}>
        <p className={s.empty}>Escolha uma música para começar.</p>
      </aside>
    );
  }
  return (
    <aside className={s.panel} aria-label="Tocando agora">
      <button className={s.coverBtn} onClick={() => open()} aria-label="Abrir tocando agora">
        <Cover thumbs={cur.thumbs} size={252} radius={12} />
      </button>
      <div className={s.title}>{cur.title}</div>
      <div className={s.artist}>
        {cur.artists.map((a, i) => (
          <span key={i}>
            {i > 0 && ", "}
            {a.id ? <Link to={`/artist/${a.id}`}>{a.name}</Link> : a.name}
          </span>
        ))}
      </div>
    </aside>
  );
}
