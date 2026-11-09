import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useNavigate } from "react-router-dom";
import {
  IconBroadcast,
  IconDisc,
  IconHeart,
  IconListDetails,
  IconPlayerTrackNext,
  IconPlaylistAdd,
  IconUser,
  type Icon,
} from "@tabler/icons-react";
import type { Track } from "../sources/types";
import { usePlayer } from "../store/player";
import { useUI } from "../store/ui";
import { getSource } from "../sources";
import { useLibraryActions, usePlaylists } from "../features/library/usePlaylists";
import s from "./ContextMenu.module.css";

type MenuState = { x: number; y: number; track: Track } | null;
const useMenuStore = create<{ menu: MenuState; set(m: MenuState): void }>()((set) => ({
  menu: null,
  set: (menu) => set({ menu }),
}));

export function useTrackMenu() {
  const set = useMenuStore((m) => m.set);
  return {
    open(e: React.MouseEvent, track: Track) {
      e.preventDefault();
      set({ x: e.clientX, y: e.clientY, track });
    },
  };
}

export async function startRadio(t: Track) {
  try {
    const radio = await getSource().radio(t.id);
    usePlayer.getState().playTracks(radio, 0);
  } catch {
    useUI.getState().toast("Não foi possível iniciar o rádio");
  }
}

function Item({ icon: I, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
  return (
    <button className={s.item} role="menuitem" onClick={onClick}>
      <I size={17} stroke={1.6} aria-hidden /> {label}
    </button>
  );
}

export function ContextMenu() {
  const { menu, set } = useMenuStore();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [sub, setSub] = useState(false);
  const nav = useNavigate();
  const { data: playlists = [] } = usePlaylists();
  const lib = useLibraryActions();

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(menu.x, window.innerWidth - r.width - 8),
      y: Math.min(menu.y, window.innerHeight - r.height - 8),
    });
    setSub(false);
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "mousedown" && ref.current?.contains(e.target as Node)) return;
      set(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("blur", close);
    };
  }, [menu, set]);

  if (!menu) return null;
  const t = menu.track;
  const act = (fn: () => void) => () => {
    fn();
    set(null);
  };
  const artistId = t.artists.find((a) => a.id)?.id;

  return (
    <div ref={ref} className={s.menu} role="menu" style={{ left: pos.x, top: pos.y }}>
      <Item
        icon={IconPlayerTrackNext}
        label="Tocar a seguir"
        onClick={act(() => usePlayer.getState().playNext(t))}
      />
      <Item
        icon={IconListDetails}
        label="Adicionar à fila"
        onClick={act(() => usePlayer.getState().addToQueue(t))}
      />
      <Item icon={IconBroadcast} label="Iniciar rádio" onClick={act(() => void startRadio(t))} />
      <div className={s.sep} />
      <Item icon={IconHeart} label="Curtir / descurtir" onClick={act(() => lib.toggleLike(t))} />
      <button className={s.item} role="menuitem" aria-haspopup onClick={() => setSub((v) => !v)}>
        <IconPlaylistAdd size={17} stroke={1.6} aria-hidden /> Adicionar à playlist
      </button>
      {sub && (
        <div className={s.sub}>
          <button className={s.item} onClick={act(() => lib.createPlaylistWith(t))}>
            Nova playlist
          </button>
          {playlists.map((p) => (
            <button key={p.id} className={s.item} onClick={act(() => lib.addToPlaylist(p.id, t))}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className={s.sep} />
      {artistId && (
        <Item
          icon={IconUser}
          label="Ir para o artista"
          onClick={act(() => nav(`/artist/${artistId}`))}
        />
      )}
      {t.album?.id && (
        <Item
          icon={IconDisc}
          label="Ir para o álbum"
          onClick={act(() => nav(`/album/${t.album!.id}`))}
        />
      )}
    </div>
  );
}
