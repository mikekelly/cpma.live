import type {Q3ResolvedServer} from "@/lib/q3.ts";
import {Button} from "@/components/ui/button.tsx";
import {Zap} from "lucide-react";
import {env} from "@/env.ts";

export function JoinServerButton(props: {
    server: Q3ResolvedServer,
}) {
    const baseUrl = env.VITE_GAME_URL ? env.VITE_GAME_URL : "";

    function getGameUrl() {
        const name = JSON.parse(localStorage.getItem("name") || '"Q3JS Player"');
        const config = JSON.parse(localStorage.getItem("q3config") || '""');
        return `${baseUrl}/game?host=${props.server.host}&proxyPort=${props.server.proxyPort}&name=${encodeURIComponent(name)}&config=${encodeURIComponent(config)}`;
    }

    if (props.server.players >= props.server.sv_maxclients) {
        return (
            <Button
                size="lg"
                className="lg:w-auto w-full bg-primary text-primary-foreground font-bold"
                disabled
            >
                Server Full
            </Button>
        );
    }

    return (
        <a href={getGameUrl()}>
            <Button
                size="lg"
                className="lg:w-auto w-full bg-primary text-primary-foreground font-bold"
            >
                <Zap className="h-4 w-4 mr-2"/>Connect
            </Button>
        </a>
    );
}
