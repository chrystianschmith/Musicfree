//! Desktop integration: the Windows 11 Mica backdrop, the tray icon, closing to the tray and the
//! taskbar thumbnail buttons. Media actions reach the front end as `media:command` events.

use std::path::PathBuf;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};

/// Settings kept next to the library database (`desktop.json`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub close_to_tray: bool,
}

// Closing to the tray is only offered on Windows, where the tray icon exists.
#[allow(clippy::derivable_impls)]
impl Default for Settings {
    fn default() -> Self {
        Self {
            close_to_tray: cfg!(windows),
        }
    }
}

impl Settings {
    /// Reads the settings, falling back to the defaults when the file is missing or unreadable.
    pub fn parse(json: Option<&str>) -> Self {
        json.and_then(|j| serde_json::from_str(j).ok())
            .unwrap_or_default()
    }
}

#[cfg_attr(not(windows), allow(dead_code))]
pub struct Desktop {
    pub close_to_tray: AtomicBool,
    pub backdrop: OnceLock<&'static str>,
    file: Option<PathBuf>,
}

impl Desktop {
    pub fn load<R: Runtime>(app: &AppHandle<R>) -> Self {
        let file = app
            .path()
            .app_config_dir()
            .ok()
            .map(|d| d.join("desktop.json"));
        let json = file.as_ref().and_then(|f| std::fs::read_to_string(f).ok());
        let settings = Settings::parse(json.as_deref());
        Self {
            close_to_tray: AtomicBool::new(settings.close_to_tray),
            backdrop: OnceLock::new(),
            file,
        }
    }

    #[cfg_attr(not(windows), allow(dead_code))]
    pub fn set_close_to_tray(&self, enabled: bool) {
        self.close_to_tray.store(enabled, Ordering::Relaxed);
        if let Some(file) = &self.file {
            let settings = Settings {
                close_to_tray: enabled,
            };
            if let Some(dir) = file.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            if let Err(e) =
                std::fs::write(file, serde_json::to_string(&settings).unwrap_or_default())
            {
                log::warn!("could not save desktop settings: {e}");
            }
        }
    }
}

/// Window backdrop actually applied: "mica" (Windows 11) or "none".
#[tauri::command]
pub fn desktop_backdrop(state: tauri::State<'_, Desktop>) -> String {
    state.backdrop.get().copied().unwrap_or("none").to_string()
}

/// The front end reports what is playing, for the tray tooltip/menu and the taskbar buttons.
#[tauri::command]
pub fn set_now_playing<R: Runtime>(app: AppHandle<R>, title: Option<String>, playing: bool) {
    #[cfg(windows)]
    {
        tray::update(&app, title.as_deref(), playing);
        thumbbar::set_playing(&app, playing);
    }
    #[cfg(not(windows))]
    let _ = (app, title, playing);
}

#[cfg_attr(not(windows), allow(dead_code))]
pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(not(windows), allow(dead_code))]
pub fn send_command<R: Runtime>(app: &AppHandle<R>, action: &str) {
    let _ = app.emit_to("main", "media:command", action);
}

/// Called once from `setup`: backdrop, tray and taskbar buttons for the main window.
pub fn setup<R: Runtime>(app: &AppHandle<R>, main: &WebviewWindow<R>) {
    let state = app.state::<Desktop>();
    let backdrop = apply_backdrop(main);
    let _ = state.backdrop.set(backdrop);
    log::info!("window backdrop: {backdrop}");
    #[cfg(windows)]
    {
        if let Err(e) = tray::build(app, state.close_to_tray.load(Ordering::Relaxed)) {
            log::error!("tray icon failed: {e}");
        }
        thumbbar::install(app, main);
    }
}

#[cfg(windows)]
fn apply_backdrop<R: Runtime>(w: &WebviewWindow<R>) -> &'static str {
    use tauri::window::{Effect, EffectsBuilder};
    use windows_version::OsVersion;
    if OsVersion::current() < OsVersion::new(10, 0, 0, 22000) {
        return "none";
    }
    match w.set_effects(EffectsBuilder::new().effect(Effect::MicaDark).build()) {
        Ok(()) => "mica",
        Err(e) => {
            log::warn!("mica failed: {e}");
            "none"
        }
    }
}

#[cfg(not(windows))]
fn apply_backdrop<R: Runtime>(_w: &WebviewWindow<R>) -> &'static str {
    "none"
}

#[cfg(windows)]
mod tray {
    use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    use tauri::{AppHandle, Manager, Runtime};

    use super::{Desktop, send_command, show_main};

    struct Items<R: Runtime> {
        toggle: MenuItem<R>,
    }

    pub fn build<R: Runtime>(app: &AppHandle<R>, close_to_tray: bool) -> tauri::Result<()> {
        let toggle = MenuItem::with_id(app, "toggle", "Tocar", true, None::<&str>)?;
        let prev = MenuItem::with_id(app, "prev", "Anterior", true, None::<&str>)?;
        let next = MenuItem::with_id(app, "next", "Próxima", true, None::<&str>)?;
        let show = MenuItem::with_id(app, "show", "Mostrar o Musicfree", true, None::<&str>)?;
        let close = CheckMenuItem::with_id(
            app,
            "close_to_tray",
            "Fechar para a bandeja",
            true,
            close_to_tray,
            None::<&str>,
        )?;
        let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
        let menu = Menu::with_items(
            app,
            &[
                &toggle,
                &prev,
                &next,
                &PredefinedMenuItem::separator(app)?,
                &show,
                &close,
                &PredefinedMenuItem::separator(app)?,
                &quit,
            ],
        )?;
        let close_item = close.clone();
        let Some(icon) = app.default_window_icon().cloned() else {
            log::warn!("no window icon for the tray");
            return Ok(());
        };
        TrayIconBuilder::with_id("main")
            .tooltip("Musicfree")
            .icon(icon)
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_menu_event(move |app, e| match e.id().as_ref() {
                "toggle" | "prev" | "next" => send_command(app, e.id().as_ref()),
                "show" => show_main(app),
                "close_to_tray" => {
                    let on = close_item.is_checked().unwrap_or(false);
                    app.state::<Desktop>().set_close_to_tray(on);
                }
                "quit" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, e| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = e
                {
                    let app = tray.app_handle();
                    match app.get_webview_window("main") {
                        Some(w)
                            if w.is_visible().unwrap_or(false)
                                && !w.is_minimized().unwrap_or(false) =>
                        {
                            let _ = w.hide();
                        }
                        _ => show_main(app),
                    }
                }
            })
            .build(app)?;
        app.manage(Items { toggle });
        Ok(())
    }

    pub fn update<R: Runtime>(app: &AppHandle<R>, title: Option<&str>, playing: bool) {
        if let Some(tray) = app.tray_by_id("main") {
            let tip = title.map_or("Musicfree".to_string(), |t| format!("{t}\nMusicfree"));
            // Windows limits tray tooltips to 127 characters.
            let tip: String = tip.chars().take(120).collect();
            let _ = tray.set_tooltip(Some(tip));
        }
        if let Some(items) = app.try_state::<Items<R>>() {
            let _ = items
                .toggle
                .set_text(if playing { "Pausar" } else { "Tocar" });
        }
    }
}

#[cfg(windows)]
mod thumbbar {
    //! Previous / play-pause / next buttons under the taskbar thumbnail (ITaskbarList3).
    use std::sync::OnceLock;
    use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};

    use tauri::{AppHandle, Runtime, WebviewWindow};
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, CoCreateInstance};
    use windows::Win32::UI::Shell::{
        DefSubclassProc, ITaskbarList3, SetWindowSubclass, THB_FLAGS, THB_ICON, THB_TOOLTIP,
        THBF_ENABLED, THBN_CLICKED, THUMBBUTTON, TaskbarList,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateIconFromResourceEx, GetSystemMetrics, HICON, LR_DEFAULTCOLOR, RegisterWindowMessageW,
        SM_CXSMICON, WM_COMMAND,
    };
    use windows::core::w;

    const PREV: u32 = 1;
    const TOGGLE: u32 = 2;
    const NEXT: u32 = 3;

    static HWND_RAW: AtomicIsize = AtomicIsize::new(0);
    static PLAYING: AtomicBool = AtomicBool::new(false);
    static ADDED: AtomicBool = AtomicBool::new(false);
    static CREATED_MSG: OnceLock<u32> = OnceLock::new();
    /// prev, play, pause, next — as raw handles so they can live in a static.
    static ICONS: OnceLock<[isize; 4]> = OnceLock::new();
    type Emit = Box<dyn Fn(&str) + Send + Sync>;
    static EMIT: OnceLock<Emit> = OnceLock::new();

    fn hwnd() -> HWND {
        HWND(HWND_RAW.load(Ordering::Relaxed) as *mut core::ffi::c_void)
    }

    fn icon(png: &[u8]) -> isize {
        unsafe {
            let size = GetSystemMetrics(SM_CXSMICON);
            CreateIconFromResourceEx(png, true, 0x0003_0000, size, size, LR_DEFAULTCOLOR)
                .map(|h| h.0 as isize)
                .unwrap_or(0)
        }
    }

    fn icons() -> [isize; 4] {
        *ICONS.get_or_init(|| {
            [
                icon(include_bytes!("../icons/thumbbar/prev.png")),
                icon(include_bytes!("../icons/thumbbar/play.png")),
                icon(include_bytes!("../icons/thumbbar/pause.png")),
                icon(include_bytes!("../icons/thumbbar/next.png")),
            ]
        })
    }

    fn tip(text: &str) -> [u16; 260] {
        let mut out = [0u16; 260];
        for (i, c) in text.encode_utf16().take(259).enumerate() {
            out[i] = c;
        }
        out
    }

    fn button(id: u32, icon: isize, text: &str) -> THUMBBUTTON {
        THUMBBUTTON {
            dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
            iId: id,
            iBitmap: 0,
            hIcon: HICON(icon as *mut core::ffi::c_void),
            szTip: tip(text),
            dwFlags: THBF_ENABLED,
        }
    }

    fn toggle_button() -> THUMBBUTTON {
        let i = icons();
        if PLAYING.load(Ordering::Relaxed) {
            button(TOGGLE, i[2], "Pausar")
        } else {
            button(TOGGLE, i[1], "Tocar")
        }
    }

    fn taskbar() -> windows::core::Result<ITaskbarList3> {
        unsafe {
            let t: ITaskbarList3 = CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER)?;
            t.HrInit()?;
            Ok(t)
        }
    }

    fn add_buttons() {
        let i = icons();
        let buttons = [
            button(PREV, i[0], "Anterior"),
            toggle_button(),
            button(NEXT, i[3], "Próxima"),
        ];
        match taskbar().and_then(|t| unsafe { t.ThumbBarAddButtons(hwnd(), &buttons) }) {
            Ok(()) => ADDED.store(true, Ordering::Relaxed),
            Err(e) => log::debug!("thumbnail buttons not added yet: {e}"),
        }
    }

    unsafe extern "system" fn subclass(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _data: usize,
    ) -> LRESULT {
        // The taskbar (re)creates the window's button when it is first shown or after Explorer
        // restarts; buttons can only be added then.
        if Some(&msg) == CREATED_MSG.get() {
            add_buttons();
        } else if msg == WM_COMMAND && ((wparam.0 >> 16) & 0xffff) as u32 == THBN_CLICKED {
            let action = match (wparam.0 & 0xffff) as u32 {
                PREV => Some("prev"),
                TOGGLE => Some("toggle"),
                NEXT => Some("next"),
                _ => None,
            };
            if let (Some(a), Some(emit)) = (action, EMIT.get()) {
                emit(a);
                return LRESULT(0);
            }
        }
        unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
    }

    pub fn install<R: Runtime>(app: &AppHandle<R>, main: &WebviewWindow<R>) {
        let Ok(h) = main.hwnd() else { return };
        HWND_RAW.store(h.0 as isize, Ordering::Relaxed);
        let app = app.clone();
        let _ = EMIT.set(Box::new(move |a| super::send_command(&app, a)));
        unsafe {
            let _ = CREATED_MSG.set(RegisterWindowMessageW(w!("TaskbarButtonCreated")));
            let _ = SetWindowSubclass(hwnd(), Some(subclass), 1, 0);
        }
        // The button may already exist (window shown before setup ran).
        add_buttons();
    }

    pub fn set_playing<R: Runtime>(app: &AppHandle<R>, playing: bool) {
        if PLAYING.swap(playing, Ordering::Relaxed) == playing && ADDED.load(Ordering::Relaxed) {
            return;
        }
        let _ = app.run_on_main_thread(|| {
            if !ADDED.load(Ordering::Relaxed) {
                return;
            }
            let b = [toggle_button()];
            if let Err(e) = taskbar().and_then(|t| unsafe { t.ThumbBarUpdateButtons(hwnd(), &b) }) {
                log::debug!("thumbnail button update failed: {e}");
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::Settings;

    #[test]
    fn settings_default_when_missing_or_corrupt() {
        assert_eq!(Settings::parse(None), Settings::default());
        assert_eq!(Settings::parse(Some("not json")), Settings::default());
    }

    #[test]
    fn settings_round_trip() {
        let s = Settings {
            close_to_tray: false,
        };
        let json = serde_json::to_string(&s).unwrap();
        assert_eq!(json, r#"{"closeToTray":false}"#);
        assert_eq!(Settings::parse(Some(&json)), s);
    }
}
