"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Terminal,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Clock,
  Monitor,
  Globe,
  Shield,
} from "lucide-react";

type LogEntry = {
  id: number;
  timestamp: string;
  user_email: string;
  ip_address: string;
  action: string;
  os: string;
  client: string;
};

export default function SettingsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fetchLogs = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/logs", { signal });
      if (res.ok) {
        const data = await res.json();
        if (!signal?.aborted) {
          setLogs(data.logs || []);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Failed to fetch logs:", err);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Auto-cleanup old logs on mount, then fetch
  useEffect(() => {
    const controller = new AbortController();
    const init = async () => {
      try {
        await fetch("/api/logs/cleanup", { method: "DELETE", signal: controller.signal });
      } catch {}
      fetchLogs(controller.signal);
    };
    init();
    return () => {
      controller.abort();
    };
  }, [fetchLogs]);

  useEffect(() => {
    const handleRefresh = () => fetchLogs();
    const handleClear = () => setShowClearConfirm(true);

    window.addEventListener("logs:refresh", handleRefresh);
    window.addEventListener("logs:clear", handleClear);

    return () => {
      window.removeEventListener("logs:refresh", handleRefresh);
      window.removeEventListener("logs:clear", handleClear);
    };
  }, [fetchLogs]);

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      await fetch("/api/logs", { method: "DELETE" });
      setLogs([]);
    } catch (err) {
      console.error("Failed to clear logs:", err);
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      timeZone: "Asia/Colombo",
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/15 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Clear All Logs?
              </h3>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              This will permanently delete all system activity logs. This
              action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-medium transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLogs}
                disabled={clearing}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
              >
                {clearing ? "Clearing..." : "Clear All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[200px_1fr_2fr_1fr] gap-4 px-6 py-3.5 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            Timestamp
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            User
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5" />
            Task / Action
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider justify-end">
            <Monitor className="w-3.5 h-3.5" />
            OS & Client
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="px-6 py-16 text-center">
            <RefreshCw className="w-6 h-6 text-gray-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Terminal className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              No activity logs found
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Actions performed in the admin panel will appear here
            </p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-18rem)] overflow-y-auto">
            {logs.map((log, idx) => (
              <div
                key={log.id}
                className={`grid grid-cols-[200px_1fr_2fr_1fr] gap-4 px-6 py-4 items-center transition-colors duration-100 hover:bg-white/[0.03] ${
                  idx !== logs.length - 1
                    ? "border-b border-white/5"
                    : ""
                }`}
              >
                {/* Timestamp */}
                <div className="text-sm text-gray-300 font-medium tabular-nums">
                  {formatTimestamp(log.timestamp)}
                </div>

                {/* User */}
                <div>
                  <div className="text-sm text-white font-medium">
                    {log.user_email || "System"}
                  </div>
                  {log.ip_address && (
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">
                      {log.ip_address}
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="text-sm text-gray-300 leading-relaxed">
                  {log.action}
                </div>

                {/* OS & Client */}
                <div className="flex items-center gap-2 justify-end flex-wrap">
                  {log.os && (
                    <span className="px-2.5 py-1 bg-white/[0.06] border border-white/10 rounded-lg text-xs text-gray-300 font-medium">
                      {log.os}
                    </span>
                  )}
                  {log.client && (
                    <span className="px-2.5 py-1 bg-white/[0.06] border border-white/10 rounded-lg text-xs text-gray-300 font-medium">
                      {log.client}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      {!loading && logs.length > 0 && (
        <p className="text-xs text-gray-600 mt-3 px-1">
          Showing {logs.length} log{logs.length !== 1 ? "s" : ""}. Logs
          older than 3 months are automatically deleted.
        </p>
      )}
    </div>
  );
}
