import {Link} from "@tanstack/react-router";
import {Badge} from "@/components/ui/badge.tsx";

export function Header() {
    return <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to={"/"} className="flex items-center gap-3">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">Q3 Promode<span className="text-primary">.js</span></h1>
                </div>
            </Link>

            <div className="flex gap-2 items-center">
                <Badge variant="outline" className="hidden sm:flex gap-1.5 border-primary/30 text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse"/>
                    Online
                </Badge>
                <a href={"https://discord.gg/mKvM9su443"}>
                    <Badge variant="outline"
                           className="border-muted-foreground/30 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
                        Join Discord
                    </Badge>
                </a>
            </div>

        </div>
    </header>;
}