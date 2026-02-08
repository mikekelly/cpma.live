# Add TLS Support to Rust Proxy with Let's Encrypt

## Context

The website is now on Cloudflare Pages (HTTPS), so browsers require `wss://` for WebSocket connections. The Rust proxy currently only speaks plain `ws://`. Rather than adding a Cloudflare proxy hop (which adds latency to game traffic), we add native TLS support using Let's Encrypt certs.

Also: decouple heartbeat from `USE_URL_PARAMS` (same fix already applied to the Node version).

## Files Modified

### `proxy/Cargo.toml`
Add dependencies:
- `tokio-rustls` — async TLS acceptor
- `rustls-pemfile` — parse PEM cert/key files
- `notify` (or just re-read on interval) — pick up cert renewals

### `proxy/src/main.rs`

1. **New env vars:**
   - `TLS_CERT` — path to fullchain.pem (default: `/etc/letsencrypt/live/proxy.cpma.live/fullchain.pem`)
   - `TLS_KEY` — path to privkey.pem (default: `/etc/letsencrypt/live/proxy.cpma.live/privkey.pem`)
   - `SEND_HEARTBEAT` — `"true"` (default) / `"false"`, decoupled from `USE_URL_PARAMS`

2. **TLS acceptor:** Build a `tokio_rustls::TlsAcceptor` from the cert+key files at startup. In the accept loop, wrap each `TcpStream` with `acceptor.accept(stream).await` before passing to `handle_connection`.

3. **Graceful fallback:** If `TLS_CERT`/`TLS_KEY` are not set or files don't exist, run in plain `ws://` mode (for local dev). Print which mode at startup.

4. **Heartbeat:** Change guard from `if !config.use_url_params` to `if config.send_heartbeat`.

5. **`handle_connection` signature:** Change to accept `impl AsyncRead + AsyncWrite + Unpin` instead of `TcpStream` directly, so it works with both plain and TLS streams.

## VPS Setup (one-time)

```bash
# Install certbot
apt install -y certbot

# Get cert (proxy.cpma.live DNS must already resolve to VPS)
certbot certonly --standalone -d proxy.cpma.live --non-interactive --agree-tos -m <email>

# Auto-renewal is set up by certbot automatically
```

## VPS Deployment

Run the Rust proxy directly on the host (not in Docker). This avoids cert mount issues and is simpler overall.

1. Cross-compile or build on VPS: `cargo build --release --target x86_64-unknown-linux-gnu`
2. scp `target/x86_64-unknown-linux-gnu/release/proxy` to VPS at `/opt/q3promode/proxy/proxy`
3. Create a systemd unit (`/etc/systemd/system/q3proxy.service`) with env vars:
   - `USE_URL_PARAMS=true`
   - `SEND_HEARTBEAT=true`
   - `TLS_CERT=/etc/letsencrypt/live/proxy.cpma.live/fullchain.pem`
   - `TLS_KEY=/etc/letsencrypt/live/proxy.cpma.live/privkey.pem`
4. Remove the `node ../proxy/index.js &` line from the Docker entrypoint (proxy no longer runs inside the container)
5. `systemctl enable --now q3proxy`

## Verification

1. `cargo build` compiles
2. `node --test proxy.test.js` — existing tests still pass (plain WS mode, no TLS env vars)
3. On VPS: `curl -v https://proxy.cpma.live:27961/` should complete TLS handshake
4. Website connects via `wss://proxy.cpma.live:27961/?host=127.0.0.1&port=27960`
