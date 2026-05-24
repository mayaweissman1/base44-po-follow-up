import React from 'react';

/**
 * Visualizes ordered → received → sent out as a stacked progress bar
 * with key derived metrics on top.
 */
export default function ProgressBlock({ ordered, received, sentOut, gfs, airOtw, autoRw, shippedPct }) {
  const orderedN = Number(ordered) || 0;
  const receivedN = Number(received) || 0;
  const sentN = Number(sentOut) || 0;

  const receivedPct = orderedN > 0 ? Math.min(100, (receivedN / orderedN) * 100) : 0;
  const sentPct = orderedN > 0 ? Math.min(100, (sentN / orderedN) * 100) : 0;
  const overReceived = receivedN > orderedN;

  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-3">Production Progress</div>

      {/* Headline numbers */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[20px] font-bold text-[#0A0A0A] font-mono leading-none">
            {receivedN.toLocaleString()}
            <span className="text-[#A3A3A3] font-medium text-[14px]"> / {orderedN.toLocaleString()}</span>
          </div>
          <div className="text-[11px] text-[#525252] mt-1">received of ordered</div>
        </div>
        {shippedPct != null && (
          <div className="text-right">
            <div className={`text-[20px] font-bold font-mono leading-none ${shippedPct >= 100 ? 'text-green-600' : shippedPct >= 50 ? 'text-[#E31B7F]' : 'text-[#525252]'}`}>
              {shippedPct}%
            </div>
            <div className="text-[11px] text-[#525252] mt-1">shipped</div>
          </div>
        )}
      </div>

      {/* Stacked bar */}
      <div className="relative h-2 bg-[#F0F0F0] rounded-full overflow-hidden mb-3">
        <div
          className={`absolute top-0 left-0 h-full ${overReceived ? 'bg-amber-400' : 'bg-[#FFE5F2]'}`}
          style={{ width: `${receivedPct}%` }}
        />
        <div
          className="absolute top-0 left-0 h-full bg-[#E31B7F]"
          style={{ width: `${sentPct}%` }}
        />
      </div>

      {/* Legend / sub-metrics */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <Metric label="Sent Out" value={sentOut} dot="bg-[#E31B7F]" />
        <Metric label="Good For Sale" value={gfs} />
        {Number(airOtw) > 0 && <Metric label="Air OTW" value={airOtw} accent="text-blue-600" />}
        {Number(autoRw) > 0 && <Metric label="Auto RW" value={autoRw} accent="text-red-500" />}
      </div>
    </div>
  );
}

function Metric({ label, value, dot, accent }) {
  return (
    <div className="flex items-center gap-2">
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />}
      <span className="text-[#A3A3A3] uppercase tracking-[.06em] text-[9px] font-bold flex-1">{label}</span>
      <span className={`font-mono font-semibold text-[12px] ${accent || 'text-[#0A0A0A]'}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}