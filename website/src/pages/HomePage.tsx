import {ServerPicker} from "@/components/server-picker"
import {Hero} from "@/components/hero.tsx";
import {Suspense} from "react";
import ServerPickerSkeleton from "@/components/server-picker-skeleton.tsx";
import {ErrorBoundary} from 'react-error-boundary'

export default function HomePage() {
    return (
        <>
            <Hero/>

            <ErrorBoundary fallback={<h1>Something went wrong loading the server list.</h1>}>
                <Suspense fallback={<ServerPickerSkeleton/>}>
                    <ServerPicker/>
                </Suspense>
            </ErrorBoundary>
        </>
    )
}
