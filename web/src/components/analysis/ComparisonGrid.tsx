"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import dynamic from "next/dynamic";


interface ComparisonGridProps {
  selectedId: string | null;
  overview: any[];
  warehouseData: any[];
  timeFilter: string;
  onTimeChange: (val: string) => void;
}

export default function ComparisonGrid({ selectedId, overview, warehouseData, timeFilter, onTimeChange }: ComparisonGridProps) {
  // Common theme settings for ECharts
  const commonOptions = {
    backgroundColor: "transparent",
    textStyle: { color: "#94a3b8" },
    tooltip: { trigger: "axis", backgroundColor: "#1e293b", borderColor: "#334155", textStyle: { color: "#f8fafc" } },
    grid: { left: "10%", right: "5%", top: "15%", bottom: "15%" },
  };

  // Graph 1: Inventory Depletion Trend (Line Chart)
  const optionGraph1 = useMemo(() => {
    if (!selectedId || !warehouseData || warehouseData.length === 0) {
      return {
        ...commonOptions,
        xAxis: { type: "category", data: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"] },
        yAxis: { type: "value" },
        series: [
          { data: [5000, 4200, 3100, 1800, 600], type: "line", smooth: true, itemStyle: { color: "#f43f5e" }, areaStyle: { color: "rgba(244, 63, 94, 0.2)" } },
        ],
      };
    }
    // Find the most urgent resource
    const sorted = [...warehouseData].sort((a, b) => (a.runout_hours || Infinity) - (b.runout_hours || Infinity));
    const urgent = sorted[0];
    const qty = urgent.available_qty;
    const rate = urgent.burn_rate || 10;
    const depletionData = [qty, Math.max(0, qty - rate), Math.max(0, qty - rate * 2), Math.max(0, qty - rate * 3), Math.max(0, qty - rate * 4)];
    return {
      ...commonOptions,
      title: { text: `Projected Depletion: ${urgent.name}`, textStyle: { color: "#94a3b8", fontSize: 12 }, left: "center" },
      xAxis: { type: "category", data: ["Now", "Day 1", "Day 2", "Day 3", "Day 4"] },
      yAxis: { type: "value" },
      series: [
        { data: depletionData, type: "line", smooth: true, itemStyle: { color: "#f43f5e" }, areaStyle: { color: "rgba(244, 63, 94, 0.2)" } },
      ],
    };
  }, [selectedId, warehouseData]);

  // Graph 2: Warehouse Health Comparison (Horizontal Bar)
  const optionGraph2 = useMemo(() => {
    if (!overview || overview.length === 0) {
      return {
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
      };
    }
    const displayData = overview.slice(0, 5); // top 5
    const categories = displayData.map(c => c.center_id.replace("wh-", "").toUpperCase());
    const scores = displayData.map(c => c.health_score);

    return {
      ...commonOptions,
      grid: { left: "20%", right: "10%", top: "10%", bottom: "10%" },
      xAxis: { type: "value", max: 100 },
      yAxis: { type: "category", data: categories },
      series: [
        {
          data: scores,
          type: "bar",
          itemStyle: {
            color: (params: any) => params.value < 50 ? "#ef4444" : params.value < 80 ? "#eab308" : "#10b981",
            borderRadius: [0, 4, 4, 0]
          },
        },
      ],
    };
  }, [overview]);

  // Graph 3: Resource Consumption Trends (Multi-Line)
  const optionGraph3 = useMemo(() => {
    if (!selectedId || !warehouseData || warehouseData.length === 0) {
      return {
        ...commonOptions,
        legend: { data: ["Medical", "Food", "Rescue"], textStyle: { color: "#cbd5e1" }, top: 0 },
        xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
        yAxis: { type: "value" },
        series: [
          { name: "Medical", data: [120, 150, 180, 240, 300], type: "line", smooth: true, itemStyle: { color: "#ef4444" } },
          { name: "Food", data: [400, 380, 450, 500, 600], type: "line", smooth: true, itemStyle: { color: "#eab308" } },
          { name: "Rescue", data: [50, 60, 55, 80, 120], type: "line", smooth: true, itemStyle: { color: "#3b82f6" } },
        ],
      };
    }
    const topItems = warehouseData.slice(0, 3);
    const legends = topItems.map(item => item.name);
    const seriesData = topItems.map((item, idx) => {
      const colors = ["#ef4444", "#eab308", "#3b82f6"];
      const total = item.historical?.total_consumed || 100;
      return {
        name: item.name,
        data: [Math.round(total * 0.1), Math.round(total * 0.25), Math.round(total * 0.5), Math.round(total * 0.75), total],
        type: "line",
        smooth: true,
        itemStyle: { color: colors[idx % 3] }
      };
    });
    return {
      ...commonOptions,
      legend: { data: legends, textStyle: { color: "#cbd5e1" }, top: 0 },
      xAxis: { type: "category", data: ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Now"] },
      yAxis: { type: "value" },
      series: seriesData
    };
  }, [selectedId, warehouseData]);

  // Graph 4: Predicted Stockout Ranking (Horizontal Bar)
  const optionGraph4 = useMemo(() => {
    if (!selectedId || !warehouseData || warehouseData.length === 0) {
      return {
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
      };
    }
    const sorted = [...warehouseData]
      .filter(r => r.runout_hours !== null && r.runout_hours !== undefined)
      .sort((a, b) => (a.runout_hours || 0) - (b.runout_hours || 0))
      .slice(0, 4);
    const categories = sorted.map(r => r.name).reverse();
    const days = sorted.map(r => parseFloat(((r.runout_hours || 0) / 24).toFixed(1))).reverse();
    return {
      ...commonOptions,
      grid: { left: "25%", right: "10%", top: "10%", bottom: "10%" },
      xAxis: { type: "value", name: "Days Left" },
      yAxis: { type: "category", data: categories },
      series: [
        {
          data: days,
          type: "bar",
          itemStyle: {
            color: (params: any) => params.value < 1 ? "#ef4444" : params.value < 3 ? "#f97316" : "#10b981",
            borderRadius: [0, 4, 4, 0]
          },
        },
      ],
    };
  }, [selectedId, warehouseData]);

  // Graph 6: Burn Rate vs Stock Left (Scatter)
  const optionGraph6 = useMemo(() => {
    if (!selectedId || !warehouseData || warehouseData.length === 0) {
      return {
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
      };
    }
    const scatterData = warehouseData.map(r => [
      parseFloat(((r.runout_hours || 0) / 24).toFixed(1)),
      r.burn_rate || 0
    ]);
    return {
      ...commonOptions,
      xAxis: { type: "value", name: "Days Left", nameLocation: "middle", nameGap: 25 },
      yAxis: { type: "value", name: "Burn Rate/day", nameLocation: "middle", nameGap: 35 },
      series: [
        {
          symbolSize: 12,
          data: scatterData,
          type: "scatter",
          itemStyle: {
            color: (params: any) => params.value[0] < 2 && params.value[1] > 50 ? "#ef4444" : "#3b82f6"
          }
        }
      ],
    };
  }, [selectedId, warehouseData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Row 1 */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Inventory Depletion Trend</h3>
        <div className="h-64"><ReactECharts option={optionGraph1} style={{ height: "100%", width: "100%" }} /></div>
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


    </div>
  );
}
