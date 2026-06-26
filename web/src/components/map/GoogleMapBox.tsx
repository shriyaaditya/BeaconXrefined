"use client"

import React from "react";
import { useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from "@react-google-maps/api";
import { GOOGLE_MAPS_CONFIG } from "@/lib/googleMapsConfig";

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

const containerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629, // India default
};

const GoogleMapBox: React.FC<Props> = ({ center = defaultCenter, markers = [], mapTypeId = "roadmap", zoom = 5, showOpenSpaces = false, showShelterPoints = false, predictedPath = [] }) => {
  
  const { isLoaded } = useJsApiLoader(GOOGLE_MAPS_CONFIG);

  const [openSpaces, setOpenSpaces] = useState<{ lat: number; lng: number }[]>([]);

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

        const markers = data.elements.map((el: OverpassElement) => ({
          lat: el.lat,
          lng: el.lon,
        }));

        setOpenSpaces(markers);
      } catch (error) {
        console.error("Error fetching open spaces from OSM:", error);
      }
    };

    if (center && showOpenSpaces) {
      fetchOpenSpaces(center.lat, center.lng);
    }
  }, [center, showOpenSpaces]);

  const [shelterPoints, setShelterPoints] = useState<ShelterPoint[]>([]);

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
    };
  
    fetchShelterPoints();
  }, [showShelterPoints, center]);  

  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={zoom}
      mapTypeId={mapTypeId}
    >

      <Marker position={center} />
      {markers.map((marker, index) => (
        <Marker key={index} position={marker} />
      ))}

      {openSpaces.map((marker, index) => (
        <Marker
          key={`open-space-${index}`}
          position={marker}
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
          }}
        />
      ))}

      {shelterPoints.map((marker, i) => (
        <Marker
          key={`shelter-${i}`}
          position={{ lat: marker.lat, lng: marker.lng }}
          label={{
            text: marker.name,
            fontSize: "12px",
            color: "#1E40AF",
          }}
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          }}
        />
      ))}

      {predictedPath.length > 1 && (
        <Polyline
            path={predictedPath.map((point) => ({ lat: point.lat, lng: point.lon }))}
            options={{
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 3,
            clickable: false,
            geodesic: true,
          }}
        />
      )}

    </GoogleMap>
  ) : (
    <div className="text-white text-sm p-4">Loading Map...</div>
  );
};



export default GoogleMapBox;
