import React, { useMemo, useState, useEffect } from 'react';

const TABS = [
  { key: 'collection',  label: 'Collection' },
  { key: 'urgent',      label: 'Urgent' },
  { key: 'performance', label: 'Performance' },
];

const STORAGE_KEY = 'followup.opKpis.activeTab';

function OpKpiCard({ label, value, meta, active, onClick, accent }) {
  return (
    <div
      onClick={onClick}
      className={[
        'relative bg-white border min-w-0 flex flex-col px-4 pt-4 pb-4 rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] transition-all duration-[200ms]',
        'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(227,27,127,.08)]',
        active ? 'border-[#E31B7F] bg-[#FFF0F7]' : 'border-[#E5E5E5] hover:border-[#FFE5F2]',
      ].join(' ')}
    >
      <div className="text-[10px] font-bold text-[#525252] uppercase tracking-[.06em] truncate">{label}</div>
      <div className={['font-mono font-bold leading-none text-2xl mt-1.5', accent || 'text-[#0A0A0A]'].join(' ')}>
        {value}
      </div>
      <div className="text-[11px] text-[#A3A3A3] mt-1">{meta}</div>
    </div>
  );
}

// Helpers used by all tabs
function isCurrentCollection(r) {
  if (!r.collection) return false;
  const now = new Date();
  const monthShort = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const monthNum = String(now.getMonth() + 1).padStart(2, '0');
  const year2 = String(now.getFullYear()).slice(2);
  const c = r.collection.toLowerCase();
  return c.includes(monthShort) || c.includes(`${monthNum}/${year2}`) || c.includes(`${monthNum}-${year2}`);
}

function notUpdatedToday(r) {
  const today = new Date().toISOString().slice(0, 10);
  if (r.effective_next_update?.slice(0, 10) !== today) return false;
  const log = r.dd_comment_log || [];
  return !log.some(e => e.date?.slice(0, 10) === today);
}

export default function OperationalKpis({ rows, activeKey, onApplyFilters }) {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'collection'; } catch { return 'collection'; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, tab); } catch { /* ignore */ }
  }, [tab]);

  const counts = useMemo(() => {
    const now = new Date();
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const cutoff = new Date(eom); cutoff.setDate(eom.getDate() - 5);

    const currentCol = rows.filter(isCurrentCollection);

    return {
      // Collection
      currentColOpen:   currentCol.length,
      willMissCol:      currentCol.filter(r => r.final_dd && new Date(r.final_dd) > cutoff).length,
      lateNewOrders:    rows.filter(r => r.po_type === 'New' && r.late_future === 'LATE').length,
      notStartedModels: rows.filter(r => !r.effective_dd_status || /^pending|^not started|^cutting prep/i.test(r.effective_dd_status)).length,

      // Urgent
      lateBestSellers:    rows.filter(r => r.is_best_seller && r.late_future === 'LATE').length,
      bsNotStarted:       rows.filter(r => r.is_best_seller && (!r.effective_dd_status || /^pending|^not started|^cutting prep/i.test(r.effective_dd_status))).length,
      highBnoLowOtw:      rows.filter(r => r.bno_high_low_otw).length,

      // Performance
      emptyStatus:      rows.filter(r => !r.effective_dd_status).length,
      sameStatus5d:     rows.filter(r => (r.days_same_status ?? 0) > 5).length,
      late7Plus:        rows.filter(r => (r.days_late_counting ?? 0) > 7).length,
    };
  }, [rows]);

  // Each card: key, label, value, meta, accent, soon, filters (preset for table)
  const cardsByTab = {
    collection: [
      { key: 'col_current',       label: 'Open · Current collection',  value: counts.currentColOpen,   meta: 'Open POs in this month\'s collection', accent: '',              filters: { collection: 'CURRENT' } },
      { key: 'col_will_miss',     label: 'Will miss current collection', value: counts.willMissCol,    meta: 'Final DD within 5 days of month end',  accent: 'text-red-500',  filters: { collection: 'CURRENT_AT_RISK' } },
      { key: 'col_late_new',      label: 'Late new orders',            value: counts.lateNewOrders,    meta: 'PO type "New" past Final DD',          accent: 'text-red-500',  filters: { orderType: 'New', lateFuture: 'LATE' } },
      { key: 'col_not_started',   label: 'Production not started',     value: counts.notStartedModels, meta: 'Stage empty or pre-production',        accent: 'text-amber-500', filters: { ddStatus: 'NOT_STARTED' } },
    ],
    urgent: [
      { key: 'urg_late_bs',       label: 'Late best sellers',          value: counts.lateBestSellers, meta: 'Ordered >1000 · Published last 45d',   accent: 'text-red-500',   filters: { bestSeller: true, lateFuture: 'LATE' } },
      { key: 'urg_bs_not_started',label: 'Best sellers · Not started', value: counts.bsNotStarted,    meta: 'Best sellers without production stage',accent: 'text-amber-500', filters: { bestSeller: true, ddStatus: 'NOT_STARTED' } },
      { key: 'urg_high_bno',      label: 'High BNO · Low OTW',         value: counts.highBnoLowOtw,   meta: 'US>3000 / UK>1000 · OTW<50% balance',  accent: 'text-red-500',   filters: { highBno: true } },
    ],
    performance: [
      { key: 'perf_empty_status', label: 'Empty status',               value: counts.emptyStatus,      meta: 'No production stage set',              accent: 'text-amber-500', filters: { ddStatus: 'EMPTY' } },
      { key: 'perf_same_5d',      label: 'Same status > 5 days',       value: counts.sameStatus5d,     meta: 'Stage unchanged for over 5 days',      accent: 'text-amber-500', filters: { staleStatus: true } },
      { key: 'perf_late_7plus',   label: 'Open > 7 days late',         value: counts.late7Plus,        meta: 'Days late past due date',              accent: 'text-red-500',  filters: { late7Plus: true } },
    ],
  };

  const cards = cardsByTab[tab] || [];

  return (
    <div className="mb-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-2.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'h-7 px-3.5 rounded-[6px] text-[12px] font-semibold transition-colors',
              tab === t.key
                ? 'bg-[#0A0A0A] text-white'
                : 'bg-white text-[#525252] border border-[#E5E5E5] hover:border-[#E31B7F] hover:text-[#E31B7F]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-2 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em]">Operational KPIs</div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}>
        {cards.map(c => (
          <OpKpiCard
            key={c.key}
            label={c.label}
            value={c.value}
            meta={c.meta}
            accent={c.accent}
            active={activeKey === c.key}
            onClick={() => onApplyFilters(c.key, c.filters)}
          />
        ))}
      </div>
    </div>
  );
}