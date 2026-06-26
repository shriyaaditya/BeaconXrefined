import React from "react";

interface TimeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TimeFilter({ value, onChange }: TimeFilterProps) {
  const options = [
    { label: "24h", value: "24h" },
    { label: "7d", value: "7d" },
    { label: "30d", value: "30d" },
  ];

  return (
    <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
            value === opt.value
              ? "bg-teal-600 text-white shadow-md shadow-teal-900/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
