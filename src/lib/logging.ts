import { isTauri } from "./platform";

/**
 * In the desktop app, mirror console warnings/errors into the log file
 * (%LOCALAPPDATA%\dev.chrystianschmith.musicfree\logs on Windows) so problems can be diagnosed.
 */
export async function forwardConsoleToLog() {
  if (!isTauri()) return;
  const log = await import("@tauri-apps/plugin-log");
  const fmt = (args: unknown[]) =>
    args
      .map((a) =>
        a instanceof Error
          ? `${a.name}: ${a.message}\n${a.stack ?? ""}`
          : typeof a === "string"
            ? a
            : safeJson(a),
      )
      .join(" ");
  const wrap = (level: "warn" | "error", sink: (m: string) => Promise<void>) => {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      orig(...args);
      void sink(fmt(args)).catch(() => undefined);
    };
  };
  wrap("warn", log.warn);
  wrap("error", log.error);
  window.addEventListener("error", (e) => void log.error(`uncaught: ${e.message}`));
  window.addEventListener(
    "unhandledrejection",
    (e) => void log.error(`unhandled rejection: ${fmt([e.reason])}`),
  );
  void log.info(`Musicfree started (${navigator.userAgent})`);
}

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
