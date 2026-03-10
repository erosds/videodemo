import React, { useState, useEffect, useCallback } from "react";
import { LuDownload, LuRefreshCw, LuTrash2 } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

const ACTION_COLORS = {
  ingest: "bg-teal-900/40 text-teal-400 border-teal-800",
  delete: "bg-red-900/40 text-red-400 border-red-800",
  query: "bg-indigo-900/40 text-indigo-400 border-indigo-800",
  sds_extract: "bg-amber-900/40 text-amber-400 border-amber-800",
  batch_compare: "bg-orange-900/40 text-orange-400 border-orange-800",
};

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
};

const EventCard = ({ event }) => {
  const colorClass = ACTION_COLORS[event.action] || "bg-gray-800/40 text-gray-400 border-gray-700";
  const { timestamp, action, ...details } = event;

  return (
    <div className="bg-[#0e0e0e] border border-gray-800 rounded px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded border font-mono uppercase ${colorClass}`}>
          {action}
        </span>
        <span className="text-[10px] text-gray-600 font-mono">{formatDate(timestamp)}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(details).map(([k, v]) => (
          <div key={k} className="text-[10px]">
            <span className="text-gray-600 uppercase tracking-widest">{k}: </span>
            <span className="text-gray-400 font-mono">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AuditTrail = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${BACKEND}/compliance/audit-log`);
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const { events: evts } = await resp.json();
      setEvents(evts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const clearLog = async () => {
    try {
      const resp = await fetch(`${BACKEND}/compliance/audit-log`, { method: "DELETE" });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      setEvents([]);
      setConfirmClear(false);
    } catch (e) {
      setError(e.message);
      setConfirmClear(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance_audit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: "clamp(60px, 10vh, 160px)", paddingBottom: "clamp(40px, 8vh, 120px)" }}
    >
      <div className="w-full max-w-2xl">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div className="text-[10px] uppercase tracking-widest text-gray-600">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchLog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-gray-700 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <LuRefreshCw className="w-3 h-3" />
              Refresh
            </button>
            <button
              onClick={exportJson}
              disabled={events.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-800 text-xs text-green-400 hover:bg-green-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <LuDownload className="w-3 h-3" />
              Export JSON
            </button>
            {confirmClear ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-red-400">Sure?</span>
                <button
                  onClick={clearLog}
                  className="px-2 py-1.5 rounded-lg bg-red-900/40 border border-red-800 text-xs text-red-400 hover:bg-red-900/60 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1.5 rounded-lg bg-white/5 border border-gray-700 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={events.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-900 text-xs text-red-500 hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <LuTrash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {error && <div className="text-xs text-red-500 mb-4">{error}</div>}
        {loading && (
          <div className="text-xs text-gray-600 animate-pulse mb-4">Loading…</div>
        )}

        {events.length === 0 && !loading ? (
          <div className="text-[11px] text-gray-700 text-center mt-8">
            No audit events recorded yet. Upload documents or run queries to see activity here.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((ev, i) => (
              <EventCard key={i} event={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;
