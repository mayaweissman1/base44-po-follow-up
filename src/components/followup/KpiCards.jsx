import React from 'react';

function KpiCard({ label, value, meta, colorClass, alwaysRed, onClick, active }) {
  return (
    <div
      onClick={onClick}
      className={[
        'relative bg-white border cursor-pointer min-w-0',
        'flex flex-col px-4 pt-4 pb-4 rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)]',
        'hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(227,27,127,.08)] transition-all duration-[200ms]',
        active ? 'border-[#E31B7F] bg-[#FFF0F7]' : 'border-[#E5E5E5] hover:border-[#FFE5F2]',
        alwaysRed ? 'border-red-200 bg-red-50 hover:border-red-400' : '',
      ].join(' ')}
    >
      <div className="text-[10px] font-bold text-[#525252] uppercase tracking-[.06em] truncate">{label}</div>
      <div className={['font-mono font-bold leading-none text-2xl mt-1.5', colorClass || 'text-[#0A0A0A]'].join(' ')}>{value}</div>
      <div className="text-[11px] text-[#A3A3A3] mt-1">{meta}</div>
    </div>
  );
}

export default function KpiCards({ role, kpis, activeFilter, onFilterClick }) {
  if (role === 'main_office') {
    const cards = [
      { key: 'new_pending',        label: 'New pending (today)', value: kpis.new_pending ?? 0,                                           meta: 'HOLDs created today',       colorClass: '',              filterKey: 'new_pending' },
      { key: 'total_pending',      label: 'Total pending',       value: kpis.total_pending ?? 0,                                         meta: 'All HOLDs in the system',   colorClass: '',              filterKey: 'total_pending' },
      { key: 'urgent_pending',     label: 'Urgent pending',      value: kpis.urgent_pending ?? 0,                                        meta: 'Urgent POs in HOLD',        colorClass: 'text-red-500',  filterKey: 'urgent_pending' },
      { key: 'acknowledged_today', label: 'Acknowledged',        value: (kpis.approved_today ?? 0) + (kpis.acknowledged_today ?? 0),     meta: 'Approved or acknowledged',  colorClass: 'text-green-500', filterKey: 'acknowledged_today' },
      { key: 'rejected_today',     label: 'Rejected today',      value: kpis.rejected_today ?? 0,                                        meta: 'Rejected · today',          colorClass: 'text-red-500',  filterKey: 'rejected_today' },
      { key: 'not_updated',        label: 'Not Updated',         value: kpis.not_updated ?? 0,                                           meta: 'Due today — not touched',   colorClass: 'text-red-600',  filterKey: 'not_updated', alwaysRed: true },
    ];
    return (
      <div style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }} className="grid gap-3 mb-4">
        {cards.map(c => (
          <KpiCard key={c.key} label={c.label} value={c.value} meta={c.meta} colorClass={c.colorClass} alwaysRed={c.alwaysRed} active={activeFilter === c.filterKey} onClick={() => onFilterClick(c.filterKey)} />
        ))}
      </div>
    );
  }

  if (role === 'dd_team_manager') {
    const cards = [
      { key: 'new_pending',        label: 'New pending (today)', value: kpis.new_pending ?? 0,                                           meta: 'HOLDs created today',       colorClass: '',               filterKey: 'new_pending' },
      { key: 'total_pending',      label: 'Total pending',       value: kpis.total_pending ?? 0,                                         meta: 'All HOLDs in the system',   colorClass: '',               filterKey: 'total_pending' },
      { key: 'urgent_pending',     label: 'Urgent pending',      value: kpis.urgent_pending ?? 0,                                        meta: 'Urgent POs in HOLD',        colorClass: 'text-red-500',   filterKey: 'urgent_pending' },
      { key: 'acknowledged_today', label: 'Acknowledged',        value: (kpis.approved_today ?? 0) + (kpis.acknowledged_today ?? 0),     meta: 'Approved or acknowledged',  colorClass: 'text-green-500', filterKey: 'acknowledged_today' },
      { key: 'rejected_today',     label: 'Rejected today',      value: kpis.rejected_today ?? 0,                                        meta: 'Rejected · today',          colorClass: 'text-red-500',   filterKey: 'rejected_today' },
      { key: 'not_updated',        label: 'Not Updated',         value: kpis.not_updated ?? 0,                                           meta: 'Due today — not touched',   colorClass: 'text-red-600',   filterKey: 'not_updated', alwaysRed: true },
      { key: 'mgr_received_upd',   label: 'Receiving Notice',     value: kpis.mgr_received_upd ?? 0,                                      meta: 'Delivery status updated',   colorClass: 'text-amber-500', filterKey: 'mgr_received_upd' },
    ];
    return (
      <div style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }} className="grid gap-3 mb-4">
        {cards.map(c => (
          <KpiCard key={c.key} label={c.label} value={c.value} meta={c.meta} colorClass={c.colorClass} alwaysRed={c.alwaysRed} active={activeFilter === c.filterKey} onClick={() => onFilterClick(c.filterKey)} />
        ))}
      </div>
    );
  }

  if (role === 'dd_team_employee') {
    const cards = [
      { key: 'emp_pending',      label: 'Pending',         value: kpis.emp_pending ?? 0,      meta: 'My HOLDs awaiting decision',  colorClass: 'text-red-500',   filterKey: 'emp_pending' },
      { key: 'emp_acknowledged', label: 'Acknowledged',    value: kpis.emp_acknowledged ?? 0, meta: 'Approved or acknowledged',    colorClass: 'text-green-500', filterKey: 'emp_acknowledged' },
      { key: 'emp_rejected',     label: 'Rejected',        value: kpis.emp_rejected ?? 0,     meta: 'Rejected by main office',     colorClass: 'text-red-500',   filterKey: 'emp_rejected' },
      { key: 'emp_received_upd', label: 'Receiving Notice', value: kpis.emp_received_upd ?? 0, meta: 'Delivery status updated',     colorClass: 'text-amber-500', filterKey: 'emp_received_upd' },
    ];
    return (
      <div style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }} className="grid gap-3 mb-4">
        {cards.map(c => (
          <KpiCard key={c.key} label={c.label} value={c.value} meta={c.meta} colorClass={c.colorClass} active={activeFilter === c.filterKey} onClick={() => onFilterClick(c.filterKey)} />
        ))}
      </div>
    );
  }

  return null;
}
