use std::env;
use std::io::Write as _;
use std::net::SocketAddr;
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tokio::net::{TcpListener, UdpSocket};
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::protocol::Message;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct Config {
    ws_port: u16,
    target_host: String,
    target_port: u16,
    master_server_base: String,
    use_url_params: bool,
}

impl Config {
    fn from_env() -> Self {
        Self {
            ws_port: env::var("WS_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(27961),
            target_host: env::var("TARGET_HOST").unwrap_or_else(|_| "127.0.0.1".into()),
            target_port: env::var("TARGET_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(27960),
            master_server_base: env::var("MASTER_SERVER_BASE")
                .unwrap_or_else(|_| "https://master.cpma.live".into()),
            use_url_params: env::var("USE_URL_PARAMS")
                .map(|v| v == "true")
                .unwrap_or(false),
        }
    }
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct HeartbeatBody {
    #[serde(rename = "proxyPort")]
    proxy_port: u16,
    #[serde(rename = "targetPort")]
    target_port: u16,
}

async fn heartbeat_loop(config: Config) {
    let client = reqwest::Client::new();
    let url = format!("{}/api/servers/heartbeat", config.master_server_base);
    let body = HeartbeatBody {
        proxy_port: config.ws_port,
        target_port: config.target_port,
    };

    let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));

    loop {
        interval.tick().await; // first tick fires immediately
        let res = client.put(&url).json(&body).send().await;
        match res {
            Ok(r) if !r.status().is_success() => {
                eprintln!("Heartbeat failed: {}", r.status());
            }
            Err(e) => {
                eprintln!("Heartbeat error: {}", e);
            }
            _ => {}
        }
    }
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

async fn handle_connection(
    stream: tokio::net::TcpStream,
    config: Config,
) {
    let uri_holder: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let uri_capture = uri_holder.clone();

    let ws_stream = match tokio_tungstenite::accept_hdr_async(stream, |req: &Request, resp: Response| {
        let uri = req.uri().to_string();
        // We can't await inside this sync callback, so use try_lock / blocking approach
        if let Ok(mut guard) = uri_capture.try_lock() {
            *guard = uri;
        }
        Ok(resp)
    })
    .await
    {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("WebSocket handshake error: {}", e);
            return;
        }
    };

    // Determine target
    let (target_host, target_port) = if config.use_url_params {
        let uri_str = uri_holder.lock().await.clone();
        parse_target_from_uri(&uri_str, &config.target_host, config.target_port)
    } else {
        (config.target_host.clone(), config.target_port)
    };

    if config.use_url_params {
        eprintln!("Client override → {}:{}", target_host, target_port);
    }

    // Resolve target address
    let target_addr = match tokio::net::lookup_host(format!("{}:{}", target_host, target_port)).await {
        Ok(mut addrs) => match addrs.next() {
            Some(addr) => addr,
            None => {
                eprintln!("DNS resolution returned no addresses for {}:{}", target_host, target_port);
                return;
            }
        },
        Err(e) => {
            eprintln!("DNS resolution error for {}:{}: {}", target_host, target_port, e);
            return;
        }
    };

    // Create ephemeral UDP socket
    let udp = match UdpSocket::bind("0.0.0.0:0").await {
        Ok(s) => Arc::new(s),
        Err(e) => {
            eprintln!("UDP bind error: {}", e);
            return;
        }
    };

    let (ws_sink, ws_stream) = ws_stream.split();
    let ws_sink = Arc::new(Mutex::new(ws_sink));

    // WS → UDP
    let udp_ws = udp.clone();
    let mut ws_to_udp = tokio::spawn(async move {
        let mut stream = ws_stream;
        while let Some(msg_result) = stream.next().await {
            match msg_result {
                Ok(Message::Binary(data)) => {
                    if let Err(e) = udp_ws.send_to(&data, target_addr).await {
                        eprintln!("UDP send error: {}", e);
                    }
                }
                Ok(Message::Text(text)) => {
                    if let Err(e) = udp_ws.send_to(text.as_bytes(), target_addr).await {
                        eprintln!("UDP send error: {}", e);
                    }
                }
                Ok(Message::Close(_)) => break,
                Err(e) => {
                    eprintln!("WS read error: {}", e);
                    break;
                }
                _ => {} // Ping/Pong handled by tungstenite
            }
        }
    });

    // UDP → WS
    let udp_rx = udp.clone();
    let ws_sink_tx = ws_sink.clone();
    let mut udp_to_ws = tokio::spawn(async move {
        let mut buf = vec![0u8; 65535];
        loop {
            match udp_rx.recv_from(&mut buf).await {
                Ok((len, _addr)) => {
                    let data = buf[..len].to_vec();
                    let mut sink = ws_sink_tx.lock().await;
                    if sink.send(Message::Binary(data.into())).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("UDP recv error: {}", e);
                    break;
                }
            }
        }
    });

    // Wait for either task to finish, then abort the other
    tokio::select! {
        _ = &mut ws_to_udp => {
            udp_to_ws.abort();
        }
        _ = &mut udp_to_ws => {
            ws_to_udp.abort();
        }
    }
    // UDP socket is dropped here via Arc refcount
}

fn parse_target_from_uri(uri: &str, default_host: &str, default_port: u16) -> (String, u16) {
    // URI looks like "/?host=127.0.0.1&port=19710" or "/some/path?host=...&port=..."
    let fake_base = format!("http://localhost{}", uri);
    if let Ok(parsed) = url::Url::parse(&fake_base) {
        let host = parsed
            .query_pairs()
            .find(|(k, _)| k == "host")
            .map(|(_, v)| v.to_string())
            .unwrap_or_else(|| default_host.to_string());
        let port = parsed
            .query_pairs()
            .find(|(k, _)| k == "port")
            .and_then(|(_, v)| v.parse().ok())
            .unwrap_or(default_port);
        (host, port)
    } else {
        (default_host.to_string(), default_port)
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    let config = Config::from_env();

    // Startup banner — must flush because stdout may be piped (block-buffered)
    {
        let stdout = std::io::stdout();
        let mut out = stdout.lock();
        let _ = writeln!(out, "WS<->UDP proxy on ws://0.0.0.0:{}/", config.ws_port);
        let _ = writeln!(out, "Default target: {}:{}", config.target_host, config.target_port);
        let _ = writeln!(out, "USE_URL_PARAMS = {}", config.use_url_params);
        let _ = out.flush();
    }

    let listener = match TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], config.ws_port))).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind TCP listener on port {}: {}", config.ws_port, e);
            std::process::exit(1);
        }
    };

    // Heartbeat (only in default mode)
    if !config.use_url_params {
        let hb_config = config.clone();
        tokio::spawn(heartbeat_loop(hb_config));
    }

    // Accept loop with SIGTERM handling
    #[cfg(unix)]
    let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("failed to register SIGTERM handler");

    loop {
        #[cfg(unix)]
        tokio::select! {
            result = listener.accept() => {
                match result {
                    Ok((stream, _addr)) => {
                        let conn_config = config.clone();
                        tokio::spawn(handle_connection(stream, conn_config));
                    }
                    Err(e) => {
                        eprintln!("TCP accept error: {}", e);
                    }
                }
            }
            _ = sigterm.recv() => {
                break;
            }
        }

        #[cfg(not(unix))]
        {
            match listener.accept().await {
                Ok((stream, _addr)) => {
                    let conn_config = config.clone();
                    tokio::spawn(handle_connection(stream, conn_config));
                }
                Err(e) => {
                    eprintln!("TCP accept error: {}", e);
                }
            }
        }
    }
}
