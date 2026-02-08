import {useEffect, useState} from "react";
import {Card} from "@/components/ui/card";
import {Progress} from "@/components/ui/progress";
import {useSearch} from "@tanstack/react-router";
import {makeRafUpdater, type Prog} from "@/lib/fs.ts";
import {useFullscreenOnF11} from "@/hooks/use-fullscreen.ts";
import startGame from "@/game";

export default function GamePage() {
    useFullscreenOnF11();

    const [prog, setProg] = useState<Prog>({received: 0, total: 0, pct: 0, current: ""});
    const rafUpdate = makeRafUpdater(setProg);

    const {host, proxyPort, targetPort, name, config} = useSearch({
        from: "/game"
    })

    useEffect(() => {
        startGame({
            name,
            host,
            proxyPort,
            targetPort,
            config,
            rafUpdate
        })
    }, []);

    return (
        <div className="relative w-full h-full min-h-screen">
            <canvas id="canvas" className="w-full h-full"/>
            {prog.pct < 100 && (
                <Card
                    className="absolute bottom-4 left-4 right-4 p-4 bg-background/80 backdrop-blur border border-border">
                    {prog.pct === -1 ? (
                        <div className="text-sm text-red-400 font-mono">
                            {prog.current}
                        </div>
                    ) : (
                        <>
                            <div className="text-xs text-muted-foreground mb-2 font-mono">
                                {prog.current ? `Downloading: ${prog.current}` : "Preparing downloads"}
                            </div>
                            <Progress value={prog.pct} className="h-2 bg-secondary"/>
                            <div className="text-xs text-muted-foreground mt-2 font-mono">
                                {prog.total
                                    ? `${(prog.received / (1024 * 1024)).toFixed(1)} MB / ${(prog.total / (1024 * 1024)).toFixed(1)} MB`
                                    : `${prog.pct}%`}
                            </div>
                        </>
                    )}
                </Card>
            )}
        </div>
    );
}
