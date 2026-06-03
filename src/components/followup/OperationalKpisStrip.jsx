import React, { useMemo } from 'react';

function isCurrentCollection(r) {
  if (!r.collection) return false;
  const now = new Date();
  const monthShort = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(2);
  const c = r.collection.toLowerCase();
  return (
    c.includes(`${yyyy}-${mm}`) ||
    c.includes(`${mm}-${yyyy}`) ||
    c.includes(`${mm}/${yy}`) ||
    c.includes(`${mm}-${yy}`) ||
    c.includes(monthShort)
  );
}

function Chip({ label, value, active, accent, onClick }) {
  const accentClass = accent === 'red'
    ? 'text-red-600'
    : accent === 'amber'
      ? 'text-amber-600'
      : 'text-[#0A0A0A]';
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2 h-8 px-3 rounded-[8px] border whitespace-nowrap transition-all text-[11px] font-semibold',
        active
          ? 'bg-[#FFF0F7] border-[#E31B7F] text-[#E31B7F]'
          : 'bg-white border-[#E5E5E5] hover:border-[#FFE5F2] hover:bg-[#FFFAFD] text-[#525252]',
      ].join(' ')}
      title={label}
    >
      <span className={['font-mono font-bold tabular-nums', active ? 'text-[#E31B7F]' : accentClass].join(' ')}>{value}</span>
      <span>{label}</span>
    </button>
  );
}

export default function OperationalKpisStrip({ rows, activeKey, onApplyFilters }) {
  const chips = useMemo(() => {
    const now = new Date();
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const cutoff = new Date(eom); cutoff.setDate(eom.getDate() - 5);
    const currentCol = rows.filter(isCurrentCollection);

    return [
      // Collection
      { key: 'col_current',        label: 'Current collection',     value: currentCol.length,                                                                                       accent: '',      filters: { collection: 'CURRENT' } },
      { key: 'col_will_miss',      label: 'Will miss collection',   value: currentCol.filter(r => r.final_dd && new Date(r.final_dd) > cutoff).length,                              accent: 'red',   filters: { collection: 'CURRENT_AT_RISK' } },
      { key: 'col_late_new',       label: 'Late new orders',        value: rows.filter(r => r.po_type === 'New' && r.late_future === 'LATE').length,                               accent: 'red',   filters: { orderType: 'New', lateFuture: 'LATE' } },
      { key: 'col_not_started',    label: 'Not started',            value: rows.filter(r => !r.effective_dd_status || /^pending|^not started|^cutting prep/i.test(r.effective_dd_status)).length, accent: 'amber', filters: { ddStatus: 'NOT_STARTED' } },
      // Urgent
      { key: 'urg_late_bs',        label: 'Late best sellers',      value: rows.filter(r => r.is_best_seller && r.late_future === 'LATE').length,                                  accent: 'red',   filters: { bestSeller: true, lateFuture: 'LATE' } },
      { key: 'urg_bs_not_started', label: 'BS not started',         value: rows.filter(r => r.is_best_seller && (!r.effective_dd_status || /^pending|^not started|^cutting prep/i.test(r.effective_dd_status))).length, accent: 'amber', filters: { bestSeller: true, ddStatus: 'NOT_STARTED' } },
      { key: 'urg_high_bno',       label: 'High BNO · Low OTW',     value: rows.filter(r => r.bno_high_low_otw).length,                                                            accent: 'red',   filters: { highBno: true } },
      // Performance
      { key: 'perf_empty_status',  label: 'Empty status',           value: rows.filter(r => !r.effective_dd_status).length,                                                        accent: 'amber', filters: { ddStatus: 'EMPTY' } },
      { key: 'perf_same_5d',       label: 'Same status > 5d',       value: rows.filter(r => (r.days_same_status ?? 0) > 5).length,                                                accent: 'amber', filters: { staleStatus: true } },
      { key: 'perf_late_7plus',    label: 'Late > 7d',              value: rows.filter(r => (r.days_late_counting ?? 0) > 7).length,                                              accent: 'red',   filters: { late7Plus: true } },
    ];
  }, [rows]);

  return (
    <div className="mb-4 bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] flex-shrink-0 pr-1">Operational KPIs</span>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-0.5">
          {chips.map(c => (
            <Chip
              key={c.key}
              label={c.label}
              value={c.value}
              accent={c.accent}
              active={activeKey === c.key}
              onClick={() => onApplyFilters(c.key, c.filters)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}