import React, { useMemo } from 'react';
import { REASON_TO_RESPONSIBILITY } from '@/lib/followUpConstants';

export default function HoldsResponsibilityCard({ rows }) {
  const { respCounts, holdsTotal } = useMemo(() => {
    const holds = rows.filter(r => r.current_status === 'HOLD');
    const counts = { OTHER: 0, EDIKTED: 0, SUPPLIER: 0 };
    holds.forEach(r => {
      const resp = REASON_TO_RESPONSIBILITY[r.ddd_reason] || 'OTHER';
      counts[resp]++;
    });
    return { respCounts: counts, holdsTotal: holds.length };
  }, [rows]);

  return (
    <div className="relative bg-white border border-[#E5E5E5] min-w-0 flex flex-col px-4 pt-4 pb-4 rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="text-[10px] font-bold text-[#525252] uppercase tracking-[.06em] truncate">HOLDs by responsibility</div>
      {holdsTotal === 0 ? (
        <>
          <div className="font-mono font-bold leading-none text-2xl mt-1.5 text-[#A3A3A3]">0</div>
          <div className="text-[11px] text-[#A3A3A3] mt-1">No active HOLDs</div>
        </>
      ) : (
        <div className="mt-2">
          <div className="flex h-1.5 rounded-full overflow-hidden mb-2 bg-[#E5E5E5]">
            <span style={{ width: `${(respCounts.OTHER / holdsTotal) * 100}%`, background: '#F59E0B' }} />
            <span style={{ width: `${(respCounts.EDIKTED / holdsTotal) * 100}%`, background: '#8B5CF6' }} />
            <span style={{ width: `${(respCounts.SUPPLIER / holdsTotal) * 100}%`, background: '#EF4444' }} />
          </div>
          <div className="flex items-center justify-between gap-1 text-[10px]">
            <div className="flex items-center gap-1 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="font-mono font-bold text-[#0A0A0A]">{respCounts.OTHER}</span>
              <span className="text-[#A3A3A3] truncate">Other</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
              <span className="font-mono font-bold text-[#0A0A0A]">{respCounts.EDIKTED}</span>
              <span className="text-[#A3A3A3] truncate">Edikted</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              <span className="font-mono font-bold text-[#0A0A0A]">{respCounts.SUPPLIER}</span>
              <span className="text-[#A3A3A3] truncate">Supplier</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}