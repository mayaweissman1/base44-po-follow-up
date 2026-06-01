import React, { useMemo } from 'react';
import { X } from 'lucide-react';

export default function LeaderboardDrawer({ title, stats, sort = 'late', onClose }) {
  const sorted = useMemo(() => {
    const arr = [...stats];
    if (sort === 'late')     arr.sort((a, b) => b.latePct - a.latePct || b.late - a.late);
    if (sort === 'ontime')   arr.sort((a, b) => b.ontimePct - a.ontimePct || b.total - a.total);
    if (sort === 'workload') arr.sort((a, b) => b.total - a.total);
    if (sort === 'urgent')   arr.sort((a, b) => b.urgent - a.urgent);
    return arr;
  }, [stats, sort]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto h-full w-[440px] max-w-[calc(100vw-32px)] bg-white shadow-[-4px_0_24px_rgba(0,0,0,.12)] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] flex-shrink-0">
          <div className="text-[14px] font-bold text-[#0A0A0A]">{title}</div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 text-[9px] font-bold text-[#A3A3A3] uppercase tracking-[.08em]">
            <div>Name</div>
            <div className="text-right">Open</div>
            <div className="text-right">Late</div>
            <div className="text-right">On-time</div>
          </div>
          <div className="divide-y divide-[#F0F0F0]">
            {sorted.map(s => (
              <div key={s.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 items-center hover:bg-[#FAFAFA]">
                <div className="text-[12px] font-medium text-[#0A0A0A] truncate" title={s.name}>{s.name}</div>
                <div className="text-[12px] font-mono text-[#525252] text-right">{s.total}</div>
                <div className="text-[12px] font-mono text-right">
                  <span className={s.latePct >= 30 ? 'text-red-600 font-semibold' : 'text-[#525252]'}>
                    {s.late} <span className="text-[10px] text-[#A3A3A3]">({s.latePct}%)</span>
                  </span>
                </div>
                <div className="text-[12px] font-mono text-right">
                  <span className={s.ontimePct >= 80 ? 'text-green-600 font-semibold' : 'text-[#525252]'}>
                    {s.ontimePct}%
                  </span>
                </div>
              </div>
            ))}
            {sorted.length === 0 && (
              <div className="text-center text-[12px] text-[#A3A3A3] py-8">No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}