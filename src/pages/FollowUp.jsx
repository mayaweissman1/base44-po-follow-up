import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, ChevronDown, Download, LogOut, User as UserIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_DISPLAY, REASON_TO_RESPONSIBILITY, NOT_STARTED_DD_STATUSES, US_SUPPLIERS, isUsSupplier } from '@/lib/followUpConstants';
import KpiCards from '@/components/followup/KpiCards';
import FilterToolbar from '@/components/followup/FilterToolbar';
import FollowUpTable from '@/components/followup/FollowUpTable';
import LogDelayModal from '@/components/followup/LogDelayModal';
import GeneralUpdateModal from '@/components/followup/GeneralUpdateModal';
import DecisionModal from '@/components/followup/DecisionModal';
import InternalNoteModal from '@/components/followup/InternalNoteModal';
import ActivityLogDrawer from '@/components/followup/ActivityLogDrawer';
import PoDetailsDrawer from '@/components/followup/PoDetailsDrawer';
import BulkActionBar from '@/components/followup/BulkActionBar';
import OperationalKpisStrip from '@/components/followup/OperationalKpisStrip';
import MainOfficeKpiGrid from '@/components/followup/MainOfficeKpiGrid';
import InsightsStrip from '@/components/followup/InsightsStrip';

const ALL_ROLES = ['main_office', 'dd_team_manager', 'dd_team_employee'];

const DEFAULT_FILTERS = (role) => ({
  po: '',
  style: '',
  status: 'ALL',
  priority: '',
  supplier: '',
  ddManager: '',
  ddStatus: '',
  reason: '',
  responsibility: '',
  urgent: false,
  archive: false,
  collection: '',
  orderType: '',
  flag: '',
  nextUpdate: '',
  lateFuture: '',
  poRank: '',
  delayResponse: '',
  deliveryStatus: '',
  supplierRegion: 'CHINA', // CHINA | US | ALL — default to China
  // Virtual filters driven by OperationalKpis
  staleStatus: false,
  late7Plus: false,
  bestSeller: false,
  highBno: false,
});

function isCurrentCollectionRow(r) {
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

function passesFilters(row, filters, role) {
  const {
    po, style, status, priority, supplier, ddManager, ddStatus, reason,
    responsibility, urgent, archive, collection, orderType, flag, nextUpdate,
    lateFuture, poRank, delayResponse, deliveryStatus,
  } = filters;

  if (po && !row.po_number?.toLowerCase().includes(po.toLowerCase())) return false;
  if (style && !row.style_color?.toLowerCase().includes(style.toLowerCase())) return false;
  if (supplier && row.supplier !== supplier) return false;
  if (ddManager && row.dd_manager_name !== ddManager) return false;
  if (collection === 'CURRENT') {
    if (!isCurrentCollectionRow(row)) return false;
  } else if (collection === 'CURRENT_AT_RISK') {
    if (!isCurrentCollectionRow(row)) return false;
    if (!row.final_dd) return false;
    const now = new Date();
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const cutoff = new Date(eom); cutoff.setDate(eom.getDate() - 5);
    if (new Date(row.final_dd) <= cutoff) return false;
  } else if (collection && !row.collection?.toLowerCase().includes(collection.toLowerCase())) return false;
  if (orderType) {
    const t = (row.po_type || '').toLowerCase();
    // KPI grid uses 'New'/'Rep' as tokens — match by substring so the table
    // filters the same way the KPI cards do.
    if (orderType === 'New' && !t.includes('new')) return false;
    else if (orderType === 'Rep' && !t.includes('rep')) return false;
    else if (orderType !== 'New' && orderType !== 'Rep' && row.po_type !== orderType) return false;
  }
  // Supplier region (default CHINA)
  if (filters.supplierRegion && filters.supplierRegion !== 'ALL') {
    const isUs = isUsSupplier(row.supplier);
    if (filters.supplierRegion === 'US' && !isUs) return false;
    if (filters.supplierRegion === 'CHINA' && isUs) return false;
  }
  if (filters.staleStatus && !((row.days_same_status ?? 0) > 5)) return false;
  if (filters.late7Plus && !((row.days_late_counting ?? 0) > 7)) return false;
  if (filters.bestSeller && !row.is_best_seller) return false;
  if (filters.highBno && !row.bno_high_low_otw) return false;
  if (flag) {
    if (flag === 'URGENT' && row.flags !== 'URGENT') return false;
    if (flag === 'REVIEW' && row.flags !== 'REVIEW') return false;
    if (flag === 'NONE' && row.flags) return false;
  }
  if (urgent && !row.urgent) return false;
  if (ddStatus === 'EMPTY' || ddStatus === 'Empty status') {
    if (row.effective_dd_status && row.effective_dd_status !== 'Empty status') return false;
  } else if (ddStatus === 'NOT_STARTED') {
    const s = row.effective_dd_status || 'Empty status';
    if (!NOT_STARTED_DD_STATUSES.includes(s)) return false;
  } else if (ddStatus && row.effective_dd_status !== ddStatus) return false;
  if (reason) {
    const rs = row.ddd_reasons?.length ? row.ddd_reasons : (row.ddd_reason ? [row.ddd_reason] : []);
    if (!rs.includes(reason)) return false;
  }
  if (responsibility) {
    const rs = row.ddd_reasons?.length ? row.ddd_reasons : (row.ddd_reason ? [row.ddd_reason] : []);
    const matches = rs.some(r => REASON_TO_RESPONSIBILITY[r] === responsibility);
    if (!matches) return false;
  }
  if (nextUpdate && row.effective_next_update?.slice(0, 10) !== nextUpdate) return false;
  if (lateFuture && row.late_future !== lateFuture) return false;
  if (poRank && String(row.po_rank) !== poRank) return false;
  if (delayResponse && !row.delay_response_comment?.toLowerCase().includes(delayResponse.toLowerCase())) return false;
  if (deliveryStatus && !row.delivery_date_status?.toLowerCase().startsWith(deliveryStatus.toLowerCase())) return false;

  if (priority) {
    if (priority === 'URGENT' && row.priority !== 'URGENT') return false;
    if (priority === 'Deadline' && !(row.priority || '').includes('Deadline')) return false;
    if (priority === 'Normal' && row.priority !== 'Normal') return false;
    if (priority === 'MISSING_SIZES' && row.priority !== 'MISSING SIZES') return false;
    if (priority === 'Drop' && row.priority !== 'Drop') return false;
  }

  // Archive toggle: POs that never entered the HOLD workflow (no delay request logged)
  if (archive) {
    return !row.current_status;
  }

  if (status === 'HOLD') { if (row.current_status !== 'HOLD') return false; }
  else if (status === 'HANDLED') { if (!['APPROVED', 'REJECTED', 'ACKNOWLEDGED'].includes(row.current_status)) return false; }
  else if (status === 'ACK_APPROVED') { if (!['APPROVED', 'ACKNOWLEDGED'].includes(row.current_status)) return false; }
  else if (status === 'ALL') { /* show all */ }
  else if (['APPROVED', 'REJECTED', 'ACKNOWLEDGED', 'AUTOMATICALLY'].includes(status) && row.current_status !== status) return false;

  return true;
}

function exportRowsToCSV(exportRows, filename = 'follow-up.csv') {
  const cols = [
    ['po_number', 'PO Number'], ['style_color', 'Style Color'], ['supplier', 'Supplier'],
    ['dd_manager_name', 'DD Manager'], ['current_status', 'Status'], ['priority', 'Priority'],
    ['due_date', 'Due Date'], ['effective_delayed_due_date', 'Delayed DD'], ['final_dd', 'Final DD'],
    ['days_late_counting', 'Days Late'], ['ddd_reason', 'DD Reason'], ['ddd_comment', 'DDD Comment'],
    ['effective_dd_status', 'DD Status'], ['delivery_date_status', 'Delivery Date Status'],
    ['delay_response_comment', 'Response'], ['collection', 'Collection'],
    ['effective_next_update', 'Next Update'], ['ddd_count', 'DDD Count'],
  ];
  const header = cols.map(([, l]) => `"${l}"`).join(',');
  const body = exportRows.map(r => cols.map(([k]) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function FollowUp() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [showUserMenu, setShowUserMenu] = useState(false);
  // Roles available to this user: admin sees all, others see their assigned roles.
  // Falls back to legacy single `role` value if `roles` array isn't set yet.
  const availableRoles = ALL_ROLES;
  const [activeRole, setActiveRole] = useState(() => {
    if (isAdmin) return 'main_office';
    if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles[0];
    if (ALL_ROLES.includes(user?.role)) return user.role;
    return 'main_office';
  });
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Keep activeRole in sync when availableRoles changes (only when truly invalid)
  useEffect(() => {
    if (availableRoles.length > 0 && !availableRoles.includes(activeRole)) {
      setActiveRole(availableRoles[0]);
    }
  }, [availableRoles, activeRole]);

  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS(activeRole));
  const [activeKpiFilter, setActiveKpiFilter] = useState(null);
  const [activeOpKpi, setActiveOpKpi] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mainOfficeViewMode, setMainOfficeViewMode] = useState('New'); // 'New' | 'Rep'

  function handleMainOfficeViewModeChange(mode) {
    setMainOfficeViewMode(mode);
    setActiveOpKpi(null);
    setActiveKpiFilter(null);
    // Auto-apply order type filter so the table reflects the active view
    setFilters(prev => ({ ...DEFAULT_FILTERS(activeRole), orderType: mode }));
  }

  const [selectedRows, setSelectedRows] = useState(new Set());
  const [logDelayPo, setLogDelayPo] = useState(null);
  const [generalUpdatePo, setGeneralUpdatePo] = useState(null);
  const [decisionState, setDecisionState] = useState(null);
  const [internalNotePo, setInternalNotePo] = useState(null);
  const [logsDrawerPo, setLogsDrawerPo] = useState(null);
  const [bulkLogDelayPOs, setBulkLogDelayPOs] = useState(null);
  const [bulkGeneralUpdatePOs, setBulkGeneralUpdatePOs] = useState(null);
  const [detailsPo, setDetailsPo] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await base44.functions.invoke('getFollowUpData', {});
    if (res.data?.rows) {
      const seen = new Set();
      const uniqueRows = res.data.rows.filter(r => {
        if (seen.has(r.po_number)) return false;
        seen.add(r.po_number);
        return true;
      });
      setRows(uniqueRows);
      setKpis(res.data.kpis || {});
    }
    setLoading(false);
  }, [activeRole]);

  useEffect(() => { loadData(); }, [loadData]);

  // When switching to DD employee role, pre-fill the DD Manager filter with the current user's name
  useEffect(() => {
    const base = DEFAULT_FILTERS(activeRole);
    if (activeRole === 'dd_team_employee' && user?.full_name) {
      base.ddManager = user.full_name;
    }
    if (activeRole === 'main_office') {
      base.orderType = mainOfficeViewMode;
    }
    setFilters(base);
    setActiveKpiFilter(null);
    setSelectedRows(new Set());
  }, [activeRole, user?.full_name, mainOfficeViewMode]);

  function handleKpiFilterClick(filterKey) {
    if (activeKpiFilter === filterKey) {
      setActiveKpiFilter(null);
      const base = DEFAULT_FILTERS(activeRole);
      if (activeRole === 'dd_team_employee' && user?.full_name) base.ddManager = user.full_name;
      setFilters(base);
      return;
    }
    setActiveOpKpi(null);
    setActiveKpiFilter(filterKey);
    // For employee KPIs, always scope to logged-in user
    const empScope = activeRole === 'dd_team_employee' && user?.full_name
      ? { ddManager: user.full_name }
      : {};
    const overrides = {
      new_pending:        { status: 'HOLD' },
      total_pending:      { status: 'HOLD' },
      urgent_pending:     { status: 'HOLD', urgent: true },
      approved_today:     { status: 'APPROVED' },
      rejected_today:     { status: 'REJECTED' },
      acknowledged_today: { status: 'ACK_APPROVED' },
      not_updated:        { status: 'ALL', nextUpdate: new Date().toISOString().slice(0, 10) },
      emp_pending:        { status: 'HOLD' },
      emp_acknowledged:   { status: 'ACK_APPROVED' },
      emp_rejected:       { status: 'REJECTED' },
      emp_received_upd:   { status: 'ALL', deliveryStatus: 'Receiving Notice' },
      mgr_received_upd:   { status: 'ALL', deliveryStatus: 'Receiving Notice' },
    };
    setFilters({ ...DEFAULT_FILTERS(activeRole), ...empScope, ...(overrides[filterKey] || {}) });
  }

  function handleOpKpiClick(key, presetFilters) {
    if (activeOpKpi === key) {
      setActiveOpKpi(null);
      setFilters(DEFAULT_FILTERS(activeRole));
      return;
    }
    setActiveKpiFilter(null);
    setActiveOpKpi(key);
    setFilters({ ...DEFAULT_FILTERS(activeRole), ...(presetFilters || {}) });
  }

  function handleSelectRow(poNumber) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(poNumber)) next.delete(poNumber); else next.add(poNumber);
      return next;
    });
  }

  function handleSelectAll(poNumbers) {
    const allSelected = poNumbers.length > 0 && poNumbers.every(p => selectedRows.has(p));
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (allSelected) poNumbers.forEach(p => next.delete(p));
      else poNumbers.forEach(p => next.add(p));
      return next;
    });
  }

  function handleBulkDecision(decision) {
    const selectedPOs = filteredRows.filter(r => selectedRows.has(r.po_number));
    if (!selectedPOs.length) return;
    setDecisionState({ po: null, decision, posBulk: selectedPOs });
  }

  function onActionSaved() {
    setLogDelayPo(null);
    setGeneralUpdatePo(null);
    setDecisionState(null);
    setInternalNotePo(null);
    setBulkLogDelayPOs(null);
    setBulkGeneralUpdatePOs(null);
    setSelectedRows(new Set());
    loadData();
  }

  const filteredRows = useMemo(
    () => rows.filter(r => passesFilters(r, filters, activeRole)),
    [rows, filters, activeRole]
  );
  const { suppliers, ddManagers, collections, orderTypes } = useMemo(() => {
    const sup = new Set(), mgr = new Set(), col = new Set(), types = new Set();
    for (const r of rows) {
      if (r.supplier) sup.add(r.supplier);
      if (r.dd_manager_name) mgr.add(r.dd_manager_name);
      if (r.collection) col.add(r.collection);
      if (r.po_type) types.add(r.po_type);
    }
    return {
      suppliers: [...sup].sort(),
      ddManagers: [...mgr].sort(),
      collections: [...col].sort(),
      orderTypes: [...types].sort(),
    };
  }, [rows]);

  // Augment server KPIs with client-computed values
  const displayKpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    // "Not Updated": next_update_date = today but no dd_updates row created today
    // We approximate: effective_next_update = today AND dd_comment_log has no entry from today
    const notUpdated = rows.filter(r => {
      if (r.effective_next_update?.slice(0, 10) !== today) return false;
      const log = r.dd_comment_log || [];
      return !log.some(e => e.date?.slice(0, 10) === today);
    }).length;

    // DD Employee KPIs — scoped to the logged-in user's POs (not the filter state)
    const scopedRows = activeRole === 'dd_team_employee'
      ? rows.filter(r => !user?.full_name || r.dd_manager_name === user.full_name)
      : rows;

    const empPending      = scopedRows.filter(r => r.current_status === 'HOLD').length;
    const empAcknowledged = scopedRows.filter(r => ['APPROVED', 'ACKNOWLEDGED'].includes(r.current_status)).length;
    const empRejected     = scopedRows.filter(r => r.current_status === 'REJECTED').length;
    const empReceivedUpd  = scopedRows.filter(r =>
      r.delivery_date_status?.toLowerCase().startsWith('receiving notice')
    ).length;
    const mgrReceivedUpd  = rows.filter(r =>
      r.delivery_date_status?.toLowerCase().startsWith('receiving notice')
    ).length;

    return {
      ...kpis,
      not_updated:        notUpdated,
      emp_pending:        empPending,
      emp_acknowledged:   empAcknowledged,
      emp_rejected:       empRejected,
      emp_received_upd:   empReceivedUpd,
      mgr_received_upd:   mgrReceivedUpd,
    };
  }, [rows, kpis, activeRole, filters.ddManager]);
  const showRoleSwitcher = true;

  return (
    <div className="min-h-screen bg-[#F8F8F8]">

      {/* Mockup banner */}
      <div className="bg-[#FFF0F7] border-b border-[#FFCCDE] text-[#E31B7F] text-[12px] font-semibold text-center px-4 py-2 tracking-wide">
        ⚠️ This is a mockup — data and actions are for preview purposes only.
      </div>

      <div className="px-7 pt-6 pb-0">

        {/* Title + buttons */}
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-bold text-[#0A0A0A] leading-tight">Follow Up</h1>
            <div className="text-[13px] text-[#525252] mt-0.5">
              Working as <strong>{ROLE_DISPLAY[activeRole] || activeRole}</strong>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {showRoleSwitcher && (
              <div className="relative z-50">
                <button
                  onClick={() => setShowRoleDropdown(o => !o)}
                  className="h-8 pl-3 pr-2.5 flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[8px] hover:border-[#E31B7F] hover:bg-[#FFF0F7] transition-colors"
                >
                  <span>{ROLE_DISPLAY[activeRole]}</span>
                  <ChevronDown size={12} />
                </button>
                {showRoleDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,.08)] z-50 min-w-[180px] overflow-hidden">
                    {availableRoles.map(r => (
                      <button
                        key={r}
                        onClick={() => { setActiveRole(r); setShowRoleDropdown(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${activeRole === r ? 'bg-[#FFF0F7] text-[#E31B7F] font-semibold' : 'text-[#0A0A0A] hover:bg-[#F8F8F8]'}`}
                      >
                        {ROLE_DISPLAY[r]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => exportRowsToCSV(filteredRows)}
              className="h-8 px-3.5 flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[8px] hover:bg-[#F8F8F8] transition-colors"
            >
              <Download size={13} /> Export
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="h-8 px-3.5 flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[8px] hover:bg-[#F8F8F8] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>

            {/* User menu */}
            <div className="relative z-50">
              <button
                onClick={() => setShowUserMenu(o => !o)}
                className="h-8 pl-2.5 pr-2.5 flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[8px] hover:border-[#E31B7F] hover:bg-[#FFF0F7] transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-[#FFE5F2] text-[#E31B7F] flex items-center justify-center text-[10px] font-bold">
                  {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate">{user?.full_name || user?.email}</span>
                <ChevronDown size={12} />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,.08)] z-50 min-w-[220px] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5E5E5]">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[#0A0A0A]">
                      <UserIcon size={12} /> {user?.full_name || '—'}
                    </div>
                    <div className="text-[11px] text-[#525252] mt-0.5 truncate">{user?.email}</div>
                    <div className="text-[10px] text-[#A3A3A3] mt-1 uppercase tracking-wide">{user?.role}</div>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-[#0A0A0A] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors flex items-center gap-2"
                  >
                    <LogOut size={12} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {activeRole === 'main_office' ? (
          <MainOfficeKpiGrid
            rows={rows}
            kpis={displayKpis}
            activeOpKpi={activeOpKpi}
            onOpKpiClick={handleOpKpiClick}
            viewMode={mainOfficeViewMode}
            onViewModeChange={handleMainOfficeViewModeChange}
            supplierRegion={filters.supplierRegion || 'CHINA'}
          />
        ) : (
          <KpiCards
            role={activeRole}
            kpis={displayKpis}
            rows={rows}
            activeFilter={activeKpiFilter}
            onFilterClick={handleKpiFilterClick}
          />
        )}

        {/* Zone 3 — Insights strip (main_office only) */}
        {activeRole === 'main_office' && rows.length > 0 && (
          <InsightsStrip rows={rows} />
        )}

        {/* Filter Toolbar */}
        <FilterToolbar
          role={activeRole}
          filters={filters}
          onChange={setFilters}
          onReset={() => {
            const base = DEFAULT_FILTERS(activeRole);
            if (activeRole === 'dd_team_employee' && user?.full_name) base.ddManager = user.full_name;
            setFilters(base);
            setActiveKpiFilter(null);
            setActiveOpKpi(null);
          }}
          suppliers={suppliers}
          ddManagers={ddManagers}
          collections={collections}
          orderTypes={orderTypes}
          advancedOpen={advancedOpen}
          onAdvancedToggle={setAdvancedOpen}
        />
      </div>

      {/* Table area */}
      <div className="px-7 pb-6">
        <FollowUpTable
          rows={filteredRows}
          role={activeRole}
          loading={loading}
          filterStatus={filters.status}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          onPoDetails={activeRole !== 'dd_team_employee' ? po => setDetailsPo(po) : undefined}
          onDecide={(po, decision) => setDecisionState({ po, decision })}
          onLogDelay={po => setLogDelayPo(po)}
          onGeneralUpdate={po => setGeneralUpdatePo(po)}
          onViewLogs={po => setLogsDrawerPo(po)}
          onInternalNote={po => setInternalNotePo(po)}
        />
      </div>

      <BulkActionBar
        count={selectedRows.size}
        role={activeRole}
        onApproveAll={() => handleBulkDecision('APPROVED')}
        onAcknowledgeAll={() => handleBulkDecision('ACKNOWLEDGED')}
        onRejectAll={() => handleBulkDecision('REJECTED')}
        onBulkLogDelay={() => setBulkLogDelayPOs(filteredRows.filter(r => selectedRows.has(r.po_number)))}
        onBulkGeneralUpdate={() => setBulkGeneralUpdatePOs(filteredRows.filter(r => selectedRows.has(r.po_number)))}
        onExport={() => exportRowsToCSV(filteredRows.filter(r => selectedRows.has(r.po_number)), 'selected-pos.csv')}
        onClear={() => setSelectedRows(new Set())}
      />

      {logDelayPo && (
        <LogDelayModal
          po={logDelayPo}
          posBulk={null}
          onClose={() => setLogDelayPo(null)}
          onSaved={onActionSaved}
          currentUser={user}
        />
      )}
      {generalUpdatePo && (
        <GeneralUpdateModal
          po={generalUpdatePo}
          posBulk={null}
          onClose={() => setGeneralUpdatePo(null)}
          onSaved={onActionSaved}
        />
      )}
      {decisionState && (
        <DecisionModal
          po={decisionState.po}
          posBulk={decisionState.posBulk}
          decision={decisionState.decision}
          onClose={() => setDecisionState(null)}
          onSaved={onActionSaved}
        />
      )}
      {internalNotePo && (
        <InternalNoteModal
          po={internalNotePo}
          onClose={() => setInternalNotePo(null)}
          onSaved={onActionSaved}
        />
      )}
      {logsDrawerPo && (
        <ActivityLogDrawer
          po={logsDrawerPo}
          userRole={activeRole}
          onClose={() => setLogsDrawerPo(null)}
        />
      )}
      {bulkLogDelayPOs && (
        <LogDelayModal
          po={null}
          posBulk={bulkLogDelayPOs}
          onClose={() => setBulkLogDelayPOs(null)}
          onSaved={onActionSaved}
          currentUser={user}
        />
      )}
      {bulkGeneralUpdatePOs && (
        <GeneralUpdateModal
          po={null}
          posBulk={bulkGeneralUpdatePOs}
          onClose={() => setBulkGeneralUpdatePOs(null)}
          onSaved={onActionSaved}
        />
      )}
      {detailsPo && (
        <PoDetailsDrawer
          po={detailsPo}
          onClose={() => setDetailsPo(null)}
        />
      )}

      {showRoleDropdown && <div className="fixed inset-0 z-20" onClick={() => setShowRoleDropdown(false)} />}
      {showUserMenu && <div className="fixed inset-0 z-20" onClick={() => setShowUserMenu(false)} />}
    </div>
  );
}