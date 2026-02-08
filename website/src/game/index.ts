// @ts-ignore
import ioquake3 from "@/lib/ioquake3.js";
import wasm from "@/lib/ioquake3.wasm?url"
import {getWsProtocol} from "@/lib/utils.ts";
import {ensureMounts, estimateTotalBytes, fetchIntoUint8, type Prog, syncfs} from "@/lib/fs.ts";
import {env} from "@/env.ts";

type Params = {
    host: string;
    targetPort: number;
    name: string;
    config?: string;
    rafUpdate: (prog: Prog) => void;
}


const config = {
    baseq3: {
        files: [
            {src: "baseq3/pak0.pk3", dst: "/baseq3"},
            {src: "baseq3/pak1.pk3", dst: "/baseq3"},
            {src: "baseq3/pak2.pk3", dst: "/baseq3"},
            {src: "baseq3/pak3.pk3", dst: "/baseq3"},
            {src: "baseq3/pak4.pk3", dst: "/baseq3"},
            {src: "baseq3/pak5.pk3", dst: "/baseq3"},
            {src: "baseq3/pak6.pk3", dst: "/baseq3"},
            {src: "baseq3/pak7.pk3", dst: "/baseq3"},
            {src: "baseq3/pak8.pk3", dst: "/baseq3"},
            {src: "baseq3/xcsv_bq3hi-res.pk3", dst: "/baseq3"},
            {src: "baseq3/quake3-live-sounds.pk3", dst: "/baseq3"},
            {src: "baseq3/zpack-weapons.pk3", dst: "/baseq3"},
        ],
    },
    cpma: {
        files: [
            {src: "cpma/z-cpma-pak153.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm1a.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm2.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm3.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm3a.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm4.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm4a.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm5.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm6.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm7.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm8.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm9.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm10.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm11.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm11a.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm12.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm13.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm14.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm15.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm16.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm17.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm18.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm18r.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm19.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm20.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm21.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm22.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm23.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm24.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm25.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm26_cpmctf4.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm27.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm28.pk3", dst: "/cpma"},
            {src: "cpma/map_cpm29.pk3", dst: "/cpma"},
            {src: "cpma/map_cpma3.pk3", dst: "/cpma"},
            {src: "cpma/map_cpmctf1.pk3", dst: "/cpma"},
            {src: "cpma/map_cpmctf2.pk3", dst: "/cpma"},
            {src: "cpma/map_cpmctf3.pk3", dst: "/cpma"},
            {src: "cpma/map_cpmctf5.pk3", dst: "/cpma"},
            {src: "cpma/b0_beta6.pk3", dst: "/cpma"},
            {src: "cpma/hektik_b3.pk3", dst: "/cpma"},
            {src: "cpma/tr1ckhouse-beta3.pk3", dst: "/cpma"},
            {src: "cpma/cos1_beta7b.pk3", dst: "/cpma"},
            {src: "cpma/xcm_tricks2.pk3", dst: "/cpma"},
            {src: "cpma/hangtime-df.pk3", dst: "/cpma"},
            {src: "cpma/hangtime2-df.pk3", dst: "/cpma"},
            {src: "cpma/ump1.pk3", dst: "/cpma"},
            {src: "cpma/ump3.pk3", dst: "/cpma"},
        ],
    },
} as const;

export default function startGame({host, targetPort, name, config: extraConfig, rafUpdate}: Params) {
    const com_basegame = "baseq3" as const;
    const fs_basegame = "baseq3" as const;
    const fs_game = "cpma" as const;

    let generatedArguments = `
          +set sv_pure 0
          +set net_enabled 1
          +set r_mode -2
          +set com_basegame "${com_basegame}"
          +set fs_basegame "${fs_basegame}"
          +set cl_allowDownload 1
          +set con_scale 2
          +set fs_game "${fs_game}"
          +set cg_forceModel 1
          +set cg_enemyModel sarge
          +set cg_teamModel sarge
          +set model sarge
          +set headmodel sarge
        `;
    generatedArguments += ` +connect ${env.VITE_PROXY_URL} `;
    generatedArguments += ` +set name "${name.replace(/"/g, "'")}" `;

    if (name === "^1L^2K") {
        generatedArguments += ` +set cg_autoswitch "0" +bind 3 "weapon 7" +bind e "+zoom" `;
    }

    const dataURL = new URL(env.VITE_ASSETS_URL ?? location.origin);

    ioquake3({
        websocket: {
            url: `${getWsProtocol()}//${env.VITE_PROXY_URL}?host=${host}&port=${targetPort}`,
            subprotocol: "binary"
        },
        canvas: document.getElementById("canvas") as HTMLCanvasElement,
        arguments: generatedArguments.trim().split(/\s+/),
        locateFile: (path: string) => {
            if (path.endsWith(".wasm")) return wasm;
        },
        preRun: [
            async (module: any) => {
                module.addRunDependency("setup-ioq3-filesystem");
                try {
                    const {persist} = await ensureMounts(module);

                    const gameDirs = [...new Set([com_basegame, fs_basegame, fs_game])];
                    const fileEntries = gameDirs.flatMap((g) => (config as any)[g].files);
                    const urls = fileEntries.map((f: { src: string }) => new URL(f.src, dataURL));

                    const totalBytes = await estimateTotalBytes(urls);
                    let receivedBytes = 0;

                    for (let i = 0; i < fileEntries.length; i++) {
                        const f = fileEntries[i];
                        const url = urls[i];
                        const name = f.src.split("/").pop() as string;
                        const dstPath = `${f.dst}/${name}`;

                        const exists = (() => {
                            try {
                                const st = module.FS.stat(dstPath);
                                return st && st.size > 0;
                            } catch {
                                return false;
                            }
                        })();

                        rafUpdate({
                            received: receivedBytes,
                            total: totalBytes,
                            pct: totalBytes ? Math.floor((receivedBytes / totalBytes) * 100) : 0,
                            current: f.src
                        });

                        if (!exists) {
                            let fileBytes = 0;
                            let lastError: unknown;

                            for (let attempt = 0; attempt < 3; attempt++) {
                                try {
                                    // Reset this file's progress on retry
                                    receivedBytes -= fileBytes;
                                    fileBytes = 0;

                                    const data = await fetchIntoUint8(url, (n) => {
                                        receivedBytes += n;
                                        fileBytes += n;
                                        const pct = totalBytes ? Math.min(100, Math.floor((receivedBytes / totalBytes) * 100)) : 0;
                                        rafUpdate({received: receivedBytes, total: totalBytes, pct, current: f.src});
                                    });

                                    module.FS.mkdirTree(f.dst);
                                    module.FS.writeFile(dstPath, data);
                                    lastError = null;
                                    break;
                                } catch (e) {
                                    lastError = e;
                                    console.warn(`[ioq3] Download attempt ${attempt + 1}/3 failed for ${f.src}:`, e);
                                    if (attempt < 2) {
                                        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                                    }
                                }
                            }

                            if (lastError) throw lastError;
                        }
                    }

                    // Write a placeholder CD key to bypass the demo CD key check
                    module.FS.mkdirTree("/baseq3");
                    module.FS.writeFile("/baseq3/q3key", "AAAABBBBCCCCDDDD");

                    // Write user config as autoexec.cfg (auto-executed by the engine after q3config.cfg)
                    module.FS.writeFile(`/${fs_game}/autoexec.cfg`, extraConfig ?? "");

                    if (persist) {
                        await syncfs(module, false);
                    }
                    rafUpdate({received: totalBytes, total: totalBytes, pct: 100, current: "done"});

                    // Only start the engine after ALL downloads succeed
                    module.removeRunDependency("setup-ioq3-filesystem");
                } catch (e) {
                    console.error("[ioq3] Asset download failed:", e);
                    rafUpdate({
                        received: 0,
                        total: 0,
                        pct: -1,
                        current: `Download failed: ${e instanceof Error ? e.message : String(e)}. Refresh to retry.`
                    });
                    // Do NOT remove the dependency - keep the engine blocked
                }
            },
        ],
    });
}