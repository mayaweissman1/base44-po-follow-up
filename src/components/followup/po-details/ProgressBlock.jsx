import React from 'react';

/**
 * Production Progress block — Edikted design system.
 *
 * Shows how the PO is progressing through production:
 *   - Headline: received vs ordered (with % and excess/remaining indicator)
 *   - Progress bar: visual fill with capped 100% + excess overlay
 *   - Metrics grid: Sent Out, Good For Sale, Remaining, Air OTW, Auto RW
 */
export default function ProgressBlock({ ordered, received, sentOut, gfs, airOtw, autoRw }) {
  const orderedN = Number(ordered) || 0;
  const receivedN = Number(received) || 0;
  const sentN = Number(sentOut) || 0;
  const gfsN = Number(gfs) || 0;
  const airN = Number(airOtw) || 0;
  const autoRwN = Number(autoRw) || 0;

  const excess = Math.max(0, receivedN - orderedN);
  const remaining = Math.max(0, orderedN - receivedN);
  const pct = orderedN > 0 ? Math.round((receivedN / orderedN) * 100) : 0;
  const displayPct = Math.min(pct, 100);
  const hasExcess = excess > 0;
  const isComplete = receivedN >= orderedN && orderedN > 0;

  // pct color: green at/over 100, pink mid, gray low
  const pctColor = isComplete ? 'text-green-600' : pct >= 50 ? 'text-[#E31B7F]' : 'text-[#525252]';

  // sub-label under % — describes status concisely, no jargon
  const subLabel = orderedN === 0
    ? 'no order qty'
    : hasExcess
      ? `+${excess.toLocaleString()} extra`
      : isComplete
        ? 'complete'
        : `${remaining.toLocaleString()} to go`;

  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-3">
        Production Progress
      </div>

      {/* Headline */}
      <div className="flex items-baseline justify-between mb-2.5">
        <div>
          <div className="text-[20px] font-bold text-[#0A0A0A] font-mono leading-none">
            {receivedN.toLocaleString()}
            <span className="text-[#A3A3A3] font-medium text-[14px]"> / {orderedN.toLocaleString()}</span>
          </div>
          <div className="text-[11px] text-[#525252] mt-1">received of ordered</div>
        </div>
        <div className="text-right">
          <div className={`text-[20px] font-bold font-mono leading-none ${pctColor}`}>
            {pct}%
          </div>
          <div className={`text-[11px] mt-1 ${hasExcess ? 'text-amber-600 font-medium' : 'text-[#525252]'}`}>
            {subLabel}
          </div>
        </div>
      </div>

      {/* Progress bar — capped fill, amber excess strip on top */}
      <div className="relative h-2 bg-[#F0F0F0] rounded-full overflow-hidden mb-4">
        <div
          className={`absolute top-0 left-0 h-full ${isComplete ? 'bg-green-500' : 'bg-[#E31B7F]'} transition-all`}
          style={{ width: `${displayPct}%` }}
        />
        {hasExcess && (
          <div className="absolute top-0 right-0 h-full bg-amber-400 w-1.5" title={`${excess.toLocaleString()} over ordered`} />
        )}
      </div>

      {/* Metrics grid — uniform layout, label left, value right */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        <Metric label="Sent Out" value={sentN} dot="bg-[#E31B7F]" />
        <Metric label="Good For Sale" value={gfsN} accent={gfsN > 0 ? 'text-green-600' : undefined} />
        <Metric label="Remaining" value={remaining} muted={remaining === 0} />
        <Metric label="Air OTW" value={airN} accent={airN > 0 ? 'text-blue-600' : undefined} muted={airN === 0} />
        <Metric label="Auto RW" value={autoRwN} accent={autoRwN > 0 ? 'text-red-500' : undefined} muted={autoRwN === 0} />
      </div>
    </div>
  );
}

function Metric({ label, value, dot, accent, muted }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />}
      <span className={`uppercase tracking-[.06em] text-[9px] font-bold flex-1 truncate ${muted ? 'text-[#C4C4C4]' : 'text-[#A3A3A3]'}`}>
        {label}
      </span>
      <span className={`font-mono font-semibold text-[13px] ${accent || (muted ? 'text-[#A3A3A3]' : 'text-[#0A0A0A]')}`}>
        {(value ?? 0).toLocaleString()}
      </span>
    </div>
  );
}