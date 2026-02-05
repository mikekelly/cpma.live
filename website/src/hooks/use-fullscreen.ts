import {useEffect} from "react";

export function useFullscreenOnF11() {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F11") {
                e.preventDefault();
                const el = document.documentElement;
                if (!document.fullscreenElement) {
                    el.requestFullscreen().then(() => {
                        // Lock keyboard to capture ESC
                        if ("keyboard" in navigator && "lock" in (navigator.keyboard as any)) {
                            (navigator.keyboard as any).lock(["Escape"]).catch(() => {
                                // Keyboard lock not supported or failed
                            });
                        }
                    }).catch(() => {});
                } else {
                    if ("keyboard" in navigator && "unlock" in (navigator.keyboard as any)) {
                        (navigator.keyboard as any).unlock();
                    }
                    document.exitFullscreen().catch(() => {});
                }
            }
        };

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                // Exited fullscreen, unlock keyboard
                if ("keyboard" in navigator && "unlock" in (navigator.keyboard as any)) {
                    (navigator.keyboard as any).unlock();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);
}
