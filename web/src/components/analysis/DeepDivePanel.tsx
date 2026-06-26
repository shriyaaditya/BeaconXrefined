import React, { useState } from "react";

interface Resource {
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

interface DeepDivePanelProps {
  resources: Resource[];
}

export default function DeepDivePanel({ resources }: DeepDivePanelProps) {
  const [showOther, setShowOther] = useState(false);

  // Fallback if data is missing
  const data = resources && resources.length > 0 ? resources : [
    { item_code: "OXY1", name: "Oxygen Cylinder", available_qty: 120, min_threshold: 500, metadata: { category: "Medical", unit: "L", status: "CRITICAL" }, burn_rate: 150, runout_hours: 19.2, last_updated: new Date().toISOString() },
    { item_code: "MED1", name: "First Aid Kits", available_qty: 450, min_threshold: 300, metadata: { category: "Medical", unit: "kits", status: "NORMAL" }, burn_rate: 20, runout_hours: 540, last_updated: new Date().toISOString() },
    { item_code: "FOD1", name: "MRE Packs", available_qty: 80, min_threshold: 1000, metadata: { category: "Food", unit: "packs", status: "CRITICAL" }, burn_rate: 300, runout_hours: 6.4, last_updated: new Date().toISOString() },
  ];

  // Sort by urgency (runout_hours)
  const sorted = [...data].sort((a, b) => (a.runout_hours || Infinity) - (b.runout_hours || Infinity));
  
  const critical = sorted.filter((r) => r.metadata.status === "CRITICAL" || (r.runout_hours && r.runout_hours < 24));
  const other = sorted.filter((r) => r.metadata.status !== "CRITICAL" && (!r.runout_hours || r.runout_hours >= 24));

  const ResourceRow = ({ r }: { r: Resource }) => (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 mb-3 flex items-center justify-between">
      <div className="w-1/4">
        <h4 className="font-semibold text-slate-200">{r.name}</h4>
        <p className="text-xs text-slate-500">{r.item_code} • {r.metadata.category}</p>
      </div>
      
      <div className="w-1/3 px-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">Available: {r.available_qty} {r.metadata.unit}</span>
          <span className="text-slate-500">Min: {r.min_threshold}</span>
        </div>
        <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${r.available_qty < r.min_threshold ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min(100, (r.available_qty / Math.max(r.min_threshold, 1)) * 100)}%` }}
          />
        </div>
      </div>

      <div className="w-1/6 text-center">
        <p className="text-xs text-slate-400">Burn Rate</p>
        <p className="font-medium text-slate-200">{r.burn_rate} <span className="text-[10px] text-slate-500">/day</span></p>
      </div>

      <div className="w-1/6 text-right">
        <p className="text-xs text-slate-400">Est. Runout</p>
        <p className={`font-bold ${r.runout_hours && r.runout_hours < 24 ? 'text-red-400' : 'text-emerald-400'}`}>
          {r.runout_hours ? (r.runout_hours < 24 ? `${r.runout_hours.toFixed(1)} hrs` : `${(r.runout_hours/24).toFixed(1)} days`) : 'N/A'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
      <h3 className="text-md font-semibold text-red-400 mb-4 flex items-center">
        <span className="h-2 w-2 rounded-full bg-red-500 mr-2 animate-pulse"></span>
        Critical Inventory
      </h3>
      <div>
        {critical.length > 0 ? critical.map((r, idx) => <ResourceRow key={idx} r={r} />) : <p className="text-slate-500 text-sm">No critical items found.</p>}
      </div>

      <div className="mt-6">
        <button 
          onClick={() => setShowOther(!showOther)}
          className="text-sm text-teal-400 hover:text-teal-300 font-medium flex items-center transition-colors"
        >
          {showOther ? 'Hide' : 'Show'} Other Inventory ({other.length})
        </button>
        
        {showOther && (
          <div className="mt-4 opacity-80">
            {other.map((r, idx) => <ResourceRow key={idx} r={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
