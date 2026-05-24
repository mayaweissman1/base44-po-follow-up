import React from 'react';

/**
 * Visualizes purchase order production metrics in a clear, organized layout.
 * Shows ordered vs received as headline + progress bar, with all secondary
 * metrics (sent out, GFS, balance, air OTW, auto RW) in a structured grid.
 */
export default function ProgressBlock({ ordered, received, sentOut, gfs, airOtw, autoRw }) {
  const orderedN = Number(ordered) || 0;
  const receivedN = Number(received) || 0;
  const sentN = Number(sentOut) || 0;
  const gfsN = Number(gfs) || 0;
  const airN = Number(airOtw) || 0;
  const autoRwN = Number(autoRw) || 0;
  const balanceN = Math.max(0, orderedN - receivedN);

  const receivedPct = orderedN > 0 ? Math.min(100, Math.round((receivedN / orderedN) * 100)) : 0;
  const overReceived = receivedN > orderedN;

  // color logic for received %
  const pctColor = receivedPct >= 100 ? 'text-green-600' : receivedPct >= 50 ? 'text-[#E31B7F]' : 'text-[#525252]';

  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-3">Production Progress</div>

      {/* Headline: Received / Ordered + % */}
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-[20px] font-bold text-[#0A0A0A] font-mono leading-none">
            {receivedN.toLocaleString()}
            <span className="text-[#A3A3A3] font-medium text-[14px]"> / {orderedN.toLocaleString()}</span>
          </div>
          <div className="text-[11px] text-[#525252] mt-1">received of ordered</div>
        </div>
        <div className="text-right">
          <div className={`text-[20px] font-bold font-mono leading-none ${pctColor}`}>
            {receivedPct}%
          </div>
          <div className="text-[11px] text-[#525252] mt-1">{overReceived ? 'over-received' : 'received'}</div>
        </div>
      </div>

      {/* Progress bar — received portion */}
      <div className="relative h-2 bg-[#F0F0F0] rounded-full overflow-hidden mb-4">
        <div
          className={`absolute top-0 left-0 h-full ${overReceived ? 'bg-amber-400' : 'bg-[#E31B7F]'}`}
          style={{ width: `${receivedPct}%` }}
        />
      </div>

      {/* Metrics grid — all related qty data */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Metric label="Sent Out" value={sentN} dot="bg-[#E31B7F]" />
        <Metric label="Good For Sale" value={gfsN} accent={gfsN > 0 ? 'text-green-600' : 'text-[#0A0A0A]'} />
        <Metric label="Balance" value={balanceN} hint="ordered − received" />
        <Metric label="Air OTW" value={airN} accent={airN > 0 ? 'text-blue-600' : 'text-[#A3A3A3]'} />
        <Metric label="Auto RW" value={autoRwN} accent={autoRwN > 0 ? 'text-red-500' : 'text-[#A3A3A3]'} />
      </div>
    </div>
  );
}

function Metric({ label, value, dot, accent, hint }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />}
      <div className="flex-1 min-w-0">
        <div className="text-[#A3A3A3] uppercase tracking-[.06em] text-[9px] font-bold truncate">{label}</div>
        {hint && <div className="text-[9px] text-[#C4C4C4] mt-0.5 truncate">{hint}</div>}
      </div>
      <span className={`font-mono font-semibold text-[13px] ${accent || 'text-[#0A0A0A]'}`}>
        {(value ?? 0).toLocaleString()}
      </span>
    </div>
  );
}