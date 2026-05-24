import React from 'react';
import { ddmm } from '@/lib/followUpConstants';

export default function TimelineBlock({ log }) {
  if (!log || log.length === 0) return null;
  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-3">Activity Timeline</div>
      <div className="space-y-2.5 relative">
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[#E5E5E5]" />
        {log.map((e, i) => (
          <div key={i} className="flex gap-3 relative">
            <div className="w-[11px] h-[11px] rounded-full bg-[#FFE5F2] border-2 border-[#E31B7F] flex-shrink-0 mt-0.5 relative z-10" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono font-bold text-[#A3A3A3] uppercase">{ddmm(e.date)}</div>
              <div className="text-[12px] text-[#0A0A0A] leading-snug">{e.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}