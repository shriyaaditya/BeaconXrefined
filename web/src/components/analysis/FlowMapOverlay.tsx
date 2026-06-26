"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface FlowData {
  from: [number, number];
  to: [number, number];
  label: string;
  qty: number;
}

export default function FlowMapOverlay() {
  const [flows, setFlows] = useState<FlowData[]>([]);

  useEffect(() => {
    // Dummy flow data
    setFlows([
      { from: [18.5204, 73.8567], to: [19.0760, 72.8777], label: "Oxygen Cylinders", qty: 50 },
      { from: [19.0760, 72.8777], to: [21.1702, 72.8311], label: "Medical Kits", qty: 120 },
      { from: [21.1702, 72.8311], to: [23.0225, 72.5714], label: "Food Rations", qty: 500 },
    ]);
  }, []);

  if (typeof window === "undefined") return null;

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-700 relative z-0">
      <MapContainer
        center={[19.0760, 72.8777]}
        zoom={6}
        style={{ height: "100%", width: "100%", backgroundColor: "#0f172a" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {flows.map((flow, i) => (
          <React.Fragment key={i}>
            <Polyline
              positions={[flow.from, flow.to]}
              pathOptions={{ color: "#2dd4bf", weight: Math.max(2, flow.qty / 50), opacity: 0.6, dashArray: "5, 10" }}
            >
              <Tooltip sticky>
                {flow.qty} {flow.label}
              </Tooltip>
            </Polyline>
            <CircleMarker center={flow.from} radius={4} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }} />
            <CircleMarker center={flow.to} radius={4} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 1 }} />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
