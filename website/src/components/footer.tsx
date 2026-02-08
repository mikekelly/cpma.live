import {SiGithub} from "react-icons/si";

export function Footer() {
    return (
        <footer className="container mx-auto px-4 py-16 mt-12 border-t border-border/50">
            <div className="max-w-3xl mx-auto space-y-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                    <a
                        href="https://github.com/mikekelly/q3promode.js"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                    >
                        <SiGithub className="w-5 h-5"/>
                        <span>View on GitHub</span>
                    </a>
                </div>

                <div className="space-y-4 text-xs leading-relaxed">
                    <p>
                        <strong className="text-foreground">cpma.live</strong> is a non-commercial fan project
                        that lets you play CPMA (Challenge ProMode Arena) in your browser. It is a fork of{" "}
                        <a href="https://q3js.com" className="text-primary hover:underline">
                            q3js.com
                        </a>
                        . It is not affiliated with or endorsed by id Software, ZeniMax Media, or the CPMA team.
                    </p>

                    <p>
                        Only the officially released Quake III Arena <span className="font-semibold">demo data files</span> are
                        used. No full retail game assets are hosted, included, or required.
                    </p>

                    <p>
                        The engine is based on{" "}
                        <a href="https://github.com/ioquake/ioq3" className="text-primary hover:underline">
                            ioquake3
                        </a>
                        , an open-source project licensed under GPLv2. CPMA is used under the terms provided by
                        the CPMA team at{" "}
                        <a href="https://playmorepromode.com" className="text-primary hover:underline">
                            playmorepromode.com
                        </a>
                        .
                    </p>

                    <p className="text-muted-foreground/70">
                        "Quake III Arena" and related trademarks are the property of their respective owners.
                    </p>
                </div>
            </div>
        </footer>
    );
}
