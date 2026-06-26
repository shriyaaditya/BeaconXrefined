// frontend/src/app/analyze/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import WarehouseCard from "@/components/analysis/WarehouseCard";
import ComparisonGrid from "@/components/analysis/ComparisonGrid";
import DeepDivePanel from "@/components/analysis/DeepDivePanel";
import TimeFilter from "@/components/analysis/TimeFilter";

interface OverviewWarehouse {
  center_id: string;
  center_name: string;
  district: string;
  region: string;
  last_updated: string;
  health_score: number;
  critical_resource_count: number;
  burn_rate_change: number;
  sparkline: number[];
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
  historical?: {
    total_consumed: number;
    avg_burn_rate: number;
  };
}

export default function Analyze() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";
  const [overview, setOverview] = useState<OverviewWarehouse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warehouseData, setWarehouseData] = useState<ResourceDetail[]>([]);
  const [timeFilter, setTimeFilter] = useState<string>("30d");

  // Fetch overview on mount
  useEffect(() => {
    fetch(`${apiBase}/api/analysis/overview`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success") setOverview(d.data);
      })
      .catch(console.error);
  }, []);

  // Fetch deep‑dive data when a warehouse is selected
  useEffect(() => {
    if (!selectedId) return;
    fetch(`${apiBase}/api/analysis/warehouse/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success") setWarehouseData(d.data.resources);
      })
      .catch(console.error);
  }, [selectedId, timeFilter]);

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 font-sans p-6">
      {/* Header */}
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-teal-400">Warehouse Analysis</h1>
        <p className="text-xs text-slate-400">Historical trends & intelligence – no real‑time overlay</p>
      </header>

      {/* Top – horizontally scrollable rail */}
      <section className="mb-8 overflow-x-auto whitespace-nowrap">
        <div className="flex gap-4">
          {overview.map((w) => (
            <WarehouseCard
              key={w.center_id}
              data={w}
              selected={selectedId === w.center_id}
              onClick={() => setSelectedId(w.center_id)}
            />
          ))}
        </div>
      </section>

      {/* Middle – comparison grid */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-teal-300 mb-3">Warehouse Intelligence Comparison</h2>
        <ComparisonGrid selectedId={selectedId} timeFilter={timeFilter} onTimeChange={setTimeFilter} />
      </section>

      {/* Bottom – deep‑dive */}
      <section>
        {selectedId && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-teal-300">Warehouse Deep Dive – {selectedId}</h2>
              <TimeFilter value={timeFilter} onChange={setTimeFilter} />
            </div>
            <DeepDivePanel resources={warehouseData} />
          </>
        )}
        {!selectedId && (
          <p className="text-center text-slate-400">Select a warehouse from the rail above to view detailed analytics.</p>
        )}
      </section>
    </div>
  );
}
