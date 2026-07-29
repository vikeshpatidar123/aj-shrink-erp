"use client";
import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Select } from "@/components/ui/Input";

interface CustomerSelectFieldProps {
  label?: string;
  value: string | number | readonly string[];
  options: { value: string; label: string }[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  error?: string;
}

export function CustomerSelectField({
  label = "Customer / Client Name *",
  value,
  options,
  onChange,
  onRefresh,
  disabled,
  error,
}: CustomerSelectFieldProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Label row with action buttons */}
      <div className="flex items-center justify-between mb-0.5">
        <label className="block text-xs font-medium text-[rgb(var(--fg-default))]">
          {label}
        </label>
        <div className="flex items-center gap-1">
          {/* + New — opens ledger master in new tab */}
          <a
            href="/masters/employees"
            target="_blank"
            rel="noopener noreferrer"
            title="Add new client in Ledger Master"
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold
              bg-indigo-50 text-indigo-600 border border-indigo-200
              hover:bg-indigo-100 hover:border-indigo-300 transition-colors select-none"
          >
            <Plus size={10} strokeWidth={2.5} />
            New
          </a>
          {/* Refresh — re-fetches dropdown list */}
          <button
            type="button"
            title="Refresh customer list"
            onClick={handleRefresh}
            disabled={refreshing || disabled}
            className="p-1 rounded border border-gray-200 text-gray-400
              hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Select without label (label handled above) */}
      <Select
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        error={error}
      />
    </div>
  );
}
