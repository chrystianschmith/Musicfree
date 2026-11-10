//! `mf-stream://<videoId>` — local audio proxy for the <audio> element.
//!
//! The webview cannot set headers on media requests and googlevideo URLs expire, so the
//! front end resolves a URL (via youtubei.js) and hands it to us with `stream_set_url`.
//! We forward `Range` requests in bounded chunks, replay the issuing client's User-Agent,
//! and when the URL is rejected (403/410) or expired we ask the front end for a fresh one
//! exactly once before failing.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tokio::sync::Notify;

/// Initial byte range fetched per request. The media servers answer 403 to ranges above a
/// limit that depends on the client the URL was issued for, so the proxy halves this on 403.
pub const CHUNK: u64 = 512 * 1024;
/// Smallest chunk tried when the media server keeps rejecting larger ranges.
pub const MIN_CHUNK: u64 = 32 * 1024;
/// Treat URLs as expired this long before their real expiry.
const EXPIRY_MARGIN_MS: i64 = 60_000;
pub const DEFAULT_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

#[derive(Clone, Debug, PartialEq)]
pub struct Entry {
    pub url: String,
    pub expires_at: i64,
    pub user_agent: Option<String>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

#[derive(Default)]
pub struct StreamStore {
    map: Mutex<HashMap<String, Entry>>,
    changed: Notify,
}

impl StreamStore {
    pub fn set(&self, id: &str, entry: Entry) {
        self.map.lock().unwrap().insert(id.to_string(), entry);
        self.changed.notify_waiters();
    }

    pub fn get_valid(&self, id: &str) -> Option<Entry> {
        let map = self.map.lock().unwrap();
        map.get(id)
            .filter(|e| e.expires_at - EXPIRY_MARGIN_MS > now_ms())
            .cloned()
    }

    pub fn invalidate(&self, id: &str) {
        self.map.lock().unwrap().remove(id);
    }

    /// Waits until a valid entry for `id` appears (or the timeout elapses).
    pub async fn wait_for(&self, id: &str, timeout: Duration) -> Option<Entry> {
        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            let notified = self.changed.notified();
            if let Some(e) = self.get_valid(id) {
                return Some(e);
            }
            if tokio::time::timeout_at(deadline, notified).await.is_err() {
                return self.get_valid(id);
            }
        }
    }
}

/// Parses a `Range: bytes=start-[end]` header. Suffix and multi ranges are not supported.
pub fn parse_range(header: &str) -> Option<(u64, Option<u64>)> {
    let spec = header.trim().strip_prefix("bytes=")?;
    if spec.contains(',') {
        return None;
    }
    let (a, b) = spec.split_once('-')?;
    let start: u64 = a.trim().parse().ok()?;
    let end = match b.trim() {
        "" => None,
        s => Some(s.parse::<u64>().ok()?),
    };
    if matches!(end, Some(e) if e < start) {
        return None;
    }
    Some((start, end))
}

/// Bounds a requested range to at most `chunk` bytes.
pub fn clamp_range(start: u64, end: Option<u64>, chunk: u64) -> (u64, u64) {
    let max_end = start + chunk - 1;
    (start, end.map_or(max_end, |e| e.min(max_end)))
}

/// Extracts the video id from the URI path (`/<id>` for both `mf-stream://localhost/<id>`
/// and `http://mf-stream.localhost/<id>`). Exactly one path segment is accepted.
pub fn video_id_from_path(path: &str) -> Option<String> {
    let id = path.trim_matches('/');
    let ok = !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    ok.then(|| id.to_string())
}

#[derive(Debug)]
pub struct Upstream {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

const FORWARD_HEADERS: [&str; 4] = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
];

/// IP family a googlevideo URL was issued for (its `ip=` parameter). The media servers answer
/// 403 when the request arrives from another address than the one that asked for the URL,
/// which happens on dual-stack networks if the two requests pick different families.
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum Family {
    V4,
    V6,
}

pub fn ip_family(url: &str) -> Option<Family> {
    let query = url.split_once('?')?.1;
    let ip = query.split('&').find_map(|kv| kv.strip_prefix("ip="))?;
    if ip.contains(':') || ip.contains("%3A") || ip.contains("%3a") {
        Some(Family::V6)
    } else if ip.contains('.') {
        Some(Family::V4)
    } else {
        None
    }
}

/// HTTP clients pinned to each IP family, plus an unpinned one.
pub struct Clients {
    any: reqwest::Client,
    v4: reqwest::Client,
    v6: reqwest::Client,
    /// Route that last worked (0 = unpinned, 1 = IPv4, 2 = IPv6).
    preferred: std::sync::atomic::AtomicU8,
    /// Range size the media server last accepted.
    chunk: std::sync::atomic::AtomicU64,
}

impl Clients {
    pub fn new() -> Self {
        let base = || reqwest::Client::builder().connect_timeout(Duration::from_secs(10));
        let any = base().build().expect("http client");
        let v4 = base()
            .local_address(std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED))
            .build()
            .unwrap_or_else(|_| any.clone());
        let v6 = base()
            .local_address(std::net::IpAddr::V6(std::net::Ipv6Addr::UNSPECIFIED))
            .build()
            .unwrap_or_else(|_| any.clone());
        Self {
            any,
            v4,
            v6,
            preferred: std::sync::atomic::AtomicU8::new(0),
            chunk: std::sync::atomic::AtomicU64::new(CHUNK),
        }
    }

    pub fn chunk(&self) -> u64 {
        self.chunk.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Routes to try for `url`, best guess first: the remembered working one, then the family
    /// the URL was issued for, then the rest.
    fn routes(&self, url: &str) -> Vec<(u8, &reqwest::Client)> {
        let all = [(0u8, &self.any), (1, &self.v4), (2, &self.v6)];
        let mut order = vec![self.preferred.load(std::sync::atomic::Ordering::Relaxed)];
        order.push(match ip_family(url) {
            Some(Family::V4) => 1,
            Some(Family::V6) => 2,
            None => 0,
        });
        order.extend([0, 1, 2]);
        let mut seen = [false; 3];
        order
            .into_iter()
            .filter(|r| !std::mem::replace(&mut seen[*r as usize], true))
            .map(|r| all[r as usize])
            .collect()
    }
}

impl Default for Clients {
    fn default() -> Self {
        Self::new()
    }
}

/// Requests the first bytes of a stream URL and returns the HTTP status (0 on network error).
pub async fn probe(clients: &Clients, url: &str, user_agent: Option<&str>) -> u16 {
    let e = Entry {
        url: url.to_string(),
        expires_at: i64::MAX,
        user_agent: user_agent.map(str::to_string),
    };
    match fetch(clients, &e, (0, 1023)).await {
        Ok(up) => up.status,
        Err(err) => {
            log::warn!("probe failed: {err}");
            0
        }
    }
}

/// Error text including the whole cause chain (reqwest hides the cause in `Display`).
fn error_chain(err: &dyn std::error::Error) -> String {
    let mut out = err.to_string();
    let mut cur = err.source();
    while let Some(e) = cur {
        out.push_str(" <- ");
        out.push_str(&e.to_string());
        cur = e.source();
    }
    // Never log full stream URLs.
    match out.find("?expire=") {
        Some(i) => {
            let end = out[i..].find(')').map_or(out.len(), |j| i + j);
            format!("{}?…{}", &out[..i], &out[end..])
        }
        None => out,
    }
}

async fn fetch_via(
    client: &reqwest::Client,
    e: &Entry,
    range: (u64, u64),
) -> Result<Upstream, String> {
    let res = client
        .get(&e.url)
        .header("Range", format!("bytes={}-{}", range.0, range.1))
        .header("User-Agent", e.user_agent.as_deref().unwrap_or(DEFAULT_UA))
        .send()
        .await
        .map_err(|err| error_chain(&err))?;
    let status = res.status().as_u16();
    let headers = res
        .headers()
        .iter()
        .filter(|(k, _)| FORWARD_HEADERS.contains(&k.as_str()))
        .filter_map(|(k, v)| Some((k.to_string(), v.to_str().ok()?.to_string())))
        .collect();
    let body = res.bytes().await.map_err(|err| error_chain(&err))?.to_vec();
    Ok(Upstream {
        status,
        headers,
        body,
    })
}

/// Fetches a range trying each network route until one is served; remembers the one that worked.
async fn fetch(clients: &Clients, e: &Entry, range: (u64, u64)) -> Result<Upstream, String> {
    let mut last: Result<Upstream, String> = Err("no route".into());
    for (route, client) in clients.routes(&e.url) {
        let res = fetch_via(client, e, range).await;
        match &res {
            Ok(up) if !rejected(up.status) => {
                clients
                    .preferred
                    .store(route, std::sync::atomic::Ordering::Relaxed);
                return res;
            }
            Ok(up) => log::warn!("route {route}: HTTP {}", up.status),
            Err(err) => log::warn!("route {route}: {err}"),
        }
        // Prefer reporting an HTTP answer over a connection error.
        if res.is_ok() || last.is_err() {
            last = res;
        }
    }
    last
}

/// Fetches a range, halving the chunk size while the server answers 403 (down to
/// [`MIN_CHUNK`]); the accepted size is remembered. A 403 at the minimum size is a real rejection.
async fn fetch_sized(
    clients: &Clients,
    e: &Entry,
    start: u64,
    end: Option<u64>,
) -> Result<Upstream, String> {
    let mut chunk = clients.chunk();
    loop {
        let res = fetch(clients, e, clamp_range(start, end, chunk)).await;
        match &res {
            Ok(up) if up.status == 403 && chunk > MIN_CHUNK => {
                chunk = (chunk / 2).max(MIN_CHUNK);
                log::warn!("403 from media server, retrying with {chunk}-byte ranges");
            }
            Ok(up) if !rejected(up.status) => {
                clients
                    .chunk
                    .store(chunk, std::sync::atomic::Ordering::Relaxed);
                return res;
            }
            _ => return res,
        }
    }
}

fn rejected(status: u16) -> bool {
    matches!(status, 401 | 403 | 404 | 410)
}

/// Serves one range of `id`, asking for a fresh URL (via `request_url`) at most once.
/// Errors carry the HTTP status to return to the webview.
pub async fn proxy(
    client: &Clients,
    store: &StreamStore,
    id: &str,
    range_header: Option<&str>,
    request_url: &(dyn Fn(&str) + Sync),
    wait: Duration,
) -> Result<Upstream, u16> {
    let (start, end) = range_header.and_then(parse_range).unwrap_or((0, None));

    let mut entry = match store.get_valid(id) {
        Some(e) => e,
        None => {
            request_url(id);
            store.wait_for(id, wait).await.ok_or(504u16)?
        }
    };

    for attempt in 0..2 {
        match fetch_sized(client, &entry, start, end).await {
            Ok(up) if !rejected(up.status) => return Ok(up),
            Ok(up) if up.status == 416 => return Ok(up),
            outcome => {
                log::warn!("stream {id}: upstream rejected ({outcome:?}), attempt {attempt}");
                if attempt == 1 {
                    break;
                }
                store.invalidate(id);
                request_url(id);
                entry = store.wait_for(id, wait).await.ok_or(504u16)?;
            }
        }
    }
    Err(502)
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn entry(url: String) -> Entry {
        Entry {
            url,
            expires_at: now_ms() + 3_600_000,
            user_agent: Some("UA-test".into()),
        }
    }

    #[test]
    fn parses_ranges() {
        assert_eq!(parse_range("bytes=0-"), Some((0, None)));
        assert_eq!(parse_range("bytes=100-199"), Some((100, Some(199))));
        assert_eq!(parse_range("bytes=200-100"), None);
        assert_eq!(parse_range("bytes=-500"), None);
        assert_eq!(parse_range("bytes=0-1,5-9"), None);
        assert_eq!(parse_range("items=0-1"), None);
    }

    #[test]
    fn detects_ip_family_of_stream_urls() {
        assert_eq!(
            ip_family("https://rr1.googlevideo.com/videoplayback?expire=1&ip=200.1.2.3&id=x"),
            Some(Family::V4)
        );
        assert_eq!(
            ip_family("https://rr1.googlevideo.com/videoplayback?ip=2804%3A14c%3A%3A1&id=x"),
            Some(Family::V6)
        );
        assert_eq!(
            ip_family("https://rr1.googlevideo.com/videoplayback?ip=2804:14c::1"),
            Some(Family::V6)
        );
        assert_eq!(ip_family("http://127.0.0.1:9/a"), None);
        assert_eq!(ip_family("https://x/y?zip=1.2.3.4"), None);
    }

    #[test]
    fn clamps_to_chunk() {
        assert_eq!(clamp_range(0, None, CHUNK), (0, CHUNK - 1));
        assert_eq!(clamp_range(10, Some(20), CHUNK), (10, 20));
        assert_eq!(clamp_range(0, Some(CHUNK * 3), 1000), (0, 999));
    }

    #[test]
    fn extracts_video_ids() {
        assert_eq!(
            video_id_from_path("/dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".into())
        );
        assert_eq!(video_id_from_path("/a-b_C"), Some("a-b_C".into()));
        assert_eq!(video_id_from_path("/../etc"), None);
        assert_eq!(video_id_from_path("/"), None);
    }

    #[test]
    fn expired_entries_are_not_valid() {
        let s = StreamStore::default();
        s.set(
            "x",
            Entry {
                url: "u".into(),
                expires_at: now_ms() + 30_000,
                user_agent: None,
            },
        );
        assert!(s.get_valid("x").is_none());
    }

    #[tokio::test]
    async fn forwards_range_and_user_agent() {
        let server = MockServer::start_async().await;
        let m = server
            .mock_async(|when, then| {
                when.method(GET)
                    .path("/a")
                    .header("Range", "bytes=0-9")
                    .header("User-Agent", "UA-test");
                then.status(206)
                    .header("Content-Range", "bytes 0-9/100")
                    .header("Content-Type", "audio/mp4")
                    .body("0123456789");
            })
            .await;
        let store = StreamStore::default();
        store.set("v", entry(server.url("/a")));
        let up = proxy(
            &Clients::new(),
            &store,
            "v",
            Some("bytes=0-9"),
            &|_| {},
            Duration::from_millis(50),
        )
        .await
        .unwrap();
        m.assert_async().await;
        assert_eq!(up.status, 206);
        assert_eq!(up.body, b"0123456789");
        assert!(
            up.headers
                .iter()
                .any(|(k, v)| k == "content-range" && v == "bytes 0-9/100")
        );
    }

    #[tokio::test]
    async fn shrinks_the_chunk_until_the_server_accepts_it() {
        // Media servers answer 403 to ranges above a size limit even for valid URLs.
        let server = MockServer::start_async().await;
        let small = server
            .mock_async(|w, t| {
                w.path("/a").header("Range", "bytes=0-131071");
                t.status(206).body("ok");
            })
            .await;
        server
            .mock_async(|w, t| {
                w.path("/a");
                t.status(403);
            })
            .await;
        let store = StreamStore::default();
        store.set("v", entry(server.url("/a")));
        let clients = Clients::new();
        let asked = AtomicUsize::new(0);
        let ask = |_: &str| {
            asked.fetch_add(1, Ordering::SeqCst);
        };
        let up = proxy(
            &clients,
            &store,
            "v",
            Some("bytes=0-"),
            &ask,
            Duration::from_millis(50),
        )
        .await
        .unwrap();
        assert_eq!(up.body, b"ok");
        assert_eq!(
            asked.load(Ordering::SeqCst),
            0,
            "a size rejection must not trigger a re-resolve"
        );
        // The accepted size is remembered for the next request.
        small.assert_hits_async(1).await;
        let _ = proxy(
            &clients,
            &store,
            "v",
            Some("bytes=0-"),
            &ask,
            Duration::from_millis(50),
        )
        .await
        .unwrap();
        small.assert_hits_async(2).await;
        assert_eq!(clients.chunk(), 131_072);
    }

    #[tokio::test]
    async fn re_resolves_once_after_403() {
        let server = MockServer::start_async().await;
        server
            .mock_async(|w, t| {
                w.path("/old");
                t.status(403);
            })
            .await;
        server
            .mock_async(|w, t| {
                w.path("/new");
                t.status(206).body("ok");
            })
            .await;
        let store = Arc::new(StreamStore::default());
        store.set("v", entry(server.url("/old")));
        let asks = Arc::new(AtomicUsize::new(0));
        let (s2, a2, new_url) = (store.clone(), asks.clone(), server.url("/new"));
        let request = move |id: &str| {
            a2.fetch_add(1, Ordering::SeqCst);
            s2.set(id, entry(new_url.clone()));
        };
        let up = proxy(
            &Clients::new(),
            &store,
            "v",
            None,
            &request,
            Duration::from_millis(200),
        )
        .await
        .unwrap();
        assert_eq!(up.body, b"ok");
        assert_eq!(asks.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn gives_up_with_502_after_second_rejection() {
        let server = MockServer::start_async().await;
        server
            .mock_async(|w, t| {
                w.any_request();
                t.status(403);
            })
            .await;
        let store = Arc::new(StreamStore::default());
        store.set("v", entry(server.url("/x")));
        let asks = Arc::new(AtomicUsize::new(0));
        let (s2, a2, url) = (store.clone(), asks.clone(), server.url("/y"));
        let request = move |id: &str| {
            a2.fetch_add(1, Ordering::SeqCst);
            s2.set(id, entry(url.clone()));
        };
        let err = proxy(
            &Clients::new(),
            &store,
            "v",
            None,
            &request,
            Duration::from_millis(200),
        )
        .await
        .unwrap_err();
        assert_eq!(err, 502);
        assert_eq!(asks.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn asks_for_url_and_times_out_with_504() {
        let store = StreamStore::default();
        let asked = AtomicUsize::new(0);
        let err = proxy(
            &Clients::new(),
            &store,
            "v",
            None,
            &|_| {
                asked.fetch_add(1, Ordering::SeqCst);
            },
            Duration::from_millis(50),
        )
        .await
        .unwrap_err();
        assert_eq!(err, 504);
        assert_eq!(asked.load(Ordering::SeqCst), 1);
    }
}
