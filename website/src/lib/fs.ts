export type Prog = { received: number; total: number; pct: number; current?: string };

// Persistent data versioning
const DATA_VERSION = "v1";
const VERSION_KEY = "ioq3-data-version";

// Sync helper
export function syncfs(module: any, populate: boolean) {
    return new Promise<void>((resolve, reject) => {
        try {
            module.FS.syncfs(populate, (err: any) => (err ? reject(err) : resolve()));
        } catch (e) {
            reject(e);
        }
    });
}

// Resolve IDBFS across different Emscripten variants
export function resolveIDBFS(module: any) {
    if (module?.FS?.filesystems?.IDBFS) return module.FS.filesystems.IDBFS;
    if (module?.IDBFS) return module.IDBFS;
    // @ts-ignore
    if ((globalThis as any).IDBFS) return (globalThis as any).IDBFS;
    return null;
}

export async function ensureMounts(module: any): Promise<{ persist: boolean }> {
    const {FS} = module;
    const mountPoints = ["/baseq3", "/cpma"];

    for (const mp of mountPoints) {
        FS.mkdirTree(mp);
    }

    const IDBFS = resolveIDBFS(module);
    if (!IDBFS) {
        console.warn("[ioq3] IDBFS not linked. Running without persistence.");
        return {persist: false};
    }

    for (const mp of mountPoints) {
        try {
            FS.mount(IDBFS, {}, mp);
        } catch {
            // already mounted
        }
    }

    const current = localStorage.getItem(VERSION_KEY);
    if (current !== DATA_VERSION) {
        try {
            await syncfs(module, true);
            for (const mp of mountPoints) {
                for (const e of FS.readdir(mp)) {
                    if (e === "." || e === "..") continue;
                    const p = `${mp}/${e}`;
                    try {
                        const stat = FS.stat(p);
                        if ((stat.mode & 0o40000) === 0o40000) {
                            try {
                                for (const c of FS.readdir(p)) {
                                    if (c === "." || c === "..") continue;
                                    try {
                                        FS.unlink(`${p}/${c}`);
                                    } catch {
                                    }
                                }
                                FS.rmdir(p);
                            } catch {
                            }
                        } else {
                            FS.unlink(p);
                        }
                    } catch {
                    }
                }
            }
            await syncfs(module, false);
            localStorage.setItem(VERSION_KEY, DATA_VERSION);
        } catch (e) {
            console.warn("[ioq3] Version reset failed:", e);
        }
    }

    await syncfs(module, true);
    return {persist: true};
}

// rAF-throttled progress updater
export function makeRafUpdater(setter: (p: Prog) => void) {
    let scheduled = false;
    let last: Prog | null = null;
    return (v: Prog) => {
        last = v;
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            if (last) setter(last);
            scheduled = false;
        });
    };
}

// Read from a stream with a timeout to detect stalled downloads
async function readWithTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Download stalled (no data received for 30s)")), timeoutMs);
    });
    try {
        return await Promise.race([reader.read(), timeout]);
    } finally {
        clearTimeout(timer!);
    }
}

// Fetch into a single preallocated Uint8Array using Content-Length from GET response
export async function fetchIntoUint8(url: URL, onChunk: (n: number) => void) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);

    const cl = resp.headers.get("content-length");
    const expected = cl ? parseInt(cl, 10) : undefined;

    if (expected && resp.body) {
        const out = new Uint8Array(expected);
        const reader = resp.body.getReader();
        let off = 0;
        for (; ;) {
            const {done, value} = await readWithTimeout(reader, 30_000);
            if (done) break;
            out.set(value!, off);
            off += value!.length;
            onChunk(value!.length);
        }
        return off === expected ? out : out.subarray(0, off);
    }

    // Fallback: single allocation
    const buf = new Uint8Array(await resp.arrayBuffer());
    onChunk(buf.byteLength);
    return buf;
}

export async function estimateTotalBytes(fileUrls: URL[]) {
    let total = 0;
    await Promise.all(
        fileUrls.map(async (u) => {
            try {
                const r = await fetch(u, {method: "HEAD"});
                const cl = r.headers.get("content-length");
                if (cl) total += parseInt(cl, 10);
            } catch {
            }
        })
    );
    return total;
}