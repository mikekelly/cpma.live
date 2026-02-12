import {useLocalStorage} from "@uidotdev/usehooks";
import {Input} from "@/components/ui/input.tsx";

export function PlayerConfig() {
    const [name, setName] = useLocalStorage("name", "Q3JS Player")
    const [config, setConfig] = useLocalStorage("q3config", "seta cg_fov 110")

    return (
        <div className="space-y-4">
            <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Player Name</label>
                <Input
                    placeholder="Enter your player name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>
            <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Config</label>
                <textarea
                    placeholder={"seta cg_fov 110\nbind mouse2 +zoom"}
                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y min-h-[80px] font-mono"
                    rows={4}
                    value={config}
                    onChange={(e) => setConfig(e.target.value)}
                />
            </div>
        </div>
    );
}
