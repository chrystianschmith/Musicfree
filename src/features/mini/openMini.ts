import { isTauri } from "../../lib/platform";

export const MINI_LABEL = "mini";

/** Opens the always-on-top mini player (or brings it back), and minimises the main window. */
export async function openMiniPlayer() {
  const { WebviewWindow, getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const open = await WebviewWindow.getByLabel(MINI_LABEL);
  if (open) {
    await open.unminimize();
    await open.show();
    await open.setFocus();
  } else {
    new WebviewWindow(MINI_LABEL, {
      url: "index.html#/mini",
      title: "Musicfree",
      width: 380,
      height: 104,
      resizable: false,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      theme: "dark",
      backgroundColor: "#111114",
    });
  }
  if (isTauri()) await getCurrentWebviewWindow().minimize();
}

/** Back to the full window: show and focus it, then close the mini player. */
export async function expandFromMini() {
  const { WebviewWindow, getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const main = await WebviewWindow.getByLabel("main");
  if (main) {
    await main.unminimize();
    await main.show();
    await main.setFocus();
  }
  await getCurrentWebviewWindow().close();
}
