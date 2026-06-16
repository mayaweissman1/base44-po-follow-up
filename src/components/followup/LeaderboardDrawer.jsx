import React, { useMemo } from 'react';
import { X } from 'lucide-react';

// Shared grid template — single source of truth so header + rows always align.
// Name (flex) | Open | Late | On-time | Urgent
const GRID = 'grid grid-cols-[1fr_56px_88px_64px_56px] gap-x-3 items-center';

export default function LeaderboardDrawer({ title, stats, sort = 'late', onClose }) {
  const sorted = useMemo(() => {
    // Sort keys must match the InsightsStrip leader logic exactly so the #1 row
    // in the drawer is the same entity highlighted as "Top …" in the strip.
    let arr = [...stats];
    // % sorts qualify with ≥5 POs (matches strip); absolute-count sorts do not.
    if (sort === 'latePct' || sort === 'ontime') {
      arr = arr.filter(s => s.total >= 5);
    }
    if (sort === 'latePct')  arr.sort((a, b) => b.latePct - a.latePct || b.late - a.late);
    if (sort === 'lateAbs')  arr.sort((a, b) => b.late - a.late || b.total - a.total);
    if (sort === 'ontime')   arr.sort((a, b) => b.ontimePct - a.ontimePct || b.total - a.total);
    if (sort === 'workload') arr.sort((a, b) => b.total - a.total);
    if (sort === 'urgent')   arr.sort((a, b) => b.urgent - a.urgent || b.total - a.total);
    return arr;
  }, [stats, sort]);

  // Color helpers — values pop based on severity
  const lateClass    = pct => pct >= 30 ? 'text-red-600 font-semibold' : pct >= 15 ? 'text-amber-600 font-semibold' : 'text-[#525252]';
  const ontimeClass  = pct => pct >= 90 ? 'text-green-600 font-bold' : pct >= 70 ? 'text-green-600 font-semibold' : pct >= 50 ? 'text-amber-600' : 'text-red-500';
  const urgentClass  = n   => n >= 5 ? 'text-red-600 font-bold' : n > 0 ? 'text-amber-600 font-semibold' : 'text-[#A3A3A3]';

  // Top-3 rank chip color
  const rankBg = i => i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-700' : i === 2 ? 'bg-orange-50 text-orange-700' : 'bg-[#FAFAFA] text-[#A3A3A3]';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto h-full w-[480px] max-w-[calc(100vw-32px)] bg-white shadow-[-4px_0_24px_rgba(0,0,0,.12)] flex flex-col">
        {/* Sticky title bar */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#E5E5E5] flex-shrink-0 bg-white">
          <div>
            <div className="text-[14px] font-bold text-[#0A0A0A]">{title}</div>
            {(sort === 'latePct' || sort === 'ontime') && (
              <div className="text-[10.5px] text-[#A3A3A3] mt-0.5">Showing entries with 5+ open POs</div>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Sticky column headers — stays put as the list scrolls */}
        <div className={`${GRID} px-5 py-2 text-[9px] font-bold text-[#525252] uppercase tracking-[.08em] bg-[#FAFAFA] border-b border-[#E5E5E5] flex-shrink-0`}>
          <div className="pl-7">Name</div>
          <div className="text-right">Open</div>
          <div className="text-right">Late</div>
          <div className="text-right">On-time</div>
          <div className="text-right">Urgent</div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {sorted.map((s, i) => (
            <div key={s.name} className={`${GRID} px-5 py-2 border-b border-[#F0F0F0] hover:bg-[#FFF8FC] transition-colors`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${rankBg(i)}`}>
                  {i + 1}
                </span>
                <span className="text-[12px] font-medium text-[#0A0A0A] truncate" title={s.name}>{s.name}</span>
              </div>
              <div className="text-[12px] font-mono text-[#525252] text-right">{s.total}</div>
              <div className={`text-[12px] font-mono text-right ${lateClass(s.latePct)}`}>
                {s.late} <span className="text-[10px] text-[#A3A3A3] font-normal">({s.latePct}%)</span>
              </div>
              <div className={`text-[12px] font-mono text-right ${ontimeClass(s.ontimePct)}`}>
                {s.ontimePct}%
              </div>
              <div className={`text-[12px] font-mono text-right ${urgentClass(s.urgent)}`}>
                {s.urgent}
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="text-center text-[12px] text-[#A3A3A3] py-8">No data</div>
          )}
        </div>
      </div>
    </div>
  );
}