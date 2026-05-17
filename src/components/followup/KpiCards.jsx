import React from 'react';

function KpiCard({ label, value, meta, colorClass, onClick, active }) {
  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white border rounded-[10px] p-4 cursor-pointer min-w-0
        transition-all duration-150 shadow-[0_1px_3px_rgba(0,0,0,.04)]
        hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(227,27,127,.08)]
        ${active ? 'border-[#E31B7F] bg-[#FFF0F7]' : 'border-[#E5E5E5] hover:border-[#FFE5F2]'}
      `}
    >
      <div className="text-[10px] font-bold text-[#525252] uppercase tracking-[.06em] mb-1.5 truncate">{label}</div>
      <div className={`font-mono text-2xl font-bold leading-none ${colorClass || 'text-[#0A0A0A]'}`}>{value}</div>
      <div className="mt-2 text-[11px] text-[#A3A3A3]">{meta}</div>
    </div>
  );
}

export default function KpiCards({ role, kpis, activeFilter, onFilterClick }) {
  if (role === 'dd_team_employee') return null;

  const cards = role === 'main_office' ? [
    { key: 'new_pending',       label: 'New pending (today)', value: kpis.new_pending ?? 0,        meta: 'HOLDs created today',       colorClass: '', filterKey: 'new_pending' },
    { key: 'total_pending',     label: 'Total pending',        value: kpis.total_pending ?? 0,      meta: 'All HOLDs in the system',   colorClass: '', filterKey: 'total_pending' },
    { key: 'urgent_pending',    label: 'Urgent pending',       value: kpis.urgent_pending ?? 0,     meta: 'Urgent POs in HOLD',        colorClass: 'text-red-500', filterKey: 'urgent_pending' },
    { key: 'approved_today',    label: 'Approved today',       value: kpis.approved_today ?? 0,     meta: 'Approved · today',          colorClass: 'text-green-500', filterKey: 'approved_today' },
    { key: 'rejected_today',    label: 'Rejected today',       value: kpis.rejected_today ?? 0,     meta: 'Rejected · today',          colorClass: 'text-red-500', filterKey: 'rejected_today' },
    { key: 'acknowledged_today',label: 'Acknowledged today',   value: kpis.acknowledged_today ?? 0, meta: 'Acknowledged · today',      colorClass: 'text-teal-500', filterKey: 'acknowledged_today' },
  ] : [
    { key: 'total_pending',     label: 'Team pending',         value: kpis.total_pending ?? 0,      meta: 'Team HOLDs · awaiting decision',       colorClass: '', filterKey: 'total_pending' },
    { key: 'acknowledged_today',label: 'Acknowledged today',   value: (kpis.approved_today ?? 0) + (kpis.acknowledged_today ?? 0), meta: 'Team delays · acknowledged/approved today', colorClass: 'text-green-500', filterKey: 'acknowledged_today' },
    { key: 'rejected_today',    label: 'Rejected today',       value: kpis.rejected_today ?? 0,     meta: 'Team delays · rejected today',         colorClass: 'text-red-500', filterKey: 'rejected_today' },
  ];

  return (
    <div className={`grid gap-3 mb-4`} style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}>
      {cards.map(c => (
        <KpiCard
          key={c.key}
          label={c.label}
          value={c.value}
          meta={c.meta}
          colorClass={c.colorClass}
          active={activeFilter === c.filterKey}
          onClick={() => onFilterClick(c.filterKey)}
        />
      ))}
    </div>
  );
}