mod stream;

use std::sync::Arc;
use std::time::Duration;

use tauri::http::{Response, StatusCode};
use tauri::{Emitter, Manager};

use stream::{Entry, StreamStore};

struct Streams {
    store: Arc<StreamStore>,
    clients: stream::Clients,
}

/// Called by the front end with a freshly resolved googlevideo URL for `video_id`.
#[tauri::command]
fn stream_set_url(
    state: tauri::State<'_, Streams>,
    video_id: String,
    url: String,
    expires_at: i64,
    user_agent: Option<String>,
) {
    state.store.set(
        &video_id,
        Entry {
            url,
            expires_at,
            user_agent,
        },
    );
}

/// Checks that a resolved stream URL is actually served, through the same path playback uses.
#[tauri::command]
async fn stream_probe(
    state: tauri::State<'_, Streams>,
    url: String,
    user_agent: Option<String>,
    start: Option<u64>,
) -> Result<u16, ()> {
    Ok(stream::probe(
        &state.clients,
        &url,
        user_agent.as_deref(),
        start.unwrap_or(0),
    )
    .await)
}

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

fn error_response(status: u16) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY))
        .header("Access-Control-Allow-Origin", "*")
        .body(Vec::new())
        .unwrap()
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
        .plugin(tauri_plugin_http::init())
        .manage(Streams {
            store: Arc::new(StreamStore::default()),
            clients: stream::Clients::new(),
        })
        .register_asynchronous_uri_scheme_protocol("mf-stream", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            let id = stream::video_id_from_path(request.uri().path());
            let range = request
                .headers()
                .get("range")
                .and_then(|v| v.to_str().ok())
                .map(str::to_string);
            tauri::async_runtime::spawn(async move {
                let Some(id) = id else {
                    return responder.respond(error_response(400));
                };
                log::info!("stream {id}: request range {range:?}");
                let state = app.state::<Streams>();
                let ask = |vid: &str| {
                    let _ = app.emit("stream:need-url", serde_json::json!({ "videoId": vid }));
                };
                let result = stream::proxy(
                    &state.clients,
                    &state.store,
                    &id,
                    range.as_deref(),
                    &ask,
                    Duration::from_secs(20),
                )
                .await;
                let response = match result {
                    Ok(up) => {
                        let mut b = Response::builder()
                            .status(up.status)
                            .header("Access-Control-Allow-Origin", "*");
                        for (k, v) in &up.headers {
                            b = b.header(k.as_str(), v.as_str());
                        }
                        b.body(up.body).unwrap_or_else(|_| error_response(502))
                    }
                    Err(status) => {
                        log::error!("stream {id}: failed with {status}");
                        error_response(status)
                    }
                };
                responder.respond(response);
            });
        })
        .invoke_handler(tauri::generate_handler![
            stream_set_url,
            stream_probe,
            backup_and_reset_db
        ])
        .run(tauri::generate_context!())
        .expect("error while running Musicfree");
}
