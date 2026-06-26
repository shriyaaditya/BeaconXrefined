import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface cycloneData {
    isoTime: string;
    lat: string;
    lon: string;
    stormDir: string;
    stormSpeed: string;
    severity?: string;
    predictedSpeed?: string;
    predictedPath?: { lat: number; lon: number }[];
}  

export const getLatestCyclone = async () => {
  const docRef = doc(db, "cyclones", "cyc101");
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();

    // Assuming the field name is "1" (as a string key)
    const cycloneData = data["1"];
    return {
      isoTime: cycloneData.ISO_TIME,
      lat: cycloneData.LAT,
      lon: cycloneData.LON,
      stormDir: cycloneData.STORM_DIR,
      stormSpeed: cycloneData.STORM_SPEED,
    };
  } else {
    throw new Error("Cyclone document not found.");
  }
};

export const fetchCyclonePredictions = async (data: cycloneData) => {
    const input = {
      ISO_TIME: data.isoTime,
      LAT: parseFloat(data.lat),
      LON: parseFloat(data.lon),
      STORM_SPEED: parseFloat(data.stormSpeed),
      STORM_DIR: parseFloat(data.stormDir),
    };
  
    const [severityRes, speedRes, pathRes] = await Promise.all([
      fetch("https://df51-103-196-217-233.ngrok-free.app/combined/classify-severity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
      fetch("https://df51-103-196-217-233.ngrok-free.app/combined/predict-speed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
      fetch("https://df51-103-196-217-233.ngrok-free.app/cyclone/predict-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    ]);
  
    const severity = await severityRes.json();
    const speed = await speedRes.json();
    const path = await pathRes.json();
  
    return {
      severity: severity.severity,
      predictedSpeed: speed.wind_speed,
      predictedPath: path.path, // Assuming API returns { path: [{ lat, lon }, ...] }
    };
  };
  