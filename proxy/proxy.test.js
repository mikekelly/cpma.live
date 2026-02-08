const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const dgram = require('node:dgram');
const http = require('node:http');
const WebSocket = require('ws');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for a condition with timeout */
function waitFor(fn, ms = 3000, interval = 50) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + ms;
    const check = () => {
      if (fn()) return resolve();
      if (Date.now() > deadline) return reject(new Error('waitFor timed out'));
      setTimeout(check, interval);
    };
    check();
  });
}

/** Collect a WebSocket message into a Buffer */
function wsRecv(ws, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('wsRecv timed out')), ms);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(Buffer.isBuffer(data) ? data : Buffer.from(data));
    });
  });
}

/** Wait for the next UDP message on a socket: resolves {msg, rinfo} */
function udpRecv(sock, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('udpRecv timed out')), ms);
    sock.once('message', (msg, rinfo) => {
      clearTimeout(timer);
      resolve({ msg, rinfo });
    });
  });
}

/** Open a WS connection and wait for it to be ready */
function wsConnect(port, path = '/') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

/**
 * Create a UDP socket bound to a given port on localhost.
 * Acts as a mock game server — records every message it receives.
 */
function createMockGameServer(port) {
  const sock = dgram.createSocket('udp4');
  const received = [];

  sock.on('message', (msg, rinfo) => {
    received.push({ msg, rinfo });
  });

  return new Promise((resolve, reject) => {
    sock.bind(port, '127.0.0.1', (err) => {
      if (err) return reject(err);
      resolve({ sock, received });
    });
  });
}

/**
 * Spawn the proxy as a child process.
 * Returns { proc, kill() } — resolved once the proxy prints its ready line.
 */
function startProxy(env) {
  return new Promise((resolve, reject) => {
    const proc = spawn('./target/debug/proxy', [], {
      cwd: __dirname,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let ready = false;
    proc.stdout.on('data', (chunk) => {
      if (!ready && chunk.toString().includes('WS<->UDP proxy')) {
        ready = true;
        resolve({
          proc,
          kill: () => new Promise((r) => {
            proc.once('exit', r);
            proc.kill('SIGTERM');
          }),
        });
      }
    });

    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (!ready) reject(new Error(`proxy exited early (code ${code})`));
    });
  });
}

/**
 * Create a tiny HTTP server that records incoming requests.
 * Used to mock the master server and verify heartbeat behaviour.
 */
function createMockMasterServer(port) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    requests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: Buffer.concat(chunks).toString(),
    });
    res.writeHead(204).end();
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', (err) => {
      if (err) return reject(err);
      resolve({
        server,
        requests,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Pick ephemeral ports to avoid collisions
// ---------------------------------------------------------------------------
const GAME_PORT   = 19700;
const PROXY_PORT  = 19701;
const MASTER_PORT = 19702;

// ---------------------------------------------------------------------------
// Tests — default mode (env-based target, heartbeat enabled)
// ---------------------------------------------------------------------------
describe('proxy (default mode — env target, heartbeat on)', () => {
  let proxy, gameServer, masterServer;

  before(async () => {
    [gameServer, masterServer] = await Promise.all([
      createMockGameServer(GAME_PORT),
      createMockMasterServer(MASTER_PORT),
    ]);

    proxy = await startProxy({
      WS_PORT: String(PROXY_PORT),
      TARGET_HOST: '127.0.0.1',
      TARGET_PORT: String(GAME_PORT),
      MASTER_SERVER_BASE: `http://127.0.0.1:${MASTER_PORT}`,
      USE_URL_PARAMS: 'false',
    });
  });

  after(async () => {
    await proxy.kill();
    gameServer.sock.close();
    await masterServer.close();
  });

  // -- Client → Server -----------------------------------------------------

  it('delivers a WS message to the game server as a UDP packet', async () => {
    const ws = await wsConnect(PROXY_PORT);
    const pending = udpRecv(gameServer.sock);

    const payload = Buffer.from('hello server');
    ws.send(payload);

    const { msg } = await pending;
    assert.deepStrictEqual(msg, payload);
    ws.close();
  });

  it('preserves binary fidelity for arbitrary bytes', async () => {
    const ws = await wsConnect(PROXY_PORT);
    const pending = udpRecv(gameServer.sock);

    // 256 bytes covering every byte value
    const payload = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) payload[i] = i;
    ws.send(payload);

    const { msg } = await pending;
    assert.deepStrictEqual(msg, payload);
    ws.close();
  });

  // -- Server → Client -----------------------------------------------------

  it('delivers a UDP response back to the WS client', async () => {
    const ws = await wsConnect(PROXY_PORT);

    // send something first so the game server knows where to reply
    const outgoing = udpRecv(gameServer.sock);
    ws.send(Buffer.from('ping'));
    const { rinfo } = await outgoing;

    // game server replies to the proxy's ephemeral UDP port
    const reply = Buffer.from('pong');
    const wsMsg = wsRecv(ws);
    gameServer.sock.send(reply, rinfo.port, rinfo.address);

    const received = await wsMsg;
    assert.deepStrictEqual(received, reply);
    ws.close();
  });

  // -- Round-trip -----------------------------------------------------------

  it('supports a full round-trip exchange', async () => {
    const ws = await wsConnect(PROXY_PORT);

    // client → server
    const udpPending = udpRecv(gameServer.sock);
    ws.send(Buffer.from('request'));
    const { msg: req, rinfo } = await udpPending;
    assert.deepStrictEqual(req, Buffer.from('request'));

    // server → client
    const wsPending = wsRecv(ws);
    gameServer.sock.send(Buffer.from('response'), rinfo.port, rinfo.address);
    const res = await wsPending;
    assert.deepStrictEqual(res, Buffer.from('response'));

    ws.close();
  });

  // -- Multiple clients -----------------------------------------------------

  it('gives each WS client an independent UDP socket', async () => {
    const ws1 = await wsConnect(PROXY_PORT);
    const ws2 = await wsConnect(PROXY_PORT);

    // client 1 sends
    const udp1 = udpRecv(gameServer.sock);
    ws1.send(Buffer.from('c1'));
    const { rinfo: r1 } = await udp1;

    // client 2 sends
    const udp2 = udpRecv(gameServer.sock);
    ws2.send(Buffer.from('c2'));
    const { rinfo: r2 } = await udp2;

    // different source ports prove separate UDP sockets
    assert.notStrictEqual(r1.port, r2.port);

    // replies go to the correct client
    const p1 = wsRecv(ws1);
    const p2 = wsRecv(ws2);
    gameServer.sock.send(Buffer.from('for-c1'), r1.port, r1.address);
    gameServer.sock.send(Buffer.from('for-c2'), r2.port, r2.address);

    assert.deepStrictEqual(await p1, Buffer.from('for-c1'));
    assert.deepStrictEqual(await p2, Buffer.from('for-c2'));

    ws1.close();
    ws2.close();
  });

  // -- Client disconnect ----------------------------------------------------

  it('closes the UDP socket when the WS client disconnects', async () => {
    const ws = await wsConnect(PROXY_PORT);

    // exchange one message so the UDP socket exists and we know its port
    const udpPending = udpRecv(gameServer.sock);
    ws.send(Buffer.from('hi'));
    const { rinfo } = await udpPending;

    // close WS and give the proxy a moment to clean up
    ws.close();
    await new Promise((r) => setTimeout(r, 200));

    // sending to the old port should NOT produce a WS message anywhere
    // (the UDP socket is closed, so the OS will send an ICMP port-unreachable
    //  or just drop it — either way nothing crashes)
    gameServer.sock.send(Buffer.from('orphan'), rinfo.port, rinfo.address);

    // no crash is the assertion; also verify new connections still work
    const ws2 = await wsConnect(PROXY_PORT);
    const udp2 = udpRecv(gameServer.sock);
    ws2.send(Buffer.from('still alive'));
    const { msg } = await udp2;
    assert.deepStrictEqual(msg, Buffer.from('still alive'));
    ws2.close();
  });

  // -- Heartbeat ------------------------------------------------------------

  it('sends a heartbeat to the master server on startup', async () => {
    // heartbeat fires immediately on startup; give it a moment
    await waitFor(() => masterServer.requests.length > 0, 3000);

    const hb = masterServer.requests.find(
      (r) => r.method === 'PUT' && r.url === '/api/servers/heartbeat'
    );
    assert.ok(hb, 'expected a PUT /api/servers/heartbeat');
    assert.strictEqual(hb.headers['content-type'], 'application/json');

    const body = JSON.parse(hb.body);
    assert.strictEqual(body.proxyPort, PROXY_PORT);
    assert.strictEqual(body.targetPort, GAME_PORT);
  });
});

// ---------------------------------------------------------------------------
// Tests — URL-params mode (target from query string, no heartbeat)
// ---------------------------------------------------------------------------
describe('proxy (USE_URL_PARAMS mode — query target, no heartbeat)', () => {
  const GAME_PORT_2   = 19710;
  const PROXY_PORT_2  = 19711;
  const MASTER_PORT_2 = 19712;

  let proxy, gameServer, masterServer;

  before(async () => {
    [gameServer, masterServer] = await Promise.all([
      createMockGameServer(GAME_PORT_2),
      createMockMasterServer(MASTER_PORT_2),
    ]);

    proxy = await startProxy({
      WS_PORT: String(PROXY_PORT_2),
      TARGET_HOST: '127.0.0.1',
      TARGET_PORT: '1',             // should be ignored — URL params override
      MASTER_SERVER_BASE: `http://127.0.0.1:${MASTER_PORT_2}`,
      USE_URL_PARAMS: 'true',
    });
  });

  after(async () => {
    await proxy.kill();
    gameServer.sock.close();
    await masterServer.close();
  });

  it('routes traffic to the host and port specified in the query string', async () => {
    const ws = await wsConnect(
      PROXY_PORT_2,
      `/?host=127.0.0.1&port=${GAME_PORT_2}`
    );

    // client → server
    const udpPending = udpRecv(gameServer.sock);
    ws.send(Buffer.from('url-param-test'));
    const { msg, rinfo } = await udpPending;
    assert.deepStrictEqual(msg, Buffer.from('url-param-test'));

    // server → client
    const wsPending = wsRecv(ws);
    gameServer.sock.send(Buffer.from('url-param-reply'), rinfo.port, rinfo.address);
    assert.deepStrictEqual(await wsPending, Buffer.from('url-param-reply'));

    ws.close();
  });

  it('does not send heartbeats when USE_URL_PARAMS is true', async () => {
    // wait a generous window — if heartbeat were on it fires immediately
    await new Promise((r) => setTimeout(r, 1500));
    assert.strictEqual(masterServer.requests.length, 0,
      'expected zero requests to mock master');
  });
});
