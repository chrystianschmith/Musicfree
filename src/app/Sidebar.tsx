import { NavLink } from "react-router-dom";
import {
  IconCompass,
  IconDisc,
  IconHeart,
  IconHistory,
  IconHome,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMicrophone,
  IconPlaylist,
  IconPlus,
  IconSearch,
  type Icon,
} from "@tabler/icons-react";
import { Logo, LogoMark } from "./Logo";
import { usePlaylists, useCreatePlaylist } from "../features/library/usePlaylists";
import { useUI } from "../store/ui";
import s from "./Sidebar.module.css";

function Item({
  to,
  icon: I,
  label,
  accent,
}: {
  to: string;
  icon: Icon;
  label: string;
  accent?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end
      title={label}
      className={({ isActive }) => [s.item, isActive && s.on].filter(Boolean).join(" ")}
    >
      <I size={20} stroke={1.6} className={accent ? s.accentIcon : undefined} aria-hidden />
      <span className={s.label}>{label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { data: playlists = [] } = usePlaylists();
  const create = useCreatePlaylist();
  const collapsed = useUI((u) => u.sidebarCollapsed);
  const toggle = useUI((u) => u.toggleSidebar);
  const Toggle = collapsed ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse;
  return (
    <nav
      className={[s.side, collapsed && s.collapsed].filter(Boolean).join(" ")}
      aria-label="Navegação principal"
    >
      <div className={s.logo}>
        {collapsed ? <LogoMark /> : <Logo />}
        <button
          className={s.toggle}
          onClick={toggle}
          aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
        >
          <Toggle size={18} stroke={1.6} aria-hidden />
        </button>
      </div>
      <Item to="/" icon={IconHome} label="Início" />
      <Item to="/search" icon={IconSearch} label="Buscar" />
      <Item to="/explore" icon={IconCompass} label="Explorar" />

      <div className={s.section}>
        <span>Sua biblioteca</span>
      </div>
      <div className={s.scroll}>
        <Item to="/library/liked" icon={IconHeart} label="Curtidas" accent />
        <Item to="/library/albums" icon={IconDisc} label="Álbuns" />
        <Item to="/library/artists" icon={IconMicrophone} label="Artistas" />
        <Item to="/library/history" icon={IconHistory} label="Histórico" />
        {playlists.map((p) => (
          <Item key={p.id} to={`/library/playlist/${p.id}`} icon={IconPlaylist} label={p.name} />
        ))}
      </div>
      <button className={s.item} onClick={() => create.mutate()} title="Nova playlist">
        <IconPlus size={20} stroke={1.6} aria-hidden />
        <span className={s.label}>Nova playlist</span>
      </button>
    </nav>
  );
}
