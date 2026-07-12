// frontend/src/app/analyze/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Search, ArrowUpDown, Activity, AlertTriangle, Package, ActivitySquare, ChevronDown, CheckCircle, Clock } from "lucide-react";

interface OverviewWarehouse {
  center_id: string;
  center_name: string;
  district: string;
  region: string;
  last_updated: string;
  health_score: number;
  critical_resource_count: number;
  burn_rate_change: number;
}

interface ResourceDetail {
  item_code: string;
  name: string;
  available_qty: number;
  min_threshold: number;
  last_updated: string;
  metadata: {
    category: string;
    unit: string;
    status: string;
  };
  burn_rate?: number;
  runout_hours?: number | null;
}

interface ActivityLog {
  timestamp: string;
  resource_name: string;
  item_code: string;
  action: string;
  quantity_change: number;
}

export default function Analyze() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";
  
  const [overview, setOverview] = useState<OverviewWarehouse[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [warehouseData, setWarehouseData] = useState<ResourceDetail[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Table state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof ResourceDetail | "status">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Fetch overview on mount
  useEffect(() => {
    fetch(`${apiBase}/api/analysis/overview`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success") {
          setOverview(d.data);
          if (d.data.length > 0) {
            setSelectedId(d.data[0].center_id);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch overview:", err));
  }, [apiBase]);

  // Fetch deep‑dive data when a warehouse is selected
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    
    Promise.all([
      fetch(`${apiBase}/api/analysis/warehouse/${selectedId}`).then(r => r.json()),
      fetch(`${apiBase}/api/analysis/warehouse/${selectedId}/activity`).then(r => r.json())
    ])
      .then(([warehouseRes, activityRes]) => {
        if (warehouseRes.status === "success") {
          setWarehouseData(warehouseRes.data.resources);
        } else {
          setError(warehouseRes.message || "Failed to load warehouse data");
        }
        
        if (activityRes.status === "success") {
          setActivities(activityRes.data);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Network error fetching warehouse details.");
      })
      .finally(() => setLoading(false));
  }, [selectedId, apiBase]);

  const selectedCenterInfo = useMemo(() => {
    return overview.find(c => c.center_id === selectedId);
  }, [overview, selectedId]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalResources = warehouseData.length;
    const criticalResources = warehouseData.filter(r => r.metadata.status === "CRITICAL" || (r.runout_hours !== null && r.runout_hours !== undefined && r.runout_hours < 24)).length;
    
    const validBurnRates = warehouseData.filter(r => r.burn_rate !== undefined && r.burn_rate > 0);
    const avgBurnRate = validBurnRates.length > 0 
      ? (validBurnRates.reduce((sum, r) => sum + (r.burn_rate || 0), 0) / validBurnRates.length).toFixed(1)
      : "0";

    return {
      totalResources,
      criticalResources,
      avgBurnRate,
      healthScore: selectedCenterInfo?.health_score || 0
    };
  }, [warehouseData, selectedCenterInfo]);

  // Handle Sort
  const handleSort = (field: keyof ResourceDetail | "status") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filter and Sort Data
  const filteredAndSortedResources = useMemo(() => {
    let result = [...warehouseData];

    // Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.item_code.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField as keyof ResourceDetail];
      let valB: any = b[sortField as keyof ResourceDetail];
      
      if (sortField === "status") {
        valA = a.metadata.status;
        valB = b.metadata.status;
      } else if (sortField === "burn_rate") {
        valA = a.burn_rate || 0;
        valB = b.burn_rate || 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [warehouseData, searchQuery, sortField, sortOrder]);

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 font-sans p-6 lg:p-8">
      {/* Header & Selector */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Warehouse Analytics</h1>
          <p className="text-sm text-slate-400">Live operational data and inventory insights.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Select Warehouse
          </label>
          <div className="relative">
            <select 
              value={selectedId} 
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-teal-500 transition-colors shadow-sm cursor-pointer"
            >
              {overview.length === 0 && <option value="">Loading warehouses...</option>}
              {overview.map((w) => (
                <option key={w.center_id} value={w.center_id}>
                  {w.center_name} ({w.center_id})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 p-4 rounded-xl mb-6 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-3" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-teal-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
          <p className="text-slate-400 animate-pulse">Syncing live metrics...</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase">Total Resources</h3>
                <Package className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-3xl font-black text-white">{kpis.totalResources}</p>
            </div>
            
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase">Critical Shortages</h3>
                <AlertTriangle className={`h-4 w-4 ${kpis.criticalResources > 0 ? 'text-red-500' : 'text-slate-500'}`} />
              </div>
              <p className={`text-3xl font-black ${kpis.criticalResources > 0 ? 'text-red-400' : 'text-white'}`}>
                {kpis.criticalResources}
              </p>
            </div>
            
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase">Avg Burn Rate</h3>
                <Activity className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-3xl font-black text-white">
                {kpis.avgBurnRate} <span className="text-sm font-medium text-slate-500">/day</span>
              </p>
            </div>
            
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="relative z-10 flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase">Health Score</h3>
                <ActivitySquare className="h-4 w-4 text-teal-500" />
              </div>
              <p className={`relative z-10 text-3xl font-black ${
                kpis.healthScore >= 80 ? 'text-emerald-400' : kpis.healthScore >= 50 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {kpis.healthScore}%
              </p>
              {/* Background fill based on health score */}
              <div className="absolute bottom-0 left-0 h-1 bg-slate-800 w-full">
                <div 
                  className={`h-full ${kpis.healthScore >= 80 ? 'bg-emerald-500' : kpis.healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                  style={{ width: `${kpis.healthScore}%` }}
                />
              </div>
            </div>
          </section>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Left: Resource Table */}
            <div className="xl:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col min-h-[500px]">
              <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80">
                <h2 className="text-lg font-bold text-white">Resource Inventory</h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input 
                    type="text"
                    placeholder="Search resources..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-950/50 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("name")}>
                        <div className="flex items-center gap-1">Resource <ArrowUpDown className="h-3 w-3"/></div>
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("available_qty")}>
                        <div className="flex items-center gap-1">Available Qty <ArrowUpDown className="h-3 w-3"/></div>
                      </th>
                      <th className="px-6 py-4">Min Threshold</th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("burn_rate")}>
                        <div className="flex items-center gap-1">Burn Rate <ArrowUpDown className="h-3 w-3"/></div>
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("status")}>
                        <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3"/></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredAndSortedResources.length > 0 ? (
                      filteredAndSortedResources.map((res) => (
                        <tr key={res.item_code} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{res.name}</div>
                            <div className="text-xs text-slate-500">{res.item_code}</div>
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-300">
                            {res.available_qty} <span className="text-xs text-slate-500">{res.metadata.unit}</span>
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-500">
                            {res.min_threshold}
                          </td>
                          <td className="px-6 py-4 font-mono text-amber-400/90">
                            {res.burn_rate || 0} <span className="text-[10px] text-slate-500">/day</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                              res.metadata.status === 'CRITICAL' 
                                ? 'bg-red-950/50 text-red-400 border-red-900/50' 
                                : res.metadata.status === 'WARNING'
                                ? 'bg-amber-950/50 text-amber-400 border-amber-900/50'
                                : 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50'
                            }`}>
                              {res.metadata.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No resources found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Recent Activity */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col h-[500px] xl:h-auto max-h-[600px]">
              <div className="p-5 border-b border-slate-800 bg-slate-900/80">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-teal-500" />
                  Recent Activity
                </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 relative">
                {activities.length > 0 ? (
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
                    {activities.map((log, i) => (
                      <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#070b19] bg-slate-800 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2 -translate-x-1/2">
                          {log.quantity_change > 0 ? (
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                          )}
                        </div>
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] ml-12 md:ml-0 p-4 rounded-xl border border-slate-800 bg-slate-900/80 shadow-sm transition-colors hover:border-slate-700">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-white text-sm truncate">{log.resource_name}</span>
                            <span className={`font-mono text-xs font-bold ${log.quantity_change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 uppercase tracking-wider font-semibold">{log.action}</span>
                            <time className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 px-4">
                    <CheckCircle className="h-8 w-8 text-slate-700 mb-3" />
                    <p className="text-sm">No recent transactions found for this location.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}

