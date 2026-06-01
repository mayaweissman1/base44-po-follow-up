import React, { useMemo } from 'react';

/* ───────── helpers ───────── */

function isCurrentCollection(r) {
  if (!r.collection) return false;
  const now = new Date();
  const monthShort = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const monthNum = String(now.getMonth() + 1).padStart(2, '0');
  const year2 = String(now.getFullYear()).slice(2);
  const c = r.collection.toLowerCase();
  return c.includes(monthShort) || c.includes(`${monthNum}/${year2}`) || c.includes(`${monthNum}-${year2}`);
}

/* ───────── single card ───────── */

function KpiCard({ kpi, active, onClick }) {
  const { label, value, meta, accent, alwaysRed } = kpi;
  const colorClass =
    accent === 'red' ? 'text-red-600'
    : accent === 'amber' ? 'text-amber-600'
    : accent === 'green' ? 'text-green-600'
    : 'text-[#0A0A0A]';

  return (
    <button
      onClick={onClick}
      className={[
        'relative bg-white border text-left min-w-0 w-full h-[88px]',
        'flex flex-col justify-between px-3.5 py-3 rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)]',
        'hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(227,27,127,.08)] transition-all duration-[200ms]',
        active ? 'border-[#E31B7F] bg-[#FFF0F7]' : 'border-[#E5E5E5] hover:border-[#FFE5F2]',
        alwaysRed && !active ? 'border-red-200 bg-red-50 hover:border-red-400' : '',
      ].join(' ')}
    >
      <div className="text-[10px] font-bold text-[#525252] uppercase tracking-[.06em] truncate leading-tight">{label}</div>
      <div className={['font-mono font-bold leading-none text-2xl', colorClass].join(' ')}>{value}</div>
      <div className="text-[10.5px] text-[#A3A3A3] truncate">{meta}</div>
    </button>
  );
}

/* ───────── compact card (for "All KPIs" row) ───────── */

function CompactKpiCard({ kpi, active, onClick }) {
  const { label, value, accent, alwaysRed } = kpi;
  const colorClass =
    accent === 'red' ? 'text-red-600'
    : accent === 'amber' ? 'text-amber-600'
    : accent === 'green' ? 'text-green-600'
    : 'text-[#0A0A0A]';

  return (
    <button
      onClick={onClick}
      title={label}
      className={[
        'relative bg-white border text-left min-w-0 w-full h-[60px]',
        'flex flex-col justify-between px-2.5 py-2 rounded-[8px] shadow-[0_1px_3px_rgba(0,0,0,.04)]',
        'hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(227,27,127,.08)] transition-all duration-[200ms]',
        active ? 'border-[#E31B7F] bg-[#FFF0F7]' : 'border-[#E5E5E5] hover:border-[#FFE5F2]',
        alwaysRed && !active ? 'border-red-200 bg-red-50 hover:border-red-400' : '',
      ].join(' ')}
    >
      <div className="text-[9.5px] font-bold text-[#525252] uppercase tracking-[.04em] leading-tight line-clamp-2">{label}</div>
      <div className={['font-mono font-bold leading-none text-[17px]', colorClass].join(' ')}>{value}</div>
    </button>
  );
}

/* ───────── main component ───────── */

export default function MainOfficeKpiGrid({
  rows,
  kpis,
  activeKpiFilter,
  onKpiFilterClick,
  activeOpKpi,
  onOpKpiClick,
}) {
  // Build all KPI definitions in one unified list. Each has:
  //   id, label, value, meta, accent, urgencyWeight (for prioritization),
  //   onClick → calls the appropriate handler with the right key.
  const allKpis = useMemo(() => {
    const now = new Date();
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const cutoff = new Date(eom); cutoff.setDate(eom.getDate() - 5);
    const currentCol = rows.filter(isCurrentCollection);

    return [
      // ── Original top KPIs (from KpiCards main_office) ──
      { id: 'new_pending',        kind: 'kpi', label: 'New pending (today)', value: kpis.new_pending ?? 0,                                       meta: 'HOLDs created today',     accent: '',      filterKey: 'new_pending',        urgencyWeight: 5 },
      { id: 'total_pending',      kind: 'kpi', label: 'Total pending',       value: kpis.total_pending ?? 0,                                     meta: 'All HOLDs in the system', accent: '',      filterKey: 'total_pending',      urgencyWeight: 4 },
      { id: 'urgent_pending',     kind: 'kpi', label: 'Urgent pending',      value: kpis.urgent_pending ?? 0,                                    meta: 'Urgent POs in HOLD',      accent: 'red',   filterKey: 'urgent_pending',     urgencyWeight: 10 },
      { id: 'acknowledged_today', kind: 'kpi', label: 'Acknowledged',        value: (kpis.approved_today ?? 0) + (kpis.acknowledged_today ?? 0), meta: 'Approved or acknowledged', accent: 'green', filterKey: 'acknowledged_today', urgencyWeight: 1 },
      { id: 'rejected_today',     kind: 'kpi', label: 'Rejected today',      value: kpis.rejected_today ?? 0,                                    meta: 'Rejected · today',        accent: 'red',   filterKey: 'rejected_today',     urgencyWeight: 7 },
      { id: 'not_updated',        kind: 'kpi', label: 'Not Updated',         value: kpis.not_updated ?? 0,                                       meta: 'Due today — not touched', accent: 'red',   filterKey: 'not_updated',        urgencyWeight: 9, alwaysRed: true },

      // ── Operational KPIs ──
      { id: 'col_current',        kind: 'op', label: 'Current collection',   value: currentCol.length,                                                                                                        meta: 'POs in current month',     accent: '',      filters: { collection: 'CURRENT' },                              urgencyWeight: 3 },
      { id: 'col_will_miss',      kind: 'op', label: 'Will miss collection', value: currentCol.filter(r => r.final_dd && new Date(r.final_dd) > cutoff).length,                                               meta: 'Risk EOM cutoff',          accent: 'red',   filters: { collection: 'CURRENT_AT_RISK' },                       urgencyWeight: 9 },
      { id: 'col_late_new',       kind: 'op', label: 'Late new orders',      value: rows.filter(r => r.po_type === 'New' && r.late_future === 'LATE').length,                                                meta: 'New POs already late',     accent: 'red',   filters: { orderType: 'New', lateFuture: 'LATE' },                urgencyWeight: 8 },
      { id: 'col_not_started',    kind: 'op', label: 'Not started',          value: rows.filter(r => !r.effective_dd_status || /^pending|^not started|^cutting prep/i.test(r.effective_dd_status)).length,   meta: 'Production not begun',     accent: 'amber', filters: { ddStatus: 'NOT_STARTED' },                             urgencyWeight: 4 },
      { id: 'urg_late_bs',        kind: 'op', label: 'Late best sellers',    value: rows.filter(r => r.is_best_seller && r.late_future === 'LATE').length,                                                   meta: 'Best sellers late',        accent: 'red',   filters: { bestSeller: true, lateFuture: 'LATE' },                urgencyWeight: 10 },
      { id: 'urg_bs_not_started', kind: 'op', label: 'BS not started',       value: rows.filter(r => r.is_best_seller && (!r.effective_dd_status || /^pending|^not started|^cutting prep/i.test(r.effective_dd_status))).length, meta: 'Best sellers stalled', accent: 'amber', filters: { bestSeller: true, ddStatus: 'NOT_STARTED' },        urgencyWeight: 6 },
      { id: 'urg_high_bno',       kind: 'op', label: 'High BNO · Low OTW',   value: rows.filter(r => r.bno_high_low_otw).length,                                                                              meta: 'Demand vs supply gap',     accent: 'red',   filters: { highBno: true },                                       urgencyWeight: 8 },
      { id: 'perf_empty_status',  kind: 'op', label: 'Empty status',         value: rows.filter(r => !r.effective_dd_status).length,                                                                          meta: 'Missing DD status',        accent: 'amber', filters: { ddStatus: 'EMPTY' },                                   urgencyWeight: 2 },
      { id: 'perf_same_5d',       kind: 'op', label: 'Same status > 5d',     value: rows.filter(r => (r.days_same_status ?? 0) > 5).length,                                                                   meta: 'Stale production',         accent: 'amber', filters: { staleStatus: true },                                   urgencyWeight: 5 },
      { id: 'perf_late_7plus',    kind: 'op', label: 'Late > 7d',            value: rows.filter(r => (r.days_late_counting ?? 0) > 7).length,                                                                 meta: 'Severely late POs',        accent: 'red',   filters: { late7Plus: true },                                     urgencyWeight: 9 },
    ];
  }, [rows, kpis]);

  // ── Prioritization: top 4 = highest urgency where value > 0.
  // Tie-breakers: higher urgencyWeight, then higher value, then red > amber > other.
  const accentRank = a => (a === 'red' ? 2 : a === 'amber' ? 1 : 0);

  const { topKpis, restKpis } = useMemo(() => {
    const sortable = allKpis.filter(k => (Number(k.value) || 0) > 0);
    sortable.sort((a, b) => {
      if (b.urgencyWeight !== a.urgencyWeight) return b.urgencyWeight - a.urgencyWeight;
      if (accentRank(b.accent) !== accentRank(a.accent)) return accentRank(b.accent) - accentRank(a.accent);
      return (b.value || 0) - (a.value || 0);
    });

    const top = sortable.slice(0, 4);
    const topIds = new Set(top.map(k => k.id));
    // Rest = everything not in top, keep original order (which groups by category)
    const rest = allKpis.filter(k => !topIds.has(k.id));

    // If we don't have 4 urgent items (all zeros), pad top from the rest in original order
    if (top.length < 4) {
      const need = 4 - top.length;
      const fillers = rest.splice(0, need);
      top.push(...fillers);
    }
    return { topKpis: top, restKpis: rest };
  }, [allKpis]);

  function handleClick(kpi) {
    if (kpi.kind === 'kpi') {
      onKpiFilterClick(kpi.filterKey);
    } else if (kpi.kind === 'op') {
      onOpKpiClick(kpi.id, kpi.filters);
    }
  }

  function isActive(kpi) {
    if (kpi.kind === 'kpi') return activeKpiFilter === kpi.filterKey;
    if (kpi.kind === 'op')  return activeOpKpi === kpi.id;
    return false;
  }

  return (
    <div className="mb-4 space-y-2.5">
      {/* Top row — 4 urgent */}
      <div>
        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-1.5 px-0.5">🔥 Top priorities</div>
        <div className="grid grid-cols-4 gap-2.5">
          {topKpis.map(kpi => (
            <KpiCard key={kpi.id} kpi={kpi} active={isActive(kpi)} onClick={() => handleClick(kpi)} />
          ))}
        </div>
      </div>

      {/* Bottom — all remaining KPIs in a compact non-scrolling grid */}
      <div>
        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-1.5 px-0.5">All KPIs</div>
        <div className="grid grid-cols-6 gap-2">
          {restKpis.map(kpi => (
            <CompactKpiCard key={kpi.id} kpi={kpi} active={isActive(kpi)} onClick={() => handleClick(kpi)} />
          ))}
        </div>
      </div>
    </div>
  );
}