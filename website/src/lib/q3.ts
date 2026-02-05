import {q3FetchLines} from "@/lib/q3-util.ts";
import {stripQ3Colors, toInt} from "@/lib/utils.ts";

export type User = {
    score: number
    ping: number
    name: string
}

export interface Q3ResolvedServer {
    id: string
    sv_hostname: string
    mapname: string
    g_gametype: number
    fraglimit: number
    timelimit: number
    sv_maxclients: number
    g_needpass: number
    capturelimit: number
    version: string
    location?: string
    players: number
    ping?: number
    host: string
    port: number
    challenge?: string
    sv_maxPing?: number
    sv_minPing?: number
    com_gamename?: string
    com_protocol?: number
    dmflags?: number
    sv_privateClients?: number
    sv_minRate?: number
    sv_maxRate?: number
    sv_dlRate?: number
    sv_floodProtect?: number
    sv_allowDownload?: number
    bot_minplayers?: number
    gamename?: string
    g_maxGameClients?: number
    users: User[]
    proxyPort: number
}

export type Q3ServerTarget = {
    host: string
    proxyPort: number
    targetPort: number
}

export const GAME_TYPES: Record<number, string> = {
    0: "FFA",
    1: "Duel",
    2: "HoonyMode",
    3: "TDM",
    4: "CTF",
    5: "Clan Arena",
    6: "Freeze Tag",
    7: "Capture Strike",
    8: "NTF",
}


export async function q3GetInfo(server: Q3ServerTarget): Promise<Q3ResolvedServer | null> {
    const {lines, ping} = await q3FetchLines({
        server,
        command: "getstatus xxx\n"
    })

    const idx = lines.findIndex(l => l.includes("statusResponse"))
    if (idx === -1) return null

    const rulesLine = (lines[idx + 1] ?? "").trim()
    if (!rulesLine) return null

    const playerLines = lines
        .slice(idx + 2)
        .filter(l => l.trim().length > 0)

    const parts = rulesLine.split("\\")
    const kv: Record<string, string> = {}

    for (let i = 1; i + 1 < parts.length; i += 2) {
        kv[parts[i].toLowerCase()] = parts[i + 1] ?? ""
    }

    const users: User[] = []
    for (const line of playerLines) {
        const m = line.match(/^\s*(-?\d+)\s+(\d+)\s+"(.*)"\s*$/)
        if (!m) continue
        users.push({
            score: parseInt(m[1], 10),
            ping: parseInt(m[2], 10),
            name: stripQ3Colors(m[3])
        })
    }

    return {
        id: `${server.host}:${server.targetPort}`,
        sv_hostname: stripQ3Colors(
            kv["sv_hostname"] ?? kv["hostname"] ?? "Unnamed Server"
        ),
        mapname: kv["mapname"] ?? "unknown",
        g_gametype: toInt(kv["g_gametype"] ?? kv["gametype"] ?? "0"),
        fraglimit: toInt(kv["fraglimit"]),
        timelimit: toInt(kv["timelimit"]),
        sv_maxclients: toInt(kv["sv_maxclients"]),
        g_needpass: toInt(kv["g_needpass"]),
        capturelimit: toInt(kv["capturelimit"]),
        version: kv["version"] ?? kv["com_gamename"] ?? kv["gamename"] ?? "",
        players: users.length,
        ping,

        port: server.targetPort,

        challenge: kv["challenge"],
        sv_maxPing: toInt(kv["sv_maxping"]),
        sv_minPing: toInt(kv["sv_minping"]),
        com_gamename: kv["com_gamename"],
        com_protocol: toInt(kv["com_protocol"]),
        dmflags: toInt(kv["dmflags"]),
        sv_privateClients: toInt(kv["sv_privateclients"]),
        sv_minRate: toInt(kv["sv_minrate"]),
        sv_maxRate: toInt(kv["sv_maxrate"]),
        sv_dlRate: toInt(kv["sv_dlrate"]),
        sv_floodProtect: toInt(kv["sv_floodprotect"]),
        sv_allowDownload: toInt(kv["sv_allowdownload"]),
        bot_minplayers: toInt(kv["bot_minplayers"]),
        gamename: kv["gamename"],
        g_maxGameClients: toInt(kv["g_maxgameclients"]),

        host: server.host,
        proxyPort: server.proxyPort,

        users
    }
}