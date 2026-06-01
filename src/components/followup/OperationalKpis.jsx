import React, { useState, useMemo } from 'react';
import { Layers, Flame, Activity } from 'lucide-react';

const TABS = [
  { key: 'collection',  label: 'Collection',  icon: Layers   },
  { key: 'urgent',      label: 'Urgent',      icon: Flame    },
  { key: 'performance', label: 'Performance', icon: Activity },
];

function KpiCard({ label, value, meta, colorClass, alwaysRed, onClick, active, disabled }) {
  const clickable = !disabled && typeof onClick === 'function';
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={[
        'relative bg-white border min-w-0',
        'flex flex-col px-4 pt-4 pb-4 rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)]',
        clickable
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(227,27,127,.08)] transition-all duration-[200ms]'
          : 'cursor-default opacity-70',
        active ? 'border-[#E31B7F] bg-[#FFF0F7]' : 'border-[#E5E5E5]',
        clickable && !active ? 'hover:border-[#FFE5F2]' : '',
        alwaysRed ? 'border-red-200 bg-red-50 hover:border-red-400' : '',
      ].join(' ')}
    >
      <div className="text-[10px] font-bold text-[#525252] uppercase tracking-[.06em] truncate">{label}</div>
      <div className={['font-mono font-bold leading-none text-2xl mt-1.5', colorClass || 'text-[#0A0A0A]'].join(' ')}>{value}</div>
      <div className="text-[11px] text-[#A3A3A3] mt-1 truncate">{meta}</div>
      {disabled && (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase bg-[#FFF0F7] text-[#E31B7F] tracking-wider">Soon</span>
      )}
    </div>
  );
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function isNotUpdated(r) {
  const t = todayStr();
  if (r.effective_next_update?.slice(0, 10) !== t) return false;
  const log = r.dd_comment_log || [];
  return !log.some(e => e.date?.slice(0, 10) === t);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function currentCollectionTag() {
  // Heuristic: "current collection" = current calendar month code (MM/YY).
  // We match rows whose `collection` includes the current month label, case-insensitive.
  // If the data uses a different format we fall back to all rows (UI still works).
  const now = new Date();
  const monthShort = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const monthNum = String(now.getMonth() + 1).padStart(2, '0');
  return { monthShort, monthNum, year2: String(now.getFullYear()).slice(2) };
}

function isCurrentCollection(r) {
  if (!r.collection) return false;
  const { monthShort, monthNum, year2 } = currentCollectionTag();
  const c = r.collection.toLowerCase();
  return c.includes(monthShort) || c.includes(`${monthNum}/${year2}`) || c.includes(`${monthNum}-${year2}`);
}

function notStartedProduction(r) {
  const s = (r.effective_dd_status || '').toLowerCase();
  return !s || s === 'pending' || s === 'not started' || s === 'cutting prep';
}

export default function OperationalKpis({ rows, onApplyFilters, activeKey }) {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('opkpi-tab') || 'collection'; } catch { return 'collection'; }
  });

  function pickTab(k) {
    setTab(k);
    try { localStorage.setItem('opkpi-tab', k); } catch {}
  }

  const m = useMemo(() => {
    const t = todayStr();
    const now = new Date();
    const eom = endOfMonth(now);
    const fiveDaysBeforeEom = new Date(eom);
    fiveDaysBeforeEom.setDate(eom.getDate() - 5);

    const open = rows; // rows from getFollowUpData are already open POs

    return {
      // Collection
      lateNewOrders: open.filter(r => r.po_type === 'NEW' && r.late_future === 'LATE').length,
      currentCollectionOpen: open.filter(isCurrentCollection).length,
      willMissCollection: open.filter(r => {
        if (!isCurrentCollection(r)) return false;
        if (!r.final_dd) return false;
        const fdd = new Date(r.final_dd);
        return fdd > fiveDaysBeforeEom; // Final DD lands within last 5 days of month, or after
      }).length,
      notStarted: open.filter(notStartedProduction).length,
      notUpdated: open.filter(isNotUpdated).length,

      // Urgent
      urgentNotUpdated: open.filter(r => r.urgent && isNotUpdated(r)).length,

      // Performance
      emptyStatus: open.filter(r => !r.effective_dd_status).length,
      staleStatus: open.filter(r => (r.days_same_status ?? 0) > 5).length,
      late7Plus: open.filter(r => (r.days_late_counting ?? 0) > 7).length,
    };
  }, [rows]);

  const collectionCards = [
    { key: 'op_late_new',           label: 'Late new orders',        value: m.lateNewOrders,         meta: 'NEW POs past Final DD',           colorClass: 'text-red-500',  filters: { orderType: 'NEW', lateFuture: 'LATE' } },
    { key: 'op_current_coll',       label: 'Current collection',     value: m.currentCollectionOpen, meta: 'Open POs · this month',           colorClass: '',              filters: { collection: 'CURRENT' } },
    { key: 'op_will_miss',          label: 'Will miss collection',   value: m.willMissCollection,    meta: 'Final DD < 5d to month end',      colorClass: 'text-amber-500',filters: { collection: 'CURRENT_AT_RISK' } },
    { key: 'op_not_started',        label: 'Not in production',      value: m.notStarted,            meta: 'Stage empty / not started',       colorClass: '',              filters: { ddStatus: 'NOT_STARTED' } },
    { key: 'op_not_updated_coll',   label: 'Not updated',            value: m.notUpdated,            meta: 'Due today — not touched',         colorClass: 'text-red-600',  filters: { nextUpdate: todayStr() }, alwaysRed: true },
  ];

  const urgentCards = [
    { key: 'op_bs_late',            label: 'Late best sellers',      value: '—',                     meta: 'BS past Final DD',                colorClass: '',              disabled: true },
    { key: 'op_bs_not_started',     label: 'BS not in production',   value: '—',                     meta: 'Best sellers · not started',      colorClass: '',              disabled: true },
    { key: 'op_urgent_not_upd',     label: 'Urgent not updated',     value: m.urgentNotUpdated,      meta: 'Urgent · due today',              colorClass: 'text-red-600',  filters: { urgent: true, nextUpdate: todayStr() }, alwaysRed: true },
    { key: 'op_bno_otw',            label: 'High BNO · low OTW',     value: '—',                     meta: 'US>3000 / UK>1000 · OTW<50%',     colorClass: '',              disabled: true },
  ];

  const performanceCards = [
    { key: 'op_empty_status',       label: 'Empty status',           value: m.emptyStatus,           meta: 'No production stage set',         colorClass: 'text-amber-500',filters: { ddStatus: 'EMPTY' } },
    { key: 'op_stale_status',       label: 'Stuck >5 days',          value: m.staleStatus,           meta: 'Same stage for 5+ days',          colorClass: 'text-amber-500',filters: { staleStatus: true } },
    { key: 'op_late_7',             label: 'Late >7 days',           value: m.late7Plus,             meta: 'Open & past due >7d',             colorClass: 'text-red-500',  filters: { late7Plus: true } },
    { key: 'op_not_updated_perf',   label: 'Not updated',            value: m.notUpdated,            meta: 'Due today — not touched',         colorClass: 'text-red-600',  filters: { nextUpdate: todayStr() }, alwaysRed: true },
  ];

  const cards = tab === 'collection' ? collectionCards : tab === 'urgent' ? urgentCards : performanceCards;

  return (
    <div className="mb-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-2.5">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => pickTab(t.key)}
              className={[
                'h-8 px-3 flex items-center gap-1.5 text-[12px] font-semibold rounded-[8px] border transition-colors',
                active
                  ? 'bg-[#FFF0F7] text-[#E31B7F] border-[#E31B7F]'
                  : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#E31B7F] hover:text-[#E31B7F]',
              ].join(' ')}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }} className="grid gap-3">
        {cards.map(c => (
          <KpiCard
            key={c.key}
            label={c.label}
            value={c.value}
            meta={c.meta}
            colorClass={c.colorClass}
            alwaysRed={c.alwaysRed}
            disabled={c.disabled}
            active={activeKey === c.key}
            onClick={c.disabled ? undefined : () => onApplyFilters(c.key, c.filters)}
          />
        ))}
      </div>
    </div>
  );
}