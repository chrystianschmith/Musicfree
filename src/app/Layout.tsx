import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "../features/player/PlayerBar";
import { AudioEngine } from "../features/player/AudioEngine";
import { RightPanel } from "../features/nowplaying/RightPanel";
import { Toasts } from "../components/Toasts";
import { ContextMenu } from "../components/ContextMenu";
import { NowPlaying } from "../features/nowplaying/NowPlaying";
import { useShortcuts } from "./shortcuts";
import { useSessionPersistence } from "./session";
import { useUI } from "../store/ui";
import { useAmbient } from "./useAmbient";
import s from "./Layout.module.css";

export function Layout() {
  const panelOpen = useUI((u) => u.panelOpen);
  const collapsed = useUI((u) => u.sidebarCollapsed);
  const { pathname } = useLocation();
  useAmbient();
  useShortcuts();
  useSessionPersistence();
  return (
    <div
      className={[s.app, panelOpen && s.withPanel, collapsed && s.collapsed]
        .filter(Boolean)
        .join(" ")}
    >
      <Sidebar />
      <main className={s.main} id="main-scroll">
        <div key={pathname} className={s.page}>
          <Outlet />
        </div>
      </main>
      {panelOpen && <RightPanel />}
      <NowPlaying />
      <PlayerBar />
      <AudioEngine />
      <Toasts />
      <ContextMenu />
    </div>
  );
}
