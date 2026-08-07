"use client";

import { Calendar } from "lucide-react";

interface DateRangeSelectorProps {
  dateRange: string;
  startDate: string;
  endDate: string;
  onRangeChange: (range: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export default function DateRangeSelector({
  dateRange,
  startDate,
  endDate,
  onRangeChange,
  onStartDateChange,
  onEndDateChange
}: DateRangeSelectorProps) {
  
  const handleRangeChange = (range: string) => {
    onRangeChange(range);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (range === "this year") {
      onStartDateChange(`${today.getFullYear()}-01-01`);
      onEndDateChange(todayStr);
    } else if (range === "6 months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      onStartDateChange(d.toISOString().split("T")[0]);
      onEndDateChange(todayStr);
    } else if (range === "three months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      onStartDateChange(d.toISOString().split("T")[0]);
      onEndDateChange(todayStr);
    } else if (range === "one month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      onStartDateChange(d.toISOString().split("T")[0]);
      onEndDateChange(todayStr);
    } else if (range === "custom") {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      let fyStartYear = currentYear;
      let fyEndYear = currentYear + 1;
      if (currentMonth < 3) { // Jan, Feb, Mar
        fyStartYear = currentYear - 1;
        fyEndYear = currentYear;
      }
      onStartDateChange(`${fyStartYear}-04-01`);
      onEndDateChange(`${fyEndYear}-03-31`);
    } else if (range === "lifetime") {
      onStartDateChange("1970-01-01");
      onEndDateChange("2099-12-31");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex items-center">
        <select
          value={dateRange}
          onChange={(e) => handleRangeChange(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2 outline-none focus:border-brand-500 transition-colors appearance-none cursor-pointer text-sm font-medium text-white"
        >
          <option value="lifetime" className="bg-brand-900 text-white">Lifetime</option>
          <option value="this year" className="bg-brand-900 text-white">This Year</option>
          <option value="6 months" className="bg-brand-900 text-white">Last 6 Months</option>
          <option value="three months" className="bg-brand-900 text-white">Last 3 Months</option>
          <option value="one month" className="bg-brand-900 text-white">Last Month</option>
          <option value="custom" className="bg-brand-900 text-white">Custom Range</option>
        </select>
        <span className="absolute right-4 pointer-events-none text-gray-400">
          <ChevronIcon />
        </span>
      </div>

      {dateRange === "custom" && (
        <div className="flex items-center gap-2 animate-in slide-in-from-left duration-200">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none focus:border-brand-500 transition-colors text-sm text-white"
          />
          <span className="text-gray-400 text-xs uppercase font-semibold">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none focus:border-brand-500 transition-colors text-sm text-white"
          />
        </div>
      )}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}
