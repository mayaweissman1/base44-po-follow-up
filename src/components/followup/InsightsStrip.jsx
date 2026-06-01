import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, TrendingUp, TrendingDown, Users } from 'lucide-react';
import LeaderboardDrawer from './LeaderboardDrawer';
import { REASON_TO_RESPONSIBILITY } from '@/lib/followUpConstants';

const LATE_THRESHOLD_PCT = 30;

function buildStats(rows, key) {
  const buckets = new Map();
  for (const r of rows) {
    const k = r[key];
    if (!k) continue;
    if (!buckets.has(k)) buckets.set(k, { name: k, total: 0, late: 0, urgent: 0, ontime: 0 });
    const b = buckets.get(k);
    b.total++;
    if (r.late_future === 'LATE') b.late++;
    else if (r.late_future === 'FUTURE') b.ontime++;
    if (r.urgent) b.urgent++;
  }
  const arr = [...buckets.values()].map(b => ({
    ...b,
    latePct: b.total > 0 ? Math.round((b.late / b.total) * 100) : 0,
    ontimePct: b.total > 0 ? Math.round((b.ontime / b.total) * 100) : 0,
  }));
  return arr;
}

function InsightRow({ icon: Icon, label, valueLabel, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[6px] hover:bg-[#FAFAFA] transition-colors text-left"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={12} className={accent || 'text-[#A3A3A3]'} />
        <span className="text-[12px] text-[#525252] font-medium truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`text-[12px] font-semibold ${accent || 'text-[#0A0A0A]'}`}>{valueLabel}</span>
        <ChevronRight size={11} className="text-[#A3A3A3]" />
      </div>
    </button>
  );
}

export default function InsightsStrip({ rows }) {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(null); // { title, scope: 'supplier'|'manager', sort: 'late'|'ontime'|'workload'|'urgent' }

  const supplierStats = useMemo(() => buildStats(rows, 'supplier'), [rows]);
  const managerStats  = useMemo(() => buildStats(rows, 'dd_manager_name'), [rows]);

  const topLateSupplier   = useMemo(() => [...supplierStats].filter(s => s.total >= 5).sort((a, b) => b.latePct - a.latePct)[0] || null, [supplierStats]);
  const topOntimeSupplier = useMemo(() => [...supplierStats].filter(s => s.total >= 5).sort((a, b) => b.ontimePct - a.ontimePct)[0] || null, [supplierStats]);
  const topWorkloadSup    = useMemo(() => [...supplierStats].sort((a, b) => b.total - a.total)[0] || null, [supplierStats]);
  const suppliersAboveThr = useMemo(() => supplierStats.filter(s => s.total >= 5 && s.latePct >= LATE_THRESHOLD_PCT).length, [supplierStats]);

  // HOLD responsibility breakdown — only for actual pending HOLDs
  const { respCounts, holdsTotal } = useMemo(() => {
    const holds = rows.filter(r => r.current_status === 'HOLD');
    const counts = { OTHER: 0, EDIKTED: 0, SUPPLIER: 0 };
    holds.forEach(r => {
      const resp = REASON_TO_RESPONSIBILITY[r.ddd_reason] || 'OTHER';
      counts[resp]++;
    });
    return { respCounts: counts, holdsTotal: holds.length };
  }, [rows]);

  const topLateMgr      = useMemo(() => [...managerStats].sort((a, b) => b.late - a.late)[0] || null, [managerStats]);
  const topOntimeMgr    = useMemo(() => [...managerStats].filter(m => m.total >= 5).sort((a, b) => b.ontimePct - a.ontimePct)[0] || null, [managerStats]);
  const topUrgentMgr    = useMemo(() => [...managerStats].sort((a, b) => b.urgent - a.urgent)[0] || null, [managerStats]);

  return (
    <div className="mb-4 bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#525252] uppercase tracking-[.08em]">📊 Insights</span>
          {!open && suppliersAboveThr > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
              <AlertTriangle size={9} /> {suppliersAboveThr} suppliers above {LATE_THRESHOLD_PCT}% late
            </span>
          )}
        </div>
        <ChevronDown size={14} className={`text-[#A3A3A3] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* HOLDs by responsibility */}
          <div className="border-t border-[#E5E5E5] px-3 py-3">
            <div className="bg-[#FAFAFA] border border-[#F0F0F0] rounded-[8px] px-4 py-3">
              <div className="text-[10px] font-bold text-[#525252] uppercase tracking-[.08em] mb-2.5">HOLDs by responsibility</div>
              {holdsTotal === 0 ? (
                <div className="text-[12px] text-[#A3A3A3]">No active HOLDs</div>
              ) : (
                <>
                  <div className="flex h-2 rounded-full overflow-hidden mb-2 bg-[#E5E5E5]">
                    <span style={{ width: `${(respCounts.OTHER / holdsTotal) * 100}%`, background: '#F59E0B' }} />
                    <span style={{ width: `${(respCounts.EDIKTED / holdsTotal) * 100}%`, background: '#8B5CF6' }} />
                    <span style={{ width: `${(respCounts.SUPPLIER / holdsTotal) * 100}%`, background: '#EF4444' }} />
                  </div>
                  <div className="flex gap-4 flex-wrap text-[11px]">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="font-mono font-semibold text-[#0A0A0A]">{respCounts.OTHER}</span><span className="text-[#525252]">Other</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /><span className="font-mono font-semibold text-[#0A0A0A]">{respCounts.EDIKTED}</span><span className="text-[#525252]">Edikted</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="font-mono font-semibold text-[#0A0A0A]">{respCounts.SUPPLIER}</span><span className="text-[#525252]">Supplier</span></div>
                  </div>
                </>
              )}
            </div>
          </div>

        <div className="border-t border-[#E5E5E5] grid grid-cols-1 md:grid-cols-2 gap-x-4 px-2 py-2">
          {/* Supplier insights */}
          <div className="px-1">
            <div className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] px-3 pt-1.5 pb-1">Suppliers</div>
            {topLateSupplier && (
              <InsightRow
                icon={TrendingDown}
                accent="text-red-500"
                label={`Top late: ${topLateSupplier.name}`}
                valueLabel={`${topLateSupplier.latePct}% · ${topLateSupplier.total} POs`}
                onClick={() => setDrawer({ title: 'Suppliers · Most late', scope: 'supplier', sort: 'late' })}
              />
            )}
            {topOntimeSupplier && (
              <InsightRow
                icon={TrendingUp}
                accent="text-green-600"
                label={`Most on-time: ${topOntimeSupplier.name}`}
                valueLabel={`${topOntimeSupplier.ontimePct}% on-time`}
                onClick={() => setDrawer({ title: 'Suppliers · Most on-time', scope: 'supplier', sort: 'ontime' })}
              />
            )}
            {topWorkloadSup && (
              <InsightRow
                icon={Users}
                label={`Biggest workload: ${topWorkloadSup.name}`}
                valueLabel={`${topWorkloadSup.total} open`}
                onClick={() => setDrawer({ title: 'Suppliers · By workload', scope: 'supplier', sort: 'workload' })}
              />
            )}
            {suppliersAboveThr > 0 && (
              <InsightRow
                icon={AlertTriangle}
                accent="text-red-600"
                label={`${suppliersAboveThr} suppliers above ${LATE_THRESHOLD_PCT}% late`}
                valueLabel="See all"
                onClick={() => setDrawer({ title: `Suppliers above ${LATE_THRESHOLD_PCT}% late`, scope: 'supplier', sort: 'late' })}
              />
            )}
          </div>

          {/* Manager insights */}
          <div className="px-1 border-t md:border-t-0 md:border-l border-[#F0F0F0] md:pl-4 mt-1 md:mt-0">
            <div className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] px-3 pt-1.5 pb-1">DD Managers</div>
            {topLateMgr && (
              <InsightRow
                icon={TrendingDown}
                accent="text-red-500"
                label={`Top late: ${topLateMgr.name}`}
                valueLabel={`${topLateMgr.late} late POs`}
                onClick={() => setDrawer({ title: 'Managers · Most late', scope: 'manager', sort: 'late' })}
              />
            )}
            {topOntimeMgr && (
              <InsightRow
                icon={TrendingUp}
                accent="text-green-600"
                label={`Top on-time: ${topOntimeMgr.name}`}
                valueLabel={`${topOntimeMgr.ontimePct}% on-time`}
                onClick={() => setDrawer({ title: 'Managers · Most on-time', scope: 'manager', sort: 'ontime' })}
              />
            )}
            {topUrgentMgr && (
              <InsightRow
                icon={AlertTriangle}
                accent="text-amber-500"
                label={`Most urgent load: ${topUrgentMgr.name}`}
                valueLabel={`${topUrgentMgr.urgent} urgent`}
                onClick={() => setDrawer({ title: 'Managers · By urgent load', scope: 'manager', sort: 'urgent' })}
              />
            )}
          </div>
        </div>
        </>
      )}

      {drawer && (
        <LeaderboardDrawer
          title={drawer.title}
          stats={drawer.scope === 'supplier' ? supplierStats : managerStats}
          sort={drawer.sort}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}