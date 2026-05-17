import React from 'react';
import { REASON_TO_RESPONSIBILITY } from '@/lib/followUpConstants';

export default function StatsRow({ rows }) {
  const holds = rows.filter(r => r.current_status === 'HOLD');
  const respCounts = { OTHER: 0, EDIKTED: 0, SUPPLIER: 0 };
  holds.forEach(r => {
    const resp = REASON_TO_RESPONSIBILITY[r.ddd_reason] || 'OTHER';
    respCounts[resp]++;
  });
  const total = Math.max(1, holds.length);

  // Top reason this week
  const reasonCounts = {};
  const supplierCounts = {};
  holds.forEach(r => {
    if (r.ddd_reason) reasonCounts[r.ddd_reason] = (reasonCounts[r.ddd_reason] || 0) + 1;
    if (r.supplier) supplierCounts[r.supplier] = (supplierCounts[r.supplier] || 0) + 1;
  });
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
  const topSupplier = Object.entries(supplierCounts).sort((a, b) => b[1] - a[1])[0] || ['—', 0];

  return (
    <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'minmax(0,50%) minmax(0,25%) minmax(0,25%)' }}>
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="text-[11px] font-bold text-[#525252] uppercase tracking-[.08em] mb-3">HOLDs by responsibility</div>
        <div className="flex h-2 rounded-full overflow-hidden mb-2.5 bg-[#E5E5E5]">
          <span style={{ width: `${(respCounts.OTHER / total) * 100}%`, background: '#F59E0B' }} />
          <span style={{ width: `${(respCounts.EDIKTED / total) * 100}%`, background: '#8B5CF6' }} />
          <span style={{ width: `${(respCounts.SUPPLIER / total) * 100}%`, background: '#EF4444' }} />
        </div>
        <div className="flex gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="font-mono font-semibold text-[#0A0A0A]">{respCounts.OTHER}</span><span className="text-[#525252]">Other</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /><span className="font-mono font-semibold text-[#0A0A0A]">{respCounts.EDIKTED}</span><span className="text-[#525252]">Edikted</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="font-mono font-semibold text-[#0A0A0A]">{respCounts.SUPPLIER}</span><span className="text-[#525252]">Supplier</span></div>
        </div>
      </div>
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="text-[11px] font-bold text-[#525252] uppercase tracking-[.08em] mb-3">Top reason this week</div>
        <div className="text-sm font-semibold text-[#0A0A0A] mb-1 leading-snug">{topReason[0]}</div>
        <div className="font-mono text-xs font-semibold text-[#E31B7F]">{topReason[1]} {topReason[1] === 1 ? 'PO' : 'POs'}</div>
      </div>
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="text-[11px] font-bold text-[#525252] uppercase tracking-[.08em] mb-3">Most delays supplier this week</div>
        <div className="text-sm font-semibold font-mono text-[#0A0A0A] mb-1">{topSupplier[0]}</div>
        <div className="font-mono text-xs font-semibold text-[#E31B7F]">{topSupplier[1]} {topSupplier[1] === 1 ? 'delayed PO' : 'delayed POs'}</div>
      </div>
    </div>
  );
}