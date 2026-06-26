import { Suspense } from "react"
import CyclonePage from "@/components/Cyclones"

export default function DisasterPage(){
    return (
        <Suspense fallback={<p>Loading cyclone data...</p>}>
            <CyclonePage />
        </Suspense>
    )
}