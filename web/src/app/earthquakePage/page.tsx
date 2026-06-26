import { Suspense } from 'react';
import EarthquakePage from "@/components/Earthquake"

export default function DisasterPage(){
    return (
        <Suspense fallback={<p>Loading earthquake data...</p>}>
            <EarthquakePage />
        </Suspense>
    )
}