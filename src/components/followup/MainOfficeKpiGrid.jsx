import React, { useMemo, useState } from 'react';
import {
  NOT_STARTED_DD_STATUSES,
  FABRIC_PPS_RISK_STATUSES,
  REWORK_REPRO_STATUSES,
  QC_STATUSES,
  isUsSupplier,
  isPreviousCollection,
} from '@/lib/followUpConstants';

/* ───────── helpers ───────── */

function isCurrentCollection(r) {
  if (!r.collection) return false;
  const now = new Date();
  const monthShort = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(2);
  const c = r.collection.toLowerCase();
  // Supports formats like "ED-C2026-06-LA", "06/26", "06-26", "Jun 2026", "Jun-26"
  return (
    c.includes(`${yyyy}-${mm}`) ||      // 2026-06
    c.includes(`${mm}-${yyyy}`) ||      // 06-2026
    c.includes(`${mm}/${yy}`) ||        // 06/26
    c.includes(`${mm}-${yy}`) ||        // 06-26
    c.includes(monthShort)              // jun
  );
}

function isNotStarted(r) {
  const s = r.effective_dd_status || 'Empty status';
  return NOT_STARTED_DD_STATUSES.includes(s);
}

/* ───────── card ───────── */

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
      title={label}
      className={[
        'relative bg-white border text-left min-w-0 w-full h-[78px]',
        'flex flex-col justify-between px-3 py-2.5 rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)]',
        'hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(227,27,127,.08)] transition-all duration-[200ms]',
        active ? 'border-[#E31B7F] bg-[#FFF0F7]' : 'border-[#E5E5E5] hover:border-[#FFE5F2]',
        alwaysRed && !active ? 'border-red-200 bg-red-50 hover:border-red-400' : '',
      ].join(' ')}
    >
      <div className="text-[10px] font-bold text-[#525252] uppercase tracking-[.05em] leading-tight line-clamp-2">{label}</div>
      <div className={['font-mono font-bold leading-none text-[20px]', colorClass].join(' ')}>{value}</div>
      <div className="text-[10px] text-[#A3A3A3] truncate">{meta}</div>
    </button>
  );
}

/* ───────── KPI builder (shared logic for both views) ───────── */

function matchesOrderType(row, mode) {
  // mode is 'New' or 'Rep'. The po_types.type value in the DB is typically a
  // longer string like "New Order" / "Repeat Order" / "Rep" / "New", so we
  // do a case-insensitive substring match on the relevant token.
  const t = (row.po_type || '').toLowerCase();
  if (!t) return false;
  if (mode === 'New') return t.includes('new');
  if (mode === 'Rep') return t.includes('rep'); // matches "rep", "repeat"
  return false;
}

function buildKpisForOrderType(rows, kpis, orderType, todayStr, supplierRegion) {
  // Scope all KPIs to this order type AND the active supplier region (matches table default).
  const scoped = rows.filter(r => {
    if (!matchesOrderType(r, orderType)) return false;
    if (supplierRegion === 'US' && !isUsSupplier(r.supplier)) return false;
    if (supplierRegion === 'CHINA' && isUsSupplier(r.supplier)) return false;
    return true;
  });

  const now = new Date();
  const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const cutoff = new Date(eom); cutoff.setDate(eom.getDate() - 5);

  // Pending = scoped POs in HOLD status
  const pending = scoped.filter(r => r.current_status === 'HOLD').length;

  // Late = scoped POs that are LATE (same logic as "late new orders")
  const late = scoped.filter(r => r.late_future === 'LATE').length;

  // Not Updated = scoped POs with next_update = today but no entry logged today
  const notUpdated = scoped.filter(r => {
    if (r.effective_next_update?.slice(0, 10) !== todayStr) return false;
    const log = r.dd_comment_log || [];
    return !log.some(e => e.date?.slice(0, 10) === todayStr);
  }).length;

  // Current Collection = scoped + late + in this month's collection
  const currentColLate = scoped.filter(r => r.late_future === 'LATE' && isCurrentCollection(r));

  // Will miss collection = current collection at risk (final_dd > EOM-5)
  const willMiss = currentColLate.filter(r => r.final_dd && new Date(r.final_dd) > cutoff).length;

  const notStarted = scoped.filter(isNotStarted).length;
  const emptyStatus = scoped.filter(r => !r.effective_dd_status || r.effective_dd_status === 'Empty status').length;

  const baseFilter = { orderType: [orderType] };

  // Shared first row (both views)
  const sharedCards = [
    { id: 'pending',     label: 'Pending',                  value: pending,               meta: 'HOLD requests',                accent: '',      filters: { ...baseFilter, status: 'HOLD' } },
    { id: 'late',        label: 'Late',                     value: late,                  meta: 'Past final due date',          accent: 'red',   filters: { ...baseFilter, lateFuture: ['LATE'] } },
    { id: 'not_updated', label: 'Not Updated',              value: notUpdated,            meta: 'Due today — not touched',      accent: 'red',   filters: { ...baseFilter, nextUpdate: todayStr }, alwaysRed: true },
    { id: 'urgents',     label: 'Urgents',                  value: scoped.filter(r => r.urgent).length, meta: 'Urgent-flagged POs', accent: 'red',   filters: { ...baseFilter, urgencyReason: ['Urgent'] } },
    { id: 'current_col', label: 'Current Collection',       value: currentColLate.length, meta: 'Late · this month',            accent: 'amber', filters: { ...baseFilter, collection: ['CURRENT'], lateFuture: ['LATE'] } },
    { id: 'will_miss',   label: 'Will miss collection',     value: willMiss,              meta: 'Risk EOM cutoff',              accent: 'red',   filters: { ...baseFilter, collection: ['CURRENT_AT_RISK'], lateFuture: ['LATE'] } },
    { id: 'not_started', label: 'Manufactured Not Started', value: notStarted,            meta: 'Production not begun',         accent: 'amber', filters: { ...baseFilter, ddStatus: ['NOT_STARTED'] } },
  ];

  if (orderType === 'New') {
    // NEW KPIs — extra 4 cards (no Urgents/Late Best Sellers/High BNO/Empty Status/Same Status)
    const fabricPpsRisk = scoped.filter(r => FABRIC_PPS_RISK_STATUSES.includes(r.effective_dd_status)).length;
    const reworkRepro   = scoped.filter(r => REWORK_REPRO_STATUSES.includes(r.effective_dd_status)).length;
    const qcOver3d      = scoped.filter(r => QC_STATUSES.includes(r.effective_dd_status) && (r.days_same_status ?? 0) > 3).length;
    const oldCollection = scoped.filter(r => isPreviousCollection(r.collection)).length;
    const dropRisk      = scoped.filter(r => {
      if (!r.final_dd || !r.drop) return false;
      const diff = (new Date(r.drop) - new Date(r.final_dd)) / 86400000;
      return diff >= 0 && diff < 7;
    }).length;

    // Drop the "Urgents" card on New view (per request)
    return [
      ...sharedCards.filter(c => c.id !== 'urgents'),
      { id: 'fabric_pps_risk', label: 'Fabric / PPS at Risk',  value: fabricPpsRisk, meta: 'PPS / Fabric stages',       accent: 'red',   filters: { ...baseFilter, ddStatus: ['FABRIC_PPS_RISK'] } },
      { id: 'rework_repro',    label: 'Rework / Reproduction', value: reworkRepro,   meta: 'Rework or Reproduction',    accent: 'red',   filters: { ...baseFilter, ddStatus: ['REWORK_REPRO'] } },
      { id: 'qc_over_3d',      label: 'QC > 3 days',           value: qcOver3d,      meta: 'QC office / factory stuck', accent: 'amber', filters: { ...baseFilter, ddStatus: ['QC_OVER_3D'] } },
      { id: 'old_collection',  label: 'Old Collection',        value: oldCollection, meta: 'Previous collections',      accent: 'amber', filters: { ...baseFilter, collection: ['PREVIOUS'] } },
      { id: 'drop_risk',       label: 'Drop Risk (< 7d)',      value: dropRisk,      meta: 'Final DD close to drop',    accent: 'red',   filters: { ...baseFilter, dropRisk: true } },
    ];
  }

  // REP view — keep the legacy 5 cards (Late Best Sellers, High BNO, Empty Status, Same Status > 5D) on top of shared
  const lateBestSellers = scoped.filter(r => r.is_best_seller && r.late_future === 'LATE').length;
  const highBnoLowOtw   = scoped.filter(r => r.bno_high_low_otw).length;
  const sameStatusOver5d = scoped.filter(r => (r.days_same_status ?? 0) > 5).length;

  return [
    ...sharedCards,
    { id: 'late_best_sellers', label: 'Late Best Sellers', value: lateBestSellers,  meta: 'BS already late',     accent: 'red',   filters: { ...baseFilter, priority: ['Best Seller'], lateFuture: ['LATE'] } },
    { id: 'high_bno_low_otw',  label: 'High BNO - Low OTW', value: highBnoLowOtw,   meta: 'Demand vs supply gap', accent: 'red',   filters: { ...baseFilter, bnoHighLowOtw: true } },
    { id: 'empty_status',      label: 'Empty Status',       value: emptyStatus,     meta: 'Missing DD status',    accent: 'amber', filters: { ...baseFilter, ddStatus: ['EMPTY'] } },
    { id: 'same_status_5d',    label: 'Same Status > 5D',   value: sameStatusOver5d,meta: 'Stale production',    accent: 'amber', filters: { ...baseFilter, sameStatusOver5d: true } },
  ];
}

/* ───────── main component ───────── */

export default function MainOfficeKpiGrid({
  rows,
  kpis,
  activeOpKpi,
  onOpKpiClick,
  viewMode,
  onViewModeChange,
  supplierRegion = 'CHINA',
}) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const cards = useMemo(
    () => buildKpisForOrderType(rows, kpis, viewMode, todayStr, supplierRegion),
    [rows, kpis, viewMode, todayStr, supplierRegion]
  );

  function handleClick(card) {
    // Reuse the op-kpi handler — it accepts a preset filter object
    onOpKpiClick(`${viewMode}:${card.id}`, card.filters);
  }

  function isActive(card) {
    return activeOpKpi === `${viewMode}:${card.id}`;
  }

  return (
    <div className="mb-4">
      {/* View mode toggle */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em]">KPIs</div>
        <div className="inline-flex bg-white border border-[#E5E5E5] rounded-[8px] p-0.5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
          {['New', 'Rep'].map(mode => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={[
                'px-4 h-7 rounded-[6px] text-[11px] font-semibold transition-all',
                viewMode === mode
                  ? 'bg-[#E31B7F] text-white shadow-[0_1px_3px_rgba(227,27,127,.25)]'
                  : 'text-[#525252] hover:text-[#0A0A0A]',
              ].join(' ')}
            >
              {mode === 'New' ? 'New Orders' : 'Rep Orders'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid — adapts to card count (11 cards either way). 6 cols × 2 rows */}
      <div className="grid grid-cols-6 gap-2">
        {cards.map(card => (
          <KpiCard
            key={card.id}
            kpi={card}
            active={isActive(card)}
            onClick={() => handleClick(card)}
          />
        ))}
      </div>
    </div>
  );
}