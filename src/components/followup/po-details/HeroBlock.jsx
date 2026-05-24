import React from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import { fmtDate } from '@/lib/followUpConstants';
import StatusBadge from '../StatusBadge';
import PriorityBadge from '../PriorityBadge';

export default function HeroBlock({ po }) {
  const countdown = po.countdown;
  const isLate = po.late_future === 'LATE';
  const isReceived = po.late_future === 'RECEIVED';
  const daysLate = po.days_late_counting;

  // Color the hero based on urgency
  const heroState = isReceived
    ? { bg: 'bg-green-50', border: 'border-green-200', accent: 'text-green-600' }
    : po.urgent
    ? { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-600' }
    : isLate
    ? { bg: 'bg-red-50', border: 'border-red-200', accent: 'text-red-500' }
    : countdown != null && countdown <= 3
    ? { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'text-orange-500' }
    : { bg: 'bg-green-50', border: 'border-green-200', accent: 'text-green-600' };

  const countdownLabel = isReceived
    ? 'Goods received'
    : countdown == null ? '—'
    : countdown < 0 ? `${Math.abs(countdown)}d late`
    : countdown === 0 ? 'Due today'
    : `${countdown}d left`;

  return (
    <div className={`px-5 py-4 border-b border-[#E5E5E5] ${heroState.bg}`}>
      {/* Status row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <StatusBadge status={po.current_status} />
        <PriorityBadge priority={po.priority} />
        {po.flags && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${po.flags === 'URGENT' ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-red-100 text-red-600 border border-red-300'}`}>
            {po.flags === 'URGENT' && <AlertTriangle size={9} />}
            {po.flags}
          </span>
        )}
        {isReceived && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700 border border-green-300">
            RECEIVED
          </span>
        )}
        {isLate && !isReceived && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-600 border border-red-300">
            LATE
          </span>
        )}
      </div>

      {/* Big countdown */}
      <div className="flex items-baseline gap-3 mb-3">
        <div className={`text-[28px] font-bold leading-none ${heroState.accent}`}>
          {countdownLabel}
        </div>
        {daysLate > 0 && (
          <div className="text-[12px] font-medium text-red-500">
            +{daysLate}d vs original
          </div>
        )}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <DateChip label="Original DD" date={po.due_date} />
        <DateChip label="Delayed DD" date={po.effective_delayed_due_date} highlight />
        <DateChip label="Final DD" date={po.final_dd} bold />
      </div>
    </div>
  );
}

function DateChip({ label, date, highlight = false, bold = false }) {
  return (
    <div className="bg-white/70 rounded-[6px] px-2 py-1.5 border border-white">
      <div className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] mb-0.5 flex items-center gap-1">
        <Calendar size={8} />
        {label}
      </div>
      <div className={`font-mono text-[12px] ${highlight ? 'text-[#E31B7F] font-bold' : bold ? 'font-bold text-[#0A0A0A]' : 'text-[#525252]'}`}>
        {date ? fmtDate(date) : '—'}
      </div>
    </div>
  );
}