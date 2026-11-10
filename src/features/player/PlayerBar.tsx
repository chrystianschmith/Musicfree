import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  IconArrowsShuffle,
  IconHeart,
  IconHeartFilled,
  IconList,
  IconMicrophone2,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconRepeat,
  IconRepeatOnce,
  IconVolume,
  IconVolume2,
  IconVolume3,
  IconLayoutSidebarRight,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { usePlayer } from "../../store/player";
import { useUI } from "../../store/ui";
import { IconButton } from "../../components/IconButton";
import { Cover } from "../../components/Cover";
import { formatTime } from "../../lib/format";
import { Slider } from "./Slider";
import { useLike } from "../library/useLibrary";
import s from "./PlayerBar.module.css";

export function PlayerBar() {
  // Everything except position/duration: those tick ~4x per second and live in <Progress>.
  const p = usePlayer(
    useShallow((st) => ({
      cur: st.current(),
      playing: st.playing,
      shuffle: st.shuffle,
      repeat: st.repeat,
      volume: st.volume,
      muted: st.muted,
      setShuffle: st.setShuffle,
      prev: st.prev,
      next: st.next,
      toggle: st.toggle,
      cycleRepeat: st.cycleRepeat,
      toggleMute: st.toggleMute,
      setVolume: st.setVolume,
    })),
  );
  const ui = useUI();
  const cur = p.cur;
  const { liked, toggle: toggleLike } = useLike(cur);
  const VolIcon =
    p.muted || p.volume === 0 ? IconVolume3 : p.volume < 0.5 ? IconVolume2 : IconVolume;

  return (
    <footer className={s.bar}>
      <div className={s.left}>
        {cur && (
          <>
            <button
              className={s.coverBtn}
              onClick={() => ui.openNowPlaying()}
              aria-label="Abrir tocando agora"
            >
              <Cover thumbs={cur.thumbs} size={52} radius={8} />
            </button>
            <div className={s.meta}>
              <button className={s.title} onClick={() => ui.openNowPlaying()}>
                {cur.title}
              </button>
              <div className={s.artists}>
                {cur.artists.map((a, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    {a.id ? <Link to={`/artist/${a.id}`}>{a.name}</Link> : a.name}
                  </span>
                ))}
              </div>
            </div>
            <IconButton
              icon={liked ? IconHeartFilled : IconHeart}
              label={liked ? "Remover das curtidas" : "Curtir"}
              active={liked}
              size={18}
              onClick={toggleLike}
            />
          </>
        )}
      </div>

      <div className={s.center}>
        <div className={s.controls}>
          <IconButton
            icon={IconArrowsShuffle}
            label="Aleatório"
            active={p.shuffle}
            size={18}
            onClick={() => p.setShuffle(!p.shuffle)}
          />
          <IconButton icon={IconPlayerSkipBack} label="Anterior" size={20} onClick={p.prev} />
          <IconButton
            icon={p.playing ? IconPlayerPauseFilled : IconPlayerPlayFilled}
            label={p.playing ? "Pausar" : "Tocar"}
            size={34}
            strong
            onClick={p.toggle}
            className={s.play}
          />
          <IconButton icon={IconPlayerSkipForward} label="Próxima" size={20} onClick={p.next} />
          <IconButton
            icon={p.repeat === "one" ? IconRepeatOnce : IconRepeat}
            label={
              p.repeat === "off"
                ? "Repetir"
                : p.repeat === "all"
                  ? "Repetir uma"
                  : "Desativar repetição"
            }
            active={p.repeat !== "off"}
            size={18}
            onClick={p.cycleRepeat}
          />
        </div>
        <Progress fallbackDuration={(cur?.durationMs ?? 0) / 1000} active={!!cur} />
      </div>

      <div className={s.right}>
        <IconButton
          icon={IconMicrophone2}
          label="Letra"
          size={18}
          active={ui.nowPlayingOpen && ui.nowPlayingTab === "lyrics"}
          onClick={() => ui.openNowPlaying("lyrics")}
        />
        <IconButton
          icon={IconList}
          label="Fila"
          size={18}
          active={ui.nowPlayingOpen && ui.nowPlayingTab === "queue"}
          onClick={() => ui.openNowPlaying("queue")}
        />
        <IconButton
          icon={IconLayoutSidebarRight}
          label="Painel lateral"
          size={18}
          active={ui.panelOpen}
          onClick={ui.togglePanel}
        />
        <IconButton
          icon={VolIcon}
          label={p.muted ? "Ativar som" : "Mudo"}
          size={18}
          onClick={p.toggleMute}
        />
        <Slider
          label="Volume"
          className={s.volume}
          value={p.muted ? 0 : p.volume}
          onChange={p.setVolume}
        />
      </div>
    </footer>
  );
}

function Progress({ fallbackDuration, active }: { fallbackDuration: number; active: boolean }) {
  const position = usePlayer((st) => st.position);
  const duration = usePlayer((st) => st.duration);
  const seek = usePlayer((st) => st.seek);
  const [scrub, setScrub] = useState<number | null>(null);
  const pos = scrub ?? position;
  const dur = duration || fallbackDuration;
  return (
    <div className={s.progress}>
      <span className={s.time}>{formatTime(active ? pos : undefined)}</span>
      <Slider
        label="Progresso"
        value={dur ? Math.min(1, pos / dur) : 0}
        onChange={(v) => setScrub(v * dur)}
        onCommit={(v) => {
          setScrub(null);
          seek(v * dur);
        }}
      />
      <span className={s.time}>{formatTime(active ? dur : undefined)}</span>
    </div>
  );
}
