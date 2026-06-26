"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import dynamic from "next/dynamic";

const FlowMapOverlay = dynamic(() => import("./FlowMapOverlay"), { ssr: false });

interface ComparisonGridProps {
  selectedId: string | null;
  timeFilter: string;
  onTimeChange: (val: string) => void;
}

export default function ComparisonGrid({ selectedId, timeFilter, onTimeChange }: ComparisonGridProps) {
  // Common theme settings for ECharts
  const commonOptions = {
    backgroundColor: "transparent",
    textStyle: { color: "#94a3b8" },
    tooltip: { trigger: "axis", backgroundColor: "#1e293b", borderColor: "#334155", textStyle: { color: "#f8fafc" } },
    grid: { left: "10%", right: "5%", top: "15%", bottom: "15%" },
  };

  // Graph 1: Inventory Depletion Trend (Line Chart)
  const optionGraph1 = useMemo(() => ({
    ...commonOptions,
    xAxis: { type: "category", data: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"] },
    yAxis: { type: "value" },
    series: [
      { data: [5000, 4200, 3100, 1800, 600], type: "line", smooth: true, itemStyle: { color: "#f43f5e" }, areaStyle: { color: "rgba(244, 63, 94, 0.2)" } },
    ],
  }), [timeFilter]);

  // Graph 2: Warehouse Health Comparison (Horizontal Bar)
  const optionGraph2 = useMemo(() => ({
    ...commonOptions,
    grid: { left: "20%", right: "10%", top: "10%", bottom: "10%" },
    xAxis: { type: "value", max: 100 },
    yAxis: { type: "category", data: ["WH-Mum", "WH-Pun", "WH-Nag", "WH-Nas"] },
    series: [
      {
        data: [45, 82, 30, 95],
        type: "bar",
        itemStyle: {
          color: (params: any) => params.value < 50 ? "#ef4444" : params.value < 80 ? "#eab308" : "#10b981",
          borderRadius: [0, 4, 4, 0]
        },
      },
    ],
  }), [timeFilter]);

  // Graph 3: Resource Consumption Trends (Multi-Line)
  const optionGraph3 = useMemo(() => ({
    ...commonOptions,
    legend: { data: ["Medical", "Food", "Rescue"], textStyle: { color: "#cbd5e1" }, top: 0 },
    xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    yAxis: { type: "value" },
    series: [
      { name: "Medical", data: [120, 150, 180, 240, 300], type: "line", smooth: true, itemStyle: { color: "#ef4444" } },
      { name: "Food", data: [400, 380, 450, 500, 600], type: "line", smooth: true, itemStyle: { color: "#eab308" } },
      { name: "Rescue", data: [50, 60, 55, 80, 120], type: "line", smooth: true, itemStyle: { color: "#3b82f6" } },
    ],
  }), [timeFilter]);

  // Graph 4: Predicted Stockout Ranking (Horizontal Bar)
  const optionGraph4 = useMemo(() => ({
    ...commonOptions,
    grid: { left: "25%", right: "10%", top: "10%", bottom: "10%" },
    xAxis: { type: "value", name: "Days Left" },
    yAxis: { type: "category", data: ["Oxygen", "Antibiotics", "Water", "Rations"].reverse() },
    series: [
      {
        data: [0.5, 1.2, 3.5, 5.0].reverse(),
        type: "bar",
        itemStyle: {
          color: (params: any) => params.value < 1 ? "#ef4444" : params.value < 3 ? "#f97316" : "#10b981",
          borderRadius: [0, 4, 4, 0]
        },
      },
    ],
  }), [timeFilter]);

  // Graph 6: Burn Rate vs Stock Left (Scatter)
  const optionGraph6 = useMemo(() => ({
    ...commonOptions,
    xAxis: { type: "value", name: "Days Left", nameLocation: "middle", nameGap: 25 },
    yAxis: { type: "value", name: "Burn Rate/day", nameLocation: "middle", nameGap: 35 },
    series: [
      {
        symbolSize: 12,
        data: [
          [0.5, 500], [1.2, 300], [3.5, 100], [5.0, 50], [0.8, 450], [2.1, 200]
        ],
        type: "scatter",
        itemStyle: {
          color: (params: any) => params.value[0] < 2 && params.value[1] > 200 ? "#ef4444" : "#3b82f6"
        }
      }
    ],
  }), [timeFilter]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Row 1 */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Inventory Depletion Trend</h3>
        <div className="h-64"><ReactECharts option={optionGraph1} style={{ height: "100%", width: "100%" }} /></div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Health Comparison</h3>
        <div className="h-64"><ReactECharts option={optionGraph2} style={{ height: "100%", width: "100%" }} /></div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Consumption Trends</h3>
        <div className="h-64"><ReactECharts option={optionGraph3} style={{ height: "100%", width: "100%" }} /></div>
      </div>

      {/* Row 2 */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Predicted Stockout</h3>
        <div className="h-64"><ReactECharts option={optionGraph4} style={{ height: "100%", width: "100%" }} /></div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Resource Flow</h3>
        <div className="h-64"><FlowMapOverlay /></div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Burn Rate vs Stock Left</h3>
        <div className="h-64"><ReactECharts option={optionGraph6} style={{ height: "100%", width: "100%" }} /></div>
      </div>
    </div>
  );
}
