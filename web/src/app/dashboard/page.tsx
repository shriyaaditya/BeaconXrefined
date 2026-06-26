"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { io } from "socket.io-client";
import {
  MapPin,
  Activity,
  AlertTriangle,
  RefreshCw,
  Boxes,
  CheckCircle,
  Sliders,
  Zap,
  Truck,
  PlusCircle,
  Clock,
  ArrowLeft,
  Flame,
  AlertCircle,
  Layers
} from "lucide-react";

// Dynamically import Leaflet Map to avoid SSR errors
const WarehouseMap = dynamic(() => import("@/components/WarehouseMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-[#070b19] border border-slate-800 rounded-2xl flex items-center justify-center text-teal-400 shadow-2xl">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-10 h-10 border-4 border-t-teal-400 border-r-transparent border-b-teal-400 border-l-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          Initializing EOC Map Grid...
        </span>
      </div>
    </div>
  ),
});

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

interface Movement {
  id: string;
  timestamp: string;
  center_id: string;
  center_name: string;
  target_center_id?: string;
  target_center_name?: string;
  item_code: string;
  item_name: string;
  type: string;
  quantity: number;
  details: string;
}

// Center points of Konkan division districts for panning
const DISTRICT_COORDINATES: Record<string, { center: [number, number]; zoom: number }> = {
  All: { center: [18.2, 73.4], zoom: 8 },
  "Mumbai Suburban": { center: [19.12, 72.88], zoom: 11 },
  Pune: { center: [18.52, 73.85], zoom: 10 },
  Thane: { center: [19.23, 73.05], zoom: 10 },
  Raigad: { center: [18.55, 73.15], zoom: 9 },
  Ratnagiri: { center: [17.3, 73.4], zoom: 9 },
};

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // Map & District Context
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All");
  const [mapCenter, setMapCenter] = useState<[number, number]>([18.2, 73.4]);
  const [mapZoom, setMapZoom] = useState<number>(8);

  // Data State
  const [centers, setCenters] = useState<Center[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tabs for Network overview panel: 'status' (Logistics Feed) vs 'control' (Simulator Settings)
  const [activeTab, setActiveTab] = useState<"status" | "control">("status");

  // Simulator configurations
  const [simStatus, setSimStatus] = useState({ mode: "static", intervalSeconds: 10, scenario: "none" });
  const [simMode, setSimMode] = useState("static");
  const [simInterval, setSimInterval] = useState(10);
  const [simScenario, setSimScenario] = useState("none");

  // Manual Trigger Configurations
  const [manualType, setManualType] = useState<"replenish" | "consume" | "transfer">("replenish");
  const [manualCenterId, setManualCenterId] = useState("");
  const [manualSourceId, setManualSourceId] = useState("");
  const [manualTargetId, setManualTargetId] = useState("");
  const [manualItemCode, setManualItemCode] = useState("");
  const [manualQty, setManualQty] = useState(10);

  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch Inventory and Movements data
  const fetchInventoryData = async () => {
    try {
      const statusRes = await fetch(`${apiBase}/api/inventory/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.status === "success") {
          setCenters(statusData.data);
        }
      }

      const movementsRes = await fetch(`${apiBase}/api/inventory/movements`);
      if (movementsRes.ok) {
        const movementsData = await movementsRes.json();
        if (movementsData.status === "success") {
          setMovements(movementsData.data);
        }
      }
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    }
  };

  // Fetch Simulator Status
  const fetchSimulatorStatus = async () => {
    try {
      const res = await fetch(`${apiBase}/api/simulator/status`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success") {
          setSimStatus(json.data);
          setSimMode(json.data.mode);
          setSimInterval(json.data.intervalSeconds);
          setSimScenario(json.data.scenario);
        }
      }
    } catch (error) {
      console.error("Error fetching simulator status:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchInventoryData(), fetchSimulatorStatus()]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Setup Socket.IO real-time listener & periodic polling loop fallback
  useEffect(() => {
    if (!user) return;

    fetchInventoryData();
    fetchSimulatorStatus();

    // Connect to Socket.IO backend
    const socket = io(apiBase);

    socket.on("connect", () => {
      console.log("[SOCKET] Connected to real-time event grid");
    });

    socket.on("inventory-updated", (data) => {
      console.log("[SOCKET] Real-time inventory-updated event received:", data);
      // Instantly refresh dashboard visuals
      fetchInventoryData();
    });

    // 5-second polling loop as fallback
    const pollInterval = setInterval(() => {
      fetchInventoryData();
      fetchSimulatorStatus();
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Pre-fill manual dropdown lists
  useEffect(() => {
    if (centers.length > 0) {
      const defaultCenter = centers[0];
      setManualCenterId((prev) => prev || defaultCenter.center_id);
      setManualSourceId((prev) => prev || defaultCenter.center_id);
      setManualTargetId((prev) => prev || (centers[1] ? centers[1].center_id : defaultCenter.center_id));
      
      const defaultResource = defaultCenter.resources[0];
      setManualItemCode((prev) => prev || (defaultResource ? defaultResource.item_code : ""));
    }
  }, [centers]);

  // Configure simulator (Static, Simulation, Scenario)
  const applySimulatorSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);

    try {
      const res = await fetch(`${apiBase}/api/simulator/configure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: simMode,
          intervalSeconds: simInterval,
          scenario: simScenario,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSimStatus(data.data);
        setFormMessage({ type: "success", text: "Simulator settings applied!" });
        fetchInventoryData(); // Refresh immediately
        setTimeout(() => setFormMessage(null), 3000);
      } else {
        setFormMessage({ type: "error", text: data.message || "Failed to configure simulator." });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to contact simulator backend.";
      setFormMessage({ type: "error", text: errMsg });
    }
  };

  // Send manual gateway trigger event
  const sendManualEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);
    let endpoint = "";
    let payload = {};

    const activeCenterId = selectedCenterId || manualCenterId;

    if (manualType === "replenish" || manualType === "consume") {
      endpoint = "/adjust";
      payload = {
        centerId: activeCenterId,
        itemCode: manualItemCode,
        quantityChange: manualType === "replenish" ? manualQty : -manualQty,
        type: manualType,
      };
    } else if (manualType === "transfer") {
      endpoint = "/transfer";
      payload = {
        sourceCenterId: selectedCenterId ? selectedCenterId : manualSourceId,
        targetCenterId: manualTargetId,
        itemCode: manualItemCode,
        quantity: manualQty,
      };
    }

    try {
      const res = await fetch(`${apiBase}/api/simulator/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, payload }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setFormMessage({ type: "success", text: "Gateway event sent to central server successfully!" });
        fetchInventoryData(); // Refresh immediately
        setTimeout(() => setFormMessage(null), 3000);
      } else {
        setFormMessage({ type: "error", text: data.message || "Failed to trigger event." });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to contact simulator backend.";
      setFormMessage({ type: "error", text: errMsg });
    }
  };

  // Handle Map Selection
  const handleSelectCenter = (centerId: string) => {
    setSelectedCenterId(centerId);
    const centerObj = centers.find((c) => c.center_id === centerId);
    if (centerObj) {
      setMapCenter([centerObj.latitude, centerObj.longitude]);
      setMapZoom(12);

      // Pre-fill manual values
      setManualCenterId(centerId);
      setManualSourceId(centerId);
      if (centerObj.resources.length > 0) {
        setManualItemCode(centerObj.resources[0].item_code);
      }
    }
  };

  // Handle District Panning Filter
  const handleDistrictChange = (dist: string) => {
    setSelectedDistrict(dist);
    setSelectedCenterId(null); // Clear selection on district change
    const coords = DISTRICT_COORDINATES[dist];
    if (coords) {
      setMapCenter(coords.center);
      setMapZoom(coords.zoom);
    }
  };

  // Clear active warehouse selection and restore state
  const handleBackToOverview = () => {
    setSelectedCenterId(null);
    const coords = DISTRICT_COORDINATES[selectedDistrict];
    if (coords) {
      setMapCenter(coords.center);
      setMapZoom(coords.zoom);
    }
  };

  // Filter centers based on selected district
  const filteredCenters =
    selectedDistrict === "All"
      ? centers
      : centers.filter((c) => c.district === selectedDistrict);

  // Active warehouse context data
  const selectedCenter = centers.find((c) => c.center_id === selectedCenterId);

  // Derived network-wide metrics (All or filtered by district)
  let totalStockUnits = 0;
  let readinessSum = 0;
  const criticalShortages: { center: Center; res: Resource }[] = [];

  const targetCentersForMetrics = selectedDistrict === "All" ? centers : filteredCenters;

  targetCentersForMetrics.forEach((c) => {
    totalStockUnits += c.resources.reduce((sum, r) => sum + r.available_qty, 0);
    readinessSum += c.readiness_score || 0;
    c.resources.forEach((r) => {
      if (r.available_qty < r.min_threshold) {
        criticalShortages.push({ center: c, res: r });
      }
    });
  });

  const avgReadiness =
    targetCentersForMetrics.length > 0
      ? Math.round(readinessSum / targetCentersForMetrics.length)
      : 100;

  // Filter movements for selected warehouse
  const filteredMovements = selectedCenterId
    ? movements.filter(
        (m) => m.center_id === selectedCenterId || m.target_center_id === selectedCenterId
      )
    : movements;

  // Manual Trigger helper resource options
  const activeTriggerCenter = selectedCenter || centers.find((c) => c.center_id === (manualType === "transfer" ? manualSourceId : manualCenterId));
  const triggerResources = activeTriggerCenter ? activeTriggerCenter.resources : [];

  if (loading || !user) {
    return (
      <div className="flex h-screen bg-[#070b19] text-white items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase">
            Loading EOC Command Panel...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 flex flex-col font-sans">
      
      {/* 1. Header Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-[1000] shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute h-3.5 w-3.5 rounded-full bg-teal-400 opacity-60 animate-ping"></span>
            <span className="relative h-2 w-2 rounded-full bg-teal-500"></span>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center space-x-2">
              <span>EOC Logistics Control Room</span>
              <span className="text-[10px] uppercase bg-teal-500/15 text-teal-400 px-2 py-0.5 rounded font-black border border-teal-500/20">
                Active Node
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">
              Live updates directly fed from external warehouse nodes via Redis
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Simulator status banner */}
          <div
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center space-x-2 border transition-colors ${
              simStatus.mode === "simulation"
                ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/50"
                : simStatus.mode === "scenario"
                ? "bg-amber-950/40 text-amber-400 border-amber-900/50 animate-pulse"
                : "bg-slate-900/40 text-slate-400 border-slate-800"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                simStatus.mode === "simulation"
                  ? "bg-emerald-500 animate-ping"
                  : simStatus.mode === "scenario"
                  ? "bg-amber-500 animate-ping"
                  : "bg-slate-500"
              }`}
            ></span>
            <span>
              Gateway:{" "}
              {simStatus.mode === "simulation"
                ? `AUTO (${simStatus.intervalSeconds}s)`
                : simStatus.mode === "scenario"
                ? `SCENARIO (${simStatus.scenario.toUpperCase()})`
                : "PAUSED"}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 bg-slate-850 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-teal-400" : ""}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="bg-red-950/30 hover:bg-red-900/30 text-red-400 border border-red-900/40 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            Exit
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        
        {/* LEFT & CENTER VIEWPORT: The Map & District View Selectors (Col span 7) */}
        <section className="lg:col-span-7 flex flex-col space-y-4 h-full min-h-[500px]">
          
          {/* Map Filters & Controls */}
          <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-2xl flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <Layers className="h-4 w-4 text-teal-400" />
              <span className="text-xs font-bold text-slate-300">District Focus:</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(DISTRICT_COORDINATES).map((dist) => (
                <button
                  key={dist}
                  onClick={() => handleDistrictChange(dist)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                    selectedDistrict === dist
                      ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/10"
                      : "bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {dist}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div className="flex-1 min-h-[480px]">
            <WarehouseMap
              centers={filteredCenters}
              selectedCenterId={selectedCenterId}
              onSelectCenter={handleSelectCenter}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
            />
          </div>

          {/* Quick List (District Warehouse Navigator) */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center space-x-1.5">
              <MapPin className="h-3.5 w-3.5 text-teal-400" />
              <span>District Node Registry ({filteredCenters.length})</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredCenters.map((c) => {
                const isSelected = selectedCenterId === c.center_id;
                const score = c.readiness_score || 0;
                
                let scoreBadge = "bg-emerald-950/40 text-emerald-400 border-emerald-900/50";
                if (score < 50) {
                  scoreBadge = "bg-red-955 text-red-400 border-red-900/50";
                } else if (score < 80) {
                  scoreBadge = "bg-amber-950/40 text-amber-400 border-amber-900/50";
                }

                return (
                  <div
                    key={c.center_id}
                    onClick={() => handleSelectCenter(c.center_id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-teal-950/20 border-teal-500 shadow-md shadow-teal-500/5"
                        : "bg-slate-900/60 border-slate-850 hover:bg-slate-850 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <p className="font-extrabold text-[11px] text-white truncate">
                        {c.center_name}
                      </p>
                      <p className="text-[9px] text-slate-500 truncate mt-0.5">
                        {c.district} | {c.region}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-850/60 pt-2 mt-2">
                      <span className="text-[9px] text-slate-500 font-mono">{c.center_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${scoreBadge}`}>
                        {score}% Ready
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* RIGHT SIDEBAR PANEL: Intelligence, Details & Controls (Col span 5) */}
        <section className="lg:col-span-5 flex flex-col space-y-6 overflow-y-auto max-h-[85vh] pr-1">
          
          {selectedCenter ? (
            /* WAREHOUSE INTELLIGENCE VIEW (Selected State) */
            <div className="space-y-6">
              
              {/* Back to Network button */}
              <button
                onClick={handleBackToOverview}
                className="flex items-center space-x-1.5 text-xs text-teal-400 hover:text-teal-300 font-bold transition select-none group"
              >
                <ArrowLeft className="h-4 w-4 transform group-hover:-translate-x-0.5 transition-transform" />
                <span>Return to Network Overview</span>
              </button>

              {/* Warehouse Metadata Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute right-4 top-4 opacity-5 text-slate-400">
                  <MapPin className="h-24 w-24" />
                </div>
                
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 bg-slate-950 border border-slate-850 px-2 py-0.5 rounded uppercase tracking-wider">
                      {selectedCenter.center_id}
                    </span>
                    <h2 className="text-lg font-black text-white mt-2 leading-tight">
                      {selectedCenter.center_name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedCenter.district} &bull; {selectedCenter.region}
                    </p>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <span className={`px-3 py-1 rounded-xl text-xs font-black border shadow-lg ${
                      selectedCenter.readiness_score !== undefined && selectedCenter.readiness_score >= 80
                        ? "bg-emerald-950/50 text-emerald-400 border-emerald-900/60"
                        : selectedCenter.readiness_score !== undefined && selectedCenter.readiness_score >= 50
                        ? "bg-amber-950/50 text-amber-400 border-amber-900/60"
                        : "bg-red-955 text-red-400 border-red-900/60 animate-pulse"
                    }`}>
                      Readiness: {selectedCenter.readiness_score}%
                    </span>
                    <span className="text-[9px] text-slate-500 mt-1.5 flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Sync: {new Date(selectedCenter.last_sync).toLocaleTimeString()}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Inventory Table (Resources list) */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 mb-4 flex items-center space-x-2">
                  <Boxes className="h-4 w-4 text-teal-400" />
                  <span>Current Inventory Allocation</span>
                </h3>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {selectedCenter.resources.map((res) => {
                    const isCritical = res.available_qty < res.min_threshold;
                    const pct = Math.min(Math.round((res.available_qty / res.min_threshold) * 100), 200);

                    return (
                      <div
                        key={res.item_code}
                        className={`p-3 rounded-xl border transition-all ${
                          isCritical
                            ? "bg-red-955/20 border-red-900/30 hover:border-red-900/50"
                            : "bg-slate-950/40 border-slate-850 hover:border-slate-800"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-extrabold text-xs text-white leading-tight">
                              {res.name}
                            </p>
                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                              {res.item_code} &bull; {res.metadata.category}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-black text-sm text-white">
                              {res.available_qty}
                            </span>{" "}
                            <span className="text-[10px] text-slate-500 font-medium">
                              {res.metadata.unit}
                            </span>
                          </div>
                        </div>

                        {/* Critical Alert Warning */}
                        {isCritical && (
                          <div className="mt-2.5 flex items-center space-x-1.5 text-[10px] font-bold text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg p-1.5">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              Critical Shortage: Deficit of {res.min_threshold - res.available_qty}{" "}
                              {res.metadata.unit} below safety threshold ({res.min_threshold}).
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 text-[10px]">
                          <div className="flex-1 mr-4">
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isCritical ? "bg-red-500" : pct < 130 ? "bg-yellow-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 shrink-0">
                            {pct}% target
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Burn Rate & Runout Intelligence Panel */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 mb-4 flex items-center space-x-2">
                  <Flame className="h-4 w-4 text-amber-500 animate-pulse" />
                  <span>Burn Rate & Runout Intelligence</span>
                </h3>

                <div className="space-y-3">
                  {selectedCenter.resources.map((res) => {
                    const burnRate = res.burn_rate !== undefined ? res.burn_rate : 0.1;
                    const runout = res.runout_hours;

                    // Compute clean timeline remaining string
                    let runoutStr = "Stable (Safe)";
                    let textClass = "text-slate-400";
                    let isDanger = false;

                    if (runout !== null && runout !== undefined) {
                      if (runout <= 0) {
                        runoutStr = "Exhausted (0h remaining)";
                        textClass = "text-red-400 font-extrabold";
                        isDanger = true;
                      } else if (runout <= 24) {
                        runoutStr = `${runout} hours remaining`;
                        textClass = "text-red-400 font-bold animate-pulse";
                        isDanger = true;
                      } else if (runout <= 72) {
                        runoutStr = `${(runout / 24).toFixed(1)} days remaining`;
                        textClass = "text-amber-400 font-semibold";
                        isDanger = true;
                      } else {
                        runoutStr = `${(runout / 24).toFixed(1)} days remaining`;
                        textClass = "text-emerald-400";
                      }
                    }

                    return (
                      <div key={res.item_code} className="flex items-center justify-between text-xs p-2 border-b border-slate-850 last:border-0">
                        <div>
                          <p className="font-bold text-white">{res.name}</p>
                          <p className="text-[9px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
                            <span>Burn Rate:</span>
                            <span className="font-bold text-slate-400">{burnRate} {res.metadata.unit}/hr</span>
                          </p>
                        </div>

                        <div className="text-right">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-lg ${
                            isDanger ? "bg-red-955 border border-red-900/30" : "bg-slate-950"
                          } ${textClass}`}>
                            {runoutStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action: Trigger Gateway Event directly for this selected Warehouse */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 mb-4 flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-teal-400" />
                  <span>Manual Dispatch & Adjustments</span>
                </h3>

                <form onSubmit={sendManualEvent} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-bold">Event Type</label>
                      <select
                        value={manualType}
                        onChange={(e) => setManualType(e.target.value as "replenish" | "consume" | "transfer")}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="replenish">Truck Replenishment (+)</option>
                        <option value="consume">Emergency Dispatch (-)</option>
                        <option value="transfer">Stock Transfer Out (A ➔ B)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-bold">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={manualQty}
                        onChange={(e) => setManualQty(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  {manualType === "transfer" && (
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-bold">Target Warehouse (To)</label>
                      <select
                        value={manualTargetId}
                        onChange={(e) => setManualTargetId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        {centers
                          .filter((c) => c.center_id !== selectedCenter.center_id)
                          .map((c) => (
                            <option key={c.center_id} value={c.center_id}>
                              {c.center_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-400 mb-1.5 font-bold">Resource / Item</label>
                    <select
                      value={manualItemCode}
                      onChange={(e) => setManualItemCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      {triggerResources.map((res) => (
                        <option key={res.item_code} value={res.item_code}>
                          {res.name} ({res.item_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {formMessage && (
                    <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                      formMessage.type === "success"
                        ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/40"
                        : "bg-red-955 text-red-400 border-red-900/40"
                    }`}>
                      <span>{formMessage.type === "success" ? "✔" : "❌"}</span>
                      <span className="flex-1">{formMessage.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 py-2.5 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 shadow-lg shadow-teal-500/10"
                  >
                    {manualType === "replenish" && <PlusCircle className="h-4 w-4" />}
                    {manualType === "consume" && <Zap className="h-4 w-4" />}
                    {manualType === "transfer" && <Truck className="h-4 w-4" />}
                    <span>Queue Gateway Event</span>
                  </button>
                </form>
              </div>

              {/* Recent Transactions Specific to this warehouse */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 mb-4 flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-teal-400" />
                  <span>Node Activity Log</span>
                </h3>

                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                  {filteredMovements.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-4">
                      No logs recorded for this node.
                    </p>
                  ) : (
                    filteredMovements.map((m) => {
                      const timeStr = new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <div key={m.id} className="border-b border-slate-850 pb-2.5 last:border-b-0 text-[11px]">
                          <div className="flex items-center justify-between text-[9px] text-slate-500 mb-1">
                            <span>{timeStr}</span>
                            <span className={`px-1.5 py-0.2 rounded font-extrabold uppercase text-[7px] ${
                              m.type === "replenish"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-900/30"
                                : m.type === "transfer"
                                ? "bg-sky-950 text-sky-400 border border-sky-900/30"
                                : m.type === "spike"
                                ? "bg-red-955 text-red-400 border border-red-900/30"
                                : "bg-yellow-950 text-yellow-400 border border-yellow-900/30"
                            }`}>
                              {m.type}
                            </span>
                          </div>
                          <p className="text-slate-200 font-medium">{m.details}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          ) : (
            /* DEFAULT EOC STATE (No Warehouse Selected) */
            <div className="space-y-6">
              
              {/* Tab Selector */}
              <div className="flex bg-slate-950 border border-slate-850 p-1.5 rounded-2xl">
                <button
                  onClick={() => {
                    setActiveTab("status");
                    setFormMessage(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
                    activeTab === "status"
                      ? "bg-teal-500 text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Network Logistics Feed</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("control");
                    setFormMessage(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
                    activeTab === "control"
                      ? "bg-teal-500 text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>EOC Simulator Control</span>
                </button>
              </div>

              {activeTab === "status" ? (
                /* TAB 1: Network Logistics Feed */
                <div className="space-y-6">
                  
                  {/* Grid of EOC Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Overall Readiness
                      </p>
                      <p className="text-2xl font-black text-teal-400 mt-1">{avgReadiness}%</p>
                      <p className="text-[9px] text-slate-500 mt-2">
                        Weighted target score of active centers
                      </p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Active Warehouses
                      </p>
                      <p className="text-2xl font-black text-white mt-1">{filteredCenters.length}</p>
                      <p className="text-[9px] text-slate-500 mt-2">
                        Monitoring node count in division
                      </p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Critical Shortages
                      </p>
                      <p className={`text-2xl font-black mt-1 ${criticalShortages.length > 0 ? "text-red-500" : "text-emerald-400"}`}>
                        {criticalShortages.length}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-2">Items below safety margins</p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Total Stock units
                      </p>
                      <p className="text-2xl font-black text-white mt-1">
                        {totalStockUnits.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-2">Aggregated system reserves</p>
                    </div>
                  </div>

                  {/* Top Resources Running Low Warning Panel */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 mb-4 flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                      <span>Network Critical Alerts</span>
                    </h3>

                    {criticalShortages.length === 0 ? (
                      <div className="text-center py-6 text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 rounded-xl">
                        <CheckCircle className="h-7 w-7 mx-auto mb-2" />
                        <p className="text-xs font-bold">All nodes report full safety margin compliance.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {criticalShortages.map(({ center, res }, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectCenter(center.center_id)}
                            className="bg-red-955/20 border border-red-900/30 hover:border-red-900/60 rounded-xl p-3 text-xs flex flex-col justify-between cursor-pointer transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-[8px] font-black text-red-400 bg-red-950 border border-red-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
                                Deficit: {res.min_threshold - res.available_qty}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">{res.item_code}</span>
                            </div>
                            <h4 className="font-extrabold text-white text-xs mt-2 truncate">
                              {res.name}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center space-x-1">
                              <MapPin className="h-3 w-3 text-slate-500" />
                              <span className="truncate">{center.center_name}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Activity Log */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 mb-4 flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-teal-400" />
                      <span>Global Activity Feed</span>
                    </h3>

                    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                      {movements.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-6">
                          No recent movements logged.
                        </p>
                      ) : (
                        movements.map((m) => {
                          const dateStr = new Date(m.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <div key={m.id} className="border-b border-slate-850 pb-2.5 last:border-b-0 text-[11px]">
                              <div className="flex items-center justify-between text-[9px] text-slate-500 mb-1">
                                <span>{dateStr}</span>
                                <span className={`px-1.5 py-0.2 rounded font-extrabold uppercase text-[7px] ${
                                  m.type === "replenish"
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-900/30"
                                    : m.type === "transfer"
                                    ? "bg-sky-950 text-sky-400 border border-sky-900/30"
                                    : m.type === "spike"
                                    ? "bg-red-955 text-red-400 border border-red-900/30"
                                    : "bg-yellow-950 text-yellow-400 border border-yellow-900/30"
                                }`}>
                                  {m.type}
                                </span>
                              </div>
                              <p className="text-slate-200 font-medium">{m.details}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                /* TAB 2: EOC Simulator Control Panel */
                <div className="space-y-6">
                  
                  {/* Configuration Board */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 mb-4 flex items-center space-x-2">
                      <Sliders className="h-4 w-4 text-teal-400" />
                      <span>Configure Gateway Loop</span>
                    </h3>

                    {/* Mode buttons */}
                    <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-xl mb-5 text-[10px] font-black border border-slate-850">
                      <button
                        type="button"
                        onClick={() => setSimMode("static")}
                        className={`py-2 rounded-lg transition-all ${
                          simMode === "static" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        PAUSED
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimMode("simulation")}
                        className={`py-2 rounded-lg transition-all ${
                          simMode === "simulation" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        AUTOMATED
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimMode("scenario")}
                        className={`py-2 rounded-lg transition-all ${
                          simMode === "scenario" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        DISASTER
                      </button>
                    </div>

                    <form onSubmit={applySimulatorSettings} className="space-y-4 text-xs">
                      {simMode === "simulation" && (
                        <div>
                          <div className="flex justify-between text-slate-400 mb-1.5 font-bold">
                            <span>Loop Dispatch Interval</span>
                            <span className="text-teal-400 font-extrabold">{simInterval} seconds</span>
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="60"
                            step="1"
                            value={simInterval}
                            onChange={(e) => setSimInterval(Number(e.target.value))}
                            className="w-full accent-teal-500 cursor-pointer bg-slate-800 rounded-lg"
                          />
                        </div>
                      )}

                      {simMode === "scenario" && (
                        <div>
                          <label className="block text-slate-400 mb-1.5 font-bold">Active Disaster Profile</label>
                          <select
                            value={simScenario}
                            onChange={(e) => setSimScenario(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="none">Choose Scenario...</option>
                            <option value="flood">Monsoon Flood (Boats & Water Kits Drawdown)</option>
                            <option value="cyclone">Coastal Cyclone (Tarpaulins & Generators Drawdown)</option>
                            <option value="earthquake">Seismic Earthquake (Medical Kits & Tents Drawdown)</option>
                          </select>
                        </div>
                      )}

                      {simMode === "static" && (
                        <p className="text-slate-500 text-[10px] leading-relaxed">
                          Paused mode stops all automated mock loops. Quantities will remain static unless manually edited below.
                        </p>
                      )}

                      <button
                        type="submit"
                        className="w-full bg-slate-850 hover:bg-slate-800 text-white py-2 rounded-xl font-bold transition border border-slate-850"
                      >
                        Apply Simulator Config
                      </button>
                    </form>
                  </div>

                  {/* Manual Event Trigger Section */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 mb-4 flex items-center space-x-2">
                      <Zap className="h-4 w-4 text-teal-400 animate-pulse" />
                      <span>Manually Dispatch Network Events</span>
                    </h3>

                    <form onSubmit={sendManualEvent} className="space-y-4 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1.5 font-bold">Action Type</label>
                          <select
                            value={manualType}
                            onChange={(e) => setManualType(e.target.value as "replenish" | "consume" | "transfer")}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none"
                          >
                            <option value="replenish">Truck Replenishment (+)</option>
                            <option value="consume">Emergency Dispatch (-)</option>
                            <option value="transfer">Stock Transfer (A ➔ B)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1.5 font-bold">Qty Change</label>
                          <input
                            type="number"
                            min="1"
                            value={manualQty}
                            onChange={(e) => setManualQty(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {manualType !== "transfer" ? (
                        <div>
                          <label className="block text-slate-400 mb-1.5 font-bold">Target Warehouse</label>
                          <select
                            value={manualCenterId}
                            onChange={(e) => setManualCenterId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none"
                          >
                            {centers.map((c) => (
                              <option key={c.center_id} value={c.center_id}>
                                {c.center_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-400 mb-1.5 font-bold">From (Source)</label>
                            <select
                              value={manualSourceId}
                              onChange={(e) => setManualSourceId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none"
                            >
                              {centers.map((c) => (
                                <option key={c.center_id} value={c.center_id}>
                                  {c.center_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1.5 font-bold">To (Destination)</label>
                            <select
                              value={manualTargetId}
                              onChange={(e) => setManualTargetId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none"
                            >
                              {centers.map((c) => (
                                <option key={c.center_id} value={c.center_id}>
                                  {c.center_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-slate-400 mb-1.5 font-bold">Select Supply Item</label>
                        <select
                          value={manualItemCode}
                          onChange={(e) => setManualItemCode(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none"
                        >
                          {triggerResources.map((res) => (
                            <option key={res.item_code} value={res.item_code}>
                              {res.name} ({res.item_code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {formMessage && (
                        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                          formMessage.type === "success"
                            ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/40"
                            : "bg-red-955 text-red-400 border-red-900/40"
                        }`}>
                          <span>{formMessage.type === "success" ? "✔" : "❌"}</span>
                          <span className="flex-1">{formMessage.text}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 py-2.5 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 shadow-lg shadow-teal-500/10"
                      >
                        {manualType === "replenish" && <PlusCircle className="h-4 w-4" />}
                        {manualType === "consume" && <Zap className="h-4 w-4" />}
                        {manualType === "transfer" && <Truck className="h-4 w-4" />}
                        <span>Queue Mock Event</span>
                      </button>
                    </form>
                  </div>

                </div>
              )}

            </div>
          )}

        </section>

      </main>

    </div>
  );
}
