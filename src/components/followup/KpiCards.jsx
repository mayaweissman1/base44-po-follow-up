import React from 'react';

function KpiCard({ label, value, meta, colorClass, onClick, active, scrolled }) {
  return (
    <div
      onClick={onClick}
      className={[
        'relative bg-white border cursor-pointer min-w-0',
        // Always flex, just change direction — this avoids an instant display-mode jump
        'flex gap-2 transition-all duration-[250ms] ease-[cubic-bezier(.16,1,.3,1)]',
        scrolled
          ? 'flex-row items-center px-3 py-1.5 rounded-[8px] shadow-none'
          : 'flex-col px-4 pt-4 pb-4 rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(227,27,127,.08)]',
        active ? 'border-[#E31B7F] bg-[#FFF0F7]' : 'border-[#E5E5E5] hover:border-[#FFE5F2]',
      ].join(' ')}
    >
      <div className={[
        'font-bold text-[#525252] uppercase tracking-[.06em] truncate transition-all duration-[250ms]',
        scrolled ? 'text-[9px] flex-1 leading-none' : 'text-[10px] leading-normal',
      ].join(' ')}>{label}</div>

      <div className={[
        'font-mono font-bold leading-none flex-shrink-0 transition-all duration-[250ms]',
        colorClass || 'text-[#0A0A0A]',
        scrolled ? 'text-sm' : 'text-2xl',
      ].join(' ')}>{value}</div>

      <div className={[
        'text-[#A3A3A3] transition-all duration-[150ms]',
        scrolled ? 'hidden' : 'text-[11px]',
      ].join(' ')}>{meta}</div>
    </div>
  );
}

export default function KpiCards({ role, kpis, activeFilter, onFilterClick, scrolled }) {
  if (role === 'dd_team_employee') return null;

  const cards = role === 'main_office' ? [
    { key: 'new_pending',        label: 'New pending (today)',  value: kpis.new_pending ?? 0,        meta: 'HOLDs created today',      colorClass: '',               filterKey: 'new_pending' },
    { key: 'total_pending',      label: 'Total pending',        value: kpis.total_pending ?? 0,      meta: 'All HOLDs in the system',  colorClass: '',               filterKey: 'total_pending' },
    { key: 'urgent_pending',     label: 'Urgent pending',       value: kpis.urgent_pending ?? 0,     meta: 'Urgent POs in HOLD',       colorClass: 'text-red-500',   filterKey: 'urgent_pending' },
    { key: 'approved_today',     label: 'Approved today',       value: kpis.approved_today ?? 0,     meta: 'Approved · today',         colorClass: 'text-green-500', filterKey: 'approved_today' },
    { key: 'rejected_today',     label: 'Rejected today',       value: kpis.rejected_today ?? 0,     meta: 'Rejected · today',         colorClass: 'text-red-500',   filterKey: 'rejected_today' },
    { key: 'acknowledged_today', label: 'Acknowledged today',   value: kpis.acknowledged_today ?? 0, meta: 'Acknowledged · today',     colorClass: 'text-teal-500',  filterKey: 'acknowledged_today' },
  ] : [
    { key: 'total_pending',      label: 'Team pending',         value: kpis.total_pending ?? 0,      meta: 'Team HOLDs · awaiting decision',           colorClass: '',               filterKey: 'total_pending' },
    { key: 'acknowledged_today', label: 'Acknowledged today',   value: (kpis.approved_today ?? 0) + (kpis.acknowledged_today ?? 0), meta: 'Team delays · acknowledged/approved today', colorClass: 'text-green-500', filterKey: 'acknowledged_today' },
    { key: 'rejected_today',     label: 'Rejected today',       value: kpis.rejected_today ?? 0,     meta: 'Team delays · rejected today',             colorClass: 'text-red-500',   filterKey: 'rejected_today' },
  ];

  return (
    <div
      // overflow-anchor: none prevents the browser from adjusting scroll position
      // when this element changes height (which would cause oscillation at the threshold)
      style={{ overflowAnchor: 'none', gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}
      className={[
        'grid mb-4 transition-all duration-[250ms] ease-[cubic-bezier(.16,1,.3,1)]',
        scrolled
          ? 'sticky top-0 z-20 -mx-7 px-7 py-2 gap-1.5 bg-[rgba(248,248,248,0.95)] backdrop-blur border-b border-[#E5E5E5]'
          : 'gap-3',
      ].join(' ')}
    >
      {cards.map(c => (
        <KpiCard
          key={c.key}
          label={c.label}
          value={c.value}
          meta={c.meta}
          colorClass={c.colorClass}
          active={activeFilter === c.filterKey}
          onClick={() => onFilterClick(c.filterKey)}
          scrolled={scrolled}
        />
      ))}
    </div>
  );
}
