"use client";

import { useState, useEffect} from "react";
import {
  AlertTriangle,
  Clock,  
  Zap,
  Waves,
  CloudLightning,
  Compass,
  Ruler,
  Activity,
  MapPin,
} from "lucide-react";

import dynamic from "next/dynamic";
const MapBox = dynamic(() => import("@/components/MapBox"), { ssr: false });
import { getAllEarthquakes } from "@/lib/earthquake";

export default function EarthquakePage() {

  const [earthquake, setEarthquake] = useState<{
    id: string;
    depth_km: number;
    latitude: number;
    longitude: number;
    magnitude: number;
    time: string;
    location: string;
    tsunami_alert: number;
    magnitude_type?: string;
    focal_mechanism?: {
      dip: string;
      rake: string;
      strike: string;
    };
    seismic_stations?: string | null;
    rms?: number;
    }[]
  >([]);

  const latestEarthquake = earthquake && earthquake.length > 0 ? earthquake[0] : null;

  useEffect(() => {
    async function fetchData() {
      const eqs = await getAllEarthquakes();
      setEarthquake(eqs);
    }

    fetchData();
  }, []);

  
  const getMagnitudeTypeDescription = (magType: string) => {
    const types = {
      "md": "Duration Magnitude",
      "ml": "Local Magnitude (Richter)",
      "mb": "Body-wave Magnitude",
      "mw": "Moment Magnitude",
      "ms": "Surface-wave Magnitude",
    };
    return types[magType as keyof typeof types] || magType;
  };

  const data = latestEarthquake && {
    magnitude: latestEarthquake.magnitude?.toFixed(2) || "N/A",
    location: latestEarthquake.location || "Unknown",
    depth: latestEarthquake.depth_km ? `${latestEarthquake.depth_km.toFixed(1)} km` : "N/A",
    coordinates: latestEarthquake.latitude && latestEarthquake.longitude
      ? `${latestEarthquake.latitude.toFixed(2)}, ${latestEarthquake.longitude.toFixed(2)}`
      : "N/A",
    tsunami: latestEarthquake.tsunami_alert === 1 ? "Yes" : "No",
    seismicStations: latestEarthquake.seismic_stations || "N/A",
    faultAngle: latestEarthquake.focal_mechanism?.dip !== "N/A"
      ? latestEarthquake.focal_mechanism?.dip
      : "Unknown",
    magType: getMagnitudeTypeDescription(latestEarthquake.magnitude_type || "ml"),
    time: latestEarthquake.time || "Unknown",
    rms: latestEarthquake.rms || "N/A",
  };

  const [severity, setSeverity] = useState<string | null>(null);

  async function fetchSeverity(magnitude: number, depth: number, latitude: number, longitude: number) {
    try {
      const response = await fetch("https://df51-103-196-217-233.ngrok-free.app/combined/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          magnitude,
          depth,
          latitude,
          longitude
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setSeverity(result.severity);  
      
    } catch (error) {
      console.error("Failed to fetch severity:", error);
      setSeverity("Unknown");
    }
  }
  useEffect(() => {
    async function fetchData() {
      const eqs = await getAllEarthquakes();
      setEarthquake(eqs);
      if (eqs.length > 0) {
        const eq = eqs[0];
        await fetchSeverity(eq.magnitude, eq.depth_km, eq.latitude, eq.longitude);
      }
    }
    fetchData();
  }, []);
  

  return (
    <main className="min-h-screen bg-gray-900 text-gray-200 p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-400">Earthquake Monitoring Dashboard</h1>
      </div>

    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-3 gap-4 mb-4">
  
      {/* Left Column - Earthquake Data */}
      <div className="bg-gray-800 p-6 rounded-lg row-span-3 col-span-2 flex flex-col items-center justify-center h-full">
        <MapBox
          zoom={10}
          mapTypeId="hybrid"
          center={latestEarthquake ? { lat: latestEarthquake.latitude, lng: latestEarthquake.longitude } : undefined}
          showOpenSpaces={true}
          showShelterPoints={true}
        />
      </div>

    
      {/* Right Column - Earthquake Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Magnitude</h3>
          <Activity className="w-5 h-5 text-purple-400" />
        </div>
        <p className="text-4xl font-bold text-purple-300">
          {data?.magnitude}
        </p>
        <p className="text-sm text-gray-500 mt-1">Richter Scale</p>
      </div>

      {/* Location */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Location</h3>
          <MapPin className="w-5 h-5 text-blue-400" />
        </div>
        <p className="text-xl font-medium text-blue-300">
          {data?.location}
        </p>
      </div>

      {/* Coordinates */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Coordinates</h3>
          <MapPin className="w-5 h-5 text-blue-400" />
        </div>
        <p className="text-xl font-medium text-blue-300">
          {data?.coordinates}
        </p>
      </div>

      {/* Depth & Radius */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Depth & Radius</h3>
          <Ruler className="w-5 h-5 text-green-400" />
        </div>
        <div className="mt-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Depth:</span>
            <span className="text-green-300">
              {data?.depth}
            </span>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-gray-400">Radius:</span>
            <span className="text-green-300">50 km</span>
          </div>
        </div>
      </div>

      {/* Severity */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Severity</h3>
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <p className="text-4xl font-bold text-red-300">
          {severity || "—"}
        </p>
        <p className="text-sm text-gray-500 mt-1">Estimated Impact Level</p>
      </div>


      {/* Tsunami */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Tsunami Chances</h3>
          <CloudLightning className="w-5 h-5 text-teal-400" />
        </div>
        <p className="text-3xl font-bold text-red-400">
          {data?.tsunami}
        </p>
      </div>

      {/* Fault Angle */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Fault Angle</h3>
          <Compass className="w-5 h-5 text-green-400" />
        </div>
        <p className="text-3xl font-bold text-green-300">
          {data?.faultAngle}
        </p>
      </div>

      {/* Mag Type */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Mag Type</h3>
          <Zap className="w-5 h-5 text-purple-400" />
        </div>
        <p className="text-purple-300">
          {data?.magType}
        </p>
      </div>

      {/* Time */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Time</h3>
          <Clock className="w-5 h-5 text-blue-400" />
        </div>
        <div className="mt-2">
          <div className="mb-2">
            <span className="text-gray-400 text-sm">Occurred:</span>
            <p className="text-blue-300">
              {data?.time}
            </p>
          </div>
        </div>
      </div>

      {/* Seismic Stations */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between mb-2">
          <h3 className="text-gray-400">Seismic Stations</h3>
          <Waves className="w-5 h-5 text-purple-400" />
        </div>
        <div className="mt-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Count:</span>
            <span className="text-purple-300 font-medium">
              {data?.seismicStations}
            </span>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-gray-400">RMS:</span>
            <span className="text-purple-300 font-medium">
              {data?.rms}
            </span>
          </div>
        </div>
      </div>
    </div>

  </div>


  </main>
  );
}