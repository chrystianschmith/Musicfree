use tauri::Manager;

/// Renames a corrupt library database aside so the app can recreate it.
#[tauri::command]
fn backup_and_reset_db(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let db = dir.join("musicfree.db");
    if !db.exists() {
        return Ok(String::new());
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    let backup = dir.join(format!("musicfree.db.bak-{stamp}"));
    std::fs::rename(&db, &backup).map_err(|e| e.to_string())?;
    log::warn!("library database backed up to {}", backup.display());
    Ok(backup.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![backup_and_reset_db])
        .run(tauri::generate_context!())
        .expect("error while running Musicfree");
}
