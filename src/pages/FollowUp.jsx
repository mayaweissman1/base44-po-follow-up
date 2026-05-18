import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, ChevronDown, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_DISPLAY, REASON_TO_RESPONSIBILITY } from '@/lib/followUpConstants';
import KpiCards from '@/components/followup/KpiCards';
import StatsRow from '@/components/followup/StatsRow';
import FilterToolbar from '@/components/followup/FilterToolbar';
import FollowUpTable from '@/components/followup/FollowUpTable';
import LogDelayModal from '@/components/followup/LogDelayModal';
import GeneralUpdateModal from '@/components/followup/GeneralUpdateModal';
import DecisionModal from '@/components/followup/DecisionModal';
import InternalNoteModal from '@/components/followup/InternalNoteModal';
import ActivityLogDrawer from '@/components/followup/ActivityLogDrawer';
import PoDetailsDrawer from '@/components/followup/PoDetailsDrawer';
import BulkActionBar from '@/components/followup/BulkActionBar';

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
  collection: '',
  orderType: '',
  flag: '',
  nextUpdate: '',
  lateFuture: '',
  poRank: '',
  destination: '',
  delayResponse: '',
});

function passesFilters(row, filters, role) {
  const {
    po, style, status, priority, supplier, ddManager, ddStatus, reason,
    responsibility, urgent, collection, orderType, flag, nextUpdate,
    lateFuture, poRank, destination, delayResponse,
  } = filters;

  if (po && !row.po_number?.toLowerCase().includes(po.toLowerCase())) return false;
  if (style && !row.style_color?.toLowerCase().includes(style.toLowerCase())) return false;
  if (supplier && row.supplier !== supplier) return false;
  if (ddManager && row.dd_manager_name !== ddManager) return false;
  if (collection && !row.collection?.toLowerCase().includes(collection.toLowerCase())) return false;
  if (orderType) {
    const t = row.po_number.endsWith('-CL') ? 'CL' : row.po_number.endsWith('-AC') ? 'ACC' : 'Regular';
    if (t !== orderType) return false;
  }
  if (flag) {
    if (flag === 'URGENT' && row.flags !== 'URGENT') return false;
    if (flag === 'REVIEW' && row.flags !== 'REVIEW') return false;
    if (flag === 'NONE' && row.flags) return false;
  }
  if (urgent && !row.urgent) return false;
  if (ddStatus && row.effective_dd_status !== ddStatus) return false;
  if (reason && row.ddd_reason !== reason) return false;
  if (responsibility && REASON_TO_RESPONSIBILITY[row.ddd_reason] !== responsibility) return false;
  if (nextUpdate && row.effective_next_update?.slice(0, 10) !== nextUpdate) return false;
  if (lateFuture && row.late_future !== lateFuture) return false;
  if (poRank && String(row.po_rank) !== poRank) return false;
  if (destination && row.destination !== destination) return false;
  if (delayResponse && !row.delay_response_comment?.toLowerCase().includes(delayResponse.toLowerCase())) return false;

  if (priority) {
    if (priority === 'URGENT' && row.priority !== 'URGENT') return false;
    if (priority === 'Deadline' && !(row.priority || '').includes('Deadline')) return false;
    if (priority === 'Normal' && row.priority !== 'Normal') return false;
    if (priority === 'MISSING_SIZES' && row.priority !== 'MISSING SIZES') return false;
    if (priority === 'Drop' && row.priority !== 'Drop') return false;
  }

  if (status === 'HOLD' && row.current_status !== 'HOLD') return false;
  else if (status === 'HANDLED' && !['APPROVED', 'REJECTED', 'ACKNOWLEDGED'].includes(row.current_status)) return false;
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // Non-admin users are locked to their assigned role
  const userRole = isAdmin ? 'main_office' : (user?.role || 'main_office');
  const [activeRole, setActiveRole] = useState(userRole);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS(activeRole));
  const [activeKpiFilter, setActiveKpiFilter] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
    const payload = {};
    if (activeRole === 'dd_team_employee' && user?.dd_employee_id) {
      payload.dd_employee_id = user.dd_employee_id;
    }
    const res = await base44.functions.invoke('getFollowUpData', payload);
    if (res.data?.rows) {
      setRows(res.data.rows);
      setKpis(res.data.kpis || {});
    }
    setLoading(false);
  }, [activeRole, user?.dd_employee_id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setFilters(DEFAULT_FILTERS(activeRole));
    setActiveKpiFilter(null);
    setSelectedRows(new Set());
  }, [activeRole]);

  function handleKpiFilterClick(filterKey) {
    if (activeKpiFilter === filterKey) {
      setActiveKpiFilter(null);
      setFilters(DEFAULT_FILTERS(activeRole));
      return;
    }
    setActiveKpiFilter(filterKey);
    const overrides = {
      new_pending:        { status: 'HOLD' },
      total_pending:      { status: 'HOLD' },
      urgent_pending:     { status: 'HOLD', urgent: true },
      approved_today:     { status: 'APPROVED' },
      rejected_today:     { status: 'REJECTED' },
      acknowledged_today: { status: 'ACKNOWLEDGED' },
    };
    setFilters(f => ({ ...DEFAULT_FILTERS(activeRole), ...(overrides[filterKey] || {}) }));
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

  async function handleBulkDecision(decision) {
    const selectedPOs = filteredRows.filter(r => selectedRows.has(r.po_number));
    if (!selectedPOs.length) return;
    if (!window.confirm(`Mark ${selectedPOs.length} PO${selectedPOs.length > 1 ? 's' : ''} as ${decision}?`)) return;
    for (const po of selectedPOs) {
      await base44.functions.invoke('saveFollowUpAction', {
        action_type: 'DECISION',
        po_number: po.po_number,
        payload: { decision, last_ddd_update_id: po.last_ddd_update_id },
      });
    }
    setSelectedRows(new Set());
    loadData();
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
  const { suppliers, ddManagers, collections, destinations } = useMemo(() => {
    const sup = new Set(), mgr = new Set(), col = new Set(), dest = new Set();
    for (const r of rows) {
      if (r.supplier) sup.add(r.supplier);
      if (r.dd_manager_name) mgr.add(r.dd_manager_name);
      if (r.collection) col.add(r.collection);
      if (r.destination) dest.add(r.destination);
    }
    return {
      suppliers: [...sup].sort(),
      ddManagers: [...mgr].sort(),
      collections: [...col].sort(),
      destinations: [...dest].sort(),
    };
  }, [rows]);
  const allRoles = ['main_office', 'dd_team_manager', 'dd_team_employee'];

  return (
    <div className="h-screen flex flex-col bg-[#F8F8F8] overflow-hidden">

      {/* Fixed header — never scrolls */}
      <div className="flex-shrink-0 bg-[#F8F8F8] px-7 pt-6 pb-0 z-40">

        {/* Title + buttons */}
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-bold text-[#0A0A0A] leading-tight">Follow Up</h1>
            <div className="text-[13px] text-[#525252] mt-0.5">
              Working as <strong>{ROLE_DISPLAY[activeRole] || activeRole}</strong>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
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
                    {allRoles.map(r => (
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
          </div>
        </div>

        {/* KPI Cards */}
        <KpiCards
          role={activeRole}
          kpis={kpis}
          activeFilter={activeKpiFilter}
          onFilterClick={handleKpiFilterClick}
        />

        {/* Stats Row — main_office only */}
        {activeRole === 'main_office' && rows.length > 0 && (
          <StatsRow rows={rows} />
        )}

        {/* Filter Toolbar */}
        <FilterToolbar
          role={activeRole}
          filters={filters}
          onChange={setFilters}
          onReset={() => { setFilters(DEFAULT_FILTERS(activeRole)); setActiveKpiFilter(null); }}
          suppliers={suppliers}
          ddManagers={ddManagers}
          collections={collections}
          destinations={destinations}
          advancedOpen={advancedOpen}
          onAdvancedToggle={setAdvancedOpen}
        />
      </div>

      {/* Scrollable table area */}
      <div className="flex-1 overflow-y-auto px-7 pb-6">
        <FollowUpTable
          rows={filteredRows}
          role={activeRole}
          loading={loading}
          filterStatus={filters.status}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          onPoDetails={po => setDetailsPo(po)}
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
    </div>
  );
}