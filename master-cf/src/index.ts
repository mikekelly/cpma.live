import { DurableObject } from "cloudflare:workers";

interface Env {
  MASTER: DurableObjectNamespace<MasterServer>;
}

interface Server {
  host: string;
  proxyPort: number;
  targetPort: number;
  lastHeartbeat: number;
}

const ALLOWED_ORIGINS = ["https://cpma.live", "http://localhost:3000", "https://master.cpma.live"];
const TTL_MS = 15_000;
const ALARM_INTERVAL_MS = 5_000;

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, PUT, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return headers;
}

export class MasterServer extends DurableObject<Env> {
  private servers: Map<string, Server> = new Map();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/api/servers" && request.method === "GET") {
      const list = Array.from(this.servers.values())
        .sort((a, b) => a.host.localeCompare(b.host));
      return Response.json(list, { headers: cors });
    }

    if (url.pathname === "/api/servers/heartbeat" && request.method === "PUT") {
      const ip = request.headers.get("CF-Connecting-IP");
      if (!ip) {
        return new Response("Missing IP", { status: 400, headers: cors });
      }

      const body = await request.json<{ proxyPort: number; targetPort: number }>();
      const key = `${ip}:${body.proxyPort}`;

      this.servers.set(key, {
        host: ip,
        proxyPort: body.proxyPort,
        targetPort: body.targetPort,
        lastHeartbeat: Date.now(),
      });

      // ensure alarm is running
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (!currentAlarm) {
        await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
      }

      return new Response(null, { status: 204, headers: cors });
    }

    return new Response("Not Found", { status: 404, headers: cors });
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    for (const [key, server] of this.servers) {
      if (now - server.lastHeartbeat > TTL_MS) {
        this.servers.delete(key);
      }
    }

    if (this.servers.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.MASTER.idFromName("master");
    const stub = env.MASTER.get(id);
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
