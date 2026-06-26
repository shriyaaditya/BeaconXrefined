import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Define a proper type that matches your Firestore documents
export type EarthquakeData = {
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
};

export async function getAllEarthquakes(): Promise<EarthquakeData[]> {
  const earthquakeRef = collection(db, "earthquakes");
  const q = query(earthquakeRef, orderBy("time", "desc"));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return [];

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EarthquakeData[];
}
