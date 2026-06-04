import React from 'react';

/**
 * A condensed, single-row strip of all KPI cards.
 * Appears sticky at the top when the user has scrolled past the full KPI grid.
 */
export default function CompactKpiBar({ cards, activeOpKpi, onClick, viewMode, onViewModeChange, visible }) {
  if (!visible) return null;

  function isActive(card) {
    return activeOpKpi === `${viewMode}:${card.id}`;
  }

  return (
    <div className="sticky top-0 z-40 bg-[#F8F8F8] border-b border-[#E5E5E5] -mx-7 px-7 py-2 mb-2 shadow-[0_2px_8px_rgba(0,0,0,.06)]">
      <div className="flex items-center gap-2">
        <div className="inline-flex bg-white border border-[#E5E5E5] rounded-[6px] p-0.5 shadow-[0_1px_2px_rgba(0,0,0,.04)] flex-shrink-0">
          {['New', 'Rep'].map(mode => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={[
                'px-2.5 h-6 rounded-[4px] text-[10px] font-semibold transition-all',
                viewMode === mode
                  ? 'bg-[#E31B7F] text-white'
                  : 'text-[#525252] hover:text-[#0A0A0A]',
              ].join(' ')}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          {cards.map(card => {
            const active = isActive(card);
            const colorClass =
              card.accent === 'red' ? 'text-red-600'
              : card.accent === 'amber' ? 'text-amber-600'
              : card.accent === 'green' ? 'text-green-600'
              : 'text-[#0A0A0A]';
            return (
              <button
                key={card.id}
                onClick={() => onClick(card)}
                title={`${card.label} — ${card.meta}`}
                className={[
                  'flex items-center gap-1.5 px-2 h-7 rounded-[6px] border whitespace-nowrap transition-all flex-shrink-0',
                  active
                    ? 'border-[#E31B7F] bg-[#FFF0F7]'
                    : card.alwaysRed
                      ? 'border-red-200 bg-red-50 hover:border-red-400'
                      : 'border-[#E5E5E5] bg-white hover:border-[#FFE5F2] hover:bg-[#FFF0F7]',
                ].join(' ')}
              >
                <span className={`font-mono font-bold text-[12px] leading-none ${colorClass}`}>{card.value}</span>
                <span className="text-[10px] font-semibold text-[#525252] uppercase tracking-[.03em] leading-none">{card.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}