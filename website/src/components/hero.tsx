export function Hero() {
    return (
        <section className="container mx-auto px-4 py-12">
            <div className="space-y-6">
                <div className="space-y-2">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
                        Play Quake 3 Promode in your browser
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Quake 3 promode is the most fluid and highest-skill-ceiling first person shooter game ever made. It's also very fun.
                    </p>
                </div>
                <div className="aspect-video w-full max-w-3xl">
                    <iframe
                        className="w-full h-full rounded-lg"
                        src="https://www.youtube.com/embed/q76UNcuKSVY"
                        title="Quake 3 Promode"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
                <p className="text-lg text-muted-foreground">
                    Pick a server and go...
                </p>
            </div>
        </section>
    );
}
