import React from "react";
import ReactECharts from "echarts-for-react";

interface WarehouseCardProps {
  data: {
    center_id: string;
    center_name: string;
    health_score: number;
    last_updated: string;
    critical_resource_count: number;
    burn_rate_change: number;
    sparkline: number[];
  };
  selected: boolean;
  onClick: () => void;
}

export default function WarehouseCard({ data, selected, onClick }: WarehouseCardProps) {
  const sparklineOption = {
    xAxis: { type: "category", show: false },
    yAxis: { type: "value", show: false },
    series: [
      {
        data: data.sparkline,
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: {
          color: data.burn_rate_change > 0 ? "#ef4444" : "#10b981",
          width: 2,
        },
      },
    ],
    grid: { top: 5, bottom: 5, left: 0, right: 0 },
    animation: false,
  };

  return (
    <div
      onClick={onClick}
      className={`min-w-[280px] cursor-pointer p-4 rounded-xl border transition-all duration-300 ${
        selected
          ? "bg-teal-900/40 border-teal-500 shadow-lg shadow-teal-900/20"
          : "bg-slate-800/40 border-slate-700 hover:bg-slate-800/80 hover:border-slate-600"
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-slate-100">{data.center_name}</h3>
          <p className="text-xs text-slate-400">ID: {data.center_id}</p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold ${
          data.health_score > 80 ? 'bg-green-500/20 text-green-400' :
          data.health_score > 50 ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {data.health_score}%
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 my-4 text-sm">
        <div>
          <p className="text-slate-400 text-xs">Critical</p>
          <p className="font-medium text-red-400">{data.critical_resource_count} items</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Burn Rate</p>
          <p className={`font-medium ${data.burn_rate_change > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {data.burn_rate_change > 0 ? '↑' : '↓'} {Math.abs(data.burn_rate_change)}%
          </p>
        </div>
      </div>

      <div className="h-10 mt-2">
        <ReactECharts option={sparklineOption} style={{ height: "100%", width: "100%" }} />
      </div>

      <div className="text-right mt-2">
        <p className="text-[10px] text-slate-500">Updated: {new Date(data.last_updated).toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
