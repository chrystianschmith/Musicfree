import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "../features/player/PlayerBar";
import { AudioEngine } from "../features/player/AudioEngine";
import { RightPanel } from "../features/nowplaying/RightPanel";
import { Toasts } from "../components/Toasts";
import { useUI } from "../store/ui";
import s from "./Layout.module.css";

export function Layout() {
  const panelOpen = useUI((u) => u.panelOpen);
  return (
    <div className={[s.app, panelOpen && s.withPanel].filter(Boolean).join(" ")}>
      <Sidebar />
      <main className={s.main} id="main-scroll">
        <Outlet />
      </main>
      {panelOpen && <RightPanel />}
      <PlayerBar />
      <AudioEngine />
      <Toasts />
    </div>
  );
}
