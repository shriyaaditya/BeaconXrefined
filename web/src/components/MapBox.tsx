"use client";

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet's default icon path issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const customGreenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const customBlueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const customRedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

type Props = {
  center?: { lat: number; lng: number };
  markers?: { lat: number; lng: number }[];
  mapTypeId?: "roadmap" | "satellite" | "hybrid" | "terrain";
  zoom?: number;
  showOpenSpaces?: boolean;
  showShelterPoints?: boolean;
  predictedPath?: { lat: number; lon: number }[];
};

type OverpassElement = {
  lat: number;
  lon: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    [key: string]: string | undefined;
  };
};

type ShelterPoint = {
  lat: number;
  lng: number;
  name: string;
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629, // India default
};

const MapBox: React.FC<Props> = ({ 
  center = defaultCenter, 
  markers = [], 
  mapTypeId = "roadmap", 
  zoom = 5, 
  showOpenSpaces = false, 
  showShelterPoints = false, 
  predictedPath = [] 
}) => {
  const [openSpaces, setOpenSpaces] = useState<{ lat: number; lng: number }[]>([]);
  const [shelterPoints, setShelterPoints] = useState<ShelterPoint[]>([]);

  useEffect(() => {
    const fetchOpenSpaces = async (lat: number, lon: number) => {
      const overpassQuery = `
        [out:json];
        (
          node["leisure"="park"](around:3000, ${lat}, ${lon});
          node["leisure"="common"](around:3000, ${lat}, ${lon});
          node["landuse"="grass"](around:3000, ${lat}, ${lon});
          node["leisure"="recreation_ground"](around:3000, ${lat}, ${lon});
        );
        out body;
      `;

      try {
        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: overpassQuery,
        });

        const data = await response.json();

        const newMarkers = data.elements.map((el: OverpassElement) => ({
          lat: el.lat,
          lng: el.lon,
        }));

        setOpenSpaces(newMarkers);
      } catch (error) {
        console.error("Error fetching open spaces from OSM:", error);
      }
    };

    if (center && showOpenSpaces) {
      fetchOpenSpaces(center.lat, center.lng);
    }
  }, [center, showOpenSpaces]);

  useEffect(() => {
    const fetchShelterPoints = async () => {
      if (!showShelterPoints || !center) return;
  
      const overpassUrl = `https://overpass-api.de/api/interpreter`;
      const query = `
        [out:json];
        (
          node["amenity"~"community_centre|shelter"](around:10000,${center.lat},${center.lng});
          way["amenity"~"community_centre|shelter"](around:10000,${center.lat},${center.lng});
        );
        out center;
      `;
  
      try {
        const res = await fetch(overpassUrl, {
          method: "POST",
          body: query,
        });
        const data = await res.json();
    
        const rawpoints = (data.elements as OverpassElement[]).map((el) => ({
          lat: el.lat || el.center?.lat,
          lng: el.lon || el.center?.lon,
          name: el.tags?.name || "Shelter Point",
        }));
        const validPoints: ShelterPoint[] = rawpoints.filter(
          (p): p is ShelterPoint => typeof p.lat === "number" && typeof p.lng === "number"
        );
    
        setShelterPoints(validPoints);
      } catch (error) {
        console.error("Error fetching shelter points:", error);
      }
    };
  
    fetchShelterPoints();
  }, [showShelterPoints, center]);

  // Handle map types (roadmap vs satellite)
  let tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  if (mapTypeId === "satellite" || mapTypeId === "hybrid") {
    // Esri World Imagery is a good free satellite alternative
    tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    attribution = "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";
  } else if (mapTypeId === "terrain") {
    tileUrl = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
    attribution = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';
  }

  // Next.js hydration fix: only render after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="text-white text-sm p-4 w-full h-full flex items-center justify-center bg-gray-800">Loading Map...</div>;
  }

  return (
    <div style={{ width: "100%", height: "100%", zIndex: 0 }}>
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={zoom} 
        style={{ width: "100%", height: "100%" }}
        key={`${center.lat}-${center.lng}`} // Force re-render when center changes
      >
        <TileLayer url={tileUrl} attribution={attribution} />
        
        <Marker position={[center.lat, center.lng]} icon={customRedIcon} />
        
        {markers.map((marker, index) => (
          <Marker key={index} position={[marker.lat, marker.lng]} icon={customRedIcon} />
        ))}

        {openSpaces.map((marker, index) => (
          <Marker
            key={`open-space-${index}`}
            position={[marker.lat, marker.lng]}
            icon={customGreenIcon}
          />
        ))}

        {shelterPoints.map((marker, i) => (
          <Marker
            key={`shelter-${i}`}
            position={[marker.lat, marker.lng]}
            icon={customBlueIcon}
          >
            <Tooltip permanent direction="top" opacity={0.9}>
              <span style={{ color: "#1E40AF", fontSize: "12px", fontWeight: "bold" }}>{marker.name}</span>
            </Tooltip>
          </Marker>
        ))}

        {predictedPath.length > 1 && (
          <Polyline
            positions={predictedPath.map((point) => [point.lat, point.lon])}
            color="#FF0000"
            weight={3}
            opacity={0.8}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapBox;
