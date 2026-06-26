"use client"

import React, { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, limit, orderBy } from "firebase/firestore"
import { Wind, Activity } from "lucide-react"

interface Earthquake {
  id: string
  type: "earthquake"
  time: string // Or `Timestamp` from Firebase if you're using that
  latitude?: number
  longitude?: number
  magnitude?: number
  place?: string
  depth?: number
  severity?: string
}

interface Cyclone {
  id: string
  type: "cyclone"
  ISO_TIME: string
  LAT?: number
  LON?: number
  name?: string
  STORM_SPEED?: number
  STORM_DIR?: number
  severity?: string
}


export default function AlertsPage() {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([])
  const [cyclones, setCyclones] = useState<Cyclone[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eqQuery = query(
          collection(db, "earthquakes"),
          orderBy("time", "desc"),
          limit(5)
        )
        const cycloneQuery = query(
          collection(db, "cyclones"),
          orderBy("ISO_TIME", "desc"),
          limit(5)
        )
  
        const [eqSnapshot, cycloneSnapshot] = await Promise.all([
          getDocs(eqQuery),
          getDocs(cycloneQuery),
        ])
  
        const eqData: Earthquake[] = eqSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            type: "earthquake",
            time: data.time,
            latitude: data.latitude,
            longitude: data.longitude,
            magnitude: data.magnitude,
            place: data.place,
            depth: data.depth,
            severity: data.severity,
          }
        })
  
        const cycloneData: Cyclone[] = cycloneSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            type: "cyclone",
            ISO_TIME: data.ISO_TIME,
            LAT: data.LAT,
            LON: data.LON,
            name: data.name,
            STORM_SPEED: data.STORM_SPEED,
            STORM_DIR: data.STORM_DIR,
            severity: data.severity,
          }
        })
  
        setEarthquakes(eqData)
        setCyclones(cycloneData)
      } catch (err) {
        console.error("Error fetching alerts:", err)
      }
    }
  
    fetchData()
  }, [])
  

  return (
    <div className="p-6 bg-gray-900 min-h-screen space-y-8">
      <h1 className="text-3xl font-bold text-teal-400">Emergency Alerts</h1>

      {/* Earthquake Alerts */}
      <div>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-red-400">
          <Activity className="w-5 h-5" /> Earthquake Alerts
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {earthquakes.map(eq => (
            <div
              key={eq.id}
              className="bg-gray-800 p-4 rounded-xl shadow-md border-l-4 border-red-400"
            >
              <p className="text-teal-400 font-semibold">
                Magnitude: {eq.magnitude}
              </p>
              <p className="text-sm text-white">
                Location: {eq.place || `${eq.latitude}, ${eq.longitude}`}
              </p>
              <p className="text-sm text-white">Depth: {eq.depth} km</p>
              <p className="text-sm text-white">Time: {new Date(eq.time).toLocaleString()}</p>
              {eq.severity && (
                <p className="text-sm mt-1 text-red-400 font-medium">
                  Severity: {eq.severity}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cyclone Alerts */}
      <div>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-blue-400">
          <Wind className="w-5 h-5" /> Cyclone Alerts
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {cyclones.map(c => (
            <div
              key={c.id}
              className="bg-gray-800 p-4 rounded-xl shadow-md border-l-4 border-blue-400"
            >
              <p className="text-teal-400 font-semibold">Storm Speed: {c.STORM_SPEED} km/h</p>
              <p className="text-sm text-white">Coordinates: {c.LAT}, {c.LON}</p>
              <p className="text-sm text-white">Direction: {c.STORM_DIR}°</p>
              <p className="text-sm text-white">
                Time: {new Date(c.ISO_TIME).toLocaleString()}
              </p>
              {c.severity && (
                <p className="text-sm mt-1 text-blue-400 font-medium">
                  Severity: {c.severity}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

