"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Custom Leaflet icon styling fix
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

interface Resource {
  item_code: string;
  name: string;
  available_qty: number;
  min_threshold: number;
  last_updated: string;
  burn_rate?: number;
  runout_hours?: number | null;
  metadata: {
    category: string;
    unit: string;
    status: "Adequate" | "Critical";
  };
}

interface Center {
  center_id: string;
  center_name: string;
  latitude: number;
  longitude: number;
  district: string;
  region: string;
  resources: Resource[];
  last_sync: string;
  readiness_score?: number;
}

interface WarehouseMapProps {
  centers: Center[];
  selectedCenterId: string | null;
  onSelectCenter: (centerId: string) => void;
  mapCenter: [number, number];
  mapZoom: number;
}

// Subcomponent to control map viewport programmatically
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

export default function WarehouseMap({
  centers,
  selectedCenterId,
  onSelectCenter,
  mapCenter,
  mapZoom,
}: WarehouseMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full bg-[#070b19] border border-slate-800 rounded-2xl flex items-center justify-center text-teal-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-t-teal-400 border-r-transparent border-b-teal-400 border-l-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Loading Map Viewports...
          </span>
        </div>
      </div>
    );
  }

  // Create custom marker icons based on score
  const getMarkerIcon = (score: number, isSelected: boolean) => {
    let color = "bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20";
    let pingColor = "bg-emerald-400";

    if (score < 50) {
      color = "bg-red-500 border-red-400 text-white shadow-red-500/30 animate-pulse";
      pingColor = "bg-red-400";
    } else if (score < 80) {
      color = "bg-amber-500 border-amber-400 text-white shadow-amber-500/20";
      pingColor = "bg-amber-400";
    }

    // Always keep a soft glow, and pulse/ping for critical or selected ones
    const isCritical = score < 50;
    const shouldPing = isCritical || isSelected;
    const pulseRing = shouldPing
      ? `<span class="absolute inline-flex h-full w-full rounded-full ${pingColor} opacity-75 animate-ping"></span>`
      : "";

    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-10 h-10">
          ${pulseRing}
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 text-[10px] font-black shadow-xl transition-all duration-300 ${color} ${
        isSelected
          ? "scale-125 border-white ring-4 ring-teal-400/40"
          : "hover:scale-110"
      }">
            ${score}%
          </div>
        </div>
      `,
      className: "custom-leaflet-marker-wrapper",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  return (
    <div className="relative w-full h-full min-h-[500px] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-slate-950/50">
      {/* Map Control Bar Overlay */}
      <div className="absolute top-4 left-4 z-[400] bg-slate-900/90 backdrop-blur border border-slate-850 px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-lg">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
          Mumbai-Konkan Grid
        </span>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: "100%", height: "100%", background: "#070b19" }}
        zoomControl={false}
      >
        {/* Dynamic Map Pan/Zoom component */}
        <ChangeView center={mapCenter} zoom={mapZoom} />

        {/* EOC Premium Dark Tile Layer */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
        />

        {/* Render Warehouse Markers */}
        {centers.map((center) => {
          const score = center.readiness_score !== undefined ? center.readiness_score : 100;
          const isSelected = selectedCenterId === center.center_id;

          return (
            <Marker
              key={center.center_id}
              position={[center.latitude, center.longitude]}
              icon={getMarkerIcon(score, isSelected)}
              eventHandlers={{
                click: () => onSelectCenter(center.center_id),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-slate-100 text-xs font-semibold min-w-[160px] shadow-xl">
                  <p className="font-extrabold text-white text-xs border-b border-slate-800 pb-1 mb-1">
                    {center.center_name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    District: <span className="text-slate-200">{center.district}</span>
                  </p>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                    <span>Readiness:</span>
                    <span
                      className={`font-black ${
                        score >= 80
                          ? "text-emerald-400"
                          : score >= 50
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      {score}%
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1 italic">Click to view details</p>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Styled inline style overrides to ensure divIcons have clean styles inside leaflet */}
      <style jsx global>{`
        .custom-leaflet-marker-wrapper {
          background: none !important;
          border: none !important;
        }
        .leaflet-tooltip {
          background: #0f172a !important;
          border: 1px solid #334155 !important;
          border-radius: 0.75rem !important;
          padding: 0 !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: #334155 !important;
        }
      `}</style>
    </div>
  );
}
