
import type { LoadScriptProps } from '@react-google-maps/api';

export const GOOGLE_MAPS_CONFIG: LoadScriptProps = {
    id: "google-map-script", // Pick one ID and use everywhere
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    version: "weekly",
    language: "en",
    region: "US",
    libraries: ["places", "visualization"] as ("places" | "visualization")[], // Add all needed ones here
  };
  